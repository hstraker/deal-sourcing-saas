/**
 * lib/ssas-analyzer.ts
 *
 * SSAS (Small Self-Administered Scheme) commercial property analysis engine.
 *
 * Computes:
 *  - Gross and net yield
 *  - DSCR (Debt Service Coverage Ratio) for loan-back strategy
 *  - Risk score (0–100) across 6 signal categories
 *  - Financing strategy recommendation (Cash / Loan-Back / Mixed)
 *  - Overall recommendation (STRONG BUY / BUY / CONSIDER / PASS / AVOID)
 *
 * No external API calls — all pure calculation.
 *
 * ── SSAS Loan-Back Explained ────────────────────────────────────────────────
 * An SSAS can lend up to 50% of net scheme assets to the sponsoring employer
 * at HMRC-approved commercial rates (typically Bank of England base rate + 1–2%).
 * The property is used as security. For a qualifying commercial property:
 *   - SSAS buys property (using cash or 75% LTV mortgage-style loan-back)
 *   - Employer makes monthly repayments including interest back to the SSAS
 *   - Net income = rent received from tenant
 *   - Loan repayments must be serviced by rental income (DSCR > 1.2)
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type SsasRecommendation = "STRONG BUY" | "BUY" | "CONSIDER" | "PASS" | "AVOID"
export type SsasFinancingStrategy = "CASH" | "LOAN_BACK" | "MIXED" | "NOT_VIABLE"

export interface SsasRiskBreakdown {
  location:   number   // 0–10
  tenant:     number   // 0–15
  condition:  number   // 0–15
  financing:  number   // 0–25
  lease:      number   // 0–20
  market:     number   // 0–15
  total:      number   // 0–100
}

export interface SsasAnalysisInput {
  price:               number
  annualRent:          number   // 0 if unknown
  leaseYearsRemaining: number   // 0 if unknown
  propertyType:        string   // "Office" | "Retail" | "Industrial" | "Warehouse" | "Mixed"
  condition:           "Excellent" | "Good" | "Fair" | "Poor" | string
  tenantType:          string   // "National chain" | "Local business" | "Vacant" | "Multiple" | ""
  postcode:            string
  daysOnMarket:        number
  epcRating:           string | null | undefined
  // Optional — for DSCR calculation
  loanRatePercent?:    number   // default 6.5 (base + ~2%)
  loanTermYears?:      number   // default 15
  loanLtvPercent?:     number   // default 75
  // Optional enrichment signals
  isGoodLocation?:     boolean  // based on postcode / market data
  isGrowingMarket?:    boolean
  hasReduction?:       boolean
  reductionPct?:       number
}

export interface SsasAnalysisResult {
  // Yield
  grossYieldPct:        number   // annualRent / price * 100
  netYieldPct:          number   // (annualRent * 0.78) / price * 100
  netAnnualIncome:      number   // annualRent * 0.78

  // DSCR (loan-back)
  loanAmount:           number
  annualLoanRepayment:  number
  dscr:                 number   // > 1.2 needed
  dscrViable:           boolean

  // Risk
  riskScore:            number   // 0–100 (higher = less risky)
  riskBreakdown:        SsasRiskBreakdown
  riskLabel:            string   // "Very Low" | "Low" | "Moderate" | "High" | "Very High"

  // Strategy & recommendation
  financingStrategy:    SsasFinancingStrategy
  recommendation:       SsasRecommendation
  recommendationReason: string

  // Flags
  redFlags:   string[]
  greenFlags: string[]

  // Meta
  analyzedAt:           string   // ISO timestamp
  assumptions: {
    expenseRatio:     number   // 0.22
    loanRatePct:      number
    loanTermYears:    number
    loanLtvPct:       number
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXPENSE_RATIO = 0.22  // 22%: management 10%, maintenance 8%, insurance 4%

const TENANT_STRENGTH: Record<string, number> = {
  "national chain":  15,
  "national":        15,
  "multiple":        12,
  "local business":  8,
  "local":           8,
  "government":      15,
  "nhs":             15,
  "vacant":          0,
  "empty":           0,
  "":                5,
}

const CONDITION_SCORE: Record<string, number> = {
  "excellent": 15,
  "good":      10,
  "fair":       5,
  "poor":       0,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function annualMortgagePayment(
  principal: number,
  annualRatePct: number,
  termYears: number
): number {
  if (principal <= 0) return 0
  const r = annualRatePct / 100 / 12   // monthly rate
  const n = termYears * 12             // total months
  if (r === 0) return principal / n * 12
  const monthly = principal * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
  return monthly * 12
}

function tenantScore(tenantType: string): number {
  const key = tenantType.toLowerCase().trim()
  for (const [pattern, score] of Object.entries(TENANT_STRENGTH)) {
    if (key.includes(pattern)) return score
  }
  return 8 // default: unknown local business
}

function leaseScore(years: number): number {
  if (years >= 10) return 20
  if (years >= 7)  return 15
  if (years >= 5)  return 12
  if (years >= 3)  return 6
  if (years >= 1)  return 2
  return 0
}

function riskLabel(score: number): string {
  if (score >= 80) return "Very Low"
  if (score >= 65) return "Low"
  if (score >= 50) return "Moderate"
  if (score >= 35) return "High"
  return "Very High"
}

// ── Main analyser ─────────────────────────────────────────────────────────────

export function analyzeSsasProperty(input: SsasAnalysisInput): SsasAnalysisResult {
  const {
    price,
    annualRent,
    leaseYearsRemaining,
    condition,
    tenantType,
    daysOnMarket,
    epcRating,
    loanRatePercent  = 6.5,
    loanTermYears    = 15,
    loanLtvPercent   = 75,
    isGoodLocation   = false,
    isGrowingMarket  = false,
    hasReduction     = false,
    reductionPct     = 0,
  } = input

  // ── Yield ───────────────────────────────────────────────────────────────────
  const grossYieldPct   = price > 0 && annualRent > 0 ? (annualRent / price) * 100 : 0
  const netAnnualIncome = annualRent * (1 - EXPENSE_RATIO)
  const netYieldPct     = price > 0 && annualRent > 0 ? (netAnnualIncome / price) * 100 : 0

  // ── DSCR ────────────────────────────────────────────────────────────────────
  const loanAmount           = price * (loanLtvPercent / 100)
  const annualLoanRepayment  = annualMortgagePayment(loanAmount, loanRatePercent, loanTermYears)
  const dscr                 = annualLoanRepayment > 0 ? netAnnualIncome / annualLoanRepayment : 0
  const dscrViable           = dscr >= 1.2

  // ── Risk score ──────────────────────────────────────────────────────────────
  const locationScore  = isGoodLocation ? 10 : (grossYieldPct >= 5 ? 7 : 4)   // proxy
  const tenantStr      = tenantScore(tenantType)
  const condStr        = CONDITION_SCORE[condition.toLowerCase()] ?? 5
  const financingScore = dscrViable ? 25 : (dscr >= 1.0 ? 12 : 0)
  const leaseStr       = leaseScore(leaseYearsRemaining)
  const marketScore    = isGrowingMarket ? 15 : (grossYieldPct >= 5 && grossYieldPct <= 9 ? 10 : 5)

  const riskBreakdown: SsasRiskBreakdown = {
    location:  locationScore,
    tenant:    tenantStr,
    condition: condStr,
    financing: financingScore,
    lease:     leaseStr,
    market:    marketScore,
    total:     locationScore + tenantStr + condStr + financingScore + leaseStr + marketScore,
  }
  const riskScore = riskBreakdown.total

  // ── Red / Green flags ───────────────────────────────────────────────────────
  const redFlags:   string[] = []
  const greenFlags: string[] = []

  if (grossYieldPct < 4)  redFlags.push("Yield below 4% — not worth effort for SSAS")
  if (grossYieldPct > 10) redFlags.push("Yield above 10% — investigate hidden risks")
  if (!dscrViable)        redFlags.push(`DSCR ${dscr.toFixed(2)} < 1.2 — loan-back not viable at ${loanLtvPercent}% LTV`)
  if (condition.toLowerCase() === "poor") redFlags.push("Poor condition — significant refurb cost risk")
  if (leaseYearsRemaining < 3 && leaseYearsRemaining > 0) redFlags.push(`Short lease (${leaseYearsRemaining}y) — renewal risk`)
  if (leaseYearsRemaining === 0) redFlags.push("Lease length unknown — investigate urgently")
  if (tenantType.toLowerCase().includes("vacant") || tenantType.toLowerCase().includes("empty")) {
    redFlags.push("Vacant property — no rental income; income risk during void period")
  }
  if (epcRating && ["F","G"].includes(epcRating.toUpperCase())) {
    redFlags.push(`EPC ${epcRating} — MEES compliance required before lease renewal`)
  }
  if (daysOnMarket > 180) redFlags.push(`${daysOnMarket} days on market — investigate why it's not selling`)

  if (grossYieldPct >= 5 && grossYieldPct <= 8) greenFlags.push(`Yield ${grossYieldPct.toFixed(1)}% — in SSAS target range (5–8%)`)
  if (dscrViable) greenFlags.push(`DSCR ${dscr.toFixed(2)} ≥ 1.2 — loan-back viable at ${loanLtvPercent}% LTV`)
  if (leaseYearsRemaining >= 5) greenFlags.push(`${leaseYearsRemaining}y lease — secure income runway`)
  if (condition.toLowerCase() === "excellent" || condition.toLowerCase() === "good") {
    greenFlags.push("Good/excellent condition — lower capex risk")
  }
  if (tenantStr >= 12) greenFlags.push("Strong tenant covenant")
  if (hasReduction && reductionPct > 0) greenFlags.push(`Price reduced ${reductionPct.toFixed(0)}% — negotiation advantage`)
  if (riskScore >= 75) greenFlags.push(`Risk score ${riskScore}/100 — high quality opportunity`)

  // ── Financing strategy ──────────────────────────────────────────────────────
  let financingStrategy: SsasFinancingStrategy
  if (!dscrViable && dscr < 1.0) {
    financingStrategy = "NOT_VIABLE"
  } else if (dscrViable) {
    financingStrategy = "LOAN_BACK"     // preferred: leverage SSAS loan-back up to 50% fund value
  } else {
    financingStrategy = "MIXED"         // partial loan-back + SSAS cash
  }
  // If property price < 25% of (estimated) SSAS fund, cash is simpler
  if (price < 150_000 && dscrViable) financingStrategy = "CASH"

  // ── Recommendation ──────────────────────────────────────────────────────────
  let recommendation: SsasRecommendation
  let recommendationReason: string

  if (redFlags.length >= 3 || grossYieldPct < 4 || riskScore < 30) {
    recommendation = "AVOID"
    recommendationReason = `Risk score ${riskScore}/100. Too many critical issues: ${redFlags.slice(0, 2).join("; ")}.`
  } else if (redFlags.length >= 2 || (grossYieldPct < 5 && netYieldPct < 3.5)) {
    recommendation = "PASS"
    recommendationReason = `Yield or risk profile below threshold. Gross yield ${grossYieldPct.toFixed(1)}%, risk ${riskScore}/100.`
  } else if (riskScore >= 75 && dscrViable && grossYieldPct >= 5.5) {
    recommendation = "STRONG BUY"
    recommendationReason = `Excellent opportunity. Net yield ${netYieldPct.toFixed(1)}%, DSCR ${dscr.toFixed(2)}, risk score ${riskScore}/100.`
  } else if (riskScore >= 55 && grossYieldPct >= 5) {
    recommendation = "BUY"
    recommendationReason = `Good opportunity. Net yield ${netYieldPct.toFixed(1)}%, DSCR ${dscr.toFixed(2)}, risk score ${riskScore}/100.`
  } else {
    recommendation = "CONSIDER"
    recommendationReason = `Worth further due diligence. Gross yield ${grossYieldPct.toFixed(1)}%, risk score ${riskScore}/100.`
  }

  return {
    grossYieldPct:        Math.round(grossYieldPct * 100) / 100,
    netYieldPct:          Math.round(netYieldPct * 100) / 100,
    netAnnualIncome:      Math.round(netAnnualIncome),
    loanAmount:           Math.round(loanAmount),
    annualLoanRepayment:  Math.round(annualLoanRepayment),
    dscr:                 Math.round(dscr * 100) / 100,
    dscrViable,
    riskScore,
    riskBreakdown,
    riskLabel:            riskLabel(riskScore),
    financingStrategy,
    recommendation,
    recommendationReason,
    redFlags,
    greenFlags,
    analyzedAt:           new Date().toISOString(),
    assumptions: {
      expenseRatio:  EXPENSE_RATIO,
      loanRatePct:   loanRatePercent,
      loanTermYears,
      loanLtvPct:    loanLtvPercent,
    },
  }
}

// ── Recommendation colour helpers (for UI) ────────────────────────────────────

export const RECOMMENDATION_STYLES: Record<SsasRecommendation, { bg: string; text: string; border: string }> = {
  "STRONG BUY": { bg: "bg-green-100",   text: "text-green-800",   border: "border-green-300" },
  "BUY":        { bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-200" },
  "CONSIDER":   { bg: "bg-amber-100",   text: "text-amber-800",   border: "border-amber-200" },
  "PASS":       { bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-200" },
  "AVOID":      { bg: "bg-red-100",     text: "text-red-800",     border: "border-red-200" },
}

export const FINANCING_LABELS: Record<SsasFinancingStrategy, string> = {
  CASH:        "Full Cash",
  LOAN_BACK:   "Loan-Back",
  MIXED:       "Mixed",
  NOT_VIABLE:  "Not Viable",
}
