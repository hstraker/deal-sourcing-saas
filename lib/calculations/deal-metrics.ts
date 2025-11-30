/**
 * Deal Metrics Calculation Utilities
 *
 * Calculates BMV%, Yield, Deal Score, and other metrics automatically
 */

import { calculateDealScore, type DealScoringInput } from "@/lib/deal-scoring"

export interface DealCalculationInput extends DealScoringInput {}

export interface DealMetrics {
  bmvPercentage: number | null
  grossYield: number | null
  netYield: number | null
  roi: number | null
  roce: number | null
  dealScore: number | null
  dealScoreBreakdown: ReturnType<typeof calculateDealScore>["breakdown"] | null
  packTier: "basic" | "standard" | "premium" | null
  packPrice: number | null
  // New financial metrics
  stampDuty: number | null
  legalFees: number | null
  surveyCost: number | null
  totalAcquisitionCost: number | null
  monthlyCashFlow: number | null
  annualCashFlow: number | null
  cashOnCashReturn: number | null
  equityGain: number | null
  paybackPeriod: number | null // in years
  // Additional property metrics
  capRate: number | null // Capitalization Rate
  grm: number | null // Gross Rent Multiplier
  // Mortgage metrics (25% deposit, BTL)
  mortgageDeposit: number | null // 25% of asking price
  mortgageLoanAmount: number | null // 75% of asking price
  monthlyMortgagePayment: number | null // Calculated mortgage payment
  totalCashRequired: number | null // Deposit + stamp duty + legal + survey + refurb
  netMonthlyCashFlowMortgaged: number | null // After mortgage payment
  netAnnualCashFlowMortgaged: number | null // After mortgage payment
  cashOnCashReturnMortgaged: number | null // Based on actual cash invested
  debtCoverageRatio: number | null // DCR = Rent / Mortgage Payment
}

/**
 * Calculate BMV (Below Market Value) Percentage
 * BMV% = ((Market Value - Asking Price) / Market Value) * 100
 */
export function calculateBMVPercentage(
  askingPrice: number,
  marketValue: number | null | undefined
): number | null {
  if (!marketValue || marketValue <= 0) return null
  
  const bmv = ((marketValue - askingPrice) / marketValue) * 100
  return Math.round(bmv * 100) / 100 // Round to 2 decimal places
}

/**
 * Calculate Gross Yield
 * Gross Yield% = (Annual Rent / Purchase Price) * 100
 * Assumes 12 months rental
 */
export function calculateGrossYield(
  askingPrice: number,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  const annualRent = estimatedMonthlyRent * 12
  const yieldPercent = (annualRent / askingPrice) * 100
  return Math.round(yieldPercent * 100) / 100
}

/**
 * Calculate Net Yield
 * Net Yield% = ((Annual Rent - Annual Costs) / Purchase Price) * 100
 * Annual Costs = Insurance + Management + Maintenance + Void periods (estimated at 15% of rent)
 */
export function calculateNetYield(
  askingPrice: number,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  const annualRent = estimatedMonthlyRent * 12
  // Estimate costs at ~15% of annual rent (insurance, management, maintenance, void)
  const annualCosts = annualRent * 0.15
  const netAnnual = annualRent - annualCosts
  const netYield = (netAnnual / askingPrice) * 100
  
  return Math.round(netYield * 100) / 100
}

/**
 * Calculate ROI (Return on Investment)
 * ROI% = (Annual Net Income / Total Investment) * 100
 * Where:
 * - Total Investment = Asking Price + Refurb Costs
 * - Annual Net Income = Annual Rent - Annual Costs (15% for management, insurance, maintenance, voids)
 */
export function calculateROI(
  askingPrice: number,
  estimatedRefurbCost: number | null | undefined,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  const totalInvestment = askingPrice + (estimatedRefurbCost || 0)
  const annualRent = estimatedMonthlyRent * 12
  const annualCosts = annualRent * 0.15 // 15% for costs (management, insurance, maintenance, voids)
  const annualNetIncome = annualRent - annualCosts
  const roi = (annualNetIncome / totalInvestment) * 100
  
  return Math.round(roi * 100) / 100
}

