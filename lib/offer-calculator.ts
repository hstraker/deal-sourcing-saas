/**
 * Professional UK Property Investor Offer Calculator
 *
 * Pure calculation engine — no Prisma or DB imports.
 * Used by app/api/vendor-leads/[id]/calculate-bmv/route.ts when
 * OfferCalculatorConfig.enableStrategyMode = true.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type PropertyCondition  = "Good" | "Average" | "Poor"
export type TenureType         = "Freehold" | "Leasehold"
export type ChainStatus        = "NoChain" | "ShortChain" | "LongChain"
export type InvestmentStrategy = "Flip" | "BRR" | "BuyHold" | "BTL"

export interface OfferConfig {
  /** Minimum discount off market value (%) — default 10 */
  baseDiscountMin: number
  /** Maximum discount off market value (%) — default 40 */
  baseDiscountMax: number
  /** Extra discount added when condition = Poor — default 10 */
  poorConditionDiscount: number
  /** Extra discount added when condition = Average — default 3 */
  avgConditionDiscount: number
  /** Extra discount added for Leasehold tenure — default 5 */
  leaseholdDiscount: number
  /** Extra discount added when chain = LongChain — default 5 */
  longChainDiscount: number
  /** Extra discount added when chain = ShortChain — default 2 */
  shortChainDiscount: number
  /** Postcode demand score >= this threshold → demand reduction applies — default 8 */
  highDemandThreshold: number
  /** Discount reduction applied when demand is high (%) — default 5 */
  highDemandReduction: number
  /** Flip ceiling: offer ≤ marketValue × this% − refurb — default 70 */
  flipMarketValuePct: number
  /** BRR ceiling: offer + refurb ≤ marketValue × this% — default 75 */
  brrLtvPercent: number
  /** BuyHold: min gross yield % to validate — default 8 */
  buyHoldMinYield: number
  /** BTL: min gross yield % to validate — default 7 */
  btlMinYield: number
  /** Validation: minimum BMV % for deal to pass — default 15 */
  minBmvPercentage: number
  /** Validation: minimum profit £ for deal to pass — default 10000 */
  minProfitPotential: number
}

export const DEFAULT_OFFER_CONFIG: OfferConfig = {
  baseDiscountMin:      10,
  baseDiscountMax:      40,
  poorConditionDiscount: 10,
  avgConditionDiscount:   3,
  leaseholdDiscount:      5,
  longChainDiscount:      5,
  shortChainDiscount:     2,
  highDemandThreshold:    8,
  highDemandReduction:    5,
  flipMarketValuePct:    70,
  brrLtvPercent:         75,
  buyHoldMinYield:        8,
  btlMinYield:            7,
  minBmvPercentage:      15,
  minProfitPotential: 10000,
}

export interface OfferInput {
  askingPrice: number
  marketValue: number
  refurbCost: number
  condition: PropertyCondition
  tenure: TenureType
  chainStatus: ChainStatus
  /** Postcode demand score 1–10 (higher = stronger demand) */
  postcodeDemandScore: number
  strategy: InvestmentStrategy
  /** Monthly rent — used for BuyHold/BTL yield ceiling */
  monthlyRent?: number
  config: OfferConfig
}

