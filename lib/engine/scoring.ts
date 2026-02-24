/**
 * Institutional score: weighted combination of ReturnStrength, CapitalEfficiency, Risk, Liquidity.
 * Score = 0.4 × ReturnStrength + 0.25 × CapitalEfficiency + 0.2 × Risk + 0.15 × Liquidity.
 * Used by Capital Allocator to rank passing strategies.
 */

import type { UnderwritingInput, StrategyResult, StrategyKey } from "./types"

const WEIGHTS = {
  returnStrength: 0.4,
  capitalEfficiency: 0.25,
  risk: 0.2,
  liquidity: 0.15,
} as const

/**
 * Return strength: higher returns score higher (0–100).
 * BTL: cashOnCash; BRRR: inverse of capital left %; Flip: ROI; BuyHold: IRR.
 */
function returnStrength(s: StrategyResult, _input: UnderwritingInput): number {
  const m = s.metrics
  switch (s.strategy) {
    case "BTL":
      return Math.min(100, (m.cashOnCash ?? 0) * 5)
    case "BRRR":
      return Math.min(100, Math.max(0, 100 - (m.capitalLeftPercent ?? 0)))
    case "Flip":
      return Math.min(100, (m.roi ?? 0) * 2)
    case "BuyHold":
      return Math.min(100, (m.irr ?? 0) * 5)
    default:
      return 50
  }
}

/**
 * Capital efficiency: how little capital stays tied (0–100).
 * Lower capital at risk / higher leverage efficiency = higher score.
 */
function capitalEfficiency(s: StrategyResult, input: UnderwritingInput): number {
  const { ltv, marketValue } = input
  switch (s.strategy) {
    case "BRRR":
      return Math.min(100, Math.max(0, 100 - (s.metrics.capitalLeftPercent ?? 0)))
    case "BTL":
      return Math.min(100, ltv)
    case "Flip":
    case "BuyHold":
      return Math.min(100, 50 + ltv * 0.5)
    default:
      return 50
  }
}

/**
 * Risk: DSCR and discount buffer (0–100). Higher DSCR and discount = lower risk = higher score.
 */
function risk(s: StrategyResult, input: UnderwritingInput): number {
  const discount = input.marketValue > 0
    ? ((input.marketValue - input.askingPrice) / input.marketValue) * 100
    : 0
  const discountScore = Math.min(100, discount * 3)
  let dscrScore = 50
  const m = s.metrics
  if (m.dscr != null) dscrScore = Math.min(100, m.dscr * 40)
  if (m.postRefiDSCR != null) dscrScore = Math.min(100, m.postRefiDSCR * 40)
  return (discountScore + dscrScore) / 2
}

/**
 * Liquidity: Flip highest (quick exit), BuyHold lowest (0–100).
 */
function liquidity(s: StrategyResult, input: UnderwritingInput): number {
  const hold = input.holdPeriodYears
  switch (s.strategy) {
    case "Flip":
      return hold <= 1 ? 100 : Math.max(60, 100 - hold * 10)
    case "BRRR":
      return 80
    case "BTL":
      return 50
    case "BuyHold":
      return Math.max(0, 50 - hold * 5)
    default:
      return 50
  }
}

export interface InstitutionalScoreComponents {
  returnStrength: number
  capitalEfficiency: number
  risk: number
  liquidity: number
  institutionalScore: number
}

/**
 * Compute institutional score for a strategy result (0–100).
 */
export function computeInstitutionalScore(
  strategyResult: StrategyResult,
  input: UnderwritingInput
): InstitutionalScoreComponents {
  const rs = returnStrength(strategyResult, input)
  const ce = capitalEfficiency(strategyResult, input)
  const rk = risk(strategyResult, input)
  const liq = liquidity(strategyResult, input)
  const institutionalScore =
    WEIGHTS.returnStrength * rs +
    WEIGHTS.capitalEfficiency * ce +
    WEIGHTS.risk * rk +
    WEIGHTS.liquidity * liq
  return {
    returnStrength: Math.round(rs * 10) / 10,
    capitalEfficiency: Math.round(ce * 10) / 10,
    risk: Math.round(rk * 10) / 10,
    liquidity: Math.round(liq * 10) / 10,
    institutionalScore: Math.round(institutionalScore * 10) / 10,
  }
}
