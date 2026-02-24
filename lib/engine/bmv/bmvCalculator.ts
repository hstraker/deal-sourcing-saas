/**
 * BMV Screening Engine — fast deal assessment (no IRR).
 * Computes discount %, gross yield, basic ROI; pass/fail and quickScore.
 * Screening criteria (e.g. discount ≥ 15%, gross yield ≥ 8%) come from config.
 */

import type { ScreeningResult, ScreeningConfig, UnderwritingInput } from "../types"

const DEFAULT_SCREENING: ScreeningConfig = {
  minDiscountPercent: 15,
  minGrossYieldPercent: 8,
}

/**
 * Run BMV screening only. Fast and simple; no IRR or full underwriting.
 */
export function runBmvScreening(
  input: Pick<UnderwritingInput, "askingPrice" | "marketValue" | "monthlyRent" | "refurbCost">,
  config: Partial<ScreeningConfig> = {}
): ScreeningResult {
  const { minDiscountPercent, minGrossYieldPercent } = { ...DEFAULT_SCREENING, ...config }
  const { askingPrice, marketValue, monthlyRent, refurbCost } = input

  const discountPercent =
    marketValue > 0 ? ((marketValue - askingPrice) / marketValue) * 100 : 0

  const annualRent = monthlyRent * 12
  const grossYield =
    askingPrice > 0 && annualRent > 0 ? (annualRent / askingPrice) * 100 : 0

  const totalInvestment = askingPrice + refurbCost
  const basicROI =
    totalInvestment > 0 && annualRent > 0
      ? ((annualRent * 0.85) / totalInvestment) * 100
      : 0

  const passesScreening =
    discountPercent >= minDiscountPercent && grossYield >= minGrossYieldPercent

  const quickScore = Math.min(
    100,
    Math.max(
      0,
      (discountPercent / 40) * 50 + (grossYield / 15) * 50
    )
  )

  return {
    passesScreening,
    discountPercent: Math.round(discountPercent * 100) / 100,
    grossYield: Math.round(grossYield * 100) / 100,
    basicROI: Math.round(basicROI * 100) / 100,
    quickScore: Math.round(quickScore * 10) / 10,
  }
}
