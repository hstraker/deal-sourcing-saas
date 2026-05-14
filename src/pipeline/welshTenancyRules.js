/**
 * Welsh Tenancy Rules
 * --------------------
 * Applies the Renting Homes (Wales) Act 2016 context to a deal.
 *
 * Key differences from English law (Housing Act 1988):
 *  - Landlord notice period is ALWAYS 6 months in Wales (vs 2 months S21 England)
 *  - Fixed-term Standard Contracts (FTSC) replace ASTs
 *  - Periodic Standard Contracts replace statutory periodic tenancies
 *  - EPC minimum is currently E; future requirement is C (medium-term risk if D)
 */

/**
 * EPC rating compliance levels.
 * @param {string | null} rating
 * @returns {{ compliant: boolean | null, mediumTermRisk: boolean, warning: string | null }}
 */
function assessEpc(rating) {
  if (!rating) {
    return { compliant: null, mediumTermRisk: false, warning: null }
  }
  const r = rating.toUpperCase()
  if (['A', 'B', 'C', 'D', 'E'].includes(r)) {
    const mediumTermRisk = r === 'D' // Future C requirement
    const warning = mediumTermRisk
      ? `EPC Band D — compliant now but future minimum is C. Budget for energy improvements.`
      : null
    return { compliant: true, mediumTermRisk, warning }
  }
  // F or G — currently non-compliant
  return {
    compliant: false,
    mediumTermRisk: false,
    warning: `EPC Band ${r} — non-compliant (minimum Band E). Property cannot be legally let without improvements.`,
  }
}

/**
 * Resolve the void risk percentage for a Welsh property.
 *
 * @param {boolean} isTenanted
 * @param {boolean} tenantIssues
 * @returns {2 | 5 | 8}
 */
function getVoidRiskPct(isTenanted, tenantIssues) {
  if (tenantIssues) return 8
  if (isTenanted) return 2
  return 5
}

/**
 * Get the full Welsh tenancy context for a deal.
 *
 * @param {Object} dealInput
 * @param {string}  dealInput.postcode
 * @param {boolean} [dealInput.isTenanted]
 * @param {'ftsc' | 'periodic' | 'ast' | null} [dealInput.tenantContractType]
 * @param {number | null}  [dealInput.tenantMonthsRemaining]
 * @param {boolean} [dealInput.tenantIssues]
 * @param {string | null}  [dealInput.epcRating]
 * @param {boolean} [dealInput._isWelsh] - Pre-computed (injected by pipeline)
 *
 * @returns {{
 *   applicable: boolean,
 *   contractType: 'ftsc' | 'periodic' | 'unknown',
 *   landlordNoticePeriodMonths: number,
 *   canGiveNoticeNow: boolean,
 *   voidRiskPct: 2 | 5 | 8,
 *   legalCostBuffer: number,
 *   epcRating: string | null,
 *   epcCompliant: boolean | null,
 *   epcMediumTermRisk: boolean,
 *   epcWarning: string | null,
 *   notes: string[]
 * }}
 */
function getWelshTenancyContext(dealInput) {
  const {
    _isWelsh = false,
    isTenanted = false,
    tenantContractType = null,
    tenantMonthsRemaining = null,
    tenantIssues = false,
    epcRating = null,
  } = dealInput

  // English properties — return null context with explanatory note
  if (!_isWelsh) {
    return {
      applicable: false,
      contractType: null,
      landlordNoticePeriodMonths: null,
      canGiveNoticeNow: null,
      voidRiskPct: null,
      legalCostBuffer: null,
      epcRating: null,
      epcCompliant: null,
      epcMediumTermRisk: null,
      epcWarning: null,
      notes: ['English property — Welsh tenancy rules do not apply'],
    }
  }

  const notes = []
  const epc = assessEpc(epcRating)
  const voidRiskPct = getVoidRiskPct(isTenanted, tenantIssues)
  const legalCostBuffer = tenantIssues ? 1500 : 0

  // Notice period — always 6 months for Welsh landlords
  const landlordNoticePeriodMonths = 6
  notes.push(
    'Welsh property: landlord notice period is 6 months (Renting Homes Wales Act 2016). ' +
    'This is longer than the 2-month S21 notice applicable in England.'
  )

  // Contract type
  let contractType = 'unknown'
  if (tenantContractType === 'ftsc') contractType = 'ftsc'
  else if (tenantContractType === 'periodic') contractType = 'periodic'
  else if (tenantContractType === 'ast') {
    // ASTs in Wales converted to Occupation Contracts on 1 December 2022
    contractType = 'periodic'
    notes.push(
      'Tenancy was an AST — automatically converted to a Periodic Standard Contract ' +
      'under the Renting Homes (Wales) Act 2016 (effective 1 Dec 2022).'
    )
  }

  // Can the landlord give notice now?
  // For FTSC: cannot give notice if within the first 6 months of the fixed term.
  // We infer "within first 6 months" as: monthsRemaining > (contract - 6), i.e.
  // if we only know monthsRemaining, we treat it conservatively: if remaining >= 6,
  // assume notice cannot yet be served (tenant is still inside the protected period).
  let canGiveNoticeNow = true
  if (contractType === 'ftsc') {
    if (tenantMonthsRemaining != null && tenantMonthsRemaining >= 6) {
      canGiveNoticeNow = false
      notes.push(
        `FTSC in force: landlord cannot serve notice until month 6 of fixed term. ` +
        `${tenantMonthsRemaining} month(s) remaining on contract.`
      )
    } else if (tenantMonthsRemaining == null) {
      canGiveNoticeNow = false
      notes.push(
        'FTSC in force: months remaining unknown — assume notice cannot be served yet. Confirm contract dates.'
      )
    }
  }

  if (tenantIssues) {
    notes.push(
      `⚠️ Tenant issues flagged. Legal cost buffer of £${legalCostBuffer.toLocaleString()} added to deal costs. ` +
      'Void risk set to 8%.'
    )
  }

  if (epc.warning) notes.push(epc.warning)

  if (voidRiskPct === 2) {
    notes.push('Sitting tenant in situ — void risk modelled at 2%.')
  } else if (voidRiskPct === 5) {
    notes.push('Vacant property — void risk modelled at 5%.')
  }

  return {
    applicable: true,
    contractType,
    landlordNoticePeriodMonths,
    canGiveNoticeNow,
    voidRiskPct,
    legalCostBuffer,
    epcRating: epcRating ? epcRating.toUpperCase() : null,
    epcCompliant: epc.compliant,
    epcMediumTermRisk: epc.mediumTermRisk,
    epcWarning: epc.warning,
    notes,
  }
}

module.exports = { getWelshTenancyContext, getVoidRiskPct, assessEpc }
