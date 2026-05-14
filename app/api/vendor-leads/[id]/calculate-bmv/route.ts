/**
 * API Route: /api/vendor-leads/[id]/calculate-bmv
 * Calculates BMV score and offer details for a vendor lead
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  fetchSoldPrices,
  fetchPropertyValuation,
  fetchRentalData,
  filterComparables,
  calculateAverageComparablePrice,
  fetchEpcData,
  matchEpcRecord,
  SoldProperty,
} from "@/lib/propertydata"
import { findOwnershipByPostcode, resolvePostcodeFromAddress } from "@/lib/land-registry"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch the vendor lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    // Check if we have the minimum required data
    if (!lead.askingPrice) {
      return NextResponse.json(
        { error: "Asking price is required for BMV calculation" },
        { status: 400 }
      )
    }

    const askingPrice = lead.askingPrice.toNumber()
    let marketValue = lead.estimatedMarketValue?.toNumber() || null
    let marketValueSource = "manual_entry"
    let comparables: SoldProperty[] = []
    let creditsUsed = 0

    // Rental data for yield calculations.
    // The stored estimatedMonthlyRent is a previously-computed cached value, NOT a
    // user-entered override — so we always recompute from the priority chain and use
    // the stored figure only as a last resort. This prevents stale area-average figures
    // (e.g. £505 fetched without a bedroom filter) from persisting across recalculations.
    let monthlyRent = 0
    let annualRent = 0
    let weeklyRent = 0
    let rentConfidenceRange: { min: number; max: number } | null = null
    let rentalDataSource = "none"
    const storedRent = lead.estimatedMonthlyRent?.toNumber() || 0  // fallback only
    const squareFeet = lead.squareFeet || 0
    const localAverageRent = lead.localAverageRent?.toNumber() || 0

    // Try to get real market data from PropertyData API
    let apiMarketValue: number | null = null
    let comparableAverage: number | null = null
    let valuationEstimate: number | null = null

    // ── Postcode resolution ──────────────────────────────────────────────────
    // Scrapers (especially Zoopla) sometimes store the wrong postcode:
    //   - SE1 2LH  — Zoopla's own London office appears in the page footer
    //   - SA6      — outcode only, no incode (Zoopla withholds it for privacy)
    // We cross-check the stored postcode against:
    //   1. The outcode embedded in the display address (e.g. "…Swansea SA6")
    //   2. The Land Registry companyOwnership table (if imported)
    //   3. postcodes.io free API (fallback, gives representative postcode for area)
    let effectivePostcode = lead.propertyPostcode ?? null
    let postcodeResolutionSource: string | null = null
    let postcodeWasCorrected = false

    try {
      const resolved = await resolvePostcodeFromAddress(
        lead.propertyAddress ?? null,
        lead.propertyPostcode ?? null
      )
      if (resolved) {
        effectivePostcode = resolved.postcode
        postcodeResolutionSource = resolved.source
        postcodeWasCorrected = resolved.corrected

        if (resolved.corrected) {
          console.log(
            `[BMV Calculator] Postcode corrected: "${lead.propertyPostcode}" → "${resolved.postcode}" (source: ${resolved.source})`
          )
          // Persist the corrected postcode so future BMV calculations are accurate
          await prisma.vendorLead.update({
            where: { id: params.id },
            data: { propertyPostcode: resolved.postcode },
          })
        }
      }
    } catch (err) {
      console.warn("[BMV Calculator] Postcode resolution failed:", err)
    }

    // Detect if we still have only an outcode (e.g. resolution could not find a full postcode)
    const isOutcodeOnly = effectivePostcode
      ? !/^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/i.test(effectivePostcode.trim())
      : true

    if (isOutcodeOnly) {
      console.warn(
        `[BMV Calculator] Postcode "${effectivePostcode}" is still outcode-only after resolution attempt — PropertyData API needs a full postcode. Skipping API calls.`
      )
    }

    if (effectivePostcode && !isOutcodeOnly) {
      console.log(`[BMV Calculator] Using postcode: ${effectivePostcode}${postcodeWasCorrected ? ` (corrected from "${lead.propertyPostcode}" via ${postcodeResolutionSource})` : ""}`)

      try {
        // First, check if we have stored comparables (saves API credits).
        // No take() limit — use all stored comparables so validation notes match
        // the comparables tab exactly.  The comparables tab has no cap either.
        const storedComparables = await prisma.comparableProperty.findMany({
          where: { vendorLeadId: params.id },
          orderBy: [
            { distance: "asc" },
            { saleDate: "desc" },
          ],
        })

        if (storedComparables.length > 0) {
          // Use stored comparables (no API call needed)
          console.log(`[BMV Calculator] Using ${storedComparables.length} stored comparables`)

          comparables = storedComparables.map((comp) => ({
            address: comp.address,
            salePrice: comp.salePrice.toNumber(),
            saleDate: comp.saleDate.toISOString(),
            bedrooms: comp.bedrooms || 0,
            propertyType: comp.propertyType || "",
            distance: comp.distance?.toNumber(),
          }))

          comparableAverage = Math.round(
            storedComparables.reduce((sum, c) => sum + c.salePrice.toNumber(), 0) / storedComparables.length
          )

          console.log(`[BMV Calculator] Average comparable price from stored data: £${comparableAverage?.toLocaleString()}`)
          creditsUsed = 0 // No credits used when using stored data
        } else {
          // No stored comparables, fetch from PropertyData API
          console.log(`[BMV Calculator] No stored comparables, fetching from PropertyData...`)

          const soldPricesResult = await fetchSoldPrices(
            effectivePostcode!,
            undefined, // no bedroom filter at API level — filter ourselves for ±1 tolerance
            3, // 3 miles radius
            200 // larger pool to filter from
          )

          if (soldPricesResult) {
            creditsUsed += soldPricesResult.creditsUsed
            console.log(`[BMV Calculator] Found ${soldPricesResult.soldProperties.length} sold properties`)

            // Filter to get best comparables
            comparables = filterComparables(
              soldPricesResult.soldProperties,
              lead.bedrooms || undefined,
              lead.propertyType || undefined,
              24, // last 24 months
              10, // top 10 comparables
              effectivePostcode || undefined,
              1 // ±1 bedroom tolerance
            )

            console.log(`[BMV Calculator] Filtered to ${comparables.length} comparable properties`)

            if (comparables.length > 0) {
              comparableAverage = calculateAverageComparablePrice(comparables)
              console.log(`[BMV Calculator] Average comparable price: £${comparableAverage?.toLocaleString()}`)
            }
          }
        }

        // Fetch PropertyData valuation if we have enough data - 1 credit
        // Only call if we have square footage (required for valuation API)
        // For now, skip valuation API and use comparables only

        // ── Rent resolution (priority chain) ─────────────────────────────────
        // Priority 1: existing stored rent (manual entry or previously confirmed)
        // Priority 2: derive from comparable sale prices × typical area yield
        //             — more accurate than the API area average for specific
        //               bedroom counts (e.g. SA11 2-beds rent for £836/mo but
        //               the /rents area average blends in studios → £505/mo)
        // Priority 3: PropertyData /rents area average (last resort, 1 credit)

        if (monthlyRent === 0 || rentalDataSource === "none") {
          // Priority 2: comparable-derived rent
          if (comparableAverage && comparableAverage > 0 && lead.bedrooms) {
            // Typical South Wales BTL gross yields by bedroom count.
            // These reflect actual SA/CF/NP market conditions rather than UK averages.
            const yieldByBeds: Record<number, number> = { 1: 0.075, 2: 0.070, 3: 0.068, 4: 0.065 }
            const typicalYield = yieldByBeds[lead.bedrooms] ?? 0.070
            monthlyRent = Math.round((comparableAverage * typicalYield) / 12)
            annualRent = monthlyRent * 12
            weeklyRent = Math.round(monthlyRent / 4.333)
            rentalDataSource = "comparable_avg"
            console.log(
              `[BMV Calculator] Rent from comparable avg ` +
              `(£${comparableAverage.toLocaleString()} × ${(typicalYield * 100).toFixed(1)}% yield): ` +
              `£${monthlyRent}/mo — more accurate than area-wide API average`
            )
          }

          // Priority 3: PropertyData /rents area average (only if no comparables)
          if (monthlyRent === 0) {
            console.log(`[BMV Calculator] Fetching PropertyData area rent (fallback)...`)
            try {
              const rentalResult = await fetchRentalData(
                effectivePostcode!,
                lead.bedrooms || undefined,
                lead.propertyType || undefined
              )

              if (rentalResult) {
                monthlyRent = rentalResult.monthlyRent
                weeklyRent = rentalResult.weeklyRent
                annualRent = monthlyRent * 12
                rentConfidenceRange = rentalResult.confidenceRange
                rentalDataSource = "propertydata_api"
                creditsUsed += 1

                console.log(
                  `[BMV Calculator] Rent from PropertyData area avg: £${monthlyRent}/mo ` +
                  `(⚠️ area-wide average — may understate for ${lead.bedrooms ?? '?'}-bed properties)`
                )
              } else {
                console.log(`[BMV Calculator] No rental data available from API`)
              }
            } catch (error) {
              console.error("[BMV Calculator] Error fetching rental data:", error)
            }
          }
        // Priority 4: stored DB value (last resort — may be stale API figure)
        if (monthlyRent === 0 && storedRent > 0) {
          monthlyRent = storedRent
          annualRent = monthlyRent * 12
          weeklyRent = Math.round(monthlyRent / 4.333)
          rentalDataSource = "stored_fallback"
          console.log(`[BMV Calculator] Using stored rent as fallback: £${monthlyRent}/mo (may be stale)`)
        }
        }

      } catch (error) {
        console.error("[BMV Calculator] Error fetching comparables:", error)
        // Continue with fallback logic
      }
    } else {
      if (isOutcodeOnly) {
        console.log("[BMV Calculator] Outcode-only postcode — skipping PropertyData API, using fallback estimation")
      } else {
        console.log("[BMV Calculator] No postcode available, using fallback estimation")
      }
    }

    // ── EPC data ─────────────────────────────────────────────────────────────────
    let epcRating: string | null = null
    let epcScore: number | null = null
    let epcInspectionDate: Date | null = null

    // ── Land Registry ownership lookup ──────────────────────────────────────
    // Check if land registry data has been imported before querying
    let landRegistryOwnership: Awaited<ReturnType<typeof findOwnershipByPostcode>> = null
    let landRegistryUsed = false
    if (effectivePostcode) {
      try {
        const hasLRData = await prisma.companyOwnership.findFirst({ select: { id: true } })
        if (hasLRData) {
          landRegistryOwnership = await findOwnershipByPostcode(effectivePostcode)
          if (landRegistryOwnership) {
            landRegistryUsed = true
            console.log(
              `[BMV Calculator] Land Registry: ${landRegistryOwnership.companyName} | ` +
              `corporate=${landRegistryOwnership.isCorporateOwned} overseas=${landRegistryOwnership.isOverseasOwned} ` +
              `portfolio=${landRegistryOwnership.isPortfolioOwner}`
            )
          } else {
            console.log("[BMV Calculator] Land Registry imported but no match for this postcode")
          }
        } else {
          console.log("[BMV Calculator] Land Registry data not imported — skipping ownership lookup")
        }
      } catch (err) {
        console.error("[BMV Calculator] Land Registry lookup failed:", err)
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    // ── EPC fetch ─────────────────────────────────────────────────────────────────
    if (effectivePostcode && !isOutcodeOnly) {
      try {
        const epcRecords = await fetchEpcData(effectivePostcode)
        if (epcRecords && epcRecords.length > 0) {
          const best = matchEpcRecord(epcRecords, lead.propertyAddress ?? null)
          if (best) {
            epcRating = best.rating
            epcScore = best.score
            epcInspectionDate = best.inspectionDate
            console.log(`[BMV Calculator] EPC: ${best.rating} (${best.score}/100) inspected ${best.inspectionDate.toLocaleDateString("en-GB")}`)
          }
        }
      } catch (err) {
        console.warn("[BMV Calculator] EPC fetch failed:", err)
      }
    }
    // ─────────────────────────────────────────────────────────────────────────────

    // Calculate final market value using weighted sources
    if (comparableAverage && comparableAverage > 0) {
      // Use comparable average as primary source (high confidence)
      apiMarketValue = comparableAverage
      marketValueSource = "comparable_sales"
      console.log(`[BMV Calculator] Using comparable sales average: £${apiMarketValue.toLocaleString()}`)
    }

    // Use API market value if available, otherwise fall back to manual entry or estimation
    if (apiMarketValue) {
      marketValue = apiMarketValue
    } else if (!marketValue) {
      // Fallback: estimate based on asking price and property condition
      console.log("[BMV Calculator] No PropertyData available, using estimation fallback")
      let multiplier = 1.20 // Base 20% above asking

      // Adjust based on motivation score
      if (lead.motivationScore) {
        if (lead.motivationScore >= 8) {
          multiplier = 1.30 // Highly motivated = bigger discount
        } else if (lead.motivationScore >= 6) {
          multiplier = 1.20
        } else if (lead.motivationScore >= 4) {
          multiplier = 1.15
        } else {
          multiplier = 1.10 // Low motivation = smaller discount
        }
      }

      // Adjust for condition
      if (lead.condition === "excellent") {
        multiplier *= 1.05 // Excellent condition adds value
      } else if (lead.condition === "poor" || lead.condition === "needs_modernisation") {
        multiplier *= 0.95 // Poor condition reduces value
      }

      marketValue = askingPrice * multiplier
      marketValueSource = "estimated"
    }

    // Calculate BMV score (percentage below market value)
    const bmvScore = ((marketValue - askingPrice) / marketValue) * 100

    console.log(`[BMV Calculator] Final market value: £${marketValue.toLocaleString()} (source: ${marketValueSource})`)
    console.log(`[BMV Calculator] BMV Score: ${bmvScore.toFixed(1)}%`)

    const refurbCost = lead.estimatedRefurbCost?.toNumber() || 0

    // ── Strategy-aware offer calculator (when enabled in settings) ────────────
    let calculatedOffer: number
    let offerPercentage: number
    let strategyExplanationBlock = ""
    let rawCalculatedOffer = 0
    let offerCappedAtAsking = false

    const offerCalcConfig = await prisma.offerCalculatorConfig.findFirst()

    if (offerCalcConfig?.enableStrategyMode) {
      const { calculateOffer, mapCondition, toOfferConfig, DEFAULT_OFFER_CONFIG } =
        await import("@/lib/offer-calculator")

      const offerResult = calculateOffer({
        askingPrice,
        marketValue,
        refurbCost,
        condition: mapCondition(lead.condition),
        tenure: ((lead as any).tenureType ?? "Freehold") as "Freehold" | "Leasehold",
        chainStatus: ((lead as any).chainStatus ?? "NoChain") as "NoChain" | "ShortChain" | "LongChain",
        postcodeDemandScore: (lead as any).postcodeDemandScore ?? 5,
        strategy: ((lead as any).investmentStrategy ?? offerCalcConfig.defaultStrategy) as "Flip" | "BRR" | "BuyHold" | "BTL",
        monthlyRent: monthlyRent > 0 ? monthlyRent : undefined,
        config: toOfferConfig(offerCalcConfig),
      })

      calculatedOffer = offerResult.recommendedOffer
      offerPercentage = ((marketValue - calculatedOffer) / marketValue) * 100
      strategyExplanationBlock =
        `\n📊 STRATEGY-AWARE OFFER CALCULATION\n` +
        `${"─".repeat(60)}\n` +
        offerResult.explanation.map((l) => `  ${l}`).join("\n") +
        "\n\n"

      console.log(`[BMV Calculator] Strategy mode (${(lead as any).investmentStrategy ?? offerCalcConfig.defaultStrategy}): offer ${calculatedOffer.toLocaleString()}`)
    } else {
      // ── Legacy calculation (motivation-based) ──────────────────────────────
      let offerPct = 78 // Base 78%

      // Adjust based on motivation score
      if (lead.motivationScore) {
        if (lead.motivationScore >= 8) {
          offerPct = 72 // Lower offer for highly motivated
        } else if (lead.motivationScore >= 6) {
          offerPct = 75
        } else if (lead.motivationScore <= 4) {
          offerPct = 82 // Higher offer for less motivated
        }
      }

      // Adjust based on condition
      if (lead.condition === "poor" || lead.condition === "needs_modernisation") {
        offerPct -= 5 // Lower offer for poor condition
      } else if (lead.condition === "excellent") {
        offerPct += 3 // Higher offer for excellent condition
      } else if (lead.condition === "needs_work") {
        offerPct -= 3
      }

      // Adjust for urgency
      if (lead.urgencyLevel === "urgent") {
        offerPct -= 3 // Lower offer for urgent sellers
      } else if (lead.urgencyLevel === "flexible") {
        offerPct += 2 // Higher offer for flexible sellers
      }

      // Land Registry: lower offer if corporate/overseas/portfolio owner (more leverage)
      if (landRegistryOwnership) {
        if (landRegistryOwnership.isCorporateOwned) offerPct -= 2
        if (landRegistryOwnership.isOverseasOwned) offerPct -= 2
        if (landRegistryOwnership.isPortfolioOwner) offerPct -= 1
      }

      // Ensure offer percentage stays within reasonable bounds
      offerPct = Math.max(65, Math.min(85, offerPct))

      rawCalculatedOffer = Math.round(marketValue * (offerPct / 100))
      offerCappedAtAsking = rawCalculatedOffer >= askingPrice
      if (offerCappedAtAsking) {
        // Asking is already below our formula offer (great deal already priced).
        // As a cash buyer, still negotiate minDiscountFromAsking% below asking to maximise margin.
        const minDiscPct = Number(offerCalcConfig?.minDiscountFromAsking ?? 5)
        calculatedOffer = Math.round(askingPrice * (1 - minDiscPct / 100))
      } else {
        calculatedOffer = rawCalculatedOffer
      }
      // Always store the ACTUAL percentage of market value, not the formula percentage
      offerPercentage = (calculatedOffer / marketValue) * 100
    }

    const profitPotential = marketValue - calculatedOffer - refurbCost

    // Calculate rental yields
    const grossYield = askingPrice > 0 && annualRent > 0 ? (annualRent / askingPrice) * 100 : 0
    const netYield = grossYield * 0.85 // After 15% costs (management, maintenance, voids)
    const rentPerSqFt = squareFeet > 0 && monthlyRent > 0 ? monthlyRent / squareFeet : 0
    const rentVsLocalAvg = localAverageRent > 0 && monthlyRent > 0 ? ((monthlyRent - localAverageRent) / localAverageRent) * 100 : 0

    // Determine if deal passes validation
    const minBmv = offerCalcConfig?.minBmvPercentage
      ? Number(offerCalcConfig.minBmvPercentage)
      : 15
    const minProfit = offerCalcConfig?.minProfitPotential
      ? Number(offerCalcConfig.minProfitPotential)
      : 10000
    const hasGoodYield = grossYield >= 6
    const validationPassed = bmvScore >= minBmv && profitPotential >= minProfit

    // ── Strategy Analysis (always run regardless of mode) ─────────────────────
    let strategyAnalysisBlock = ""
    try {
      const {
        calculateOffer: calcStrat,
        mapCondition: mapCond,
        toOfferConfig: toConf,
        DEFAULT_OFFER_CONFIG: DEF_CFG,
      } = await import("@/lib/offer-calculator")

      const sConfig = offerCalcConfig ? toConf(offerCalcConfig) : DEF_CFG
      const sharedInput = {
        askingPrice,
        marketValue,
        refurbCost,
        condition: mapCond(lead.condition),
        tenure: ((lead as any).tenureType ?? "Freehold") as "Freehold" | "Leasehold",
        chainStatus: ((lead as any).chainStatus ?? "NoChain") as "NoChain" | "ShortChain" | "LongChain",
        postcodeDemandScore: (lead as any).postcodeDemandScore ?? 5,
        monthlyRent: monthlyRent > 0 ? monthlyRent : undefined,
        config: sConfig,
      }

      type StratKey = "BTL" | "BuyHold" | "Flip" | "BRR"
      const stratDefs: Array<{ key: StratKey; label: string; emoji: string }> = [
        { key: "BTL",     label: "Buy-to-Let (BTL)", emoji: "🏠" },
        { key: "BuyHold", label: "Buy & Hold",        emoji: "📈" },
        { key: "Flip",    label: "Flip",              emoji: "🔨" },
        { key: "BRR",     label: "BRRR",              emoji: "🔄" },
      ]

      const stratResults = stratDefs.map(({ key, label, emoji }) => ({
        key, label, emoji,
        ...calcStrat({ ...sharedInput, strategy: key }),
      }))

      // Pick recommended: viable strategies first, prefer yield-based when rent available,
      // then highest ceiling
      const viable = stratResults.filter(r => r.passesValidation)
      const ranked = [...viable].sort((a, b) => {
        if (monthlyRent > 0) {
          const aYield = a.key === "BTL" || a.key === "BuyHold"
          const bYield = b.key === "BTL" || b.key === "BuyHold"
          if (aYield && !bYield) return -1
          if (bYield && !aYield) return 1
        }
        return b.recommendedOffer - a.recommendedOffer
      })
      const recommended = ranked[0] ?? stratResults.reduce((best, curr) =>
        curr.recommendedOffer > best.recommendedOffer ? curr : best
      )

      strategyAnalysisBlock  = `\n🏆 INVESTMENT STRATEGY ANALYSIS\n`
      strategyAnalysisBlock += `${"─".repeat(60)}\n`
      strategyAnalysisBlock += `  📌 Recommended: ${recommended.label}\n\n`
      for (const r of stratResults) {
        const rec = r.key === recommended.key ? " ← recommended" : ""
        const yieldStr = r.achievedGrossYield > 0 ? ` | Yield: ${r.achievedGrossYield.toFixed(1)}%` : ""
        const status = r.passesValidation ? "✅ Viable" : "❌ Not viable"
        strategyAnalysisBlock += `  ${r.emoji} ${r.label}${rec}\n`
        strategyAnalysisBlock += `     Max Offer: £${r.recommendedOffer.toLocaleString()}${yieldStr} | ${status}\n`
      }
      // Machine-readable block for UI parsing.
      // "maxViable" = the MOST each strategy would ever let you pay (the ceiling).
      //   BTL/BuyHold → yield ceiling (annualRent / minYield%)
      //   Flip        → MV × flipPct% − refurb
      //   BRR         → MV × brrLtv% − refurb
      // "recommendedOffer" (same for all) = what we suggest bidding based on the
      //   discount formula — shown once in the left panel, NOT repeated per strategy.
      const annualRent = monthlyRent * 12
      const flipPct   = sConfig.flipMarketValuePct
      const brrLtv    = sConfig.brrLtvPercent
      const btlMin    = sConfig.btlMinYield
      const bhMin     = sConfig.buyHoldMinYield

      const strategyJson = JSON.stringify({
        recommended: recommended.key,
        recommendedOffer: recommended.recommendedOffer,
        strategies: stratResults.map(r => {
          // Compute the raw strategy ceiling (always, whether binding or not)
          let maxViable: number | null = null
          let yieldAtOffer: number | null = null
          let flipProfit: number | null = null
          let flipMargin: number | null = null
          let brrProceeds: number | null = null
          let brrLeftIn: number | null = null

          if (r.key === "BTL") {
            maxViable = annualRent > 0 ? Math.round(annualRent / (btlMin / 100)) : null
            yieldAtOffer = r.achievedGrossYield > 0 ? Math.round(r.achievedGrossYield * 10) / 10 : null
          } else if (r.key === "BuyHold") {
            maxViable = annualRent > 0 ? Math.round(annualRent / (bhMin / 100)) : null
            yieldAtOffer = r.achievedGrossYield > 0 ? Math.round(r.achievedGrossYield * 10) / 10 : null
          } else if (r.key === "Flip") {
            maxViable = Math.round(marketValue * flipPct / 100 - refurbCost)
            // Profit at recommended offer: sell at MV, subtract offer + refurb + selling costs (~5% MV)
            flipProfit = Math.round(marketValue - r.recommendedOffer - refurbCost - marketValue * 0.05)
            flipMargin = r.recommendedOffer > 0 ? Math.round((flipProfit / r.recommendedOffer) * 1000) / 10 : null
          } else if (r.key === "BRR") {
            maxViable = Math.round(marketValue * brrLtv / 100 - refurbCost)
            brrProceeds = Math.round(marketValue * brrLtv / 100)
            brrLeftIn = Math.max(0, r.recommendedOffer + refurbCost - brrProceeds)
          }

          // A strategy is truly viable only if the recommended offer is AT or BELOW
          // the strategy's own ceiling (maxViable).  r.passesValidation only checks
          // general BMV/profit thresholds, not the per-strategy ceiling, so it can
          // incorrectly show "Viable" even when the offer exceeds the ceiling.
          const strategyViable = maxViable != null
            ? r.recommendedOffer <= maxViable
            : r.passesValidation

          // Yield shown in "At Rec. Offer" column: for income strategies, compute
          // yield at the actual offer (not at the ceiling), so the number is honest.
          if ((r.key === "BTL" || r.key === "BuyHold") && annualRent > 0 && r.recommendedOffer > 0) {
            yieldAtOffer = Math.round((annualRent / r.recommendedOffer) * 1000) / 10
          }

          // ── Pre-compute human-readable tooltip strings ─────────────────────
          const gb = (n: number) => `£${Math.round(n).toLocaleString("en-GB")}`
          const pct = (n: number) => `${n}%`

          const maxViableTooltip: string | null = (() => {
            if (r.key === "BTL") {
              if (annualRent <= 0) return "No rental data — cannot compute BTL ceiling"
              return `Annual Rent ÷ Min BTL Yield\n${gb(annualRent)} ÷ ${pct(btlMin)} = ${gb(maxViable!)}`
            }
            if (r.key === "BuyHold") {
              if (annualRent <= 0) return "No rental data — cannot compute Buy & Hold ceiling"
              return `Annual Rent ÷ Min B&H Yield\n${gb(annualRent)} ÷ ${pct(bhMin)} = ${gb(maxViable!)}`
            }
            if (r.key === "Flip") {
              return `Market Value × ${pct(flipPct)} − Refurb Cost\n${gb(marketValue)} × ${pct(flipPct)} − ${gb(refurbCost)} = ${gb(maxViable!)}`
            }
            if (r.key === "BRR") {
              return `Market Value × ${pct(brrLtv)} LTV − Refurb Cost\n${gb(marketValue)} × ${pct(brrLtv)} − ${gb(refurbCost)} = ${gb(maxViable!)}`
            }
            return null
          })()

          const atRecOfferTooltip: string | null = (() => {
            if ((r.key === "BTL" || r.key === "BuyHold") && annualRent > 0 && r.recommendedOffer > 0) {
              const label = r.key === "BTL" ? "Min BTL Yield" : "Min B&H Yield"
              return `Annual Rent ÷ Recommended Offer\n${gb(annualRent)} ÷ ${gb(r.recommendedOffer)} = ${yieldAtOffer?.toFixed(1)}%\n(Target ≥ ${pct(r.key === "BTL" ? btlMin : bhMin)} to be viable)`
            }
            if (r.key === "Flip" && flipProfit != null) {
              const sellingCosts = Math.round(marketValue * 0.05)
              return `Market Value − Rec. Offer − Refurb − Selling Costs (5% MV)\n${gb(marketValue)} − ${gb(r.recommendedOffer)} − ${gb(refurbCost)} − ${gb(sellingCosts)} = ${gb(flipProfit)}`
            }
            if (r.key === "BRR" && brrProceeds != null && brrLeftIn != null) {
              return `Cash left in after refinance:\nRec. Offer + Refurb − Refinance Proceeds\n${gb(r.recommendedOffer)} + ${gb(refurbCost)} − ${gb(brrProceeds)} = ${gb(brrLeftIn)} left in`
            }
            return null
          })()

          const viableTooltip: string = strategyViable
            ? `✓ Viable — Rec. offer (${gb(r.recommendedOffer)}) ≤ max ceiling (${gb(maxViable ?? 0)})`
            : `✗ Not viable — Rec. offer (${gb(r.recommendedOffer)}) exceeds ceiling (${maxViable != null ? gb(maxViable) : "n/a"})\nYou would need to pay more than this strategy allows`

          return {
            key: r.key,
            name: r.label,
            emoji: r.emoji,
            // The ceiling — max this strategy allows you to pay
            maxViable,
            // The discounted recommended bid (same for all strategies)
            recommendedOffer: r.recommendedOffer,
            // Income strategy metrics
            yieldAtOffer,
            // Flip metrics
            flipProfit,
            flipMargin,
            // BRR metrics
            brrProceeds,
            brrLeftIn,
            viable: strategyViable,
            // Human-readable tooltip explanations for each column
            tooltips: {
              maxViable: maxViableTooltip,
              atRecOffer: atRecOfferTooltip,
              viable: viableTooltip,
            },
          }
        }),
      })
      strategyAnalysisBlock += `[STRATEGY_DATA]${strategyJson}[/STRATEGY_DATA]\n`
    } catch (stratErr) {
      console.error("[BMV Calculator] Strategy analysis error:", stratErr)
    }

    // Build a postcode notice that appears at the top of notes when needed
    let postcodeWarning = ""
    if (isOutcodeOnly) {
      postcodeWarning =
        `⚠️ INCOMPLETE POSTCODE\n` +
        `${"─".repeat(60)}\n` +
        `  Postcode "${effectivePostcode ?? lead.propertyPostcode}" is outcode-only.\n` +
        `  PropertyData API requires a full postcode (e.g. SA5 1AB).\n` +
        `  Edit this lead and add the full postcode, then recalculate\n` +
        `  to get real comparable sales and rental data.\n\n`
    } else if (postcodeWasCorrected) {
      postcodeWarning =
        `ℹ️ POSTCODE AUTO-CORRECTED\n` +
        `${"─".repeat(60)}\n` +
        `  Stored postcode "${lead.propertyPostcode}" did not match the property area.\n` +
        `  Resolved to "${effectivePostcode}" via ${postcodeResolutionSource}.\n` +
        `  PropertyData analysis uses the corrected postcode.\n\n`
    }

    let validationNotes = ""
    if (validationPassed) {
      validationNotes = `✅ DEAL VALIDATED\n`
      validationNotes += `${"=".repeat(60)}\n\n`
      validationNotes += postcodeWarning
      validationNotes += strategyExplanationBlock

      // Market Value Analysis Section
      validationNotes += `📊 MARKET VALUE ANALYSIS\n`
      validationNotes += `${"─".repeat(60)}\n`
      if (marketValueSource === "comparable_sales" && comparables.length > 0) {
        validationNotes += `  ✓ PropertyData Comparable Sales: £${marketValue.toLocaleString()} (${comparables.length} properties)\n`
        validationNotes += `  ✓ Data Source: Real sold prices within 3 miles\n`
        validationNotes += `  ✓ Confidence: HIGH (Based on actual market data)\n`
      } else if (marketValueSource === "manual_entry") {
        validationNotes += `  • Manual Entry: £${marketValue.toLocaleString()}\n`
        validationNotes += `  • Data Source: User provided estimate\n`
        validationNotes += `  • Confidence: MEDIUM (Manual valuation)\n`
      } else {
        validationNotes += `  • Estimated Value: £${marketValue.toLocaleString()}\n`
        validationNotes += `  • Data Source: Algorithm estimation\n`
        validationNotes += `  • Confidence: LOW (Estimation only)\n`
      }
      validationNotes += `\n`

      // Comparable Properties Section
      if (comparables.length > 0) {
        validationNotes += `🏘️ COMPARABLE PROPERTIES (within 3 miles, last 12 months)\n`
        validationNotes += `${"─".repeat(60)}\n`
        comparables.forEach((comp, i) => {
          const saleDate = new Date(comp.saleDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          const distance = comp.distance ? ` | ${comp.distance.toFixed(1)} mi` : ''
          validationNotes += `  ${i + 1}. ${comp.address}\n`
          validationNotes += `     💷 £${comp.salePrice.toLocaleString()} | 🛏️ ${comp.bedrooms} bed | 📅 ${saleDate}${distance}\n`
        })
        validationNotes += `\n`
      } else if (effectivePostcode) {
        validationNotes += `⚠️ NO COMPARABLE PROPERTIES FOUND within 3 miles\n`
        validationNotes += `Market value is estimated - consider manual verification\n\n`
      }

      // Land Registry Ownership Section
      validationNotes += `🏛️ LAND REGISTRY OWNERSHIP\n`
      validationNotes += `${"─".repeat(60)}\n`
      if (landRegistryUsed && landRegistryOwnership) {
        validationNotes += `  ✓ Data Found: HM Land Registry CCOD/OCOD dataset\n`
        validationNotes += `  ✓ Owner: ${landRegistryOwnership.companyName}\n`
        if (landRegistryOwnership.proprietorCategory) {
          validationNotes += `  ✓ Proprietor Type: ${landRegistryOwnership.proprietorCategory}\n`
        }
        if (landRegistryOwnership.isCorporateOwned) {
          validationNotes += `  ✓ Corporate Owner — offer adjusted -2% (easier negotiation)\n`
        }
        if (landRegistryOwnership.isOverseasOwned) {
          validationNotes += `  ✓ Overseas Owner — offer adjusted -2% (potentially motivated)\n`
        }
        if (landRegistryOwnership.isPortfolioOwner) {
          validationNotes += `  ✓ Portfolio Owner (5+ properties) — offer adjusted -1% (bulk deal)\n`
        }
      } else if (effectivePostcode) {
        validationNotes += `  • No match in Land Registry dataset for this postcode\n`
        validationNotes += `  • (Land Registry data helps identify corporate/overseas owners)\n`
      } else {
        validationNotes += `  • Land Registry not checked — no postcode provided\n`
      }
      validationNotes += `\n`

      // BMV Analysis - HIGHLIGHTED
      validationNotes += `💰 BMV ANALYSIS\n`
      validationNotes += `${"─".repeat(60)}\n`
      validationNotes += `  🎯 BMV Percentage: ${bmvScore.toFixed(1)}%\n`
      validationNotes += `  📉 Asking Price: £${askingPrice.toLocaleString()}\n`
      validationNotes += `  📈 Market Value: £${marketValue.toLocaleString()}\n`
      validationNotes += `  💎 Discount: £${(marketValue - askingPrice).toLocaleString()}\n\n`

      validationNotes += `💵 OFFER DETAILS\n`
      validationNotes += `${"─".repeat(60)}\n`
      if (offerCappedAtAsking) {
        const minDiscPct = Number(offerCalcConfig?.minDiscountFromAsking ?? 5)
        validationNotes += `  💼 Offer: £${calculatedOffer.toLocaleString()} (negotiated ${minDiscPct}% below asking — ${offerPercentage.toFixed(1)}% of MV)\n`
        validationNotes += `  ℹ️  Formula max was £${rawCalculatedOffer.toLocaleString()} but vendor is already pricing below that.\n`
        validationNotes += `     Cash-buyer negotiation applied: asking £${askingPrice.toLocaleString()} × ${100 - minDiscPct}% = £${calculatedOffer.toLocaleString()}\n`
      } else {
        validationNotes += `  💼 Calculated Offer: £${calculatedOffer.toLocaleString()} (${offerPercentage.toFixed(1)}% of market value)\n`
      }
      if (refurbCost > 0) {
        validationNotes += `  🔨 Refurb Cost: £${refurbCost.toLocaleString()}\n`
      }
      validationNotes += `  ✨ Net Profit: £${profitPotential.toLocaleString()}\n\n`

      validationNotes += strategyAnalysisBlock

      // Rental Analysis Section
      if (annualRent > 0) {
        validationNotes += `🏠 RENTAL YIELD ANALYSIS ${hasGoodYield ? "✅" : ""}\n`
        validationNotes += `${"─".repeat(60)}\n`

        // Show data source and confidence
        if (rentalDataSource === "propertydata_api") {
          validationNotes += `  ✓ Data Source: PropertyData API (Real market data)\n`
          validationNotes += `  ✓ Confidence: HIGH (Based on actual rental listings)\n`
          if (rentConfidenceRange) {
            validationNotes += `  ✓ Market Range: £${rentConfidenceRange.min.toLocaleString()} - £${rentConfidenceRange.max.toLocaleString()}/month\n`
          }
        } else if (rentalDataSource === "manual_entry") {
          validationNotes += `  • Data Source: Manual entry\n`
          validationNotes += `  • Confidence: MEDIUM (User provided estimate)\n`
        }
        validationNotes += `\n`

        validationNotes += `  💷 Monthly Rent: £${monthlyRent.toLocaleString()}\n`
        if (weeklyRent > 0) {
          validationNotes += `  📅 Weekly Rent: £${weeklyRent.toLocaleString()}\n`
        }
        validationNotes += `  📅 Annual Rent: £${annualRent.toLocaleString()}\n`
        validationNotes += `  📊 Gross Yield: ${grossYield.toFixed(2)}%${hasGoodYield ? " (Strong)" : grossYield >= 4 ? " (Acceptable)" : " (Low)"}\n`
        validationNotes += `  📉 Net Yield: ${netYield.toFixed(2)}% (After 15% costs)\n`
        if (squareFeet > 0) {
          validationNotes += `  📐 Rent per Sq Ft: £${rentPerSqFt.toFixed(2)}/month\n`
        }
        if (localAverageRent > 0) {
          const comparison = rentVsLocalAvg > 0 ? `+${rentVsLocalAvg.toFixed(1)}% above` : `${rentVsLocalAvg.toFixed(1)}% below`
          validationNotes += `  🎯 vs Local Average: ${comparison} market\n`
        }
        const monthlyCashFlow = monthlyRent - (askingPrice * 0.004) // Rough estimate: 4% annual costs / 12
        validationNotes += `  💰 Est. Monthly Cash Flow: £${monthlyCashFlow.toLocaleString()}\n`

        if (hasGoodYield) {
          validationNotes += `  ⭐ Strong rental yield makes this an excellent buy-to-let opportunity!\n`
        }
        validationNotes += `\n`
      } else {
        validationNotes += `⚠️ RENTAL DATA NOT AVAILABLE\n`
        validationNotes += `${"─".repeat(60)}\n`
        validationNotes += `  PropertyData API did not return rental estimates for this postcode.\n`
        validationNotes += `  Add manual rental estimates to see yield analysis and cash flow projections.\n\n`
      }

      // PropertyData Credits Used
      if (creditsUsed > 0) {
        validationNotes += `📡 PropertyData API Credits Used: ${creditsUsed}\n\n`
      }

      // Rating - HIGHLIGHTED
      validationNotes += `${"=".repeat(60)}\n`
      if (bmvScore >= 25) {
        validationNotes += `⭐⭐⭐ EXCELLENT BMV OPPORTUNITY ⭐⭐⭐\n`
        validationNotes += `Significantly below market value - Strong investment potential!`
      } else if (bmvScore >= 20) {
        validationNotes += `⭐⭐ STRONG DEAL ⭐⭐\n`
        validationNotes += `Good profit margins with solid BMV percentage.`
      } else {
        validationNotes += `✓ ACCEPTABLE DEAL\n`
        validationNotes += `Meets minimum criteria for BMV investment.`
      }
    } else {
      validationNotes = `❌ DEAL FAILED VALIDATION\n`
      validationNotes += `${"=".repeat(60)}\n\n`
      validationNotes += postcodeWarning
      validationNotes += strategyExplanationBlock

      // Market Value Analysis Section
      validationNotes += `📊 MARKET VALUE ANALYSIS\n`
      validationNotes += `${"─".repeat(60)}\n`
      if (marketValueSource === "comparable_sales" && comparables.length > 0) {
        validationNotes += `  • PropertyData Comparable Sales: £${marketValue.toLocaleString()} (${comparables.length} properties)\n`
        validationNotes += `  • Data Source: Real sold prices within 3 miles\n`
        validationNotes += `  • Confidence: HIGH (Based on actual market data)\n`
      } else if (marketValueSource === "manual_entry") {
        validationNotes += `  • Manual Entry: £${marketValue.toLocaleString()}\n`
        validationNotes += `  • Data Source: User provided estimate\n`
        validationNotes += `  • Confidence: MEDIUM (Manual valuation)\n`
      } else {
        validationNotes += `  • Estimated Value: £${marketValue.toLocaleString()}\n`
        validationNotes += `  • Data Source: Algorithm estimation\n`
        validationNotes += `  • Confidence: LOW (Estimation only)\n`
      }
      validationNotes += `\n`

      // Comparable Properties Section
      if (comparables.length > 0) {
        validationNotes += `🏘️ COMPARABLE PROPERTIES (within 3 miles, last 12 months)\n`
        validationNotes += `${"─".repeat(60)}\n`
        comparables.forEach((comp, i) => {
          const saleDate = new Date(comp.saleDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
          const distance = comp.distance ? ` | ${comp.distance.toFixed(1)} mi` : ''
          validationNotes += `  ${i + 1}. ${comp.address}\n`
          validationNotes += `     💷 £${comp.salePrice.toLocaleString()} | 🛏️ ${comp.bedrooms} bed | 📅 ${saleDate}${distance}\n`
        })
        validationNotes += `\n`
      } else if (effectivePostcode) {
        validationNotes += `⚠️ NO COMPARABLE PROPERTIES FOUND within 3 miles\n`
        validationNotes += `Market value is estimated - accuracy may be limited\n\n`
      }

      // Land Registry Ownership Section (failed deal)
      validationNotes += `🏛️ LAND REGISTRY OWNERSHIP\n`
      validationNotes += `${"─".repeat(60)}\n`
      if (landRegistryUsed && landRegistryOwnership) {
        validationNotes += `  • Data Found: HM Land Registry CCOD/OCOD dataset\n`
        validationNotes += `  • Owner: ${landRegistryOwnership.companyName}\n`
        if (landRegistryOwnership.isCorporateOwned) validationNotes += `  • Corporate Owner — offer adjusted -2%\n`
        if (landRegistryOwnership.isOverseasOwned)  validationNotes += `  • Overseas Owner — offer adjusted -2%\n`
        if (landRegistryOwnership.isPortfolioOwner) validationNotes += `  • Portfolio Owner — offer adjusted -1%\n`
      } else if (effectivePostcode) {
        validationNotes += `  • No match in Land Registry dataset for this postcode\n`
      } else {
        validationNotes += `  • Land Registry not checked — no postcode provided\n`
      }
      validationNotes += `\n`

      const reasons = []

      validationNotes += `💰 BMV ANALYSIS: ${bmvScore >= 15 ? "✅ PASS" : "❌ FAIL (need 15%+)"}\n`
      validationNotes += `${"─".repeat(60)}\n`
      validationNotes += `  🎯 BMV Percentage: ${bmvScore.toFixed(1)}%\n`
      validationNotes += `  📉 Asking Price: £${askingPrice.toLocaleString()}\n`
      validationNotes += `  📈 Market Value: £${marketValue.toLocaleString()}\n`
      validationNotes += `  💎 Discount: £${(marketValue - askingPrice).toLocaleString()}\n\n`

      validationNotes += `💵 PROFIT ANALYSIS: ${profitPotential >= 10000 ? "✅ PASS" : "❌ FAIL (need £10,000+)"}\n`
      validationNotes += `${"─".repeat(60)}\n`
      validationNotes += `  💼 Calculated Offer: £${calculatedOffer.toLocaleString()} (${offerPercentage.toFixed(1)}% of market value)\n`
      if (refurbCost > 0) {
        validationNotes += `  🔨 Refurb Cost: £${refurbCost.toLocaleString()}\n`
      }
      validationNotes += `  ✨ Net Profit: £${profitPotential.toLocaleString()}\n\n`

      validationNotes += strategyAnalysisBlock

      // Rental Analysis Section (for failed deals)
      if (annualRent > 0) {
        validationNotes += `🏠 RENTAL YIELD ANALYSIS ${hasGoodYield ? "✅ PASS" : "⚠️"}\n`
        validationNotes += `${"─".repeat(60)}\n`

        // Show data source and confidence
        if (rentalDataSource === "propertydata_api") {
          validationNotes += `  ✓ Data Source: PropertyData API (Real market data)\n`
          validationNotes += `  ✓ Confidence: HIGH (Based on actual rental listings)\n`
          if (rentConfidenceRange) {
            validationNotes += `  ✓ Market Range: £${rentConfidenceRange.min.toLocaleString()} - £${rentConfidenceRange.max.toLocaleString()}/month\n`
          }
        } else if (rentalDataSource === "manual_entry") {
          validationNotes += `  • Data Source: Manual entry\n`
          validationNotes += `  • Confidence: MEDIUM (User provided estimate)\n`
        }
        validationNotes += `\n`

        validationNotes += `  💷 Monthly Rent: £${monthlyRent.toLocaleString()}\n`
        if (weeklyRent > 0) {
          validationNotes += `  📅 Weekly Rent: £${weeklyRent.toLocaleString()}\n`
        }
        validationNotes += `  📅 Annual Rent: £${annualRent.toLocaleString()}\n`
        validationNotes += `  📊 Gross Yield: ${grossYield.toFixed(2)}%${hasGoodYield ? " (Strong)" : grossYield >= 4 ? " (Acceptable)" : " (Low)"}\n`
        validationNotes += `  📉 Net Yield: ${netYield.toFixed(2)}% (After 15% costs)\n`
        if (squareFeet > 0) {
          validationNotes += `  📐 Rent per Sq Ft: £${rentPerSqFt.toFixed(2)}/month\n`
        }
        if (localAverageRent > 0) {
          const comparison = rentVsLocalAvg > 0 ? `+${rentVsLocalAvg.toFixed(1)}% above` : `${rentVsLocalAvg.toFixed(1)}% below`
          validationNotes += `  🎯 vs Local Average: ${comparison} market\n`
        }
        const monthlyCashFlow = monthlyRent - (askingPrice * 0.004) // Rough estimate: 4% annual costs / 12
        validationNotes += `  💰 Est. Monthly Cash Flow: £${monthlyCashFlow.toLocaleString()}\n`

        if (hasGoodYield && !validationPassed) {
          validationNotes += `  💡 Note: Strong rental yield - may still work as buy-to-let despite low BMV\n`
        }
        validationNotes += `\n`
      } else {
        validationNotes += `⚠️ RENTAL DATA NOT AVAILABLE\n`
        validationNotes += `${"─".repeat(60)}\n`
        validationNotes += `  PropertyData API did not return rental estimates for this postcode.\n`
        validationNotes += `  Add manual rental estimates to see if this could work as a buy-to-let opportunity.\n\n`
      }

      // PropertyData Credits Used
      if (creditsUsed > 0) {
        validationNotes += `📡 PropertyData API Credits Used: ${creditsUsed}\n\n`
      }

      if (bmvScore < 15) {
        reasons.push("BMV too low - asking price not discounted enough from market value")
      }
      if (profitPotential < 10000) {
        reasons.push("Insufficient profit margin after offer and refurb costs")
      }

      validationNotes += `🚫 REASONS FOR FAILURE\n`
      validationNotes += `${"─".repeat(60)}\n`
      reasons.forEach((reason, i) => {
        validationNotes += `  ${i + 1}. ${reason}\n`
      })
      validationNotes += `\n${"=".repeat(60)}\n`
      validationNotes += `⚠️ This deal does not meet minimum investment criteria.`
    }

    // Update the vendor lead with calculated values including rental data
    const updatedLead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        estimatedMarketValue: marketValue,
        bmvScore,
        offerPercentage,
        offerAmount: calculatedOffer,
        profitPotential,
        validationPassed,
        validationNotes,
        validatedAt: new Date(),
        updatedAt: new Date(),
        // Update rental data if fetched from API
        ...(rentalDataSource === "propertydata_api" && {
          estimatedMonthlyRent: monthlyRent,
          estimatedAnnualRent: annualRent,
          localAverageRent: monthlyRent,   // area average from PropertyData
        }),
        // EPC data (if fetched and rating is valid A–G)
        ...(epcRating !== null && /^[A-Ga-g]$/.test(epcRating) && {
          epcRating: epcRating.toUpperCase(),
          epcScore,
          epcInspectionDate,
        }),
      },
    })

    // Create pipeline event for calculation
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: validationPassed ? "deal_validated" : "deal_rejected",
        toStage: validationPassed ? "VALUATION_COMPLETE" : null,
        details: {
          description: validationPassed
            ? `BMV calculated: ${bmvScore.toFixed(1)}% | Offer: ${new Intl.NumberFormat("en-GB", {
                style: "currency",
                currency: "GBP",
              }).format(calculatedOffer)} (${offerPercentage.toFixed(1)}%)`
            : `BMV calculation failed validation: ${validationNotes}`,
          bmvScore,
          estimatedMarketValue: marketValue,
          askingPrice,
          offerAmount: calculatedOffer,
          offerPercentage,
          profitPotential,
          refurbCost,
          validationPassed,
          trigger: "manual_calculation",
        },
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        bmvScore,
        estimatedMarketValue: marketValue,
        offerAmount: calculatedOffer,
        rawCalculatedOffer,
        offerCappedAtAsking,
        offerPercentage,
        profitPotential,
        validationPassed,
        validationNotes,
        marketValueSource,
        comparablesCount: comparables.length,
        creditsUsed,
        // Rental yield data
        grossYield,
        netYield,
        monthlyRent,
        weeklyRent,
        annualRent,
        rentPerSqFt,
        hasGoodYield,
        rentalDataSource,
        rentConfidenceRange,
        // Postcode quality
        isOutcodeOnly,
        postcodeUsed: effectivePostcode,
        postcodeWasCorrected,
        postcodeResolutionSource,
        // Land Registry ownership data
        landRegistryUsed,
        landRegistryOwnership: landRegistryOwnership
          ? {
              companyName: landRegistryOwnership.companyName,
              isCorporateOwned: landRegistryOwnership.isCorporateOwned,
              isOverseasOwned: landRegistryOwnership.isOverseasOwned,
              isPortfolioOwner: landRegistryOwnership.isPortfolioOwner,
              proprietorCategory: landRegistryOwnership.proprietorCategory,
            }
          : null,
      },
    })
  } catch (error) {
    console.error("Error calculating BMV:", error)
    return NextResponse.json(
      { error: "Failed to calculate BMV" },
      { status: 500 }
    )
  }
}