/**
 * Calculate ROCE (Return on Capital Employed)
 * ROCE% = (Annual Profit / Capital Employed) * 100
 */
export function calculateROCE(
  askingPrice: number,
  estimatedRefurbCost: number | null | undefined,
  afterRefurbValue: number | null | undefined,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  if (!afterRefurbValue || afterRefurbValue <= 0) return null
  
  const capitalEmployed = askingPrice + (estimatedRefurbCost || 0)
  const annualRent = estimatedMonthlyRent * 12
  const annualCosts = annualRent * 0.15
  const annualProfit = annualRent - annualCosts
  const roce = (annualProfit / capitalEmployed) * 100
  
  return Math.round(roce * 100) / 100
}

/**
 * Determine Pack Tier based on Deal Score
 */
export function determinePackTier(dealScore: number | null): "basic" | "standard" | "premium" | null {
  if (dealScore === null) return null
  
  if (dealScore >= 90) return "premium"
  if (dealScore >= 80) return "standard"
  if (dealScore >= 70) return "basic"
  return "basic"
}

/**
 * Determine Pack Price based on Pack Tier
 */
export function determinePackPrice(tier: "basic" | "standard" | "premium" | null): number | null {
  if (!tier) return null
  
  const prices = {
    basic: 2500,
    standard: 3500,
    premium: 5000,
  }
  
  return prices[tier]
}

/**
 * Calculate UK Stamp Duty Land Tax (SDLT)
 * Rates for buy-to-let/second homes (3% surcharge applies):
 * - 0-£250k: 3%
 * - £250k-£925k: 8%
 * - £925k-£1.5m: 13%
 * - £1.5m+: 15%
 */
export function calculateStampDuty(purchasePrice: number): number {
  if (purchasePrice <= 0) return 0
  
  let stampDuty = 0
  const remaining = purchasePrice
  
  // BTL/second home rates (3% surcharge)
  if (remaining > 1500000) {
    stampDuty += (remaining - 1500000) * 0.15
    stampDuty += (1500000 - 925000) * 0.13
    stampDuty += (925000 - 250000) * 0.08
    stampDuty += 250000 * 0.03
  } else if (remaining > 925000) {
    stampDuty += (remaining - 925000) * 0.13
    stampDuty += (925000 - 250000) * 0.08
    stampDuty += 250000 * 0.03
  } else if (remaining > 250000) {
    stampDuty += (remaining - 250000) * 0.08
    stampDuty += 250000 * 0.03
  } else {
    stampDuty += remaining * 0.03
  }
  
  return Math.round(stampDuty)
}

/**
 * Calculate Legal Fees (solicitor/conveyancing)
 * Typically 1.5% of purchase price or minimum £800
 */
export function calculateLegalFees(purchasePrice: number): number {
  if (purchasePrice <= 0) return 0
  
  const percentage = purchasePrice * 0.015
  const minimum = 800
  
  return Math.round(Math.max(percentage, minimum))
}

/**
 * Estimate Survey Costs
 * Typically £500-£1500, we'll use £1000 as average
 */
export function calculateSurveyCost(): number {
  return 1000
}

/**
 * Calculate Total Acquisition Cost
 * Purchase Price + Stamp Duty + Legal Fees + Survey + Refurb Costs
 */
export function calculateTotalAcquisitionCost(
  askingPrice: number,
  estimatedRefurbCost: number | null | undefined
): number {
  const stampDuty = calculateStampDuty(askingPrice)
  const legalFees = calculateLegalFees(askingPrice)
  const surveyCost = calculateSurveyCost()
  const refurbCost = estimatedRefurbCost || 0
  
  return askingPrice + stampDuty + legalFees + surveyCost + refurbCost
}

/**
 * Calculate Monthly Cash Flow
 * Monthly Rent - Monthly Costs
 * Costs include: Management (10%), Insurance (estimated), Maintenance reserve (estimated)
 * Assumes 15% of rent goes to costs (same as net yield calculation)
 */
