/**
 * Property Offer Calculator
 *
 * Implements an Excel-based two-strategy offer methodology (Flip vs Hold) using
 * binary-search goal-seek mathematics to calculate backward from required returns
 * to a maximum purchase price, then applies a negotiation buffer.
 *
 * FLIP strategy: profitOnCost = (GDV - totalCost) / totalCost >= flipCriteriaROI (default 20%)
 * HOLD strategy: roceMultiple = (annualCashflow / |cashSurplusOrMoneyLeftIn|) / mortgageRate >= holdCriteriaROCEMultiple (default 2.5x)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface OfferEngineInputs {
  // Core property data
  askingPrice: number
  gdv: number              // Gross Development Value / After Refurb Value
  estimatedRent: number    // Monthly PCM
  totalRefurbishment: number
  propertySize?: number    // sqm (informational only)

  // Bridging loan params
  bridgingLTV?: number                   // default 0.75
  bridgingArrangementFee?: number        // default 0.01
  bridgingInterestRateMonthly?: number   // default 0.0075
  bridgingMonths?: number                // default 12
  bridgingExitFee?: number               // default 0.005
  bridgingLegalFees?: number             // default 1500
  bridgingValuationFees?: number         // default 750

  // Acquisition costs
  stampDuty?: number                     // optional override; calculated from price if omitted
  solicitorFees?: number                 // default 1500
  searches?: number                      // default 350
  buildingControl?: number               // default 600

  // Project costs
  contingencyPercent?: number            // default 0
  utilityBillsMonthly?: number           // default 30
  councilTaxMonthly?: number             // default 30
  furnishingCosts?: number               // default 1000

  // Exit mortgage
  mortgageLTV?: number                   // default 0.75
  mortgageRate?: number                  // annual, default 0.0459
  mortgageArrangementFeePercent?: number // default 0.02
  mortgageBrokerFee?: number             // default 800
  rentalCoverageRequirement?: number     // ICR, default 1.25

  // Monthly cashflow costs
  managementPercent?: number             // default 0
  maintenanceMonthly?: number            // default 0
  buildingInsuranceMonthly?: number      // default 10
  voidsMonthsPerYear?: number            // default 0.5

  // Deal criteria
  flipCriteriaROI?: number               // default 0.20 (20% profit on cost)
  holdCriteriaROCEMultiple?: number      // default 2.5x
  maxViewingDiscountPercent?: number     // default 0.20
  offerNegotiationBuffer?: number        // default 0.10
}

export interface BridgingBreakdown {
  grossLoan: number
  netLoanAdvance: number
  deposit: number
  arrangementFee: number
  monthlyInterest: number
  totalInterest: number
  exitFee: number
  totalCosts: number
}

export interface MortgageBreakdown {
  loanAmount: number
  monthlyPayment: number
  arrangementFee: number
  totalCosts: number
  icrPass: boolean
  requiredRentForICR: number
  annualInterestCost: number
}

export interface CashflowBreakdown {
  grossRentMonthly: number
  managementCostMonthly: number
  mortgagePaymentMonthly: number
  maintenanceMonthly: number
  insuranceMonthly: number
  voidAllowanceMonthly: number
  netMonthlyCashflow: number
  netAnnualCashflow: number
  grossYield: number
}

export interface StrategyMetrics {
  maxPurchasePrice: number
  offerPrice: number
  discountFromAsking: number
  discountPercent: number
  viewingCriteriaMet: boolean
  totalCost: number
  totalEquityInvested: number
  profit: number
  profitOnCost: number
  roce: number
  roceMultiple: number
  netMonthlyCashflow: number
  moneyLeftIn: number
  cashSurplus: number
  grossYield: number
  acquisitionCosts: {
    deposit: number
    stampDuty: number
    solicitorFees: number
    searches: number
    buildingControl: number
    total: number
  }
  projectCosts: {
    refurbishment: number
    contingency: number
    utilities: number
    councilTax: number
    furnishing: number
    total: number
  }
}

export interface OfferCalculationResult {
  // Strategy results
  flip: StrategyMetrics
  hold: StrategyMetrics

  // Shared financial breakdowns (computed at the flip max purchase price for display)
  bridging: BridgingBreakdown
  mortgage: MortgageBreakdown
  cashflow: CashflowBreakdown

  // Recommendation
  recommendedStrategy: "flip" | "hold" | "both" | "pass"
  recommendedOfferPrice: number
  dealViability: "strong" | "marginal" | "pass"
  viabilityScore: number    // 0-100
  viabilityNotes: string[]

  // Inputs used (resolved with defaults — all numeric fields present except optional overrides)
  inputs: OfferEngineInputs & {
    bridgingLTV: number
    bridgingArrangementFee: number
    bridgingInterestRateMonthly: number
    bridgingMonths: number
    bridgingExitFee: number
    bridgingLegalFees: number
    bridgingValuationFees: number
    solicitorFees: number
    searches: number
    buildingControl: number
    contingencyPercent: number
    utilityBillsMonthly: number
    councilTaxMonthly: number
    furnishingCosts: number
    mortgageLTV: number
    mortgageRate: number
    mortgageArrangementFeePercent: number
    mortgageBrokerFee: number
    rentalCoverageRequirement: number
    managementPercent: number
    maintenanceMonthly: number
    buildingInsuranceMonthly: number
    voidsMonthsPerYear: number
    flipCriteriaROI: number
    holdCriteriaROCEMultiple: number
    maxViewingDiscountPercent: number
    offerNegotiationBuffer: number
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Defaults
// ─────────────────────────────────────────────────────────────────────────────

export const DEFAULT_OFFER_ENGINE_INPUTS = {
  bridgingLTV: 0.75,
  bridgingArrangementFee: 0.01,
  bridgingInterestRateMonthly: 0.0075,
  bridgingMonths: 12,
  bridgingExitFee: 0.005,
  bridgingLegalFees: 1500,
  bridgingValuationFees: 750,
  solicitorFees: 1500,
  searches: 350,
  buildingControl: 600,
  contingencyPercent: 0,
  utilityBillsMonthly: 30,
  councilTaxMonthly: 30,
  furnishingCosts: 1000,
  mortgageLTV: 0.75,
  mortgageRate: 0.0459,
  mortgageArrangementFeePercent: 0.02,
  mortgageBrokerFee: 800,
  rentalCoverageRequirement: 1.25,
  managementPercent: 0,
  maintenanceMonthly: 0,
  buildingInsuranceMonthly: 10,
  voidsMonthsPerYear: 0.5,
  flipCriteriaROI: 0.20,
  holdCriteriaROCEMultiple: 2.5,
  maxViewingDiscountPercent: 0.20,
  offerNegotiationBuffer: 0.10,
} as const

// ─────────────────────────────────────────────────────────────────────────────
// UK Stamp Duty Land Tax (additional dwelling / BTL surcharge)
// ─────────────────────────────────────────────────────────────────────────────

function calculateStampDuty(purchasePrice: number): number {
  // Additional dwelling rates (BTL / investment property)
  // England & Northern Ireland rates (post-Oct 2024 with 5% surcharge on additional dwellings)
  if (purchasePrice <= 125_000) return purchasePrice * 0.03
  if (purchasePrice <= 250_000) return 125_000 * 0.03 + (purchasePrice - 125_000) * 0.05
  if (purchasePrice <= 925_000) return 125_000 * 0.03 + 125_000 * 0.05 + (purchasePrice - 250_000) * 0.10
  return 125_000 * 0.03 + 125_000 * 0.05 + 675_000 * 0.10 + (purchasePrice - 925_000) * 0.15
}

// ─────────────────────────────────────────────────────────────────────────────
// Core metric calculation for a given purchase price
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedInputs {
  gdv: number
  estimatedRent: number
  totalRefurbishment: number
  bridgingLTV: number
  bridgingArrangementFee: number
  bridgingInterestRateMonthly: number
  bridgingMonths: number
  bridgingExitFee: number
  bridgingLegalFees: number
  bridgingValuationFees: number
  stampDutyOverride?: number
  solicitorFees: number
  searches: number
  buildingControl: number
  contingencyPercent: number
  utilityBillsMonthly: number
  councilTaxMonthly: number
  furnishingCosts: number
  mortgageLTV: number
  mortgageRate: number
  mortgageArrangementFeePercent: number
  mortgageBrokerFee: number
  rentalCoverageRequirement: number
  managementPercent: number
  maintenanceMonthly: number
  buildingInsuranceMonthly: number
  voidsMonthsPerYear: number
}

export interface MetricsAtPrice {
  profitOnCost: number
  roceMultiple: number
  totalCost: number
  totalEquityInvested: number
  profit: number
  roce: number
  netMonthlyCashflow: number
  annualCashflow: number
  moneyLeftIn: number
  cashSurplusOrMoneyLeftIn: number
  grossYield: number
  bridging: BridgingBreakdown
  mortgage: MortgageBreakdown
  acquisitionCosts: StrategyMetrics["acquisitionCosts"]
  projectCosts: StrategyMetrics["projectCosts"]
}

export function computeMetrics(purchasePrice: number, inp: ResolvedInputs): MetricsAtPrice {
  // ── 1. Bridging Finance ────────────────────────────────────────────────────
  const grossLoan = purchasePrice * inp.bridgingLTV
  const arrangementFee = grossLoan * inp.bridgingArrangementFee
  const monthlyInterest = grossLoan * inp.bridgingInterestRateMonthly
  const totalInterest = monthlyInterest * inp.bridgingMonths
  const exitFee = grossLoan * inp.bridgingExitFee
  const netLoanAdvance = grossLoan - arrangementFee - exitFee
  const totalBridgingCosts =
    arrangementFee + totalInterest + exitFee + inp.bridgingLegalFees + inp.bridgingValuationFees
  const deposit = purchasePrice - netLoanAdvance

  const bridging: BridgingBreakdown = {
    grossLoan,
    netLoanAdvance,
    deposit,
    arrangementFee,
    monthlyInterest,
    totalInterest,
    exitFee,
    totalCosts: totalBridgingCosts,
  }

  // ── 2. Acquisition Costs ───────────────────────────────────────────────────
  const stampDuty = inp.stampDutyOverride ?? calculateStampDuty(purchasePrice)
  const acquisitionCosts = {
    deposit,
    stampDuty,
    solicitorFees: inp.solicitorFees,
    searches: inp.searches,
    buildingControl: inp.buildingControl,
    total: deposit + stampDuty + inp.solicitorFees + inp.searches + inp.buildingControl,
  }
  const totalAcquisitionCosts = acquisitionCosts.total

  // ── 3. Project Costs ───────────────────────────────────────────────────────
  const contingency = inp.totalRefurbishment * inp.contingencyPercent
  const holdingUtilities = inp.utilityBillsMonthly * inp.bridgingMonths
  const holdingCouncilTax = inp.councilTaxMonthly * inp.bridgingMonths
  const projectCosts = {
    refurbishment: inp.totalRefurbishment,
    contingency,
    utilities: holdingUtilities,
    councilTax: holdingCouncilTax,
    furnishing: inp.furnishingCosts,
    total:
      inp.totalRefurbishment + contingency + holdingUtilities + holdingCouncilTax + inp.furnishingCosts,
  }
  const totalProjectCosts = projectCosts.total

  // ── 4. Exit Mortgage (on GDV) ──────────────────────────────────────────────
  const mortgageLoanAmount = inp.gdv * inp.mortgageLTV
  const monthlyMortgagePayment = (mortgageLoanAmount * inp.mortgageRate) / 12
  const mortgageArrangementFee = mortgageLoanAmount * inp.mortgageArrangementFeePercent
  const totalMortgageCosts = mortgageArrangementFee + inp.mortgageBrokerFee

  // ── 5. ICR Check ───────────────────────────────────────────────────────────
  const requiredRentForICR = monthlyMortgagePayment * inp.rentalCoverageRequirement
  const icrPass = inp.estimatedRent >= requiredRentForICR

  const mortgage: MortgageBreakdown = {
    loanAmount: mortgageLoanAmount,
    monthlyPayment: monthlyMortgagePayment,
    arrangementFee: mortgageArrangementFee,
    totalCosts: totalMortgageCosts,
    icrPass,
    requiredRentForICR,
    annualInterestCost: mortgageLoanAmount * inp.mortgageRate,
  }

  // ── 6. Monthly Cashflow ────────────────────────────────────────────────────
  const managementCost = inp.estimatedRent * inp.managementPercent
  const voidCostMonthly = (inp.estimatedRent / 12) * inp.voidsMonthsPerYear
  const netMonthlyCashflow =
    inp.estimatedRent -
    managementCost -
    monthlyMortgagePayment -
    inp.maintenanceMonthly -
    inp.buildingInsuranceMonthly -
    voidCostMonthly
  const annualCashflow = netMonthlyCashflow * 12

  // ── 7. Key Metrics ─────────────────────────────────────────────────────────
  //
  // totalCost = everything spent that does NOT come back from the sale/refinance.
  //
  // Cash flow for a flip:
  //   Out: purchasePrice (deposit + bridging loan advance)
  //        bridging fees (arrangement, interest, exit, legal, valuation)
  //        acquisition costs (stamp duty, solicitor, searches, building control)
  //        project costs (refurb, utilities, council tax, furnishing)
  //        mortgage exit costs (arrangement fee, broker fee)
  //   In:  GDV sale proceeds (from which the bridging loan principal is repaid)
  //
  // The bridging loan principal cancels out (paid out at purchase, repaid from GDV),
  // so it is not a net cost. The DEPOSIT, however, is permanently at risk — but it is
  // already embedded in purchasePrice (purchasePrice = deposit + netLoanAdvance).
  //
  // ⚠ Bug guard: acquisitionCosts.total includes `deposit` for the UI breakdown
  // (showing investors total cash needed upfront). We must NOT add it again via
  // purchasePrice, or the deposit is double-counted, inflating totalCost by ~26% of
  // the purchase price and making the goal-seek produce unrealistically low offers.
  //
  // Correct formula:
  //   totalCost = purchasePrice               (deposit + bridging loan, both "spent")
  //             + totalBridgingCosts           (fees only — loan principal netted out above)
  //             + (totalAcquisitionCosts - deposit)  (stamp + solicitor + searches + buildCtrl)
  //             + totalProjectCosts            (refurb + utilities + council tax + furnishing)
  //             + totalMortgageCosts           (exit mortgage arrangement + broker fees)
  //
  // Equivalent to:
  //   totalCost = purchasePrice + bridgingFees + acqFeesExcludingDeposit + projectCosts + mortgageFees
  const totalCost =
    purchasePrice + totalBridgingCosts + (totalAcquisitionCosts - deposit) + totalProjectCosts + totalMortgageCosts
  const totalEquityInvested = totalAcquisitionCosts + totalProjectCosts + totalMortgageCosts
  const profit = inp.gdv - totalCost
  const profitOnCost = totalCost > 0 ? profit / totalCost : -Infinity

  const cashSurplusOrMoneyLeftIn = mortgageLoanAmount - totalEquityInvested
  const grossYield = inp.gdv > 0 ? (inp.estimatedRent * 12) / inp.gdv : 0

  // BRRR case: mortgage loan exceeds all equity invested → full capital recycled (or surplus).
  // ROCE = annualCashflow / |moneyLeftIn| is undefined / infinite when moneyLeftIn = 0.
  // Dividing by the cash SURPLUS gives a meaninglessly low number and causes the goal-seek
  // to reject a perfectly valid BRRR deal.  Use a sentinel (99.9) to represent "passes any
  // ROCE threshold" without breaking JSON serialisation or UI display.
  const isBRRR = cashSurplusOrMoneyLeftIn >= 0
  const roce = annualCashflow / Math.max(Math.abs(cashSurplusOrMoneyLeftIn), 1)
  const roceMultiple = isBRRR
    ? 99.9   // Full BRRR — all capital recycled; effectively infinite return on £0 left in
    : (inp.mortgageRate > 0 ? roce / inp.mortgageRate : 0)
  const moneyLeftIn = Math.max(cashSurplusOrMoneyLeftIn * -1, 0)

  return {
    profitOnCost,
    roceMultiple,
    totalCost,
    totalEquityInvested,
    profit,
    roce,
    netMonthlyCashflow,
    annualCashflow,
    moneyLeftIn,
    cashSurplusOrMoneyLeftIn,
    grossYield,
    bridging,
    mortgage,
    acquisitionCosts,
    projectCosts,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Binary-search goal-seek
// ─────────────────────────────────────────────────────────────────────────────

type Strategy = "flip" | "hold"

function goalSeekMaxPurchasePrice(
  strategy: Strategy,
  inp: ResolvedInputs,
  askingPrice: number,
  flipCriteriaROI: number,
  holdCriteriaROCEMultiple: number,
  maxIterations = 60
): number {
  const threshold = strategy === "flip" ? flipCriteriaROI : holdCriteriaROCEMultiple

  const meetsThreshold = (p: number) => {
    const m = computeMetrics(p, inp)
    return strategy === "flip" ? m.profitOnCost >= threshold : m.roceMultiple >= threshold
  }

  // Check if any viable price exists
  if (!meetsThreshold(1)) {
    // No viable purchase price (even at £1 it doesn't work)
    return 0
  }

  let lo = 1
  let hi = askingPrice

  // If criterion passes even at asking price, find if it still passes beyond
  // (just return asking price in that case – we cap at asking)
  if (meetsThreshold(hi)) {
    return hi
  }

  for (let i = 0; i < maxIterations; i++) {
    const mid = (lo + hi) / 2
    if (meetsThreshold(mid)) {
      lo = mid
    } else {
      hi = mid
    }
    if (hi - lo < 1) break
  }

  return Math.round(lo)
}

// ─────────────────────────────────────────────────────────────────────────────
// Build StrategyMetrics for a resolved max purchase price
// ─────────────────────────────────────────────────────────────────────────────

function buildStrategyMetrics(
  maxPurchasePrice: number,
  askingPrice: number,
  inp: ResolvedInputs,
  offerNegotiationBuffer: number,
  maxViewingDiscountPercent: number
): StrategyMetrics {
  if (maxPurchasePrice === 0) {
    // No viable offer
    return {
      maxPurchasePrice: 0,
      offerPrice: 0,
      discountFromAsking: askingPrice,
      discountPercent: 1,
      viewingCriteriaMet: false,
      totalCost: 0,
      totalEquityInvested: 0,
      profit: 0,
      profitOnCost: 0,
      roce: 0,
      roceMultiple: 0,
      netMonthlyCashflow: 0,
      moneyLeftIn: 0,
      cashSurplus: 0,
      grossYield: 0,
      acquisitionCosts: {
        deposit: 0, stampDuty: 0, solicitorFees: 0, searches: 0, buildingControl: 0, total: 0,
      },
      projectCosts: {
        refurbishment: 0, contingency: 0, utilities: 0, councilTax: 0, furnishing: 0, total: 0,
      },
    }
  }

  const m = computeMetrics(maxPurchasePrice, inp)
  const offerPrice = Math.round(maxPurchasePrice * (1 - offerNegotiationBuffer))
  const discountFromAsking = askingPrice - maxPurchasePrice
  const discountPercent = askingPrice > 0 ? discountFromAsking / askingPrice : 0
  const viewingCriteriaMet = discountPercent <= maxViewingDiscountPercent

  return {
    maxPurchasePrice,
    offerPrice,
    discountFromAsking,
    discountPercent,
    viewingCriteriaMet,
    totalCost: m.totalCost,
    totalEquityInvested: m.totalEquityInvested,
    profit: m.profit,
    profitOnCost: m.profitOnCost,
    roce: m.roce,
    roceMultiple: m.roceMultiple,
    netMonthlyCashflow: m.netMonthlyCashflow,
    moneyLeftIn: m.moneyLeftIn,
    cashSurplus: Math.max(m.cashSurplusOrMoneyLeftIn, 0),
    grossYield: m.grossYield,
    acquisitionCosts: m.acquisitionCosts,
    projectCosts: m.projectCosts,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Viability scoring
// ─────────────────────────────────────────────────────────────────────────────

function computeViability(
  flip: StrategyMetrics,
  hold: StrategyMetrics,
  mortgage: MortgageBreakdown
): { recommendedStrategy: OfferCalculationResult["recommendedStrategy"]; dealViability: OfferCalculationResult["dealViability"]; viabilityScore: number; viabilityNotes: string[] } {
  const notes: string[] = []
  let score = 0

  // "Has price" = return criteria met at some price (may still need steep discount)
  // "Viable"    = return criteria met AND discount within 20% viewing threshold
  const flipHasPrice = flip.maxPurchasePrice > 0
  const holdHasPrice = hold.maxPurchasePrice > 0
  const flipViable = flipHasPrice && flip.viewingCriteriaMet
  const holdViable = holdHasPrice && hold.viewingCriteriaMet

  // Score components
  // Full points for within-threshold deals; partial for steep-discount deals
  if (flipViable) score += 25
  else if (flipHasPrice) score += 12   // return criteria met but needs steep discount

  if (holdViable) score += 25
  else if (holdHasPrice) score += 12   // return criteria met but needs steep discount

  if (mortgage.icrPass) {
    score += 20
    notes.push("ICR passes comfortably")
  } else {
    notes.push(`ICR fails — rent £${mortgage.requiredRentForICR.toFixed(0)} required vs £${mortgage.requiredRentForICR.toFixed(0)} minimum for lender approval`)
  }

  // Flip profit margin bonus
  // Compute recommendation first so notes can be strategy-aware
  const recommendedStrategy: OfferCalculationResult["recommendedStrategy"] =
    flipViable && holdViable ? "both" :
    flipViable ? "flip" :
    holdViable ? "hold" :
    flipHasPrice && holdHasPrice ? "both" :
    flipHasPrice ? "flip" :
    holdHasPrice ? "hold" :
    "pass"

  const holdIsRec = recommendedStrategy === "hold" || recommendedStrategy === "both"
  const flipIsRec = recommendedStrategy === "flip" || recommendedStrategy === "both"

  // Flip profit margin bonus + note
  if (flipHasPrice) {
    const excessPOC = flip.profitOnCost - 0.20
    if (excessPOC >= 0.05) score += 15
    else if (excessPOC >= 0) score += 8
    if (!flip.viewingCriteriaMet) {
      // Only surface the steep-discount warning when flip is the recommended strategy.
      // When BRRR/BTL is recommended, mention flip as a secondary note rather than a headline concern.
      if (flipIsRec) {
        notes.push(`Flip max offer (${Math.round(flip.maxPurchasePrice).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}) needs ${(flip.discountPercent * 100).toFixed(1)}% discount — above 20% threshold, requires motivated seller`)
      } else {
        notes.push(`Flip strategy also viable at ${Math.round(flip.maxPurchasePrice).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })} but needs ${(flip.discountPercent * 100).toFixed(1)}% discount — not the recommended route`)
      }
    }
  }

  // ROCE bonus + note
  if (holdHasPrice) {
    if (hold.roceMultiple >= 3) score += 15
    else if (hold.roceMultiple >= 2.5) score += 8
    if (!hold.viewingCriteriaMet) {
      notes.push(`Hold max offer (${Math.round(hold.maxPurchasePrice).toLocaleString("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 })}) needs ${(hold.discountPercent * 100).toFixed(1)}% discount — above 20% threshold, requires motivated seller`)
    }
  }

  if (!flipHasPrice && !holdHasPrice) {
    notes.push("No viable offer price found for either strategy at any purchase price")
  }

  // Suppress secondary strategy note when primary is clearly viable — keeps bullets focused
  void holdIsRec

  const dealViability: OfferCalculationResult["dealViability"] =
    score >= 70 ? "strong" :
    score >= 40 ? "marginal" :
    "pass"

  if (dealViability === "strong") notes.unshift("Strong deal — return metrics exceed thresholds")
  else if (dealViability === "marginal") notes.unshift("Marginal deal — returns viable but requires negotiation")
  else notes.unshift("Deal does not meet return criteria at any purchase price")

  return { recommendedStrategy, dealViability, viabilityScore: Math.min(100, score), viabilityNotes: notes }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Public helper — re-run the core price-sensitive metrics at any purchase price.
 *
 * Accepts either raw `OfferEngineInputs` (used by the negotiation ladder, where optional
 * fields are resolved against defaults here) or the richer `OfferCalculationResult["inputs"]`
 * (used by the Financial Breakdown price-basis toggle, where all fields are already resolved).
 * Returns the full MetricsAtPrice object in both cases.
 */
