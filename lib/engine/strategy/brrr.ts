/**
 * BRRR strategy: capital left in deal after refinance, post-refi DSCR.
 * Solve for max offer where capital left % = target (investor pulls out maximum).
 */

import type { UnderwritingInput, StrategyResult } from "../types"
import { calculateAmortisation, annualDebtService } from "../financial"

function evaluateBRRR(
  input: UnderwritingInput,
  purchasePrice: number
): { capitalLeftPercent: number; postRefiDSCR: number; pass: boolean } {
  const {
    marketValue,
    refurbCost,
    buyingCosts,
    refinanceLTV,
    monthlyRent,
    annualOperatingCosts,
    mortgageRate,
    mortgageTermYears,
    investorTargets,
  } = input

  const totalIn = purchasePrice + refurbCost + buyingCosts
  const refiProceeds = marketValue * (refinanceLTV / 100)
  const capitalLeft = totalIn - refiProceeds
  const capitalLeftPercent = totalIn > 0 ? (capitalLeft / totalIn) * 100 : 0

  const noi = monthlyRent * 12 - annualOperatingCosts
  const { monthlyPayment } = calculateAmortisation(refiProceeds, mortgageRate, mortgageTermYears)
  const ads = annualDebtService(monthlyPayment)
  const postRefiDSCR = ads > 0 ? noi / ads : 0

  const { maxCapitalLeftPercent, minDSCR } = investorTargets.BRRR
  const pass = capitalLeftPercent <= maxCapitalLeftPercent && postRefiDSCR >= minDSCR

  return { capitalLeftPercent, postRefiDSCR, pass }
}

/**
 * Max offer: refi proceeds must leave capital left % at target.
 * refiProceeds = marketValue * refinanceLTV/100.
 * capitalLeft = totalIn - refiProceeds = totalIn * (maxCapitalLeftPercent/100).
 * So totalIn = refiProceeds / (1 - maxCapitalLeftPercent/100).
 * purchasePrice = totalIn - refurbCost - buyingCosts.
 */
function solveMaxOfferBRRR(input: UnderwritingInput): number {
  const { marketValue, refurbCost, buyingCosts, refinanceLTV, investorTargets } = input
  const maxPct = investorTargets.BRRR.maxCapitalLeftPercent
  if (maxPct >= 100) return marketValue
  const refiProceeds = marketValue * (refinanceLTV / 100)
  const totalIn = refiProceeds / (1 - maxPct / 100)
  const offer = totalIn - refurbCost - buyingCosts
  return Math.max(0, Math.round(offer / 1000) * 1000)
}

export function runBRRR(input: UnderwritingInput): StrategyResult {
  const purchasePrice = input.purchasePrice
  const { capitalLeftPercent, postRefiDSCR, pass } = evaluateBRRR(input, purchasePrice)
  const maxAllowableOffer = solveMaxOfferBRRR(input)
  const { maxCapitalLeftPercent, minDSCR } = input.investorTargets.BRRR
  const scoreLeft = maxCapitalLeftPercent >= 0
    ? Math.max(0, 100 - (capitalLeftPercent / Math.max(maxCapitalLeftPercent, 0.01)) * 50)
    : 50
  const scoreDscr = minDSCR > 0 ? Math.min(100, (postRefiDSCR / minDSCR) * 50) : 50
  const score = Math.round(Math.min(100, scoreLeft + scoreDscr) * 10) / 10

  return {
    strategy: "BRRR",
    metrics: {
      capitalLeftPercent: Math.round(capitalLeftPercent * 100) / 100,
      postRefiDSCR: Math.round(postRefiDSCR * 100) / 100,
    },
    maxAllowableOffer,
    pass,
    score,
  }
}
