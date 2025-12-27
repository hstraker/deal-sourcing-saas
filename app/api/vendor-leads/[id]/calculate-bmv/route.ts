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
  SoldProperty,
} from "@/lib/propertydata"

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

    // Rental data for yield calculations - will be fetched from API or use existing data
    let monthlyRent = lead.estimatedMonthlyRent?.toNumber() || 0
    let annualRent = lead.estimatedAnnualRent?.toNumber() || monthlyRent * 12
    let weeklyRent = monthlyRent > 0 ? Math.round(monthlyRent / 4.333) : 0
    let rentConfidenceRange: { min: number; max: number } | null = null
    let rentalDataSource = monthlyRent > 0 ? "manual_entry" : "none"
    const squareFeet = lead.squareFeet || 0
    const localAverageRent = lead.localAverageRent?.toNumber() || 0

    // Try to get real market data from PropertyData API
    let apiMarketValue: number | null = null
    let comparableAverage: number | null = null
    let valuationEstimate: number | null = null

    if (lead.propertyPostcode) {
      console.log(`[BMV Calculator] Property has postcode: ${lead.propertyPostcode}`)

      try {
        // First, check if we have stored comparables (saves API credits)
        const storedComparables = await prisma.comparableProperty.findMany({
          where: { vendorLeadId: params.id },
          orderBy: [
            { distance: "asc" },
            { saleDate: "desc" },
          ],
          take: 5, // Top 5 comparables
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
            lead.propertyPostcode,
            lead.bedrooms || undefined,
            3, // 3 miles radius
            50 // max 50 results
          )

          if (soldPricesResult) {
            creditsUsed += soldPricesResult.creditsUsed
            console.log(`[BMV Calculator] Found ${soldPricesResult.soldProperties.length} sold properties`)

            // Filter to get best comparables
            comparables = filterComparables(
              soldPricesResult.soldProperties,
              lead.bedrooms || undefined,
              lead.propertyType || undefined,
              12, // last 12 months
              5 // top 5 comparables
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

        // Fetch rental data from PropertyData API if we don't already have it
        if (monthlyRent === 0 || rentalDataSource === "none") {
          console.log(`[BMV Calculator] Fetching rental data from PropertyData...`)
          try {
            const rentalResult = await fetchRentalData(
              lead.propertyPostcode,
              lead.bedrooms || undefined,
              lead.propertyType || undefined
            )

            if (rentalResult) {
              monthlyRent = rentalResult.monthlyRent
              weeklyRent = rentalResult.weeklyRent
              annualRent = monthlyRent * 12
              rentConfidenceRange = rentalResult.confidenceRange
              rentalDataSource = "propertydata_api"
              creditsUsed += 1 // Rental API uses 1 credit

              console.log(`[BMV Calculator] Rental data from API: £${monthlyRent}/month (weekly: £${weeklyRent}, range: £${rentConfidenceRange.min}-£${rentConfidenceRange.max})`)
            } else {
              console.log(`[BMV Calculator] No rental data available from API`)
            }
          } catch (error) {
            console.error("[BMV Calculator] Error fetching rental data:", error)
            // Continue without rental data
          }
        } else {
          console.log(`[BMV Calculator] Using existing rental data: £${monthlyRent}/month (source: ${rentalDataSource})`)
        }

      } catch (error) {
        console.error("[BMV Calculator] Error fetching comparables:", error)
        // Continue with fallback logic
      }
    } else {
      console.log("[BMV Calculator] No postcode available, using fallback estimation")
    }

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

    // Calculate offer amount (typically 70-85% of market value)
    let offerPercentage = 78 // Base 78%

    // Adjust based on motivation score
    if (lead.motivationScore) {
      if (lead.motivationScore >= 8) {
        offerPercentage = 72 // Lower offer for highly motivated
      } else if (lead.motivationScore >= 6) {
        offerPercentage = 75
      } else if (lead.motivationScore <= 4) {
        offerPercentage = 82 // Higher offer for less motivated
      }
    }

    // Adjust based on condition
    if (lead.condition === "poor" || lead.condition === "needs_modernisation") {
      offerPercentage -= 5 // Lower offer for poor condition
    } else if (lead.condition === "excellent") {
      offerPercentage += 3 // Higher offer for excellent condition
    } else if (lead.condition === "needs_work") {
      offerPercentage -= 3
    }

    // Adjust for urgency
    if (lead.urgencyLevel === "urgent") {
      offerPercentage -= 3 // Lower offer for urgent sellers
    } else if (lead.urgencyLevel === "flexible") {
      offerPercentage += 2 // Higher offer for flexible sellers
    }

    // Ensure offer percentage stays within reasonable bounds
    offerPercentage = Math.max(65, Math.min(85, offerPercentage))

    const calculatedOffer = marketValue * (offerPercentage / 100)
    const refurbCost = lead.estimatedRefurbCost?.toNumber() || 0
    const profitPotential = marketValue - calculatedOffer - refurbCost

    // Calculate rental yields
    const grossYield = askingPrice > 0 && annualRent > 0 ? (annualRent / askingPrice) * 100 : 0
    const netYield = grossYield * 0.85 // After 15% costs (management, maintenance, voids)
    const rentPerSqFt = squareFeet > 0 && monthlyRent > 0 ? monthlyRent / squareFeet : 0
    const rentVsLocalAvg = localAverageRent > 0 && monthlyRent > 0 ? ((monthlyRent - localAverageRent) / localAverageRent) * 100 : 0

    // Determine if deal passes validation
    // Base criteria: BMV >= 15% AND profit >= £10k
    // Bonus points for strong rental yield (>= 6% gross yield considered good)
    const hasGoodYield = grossYield >= 6
    const validationPassed = bmvScore >= 15 && profitPotential >= 10000

    let validationNotes = ""
    if (validationPassed) {
      validationNotes = `✅ DEAL VALIDATED\n`
      validationNotes += `${"=".repeat(60)}\n\n`

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
      } else if (lead.propertyPostcode) {
        validationNotes += `⚠️ NO COMPARABLE PROPERTIES FOUND within 3 miles\n`
        validationNotes += `Market value is estimated - consider manual verification\n\n`
      }

      // BMV Analysis - HIGHLIGHTED
      validationNotes += `💰 BMV ANALYSIS\n`
      validationNotes += `${"─".repeat(60)}\n`
      validationNotes += `  🎯 BMV Percentage: ${bmvScore.toFixed(1)}%\n`
      validationNotes += `  📉 Asking Price: £${askingPrice.toLocaleString()}\n`
      validationNotes += `  📈 Market Value: £${marketValue.toLocaleString()}\n`
      validationNotes += `  💎 Discount: £${(marketValue - askingPrice).toLocaleString()}\n\n`

      validationNotes += `💵 OFFER DETAILS\n`
      validationNotes += `${"─".repeat(60)}\n`
      validationNotes += `  💼 Calculated Offer: £${calculatedOffer.toLocaleString()} (${offerPercentage.toFixed(1)}% of market value)\n`
      if (refurbCost > 0) {
        validationNotes += `  🔨 Refurb Cost: £${refurbCost.toLocaleString()}\n`
      }
      validationNotes += `  ✨ Net Profit: £${profitPotential.toLocaleString()}\n\n`

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
      } else if (lead.propertyPostcode) {
        validationNotes += `⚠️ NO COMPARABLE PROPERTIES FOUND within 3 miles\n`
        validationNotes += `Market value is estimated - accuracy may be limited\n\n`
      }

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
