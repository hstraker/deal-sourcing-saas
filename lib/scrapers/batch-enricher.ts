/**
 * lib/scrapers/batch-enricher.ts
 *
 * Post-scrape enrichment pipeline for property listings.
 *
 * Runs after each scraper job and enriches newly saved listings with:
 *   1. EPC rating (PropertyData /energy-efficiency) — fills gaps the scraper missed
 *   2. Sold comparable prices (PropertyData /sold-prices) → calculates true BMV%
 *   3. Rental estimate (PropertyData /rents) → gross yield
 *   4. Re-scores motivationScore if EPC was updated
 *
 * Credit strategy: groups listings by postcode so each API call services
 * ALL listings in that postcode, not just one. Minimises credit spend.
 *
 * Safety guards:
 *   - Skips listings enriched within the last 48 h
 *   - Skips listings without a full UK postcode
 *   - Requires PROPERTYDATA_API_KEY env var
 *   - Caps to MAX_POSTCODES_PER_RUN to protect the credit budget
 */

import { prisma } from "../db"
import {
  fetchEpcData,
  matchEpcRecord,
  fetchSoldPrices,
  filterComparables,
  calculateAverageComparablePrice,
  fetchRentalData,
  fetchCommercialRents,
  fetchCommercialValuationSale,
  fetchCommercialValuationRent,
  mapToCommercialType,
  type CommercialPropertyType,
} from "../propertydata"
import { computeMotivationScore } from "../motivation-scorer"

const LOG_PREFIX = "[Enricher]"

/** Hard cap: postcodes enriched per scraper run (residential).
 *  Each postcode costs ≤ 3 credits (EPC + sold prices + rents).
 *  At 2000 credits/month and 60 runs/month → ≈ 33 credits/run → 11 postcodes/run.
 *  We set 15 to give a comfortable margin but stay well under the monthly limit.
 */
const MAX_POSTCODES_PER_RUN = 15

/**
 * Hard cap on commercial per-listing valuation API calls per run.
 * /valuation-commercial-sale + /valuation-commercial-rent = 2 credits per listing.
 * Capping at 10 listings = max 20 credits/run on commercial valuations.
 * Area rents (/rents-commercial) are shared per (postcode, type) and not counted here.
 */
const MAX_COMMERCIAL_VALUATION_CALLS = 10

/** Skip listings enriched more recently than this. */
const ENRICH_TTL_HOURS = 48

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich a batch of newly scraped listing IDs.
 * Groups by postcode, fetches external data once per postcode, then updates
 * each listing in the group.  Designed to run fire-and-forget after a scrape.
 */
