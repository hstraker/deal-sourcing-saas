/**
 * Deal Enrichment Service
 *
 * Enriches deal data with PropertyData API data (market value, rental data, comparables).
 * Used when approving scraped listings to ensure deals get the same analysis
 * as vendor pipeline deals.
 */

import {
  fetchPropertyValuation,
  fetchRentalData,
  fetchSoldPrices,
  filterComparables,
  calculateAverageComparablePrice,
} from "@/lib/propertydata"

const LOG_PREFIX = "[Deal Enrichment]"

export interface EnrichmentInput {
  askingPrice: number
  postcode: string | null
  bedrooms?: number | null
  bathrooms?: number | null
  squareFeet?: number | null
  propertyType?: string | null
  /**
   * Verified rent from a confirmed sitting tenant or pre-agreed tenancy.
   * When provided this bypasses the PropertyData /rents API call entirely —
   * a confirmed rent is always more accurate than an area-wide average.
   */
  verifiedRent?: number | null
}

export interface EnrichmentResult {
  marketValue: number | null
  marketValueSource: "comparable_sales" | "valuation_api" | "estimated" | "none"
  estimatedMonthlyRent: number | null
  rentSource: "verified" | "comparable_avg" | "api_area_avg" | "none"
  estimatedRefurbCost: number
  afterRefurbValue: number | null
  comparablesCount: number
  avgComparablePrice: number | null
  grossYield: number | null
  creditsUsed: number
}

/**
 * Enrich a deal with market data from PropertyData API.
 * Mirrors the vendor pipeline's analysis flow:
 * 1. Fetch comparable sold properties
 * 2. Fetch rental data
 * 3. Optionally fetch valuation
 * 4. Estimate refurb cost
 * 5. Calculate after-refurb value
 */
