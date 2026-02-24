/**
 * BuyHold strategy: 5-year (or hold period) IRR; solve for max offer where IRR = target.
 */

import type { UnderwritingInput, StrategyResult } from "../types"
import { projectCashflows } from "../financial/cashflowProjection"
import { calculateIRRPercent } from "../financial/irr"

const BINARY_TOL = 500
const BINARY_ITER = 60

function getIRR(input: UnderwritingInput, purchasePrice: number): number | null {
  const modified: UnderwritingInput = { ...input, purchasePrice }
  const { yearly, terminalValue } = projectCashflows(modified)
  const { buyingCosts, refurbCost, sellingCostsPercent } = input
  const outflow = -(purchasePrice + refurbCost + buyingCosts)
  const cashflows = [outflow]
  for (const y of yearly) {
    cashflows.push(y.netRent)
  }
  cashflows.push(terminalValue * (1 - sellingCostsPercent / 100))
  return calculateIRRPercent(cashflows)
}

function evaluateBuyHold(
  input: UnderwritingInput,
  purchasePrice: number
): { irr: number; pass: boolean } {
  const irrPct = getIRR(input, purchasePrice)
  const irr = irrPct ?? 0
  const minIRR = input.investorTargets.BuyHold.minIRR
  const pass = irr >= minIRR
  return { irr, pass }
}

/**
 * Binary search: higher price => lower IRR. Find max price where IRR >= minIRR.
 */
function solveMaxOfferBuyHold(input: UnderwritingInput): number {
  const { marketValue, refurbCost, buyingCosts } = input
  let low = 0
  let high = marketValue * 1.5
  for (let i = 0; i < BINARY_ITER; i++) {
    const mid = (low + high) / 2
    const { pass } = evaluateBuyHold(input, mid)
    if (pass) low = mid
    else high = mid
    if (high - low < BINARY_TOL) break
  }
  return Math.max(0, Math.round(low / 1000) * 1000)
}

export function runBuyHold(input: UnderwritingInput): StrategyResult {
  const purchasePrice = input.purchasePrice
  const { irr, pass } = evaluateBuyHold(input, purchasePrice)
  const maxAllowableOffer = solveMaxOfferBuyHold(input)
  const minIRR = input.investorTargets.BuyHold.minIRR
  const score = minIRR > 0 ? Math.round(Math.min(100, (irr / minIRR) * 100) * 10) / 10 : 0

  return {
    strategy: "BuyHold",
    metrics: {
      irr: Math.round(irr * 100) / 100,
    },
    maxAllowableOffer,
    pass,
    score,
  }
}