export function calculateMonthlyCashFlow(
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  // Monthly costs are 15% of rent (management, insurance, maintenance, void periods)
  const monthlyCosts = estimatedMonthlyRent * 0.15
  const monthlyCashFlow = estimatedMonthlyRent - monthlyCosts
  
  return Math.round(monthlyCashFlow * 100) / 100
}

/**
 * Calculate Annual Cash Flow
 * 12 × Monthly Cash Flow
 */
export function calculateAnnualCashFlow(
  monthlyCashFlow: number | null
): number | null {
  if (monthlyCashFlow === null) return null
  
  return Math.round(monthlyCashFlow * 12 * 100) / 100
}

/**
 * Calculate Cash-on-Cash Return
 * Cash-on-Cash Return% = (Annual Cash Flow / Total Cash Invested) × 100
 * This is one of the most important metrics for investors - shows actual cash return
 */
export function calculateCashOnCashReturn(
  annualCashFlow: number | null,
  totalAcquisitionCost: number
): number | null {
  if (annualCashFlow === null || totalAcquisitionCost <= 0) return null
  
  const cocReturn = (annualCashFlow / totalAcquisitionCost) * 100
  return Math.round(cocReturn * 100) / 100
}

/**
 * Calculate Equity Gain from Refurbishment
 * Equity Gain = After Refurb Value - Total Acquisition Cost
 * Shows how much equity/value is created through the refurb
 */
export function calculateEquityGain(
  afterRefurbValue: number | null | undefined,
  totalAcquisitionCost: number
): number | null {
  if (!afterRefurbValue || afterRefurbValue <= 0) return null
  
  const equityGain = afterRefurbValue - totalAcquisitionCost
  return Math.round(equityGain * 100) / 100
}

/**
 * Calculate Payback Period
 * Payback Period (years) = Total Acquisition Cost / Annual Cash Flow
 * Shows how many years to recoup the initial investment
 */
export function calculatePaybackPeriod(
  totalAcquisitionCost: number,
  annualCashFlow: number | null
): number | null {
  if (annualCashFlow === null || annualCashFlow <= 0) return null
  
  const paybackYears = totalAcquisitionCost / annualCashFlow
  return Math.round(paybackYears * 100) / 100
}

/**
 * Calculate Cap Rate (Capitalization Rate)
 * Cap Rate% = (Net Operating Income / Property Value) * 100
 * Where NOI = Annual Rent - Operating Expenses
 * 
 * Cap rate measures the return on a real estate investment property based on the income
 * the property is expected to generate. Uses market value rather than purchase price.
 */
export function calculateCapRate(
  marketValue: number | null | undefined,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!marketValue || marketValue <= 0) return null
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  const annualRent = estimatedMonthlyRent * 12
  const operatingExpenses = annualRent * 0.15 // 15% for costs (management, insurance, maintenance, voids)
  const netOperatingIncome = annualRent - operatingExpenses
  const capRate = (netOperatingIncome / marketValue) * 100
  
  return Math.round(capRate * 100) / 100
}

/**
 * Calculate GRM (Gross Rent Multiplier)
 * GRM = Purchase Price / Annual Gross Rent
 * 
 * GRM is a screening metric used by investors to compare rental property opportunities.
 * A lower GRM generally indicates a better investment opportunity.
 * Industry standard: GRM of 4-7 is good for BTL properties.
 */
export function calculateGRM(
  askingPrice: number,
  estimatedMonthlyRent: number | null | undefined
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  
  const annualGrossRent = estimatedMonthlyRent * 12
  const grm = askingPrice / annualGrossRent
  
  return Math.round(grm * 100) / 100
}

/**
 * Calculate Mortgage Deposit (25% for BTL)
 * Standard UK BTL mortgage requires 25% deposit
 */
export function calculateMortgageDeposit(askingPrice: number): number {
  return Math.round(askingPrice * 0.25 * 100) / 100
}

/**
 * Calculate Mortgage Loan Amount (75% of purchase price)
 */
export function calculateMortgageLoanAmount(askingPrice: number): number {
  return Math.round(askingPrice * 0.75 * 100) / 100
}

