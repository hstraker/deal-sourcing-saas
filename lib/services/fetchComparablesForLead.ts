/**
 * Service: fetchComparablesForLead
 *
 * Fetches and stores comparable sold properties for a vendor lead using the
 * PropertyData API. Extracted from the HTTP route so it can be called internally
 * (e.g. from the auto-trigger pipeline) without a user session.
 *
 * Uses the same defaults as the manual Comps tab:
 *   searchRadius: 3 miles, maxResults: 10, maxAgeMonths: 24
 */

import { prisma } from "@/lib/db"
import {
  fetchDetailedComparables,
  type DetailedComparableProperty,
} from "@/lib/propertydata"
import { normaliseAddress } from "@/lib/vendor-checks/address-normaliser"

const LOG = "[FetchComparables]"

// Defaults — mirror the manual Comps tab defaults (3 miles, 10 results, 24 months)
const DEFAULT_SEARCH_RADIUS = 3
const DEFAULT_MAX_RESULTS   = 10
const DEFAULT_MAX_AGE_MONTHS = 24

export interface FetchComparablesResult {
  success: boolean
  count: number
  avgPrice: number | null
  avgRentalYield: number | null
  confidence: "HIGH" | "MEDIUM" | "LOW"
  creditsUsed: number
  areaMonthlyRent: number | null
  error?: string
}

/**
 * Calculate confidence score for a comparable property.
 * Mirrors the confidence scoring in the HTTP route.
 */
function calculateConfidenceScore(
  comparable: {
    saleDate: string
    distance?: number
    bedrooms: number
    propertyType: string
    squareFeet?: number
  },
  targetBedrooms?: number,
  targetPropertyType?: string
): number {
  let score = 1.0

  // Recency factor
  const monthsAgo = (Date.now() - new Date(comparable.saleDate).getTime()) / (1000 * 60 * 60 * 24 * 30)
  if (monthsAgo <= 6)       score *= 1.0
  else if (monthsAgo <= 12) score *= 0.9
  else if (monthsAgo <= 18) score *= 0.8
  else                       score *= 0.7

  // Distance factor
  if (comparable.distance !== undefined) {
    if (comparable.distance <= 0.5)     score *= 1.0
    else if (comparable.distance <= 1)  score *= 0.95
    else if (comparable.distance <= 2)  score *= 0.9
    else if (comparable.distance <= 3)  score *= 0.85
    else                                 score *= 0.7
  }

  // Bedroom similarity
  if (targetBedrooms && comparable.bedrooms) {
    const diff = Math.abs(comparable.bedrooms - targetBedrooms)
    if (diff === 0)      score *= 1.0
    else if (diff === 1) score *= 0.9
    else                  score *= 0.8
  }

  // Property type similarity
  if (targetPropertyType && comparable.propertyType) {
    const t = targetPropertyType.toLowerCase()
    const c = comparable.propertyType.toLowerCase()
    if (c.includes(t) || t.includes(c)) score *= 1.0
    else if (
      (t.includes("house") && c.includes("house")) ||
      (t.includes("flat")  && c.includes("flat"))
    ) score *= 0.95
    else score *= 0.85
  }

  // Data completeness
  const completeness = (comparable.distance !== undefined ? 0.5 : 0) +
                       (comparable.squareFeet ? 0.5 : 0)
  score *= 0.9 + completeness * 0.1

  return Math.max(0, Math.min(1, score))
}