export function computeMetricsAtPrice(
  purchasePrice: number,
  rawInputs: OfferEngineInputs
): MetricsAtPrice {
  const d = DEFAULT_OFFER_ENGINE_INPUTS
  const resolved: ResolvedInputs = {
    gdv: rawInputs.gdv,
    estimatedRent: rawInputs.estimatedRent,
    totalRefurbishment: rawInputs.totalRefurbishment,
    bridgingLTV: rawInputs.bridgingLTV ?? d.bridgingLTV,
    bridgingArrangementFee: rawInputs.bridgingArrangementFee ?? d.bridgingArrangementFee,
    bridgingInterestRateMonthly: rawInputs.bridgingInterestRateMonthly ?? d.bridgingInterestRateMonthly,
    bridgingMonths: rawInputs.bridgingMonths ?? d.bridgingMonths,
    bridgingExitFee: rawInputs.bridgingExitFee ?? d.bridgingExitFee,
    bridgingLegalFees: rawInputs.bridgingLegalFees ?? d.bridgingLegalFees,
    bridgingValuationFees: rawInputs.bridgingValuationFees ?? d.bridgingValuationFees,
    stampDutyOverride: rawInputs.stampDuty,
    solicitorFees: rawInputs.solicitorFees ?? d.solicitorFees,
    searches: rawInputs.searches ?? d.searches,
    buildingControl: rawInputs.buildingControl ?? d.buildingControl,
    contingencyPercent: rawInputs.contingencyPercent ?? d.contingencyPercent,
    utilityBillsMonthly: rawInputs.utilityBillsMonthly ?? d.utilityBillsMonthly,
    councilTaxMonthly: rawInputs.councilTaxMonthly ?? d.councilTaxMonthly,
    furnishingCosts: rawInputs.furnishingCosts ?? d.furnishingCosts,
    mortgageLTV: rawInputs.mortgageLTV ?? d.mortgageLTV,
    mortgageRate: rawInputs.mortgageRate ?? d.mortgageRate,
    mortgageArrangementFeePercent: rawInputs.mortgageArrangementFeePercent ?? d.mortgageArrangementFeePercent,
    mortgageBrokerFee: rawInputs.mortgageBrokerFee ?? d.mortgageBrokerFee,
    rentalCoverageRequirement: rawInputs.rentalCoverageRequirement ?? d.rentalCoverageRequirement,
    managementPercent: rawInputs.managementPercent ?? d.managementPercent,
    maintenanceMonthly: rawInputs.maintenanceMonthly ?? d.maintenanceMonthly,
    buildingInsuranceMonthly: rawInputs.buildingInsuranceMonthly ?? d.buildingInsuranceMonthly,
    voidsMonthsPerYear: rawInputs.voidsMonthsPerYear ?? d.voidsMonthsPerYear,
  }
  return computeMetrics(purchasePrice, resolved)
}