export interface OfferResult {
  recommendedOffer: number
  /** Discount % from market value that was applied */
  discountPercentageUsed: number
  /** Strategy ceiling that was applied (null if not binding) */
  strategyCeiling: number | null
  /** Gross yield the recommended offer achieves (0 if no rent provided) */
  achievedGrossYield: number
  passesValidation: boolean
  /** Step-by-step explanation lines for UI display */
  explanation: string[]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Round to nearest £1,000 */
function roundToNearest1000(n: number): number {
  return Math.round(n / 1000) * 1000
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : "—"
}

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`
}

/**
 * Maps Prisma PropertyCondition enum values to the calculator's condition type.
 * Prisma stores: "excellent" | "good" | "needs_work" | "needs_modernisation" | "poor"
 */
export function mapCondition(prismaCondition: string | null | undefined): PropertyCondition {
  if (!prismaCondition) return "Average"
  switch (prismaCondition.toLowerCase()) {
    case "excellent":
    case "good":
      return "Good"
    case "needs_work":
    case "needs_modernisation":
    case "average":
      return "Average"
    case "poor":
      return "Poor"
    default:
      return "Average"
  }
}

/**
 * Converts Prisma OfferCalculatorConfig (Decimal fields) to plain OfferConfig numbers.
 */
export function toOfferConfig(db: {
  baseDiscountMin: { toNumber(): number } | number
  baseDiscountMax: { toNumber(): number } | number
  poorConditionDiscount: { toNumber(): number } | number
  avgConditionDiscount: { toNumber(): number } | number
  leaseholdDiscount: { toNumber(): number } | number
  longChainDiscount: { toNumber(): number } | number
  shortChainDiscount: { toNumber(): number } | number
  highDemandThreshold: number
  highDemandReduction: { toNumber(): number } | number
  flipMarketValuePct: { toNumber(): number } | number
  brrLtvPercent: { toNumber(): number } | number
  buyHoldMinYield: { toNumber(): number } | number
  btlMinYield: { toNumber(): number } | number
  minBmvPercentage: { toNumber(): number } | number
  minProfitPotential: { toNumber(): number } | number
}): OfferConfig {
  const n = (v: { toNumber(): number } | number) =>
    typeof v === "number" ? v : v.toNumber()
  return {
    baseDiscountMin:       n(db.baseDiscountMin),
    baseDiscountMax:       n(db.baseDiscountMax),
    poorConditionDiscount: n(db.poorConditionDiscount),
    avgConditionDiscount:  n(db.avgConditionDiscount),
    leaseholdDiscount:     n(db.leaseholdDiscount),
    longChainDiscount:     n(db.longChainDiscount),
    shortChainDiscount:    n(db.shortChainDiscount),
    highDemandThreshold:   db.highDemandThreshold,
    highDemandReduction:   n(db.highDemandReduction),
    flipMarketValuePct:    n(db.flipMarketValuePct),
    brrLtvPercent:         n(db.brrLtvPercent),
    buyHoldMinYield:       n(db.buyHoldMinYield),
    btlMinYield:           n(db.btlMinYield),
    minBmvPercentage:      n(db.minBmvPercentage),
    minProfitPotential:    n(db.minProfitPotential),
  }
}

// ─── Main calculator ──────────────────────────────────────────────────────────

/**
 * Calculate the maximum recommended offer price using professional UK investor methodology.
 *
 * Returns a step-by-step explanation suitable for displaying in the UI alongside
 * the final figure and validation result.
 */
export function calculateOffer(input: OfferInput): OfferResult {
  const { askingPrice, marketValue, refurbCost, config, strategy } = input
  const explanation: string[] = []

  explanation.push(`Strategy: ${strategy}`)
  explanation.push(`Market Value: ${fmt(marketValue)}  |  Asking Price: ${fmt(askingPrice)}  |  Refurb Cost: ${fmt(refurbCost)}`)
  explanation.push("─".repeat(60))

  // ── Step 1: Base discount (midpoint of configured range) ───────────────────
  const baseMid = (config.baseDiscountMin + config.baseDiscountMax) / 2
  let totalDiscount = baseMid
  explanation.push(`1. Base discount: ${baseMid.toFixed(1)}% (midpoint of ${config.baseDiscountMin}%–${config.baseDiscountMax}% range)`)

  // ── Step 2: Property condition ─────────────────────────────────────────────
  switch (input.condition) {
    case "Poor":
      totalDiscount += config.poorConditionDiscount
      explanation.push(`2. Condition (Poor): +${config.poorConditionDiscount}% — property requires significant work`)
      break
    case "Average":
      totalDiscount += config.avgConditionDiscount
      explanation.push(`2. Condition (Average): +${config.avgConditionDiscount}% — some updating required`)
      break
    case "Good":
      explanation.push(`2. Condition (Good): no adjustment`)
      break
  }

  // ── Step 3: Tenure ─────────────────────────────────────────────────────────
  if (input.tenure === "Leasehold") {
    totalDiscount += config.leaseholdDiscount
    explanation.push(`3. Tenure (Leasehold): +${config.leaseholdDiscount}% — financing complexity, service charge risk`)
  } else {
    explanation.push(`3. Tenure (Freehold): no adjustment`)
  }

  // ── Step 4: Chain status ───────────────────────────────────────────────────
  switch (input.chainStatus) {
    case "LongChain":
      totalDiscount += config.longChainDiscount
      explanation.push(`4. Chain (Long): +${config.longChainDiscount}% — higher fall-through risk`)
      break
    case "ShortChain":
      totalDiscount += config.shortChainDiscount
      explanation.push(`4. Chain (Short): +${config.shortChainDiscount}% — moderate fall-through risk`)
      break
    case "NoChain":
      explanation.push(`4. Chain (None): no adjustment — clean transaction`)
      break
  }

  // ── Step 5: Postcode demand ────────────────────────────────────────────────
  const demandScore = input.postcodeDemandScore
  const partialThreshold = config.highDemandThreshold - 2
  if (demandScore >= config.highDemandThreshold) {
    totalDiscount -= config.highDemandReduction
    explanation.push(`5. Demand (score ${demandScore}/10, strong): −${config.highDemandReduction}% — competitive market supports higher offer`)
  } else if (demandScore >= partialThreshold && partialThreshold > 0) {
    const partial = Math.floor(config.highDemandReduction * 0.4)
    totalDiscount -= partial
    explanation.push(`5. Demand (score ${demandScore}/10, moderate): −${partial}% — some demand support`)
  } else {
    explanation.push(`5. Demand (score ${demandScore}/10, low/average): no adjustment`)
  }

  // ── Step 6: Clamp discount to configured range ─────────────────────────────
  const clampedDiscount = clamp(totalDiscount, config.baseDiscountMin, config.baseDiscountMax)
  if (clampedDiscount !== totalDiscount) {
    explanation.push(`6. Discount clamped from ${totalDiscount.toFixed(1)}% to ${clampedDiscount.toFixed(1)}% (range: ${config.baseDiscountMin}%–${config.baseDiscountMax}%)`)
  } else {
    explanation.push(`6. Total discount: ${clampedDiscount.toFixed(1)}% (within ${config.baseDiscountMin}%–${config.baseDiscountMax}% range)`)
  }
  const discountUsed = clampedDiscount

  // ── Step 7: Base offer from market value ──────────────────────────────────
  const baseOffer = marketValue * (1 - discountUsed / 100)
  explanation.push(`7. Base offer: ${fmt(marketValue)} × ${(100 - discountUsed).toFixed(1)}% = ${fmt(baseOffer)}`)

  // ── Step 8: Subtract refurb ───────────────────────────────────────────────
  const adjustedOffer = baseOffer - refurbCost
  if (refurbCost > 0) {
    explanation.push(`8. Refurb deduction: ${fmt(baseOffer)} − ${fmt(refurbCost)} = ${fmt(adjustedOffer)}`)
  } else {
    explanation.push(`8. No refurb cost — offer stays at ${fmt(adjustedOffer)}`)
  }

  // ── Step 9: Strategy ceiling ──────────────────────────────────────────────
  let strategyCeiling: number | null = null

  switch (strategy) {
    case "Flip": {
      const flipCeiling = (marketValue * config.flipMarketValuePct / 100) - refurbCost
      strategyCeiling = flipCeiling
      explanation.push(
        `9. Flip ceiling: ${fmt(marketValue)} × ${config.flipMarketValuePct}% − ${fmt(refurbCost)} = ${fmt(flipCeiling)}`
      )
      explanation.push(`   Rationale: sell at market value, buy at ${config.flipMarketValuePct}% to cover costs + profit`)
      break
    }
    case "BRR": {
      // After refinance at brrLtvPercent, proceeds must cover purchase + refurb.
      // So: offer + refurb ≤ marketValue × LTV  →  offer ≤ (MV × LTV) − refurb
      const brrCeiling = (marketValue * config.brrLtvPercent / 100) - refurbCost
      strategyCeiling = brrCeiling
      explanation.push(
        `9. BRR ceiling: ${fmt(marketValue)} × ${config.brrLtvPercent}% LTV − ${fmt(refurbCost)} refurb = ${fmt(brrCeiling)}`
      )
      explanation.push(`   Rationale: refinance proceeds (${config.brrLtvPercent}% LTV) must fully recover purchase price + refurb`)
      break
    }
    case "BuyHold":
    case "BTL": {
      const minYield = strategy === "BTL" ? config.btlMinYield : config.buyHoldMinYield
      if (input.monthlyRent && input.monthlyRent > 0) {
        const annualRent = input.monthlyRent * 12
        const yieldCeiling = annualRent / (minYield / 100)
        strategyCeiling = yieldCeiling
        explanation.push(
          `9. ${strategy} yield ceiling: ${fmt(annualRent)} annual rent ÷ ${minYield}% = ${fmt(yieldCeiling)}`
        )
        explanation.push(`   Rationale: maximum offer that still delivers ≥${minYield}% gross yield`)
      } else {
        explanation.push(`9. ${strategy}: no monthly rent provided — yield ceiling not applied`)
      }
      break
    }
  }

  // ── Step 10: Final offer (min of adjusted, ceiling, asking price) ──────────
  let finalOffer = adjustedOffer
  const ceilingApplied = strategyCeiling !== null && strategyCeiling < adjustedOffer

  if (ceilingApplied && strategyCeiling !== null) {
    finalOffer = strategyCeiling
    explanation.push(`10. Strategy ceiling is binding (${fmt(strategyCeiling)} < ${fmt(adjustedOffer)}) — offer reduced`)
  } else if (strategyCeiling !== null) {
    explanation.push(`10. Strategy ceiling (${fmt(strategyCeiling)}) is not binding — discount-based offer (${fmt(adjustedOffer)}) stands`)
  }

  // Never exceed asking price
  if (finalOffer > askingPrice) {
    finalOffer = askingPrice
    explanation.push(`    Capped at asking price: ${fmt(askingPrice)}`)
  }

  const rounded = roundToNearest1000(Math.max(0, finalOffer))
  explanation.push(`    Rounded to nearest £1,000: ${fmt(rounded)}`)

  // ── Step 11: Validation ────────────────────────────────────────────────────
  const bmvDiscountPct = ((marketValue - rounded) / marketValue) * 100
  const profitPotential = marketValue - rounded - refurbCost
  const annualRent = (input.monthlyRent ?? 0) * 12
  const achievedGrossYield = rounded > 0 && annualRent > 0
    ? (annualRent / rounded) * 100
    : 0

  const passesValidation =
    bmvDiscountPct >= config.minBmvPercentage &&
    profitPotential >= config.minProfitPotential

  explanation.push("─".repeat(60))
  explanation.push(`Recommended Offer: ${fmt(rounded)}`)
  explanation.push(`Discount from MV: ${bmvDiscountPct.toFixed(1)}% (min required: ${config.minBmvPercentage}%) ${bmvDiscountPct >= config.minBmvPercentage ? "✓" : "✗"}`)
  explanation.push(`Profit potential: ${fmt(profitPotential)} (min required: ${fmt(config.minProfitPotential)}) ${profitPotential >= config.minProfitPotential ? "✓" : "✗"}`)
  if (achievedGrossYield > 0) {
    explanation.push(`Gross yield at offer: ${achievedGrossYield.toFixed(2)}%`)
  }
  explanation.push(`Validation: ${passesValidation ? "PASS ✓" : "FAIL ✗"}`)

  return {
    recommendedOffer: rounded,
    discountPercentageUsed: discountUsed,
    strategyCeiling: ceilingApplied ? strategyCeiling : null,
    achievedGrossYield,
    passesValidation,
    explanation,
  }
}
