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
}

export interface EnrichmentResult {
  marketValue: number | null
  marketValueSource: "comparable_sales" | "valuation_api" | "estimated" | "none"
  estimatedMonthlyRent: number | null
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
    estimatedRefurbCost: estimateRefurbCost(input.propertyType, input.bedrooms),
    afterRefurbValue: null,
    comparablesCount: 0,
    avgComparablePrice: null,
    grossYield: null,
    creditsUsed: 0,
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
      input.bedrooms || undefined,
      3, // 3 miles radius
      50
    )

    if (soldPricesResult && soldPricesResult.soldProperties.length > 0) {
      result.creditsUsed += soldPricesResult.creditsUsed

      const comparables = filterComparables(
        soldPricesResult.soldProperties,
        input.bedrooms || undefined,
        input.propertyType || undefined,
        12, // last 12 months
        5, // top 5
        input.postcode || undefined
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

    // Step 3: Fetch rental data
    console.log(`${LOG_PREFIX} Fetching rental data for ${input.postcode}...`)
    const rentalResult = await fetchRentalData(
      input.postcode,
      input.bedrooms || undefined,
      input.propertyType || undefined
    )

    if (rentalResult?.monthlyRent) {
      result.estimatedMonthlyRent = rentalResult.monthlyRent
      result.creditsUsed += 1
      console.log(`${LOG_PREFIX} Monthly rent: £${result.estimatedMonthlyRent}`)

      // Calculate gross yield
      if (input.askingPrice > 0) {
        result.grossYield =
          ((rentalResult.monthlyRent * 12) / input.askingPrice) * 100
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
    refurb: result.estimatedRefurbCost,
    arv: result.afterRefurbValue,
    comparables: result.comparablesCount,
    credits: result.creditsUsed,
  })

  return result
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
