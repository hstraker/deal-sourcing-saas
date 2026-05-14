/**
 * Per-Strategy Deal Validator
 * ----------------------------
 * Replaces the old single PASS/FAIL boolean with a per-strategy viability
 * assessment. This prevents a deal from being wrongly rejected just because
 * one strategy doesn't work — another may be excellent.
 *
 * Strategies assessed:
 *   BTL         — Buy to Let (income-based)
 *   BRRR        — Buy, Refurbish, Refinance, Rent
 *   Buy & Hold  — Long-term capital appreciation play
 *   Flip        — Buy, refurb, sell at profit
 *
 * Global disqualifiers short-circuit ALL strategies immediately.
 */

/** @typedef {'btl' | 'brrr' | 'buyAndHold' | 'flip'} Strategy */

// ── Disqualified property types ───────────────────────────────────────────────
const DISQUALIFIED_TYPES = ['commercial', 'land', 'mixed_use', 'mixed-use']

// ── Financial helpers ─────────────────────────────────────────────────────────

/**
 * @param {number} askingPrice
 * @param {number} marketValue
 * @returns {number} BMV as a percentage (e.g. 18.1)
 */
function calcBmvPct(askingPrice, marketValue) {
  if (!marketValue || marketValue <= 0) return 0
  return ((marketValue - askingPrice) / marketValue) * 100
}

/**
 * @param {number} rentPCM
 * @param {number} askingPrice
 * @returns {number} Gross yield percentage
 */
function calcGrossYield(rentPCM, askingPrice) {
  if (!rentPCM || !askingPrice) return 0
  return ((rentPCM * 12) / askingPrice) * 100
}

/**
 * Net monthly cashflow after mortgage + void allowance + management.
 *
 * @param {number} rentPCM
 * @param {number} askingPrice
 * @param {number} ltv         - e.g. 0.75
 * @param {number} mortgageRate - e.g. 0.06
 * @param {number} voidRiskPct - e.g. 5 (%)
 * @param {number} mgmtPct     - e.g. 10 (%)
 * @returns {number}
 */
function calcNetMonthlyCashflow(rentPCM, askingPrice, ltv, mortgageRate, voidRiskPct, mgmtPct = 10) {
  const loanAmount     = askingPrice * ltv
  const monthlyMortgage = (loanAmount * mortgageRate) / 12
  const voidAllowance  = rentPCM * (voidRiskPct / 100)
  const mgmtFee        = rentPCM * (mgmtPct / 100)
  return rentPCM - monthlyMortgage - voidAllowance - mgmtFee
}

/**
 * Interest Coverage Ratio at a given stress-test rate.
 *
 * @param {number} rentPCM
 * @param {number} askingPrice
 * @param {number} ltv
 * @param {number} stressRate  - e.g. 0.06 (6%)
 * @returns {number} ICR as a percentage (e.g. 125)
 */
function calcICR(rentPCM, askingPrice, ltv, stressRate) {
  const annualRent     = rentPCM * 12
  const annualInterest = askingPrice * ltv * stressRate
  if (!annualInterest) return Infinity
  return (annualRent / annualInterest) * 100
}

// ── Per-strategy assessment ───────────────────────────────────────────────────

function assessBTL(deal) {
  const reasons = []
  const {
    askingPrice,
    marketValue,
    postWorksGDV,
    rentPCM,
    voidRiskPct = 5,
    ltv = 0.75,
    mortgageRate = 0.06,
  } = deal

  const bmvCurrent  = calcBmvPct(askingPrice, marketValue)
  const bmvPostWorks = postWorksGDV ? calcBmvPct(askingPrice, postWorksGDV) : null
  const grossYield  = calcGrossYield(rentPCM, askingPrice)
  const cashflow    = calcNetMonthlyCashflow(rentPCM, askingPrice, ltv, mortgageRate, voidRiskPct)
  const icr         = calcICR(rentPCM, askingPrice, ltv, 0.06)

  const bmvOk = bmvCurrent >= 15 || (bmvPostWorks != null && bmvPostWorks >= 20)
  if (!bmvOk) {
    reasons.push(
      `BMV ${bmvCurrent.toFixed(1)}% (need ≥15% on current MV${bmvPostWorks != null ? ` or ≥20% on post-works GDV ${bmvPostWorks.toFixed(1)}%` : ''})`
    )
  }

  if (grossYield < 7) {
    reasons.push(`Gross yield ${grossYield.toFixed(1)}% < 7% minimum`)
  }

  if (cashflow <= 0) {
    reasons.push(`Net monthly cashflow £${cashflow.toFixed(0)} (negative)`)
  }

  if (icr < 125) {
    reasons.push(`ICR ${icr.toFixed(0)}% < 125% at 6% stress-test`)
  }

  const viable = reasons.length === 0
  if (viable) {
    reasons.push(
      `BMV ${bmvCurrent.toFixed(1)}%, yield ${grossYield.toFixed(1)}%, cashflow £${cashflow.toFixed(0)}/mo, ICR ${icr.toFixed(0)}%`
    )
  }

  return { viable, reasons }
}