/**
 * Calculate Monthly Mortgage Payment
 * Using standard BTL interest rate (typically 4.5% for BTL)
 * Interest-only mortgage calculation: (Loan Amount × Annual Rate) / 12
 * Or repayment: Using standard amortization formula
 * 
 * For BTL properties, interest-only mortgages are common.
 * We'll calculate both but default to interest-only for cash flow analysis.
 */
export function calculateMonthlyMortgagePayment(
  loanAmount: number,
  interestRate: number = 4.5, // Default 4.5% BTL rate
  termYears: number = 25 // 25 year term
): number {
  // Calculate repayment mortgage (principal + interest)
  const monthlyRate = interestRate / 100 / 12
  const numberOfPayments = termYears * 12
  
  if (monthlyRate === 0) {
    // If 0% interest (unlikely), just divide by payments
    return loanAmount / numberOfPayments
  }
  
  // Standard amortization formula for repayment mortgage
  const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) /
    (Math.pow(1 + monthlyRate, numberOfPayments) - 1)
  
  return Math.round(monthlyPayment * 100) / 100
}

/**
 * Calculate Total Cash Required for Purchase with Mortgage
 * Deposit (25%) + Stamp Duty + Legal Fees + Survey + Refurb
 */
export function calculateTotalCashRequired(
  askingPrice: number,
  estimatedRefurbCost: number | null | undefined
): number {
  const deposit = calculateMortgageDeposit(askingPrice)
  const stampDuty = calculateStampDuty(askingPrice)
  const legalFees = calculateLegalFees(askingPrice)
  const surveyCost = calculateSurveyCost()
  const refurbCost = estimatedRefurbCost || 0
  
  return deposit + stampDuty + legalFees + surveyCost + refurbCost
}

/**
 * Calculate Net Monthly Cash Flow (Mortgaged)
 * Monthly Rent - Operating Costs - Mortgage Payment
 */
export function calculateNetMonthlyCashFlowMortgaged(
  estimatedMonthlyRent: number | null | undefined,
  monthlyMortgagePayment: number | null
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  if (monthlyMortgagePayment === null) return null
  
  // Operating costs (15% of rent)
  const monthlyOperatingCosts = estimatedMonthlyRent * 0.15
  const netCashFlow = estimatedMonthlyRent - monthlyOperatingCosts - monthlyMortgagePayment
  
  return Math.round(netCashFlow * 100) / 100
}

/**
 * Calculate Net Annual Cash Flow (Mortgaged)
 */
export function calculateNetAnnualCashFlowMortgaged(
  netMonthlyCashFlow: number | null
): number | null {
  if (netMonthlyCashFlow === null) return null
  return Math.round(netMonthlyCashFlow * 12 * 100) / 100
}

/**
 * Calculate Cash-on-Cash Return (Mortgaged)
 * Based on actual cash invested (deposit + fees), not total property value
 */
export function calculateCashOnCashReturnMortgaged(
  annualCashFlow: number | null,
  totalCashRequired: number
): number | null {
  if (annualCashFlow === null || totalCashRequired <= 0) return null
  
  const cocReturn = (annualCashFlow / totalCashRequired) * 100
  return Math.round(cocReturn * 100) / 100
}

/**
 * Calculate Debt Coverage Ratio (DCR)
 * DCR = Net Operating Income / Annual Debt Service
 * A DCR > 1.0 means the property generates enough income to cover the mortgage
 * Industry standard: DCR > 1.25 is preferred (25% buffer)
 */
export function calculateDebtCoverageRatio(
  estimatedMonthlyRent: number | null | undefined,
  monthlyMortgagePayment: number | null
): number | null {
  if (!estimatedMonthlyRent || estimatedMonthlyRent <= 0) return null
  if (monthlyMortgagePayment === null || monthlyMortgagePayment <= 0) return null
  
  // Net Operating Income = Annual Rent - Operating Costs
  const annualRent = estimatedMonthlyRent * 12
  const operatingExpenses = annualRent * 0.15 // 15% for costs
  const netOperatingIncome = annualRent - operatingExpenses
  
  // Annual Debt Service
  const annualDebtService = monthlyMortgagePayment * 12
  
  const dcr = netOperatingIncome / annualDebtService
  return Math.round(dcr * 100) / 100
}

