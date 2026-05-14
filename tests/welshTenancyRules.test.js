/**
 * Unit tests — welshTenancyRules.js
 *
 * Run with: node --test tests/welshTenancyRules.test.js
 * Or with Jest: jest tests/welshTenancyRules.test.js
 */

const assert = require('assert')
const { getWelshTenancyContext, getVoidRiskPct, assessEpc } = require('../src/pipeline/welshTenancyRules')

// ── Welsh FTSC with tenant in situ ────────────────────────────────────────────
const welshFTSC = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: true,
  tenantContractType: 'ftsc',
  tenantMonthsRemaining: 8,
  tenantIssues: false,
  epcRating: 'C',
})
assert.strictEqual(welshFTSC.applicable,                true,  'Welsh FTSC: applicable')
assert.strictEqual(welshFTSC.contractType,              'ftsc')
assert.strictEqual(welshFTSC.landlordNoticePeriodMonths, 6,    'Welsh: always 6 months notice')
assert.strictEqual(welshFTSC.canGiveNoticeNow,          false, 'FTSC with 8 months remaining → cannot give notice yet')
assert.strictEqual(welshFTSC.voidRiskPct,               2,     'Sitting tenant → 2% void risk')
assert.strictEqual(welshFTSC.legalCostBuffer,           0,     'No tenant issues → £0 buffer')

// ── Vacant Welsh property ─────────────────────────────────────────────────────
const welshVacant = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: false,
  tenantContractType: null,
  tenantIssues: false,
  epcRating: 'E',
})
assert.strictEqual(welshVacant.applicable,   true)
assert.strictEqual(welshVacant.voidRiskPct,  5, 'Vacant → 5% void risk')
assert.strictEqual(welshVacant.epcCompliant, true, 'EPC E → compliant')

// ── EPC D rating — medium-term risk ──────────────────────────────────────────
const epcD = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: false,
  epcRating: 'D',
})
assert.strictEqual(epcD.epcCompliant,      true,  'EPC D → currently compliant')
assert.strictEqual(epcD.epcMediumTermRisk, true,  'EPC D → medium-term risk (future C requirement)')
assert.ok(epcD.epcWarning,                       'EPC D → warning populated')

// ── EPC F rating — non-compliant ─────────────────────────────────────────────
const epcF = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: false,
  epcRating: 'F',
})
assert.strictEqual(epcF.epcCompliant,      false, 'EPC F → non-compliant')
assert.strictEqual(epcF.epcMediumTermRisk, false, 'EPC F → not just medium-term risk, currently non-compliant')
assert.ok(epcF.epcWarning,                       'EPC F → warning populated')

// ── English property — not applicable ────────────────────────────────────────
const english = getWelshTenancyContext({
  _isWelsh: false,
  isTenanted: true,
  tenantContractType: 'ast',
  epcRating: 'D',
})
assert.strictEqual(english.applicable, false, 'English property → not applicable')
assert.ok(english.notes[0].includes('English property'), 'Notes explain N/A')
assert.strictEqual(english.landlordNoticePeriodMonths, null)
assert.strictEqual(english.epcCompliant, null)

// ── Welsh periodic tenancy — can give notice ──────────────────────────────────
const periodic = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: true,
  tenantContractType: 'periodic',
  tenantMonthsRemaining: null,
  tenantIssues: false,
})
assert.strictEqual(periodic.contractType,     'periodic')
assert.strictEqual(periodic.canGiveNoticeNow, true, 'Periodic contract → can give notice (subject to 6 month period)')

// ── AST auto-converts to periodic ────────────────────────────────────────────
const ast = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: true,
  tenantContractType: 'ast',
})
assert.strictEqual(ast.contractType, 'periodic', 'Welsh AST → converted to periodic Standard Contract')
assert.ok(ast.notes.some(n => n.includes('converted')), 'AST conversion noted in notes')

// ── Tenant issues → 8% void risk + £1500 buffer ──────────────────────────────
const tenantIssues = getWelshTenancyContext({
  _isWelsh: true,
  isTenanted: true,
  tenantContractType: 'periodic',
  tenantIssues: true,
})
assert.strictEqual(tenantIssues.voidRiskPct,    8,    'Tenant issues → 8% void risk')
assert.strictEqual(tenantIssues.legalCostBuffer, 1500, 'Tenant issues → £1500 legal buffer')

// ── getVoidRiskPct standalone ─────────────────────────────────────────────────
assert.strictEqual(getVoidRiskPct(true,  false), 2, 'Tenanted no issues → 2%')
assert.strictEqual(getVoidRiskPct(false, false), 5, 'Vacant → 5%')
assert.strictEqual(getVoidRiskPct(true,  true),  8, 'Tenant issues → 8%')
assert.strictEqual(getVoidRiskPct(false, true),  8, 'Vacant + issues → 8%')

// ── assessEpc ────────────────────────────────────────────────────────────────
assert.deepStrictEqual(assessEpc('A'), { compliant: true,  mediumTermRisk: false, warning: null })
assert.deepStrictEqual(assessEpc('E'), { compliant: true,  mediumTermRisk: false, warning: null })
assert.strictEqual(assessEpc('D').mediumTermRisk, true)
assert.strictEqual(assessEpc('F').compliant, false)
assert.deepStrictEqual(assessEpc(null), { compliant: null, mediumTermRisk: false, warning: null })

console.log('✅ welshTenancyRules: all tests passed')
