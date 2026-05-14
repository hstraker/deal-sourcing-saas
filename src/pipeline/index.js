/**
 * Pipeline Entry Point
 * ---------------------
 * Orchestrates the full deal analysis pipeline in the correct order:
 *
 *  1. detectJurisdiction
 *  2. resolveRent
 *  3. calculateTax
 *  4. getWelshTenancyContext (Welsh only)
 *  5. validateDeal (per-strategy)
 *  6. scoreDeal
 *  7. formatOutput
 *  8. saveToDatabase
 *  9. sendNotification (if viableCount >= 1)
 *
 * Rent MUST be resolved before validation or scoring.
 * Jurisdiction MUST be detected before any other step.
 */

const { detectJurisdiction, isWelsh }  = require('./jurisdictionDetector')
const { resolveRent }                  = require('./rentResolver')
const { calculateTax }                 = require('./taxCalculator')
const { getWelshTenancyContext }       = require('./welshTenancyRules')
const { validateDeal, calcBmvPct, calcGrossYield, calcNetMonthlyCashflow, calcICR } = require('./validator')
const { hydrateDeal }                  = require('../models/deal')
const { formatDealSummary }            = require('../output/formatter')

// These are optional external modules — gracefully no-op if not present
let calculateDealScore = null
let saveToDatabase     = null
let sendNotification   = null

try { ({ calculateDealScore } = require('../../lib/deal-scoring'))   } catch (_) {}
try { saveToDatabase           = require('../services/database')      } catch (_) {}
try { sendNotification         = require('../notifications/twilio')   } catch (_) {}

// ── Financial metric derivations ──────────────────────────────────────────────

/**
 * Derive all financial metrics for a hydrated deal + resolved rent.
 * @param {Object} deal
 * @param {Object} rentResult
 * @returns {Object}
 */
function deriveMetrics(deal, rentResult) {
  const { askingPrice, marketValue, postWorksGDV, closingCosts = 0, refurbCosts = 0, ltv = 0.75, mortgageRate = 0.06 } = deal
  const rentPCM    = rentResult?.rentPCM ?? 0
  const voidRiskPct = rentResult?.voidRiskPct ?? 5

  const taxEstimate  = 0  // Will be filled after tax calculation
  const totalCashIn  = askingPrice + refurbCosts + closingCosts

  const bmvCurrentPct   = calcBmvPct(askingPrice, marketValue)
  const bmvPostWorksPct = postWorksGDV ? calcBmvPct(askingPrice, postWorksGDV) : null

  const grossYieldPct = calcGrossYield(rentPCM, askingPrice)
  const annualRent    = rentPCM * 12
  const netYieldPct   = totalCashIn > 0
    ? ((annualRent * (1 - voidRiskPct / 100) * 0.9) / totalCashIn) * 100
    : 0

  const monthlyCashflow = calcNetMonthlyCashflow(rentPCM, askingPrice, ltv, mortgageRate, voidRiskPct)
  const icrAtStress     = calcICR(rentPCM, askingPrice, ltv, 0.06)

  return {
    bmvCurrentPct,
    bmvPostWorksPct,
    grossYieldPct,
    netYieldPct,
    monthlyCashflow,
    icrAtStress,
    totalCashIn,
  }
}

// ── SMS notification text ─────────────────────────────────────────────────────

/**
 * Build the Twilio SMS alert text.
 *
 * @param {Object} deal
 * @param {Object} validation
 * @returns {string}
 */
function buildSmsAlert(deal, validation) {
  const { viableCount, strategies, recommended } = validation
  const location = deal.postcode ?? deal.address?.split(',').pop()?.trim() ?? 'Unknown'

  const strategyEmojis = [
    `BTL ${strategies.btl.viable ? '✅' : '❌'}`,
    `BRRR ${strategies.brrr.viable ? '✅' : '❌'}`,
  ].join(' ')

  const recLabel = recommended
    ? { btl: 'BTL', brrr: 'BRRR', buyAndHold: 'B&H', flip: 'Flip' }[recommended]
    : 'None'

  return `[DEAL ALERT] ${viableCount}/4 strategies viable — ${location}. ${strategyEmojis}. Recommended: ${recLabel}. Reply INFO for full report.`
}

// ── Main pipeline runner ──────────────────────────────────────────────────────

/**
 * Run the full deal analysis pipeline for a single deal input.
 *
 * @param {Partial<import('../models/deal').DealInput>} rawDealInput
 * @param {Object | null} apiData - Data from PropertyData API (rent, comparables, etc.)
 * @param {Object} [options]
 * @param {boolean} [options.skipNotification=false]
 * @param {boolean} [options.skipDatabase=false]
 * @param {boolean} [options.verbose=false]
 * @returns {Promise<Object>} Full enriched deal result
 */