function assessBRRR(deal) {
  const reasons = []
  const {
    askingPrice,
    postWorksGDV,
    refurbCosts = 0,
    closingCosts = 0,
    rentPCM,
    voidRiskPct = 5,
    ltv = 0.75,
    mortgageRate = 0.06,
  } = deal

  if (!postWorksGDV) {
    return { viable: false, reasons: ['No post-works GDV provided — BRRR cannot be assessed'] }
  }

  if (!refurbCosts || refurbCosts <= 0) {
    return { viable: false, reasons: ['No refurb cost provided — BRRR requires a refurb budget'] }
  }

  const totalCashIn  = askingPrice + refurbCosts + closingCosts
  const refinanceVal = postWorksGDV * 0.75  // 75% LTV refinance

  // 75% LTV of post-works GDV must cover ≥80% of total cash invested
  const refinanceCoverage = refinanceVal / totalCashIn
  if (refinanceCoverage < 0.80) {
    reasons.push(
      `Refinance (75% of GDV £${refinanceVal.toLocaleString()}) covers only ${(refinanceCoverage * 100).toFixed(0)}% of total cash in £${totalCashIn.toLocaleString()} (need ≥80%)`
    )
  }

  // Post-refinance cashflow
  const refinancedLoan      = postWorksGDV * ltv
  const monthlyMortgage     = (refinancedLoan * mortgageRate) / 12
  const voidAllowance       = rentPCM * (voidRiskPct / 100)
  const mgmtFee             = rentPCM * 0.10
  const postRefinanceCashflow = rentPCM - monthlyMortgage - voidAllowance - mgmtFee

  if (postRefinanceCashflow <= 0) {
    reasons.push(`Post-refinance cashflow £${postRefinanceCashflow.toFixed(0)} (negative)`)
  }

  const viable = reasons.length === 0
  if (viable) {
    reasons.push(
      `Refinance covers ${(refinanceCoverage * 100).toFixed(0)}% of cash in, post-refi cashflow £${postRefinanceCashflow.toFixed(0)}/mo`
    )
  }

  return { viable, reasons }
}

function assessBuyAndHold(deal) {
  const reasons = []
  const { askingPrice, marketValue, rentPCM, voidRiskPct = 5, ltv = 0.75, mortgageRate = 0.06 } = deal

  const bmv = calcBmvPct(askingPrice, marketValue)
  if (bmv < 10) {
    reasons.push(`BMV ${bmv.toFixed(1)}% < 10% minimum for Buy & Hold`)
  }

  const cashflow = calcNetMonthlyCashflow(rentPCM, askingPrice, ltv, mortgageRate, voidRiskPct)
  if (cashflow < 0) {
    reasons.push(`Net monthly cashflow £${cashflow.toFixed(0)} (negative — at least neutral required)`)
  }

  const viable = reasons.length === 0
  if (viable) {
    reasons.push(`BMV ${bmv.toFixed(1)}%, cashflow £${cashflow.toFixed(0)}/mo`)
  }

  return { viable, reasons }
}

