/**
 * Dual-layer underwriting engine: BMV screening + Capital Allocator.
 * Single entry point: runUnderwriting(input) => screening, capitalAllocation, decisionSummary.
 */

import type { UnderwritingInput, UnderwritingResponse, ScreeningConfig } from "./types"
import { runBmvScreening } from "./bmv/bmvCalculator"
import { allocateCapital } from "./capitalAllocator"

/**
 * Run full underwriting: Layer 1 (screening) then Layer 4 (capital allocation).
 * Returns unified response with screening, capitalAllocation, and a short decisionSummary.
 */
export function runUnderwriting(
  input: UnderwritingInput,
  screeningConfig?: Partial<ScreeningConfig>
): UnderwritingResponse {
  const screening = runBmvScreening(input, screeningConfig)
  const capitalAllocation = allocateCapital(input)

  const summaryParts: string[] = []
  summaryParts.push(
    screening.passesScreening ? "Passes screening." : "Fails screening."
  )
  summaryParts.push(
    `Recommended strategy: ${capitalAllocation.recommendedStrategy}.`
  )
  summaryParts.push(
    `Final max offer: £${capitalAllocation.finalMaxOffer.toLocaleString("en-GB")}.`
  )
  const decisionSummary = summaryParts.join(" ")

  return {
    screening,
    capitalAllocation,
    decisionSummary,
  }
}

// Re-export public API
export type {
  UnderwritingInput,
  UnderwritingResponse,
  ScreeningResult,
  ScreeningConfig,
  CapitalAllocationResult,
  StrategyResult,
  StrategyKey,
  InvestorTargets,
} from "./types"
export { runBmvScreening } from "./bmv/bmvCalculator"
export { allocateCapital } from "./capitalAllocator"
export { computeInstitutionalScore } from "./scoring"
export type { InstitutionalScoreComponents } from "./scoring"
export { runBTL, runBRRR, runFlip, runBuyHold } from "./strategy"
export {
  calculateAmortisation,
  annualDebtService,
  calculateIRR,
  calculateIRRPercent,
  projectCashflows,
} from "./financial"
