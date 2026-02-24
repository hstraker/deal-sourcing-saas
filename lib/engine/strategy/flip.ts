/**
 * Flip strategy: ROI and annualised ROI; solve for max offer where ROI = target.
 */

import type { UnderwritingInput, StrategyResult } from "../types"

function evaluateFlip(
  input: UnderwritingInput,
  purchasePrice: number
): { roi: number; annualisedROI: number; pass: boolean } {
  const { marketValue, refurbCost, buyingCosts, sellingCostsPercent, holdPeriodYears, investorTargets } = input
  const totalCost = purchasePrice + refurbCost + buyingCosts
  const saleProceeds = marketValue * (1 - sellingCostsPercent / 100)
  const profit = saleProceeds - totalCost
  const roi = totalCost > 0 ? (profit / totalCost) * 100 : 0
  const annualisedROI =
    holdPeriodYears > 0 && totalCost > 0
      ? (Math.pow(1 + profit / totalCost, 1 / holdPeriodYears) - 1) * 100
      : 0

  const { minROI, minAnnualisedROI } = investorTargets.Flip
  const pass = roi >= minROI && annualisedROI >= minAnnualisedROI

  return { roi, annualisedROI, pass }
}

/**
 * Max offer: profit / totalCost = minROI/100 => totalCost = saleProceeds / (1 + minROI/100).
 */
function solveMaxOfferFlip(input: UnderwritingInput): number {
  const { marketValue, refurbCost, buyingCosts, sellingCostsPercent, investorTargets } = input
  const saleProceeds = marketValue * (1 - sellingCostsPercent / 100)
  const minROI = investorTargets.Flip.minROI / 100
  const totalCost = saleProceeds / (1 + minROI)
  const offer = totalCost - refurbCost - buyingCosts
  return Math.max(0, Math.round(offer / 1000) * 1000)
}

export function runFlip(input: UnderwritingInput): StrategyResult {
  const purchasePrice = input.purchasePrice
  const { roi, annualisedROI, pass } = evaluateFlip(input, purchasePrice)
  const maxAllowableOffer = solveMaxOfferFlip(input)
  const { minROI, minAnnualisedROI } = input.investorTargets.Flip
  const scoreRoi = minROI > 0 ? Math.min(100, (roi / minROI) * 50) : 50
  const scoreAnn = minAnnualisedROI > 0 ? Math.min(100, (annualisedROI / minAnnualisedROI) * 50) : 50
  const score = Math.round(Math.min(100, scoreRoi + scoreAnn) * 10) / 10

  return {
    strategy: "Flip",
    metrics: {
      roi: Math.round(roi * 100) / 100,
      annualisedROI: Math.round(annualisedROI * 100) / 100,
    },
    maxAllowableOffer,
    pass,
    score,
  }
}