function assessFlip(deal) {
  const reasons = []
  const {
    askingPrice,
    marketValue,
    refurbCosts = 0,
    closingCosts = 0,
  } = deal

  const totalCosts    = askingPrice + refurbCosts + closingCosts
  const profit        = (marketValue || 0) - totalCosts
  const profitOnCost  = totalCosts > 0 ? (profit / totalCosts) * 100 : 0

  if (profitOnCost < 20) {
    reasons.push(`Profit on cost ${profitOnCost.toFixed(1)}% < 20% minimum (profit £${profit.toLocaleString()})`)
  }

  // Flag if asking price is within 5% of the ceiling (MV)
  if (marketValue) {
    const headroomPct = ((marketValue - askingPrice) / marketValue) * 100
    if (headroomPct < 5) {
      reasons.push(
        `⚠️ Asking price (£${askingPrice.toLocaleString()}) within ${headroomPct.toFixed(1)}% of market value ceiling — limited flip margin`
      )
    }
  }

  const viable = reasons.length === 0
  if (viable) {
    reasons.push(`Profit on cost ${profitOnCost.toFixed(1)}%, profit £${profit.toLocaleString()}`)
  }

  return { viable, reasons }
}

// ── Recommended strategy ──────────────────────────────────────────────────────

/**
 * Pick the best strategy from those that are viable.
 * Priority: BTL > BRRR > buyAndHold > flip
 *
 * @param {Record<Strategy, {viable: boolean}>} strategies
 * @returns {Strategy | null}
 */
function pickRecommended(strategies) {
  const priority = ['btl', 'brrr', 'buyAndHold', 'flip']
  return priority.find(s => strategies[s]?.viable) || null
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Validate a deal across all strategies.
 *
 * @param {Object} dealData - Enriched deal object (includes resolved rent, tax, etc.)
 * @returns {{
 *   strategies: Record<Strategy, {viable: boolean, reasons: string[]}>,
 *   viableCount: number,
 *   recommended: Strategy | null,
 *   globalDisqualified: boolean,
 *   globalDisqualifyReasons: string[],
 *   headline: string
 * }}
 */
function validateDeal(dealData) {
  const {
    askingPrice,
    marketValue,
    postcode,
    propertyType,
    majorStructuralIssues = false,
  } = dealData

  // ── Global disqualifiers ────────────────────────────────────────────────────
  const globalDisqualifyReasons = []

  if (!postcode) globalDisqualifyReasons.push('Missing postcode')
  if (!askingPrice) globalDisqualifyReasons.push('Missing asking price')
  if (!marketValue) globalDisqualifyReasons.push('Missing market value')

  if (askingPrice > 500_000) {
    globalDisqualifyReasons.push(`Asking price £${askingPrice.toLocaleString()} exceeds £500,000 maximum`)
  }

  if (propertyType) {
    const type = propertyType.toLowerCase().replace(/[-_ ]/g, '_')
    if (DISQUALIFIED_TYPES.some(d => type.includes(d))) {
      globalDisqualifyReasons.push(`Property type '${propertyType}' is not eligible (commercial / land / mixed-use)`)
    }
  }

  if (majorStructuralIssues) {
    globalDisqualifyReasons.push('Major structural issues flagged — all strategies disqualified')
  }

  if (globalDisqualifyReasons.length > 0) {
    const emptyStrategy = { viable: false, reasons: globalDisqualifyReasons }
    return {
      strategies: {
        btl:        emptyStrategy,
        brrr:       emptyStrategy,
        buyAndHold: emptyStrategy,
        flip:       emptyStrategy,
      },
      viableCount: 0,
      recommended: null,
      globalDisqualified: true,
      globalDisqualifyReasons,
      headline: `All strategies disqualified: ${globalDisqualifyReasons.join('; ')}`,
    }
  }

  // ── Per-strategy assessment ─────────────────────────────────────────────────
  const strategies = {
    btl:        assessBTL(dealData),
    brrr:       assessBRRR(dealData),
    buyAndHold: assessBuyAndHold(dealData),
    flip:       assessFlip(dealData),
  }

  const viableCount  = Object.values(strategies).filter(s => s.viable).length
  const recommended  = pickRecommended(strategies)

  const emoji = (s) => strategies[s].viable ? '✅' : '❌'
  const headline =
    `${viableCount} of 4 strategies viable: ` +
    `BTL ${emoji('btl')} BRRR ${emoji('brrr')} Buy & Hold ${emoji('buyAndHold')} Flip ${emoji('flip')}`

  return {
    strategies,
    viableCount,
    recommended,
    globalDisqualified: false,
    globalDisqualifyReasons: [],
    headline,
  }
}

module.exports = {
  validateDeal,
  assessBTL,
  assessBRRR,
  assessBuyAndHold,
  assessFlip,
  calcBmvPct,
  calcGrossYield,
  calcNetMonthlyCashflow,
  calcICR,
}
