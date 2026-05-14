/**
 * Unit tests — rentResolver.js
 *
 * Run with: node --test tests/rentResolver.test.js
 * Or with Jest: jest tests/rentResolver.test.js
 */

const assert = require('assert')
const { resolveRent, calcApiConfidence, resolveVoidRiskPct } = require('../src/pipeline/rentResolver')

// ── Verified rent takes priority over API estimate ────────────────────────────
const withVerified = resolveRent(
  {
    verifiedRent: 850,
    verifiedRentSource: 'Lewis Pownall, deal sourcer',
    verifiedRentDate: '2026-05-13',
    isTenanted: true,
    tenantIssues: false,
  },
  { rentPCM: 505, comparableCount: 6, comparableRange: { min: 450, max: 560 } }
)
assert.strictEqual(withVerified.rentPCM,     850,              'Verified rent: £850 used, not API £505')
assert.strictEqual(withVerified.source,      'verified_tenant')
assert.strictEqual(withVerified.confidence,  'verified')
assert.strictEqual(withVerified.warning,     null,             'No warning for verified rent')
assert.strictEqual(withVerified.voidRiskPct, 2,                'Void risk 2% for verified tenant')
assert.ok(withVerified.sourceDetail.includes('Lewis Pownall'), 'Source detail includes sourcer name')

// ── Agreed rent takes priority over sourcer and API ───────────────────────────
const withAgreed = resolveRent(
  { agreedRent: 750, sourcerEstimatedRent: 700, isTenanted: false },
  { rentPCM: 680, comparableCount: 5 }
)
assert.strictEqual(withAgreed.rentPCM, 750, 'Agreed rent: £750 used')
assert.strictEqual(withAgreed.source,  'agreed_tenant')
assert.strictEqual(withAgreed.confidence, 'verified')

// ── Sourcer estimate used when no verified/agreed rent ────────────────────────
const withSourcer = resolveRent(
  { sourcerEstimatedRent: 700 },
  { rentPCM: 680, comparableCount: 5, comparableRange: { min: 640, max: 720 } }
)
assert.strictEqual(withSourcer.rentPCM, 700,              'Sourcer estimate: £700 used')
assert.strictEqual(withSourcer.source,  'sourcer_estimate')
assert.ok(withSourcer.warning,          'Warning populated for unverified sourcer estimate')

// ── Low confidence API estimate triggers warning ──────────────────────────────
// 3 comparables → low confidence
const lowConfApi = resolveRent(
  {},
  { rentPCM: 500, comparableCount: 3, comparableRange: { min: 400, max: 600 } }
)
assert.strictEqual(lowConfApi.source,      'api_estimate')
assert.strictEqual(lowConfApi.confidence,  'low')
assert.ok(lowConfApi.warning,             'Warning set for low confidence')
assert.ok(lowConfApi.warning.includes('Low confidence'), 'Warning mentions low confidence')

// ── High confidence: 9 comparables, spread < 25% ─────────────────────────────
// Range £500–£560 on avg £530 = spread 11.3% → high confidence
const highConfApi = resolveRent(
  {},
  { rentPCM: 530, comparableCount: 9, comparableRange: { min: 500, max: 560 } }
)
assert.strictEqual(highConfApi.source,     'api_estimate')
assert.strictEqual(highConfApi.confidence, 'high', '9 comps, <25% spread → high confidence')

// ── Medium confidence: 5 comparables ─────────────────────────────────────────
const medConfApi = resolveRent(
  {},
  { rentPCM: 520, comparableCount: 5, comparableRange: { min: 480, max: 590 } }
)
assert.strictEqual(medConfApi.confidence, 'medium', '5 comps → medium confidence')

// ── Void risk percentages ─────────────────────────────────────────────────────
assert.strictEqual(resolveVoidRiskPct('verified_tenant', true,  false), 2, 'Verified tenant → 2%')
assert.strictEqual(resolveVoidRiskPct('api_estimate',    false, false), 5, 'Vacant → 5%')
assert.strictEqual(resolveVoidRiskPct('api_estimate',    true,  true),  8, 'Tenant issues → 8%')

// ── No rent data → returns 0 with warning ────────────────────────────────────
const noData = resolveRent({}, null)
assert.strictEqual(noData.rentPCM, 0)
assert.ok(noData.warning, 'Warning populated when no rent data')

// ── calcApiConfidence banding ─────────────────────────────────────────────────
assert.strictEqual(calcApiConfidence(3,  400, 600), 'low',    '3 comps → low')
assert.strictEqual(calcApiConfidence(5,  480, 590), 'medium', '5 comps → medium')
assert.strictEqual(calcApiConfidence(9,  500, 560), 'high',   '9 comps, narrow range → high')
assert.strictEqual(calcApiConfidence(8,  400, 600), 'medium', '8 comps but wide range (50%) → medium')
assert.strictEqual(calcApiConfidence(null, null, null), 'low', 'null data → low')

console.log('✅ rentResolver: all tests passed')