export async function batchEnrichNewListings(listingIds: string[]): Promise<void> {
  if (!process.env.PROPERTYDATA_API_KEY) {
    console.log(`${LOG_PREFIX} PROPERTYDATA_API_KEY not set — skipping enrichment`)
    return
  }

  if (listingIds.length === 0) return

  console.log(`${LOG_PREFIX} Starting enrichment for ${listingIds.length} listing(s)`)

  // ── Load listing data ────────────────────────────────────────────────────────
  const listings = await prisma.propertyListing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      category: true,
      price: true,
      bedrooms: true,
      propertyType: true,
      squareFeet: true,
      squareMeters: true,
      epcRating: true,
      address: true,
      bmvIndicators: true,
      priceHistory: true,
      isChainFree: true,
      keyFeatures: true,
      daysOnMarket: true,
      listedDate: true,
      motivationScore: true,
      motivationSignals: true,
      propertyDataAnalysis: true,
    },
  })

  // ── Filter: full postcode only, not recently enriched ────────────────────────
  const eligible = listings.filter((l) => {
    const address = l.address as any
    const postcode = address?.postcode as string | undefined
    if (!postcode || !postcode.includes(" ")) return false // need full postcode

    const analysis = l.propertyDataAnalysis as any
    if (analysis?.enrichedAt) {
      const hoursSince = (Date.now() - new Date(analysis.enrichedAt).getTime()) / 3_600_000
      if (hoursSince < ENRICH_TTL_HOURS) return false
    }
    return true
  })

  if (eligible.length === 0) {
    console.log(`${LOG_PREFIX} No eligible listings (all already enriched or missing postcode)`)
    return
  }

  // ── Split into residential and commercial ──────────────────────────────────
  const residentialEligible = eligible.filter((l) => l.category !== "COMMERCIAL")
  const commercialEligible  = eligible.filter((l) => l.category === "COMMERCIAL")

  // ── Group by postcode (share API calls within the same postcode) ────────────
  const byPostcode = new Map<string, typeof residentialEligible>()
  for (const l of residentialEligible) {
    const postcode = ((l.address as any)?.postcode as string).toUpperCase()
    if (!byPostcode.has(postcode)) byPostcode.set(postcode, [])
    byPostcode.get(postcode)!.push(l)
  }

  const postcodesAll = [...byPostcode.keys()]
  // Prioritise postcodes with the most listings (maximise credit efficiency)
  postcodesAll.sort((a, b) => byPostcode.get(b)!.length - byPostcode.get(a)!.length)
  const postcodes = postcodesAll.slice(0, MAX_POSTCODES_PER_RUN)

  console.log(
    `${LOG_PREFIX} Residential: enriching ${postcodes.length} postcode(s) ` +
    `covering ${postcodes.reduce((n, pc) => n + byPostcode.get(pc)!.length, 0)} listing(s) ` +
    `(${postcodesAll.length - postcodes.length} postcode(s) deferred) | ` +
    `Commercial: ${commercialEligible.length} listing(s) queued`
  )

  let totalCredits = 0

  // ── Process residential postcodes ──────────────────────────────────────────
  for (const postcode of postcodes) {
    const group = byPostcode.get(postcode)!

    try {
      // 1. EPC lookup — 1 credit, shared across all listings in this postcode
      const epcRecords = await fetchEpcData(postcode)
      totalCredits += 1

      // 2. Sold prices — 1 credit, shared
      const soldResult = await fetchSoldPrices(postcode, undefined, 3, 150)
      if (soldResult) totalCredits += soldResult.creditsUsed

      // 3. Rental estimate — 1 credit, shared (use the group's median bedroom count)
      const medianBeds = medianBedrooms(group.map((l) => l.bedrooms))
      const rentalData = await fetchRentalData(postcode, medianBeds, undefined)
      if (rentalData) totalCredits += 1

      // 4. Apply to each listing in the group
      for (const listing of group) {
        await enrichOneListing(listing, epcRecords, soldResult, rentalData)
      }

      console.log(
        `${LOG_PREFIX} ${postcode} (resi): enriched ${group.length} listing(s) ` +
        `| EPC records: ${epcRecords?.length ?? 0} ` +
        `| Sold props: ${soldResult?.soldProperties.length ?? 0}`
      )

      await sleep(250)
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} ${postcode} (resi): enrichment failed — ${err.message}`)
    }
  }

  // ── Process commercial listings ─────────────────────────────────────────────
  if (commercialEligible.length > 0) {
    // Cache area rents per (postcode, commercialType) to share across listings
    const commercialRentsCache = new Map<string, Awaited<ReturnType<typeof fetchCommercialRents>>>()
    let valuationCallsUsed = 0

    for (const listing of commercialEligible) {
      try {
        await enrichOneCommercialListing(
          listing,
          commercialRentsCache,
          valuationCallsUsed,
          MAX_COMMERCIAL_VALUATION_CALLS,
        )
        // Count valuation calls for budget tracking (each commercial listing with sqft uses 2)
        const sqft = getSquareFeet(listing)
        if (sqft && valuationCallsUsed < MAX_COMMERCIAL_VALUATION_CALLS) {
          valuationCallsUsed += 1
          totalCredits += 2 // sale valuation + rent valuation
        }
        totalCredits += 1 // area rents (cached after first call)
        await sleep(200)
      } catch (err: any) {
        console.warn(`${LOG_PREFIX} Commercial listing ${listing.id}: enrichment failed — ${err.message}`)
      }
    }

    console.log(
      `${LOG_PREFIX} Commercial: enriched ${commercialEligible.length} listing(s)` +
      ` | ${valuationCallsUsed} valuation call pair(s) used`
    )
  }

  console.log(`${LOG_PREFIX} Enrichment complete. API credits used this run: ~${totalCredits}`)
}

// ─── Per-listing enrichment ───────────────────────────────────────────────────

/** Shared listing shape used by both enrichment paths. */
type EnrichableListing = {
  id: string
  category: string
  price: any
  bedrooms: number
  propertyType: string
  squareFeet: number | null
  squareMeters: number | null
  epcRating: string | null
  address: any
  bmvIndicators: any
  priceHistory: any
  isChainFree: boolean | null
  keyFeatures: any
  daysOnMarket: number
  listedDate: Date | null
  motivationScore: number | null
  motivationSignals: any
}

async function enrichOneListing(
  listing: EnrichableListing,
  epcRecords: Awaited<ReturnType<typeof fetchEpcData>>,
  soldResult: Awaited<ReturnType<typeof fetchSoldPrices>>,
  rentalData: Awaited<ReturnType<typeof fetchRentalData>>
): Promise<void> {
  const dbUpdates: Record<string, any> = {}
  const analysis: Record<string, any> = { enrichedAt: new Date().toISOString() }

  const postcode = ((listing.address as any)?.postcode as string | undefined)?.toUpperCase() ?? ""
  const askingPrice = Number(listing.price)

  // ── EPC ────────────────────────────────────────────────────────────────────
  let enrichedEpc = listing.epcRating
  if (!enrichedEpc && epcRecords && epcRecords.length > 0) {
    const address = listing.address as any
    const matched = matchEpcRecord(epcRecords, address?.displayAddress ?? null)
    if (matched) {
      enrichedEpc = matched.rating
      dbUpdates.epcRating = matched.rating
      analysis.epcRating = matched.rating
      analysis.epcScore = matched.score
      analysis.epcSource = "propertydata"
      analysis.epcInspectionDate = matched.inspectionDate.toISOString()
    }
  } else if (enrichedEpc) {
    analysis.epcRating = enrichedEpc
    analysis.epcSource = "scraped"
  }

  // ── Sold comparables → BMV% ───────────────────────────────────────────────
  if (soldResult && soldResult.soldProperties.length > 0) {
    // Progressive relaxation: strict match first, then broaden
    let comparables = filterComparables(
      soldResult.soldProperties, listing.bedrooms || undefined,
      listing.propertyType, 24, 10, postcode, 1
    )
    if (comparables.length < 3 && listing.bedrooms) {
      comparables = filterComparables(
        soldResult.soldProperties, listing.bedrooms,
        listing.propertyType, 36, 10, postcode, 2
      )
    }
    if (comparables.length < 2) {
      comparables = filterComparables(
        soldResult.soldProperties, undefined, undefined, 36, 10, postcode, 1
      )
    }

    const avgPrice = calculateAverageComparablePrice(comparables)
    if (avgPrice && avgPrice > 0) {
      const bmvPct = ((avgPrice - askingPrice) / avgPrice) * 100
      analysis.avgComparablePrice = avgPrice
      analysis.comparablesCount = comparables.length
      analysis.bmvPercent = Math.round(bmvPct * 10) / 10
      analysis.comparablesConfidence =
        comparables.length >= 5 ? "HIGH" : comparables.length >= 3 ? "MEDIUM" : "LOW"

      // Merge into bmvIndicators so the existing table/scorer can see it
      const existingBmv = (listing.bmvIndicators as any) ?? {}
      dbUpdates.bmvIndicators = {
        ...existingBmv,
        comparableAvgPrice: avgPrice,
        bmvPercent: analysis.bmvPercent,
        comparablesCount: comparables.length,
        comparablesConfidence: analysis.comparablesConfidence,
      }
    }
  }

  // ── Rental / yield ────────────────────────────────────────────────────────
  if (rentalData) {
    // Scale to this listing's bedroom count if it differs from the area fetch
    const bedsHere = listing.bedrooms || 3
    const bedsBase = medianBedrooms([listing.bedrooms]) // same as bedsHere for single item
    const ratio = BEDROOM_RENT_RATIO[Math.min(bedsHere, 6)] / BEDROOM_RENT_RATIO[Math.min(bedsBase, 6)]
    const monthlyRent = Math.round(rentalData.monthlyRent * ratio)
    const grossYield = askingPrice > 0 ? (monthlyRent * 12 / askingPrice) * 100 : null

    analysis.monthlyRentEstimate = monthlyRent
    if (grossYield !== null) analysis.grossYieldEstimate = Math.round(grossYield * 10) / 10
  }

  // ── Recalculate motivation score with all enrichment data ─────────────────
  // Always recalculate after enrichment so PropertyData BMV% and yield are
  // reflected in the score.  This is especially important for commercial
  // properties where keyword signals are typically absent.
  {
    const { motivationScore, motivationSignals } = computeMotivationScore({
      price:         askingPrice,
      priceHistory:  (listing.priceHistory as any[]) ?? [],
      bmvIndicators: (listing.bmvIndicators as any) ?? {},
      epcRating:     enrichedEpc,
      isChainFree:   listing.isChainFree,
      keyFeatures:   (listing.keyFeatures as string[]) ?? [],
      daysOnMarket:  listing.daysOnMarket,
      listedDate:    listing.listedDate?.toISOString() ?? null,
      pdBmvPercent:  (analysis.bmvPercent as number | undefined) ?? null,
      pdGrossYield:  (analysis.grossYieldEstimate as number | undefined) ?? null,
    })
    dbUpdates.motivationScore = motivationScore
    dbUpdates.motivationSignals = motivationSignals
    if (motivationScore !== listing.motivationScore) {
      analysis.motivationScoreUpdated = true
      analysis.prevMotivationScore = listing.motivationScore ?? 0
    }
  }

  // ── Write to DB ───────────────────────────────────────────────────────────
  await prisma.propertyListing.update({
    where: { id: listing.id },
    data: {
      ...dbUpdates,
      propertyDataAnalysis: analysis,
    },
  })
}

// ─── Commercial enrichment ────────────────────────────────────────────────────

/**
 * Enrich a single commercial listing using the three PropertyData commercial endpoints:
 *   1. /rents-commercial — area quoting rents (shared cache per postcode+type)
 *   2. /valuation-commercial-sale — capital value estimate (per-listing, sqft required)
 *   3. /valuation-commercial-rent — rental value estimate  (per-listing, sqft required)
 *
 * Results stored in propertyDataAnalysis.commercial and also mirrored into
 * bmvIndicators.bmvPercent (commercial capital BMV) and motivationScore.
 */
async function enrichOneCommercialListing(
  listing: EnrichableListing,
  rentsCache: Map<string, Awaited<ReturnType<typeof fetchCommercialRents>>>,
  valuationCallsUsed: number,
  maxValuationCalls: number,
): Promise<void> {
  const postcode    = ((listing.address as any)?.postcode as string | undefined)?.toUpperCase() ?? ""
  const askingPrice = Number(listing.price)
  const sqft        = getSquareFeet(listing)

  const commercialType = mapToCommercialType(listing.propertyType)

  const dbUpdates: Record<string, any> = {}
  const analysis: Record<string, any>  = {
    enrichedAt: new Date().toISOString(),
    isCommercial: true,
  }
  const commercial: Record<string, any> = {
    propertyType: commercialType ?? listing.propertyType,
    internalArea: sqft ?? null,
    areaUnit: "sqft",
  }

  let credits = 0

  // ── 1. Area quoting rents (/rents-commercial) ──────────────────────────────
  // Shared cache so we only call the API once per (postcode, type) pair.
  if (commercialType) {
    const cacheKey = `${postcode}::${commercialType}`
    if (!rentsCache.has(cacheKey)) {
      const result = await fetchCommercialRents(postcode, commercialType)
      rentsCache.set(cacheKey, result)
      if (result) credits += result.creditsUsed
    }
    const areaRents = rentsCache.get(cacheKey) ?? null

    if (areaRents) {
      commercial.areaRents = {
        pointsAnalysed: areaRents.pointsAnalysed,
        unitType: areaRents.unitType,
        avgRentPerSqft: areaRents.avgRentPerSqft,
        avgSize: areaRents.avgSize,
        avgAnnualRent: areaRents.avgAnnualRent,
      }

      // Estimate this property's rent from area $/sqft × its floor area
      if (sqft && areaRents.avgRentPerSqft > 0) {
        const estimatedAnnualRent  = Math.round(sqft * areaRents.avgRentPerSqft)
        const estimatedMonthlyRent = Math.round(estimatedAnnualRent / 12)
        commercial.rentEstimateAnnual  = estimatedAnnualRent
        commercial.rentEstimateMonthly = estimatedMonthlyRent
        analysis.monthlyRentEstimate   = estimatedMonthlyRent

        if (askingPrice > 0) {
          const grossYield = (estimatedAnnualRent / askingPrice) * 100
          commercial.grossYieldFromAreaRents = Math.round(grossYield * 10) / 10
          analysis.grossYieldEstimate        = commercial.grossYieldFromAreaRents
        }
      }
    }
  }

  // ── 2. Capital valuation + rental valuation (per-listing, sqft required) ──
  if (sqft && commercialType && valuationCallsUsed < maxValuationCalls) {
    // 2a. Capital value estimate → commercial BMV%
    const saleVal = await fetchCommercialValuationSale(postcode, commercialType, sqft)
    if (saleVal && saleVal.estimate > 0) {
      credits += saleVal.creditsUsed
      commercial.capitalValuation = {
        estimate: saleVal.estimate,
        margin:   saleVal.margin,
        minValue: saleVal.minValue,
        maxValue: saleVal.maxValue,
      }
      if (askingPrice > 0) {
        const bmv = ((saleVal.estimate - askingPrice) / saleVal.estimate) * 100
        commercial.bmvPercent = Math.round(bmv * 10) / 10
        // Mirror into top-level analysis + bmvIndicators for the BMV Signal Score
        analysis.bmvPercent           = commercial.bmvPercent
        analysis.avgComparablePrice   = saleVal.estimate
        analysis.comparablesCount     = null   // not applicable for valuation-based BMV
        analysis.comparablesConfidence = commercial.capitalValuation.margin > 0
          ? (commercial.capitalValuation.margin / saleVal.estimate < 0.15 ? "HIGH" : "MEDIUM")
          : null

        const existingBmv = (listing.bmvIndicators as any) ?? {}
        dbUpdates.bmvIndicators = {
          ...existingBmv,
          comparableAvgPrice:     saleVal.estimate,
          bmvPercent:             commercial.bmvPercent,
          comparablesCount:       null,
          comparablesConfidence:  analysis.comparablesConfidence,
        }
      }
    }

    // 2b. Rental value estimate → overrides area-rents estimate if available
    const rentVal = await fetchCommercialValuationRent(postcode, commercialType, sqft)
    if (rentVal && rentVal.estimate > 0) {
      credits += rentVal.creditsUsed
      commercial.rentValuation = {
        estimateAnnual: rentVal.estimate,
        margin:         rentVal.margin,
        minAnnual:      rentVal.minValue,
        maxAnnual:      rentVal.maxValue,
      }
      // Valuation-based rent is more accurate than area-average × sqft
      const monthlyFromVal = Math.round(rentVal.estimate / 12)
      commercial.rentEstimateAnnual  = rentVal.estimate
      commercial.rentEstimateMonthly = monthlyFromVal
      analysis.monthlyRentEstimate   = monthlyFromVal

      if (askingPrice > 0) {
        const grossYield = (rentVal.estimate / askingPrice) * 100
        commercial.grossYieldFromValuation = Math.round(grossYield * 10) / 10
        analysis.grossYieldEstimate        = commercial.grossYieldFromValuation
      }
    }
  } else if (sqft && commercialType && valuationCallsUsed >= maxValuationCalls) {
    commercial.valuationDeferred = true
    console.log(`${LOG_PREFIX} Commercial valuation deferred for ${listing.id} — cap reached`)
  }

  analysis.commercial = commercial

  // ── Recalculate motivation score with commercial enrichment data ────────────
  const { motivationScore, motivationSignals } = computeMotivationScore({
    price:         askingPrice,
    priceHistory:  (listing.priceHistory as any[]) ?? [],
    bmvIndicators: (listing.bmvIndicators as any) ?? {},
    epcRating:     listing.epcRating,
    isChainFree:   listing.isChainFree,
    keyFeatures:   (listing.keyFeatures as string[]) ?? [],
    daysOnMarket:  listing.daysOnMarket,
    listedDate:    listing.listedDate?.toISOString() ?? null,
    pdBmvPercent:  (analysis.bmvPercent as number | undefined) ?? null,
    pdGrossYield:  (analysis.grossYieldEstimate as number | undefined) ?? null,
  })
  dbUpdates.motivationScore = motivationScore
  dbUpdates.motivationSignals = motivationSignals

  console.log(
    `${LOG_PREFIX} Commercial ${listing.id} (${commercialType ?? "unknown type"}):` +
    ` BMV=${commercial.bmvPercent?.toFixed(1) ?? "—"}%` +
    ` yield=${analysis.grossYieldEstimate?.toFixed(1) ?? "—"}%` +
    ` rent=£${analysis.monthlyRentEstimate ?? "—"}/mo` +
    ` credits=~${credits}`
  )

  await prisma.propertyListing.update({
    where: { id: listing.id },
    data: { ...dbUpdates, propertyDataAnalysis: analysis },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Bedroom count → monthly rent multiplier, relative to a 3-bed baseline. */
const BEDROOM_RENT_RATIO: Record<number, number> = {
  0: 0.52, 1: 0.70, 2: 0.86, 3: 1.00, 4: 1.18, 5: 1.35, 6: 1.50,
}

function medianBedrooms(beds: number[]): number {
  if (beds.length === 0) return 3
  const sorted = [...beds].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 3
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Return the listing's floor area in sq ft.
 * Prefers `squareFeet`; converts `squareMeters` if sqft is absent.
 */
function getSquareFeet(listing: Pick<EnrichableListing, "squareFeet" | "squareMeters">): number | null {
  if (listing.squareFeet && listing.squareFeet > 0) return listing.squareFeet
  if (listing.squareMeters && listing.squareMeters > 0) return Math.round(listing.squareMeters * 10.764)
  return null
}
