/**
 * Unit tests — validator.js
 *
 * Run with: node --test tests/validator.test.js
 * Or with Jest: jest tests/validator.test.js
 */

const assert = require('assert')
const { validateDeal } = require('../src/pipeline/validator')

// ── Brookdale Street scenario ─────────────────────────────────────────────────
// £86k purchase, £105k MV, £850/mo rent → BTL and BRRR should be viable
const brookdale = validateDeal({
  address:       'Brookdale Street, Neath',
  postcode:      'SA11 1PE',
  askingPrice:   86_000,
  marketValue:   105_000,
  postWorksGDV:  115_000,
  propertyType:  'terraced_house',
  rentPCM:       850,
  voidRiskPct:   2,      // verified tenant
  refurbCosts:   3_000,
  closingCosts:  1_300 + 3_440,  // closing + LTT
  ltv:           0.75,
  mortgageRate:  0.06,
})

assert.strictEqual(brookdale.globalDisqualified, false, 'Brookdale: not globally disqualified')
assert.strictEqual(brookdale.strategies.btl.viable, true,  'Brookdale: BTL viable')
assert.strictEqual(brookdale.strategies.brrr.viable, true, 'Brookdale: BRRR viable')
assert.ok(brookdale.viableCount >= 2, `Brookdale: at least 2 viable (got ${brookdale.viableCount})`)
assert.ok(brookdale.headline.includes('✅'), 'Headline contains ✅')
assert.ok(/\d of 4/.test(brookdale.headline), 'Headline has "X of 4" format')
assert.ok(brookdale.recommended, 'Brookdale: recommended strategy present')

// ── Global disqualifier short-circuits all strategies ─────────────────────────
const structuralIssue = validateDeal({
  postcode:            'SA11 1PE',
  askingPrice:         86_000,
  marketValue:         105_000,
  majorStructuralIssues: true,
  rentPCM:             850,
})
assert.strictEqual(structuralIssue.globalDisqualified,          true,  'Structural issues: globally disqualified')
assert.strictEqual(structuralIssue.viableCount,                 0,     'Structural issues: 0 viable')
assert.strictEqual(structuralIssue.strategies.btl.viable,       false, 'BTL blocked')
assert.strictEqual(structuralIssue.strategies.brrr.viable,      false, 'BRRR blocked')
assert.strictEqual(structuralIssue.strategies.buyAndHold.viable, false, 'Buy & Hold blocked')
assert.strictEqual(structuralIssue.strategies.flip.viable,      false, 'Flip blocked')

// Asking price over £500k global disqualifier
const tooExpensive = validateDeal({
  postcode:     'M1 1AA',
  askingPrice:  600_000,
  marketValue:  700_000,
  rentPCM:      2_000,
})
assert.strictEqual(tooExpensive.globalDisqualified, true, '£600k: globally disqualified')
assert.ok(tooExpensive.globalDisqualifyReasons.some(r => r.includes('500,000')), 'Reason mentions £500k limit')

// ── BRRR fails gracefully when no post-works GDV ─────────────────────────────
const noGDV = validateDeal({
  postcode:    'SA11 1PE',
  askingPrice: 86_000,
  marketValue: 105_000,
  rentPCM:     850,
  // postWorksGDV intentionally omitted
  refurbCosts: 3_000,
})
assert.strictEqual(noGDV.strategies.brrr.viable, false, 'BRRR: not viable without GDV')
assert.ok(
  noGDV.strategies.brrr.reasons.some(r => r.includes('GDV')),
  'BRRR reason mentions missing GDV'
)

// ── Missing required fields disqualify ───────────────────────────────────────
const missingFields = validateDeal({
  // askingPrice intentionally omitted
  postcode:    'SA11 1PE',
  marketValue: 105_000,
  rentPCM:     850,
})
assert.strictEqual(missingFields.globalDisqualified, true, 'Missing asking price: disqualified')

// ── Buy & Hold: BMV below 10% fails ──────────────────────────────────────────
const lowBmvHold = validateDeal({
  postcode:    'SA11 1PE',
  askingPrice: 100_000,
  marketValue: 103_000,  // only 2.9% BMV
  rentPCM:     700,
})
assert.strictEqual(lowBmvHold.strategies.buyAndHold.viable, false, 'Buy & Hold: fails at <10% BMV')

// ── Headline string format ────────────────────────────────────────────────────
const { headline } = brookdale
assert.ok(headline.match(/^\d of 4 strategies viable/), `Headline format correct: "${headline}"`)
assert.ok(headline.includes('BTL'),        'Headline includes BTL')
assert.ok(headline.includes('BRRR'),       'Headline includes BRRR')
assert.ok(headline.includes('Buy & Hold'), 'Headline includes Buy & Hold')
assert.ok(headline.includes('Flip'),       'Headline includes Flip')

console.log('✅ validator: all tests passed')
