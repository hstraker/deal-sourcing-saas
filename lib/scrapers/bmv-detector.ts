import type { BmvIndicators, ScrapedProperty } from "./types"
import {
  NEEDS_WORK_KEYWORDS,
  MOTIVATED_SELLER_KEYWORDS,
  AUCTION_KEYWORDS,
  CASH_BUYER_KEYWORDS,
  PROBATE_KEYWORDS,
} from "./constants"

/**
 * Detect BMV (Below Market Value) indicators from property data.
 * Scans title + description for keyword matches, checks price history
 * for reductions, and calculates a composite BMV score (0-100).
 */
export function detectBmvIndicators(
  property: Pick<
    ScrapedProperty,
    "title" | "description" | "priceHistory" | "price" | "daysOnMarket"
  >
): BmvIndicators {
  const text = `${property.title} ${property.description}`.toLowerCase()

  // Keyword matching
  const needsWorkKeywords = matchKeywords(text, NEEDS_WORK_KEYWORDS)
  const motivatedSellerKeywords = matchKeywords(text, MOTIVATED_SELLER_KEYWORDS)
  const auctionMatches = matchKeywords(text, AUCTION_KEYWORDS)
  const cashBuyerMatches = matchKeywords(text, CASH_BUYER_KEYWORDS)
  const probateMatches = matchKeywords(text, PROBATE_KEYWORDS)

  // Price reduction detection
  let hasReduction = false
  let reductionPercentage: number | undefined
  let originalPrice: number | undefined

  if (property.priceHistory.length > 0) {
    const earliest = property.priceHistory[0]
    if (earliest.price > property.price) {
      hasReduction = true
      originalPrice = earliest.price
      reductionPercentage = Math.round(
        ((earliest.price - property.price) / earliest.price) * 100
      )
    }
  }

  // Also check description for reduction text
  if (!hasReduction) {
    const reductionRegex =
      /(?:reduced|price drop|price reduction|was\s*£[\d,]+)/i
    if (reductionRegex.test(property.description)) {
      hasReduction = true
    }
  }

  const isAuction = auctionMatches.length > 0
  const isRepossession =
    text.includes("repossession") || text.includes("repossessed")
  const isProbate = probateMatches.length > 0
  const isCashBuyersOnly = cashBuyerMatches.length > 0
  const longTimeOnMarket = property.daysOnMarket > 90

  const indicators: Omit<BmvIndicators, "bmvScore"> = {
    hasReduction,
    reductionPercentage,
    originalPrice,
    needsWorkKeywords,
    motivatedSellerKeywords,
    isAuction,
    isRepossession,
    isProbate,
    isCashBuyersOnly,
    longTimeOnMarket,
    daysOnMarket: property.daysOnMarket,
  }

  return {
    ...indicators,
    bmvScore: calculateBmvScore(indicators),
  }
}

/**
 * Detect whether a property is ambiguous and needs manual review.
 * Returns reasons explaining why the property was flagged.
 */
export function detectAmbiguity(
  property: ScrapedProperty
): { isAmbiguous: boolean; reasons: string[] } {
  const reasons: string[] = []

  // Excessive price reduction (> 25%) — suspicious
  if (
    property.bmvIndicators.hasReduction &&
    (property.bmvIndicators.reductionPercentage || 0) > 25
  ) {
    reasons.push(
      `Excessive price reduction (${property.bmvIndicators.reductionPercentage}%) - may indicate issues`
    )
  }

  // Unusually low price
  if (property.price < 10000) {
    reasons.push("Unusually low price - may be a guide price or error")
  }

  // Commercial missing key info
  if (property.category === "COMMERCIAL") {
    if (!property.commercialDetails?.leaseType) {
      reasons.push("Commercial property missing lease/freehold information")
    }
    if (!property.commercialDetails?.estimatedYield) {
      reasons.push("Commercial property missing yield information")
    }
  }

  // High-value auction
  if (property.bmvIndicators.isAuction && property.price > 500000) {
    reasons.push("High-value auction property - verify guide price accuracy")
  }

  // Land/plot
  const type = property.propertyType.toLowerCase()
  if (type.includes("land") || type.includes("plot")) {
    reasons.push("Land/plot listing - different valuation criteria needed")
  }

  return { isAmbiguous: reasons.length > 0, reasons }
}

// ---- Internal helpers ----

function matchKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((kw) => text.includes(kw.toLowerCase()))
}

function countActiveIndicators(indicators: BmvIndicators): number {
  let count = 0
  if (indicators.hasReduction) count++
  if (indicators.needsWorkKeywords.length > 0) count++
  if (indicators.motivatedSellerKeywords.length > 0) count++
  if (indicators.isAuction) count++
  if (indicators.isRepossession) count++
  if (indicators.isProbate) count++
  if (indicators.isCashBuyersOnly) count++
  if (indicators.longTimeOnMarket) count++
  return count
}

function calculateBmvScore(
  indicators: Omit<BmvIndicators, "bmvScore">
): number {
  let score = 0

  // Price reduction (up to 30 points)
  if (indicators.hasReduction) {
    const reduction = indicators.reductionPercentage || 0
    if (reduction >= 20) score += 30
    else if (reduction >= 10) score += 20
    else if (reduction >= 5) score += 10
    else score += 5
  }

  // Needs work keywords (up to 25 points, 5 per keyword, max 5)
  score += Math.min(indicators.needsWorkKeywords.length, 5) * 5

  // Motivated seller keywords (up to 20 points, 5 per keyword, max 4)
  score += Math.min(indicators.motivatedSellerKeywords.length, 4) * 5

  // Auction (10 points)
  if (indicators.isAuction) score += 10

  // Repossession (15 points)
  if (indicators.isRepossession) score += 15

  // Probate (10 points)
  if (indicators.isProbate) score += 10

  // Cash buyers only (5 points)
  if (indicators.isCashBuyersOnly) score += 5

  // Long time on market (up to 15 points)
  if (indicators.longTimeOnMarket) {
    if (indicators.daysOnMarket > 180) score += 15
    else if (indicators.daysOnMarket > 120) score += 10
    else score += 5
  }

  return Math.min(score, 100)
}