export async function enrichDealData(
  input: EnrichmentInput
): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    marketValue: null,
    marketValueSource: "none",
    estimatedMonthlyRent: null,
    rentSource: "none",
    estimatedRefurbCost: estimateRefurbCost(input.propertyType, input.bedrooms),
    afterRefurbValue: null,
    comparablesCount: 0,
    avgComparablePrice: null,
    grossYield: null,
    creditsUsed: 0,
  }

  // ── Priority 1: Verified rent ──────────────────────────────────────────────
  // A confirmed sitting-tenant or pre-agreed rent is always more accurate than
  // any API estimate. Use it immediately and skip the /rents API call entirely.
  if (input.verifiedRent && input.verifiedRent > 0) {
    result.estimatedMonthlyRent = input.verifiedRent
    result.rentSource = "verified"
    if (input.askingPrice > 0) {
      result.grossYield = ((input.verifiedRent * 12) / input.askingPrice) * 100
    }
    console.log(`${LOG_PREFIX} Using verified rent: £${input.verifiedRent}/mo (skipping API rent call)`)
  }

  if (!input.postcode) {
    console.log(`${LOG_PREFIX} No postcode available, using estimation only`)
    result.afterRefurbValue = Math.round(input.askingPrice * 1.1)
    return result
  }

  try {
    // Step 1: Fetch comparable sold properties (most reliable market value source)
    console.log(`${LOG_PREFIX} Fetching comparables for ${input.postcode}...`)
    const soldPricesResult = await fetchSoldPrices(
      input.postcode,
      undefined, // no bedroom filter at API level — filter ourselves for ±1 tolerance
      3, // 3 miles radius
      200
    )

    if (soldPricesResult && soldPricesResult.soldProperties.length > 0) {
      result.creditsUsed += soldPricesResult.creditsUsed

      const comparables = filterComparables(
        soldPricesResult.soldProperties,
        input.bedrooms || undefined,
        input.propertyType || undefined,
        24, // last 24 months
        10, // top 10
        input.postcode || undefined,
        1 // ±1 bedroom tolerance
      )

      result.comparablesCount = comparables.length

      if (comparables.length > 0) {
        result.avgComparablePrice = calculateAverageComparablePrice(comparables)
        if (result.avgComparablePrice) {
          result.marketValue = result.avgComparablePrice
          result.marketValueSource = "comparable_sales"
          console.log(
            `${LOG_PREFIX} Market value from ${comparables.length} comparables: £${result.marketValue}`
          )
        }
      }
    }

    // Step 2: If no comparables, try valuation API
    if (!result.marketValue) {
      const sqft = input.squareFeet || (input.bedrooms ? input.bedrooms * 538 : 800)
      if (sqft >= 300) {
        const valuationType = input.propertyType?.toLowerCase().includes("flat")
          ? "flat"
          : input.propertyType?.toLowerCase().includes("bungalow")
            ? "bungalow"
            : "house"

        const valuationResult = await fetchPropertyValuation(
          input.postcode,
          valuationType,
          sqft,
          input.bedrooms || 3,
          input.bathrooms || 1
        )

        if (valuationResult?.estimate) {
          result.marketValue = valuationResult.estimate
          result.marketValueSource = "valuation_api"
          result.creditsUsed += 1
          console.log(
            `${LOG_PREFIX} Market value from valuation API: £${result.marketValue}`
          )
        }
      }
    }

    // Step 3: Resolve rent (only if not already set by verifiedRent above)
    if (!result.estimatedMonthlyRent) {
      // ── Priority 2: Average rent derived from comparable sale properties ────
      // Comparable sale prices already filtered to matching bedroom count and
      // property type. A yield-based rent from these is far more accurate than
      // the PropertyData /rents area-wide average (which blends all sizes).
      if (result.comparablesCount > 0 && result.avgComparablePrice) {
        const bedroomYield = typicalYieldForBedrooms(input.bedrooms)
        const compBasedRent = Math.round((result.avgComparablePrice * bedroomYield) / 12)
        result.estimatedMonthlyRent = compBasedRent
        result.rentSource = "comparable_avg"
        if (input.askingPrice > 0) {
          result.grossYield = ((compBasedRent * 12) / input.askingPrice) * 100
        }
        console.log(
          `${LOG_PREFIX} Rent from comparable avg (£${result.avgComparablePrice} × ${(bedroomYield * 100).toFixed(1)}% yield): £${compBasedRent}/mo`
        )
      }

      // ── Priority 3: PropertyData /rents area average (last resort) ───────────
      // This is an area-wide weekly average across ALL property sizes and is
      // frequently too low for specific bedroom counts. Only use it if we have
      // nothing better, and note the source for display in the UI.
      if (!result.estimatedMonthlyRent) {
        console.log(`${LOG_PREFIX} Fetching PropertyData area rent for ${input.postcode}...`)
        const rentalResult = await fetchRentalData(
          input.postcode,
          input.bedrooms || undefined,
          input.propertyType || undefined
        )

        if (rentalResult?.monthlyRent) {
          result.estimatedMonthlyRent = rentalResult.monthlyRent
          result.rentSource = "api_area_avg"
          result.creditsUsed += 1
          console.log(
            `${LOG_PREFIX} Rent from PropertyData area avg: £${result.estimatedMonthlyRent}/mo ` +
            `(⚠️ area-wide average — may understate for this bedroom count)`
          )
          if (input.askingPrice > 0) {
            result.grossYield =
              ((rentalResult.monthlyRent * 12) / input.askingPrice) * 100
          }
        }
      }
    }
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Enrichment failed:`, error.message)
  }

  // Step 4: Fallback market value estimation if nothing from API
  if (!result.marketValue) {
    result.marketValue = Math.round(input.askingPrice * 1.15)
    result.marketValueSource = "estimated"
    console.log(
      `${LOG_PREFIX} Using estimated market value: £${result.marketValue}`
    )
  }

  // Step 5: Calculate after-refurb value
  result.afterRefurbValue = Math.round(result.marketValue * 1.05)

  console.log(`${LOG_PREFIX} Enrichment complete:`, {
    marketValue: result.marketValue,
    source: result.marketValueSource,
    rent: result.estimatedMonthlyRent,
    rentSource: result.rentSource,
    refurb: result.estimatedRefurbCost,
    arv: result.afterRefurbValue,
    comparables: result.comparablesCount,
    credits: result.creditsUsed,
  })

  return result
}

/**
 * Typical gross rental yield by bedroom count for South Wales BTL properties.
 * Used to derive a rent estimate from comparable sale prices when the
 * PropertyData /rents area average is unavailable or unreliable.
 *
 * Sources: PropertyData market data, Rightmove rental index (SA/CF/NP areas).
 */
function typicalYieldForBedrooms(bedrooms?: number | null): number {
  switch (bedrooms) {
    case 1:  return 0.075  // 7.5% — studios/1-beds command higher yield
    case 2:  return 0.070  // 7.0% — most liquid BTL stock in South Wales
    case 3:  return 0.068  // 6.8%
    case 4:  return 0.065  // 6.5% — larger stock, slightly lower yield
    default: return 0.070  // default to 2-bed equivalent
  }
}

/**
 * Estimate refurbishment cost based on property type and bedrooms.
 * Matches vendor pipeline's DealValidator.estimateRefurbCost() logic.
 */
function estimateRefurbCost(
  propertyType?: string | null,
  bedrooms?: number | null
): number {
  const baseCost = 20000 // Default unknown condition

  let multiplier = 1.0
  if (bedrooms) {
    if (bedrooms <= 1) multiplier = 0.7
    else if (bedrooms >= 4) multiplier = 1.3
    else if (bedrooms >= 3) multiplier = 1.15
  }

  if (propertyType) {
    const type = propertyType.toLowerCase()
    if (type === "flat" || type === "apartment") multiplier *= 0.9
    else if (type.includes("detached")) multiplier *= 1.1
  }

  return Math.round(baseCost * multiplier)
}
