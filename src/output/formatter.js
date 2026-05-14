/**
 * Deal Analysis Output Formatter
 * --------------------------------
 * Produces the standardised deal analysis summary string from a fully-enriched
 * deal result object. Supports both Welsh and English properties.
 *
 * All currency values use £ prefix with comma-thousand separators.
 * All percentages are formatted to 1 decimal place.
 */

// ── Formatting helpers ────────────────────────────────────────────────────────

/**
 * Format a number as GBP currency.
 * @param {number | null | undefined} amount
 * @returns {string}
 */
function fmtCurrency(amount) {
  if (amount == null) return 'N/A'
  return `£${Math.round(amount).toLocaleString('en-GB')}`
}

/**
 * Format a number as a percentage to 1dp.
 * @param {number | null | undefined} pct
 * @returns {string}
 */
function fmtPct(pct) {
  if (pct == null) return 'N/A'
  return `${Number(pct).toFixed(1)}%`
}

/**
 * Format a strategy result row.
 * @param {string} label
 * @param {{viable: boolean, reasons: string[]}} result
 * @returns {string}
 */
function fmtStrategy(label, result) {
  const statusStr = result.viable ? '✅ VIABLE' : '❌ NOT VIABLE'
  const reason    = result.reasons[0] ?? ''
  return `${label.padEnd(11)} ${statusStr.padEnd(14)} — ${reason}`
}

/**
 * Format the comparable rent table.
 * @param {Array<{address?: string, beds?: number, rentPCM?: number, distance?: string, date?: string}>} comps
 * @returns {string}
 */
function fmtRentComps(comps) {
  if (!comps || comps.length === 0) return '  No comparable rentals available'

  const header = '  Address              | Beds | Rent/mo | Distance | Date'
  const divider = '  ---------------------|------|---------|----------|------'
  const rows = comps.map(c => {
    const addr = (c.address || 'Unknown').substring(0, 20).padEnd(20)
    const beds = String(c.beds ?? '?').padStart(4)
    const rent = fmtCurrency(c.rentPCM).padStart(7)
    const dist = (c.distance || '?').padStart(8)
    const date = (c.date || '?').padStart(10)
    return `  ${addr} |${beds} |${rent} |${dist} |${date}`
  })

  const avg = comps.reduce((s, c) => s + (c.rentPCM || 0), 0) / comps.length
  const avgRow = `  Average (${comps.length} comp${comps.length !== 1 ? 's' : ''}): ${fmtCurrency(avg)}/mo`

  return [header, divider, ...rows, avgRow].join('\n')
}

// ── Score breakdown ───────────────────────────────────────────────────────────

/**
 * @param {Object} scoreResult
 * @returns {string}
 */
function fmtScoreBreakdown(scoreResult) {
  if (!scoreResult) return '  N/A'
  const { score, breakdown } = scoreResult
  if (!breakdown) return `  Score: ${score}/100`

  const lines = []
  const bd = breakdown
  if (bd.bmv)        lines.push(`  BMV (30%):        ${bd.bmv.weightedScore}`)
  if (bd.yield)      lines.push(`  Yield (25%):      ${bd.yield.weightedScore}`)
  if (bd.condition)  lines.push(`  Condition (15%):  ${bd.condition.weightedScore}`)
  if (bd.location)   lines.push(`  Location (15%):   ${bd.location.weightedScore}`)
  if (bd.market)     lines.push(`  Market (10%):     ${bd.market.weightedScore}`)
  if (bd.additional) lines.push(`  Additional (5%):  ${bd.additional.weightedScore}`)
  return lines.join('\n')
}

// ── Main formatter ────────────────────────────────────────────────────────────

/**
 * Format a complete deal analysis result as a human-readable text summary.
 *
 * @param {Object} result - The fully-enriched deal result from the pipeline
 * @returns {string}
 */