export function calculatePropertyOffer(rawInputs: OfferEngineInputs): OfferCalculationResult {
  const {
    askingPrice,
    gdv,
    estimatedRent,
    totalRefurbishment,
    propertySize,
    stampDuty: stampDutyOverride,
  } = rawInputs

  // Merge defaults
  const d = DEFAULT_OFFER_ENGINE_INPUTS
  const resolved = {
    gdv,
    estimatedRent,
    totalRefurbishment,
    bridgingLTV: rawInputs.bridgingLTV ?? d.bridgingLTV,
    bridgingArrangementFee: rawInputs.bridgingArrangementFee ?? d.bridgingArrangementFee,
    bridgingInterestRateMonthly:
      rawInputs.bridgingInterestRateMonthly ?? d.bridgingInterestRateMonthly,
    bridgingMonths: rawInputs.bridgingMonths ?? d.bridgingMonths,
    bridgingExitFee: rawInputs.bridgingExitFee ?? d.bridgingExitFee,
    bridgingLegalFees: rawInputs.bridgingLegalFees ?? d.bridgingLegalFees,
    bridgingValuationFees: rawInputs.bridgingValuationFees ?? d.bridgingValuationFees,
    stampDutyOverride,
    solicitorFees: rawInputs.solicitorFees ?? d.solicitorFees,
    searches: rawInputs.searches ?? d.searches,
    buildingControl: rawInputs.buildingControl ?? d.buildingControl,
    contingencyPercent: rawInputs.contingencyPercent ?? d.contingencyPercent,
    utilityBillsMonthly: rawInputs.utilityBillsMonthly ?? d.utilityBillsMonthly,
    councilTaxMonthly: rawInputs.councilTaxMonthly ?? d.councilTaxMonthly,
    furnishingCosts: rawInputs.furnishingCosts ?? d.furnishingCosts,
    mortgageLTV: rawInputs.mortgageLTV ?? d.mortgageLTV,
    mortgageRate: rawInputs.mortgageRate ?? d.mortgageRate,
    mortgageArrangementFeePercent:
      rawInputs.mortgageArrangementFeePercent ?? d.mortgageArrangementFeePercent,
    mortgageBrokerFee: rawInputs.mortgageBrokerFee ?? d.mortgageBrokerFee,
    rentalCoverageRequirement:
      rawInputs.rentalCoverageRequirement ?? d.rentalCoverageRequirement,
    managementPercent: rawInputs.managementPercent ?? d.managementPercent,
    maintenanceMonthly: rawInputs.maintenanceMonthly ?? d.maintenanceMonthly,
    buildingInsuranceMonthly:
      rawInputs.buildingInsuranceMonthly ?? d.buildingInsuranceMonthly,
    voidsMonthsPerYear: rawInputs.voidsMonthsPerYear ?? d.voidsMonthsPerYear,
  } satisfies ResolvedInputs

  const flipCriteriaROI = rawInputs.flipCriteriaROI ?? d.flipCriteriaROI
  const holdCriteriaROCEMultiple = rawInputs.holdCriteriaROCEMultiple ?? d.holdCriteriaROCEMultiple
  const maxViewingDiscountPercent = rawInputs.maxViewingDiscountPercent ?? d.maxViewingDiscountPercent
  const offerNegotiationBuffer = rawInputs.offerNegotiationBuffer ?? d.offerNegotiationBuffer

  // ── Goal-seek both strategies ─────────────────────────────────────────────
  const flipMaxPurchasePrice = goalSeekMaxPurchasePrice(
    "flip", resolved, askingPrice, flipCriteriaROI, holdCriteriaROCEMultiple
  )
  const holdMaxPurchasePrice = goalSeekMaxPurchasePrice(
    "hold", resolved, askingPrice, flipCriteriaROI, holdCriteriaROCEMultiple
  )

  // ── Build strategy metrics ─────────────────────────────────────────────────
  const flip = buildStrategyMetrics(
    flipMaxPurchasePrice, askingPrice, resolved, offerNegotiationBuffer, maxViewingDiscountPercent
  )
  const hold = buildStrategyMetrics(
    holdMaxPurchasePrice, askingPrice, resolved, offerNegotiationBuffer, maxViewingDiscountPercent
  )

  // ── Shared financials (prefer hold/BRRR price; fall back to flip, then asking) ──
  // Using hold ceiling when available ensures bridging/mortgage figures reflect the
  // recommended BRRR purchase price rather than the (often lower) flip ceiling.
  const displayPrice =
    holdMaxPurchasePrice > 0 ? holdMaxPurchasePrice :
    flipMaxPurchasePrice > 0 ? flipMaxPurchasePrice :
    askingPrice
  const shared = computeMetrics(displayPrice, resolved)

  const mortgage: MortgageBreakdown = shared.mortgage
  const bridging: BridgingBreakdown = shared.bridging
  const cashflow: CashflowBreakdown = {
    grossRentMonthly: estimatedRent,
    managementCostMonthly: estimatedRent * resolved.managementPercent,
    mortgagePaymentMonthly: mortgage.monthlyPayment,
    maintenanceMonthly: resolved.maintenanceMonthly,
    insuranceMonthly: resolved.buildingInsuranceMonthly,
    voidAllowanceMonthly: (estimatedRent / 12) * resolved.voidsMonthsPerYear,
    netMonthlyCashflow: shared.netMonthlyCashflow,
    netAnnualCashflow: shared.annualCashflow,
    grossYield: shared.grossYield,
  }

  // ── Viability ─────────────────────────────────────────────────────────────
  const viability = computeViability(flip, hold, mortgage)

  const recommendedOfferPrice =
    viability.recommendedStrategy === "flip" ? flip.offerPrice :
    viability.recommendedStrategy === "hold" ? hold.offerPrice :
    viability.recommendedStrategy === "both" ? Math.max(flip.offerPrice, hold.offerPrice) :
    0

  // ── Full resolved inputs (for UI display / recalculation) ─────────────────
  const resolvedInputs = {
    askingPrice,
    gdv,
    estimatedRent,
    totalRefurbishment,
    propertySize,
    bridgingLTV: resolved.bridgingLTV,
    bridgingArrangementFee: resolved.bridgingArrangementFee,
    bridgingInterestRateMonthly: resolved.bridgingInterestRateMonthly,
    bridgingMonths: resolved.bridgingMonths,
    bridgingExitFee: resolved.bridgingExitFee,
    bridgingLegalFees: resolved.bridgingLegalFees,
    bridgingValuationFees: resolved.bridgingValuationFees,
    stampDuty: stampDutyOverride,
    solicitorFees: resolved.solicitorFees,
    searches: resolved.searches,
    buildingControl: resolved.buildingControl,
    contingencyPercent: resolved.contingencyPercent,
    utilityBillsMonthly: resolved.utilityBillsMonthly,
    councilTaxMonthly: resolved.councilTaxMonthly,
    furnishingCosts: resolved.furnishingCosts,
    mortgageLTV: resolved.mortgageLTV,
    mortgageRate: resolved.mortgageRate,
    mortgageArrangementFeePercent: resolved.mortgageArrangementFeePercent,
    mortgageBrokerFee: resolved.mortgageBrokerFee,
    rentalCoverageRequirement: resolved.rentalCoverageRequirement,
    managementPercent: resolved.managementPercent,
    maintenanceMonthly: resolved.maintenanceMonthly,
    buildingInsuranceMonthly: resolved.buildingInsuranceMonthly,
    voidsMonthsPerYear: resolved.voidsMonthsPerYear,
    flipCriteriaROI,
    holdCriteriaROCEMultiple,
    maxViewingDiscountPercent,
    offerNegotiationBuffer,
  }

  return {
    flip,
    hold,
    bridging,
    mortgage,
    cashflow,
    ...viability,
    recommendedOfferPrice,
    inputs: resolvedInputs,
  }
}
