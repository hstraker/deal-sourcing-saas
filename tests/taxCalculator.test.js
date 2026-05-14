/**
 * Unit tests — taxCalculator.js
 *
 * Run with: node --test tests/taxCalculator.test.js
 * Or with Jest: jest tests/taxCalculator.test.js
 */

const assert = require('assert')
const { calculateTax } = require('../src/pipeline/taxCalculator')

// ── £86,000 Welsh → £3,440 (86000 × 4%) ─────────────────────────────────────
const welsh86k = calculateTax(86_000, 'WALES')
assert.strictEqual(welsh86k.taxType,   'LTT',    '£86k Welsh: taxType is LTT')
assert.strictEqual(welsh86k.taxAmount, 3_440,    '£86k Welsh: £3,440 tax (86000 × 4%)')
assert.strictEqual(welsh86k.jurisdiction, 'WALES')
assert.strictEqual(welsh86k.discrepancyFlag, false, 'No discrepancy when no sourcer quote')

// ── £86,000 English → £2,580 (86000 × 3%) ────────────────────────────────────
const eng86k = calculateTax(86_000, 'ENGLAND')
assert.strictEqual(eng86k.taxType,    'SDLT',   '£86k English: taxType is SDLT')
assert.strictEqual(eng86k.taxAmount,  2_580,    '£86k English: £2,580 tax (86000 × 3%)')

// ── £200,000 Welsh — crosses the £180,000 band boundary ──────────────────────
// £200k is in the £180,001–£250,000 band at 7.5% = £15,000
const welsh200k = calculateTax(200_000, 'WALES')
assert.strictEqual(welsh200k.taxType,   'LTT')
assert.strictEqual(welsh200k.taxAmount, 15_000, '£200k Welsh: £15,000 (200000 × 7.5%)')

// ── £260,000 Welsh — in the £250,001–£400,000 band at 9% ─────────────────────
const welsh260k = calculateTax(260_000, 'WALES')
assert.strictEqual(welsh260k.taxAmount, 23_400, '£260k Welsh: £23,400 (260000 × 9%)')

// ── Discrepancy flag triggers when sourcer quote differs by > £200 ────────────
const withSmallDiscrepancy = calculateTax(86_000, 'WALES', { sourcerQuote: 3_500 })
assert.strictEqual(withSmallDiscrepancy.sourcerQuote,     3_500)
assert.strictEqual(withSmallDiscrepancy.discrepancy,      60,    'Discrepancy: 3500 - 3440 = 60')
assert.strictEqual(withSmallDiscrepancy.discrepancyFlag,  false, 'Discrepancy £60 — flag NOT triggered (≤£200)')

const withLargeDiscrepancy = calculateTax(86_000, 'WALES', { sourcerQuote: 4_300 })
assert.strictEqual(withLargeDiscrepancy.discrepancy,      860,   'Discrepancy: 4300 - 3440 = 860')
assert.strictEqual(withLargeDiscrepancy.discrepancyFlag,  true,  'Discrepancy £860 — flag triggered (>£200)')

// ── Brookdale Street scenario: £86k in WALES, sourcer quoted £4,300 ──────────
const brookdale = calculateTax(86_000, 'WALES', { sourcerQuote: 4_300 })
assert.strictEqual(brookdale.taxAmount,       3_440)
assert.strictEqual(brookdale.discrepancyFlag, true)
assert.strictEqual(brookdale.discrepancy,     860)

// ── bandBreakdown contains the applicable band ────────────────────────────────
const breakdown = welsh86k.bandBreakdown
const applicableBand = breakdown.find(b => b.applicable)
assert.ok(applicableBand, 'There should be an applicable band')
assert.strictEqual(applicableBand.taxDue, 3_440)

console.log('✅ taxCalculator: all tests passed')