function formatDealSummary(result) {
  const {
    // Core
    deal,
    jurisdiction,
    rentResult,
    taxResult,
    welshTenancy,
    validation,
    scoreResult,
    rentComparables = [],
    // Derived metrics (populated by pipeline)
    bmvCurrentPct,
    bmvPostWorksPct,
    grossYieldPct,
    netYieldPct,
    monthlyCashflow,
    icrAtStress,
    totalCashIn,
  } = result

  const isWales = jurisdiction === 'WALES'
  const flagEmoji = isWales ? '🏴󠁧󠁢󠁷󠁬󠁳󠁿 WELSH PROPERTY' : '🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLISH PROPERTY'

  // Tenancy line
  const tenancyLine = deal.isTenanted
    ? `Yes — ${fmtCurrency(rentResult?.rentPCM)}/mo, ${deal.tenantContractType ?? 'unknown contract'}, ${deal.tenantMonthsRemaining != null ? `${deal.tenantMonthsRemaining} months remaining` : 'duration unknown'}`
    : 'No — vacant'

  // Source label map
  const SOURCE_LABELS = {
    verified_tenant: 'Verified sitting tenant',
    agreed_tenant:   'Agreed with prospective tenant',
    sourcer_estimate: 'Sourcer estimate (unverified)',
    api_estimate:    'PropertyData API estimate',
  }

  const lines = []

  lines.push('DEAL ANALYSIS SUMMARY')
  lines.push('=====================')
  lines.push(flagEmoji)
  lines.push(`Property:   ${deal.address ?? 'Unknown'}`)
  lines.push(`Type:       ${deal.propertyType ?? 'Unknown'}`)
  lines.push(`Condition:  ${deal.condition ?? 'Unknown'}`)
  lines.push(`Tenanted:   ${tenancyLine}`)
  lines.push('')

  // ── Rent section ─────────────────────────────────────────────────────────
  lines.push('RENT')
  lines.push('----')
  if (rentResult) {
    lines.push(`Rent used:        ${fmtCurrency(rentResult.rentPCM)} PCM`)
    lines.push(`Source:           ${SOURCE_LABELS[rentResult.source] ?? rentResult.source}`)
    lines.push(`                  ${rentResult.sourceDetail}`)

    const compCount  = rentResult.apiComparableCount
    const compRange  = rentResult.apiComparableRange
    const compStr    = compCount != null ? `${compCount} comps` : '—'
    const rangeStr   = compRange ? `range ${fmtCurrency(compRange.min)}–${fmtCurrency(compRange.max)}` : 'range unknown'
    lines.push(`API comparables:  ${compStr}, ${rangeStr}, confidence: ${rentResult.confidence}`)

    if (rentResult.warning) {
      lines.push('')
      lines.push(`  ${rentResult.warning}`)
    }
  } else {
    lines.push('  No rent data resolved.')
  }
  lines.push('')
  lines.push('Rental comparables:')
  lines.push(fmtRentComps(rentComparables))
  lines.push('')

  // ── Financials ────────────────────────────────────────────────────────────
  // Low-confidence rent warning before financials
  if (rentResult?.confidence === 'low') {
    lines.push('⚠️  WARNING: Low confidence rent estimate — all financial projections below are unreliable.')
    lines.push('')
  }

  lines.push('FINANCIALS')
  lines.push('----------')
  lines.push(`Asking Price:     ${fmtCurrency(deal.askingPrice)}`)
  lines.push(`Market Value:     ${fmtCurrency(deal.marketValue)}`)
  lines.push(`BMV (current):    ${fmtPct(bmvCurrentPct)}`)

  if (deal.postWorksGDV) {
    lines.push(`Post-works GDV:   ${fmtCurrency(deal.postWorksGDV)}`)
    lines.push(`BMV (post-works): ${fmtPct(bmvPostWorksPct)}`)
  }

  const profit = (deal.marketValue ?? 0) - (deal.askingPrice ?? 0) - (deal.refurbCosts ?? 0) - (deal.closingCosts ?? 0) - (taxResult?.taxAmount ?? 0)
  lines.push(`Profit potential: ${fmtCurrency(profit)}`)
  lines.push('')

  if (taxResult) {
    lines.push(`Tax (${taxResult.taxType}):    ${fmtCurrency(taxResult.taxAmount)}`)
    if (taxResult.discrepancyFlag) {
      lines.push(`  ⚠️ Tax discrepancy: sourcer quoted ${fmtCurrency(taxResult.sourcerQuote)}, ${taxResult.taxType} calculates to ${fmtCurrency(taxResult.taxAmount)}. Use calculated figure.`)
    }
  }

  lines.push(`Closing costs:    ${fmtCurrency(deal.closingCosts)}`)
  lines.push(`Refurb:           ${fmtCurrency(deal.refurbCosts)}`)
  lines.push(`Total cash in:    ${fmtCurrency(totalCashIn)}`)
  lines.push('')

  lines.push(`Gross Yield:      ${fmtPct(grossYieldPct)}`)
  lines.push(`Net Yield:        ${fmtPct(netYieldPct)}`)
  lines.push(`Monthly cashflow: ${fmtCurrency(monthlyCashflow)}`)
  lines.push(`ICR at 6%:        ${icrAtStress != null ? fmtPct(icrAtStress) : 'N/A'}`)
  lines.push('')

  // ── Strategy viability ────────────────────────────────────────────────────
  lines.push('STRATEGY VIABILITY')
  lines.push('------------------')

  if (validation) {
    const { strategies, recommended } = validation
    lines.push(fmtStrategy('BTL:',        strategies.btl))
    lines.push(fmtStrategy('BRRR:',       strategies.brrr))
    lines.push(fmtStrategy('Buy & Hold:', strategies.buyAndHold))
    lines.push(fmtStrategy('Flip:',       strategies.flip))
    lines.push('')

    const recommendedLabel = recommended
      ? { btl: 'BTL', brrr: 'BRRR', buyAndHold: 'Buy & Hold', flip: 'Flip' }[recommended]
      : 'None'
    const recommendedRationale = recommended
      ? `${strategies[recommended].reasons[0] ?? ''}`
      : 'No strategies are currently viable for this deal'
    lines.push(`Recommended: ${recommendedLabel} — ${recommendedRationale}`)
    lines.push('')
  }

  // ── Deal score ────────────────────────────────────────────────────────────
  if (scoreResult) {
    lines.push(`DEAL SCORE: ${scoreResult.score}/100`)
    lines.push(fmtScoreBreakdown(scoreResult))
    lines.push('')
  }

  lines.push(`OVERALL: ${validation?.viableCount ?? 0} of 4 strategies viable`)
  lines.push('')

  // ── Welsh law notes ───────────────────────────────────────────────────────
  if (isWales && welshTenancy?.applicable) {
    lines.push('WELSH LAW NOTES')
    lines.push('----------------')
    lines.push(`Contract type:    ${welshTenancy.contractType ?? 'Unknown'}`)
    lines.push(`Notice period:    ${welshTenancy.landlordNoticePeriodMonths} months (landlord) — longer than English AST`)
    lines.push(`Void modelling:   ${welshTenancy.voidRiskPct}% applied`)
    lines.push(`EPC rating:       Band ${welshTenancy.epcRating ?? 'Unknown'} — ${welshTenancy.epcCompliant ? 'Compliant' : welshTenancy.epcCompliant === false ? 'Non-compliant ⚠️' : 'Unknown'}${welshTenancy.epcMediumTermRisk ? ' (medium-term risk — future C requirement)' : ''}`)

    if (taxResult) {
      const discLine = taxResult.discrepancyFlag
        ? `⚠️ DISCREPANCY: sourcer quoted ${fmtCurrency(taxResult.sourcerQuote)} vs calculated ${fmtCurrency(taxResult.taxAmount)} — use calculated`
        : taxResult.sourcerQuote != null
          ? `Matches sourcer quote (${fmtCurrency(taxResult.sourcerQuote)})`
          : 'No sourcer quote provided'
      lines.push(`LTT applied:      ${fmtCurrency(taxResult.taxAmount)} — ${discLine}`)
    }

    if (welshTenancy.notes && welshTenancy.notes.length > 0) {
      lines.push('')
      welshTenancy.notes.forEach(n => lines.push(`  • ${n}`))
    }

    lines.push('')
  }

  // ── Next steps ────────────────────────────────────────────────────────────
  lines.push('NEXT STEPS')
  lines.push('----------')
  const nextSteps = buildNextSteps(result)
  nextSteps.forEach(step => lines.push(`• ${step}`))

  return lines.join('\n')
}

