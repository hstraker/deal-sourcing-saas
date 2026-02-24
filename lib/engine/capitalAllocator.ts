/**
 * Capital Allocator: run all strategies, filter passing, score, select best.
 * Final max offer = MIN(maxAllowableOffer) across passing strategies (conservative: use lowest ceiling).
 */

import type { UnderwritingInput, CapitalAllocationResult, StrategyKey } from "./types"
import { runBTL, runBRRR, runFlip, runBuyHold } from "./strategy"
import { computeInstitutionalScore } from "./scoring"

const STRATEGY_RUNNERS = {
  BTL: runBTL,
  BRRR: runBRRR,
  Flip: runFlip,
  BuyHold: runBuyHold,
} as const

/**
 * allocateCapital(input): run all strategy modules, filter to passing,
 * compute weighted institutional score, select highest-scoring strategy,
 * set finalMaxOffer = MIN(maxAllowableOffer) of passing strategies.
 */
export function allocateCapital(input: UnderwritingInput): CapitalAllocationResult {
  const strategies = (Object.keys(STRATEGY_RUNNERS) as StrategyKey[]).map((key) =>
    STRATEGY_RUNNERS[key](input)
  )

  const passing = strategies.filter((s) => s.pass)
  const withScores = passing.map((s) => ({
    result: s,
    institutional: computeInstitutionalScore(s, input),
  }))

  let recommendedStrategy: StrategyKey = "BTL"
  let institutionalScore = 0
  if (withScores.length > 0) {
    const best = withScores.reduce((a, b) =>
      a.institutional.institutionalScore >= b.institutional.institutionalScore ? a : b
    )
    recommendedStrategy = best.result.strategy
    institutionalScore = best.institutional.institutionalScore
  }

  const finalMaxOffer =
    passing.length > 0
      ? Math.min(...passing.map((s) => s.maxAllowableOffer))
      : 0

  return {
    recommendedStrategy,
    finalMaxOffer: Math.round(finalMaxOffer / 1000) * 1000,
    strategies,
    institutionalScore,
  }
}
