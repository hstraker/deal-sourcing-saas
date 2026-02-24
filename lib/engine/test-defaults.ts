/**
 * Test defaults for building UnderwritingInput in the test workflow UI.
 * Used when running the Capital Allocator from settings without full deal data.
 */

import type { InvestorTargets, UnderwritingInput } from "./types"

export const DEFAULT_TEST_INVESTOR_TARGETS: InvestorTargets = {
  BTL: { minCashOnCash: 8, minDSCR: 1.25 },
  BRRR: { maxCapitalLeftPercent: 0, minDSCR: 1.25 },
  Flip: { minROI: 20, minAnnualisedROI: 10 },
  BuyHold: { minIRR: 12 },
}

export const DEFAULT_TEST_FINANCIAL = {
  annualRentGrowth: 3,
  annualGrowthRate: 3,
  mortgageRate: 5,
  mortgageTermYears: 25,
  ltv: 75,
  refinanceLTV: 75,
  buyingCostsPercent: 3,
  sellingCostsPercent: 2,
  holdPeriodYears: 5,
}

/**
 * Build UnderwritingInput from core deal numbers + test defaults.
 */
export function buildTestUnderwritingInput(partial: {
  purchasePrice: number
  askingPrice: number
  marketValue: number
  refurbCost: number
  monthlyRent: number
}): UnderwritingInput {
  const annualRent = partial.monthlyRent * 12
  const annualOperatingCosts = annualRent * 0.15
  const buyingCosts = partial.askingPrice * (DEFAULT_TEST_FINANCIAL.buyingCostsPercent / 100)

  return {
    purchasePrice: partial.purchasePrice,
    askingPrice: partial.askingPrice,
    marketValue: partial.marketValue,
    refurbCost: partial.refurbCost,
    monthlyRent: partial.monthlyRent,
    annualRentGrowth: DEFAULT_TEST_FINANCIAL.annualRentGrowth,
    annualGrowthRate: DEFAULT_TEST_FINANCIAL.annualGrowthRate,
    mortgageRate: DEFAULT_TEST_FINANCIAL.mortgageRate,
    mortgageTermYears: DEFAULT_TEST_FINANCIAL.mortgageTermYears,
    ltv: DEFAULT_TEST_FINANCIAL.ltv,
    refinanceLTV: DEFAULT_TEST_FINANCIAL.refinanceLTV,
    buyingCosts,
    sellingCostsPercent: DEFAULT_TEST_FINANCIAL.sellingCostsPercent,
    annualOperatingCosts,
    holdPeriodYears: DEFAULT_TEST_FINANCIAL.holdPeriodYears,
    investorTargets: DEFAULT_TEST_INVESTOR_TARGETS,
  }
}
