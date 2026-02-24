/**
 * Multi-year cashflow projection with rent and value growth.
 * Used by all strategies. Pure, deterministic.
 */

import type { UnderwritingInput } from "../types"

export interface YearlyCashflow {
  year: number
  rent: number
  operatingCosts: number
  netRent: number
  propertyValue: number
}

export interface CashflowProjectionResult {
  yearly: YearlyCashflow[]
  totalNetRent: number
  /** Terminal property value at end of hold (after growth) */
  terminalValue: number
}

/**
 * Project cashflows over hold period.
 * Rent grows at annualRentGrowth (%), property value at annualGrowthRate (%).
 * Operating costs from input (annualOperatingCosts) or derived from rent if needed.
 */
export function projectCashflows(input: UnderwritingInput): CashflowProjectionResult {
  const {
    purchasePrice,
    refurbCost,
    monthlyRent,
    annualRentGrowth,
    annualGrowthRate,
    annualOperatingCosts,
    holdPeriodYears,
    marketValue,
  } = input

  const yearly: YearlyCashflow[] = []
  const growthRent = 1 + annualRentGrowth / 100
  const growthValue = 1 + annualGrowthRate / 100

  // Year 0: acquisition; we use purchase + refurb as initial "value" for growth
  const initialValue = purchasePrice + refurbCost
  let rent = monthlyRent * 12
  let totalNetRent = 0

  for (let y = 1; y <= holdPeriodYears; y++) {
    const propertyValue = initialValue * Math.pow(growthValue, y)
    const operatingCosts = annualOperatingCosts >= 0 ? annualOperatingCosts : rent * 0.15
    const netRent = rent - operatingCosts
    totalNetRent += netRent
    yearly.push({
      year: y,
      rent,
      operatingCosts,
      netRent,
      propertyValue,
    })
    rent = rent * growthRent
  }

  const terminalValue = initialValue * Math.pow(growthValue, holdPeriodYears)

  return {
    yearly,
    totalNetRent,
    terminalValue,
  }
}
