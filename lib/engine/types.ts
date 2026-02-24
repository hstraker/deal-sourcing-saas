/**
 * Underwriting engine types — unified input and output contracts.
 * No hardcoded financial assumptions; all thresholds come from input or config.
 */

// ─── Investor targets (per-strategy minimums/maximums) ─────────────────────

export interface BTLTargets {
  minCashOnCash: number
  minDSCR: number
}

export interface BRRRTargets {
  maxCapitalLeftPercent: number
  minDSCR: number
}

export interface FlipTargets {
  minROI: number
  minAnnualisedROI: number
}

export interface BuyHoldTargets {
  minIRR: number
}

export interface InvestorTargets {
  BTL: BTLTargets
  BRRR: BRRRTargets
  Flip: FlipTargets
  BuyHold: BuyHoldTargets
}

// ─── Unified underwriting input ─────────────────────────────────────────────

export interface UnderwritingInput {
  purchasePrice: number
  askingPrice: number
  marketValue: number
  refurbCost: number
  monthlyRent: number
  annualRentGrowth: number
  annualGrowthRate: number
  mortgageRate: number
  mortgageTermYears: number
  ltv: number
  refinanceLTV: number
  buyingCosts: number
  sellingCostsPercent: number
  annualOperatingCosts: number
  holdPeriodYears: number
  investorTargets: InvestorTargets
}

// ─── BMV screening output (Layer 1) ────────────────────────────────────────

export interface ScreeningResult {
  passesScreening: boolean
  discountPercent: number
  grossYield: number
  basicROI: number
  quickScore: number
}

// ─── Screening config (optional; allows configurable thresholds) ────────────

export interface ScreeningConfig {
  minDiscountPercent: number
  minGrossYieldPercent: number
}

// ─── Strategy result (Layer 3) ─────────────────────────────────────────────

export type StrategyKey = "BTL" | "BRRR" | "Flip" | "BuyHold"

export interface StrategyResult {
  strategy: StrategyKey
  metrics: Record<string, number>
  maxAllowableOffer: number
  pass: boolean
  score: number
}

// ─── Capital allocation output (Layer 4) ───────────────────────────────────

export interface CapitalAllocationResult {
  recommendedStrategy: StrategyKey
  finalMaxOffer: number
  strategies: StrategyResult[]
  institutionalScore: number
}

// ─── Unified underwriting response ───────────────────────────────────────────

export interface UnderwritingResponse {
  screening: ScreeningResult
  capitalAllocation: CapitalAllocationResult
  decisionSummary: string
}
