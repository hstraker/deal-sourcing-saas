/**
 * BTL strategy: NOI, DSCR, Cash-on-Cash; solve for max offer where CoC and DSCR meet targets.
 */

import type { UnderwritingInput, StrategyResult } from "../types"
import { calculateAmortisation, annualDebtService } from "../financial"

const BINARY_TOL = 100
const BINARY_ITER = 50

function evaluateBTL(
  input: UnderwritingInput,
  purchasePrice: number
): { noi: number; dscr: number; cashOnCash: number; pass: boolean } {
  const {
    monthlyRent,
    annualOperatingCosts,
    mortgageRate,
    mortgageTermYears,
    ltv,
    buyingCosts,
    refurbCost,
    investorTargets,
  } = input
  const annualRent = monthlyRent * 12
  const noi = annualRent - annualOperatingCosts

  const loanAmount = purchasePrice * (ltv / 100)
  const { monthlyPayment } = calculateAmortisation(loanAmount, mortgageRate, mortgageTermYears)
  const ads = annualDebtService(monthlyPayment)

  const dscr = ads > 0 ? noi / ads : 0
  const totalCash = purchasePrice - loanAmount + buyingCosts + refurbCost
  const annualCashFlow = noi - ads
  const cashOnCash = totalCash > 0 ? (annualCashFlow / totalCash) * 100 : 0

  const { minDSCR, minCashOnCash } = investorTargets.BTL
  const pass = dscr >= minDSCR && cashOnCash >= minCashOnCash

  return { noi, dscr, cashOnCash, pass }
}

/**
 * Solve for maximum purchase price such that BTL targets are still met.
 */
function solveMaxOfferBTL(input: UnderwritingInput): number {
  const { marketValue, refurbCost, buyingCosts } = input
  let low = 0
  let high = marketValue * 1.2
  for (let i = 0; i < BINARY_ITER; i++) {
    const mid = (low + high) / 2
    const modified = { ...input, purchasePrice: mid }
    const { pass } = evaluateBTL(modified, mid)
    if (pass) low = mid
    else high = mid
    if (high - low < BINARY_TOL) break
  }
  return Math.max(0, Math.round(low / 1000) * 1000)
}

/**
 * Run BTL strategy: metrics at current price, pass/fail, max allowable offer, score.
 */
export function runBTL(input: UnderwritingInput): StrategyResult {
  const purchasePrice = input.purchasePrice
  const { noi, dscr, cashOnCash, pass } = evaluateBTL(input, purchasePrice)
  const maxAllowableOffer = solveMaxOfferBTL(input)
  const { minDSCR, minCashOnCash } = input.investorTargets.BTL
  const scoreDscr = minDSCR > 0 ? Math.min(100, (dscr / minDSCR) * 50) : 50
  const scoreCoc = minCashOnCash > 0 ? Math.min(100, (cashOnCash / minCashOnCash) * 50) : 50
  const score = Math.round(Math.min(100, scoreDscr + scoreCoc) * 10) / 10

  return {
    strategy: "BTL",
    metrics: {
      noi: Math.round(noi * 100) / 100,
      dscr: Math.round(dscr * 100) / 100,
      cashOnCash: Math.round(cashOnCash * 100) / 100,
    },
    maxAllowableOffer,
    pass,
    score,
  }
}