/**
 * Calculate all deal metrics
 */
export function calculateAllMetrics(input: DealCalculationInput): DealMetrics {
  const bmvPercentage = calculateBMVPercentage(input.askingPrice, input.marketValue)
  const grossYield = calculateGrossYield(input.askingPrice, input.estimatedMonthlyRent)
  const netYield = calculateNetYield(input.askingPrice, input.estimatedMonthlyRent)
  const roi = calculateROI(input.askingPrice, input.estimatedRefurbCost, input.estimatedMonthlyRent)
  const roce = calculateROCE(
    input.askingPrice,
    input.estimatedRefurbCost,
    input.afterRefurbValue,
    input.estimatedMonthlyRent
  )
  const { score: calculatedDealScore, breakdown: dealScoreBreakdown } = calculateDealScore(input)
  const dealScore = Number.isFinite(calculatedDealScore) ? calculatedDealScore : null
  const packTier = determinePackTier(dealScore)
  const packPrice = determinePackPrice(packTier)
  
  // Calculate acquisition costs
  const stampDuty = calculateStampDuty(input.askingPrice)
  const legalFees = calculateLegalFees(input.askingPrice)
  const surveyCost = calculateSurveyCost()
  const totalAcquisitionCost = calculateTotalAcquisitionCost(
    input.askingPrice,
    input.estimatedRefurbCost
  )
  
  // Calculate cash flow metrics
  const monthlyCashFlow = calculateMonthlyCashFlow(input.estimatedMonthlyRent)
  const annualCashFlow = calculateAnnualCashFlow(monthlyCashFlow)
  const cashOnCashReturn = calculateCashOnCashReturn(annualCashFlow, totalAcquisitionCost)
  
  // Calculate equity and payback
  const equityGain = calculateEquityGain(input.afterRefurbValue, totalAcquisitionCost)
  const paybackPeriod = calculatePaybackPeriod(totalAcquisitionCost, annualCashFlow)
  
  // Calculate additional property metrics
  const capRate = calculateCapRate(input.marketValue, input.estimatedMonthlyRent)
  const grm = calculateGRM(input.askingPrice, input.estimatedMonthlyRent)
  
  // Calculate mortgage metrics (assuming 25% deposit, 4.5% BTL rate, 25 year term)
  const mortgageDeposit = calculateMortgageDeposit(input.askingPrice)
  const mortgageLoanAmount = calculateMortgageLoanAmount(input.askingPrice)
  const monthlyMortgagePayment = calculateMonthlyMortgagePayment(mortgageLoanAmount, 4.5, 25)
  const totalCashRequired = calculateTotalCashRequired(input.askingPrice, input.estimatedRefurbCost)
  const netMonthlyCashFlowMortgaged = calculateNetMonthlyCashFlowMortgaged(input.estimatedMonthlyRent, monthlyMortgagePayment)
  const netAnnualCashFlowMortgaged = calculateNetAnnualCashFlowMortgaged(netMonthlyCashFlowMortgaged)
  const cashOnCashReturnMortgaged = calculateCashOnCashReturnMortgaged(netAnnualCashFlowMortgaged, totalCashRequired)
  const debtCoverageRatio = calculateDebtCoverageRatio(input.estimatedMonthlyRent, monthlyMortgagePayment)
  
  return {
    bmvPercentage,
    grossYield,
    netYield,
    roi,
    roce,
    dealScore,
    dealScoreBreakdown,
    packTier,
    packPrice,
    stampDuty,
    legalFees,
    surveyCost,
    totalAcquisitionCost,
    monthlyCashFlow,
    annualCashFlow,
    cashOnCashReturn,
    equityGain,
    paybackPeriod,
    capRate,
    grm,
    mortgageDeposit,
    mortgageLoanAmount,
    monthlyMortgagePayment,
    totalCashRequired,
    netMonthlyCashFlowMortgaged,
    netAnnualCashFlowMortgaged,
    cashOnCashReturnMortgaged,
    debtCoverageRatio,
  }
}

