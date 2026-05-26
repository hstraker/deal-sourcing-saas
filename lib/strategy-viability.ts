/**
 * lib/strategy-viability.ts
 *
 * Quick strategy viability checks for a property listing.
 * No external API calls — computed purely from listing data.
 *
 * Strategies:
 *  BTL   — Buy to Let (yield-driven, residential)
 *  BRRR  — Buy, Refurbish, Refinance, Rent
 *  HMO   — House in Multiple Occupation
 *  Flip  — Buy, refurb, resell for profit
 *
 * Each strategy returns:
 *  viable:   boolean   — passes basic signal checks
 *  score:    0–100     — confidence level (not a deal score, just signal strength)
 *  reasons:  string[]  — positive signals
 *  warnings: string[]  — red-flag conditions
 */

import type { BmvIndicatorsData } from "@/types/property-listing"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StrategyResult {
  viable:   boolean
  score:    number     // 0–100 signal strength
  reasons:  string[]
  warnings: string[]
}

export interface StrategyViabilityResult {
  btl:  StrategyResult
  brrr: StrategyResult
  hmo:  StrategyResult
  flip: StrategyResult
}

export interface StrategyViabilityInput {
  price:          number
  bedrooms:       number
  propertyType:   string   // e.g. "TERRACED", "SEMI_DETACHED", "FLAT", "DETACHED"
  epcRating:      string | null | undefined
  isChainFree:    boolean | null | undefined
  tenure:         string | null | undefined   // "FREEHOLD" | "LEASEHOLD"
  leaseYearsRemaining: number | null | undefined
  daysOnMarket:   number
  bmvIndicators:  BmvIndicatorsData
  isWelsh:        boolean
  keyFeatures:    string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLargeProperty(input: StrategyViabilityInput): boolean {
  return input.bedrooms >= 4
}

function hasShortLease(input: StrategyViabilityInput): boolean {
  if (input.tenure !== "LEASEHOLD") return false
  if (!input.leaseYearsRemaining) return false
  return input.leaseYearsRemaining < 80
}

function needsWork(input: StrategyViabilityInput): boolean {
  return input.bmvIndicators.needsWorkKeywords.length > 0
}

function textContains(input: StrategyViabilityInput, ...keywords: string[]): boolean {
  const combined = input.keyFeatures.join(" ").toLowerCase()
  return keywords.some(k => combined.includes(k.toLowerCase()))
}

// ─── BTL — Buy to Let ────────────────────────────────────────────────────────

function checkBTL(input: StrategyViabilityInput): StrategyResult {
  const reasons:  string[] = []
  const warnings: string[] = []
  let score = 0

  // Positive signals
  if (input.bedrooms >= 2 && input.bedrooms <= 4) {
    reasons.push("Good bedroom count for BTL lettings")
    score += 25
  }
  if (input.bmvIndicators.hasReduction && (input.bmvIndicators.reductionPercentage ?? 0) >= 5) {
    reasons.push("Price reduction improves yield potential")
    score += 20
  }
  if (input.epcRating && ["A","B","C"].includes(input.epcRating.toUpperCase())) {
    reasons.push(`EPC ${input.epcRating} — low running costs for tenants`)
    score += 15
  }
  if (input.isChainFree) {
    reasons.push("Chain free — faster completion")
    score += 10
  }
  if (!needsWork(input)) {
    reasons.push("No refurb required — immediate lettable")
    score += 15
  }
  if (input.tenure === "FREEHOLD") {
    reasons.push("Freehold — no service charge drag on yield")
    score += 10
  }

  // Warnings
  if (input.price > 500_000) {
    warnings.push("High price — yield will be harder to achieve at 6%+")
    score -= 15
  }
  if (hasShortLease(input)) {
    warnings.push(`Short lease (${input.leaseYearsRemaining}y) — mortgage lender restrictions`)
    score -= 20
  }
  if (input.epcRating && ["F","G"].includes(input.epcRating.toUpperCase())) {
    warnings.push(`EPC ${input.epcRating} — cannot legally let without improvement work`)
    score -= 20
  }
  if (input.isWelsh) {
    warnings.push("Wales — Renting Homes Wales Act applies (different tenant obligations)")
    // Not a penalty — just awareness
  }

  score = Math.max(0, Math.min(100, score))
  return { viable: score >= 40, score, reasons, warnings }
}

// ─── BRRR — Buy Refurbish Refinance Rent ─────────────────────────────────────

function checkBRRR(input: StrategyViabilityInput): StrategyResult {
  const reasons:  string[] = []
  const warnings: string[] = []
  let score = 0

  // Positive signals
  if (needsWork(input)) {
    reasons.push("Requires modernisation — opportunity to add value")
    score += 30
  }
  if (input.bmvIndicators.hasReduction && (input.bmvIndicators.reductionPercentage ?? 0) >= 10) {
    reasons.push(`Reduced ${input.bmvIndicators.reductionPercentage?.toFixed(0)}% — purchase discount for refinance headroom`)
    score += 25
  }
  if (input.epcRating && ["F","G"].includes(input.epcRating.toUpperCase())) {
    reasons.push(`EPC ${input.epcRating} — improvement drives GDV increase`)
    score += 15
  }
  if (input.tenure === "FREEHOLD") {
    reasons.push("Freehold — no freeholder permission needed for works")
    score += 10
  }
  if (input.daysOnMarket >= 90) {
    reasons.push("Long on market — motivated seller likely to accept lower offer")
    score += 10
  }
  if (input.bmvIndicators.isRepossession || input.bmvIndicators.isProbate) {
    reasons.push("Distressed sale — purchase below market value possible")
    score += 15
  }

  // Warnings
  if (!needsWork(input) && !input.bmvIndicators.hasReduction) {
    warnings.push("No clear refurb opportunity or discount found")
    score -= 20
  }
  if (hasShortLease(input)) {
    warnings.push(`Short lease — refinancing post-refurb will be difficult`)
    score -= 25
  }
  if (input.price > 400_000) {
    warnings.push("High price — harder to achieve 20%+ uplift for full capital recycle")
    score -= 10
  }
  if (input.tenure === "LEASEHOLD" && input.leaseYearsRemaining && input.leaseYearsRemaining < 100) {
    warnings.push("Leasehold — freeholder consent may be needed for structural works")
  }

  score = Math.max(0, Math.min(100, score))
  return { viable: score >= 35, score, reasons, warnings }
}

// ─── HMO — House in Multiple Occupation ──────────────────────────────────────

function checkHMO(input: StrategyViabilityInput): StrategyResult {
  const reasons:  string[] = []
  const warnings: string[] = []
  let score = 0

  // HMO fundamentals
  if (input.bedrooms >= 4) {
    reasons.push(`${input.bedrooms} bedrooms — suitable for HMO conversion`)
    score += 30
  } else if (input.bedrooms === 3) {
    reasons.push("3 bedrooms — could work as small HMO")
    score += 15
  }

  const propertyTypeUpper = input.propertyType?.toUpperCase() ?? ""
  if (["TERRACED","SEMI_DETACHED","DETACHED","END_TERRACE"].includes(propertyTypeUpper)) {
    reasons.push(`${input.propertyType} — typically suitable for HMO conversion`)
    score += 20
  }
  if (input.tenure === "FREEHOLD") {
    reasons.push("Freehold — no restrictions from freeholder on use change")
    score += 15
  }
  if (textContains(input, "large garden", "double garage", "outbuilding")) {
    reasons.push("Potential for extension/conversion to add rooms")
    score += 10
  }

  // Warnings
  if (input.bedrooms < 3) {
    warnings.push("Under 3 bedrooms — unlikely to meet HMO minimum room count")
    score -= 30
  }
  if (propertyTypeUpper === "FLAT" || propertyTypeUpper === "APARTMENT") {
    warnings.push("Flat/apartment — HMO licensing and management articles often restrict this")
    score -= 25
  }
  if (input.tenure === "LEASEHOLD") {
    warnings.push("Leasehold — check lease for HMO / subletting restrictions")
    score -= 15
  }
  if (hasShortLease(input)) {
    warnings.push(`Short lease (${input.leaseYearsRemaining}y) — mortgage and planning complications`)
    score -= 20
  }
  if (input.isWelsh) {
    warnings.push("Wales — HMO licensing rules may differ from England (contact local council)")
  }

  score = Math.max(0, Math.min(100, score))
  return { viable: score >= 40 && input.bedrooms >= 3, score, reasons, warnings }
}

// ─── Flip — Refurb & Resell ──────────────────────────────────────────────────

function checkFlip(input: StrategyViabilityInput): StrategyResult {
  const reasons:  string[] = []
  const warnings: string[] = []
  let score = 0

  // Core flip signals
  if (needsWork(input)) {
    reasons.push("Requires work — value-add opportunity on resale")
    score += 30
  }
  if (input.bmvIndicators.hasReduction && (input.bmvIndicators.reductionPercentage ?? 0) >= 10) {
    reasons.push(`Reduced ${input.bmvIndicators.reductionPercentage?.toFixed(0)}% — built-in margin`)
    score += 25
  }
  if (input.bmvIndicators.isRepossession || input.bmvIndicators.isProbate || input.bmvIndicators.isAuction) {
    reasons.push("Distressed / auction — purchase discount likely")
    score += 20
  }
  if (input.isChainFree) {
    reasons.push("Chain free — faster access to start works")
    score += 10
  }
  if (input.tenure === "FREEHOLD") {
    reasons.push("Freehold — no restrictions on works or resale timing")
    score += 10
  }

  // Warnings
  if (!needsWork(input) && !input.bmvIndicators.hasReduction) {
    warnings.push("No discount or works needed — margin will be thin")
    score -= 25
  }
  if (input.price > 350_000) {
    warnings.push("High entry price — larger capital at risk; exit liquidity may be slower")
    score -= 10
  }
  if (hasShortLease(input)) {
    warnings.push(`Short lease — resale value capped; lease extension adds cost and time`)
    score -= 20
  }
  if (input.bmvIndicators.isCashBuyersOnly) {
    warnings.push("Cash buyers only — limits your exit buyer pool (no mortgage buyers)")
    score -= 10
  }
  if (input.epcRating && ["F","G"].includes(input.epcRating.toUpperCase())) {
    warnings.push("EPC F/G — must improve to E before resale; factor into build cost")
  }

  score = Math.max(0, Math.min(100, score))
  return { viable: score >= 35, score, reasons, warnings }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeStrategyViability(input: StrategyViabilityInput): StrategyViabilityResult {
  return {
    btl:  checkBTL(input),
    brrr: checkBRRR(input),
    hmo:  checkHMO(input),
    flip: checkFlip(input),
  }
}

/**
 * Returns the best-scoring viable strategy names in descending order.
 * Used for the strategy badge strip on property cards.
 * Accepts either a full StrategyViabilityResult or the partial snapshot stored on listings.
 */
export function topStrategies(
  viability: Partial<StrategyViabilityResult>,
  maxCount = 3
): string[] {
  return (
    Object.entries(viability)
      .filter(([, r]) => r != null && r.viable)
      .sort(([, a], [, b]) => (b?.score ?? 0) - (a?.score ?? 0))
      .slice(0, maxCount)
      .map(([name]) => name.toUpperCase())  // "btl" → "BTL"
  )
}
