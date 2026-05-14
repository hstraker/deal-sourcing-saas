/**
 * Unit tests — jurisdictionDetector.js
 *
 * Run with: node --test tests/jurisdictionDetector.test.js
 * Or with Jest: jest tests/jurisdictionDetector.test.js
 */

const assert = require('assert')
const { detectJurisdiction, isWelsh } = require('../src/pipeline/jurisdictionDetector')

// ── detectJurisdiction ────────────────────────────────────────────────────────

// Welsh prefixes
assert.strictEqual(detectJurisdiction('CF24 0AB'), 'WALES',   'CF prefix → WALES')
assert.strictEqual(detectJurisdiction('NP10 0AA'), 'WALES',   'NP prefix → WALES')
assert.strictEqual(detectJurisdiction('SA11 1PE'), 'WALES',   'SA prefix → WALES')
assert.strictEqual(detectJurisdiction('LL57 2DG'), 'WALES',   'LL prefix → WALES')
assert.strictEqual(detectJurisdiction('LD1 5AB'),  'WALES',   'LD prefix → WALES')

// English postcode
assert.strictEqual(detectJurisdiction('M1 1AA'),   'ENGLAND', 'M1 → ENGLAND')
assert.strictEqual(detectJurisdiction('SW1A 1AA'), 'ENGLAND', 'SW1A → ENGLAND')
assert.strictEqual(detectJurisdiction('EC1A 1BB'), 'ENGLAND', 'EC1A → ENGLAND')
assert.strictEqual(detectJurisdiction('BS1 1TU'),  'ENGLAND', 'BS1 → ENGLAND')

// Mixed case input — should normalise correctly
assert.strictEqual(detectJurisdiction('sa11 1pe'), 'WALES',   'lowercase sa → WALES')
assert.strictEqual(detectJurisdiction('Cf24 0ab'), 'WALES',   'mixed case Cf → WALES')
assert.strictEqual(detectJurisdiction('nP10 0aa'), 'WALES',   'mixed case nP → WALES')

// Extra whitespace
assert.strictEqual(detectJurisdiction('  SA11 1PE  '), 'WALES',   'whitespace padded SA → WALES')
assert.strictEqual(detectJurisdiction('  M1 1AA  '),   'ENGLAND', 'whitespace padded M1 → ENGLAND')

// ── isWelsh ───────────────────────────────────────────────────────────────────

assert.strictEqual(isWelsh('CF24 0AB'), true,  'isWelsh CF → true')
assert.strictEqual(isWelsh('SW1A 1AA'), false, 'isWelsh SW1A → false')
assert.strictEqual(isWelsh('sa11 1pe'), true,  'isWelsh lowercase sa → true')
assert.strictEqual(isWelsh('  LL57 '),  true,  'isWelsh padded LL → true')

console.log('✅ jurisdictionDetector: all tests passed')
