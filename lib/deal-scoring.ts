/**
 * Dedicated deal scoring helper used across API routes and UI previews.
 * We expose the detailed breakdown so the UI can show investors how the final
 * score (0-100) was produced.
 */

const DEAL_SCORE_WEIGHTS = {
  bmv: 0.3,
  yield: 0.25,
  condition: 0.15,
  location: 0.15,
  market: 0.1,
  additional: 0.05,
} as const

const TARGET_POSTCODE_PREFIXES = ["SA", "CF", "NP", "LL"]

export type DealStatusValue =
  | "new"
  | "review"
  | "in_progress"
  | "ready"
  | "listed"
  | "reserved"
  | "sold"
  | "archived"

export interface DealScoringInput {
  askingPrice: number
  marketValue?: number | null
  estimatedRefurbCost?: number | null
  afterRefurbValue?: number | null
  estimatedMonthlyRent?: number | null
  bedrooms?: number | null
  propertyType?: string | null
  postcode?: string | null
  /**
   * Optional manual overrides if an analyst has already rated the property.
   */
  marketTrendsScore?: number | null
  propertyConditionScore?: number | null
}

export interface DealScoreFactor {
  label: keyof typeof DEAL_SCORE_WEIGHTS
  weight: number
  rawScore: number
  weightedScore: number
  reason: string
}

export type DealScoreBreakdown = Record<keyof typeof DEAL_SCORE_WEIGHTS, DealScoreFactor>

export interface DealScoreResult {
  score: number
  breakdown: DealScoreBreakdown
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

const pctToScore = (value: number, minThreshold: number, maxThreshold: number) => {
  if (value <= minThreshold) return 0
  if (value >= maxThreshold) return 100
  const percent = (value - minThreshold) / (maxThreshold - minThreshold)
  return clamp(percent * 100, 0, 100)
}

const roundWeighted = (raw: number, weight: number) => {
  return Math.round(raw * weight * 100) / 100
}

const makeFactor = (
  label: keyof typeof DEAL_SCORE_WEIGHTS,
  rawScore: number,
  reason: string
): DealScoreFactor => ({
  label,
  weight: DEAL_SCORE_WEIGHTS[label],
  rawScore: Math.round(rawScore * 100) / 100,
  weightedScore: roundWeighted(rawScore, DEAL_SCORE_WEIGHTS[label]),
  reason,
})

const deriveBMV = (askingPrice: number, marketValue?: number | null) => {
  if (!marketValue || marketValue <= 0) return null
  const bmv = ((marketValue - askingPrice) / marketValue) * 100
  return Math.round(bmv * 100) / 100
}

const deriveGrossYield = (askingPrice: number, estimatedMonthlyRent?: number | null) => {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  const annualRent = estimatedMonthlyRent * 12
  return Math.round(((annualRent / askingPrice) * 100) * 100) / 100
}

const estimateLocationScore = (postcode?: string | null) => {
  if (!postcode) {
    return makeFactor("location", 40, "No postcode supplied – unable to validate target areas")
  }
  const prefix = postcode.substring(0, 2).toUpperCase()
  if (TARGET_POSTCODE_PREFIXES.includes(prefix)) {
    return makeFactor("location", 95, `Priority coverage area (${prefix})`)
  }
  return makeFactor("location", 55, `Outside primary focus areas (${prefix})`)
}

const estimateMarketTrendsScore = (input: DealScoringInput) => {
  if (typeof input.marketTrendsScore === "number") {
    return clamp(input.marketTrendsScore, 0, 100)
  }

  if (!input.postcode) return 60

  const prefix = input.postcode.substring(0, 2).toUpperCase()
  if (["SA", "CF"].includes(prefix)) return 75
  if (["NP", "LL"].includes(prefix)) return 68
  return 55
}

const estimateConditionScore = (input: DealScoringInput) => {
  if (typeof input.propertyConditionScore === "number") {
    return clamp(input.propertyConditionScore, 0, 100)
  }

  const baseline = input.marketValue ?? input.askingPrice
  if (!baseline || baseline <= 0) return 50

  const refurbCost = input.estimatedRefurbCost ?? 0
  const ratio = refurbCost / baseline

  if (ratio <= 0.05) return 95
  if (ratio <= 0.1) return 85
  if (ratio <= 0.2) return 65
  if (ratio <= 0.3) return 40
  return 25
}

const estimateAdditionalScore = (input: DealScoringInput) => {
  let score = 50
  const bedrooms = input.bedrooms ?? 0
  if (bedrooms >= 4) score += 25
  else if (bedrooms >= 3) score += 15
  else if (bedrooms <= 1) score -= 10

  if (input.propertyType) {
    const type = input.propertyType.toLowerCase()
    if (["terraced", "semi"].includes(type)) {
      score += 10
    } else if (type === "flat") {
      score -= 5
    }
  }

  return clamp(score, 0, 100)
}

export function calculateDealScore(input: DealScoringInput): DealScoreResult {
  const bmv = deriveBMV(input.askingPrice, input.marketValue)
  const grossYield = deriveGrossYield(input.askingPrice, input.estimatedMonthlyRent)

  const bmvFactor = (() => {
    if (bmv === null) {
      return makeFactor("bmv", 40, "Market value unavailable – using conservative baseline")
    }
    const rawScore = pctToScore(bmv, 10, 30)
    return makeFactor("bmv", rawScore, `BMV ${bmv.toFixed(1)}%`)
  })()

  const yieldFactor = (() => {
    if (grossYield === null) {
      return makeFactor("yield", 35, "Rent data missing – applied default yield score")
    }
    const rawScore = pctToScore(grossYield, 6, 15)
    return makeFactor("yield", rawScore, `Gross yield ${grossYield.toFixed(1)}%`)
  })()

  const conditionScore = estimateConditionScore(input)
  const conditionFactor = makeFactor("condition", conditionScore, "Refurb ratio vs value")

  const locationFactor = estimateLocationScore(input.postcode)

  const marketScore = estimateMarketTrendsScore(input)
  const marketFactor = makeFactor("market", marketScore, "Macro trend weighting")

  const additionalScore = estimateAdditionalScore(input)
  const additionalFactor = makeFactor("additional", additionalScore, "Bedrooms/type preferences")

  const breakdown: DealScoreBreakdown = {
    bmv: bmvFactor,
    yield: yieldFactor,
    condition: conditionFactor,
    location: locationFactor,
    market: marketFactor,
    additional: additionalFactor,
  }

  const total = Object.values(breakdown).reduce((sum, factor) => sum + factor.weightedScore, 0)

  return {
    score: Math.round(total),
    breakdown,
  }
}