async function runPipeline(rawDealInput, apiData = null, options = {}) {
  const { skipNotification = false, skipDatabase = false, verbose = false } = options

  const log = verbose ? console.log : () => {}

  // ── Step 1: Hydrate deal with defaults ───────────────────────────────────
  const deal = hydrateDeal(rawDealInput)
  log('[1] Deal hydrated:', deal.address)

  // ── Step 2: Detect jurisdiction ──────────────────────────────────────────
  const jurisdiction = detectJurisdiction(deal.postcode)
  deal._isWelsh      = isWelsh(deal.postcode)
  log(`[2] Jurisdiction: ${jurisdiction}`)

  // ── Step 3: Resolve rent ─────────────────────────────────────────────────
  const rentResult = resolveRent(deal, apiData?.rent ?? null)
  log(`[3] Rent resolved: £${rentResult.rentPCM}/mo (${rentResult.source}, ${rentResult.confidence})`)

  // Inject resolved rent into deal data for downstream validators
  const enrichedDeal = {
    ...deal,
    rentPCM:      rentResult.rentPCM,
    voidRiskPct:  rentResult.voidRiskPct,
  }

  // ── Step 4: Calculate tax ────────────────────────────────────────────────
  const taxResult = calculateTax(
    deal.askingPrice,
    jurisdiction,
    { sourcerQuote: deal.sourcerTaxQuote }
  )
  log(`[4] Tax (${taxResult.taxType}): £${taxResult.taxAmount}`)

  if (taxResult.discrepancyFlag) {
    log(`  ⚠️  Tax discrepancy flagged — sourcer: £${taxResult.sourcerQuote}, calculated: £${taxResult.taxAmount}`)
  }

  // ── Step 5: Welsh tenancy context ────────────────────────────────────────
  const welshTenancy = getWelshTenancyContext(enrichedDeal)
  if (welshTenancy.applicable) {
    log(`[5] Welsh tenancy: ${welshTenancy.contractType}, notice ${welshTenancy.landlordNoticePeriodMonths}mo, void ${welshTenancy.voidRiskPct}%`)
  } else {
    log('[5] Welsh tenancy: not applicable (English property)')
  }

  // ── Step 6: Per-strategy validation ──────────────────────────────────────
  const validation = validateDeal({
    ...enrichedDeal,
    closingCosts: (deal.closingCosts ?? 1300) + (taxResult.taxAmount ?? 0),
  })
  log(`[6] Validation: ${validation.headline}`)

  // ── Step 7: Deal scoring ─────────────────────────────────────────────────
  let scoreResult = null
  if (typeof calculateDealScore === 'function') {
    scoreResult = calculateDealScore({
      askingPrice:          deal.askingPrice,
      marketValue:          deal.marketValue,
      estimatedRefurbCost:  deal.refurbCosts,
      afterRefurbValue:     deal.postWorksGDV,
      estimatedMonthlyRent: rentResult.rentPCM,
      bedrooms:             deal.bedrooms,
      propertyType:         deal.propertyType,
      postcode:             deal.postcode,
    })
    log(`[7] Deal score: ${scoreResult.score}/100`)
  } else {
    log('[7] Deal scoring module not available — skipped')
  }

  // ── Step 8: Derive financial metrics ─────────────────────────────────────
  const metrics = deriveMetrics(enrichedDeal, rentResult)

  // ── Step 9: Format output ─────────────────────────────────────────────────
  const pipelineResult = {
    deal: enrichedDeal,
    jurisdiction,
    rentResult,
    taxResult,
    welshTenancy,
    validation,
    scoreResult,
    rentComparables: apiData?.rentComparables ?? [],
    ...metrics,
  }

  const formattedOutput = formatDealSummary(pipelineResult)
  log('[9] Output formatted')

  // ── Step 10: Save to database ─────────────────────────────────────────────
  if (!skipDatabase && typeof saveToDatabase === 'function') {
    try {
      await saveToDatabase(pipelineResult)
      log('[10] Saved to database')
    } catch (err) {
      console.error('[10] Database save failed:', err.message)
    }
  }

  // ── Step 11: Send notification if any strategy is viable ──────────────────
  if (!skipNotification && validation.viableCount >= 1 && typeof sendNotification === 'function') {
    try {
      const smsText = buildSmsAlert(deal, validation)
      await sendNotification(smsText)
      log(`[11] Notification sent: "${smsText}"`)
    } catch (err) {
      console.error('[11] Notification failed:', err.message)
    }
  } else if (validation.viableCount === 0) {
    log('[11] No notification — no viable strategies')
  }

  return {
    ...pipelineResult,
    formattedOutput,
  }
}

module.exports = { runPipeline, buildSmsAlert, deriveMetrics }
