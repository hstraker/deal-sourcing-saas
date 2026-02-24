/**
 * Negotiation Ladder Generator
 *
 * Generates a structured sequence of tapering counter-offers anchored to the
 * goal-seek maximum purchase price ceiling. Each rung is derived mathematically
 * from that ceiling — the offer system never exceeds it.
 *
 * Algorithm:
 *   Opening  = ceiling × 0.88  (12% below ceiling)
 *   Counter1 = opening + (gap × 0.45)             — closes 45% of gap
 *   Counter2 = counter1 + (remainingGap × 0.40)   — closes 40% of remaining gap
 *   Best & Final = ceiling                         — absolute maximum
 *
 * All prices rounded to nearest £50.
 */

import {
  type OfferCalculationResult,
  type OfferEngineInputs,
  computeMetricsAtPrice,
} from "./property-offer-calculator"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface NegotiationRung {
  round: number                    // 0 = opening, 1 = counter 1, 2 = counter 2, 3 = best & final
  label: string                    // "Opening Offer" | "Counter 1" | "Counter 2" | "Best & Final"
  offerPrice: number               // rounded to nearest £50 (except best & final = exact ceiling)
  discountFromAsking: number       // £ amount below asking price
  discountPercent: number          // % below asking price
  discountFromCeiling: number      // £ amount below max purchase price ceiling
  ceilingPercent: number           // % of ceiling (e.g. 0.90 = 90% of ceiling)
  gapClosedPercent: number         // how much of gap between prev offer and ceiling is closed (0 for opening)
  profitAtThisPrice: number        // profit (flip) or annual cashflow (hold)
  returnAtThisPrice: number        // profitOnCost (flip) or roceMultiple (hold)
  returnLabel: string              // "Profit on Cost" | "ROCE Multiple"
  returnMeetsCriteria: boolean     // still above the target return at this price?
  headroomRemaining: number        // £ gap between this offer and the ceiling
  stepUpFromPrevious: number       // £ increase from previous rung (0 for opening)
  isAbsoluteMaximum: boolean       // true for final rung (at ceiling)
  negotiatingNote: string          // human-readable tactical note for this rung
  tooltip: string                  // short tooltip explaining why this price was chosen
}

export interface NegotiationLadder {
  strategy: "flip" | "hold"
  ceiling: number                  // goal-seek max purchase price
  askingPrice: number
  rungs: NegotiationRung[]         // ordered opening → best & final
  walkAwayPrice: number            // ceiling (never go above)
  totalConcession: number          // opening offer to ceiling difference
  taperedSteps: number[]           // the £ step sizes between each rung
  ladderRationale: string          // overall explanation of the ladder strategy
  isTaperingCorrectly: boolean     // validation: each step smaller than the last
}

export interface LadderConfig {
  openingBufferPercent?: number    // default 0.88
  maxRounds?: number               // default 3 (opening + 2 counters + best/final = 4 rungs)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function roundTo50(n: number): number {
  return Math.round(n / 50) * 50
}

