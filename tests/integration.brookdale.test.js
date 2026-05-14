/**
 * Integration test — Brookdale Street
 * ------------------------------------
 * This is the deal that previously produced a false FAIL because:
 *  1. API rent of £505 was used instead of verified tenant rent of £850
 *  2. SDLT was calculated instead of Welsh LTT
 *  3. A single global PASS/FAIL prevented any strategy from being evaluated
 *
 * All assertions below reflect the CORRECTED expected behaviour.
 *
 * Run with: node tests/integration.brookdale.test.js
 */

const assert = require('assert')
const { detectJurisdiction, isWelsh }  = require('../src/pipeline/jurisdictionDetector')
const { resolveRent }                  = require('../src/pipeline/rentResolver')
const { calculateTax }                 = require('../src/pipeline/taxCalculator')
const { getWelshTenancyContext }       = require('../src/pipeline/welshTenancyRules')
const { validateDeal, calcBmvPct }     = require('../src/pipeline/validator')
const { formatDealSummary }            = require('../src/output/formatter')

// ── Input ─────────────────────────────────────────────────────────────────────
const dealInput = {
  address:              'Brookdale Street, Neath',
  postcode:             'SA11 1PE',
  askingPrice:          86_000,
  marketValue:          105_000,
  propertyType:         'terraced_house',
  condition:            'average',
  isTenanted:           true,
  verifiedRent:         850,
  verifiedRentSource:   'Lewis Pownall, deal sourcer',
  verifiedRentDate:     '2026-05-13',
  tenantContractType:   'ftsc',
  tenantMonthsRemaining: null,
  tenantIssues:         false,
  addValuePotential:    'major',
  postWorksGDV:         115_000,
  epcRating:            'D',
  sourcerTaxQuote:      4_300,
  refurbCosts:          3_000,
  closingCosts:         1_300,
  mortgageRate:         0.06,
  ltv:                  0.75,
}

// Simulated API data (the old system was incorrectly using this rent)
const apiData = {
  rent: {
    rentPCM:          505,
    comparableCount:  4,
    comparableRange:  { min: 450, max: 560 },
  },
}

// ── Step 1: Jurisdiction ─────────────────────────────────────────────────────
const jurisdiction = detectJurisdiction(dealInput.postcode)
assert.strictEqual(jurisdiction, 'WALES', 'SA11 → WALES')

const welsh = isWelsh(dealInput.postcode)
assert.strictEqual(welsh, true)

// ── Step 2: Rent resolution ──────────────────────────────────────────────────
const rentResult = resolveRent(dealInput, apiData.rent)

assert.strictEqual(rentResult.rentPCM,    850,              'Rent: £850 (not API £505)')
assert.strictEqual(rentResult.source,     'verified_tenant')
assert.strictEqual(rentResult.confidence, 'verified',       'Confidence: verified')
assert.strictEqual(rentResult.warning,    null,             'No warning for verified rent')
assert.strictEqual(rentResult.voidRiskPct, 2,              'Void risk: 2% (sitting tenant)')

// ── Step 3: Tax ──────────────────────────────────────────────────────────────
const taxResult = calculateTax(dealInput.askingPrice, jurisdiction, {
  sourcerQuote: dealInput.sourcerTaxQuote,
})

assert.strictEqual(taxResult.taxType,         'LTT',  'Tax: LTT (not SDLT)')
assert.strictEqual(taxResult.taxAmount,        3_440, 'LTT: £3,440 (not sourcer £4,300)')
assert.strictEqual(taxResult.discrepancyFlag,  true,  'Discrepancy flag: true (£860 difference)')

// ── Step 4: BMV calculations ─────────────────────────────────────────────────
const bmvCurrentPct   = calcBmvPct(dealInput.askingPrice, dealInput.marketValue)
const bmvPostWorksPct = calcBmvPct(dealInput.askingPrice, dealInput.postWorksGDV)

// (105000 - 86000) / 105000 = 18.095...%
assert.ok(bmvCurrentPct  >= 18.0 && bmvCurrentPct  <= 18.2, `BMV current ~18.1% (got ${bmvCurrentPct.toFixed(1)}%)`)
// (115000 - 86000) / 115000 = 25.217...%
assert.ok(bmvPostWorksPct >= 25.0 && bmvPostWorksPct <= 25.4, `BMV post-works ~25.2% (got ${bmvPostWorksPct.toFixed(1)}%)`)

// ── Step 5: Welsh tenancy ────────────────────────────────────────────────────
const welshTenancy = getWelshTenancyContext({
  ...dealInput,
  _isWelsh: true,
})

assert.strictEqual(welshTenancy.applicable,                true)
assert.strictEqual(welshTenancy.landlordNoticePeriodMonths, 6)
assert.strictEqual(welshTenancy.epcMediumTermRisk,         true, 'EPC D → medium-term risk')
assert.ok(welshTenancy.epcWarning,                              'EPC D → warning present')

// ── Step 6: Validation ───────────────────────────────────────────────────────
const enrichedDeal = {
  ...dealInput,
  rentPCM:      rentResult.rentPCM,
  voidRiskPct:  rentResult.voidRiskPct,
  closingCosts: dealInput.closingCosts + taxResult.taxAmount,
}

const validation = validateDeal(enrichedDeal)

assert.strictEqual(validation.globalDisqualified,          false, 'Not globally disqualified')
assert.strictEqual(validation.strategies.btl.viable,       true,  'BTL: viable ✅')
assert.strictEqual(validation.strategies.brrr.viable,      true,  'BRRR: viable ✅')
assert.ok(validation.viableCount >= 2, `At least 2 strategies viable (got ${validation.viableCount})`)
assert.ok(validation.recommended,      'Recommended strategy present')

// ── Step 7: Output format ────────────────────────────────────────────────────
const output = formatDealSummary({
  deal: enrichedDeal,
  jurisdiction,
  rentResult,
  taxResult,
  welshTenancy,
  validation,
  scoreResult:       null,
  rentComparables:   [],
  bmvCurrentPct,
  bmvPostWorksPct,
  grossYieldPct:     (rentResult.rentPCM * 12 / dealInput.askingPrice) * 100,
  netYieldPct:       null,
  monthlyCashflow:   null,
  icrAtStress:       null,
  totalCashIn:       dealInput.askingPrice + dealInput.refurbCosts + dealInput.closingCosts,
})

assert.ok(output.includes('WELSH PROPERTY'),        'Output: Welsh flag present')
assert.ok(output.includes('£850'),                  'Output: £850 rent visible')
assert.ok(output.includes('LTT'),                   'Output: LTT (not SDLT)')
assert.ok(output.includes('£3,440'),                'Output: correct LTT amount')
assert.ok(output.includes('WELSH LAW NOTES'),       'Output: Welsh law notes section present')
assert.ok(output.includes('medium-term risk'),      'Output: EPC D risk mentioned')
assert.ok(!output.includes('GLOBAL FAIL'),          'Output: no global FAIL message')
assert.ok(output.includes('✅'),                    'Output: at least one viable strategy ✅')

console.log('\n✅ Integration test — Brookdale Street: ALL CHECKS PASSED')
console.log('─'.repeat(60))
console.log('\nFormatted output preview:\n')
console.log(output.split('\n').slice(0, 40).join('\n'))
console.log('\n... (output truncated for preview)')