export async function fetchComparablesForLead(leadId: string): Promise<FetchComparablesResult> {
  // ── 1. Load lead ────────────────────────────────────────────────────────────
  const lead = await prisma.vendorLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      propertyPostcode: true,
      propertyAddress: true,
      bedrooms: true,
      propertyType: true,
      comparablesFetchedAt: true,
    },
  })

  if (!lead) {
    return { success: false, count: 0, avgPrice: null, avgRentalYield: null, confidence: "LOW", creditsUsed: 0, areaMonthlyRent: null, error: "Lead not found" }
  }

  // ── 2. Resolve postcode ─────────────────────────────────────────────────────
  let postcode = lead.propertyPostcode
  if (!postcode && lead.propertyAddress) {
    const norm = normaliseAddress(lead.propertyAddress)
    if (norm.postcode) {
      postcode = norm.postcode
      await prisma.vendorLead.update({
        where: { id: leadId },
        data: { propertyPostcode: postcode },
      })
      console.log(`${LOG} Extracted postcode from address: ${postcode}`)
    }
  }

  if (!postcode) {
    return { success: false, count: 0, avgPrice: null, avgRentalYield: null, confidence: "LOW", creditsUsed: 0, areaMonthlyRent: null, error: "No postcode — cannot fetch comparables" }
  }

  // ── 3. Fetch from PropertyData API ─────────────────────────────────────────
  console.log(`${LOG} Fetching comparables for lead ${leadId} (${postcode})`)
  const result = await fetchDetailedComparables(
    postcode,
    lead.bedrooms || undefined,
    lead.propertyType || undefined,
    DEFAULT_SEARCH_RADIUS,
    DEFAULT_MAX_RESULTS,
    DEFAULT_MAX_AGE_MONTHS
  )

  if (!result) {
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { comparablesFetchedAt: new Date(), comparablesCount: 0 },
    }).catch(() => {})
    return { success: false, count: 0, avgPrice: null, avgRentalYield: null, confidence: "LOW", creditsUsed: 0, areaMonthlyRent: null, error: "PropertyData API returned null" }
  }

  if (result.comparables.length === 0) {
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { comparablesFetchedAt: new Date(), comparablesCount: 0 },
    }).catch(() => {})
    console.log(`${LOG} No comparables found for ${postcode}`)
    return { success: true, count: 0, avgPrice: null, avgRentalYield: result.avgRentalYield, confidence: "LOW", creditsUsed: result.creditsUsed, areaMonthlyRent: null }
  }

  // ── 4. Clear old comparables + store new ones ───────────────────────────────
  await prisma.comparableProperty.deleteMany({ where: { vendorLeadId: leadId } })

  const stored = await Promise.all(
    result.comparables.map((comp: DetailedComparableProperty) => {
      const confidence = calculateConfidenceScore(
        {
          saleDate: comp.saleDate,
          distance: comp.distance,
          bedrooms: comp.bedrooms,
          propertyType: comp.propertyType,
          squareFeet: comp.squareFeet,
        },
        lead.bedrooms || undefined,
        lead.propertyType || undefined
      )
      return prisma.comparableProperty.create({
        data: {
          vendorLeadId: leadId,
          address: comp.address,
          postcode: comp.postcode || postcode!,
          salePrice: comp.salePrice,
          saleDate: new Date(comp.saleDate),
          bedrooms: comp.bedrooms,
          bathrooms: comp.bathrooms,
          propertyType: comp.propertyType,
          squareFeet: comp.squareFeet,
          distance: comp.distance,
          daysOnMarket: comp.daysOnMarket,
          priceReductions: comp.priceReductions || 0,
          monthlyRent: comp.monthlyRent,
          weeklyRent: comp.weeklyRent,
          rentalYield: comp.rentalYield,
          rentalYieldMin: comp.rentalYieldMin,
          rentalYieldMax: comp.rentalYieldMax,
          areaAverageRent: comp.areaAverageRent,
          listingSource: comp.listingSource,
          listingUrl: comp.listingUrl,
          listingUrlSecondary: comp.listingUrlSecondary,
          propertyDataId: comp.propertyDataId,
          confidence,
          notes: null,
        },
      })
    })
  )

  // ── 5. Overall confidence grade ─────────────────────────────────────────────
  const avgConfidence = stored.reduce((s, c) => s + c.confidence.toNumber(), 0) / stored.length
  let overallConfidence: "HIGH" | "MEDIUM" | "LOW" = "LOW"
  if (stored.length >= 5 && avgConfidence >= 0.8)      overallConfidence = "HIGH"
  else if (stored.length >= 3 && avgConfidence >= 0.6)  overallConfidence = "MEDIUM"

  // ── 6. Rental data from first comparable that has it ────────────────────────
  const compWithRent    = stored.find((c) => c.monthlyRent != null)
  const areaMonthlyRent = compWithRent?.monthlyRent?.toNumber() ?? null
  const areaWeeklyRent  = compWithRent?.weeklyRent?.toNumber()  ?? null

  // ── 7. Update lead ──────────────────────────────────────────────────────────
  await prisma.vendorLead.update({
    where: { id: leadId },
    data: {
      comparablesCount: stored.length,
      comparablesFetchedAt: new Date(),
      comparablesSearchRadius: DEFAULT_SEARCH_RADIUS,
      avgComparablePrice: result.avgSalePrice,
      comparablesConfidence: overallConfidence,
      ...(areaMonthlyRent != null && {
        estimatedMonthlyRent: areaMonthlyRent,
        estimatedAnnualRent:  Math.round(areaMonthlyRent * 12),
      }),
    },
  })

  // ── 8. Pipeline event ───────────────────────────────────────────────────────
  await prisma.pipelineEvent.create({
    data: {
      vendorLeadId: leadId,
      eventType: "comparables_fetched",
      details: {
        description: `Auto-fetched ${stored.length} comparable properties`,
        avgPrice: result.avgSalePrice,
        priceRange: result.priceRange,
        searchRadius: DEFAULT_SEARCH_RADIUS,
        confidence: overallConfidence,
        creditsUsed: result.creditsUsed,
        source: "auto_trigger",
      },
    },
  }).catch(() => {}) // don't fail the pipeline over a logging error

  console.log(`${LOG} Stored ${stored.length} comparables (${overallConfidence} confidence, avg £${result.avgSalePrice?.toLocaleString() ?? "n/a"})`)
  if (areaMonthlyRent != null) {
    console.log(`${LOG} Saved rental data: £${areaMonthlyRent}/mo (£${areaWeeklyRent}/wk)`)
  }

  return {
    success: true,
    count: stored.length,
    avgPrice: result.avgSalePrice,
    avgRentalYield: result.avgRentalYield,
    confidence: overallConfidence,
    creditsUsed: result.creditsUsed,
    areaMonthlyRent,
  }
}