/**
 * Build a context-aware list of next steps based on deal analysis outcome.
 * @param {Object} result
 * @returns {string[]}
 */
function buildNextSteps(result) {
  const steps = []
  const { validation, rentResult, taxResult, welshTenancy, deal } = result

  if (rentResult?.confidence === 'low' || rentResult?.source === 'sourcer_estimate') {
    steps.push('Verify rent figure — current estimate is low confidence. Call agent or check Rightmove/Zoopla comparables.')
  }

  if (taxResult?.discrepancyFlag) {
    steps.push(`Challenge sourcer on tax figure: calculated ${result.jurisdiction === 'WALES' ? 'LTT' : 'SDLT'} is £${(taxResult.taxAmount || 0).toLocaleString()} — sourcer quoted £${(taxResult.sourcerQuote || 0).toLocaleString()}.`)
  }

  if (welshTenancy?.applicable && welshTenancy.epcCompliant === false) {
    steps.push('Commission EPC improvement works before letting — property is currently below minimum Band E.')
  }

  if (welshTenancy?.applicable && welshTenancy.epcMediumTermRisk) {
    steps.push('Budget for EPC upgrades to reach Band C — future minimum requirement for Welsh rentals.')
  }

  if (!welshTenancy?.canGiveNoticeNow && deal?.isTenanted) {
    steps.push('Cannot serve notice to tenant yet (FTSC protected period). Confirm contract start/end dates.')
  }

  if (validation?.viableCount >= 1) {
    steps.push(`Proceed to offer stage — ${validation.viableCount} of 4 strategies viable (recommended: ${validation.recommended ?? 'N/A'}).`)
  } else {
    steps.push('Deal does not currently meet viability criteria. Negotiate purchase price or seek vendor discount.')
  }

  return steps
}

module.exports = { formatDealSummary, fmtCurrency, fmtPct, buildNextSteps }