function formatK(n: number): string {
  if (n >= 1000) return `£${(n / 1000).toFixed(1)}k`
  return `£${Math.round(n).toLocaleString()}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Single ladder generator
// ─────────────────────────────────────────────────────────────────────────────

export function generateNegotiationLadder(
  result: OfferCalculationResult,
  strategy: "flip" | "hold",
  config?: LadderConfig
): NegotiationLadder | null {
  const openingBuffer = config?.openingBufferPercent ?? 0.88

  const ceiling = strategy === "flip"
    ? result.flip.maxPurchasePrice
    : result.hold.maxPurchasePrice

  const askingPrice = result.inputs.askingPrice
  const flipCriteriaROI = result.inputs.flipCriteriaROI ?? 0.20
  const holdCriteriaROCEMultiple = result.inputs.holdCriteriaROCEMultiple ?? 2.5

  // Non-viable strategy
  if (!ceiling || ceiling <= 0) return null

  // ── Compute offer prices ──────────────────────────────────────────────────
  const opening = roundTo50(ceiling * openingBuffer)
  const gap = ceiling - opening

  const counter1Raw = opening + gap * 0.45
  const counter1 = Math.min(roundTo50(counter1Raw), ceiling - 50)

  const remainingGap1 = ceiling - counter1
  const counter2Raw = counter1 + remainingGap1 * 0.40
  const counter2 = Math.min(roundTo50(counter2Raw), ceiling - 1)

  const bestFinal = ceiling

  // ── Helper: compute return at a given price ───────────────────────────────
  const rawInputs: OfferEngineInputs = {
    askingPrice,
    gdv: result.inputs.gdv,
    estimatedRent: result.inputs.estimatedRent,
    totalRefurbishment: result.inputs.totalRefurbishment,
    bridgingLTV: result.inputs.bridgingLTV,
    bridgingArrangementFee: result.inputs.bridgingArrangementFee,
    bridgingInterestRateMonthly: result.inputs.bridgingInterestRateMonthly,
    bridgingMonths: result.inputs.bridgingMonths,
    bridgingExitFee: result.inputs.bridgingExitFee,
    bridgingLegalFees: result.inputs.bridgingLegalFees,
    bridgingValuationFees: result.inputs.bridgingValuationFees,
    solicitorFees: result.inputs.solicitorFees,
    searches: result.inputs.searches,
    buildingControl: result.inputs.buildingControl,
    contingencyPercent: result.inputs.contingencyPercent,
    utilityBillsMonthly: result.inputs.utilityBillsMonthly,
    councilTaxMonthly: result.inputs.councilTaxMonthly,
    furnishingCosts: result.inputs.furnishingCosts,
    mortgageLTV: result.inputs.mortgageLTV,
    mortgageRate: result.inputs.mortgageRate,
    mortgageArrangementFeePercent: result.inputs.mortgageArrangementFeePercent,
    mortgageBrokerFee: result.inputs.mortgageBrokerFee,
    rentalCoverageRequirement: result.inputs.rentalCoverageRequirement,
    managementPercent: result.inputs.managementPercent,
    maintenanceMonthly: result.inputs.maintenanceMonthly,
    buildingInsuranceMonthly: result.inputs.buildingInsuranceMonthly,
    voidsMonthsPerYear: result.inputs.voidsMonthsPerYear,
    flipCriteriaROI,
    holdCriteriaROCEMultiple,
  }

  const getReturnAtPrice = (price: number) => {
    const m = computeMetricsAtPrice(price, rawInputs)
    if (strategy === "flip") {
      return {
        returnValue: m.profitOnCost,
        profitValue: m.profit,
        meetsCriteria: m.profitOnCost >= flipCriteriaROI,
        returnLabel: "Profit on Cost",
      }
    } else {
      return {
        returnValue: m.roceMultiple,
        profitValue: m.netMonthlyCashflow * 12,
        meetsCriteria: m.roceMultiple >= holdCriteriaROCEMultiple,
        returnLabel: "ROCE Multiple",
      }
    }
  }

  // ── Build rungs ───────────────────────────────────────────────────────────
  const rungPrices = [opening, counter1, counter2, bestFinal]
  const steps = [
    0,
    counter1 - opening,
    counter2 - counter1,
    bestFinal - counter2,
  ]

  const rungLabels = ["Opening Offer", "Counter 1", "Counter 2", "Best & Final"]

  const rungs: NegotiationRung[] = rungPrices.map((price, i) => {
    const ret = getReturnAtPrice(price)
    const discountFromAsking = askingPrice - price
    const discountPercent = askingPrice > 0 ? discountFromAsking / askingPrice : 0
    const discountFromCeiling = ceiling - price
    const ceilingPercent = ceiling > 0 ? price / ceiling : 0
    const headroomRemaining = ceiling - price
    const stepUp = steps[i]
    const isAbsoluteMaximum = i === rungPrices.length - 1

    // Gap closed relative to previous rung
    let gapClosedPercent = 0
    if (i > 0) {
      const prevPrice = rungPrices[i - 1]
      const gapBefore = ceiling - prevPrice
      if (gapBefore > 0) {
        gapClosedPercent = stepUp / gapBefore
      }
    }

    // Negotiating note per round
    let negotiatingNote: string
    let tooltip: string

    if (i === 0) {
      negotiatingNote = `Open low to anchor the negotiation. This is ${formatK(gap)} below your ceiling — leaves you room for two meaningful moves while staying disciplined.`
      tooltip = `Opening at ${(ceilingPercent * 100).toFixed(0)}% of your ceiling. ${(discountPercent * 100).toFixed(1)}% below asking price.`
    } else if (i === 1) {
      negotiatingNote = `Move up by ${formatK(stepUp)} — a meaningful concession that shows good faith. You still have ${formatK(headroomRemaining)} of headroom before your limit.`
      tooltip = `Closes ${(gapClosedPercent * 100).toFixed(0)}% of the gap to ceiling. ${formatK(headroomRemaining)} headroom remains.`
    } else if (i === 2) {
      negotiatingNote = `Final substantive move. The smaller step (${formatK(stepUp)} vs ${formatK(steps[1])} previously) signals you are nearly at your limit. Only ${formatK(headroomRemaining)} remains.`
      tooltip = `Smaller step signals approaching limit. Only ${formatK(headroomRemaining)} of headroom left.`
    } else {
      negotiatingNote = `Best and final offer. You are at your mathematical maximum. Any higher and the deal fails your ${strategy} return criteria. Walk away if rejected.`
      tooltip = `This is your goal-seek ceiling — the mathematical limit for the ${strategy === "flip" ? "Flip" : "Hold"} strategy. Do not exceed this price.`
    }

    return {
      round: i,
      label: rungLabels[i],
      offerPrice: price,
      discountFromAsking,
      discountPercent,
      discountFromCeiling,
      ceilingPercent,
      gapClosedPercent,
      profitAtThisPrice: ret.profitValue,
      returnAtThisPrice: ret.returnValue,
      returnLabel: ret.returnLabel,
      returnMeetsCriteria: ret.meetsCriteria,
      headroomRemaining,
      stepUpFromPrevious: stepUp,
      isAbsoluteMaximum,
      negotiatingNote,
      tooltip,
    }
  })

  // ── Tapering validation ───────────────────────────────────────────────────
  const taperedSteps = steps.slice(1) // skip the 0 for opening
  const isTaperingCorrectly =
    taperedSteps.length >= 2
      ? taperedSteps[0] >= taperedSteps[1] && taperedSteps[1] >= taperedSteps[2]
      : true

  // ── Ladder rationale ─────────────────────────────────────────────────────
  const strategyLabel = strategy === "flip" ? "Flip" : "Hold / BRRR"
  const criteriaLabel = strategy === "flip"
    ? `${(flipCriteriaROI * 100).toFixed(0)}% profit on cost`
    : `${holdCriteriaROCEMultiple}x ROCE multiple`

  const ladderRationale =
    `${strategyLabel} strategy ladder anchored to goal-seek ceiling of ${formatK(ceiling)}. ` +
    `Minimum return criteria: ${criteriaLabel}. ` +
    `Opening at ${formatK(opening)} (${(openingBuffer * 100).toFixed(0)}% of ceiling), ` +
    `with tapering steps of ${taperedSteps.map(formatK).join(" → ")}. ` +
    `Total concession room: ${formatK(ceiling - opening)}.`

  return {
    strategy,
    ceiling,
    askingPrice,
    rungs,
    walkAwayPrice: ceiling,
    totalConcession: ceiling - opening,
    taperedSteps,
    ladderRationale,
    isTaperingCorrectly,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate both ladders for comparison
// ─────────────────────────────────────────────────────────────────────────────

export function generateBothLadders(
  result: OfferCalculationResult,
  config?: LadderConfig
): { flip: NegotiationLadder | null; hold: NegotiationLadder | null } {
  return {
    flip: result.flip.maxPurchasePrice > 0
      ? generateNegotiationLadder(result, "flip", config)
      : null,
    hold: result.hold.maxPurchasePrice > 0
      ? generateNegotiationLadder(result, "hold", config)
      : null,
  }
}
