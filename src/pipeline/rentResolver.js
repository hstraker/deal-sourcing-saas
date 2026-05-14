/**
 * Rent Resolver — Priority Chain
 * --------------------------------
 * Resolves the rent figure to use in deal analysis from a strict priority chain:
 *
 *   1. verifiedRent     — actual sitting tenant rent (highest confidence)
 *   2. agreedRent       — pre-agreed rent with prospective tenant
 *   3. sourcerEstimate  — unverified estimate from deal pack
 *   4. apiEstimate      — PropertyData /rent endpoint result (lowest confidence)
 *
 * NEVER silently uses an API estimate without providing comparable metadata
 * and a confidence rating. If confidence is 'low', a warning is always set.
 */

/**
 * Calculate confidence level for an API rent estimate.
 *
 * @param {number | null} comparableCount
 * @param {number | null} rangeMin
 * @param {number | null} rangeMax
 * @returns {'high' | 'medium' | 'low'}
 */
function calcApiConfidence(comparableCount, rangeMin, rangeMax) {
  const count = comparableCount ?? 0
  const spread =
    rangeMin != null && rangeMax != null && rangeMin > 0
      ? ((rangeMax - rangeMin) / rangeMin) * 100
      : null

  // Low: fewer than 4 comparables OR spread > 50% (check this first — count < 4 always loses)
  if (count < 4 || (spread != null && spread > 50)) return 'low'
  // High: 8+ comparables AND tight range (< 25% spread)
  if (count >= 8 && spread != null && spread < 25) return 'high'
  // Medium: everything else (4–7 comps, or 8+ with a wider spread)
  return 'medium'
}

/**
 * Determine the void risk percentage based on tenancy status.
 *
 * @param {boolean} isTenanted
 * @param {boolean} tenantIssues
 * @returns {2 | 5 | 8}
 */
function resolveVoidRiskPct(source, isTenanted, tenantIssues) {
  if (tenantIssues) return 8
  if (source === 'verified_tenant' || (isTenanted && source === 'agreed_tenant')) return 2
  return 5
}

/**
 * Resolve the rent figure and metadata for a deal.
 *
 * @param {Object} dealInput
 * @param {number | null} dealInput.verifiedRent
 * @param {string | null} dealInput.verifiedRentSource
 * @param {string | null} dealInput.verifiedRentDate
 * @param {number | null} dealInput.agreedRent
 * @param {number | null} dealInput.sourcerEstimatedRent
 * @param {boolean} [dealInput.isTenanted]
 * @param {boolean} [dealInput.tenantIssues]
 *
 * @param {Object | null} apiData - Response from PropertyData /rent endpoint
 * @param {number | null} apiData.rentPCM
 * @param {number | null} apiData.comparableCount
 * @param {Object | null} apiData.comparableRange
 * @param {number} apiData.comparableRange.min
 * @param {number} apiData.comparableRange.max
 *
 * @returns {{
 *   rentPCM: number,
 *   source: 'verified_tenant' | 'agreed_tenant' | 'sourcer_estimate' | 'api_estimate',
 *   sourceDetail: string,
 *   confidence: 'high' | 'medium' | 'low' | 'verified',
 *   apiComparableCount: number | null,
 *   apiComparableRange: { min: number, max: number } | null,
 *   voidRiskPct: 2 | 5 | 8,
 *   warning: string | null
 * }}
 */
function resolveRent(dealInput = {}, apiData = null) {
  const {
    verifiedRent,
    verifiedRentSource,
    verifiedRentDate,
    agreedRent,
    sourcerEstimatedRent,
    isTenanted = false,
    tenantIssues = false,
  } = dealInput

  const apiCount = apiData?.comparableCount ?? null
  const apiMin   = apiData?.comparableRange?.min ?? null
  const apiMax   = apiData?.comparableRange?.max ?? null

  // ── 1. Verified sitting tenant rent ─────────────────────────────────────────
  if (verifiedRent != null && verifiedRent > 0) {
    const sourceParts = [verifiedRentSource, verifiedRentDate].filter(Boolean)
    const sourceDetail = sourceParts.length
      ? `Confirmed with ${sourceParts.join(', ')}`
      : 'Verified rent (source details not recorded)'

    return {
      rentPCM: verifiedRent,
      source: 'verified_tenant',
      sourceDetail,
      confidence: 'verified',
      apiComparableCount: apiCount,
      apiComparableRange: apiMin != null && apiMax != null ? { min: apiMin, max: apiMax } : null,
      voidRiskPct: resolveVoidRiskPct('verified_tenant', isTenanted, tenantIssues),
      warning: null,
    }
  }

  // ── 2. Agreed rent with prospective tenant ──────────────────────────────────
  if (agreedRent != null && agreedRent > 0) {
    return {
      rentPCM: agreedRent,
      source: 'agreed_tenant',
      sourceDetail: 'Rent agreed with prospective tenant prior to purchase',
      confidence: 'verified',
      apiComparableCount: apiCount,
      apiComparableRange: apiMin != null && apiMax != null ? { min: apiMin, max: apiMax } : null,
      voidRiskPct: resolveVoidRiskPct('agreed_tenant', isTenanted, tenantIssues),
      warning: null,
    }
  }

  // ── 3. Sourcer estimate ─────────────────────────────────────────────────────
  if (sourcerEstimatedRent != null && sourcerEstimatedRent > 0) {
    const warning =
      apiCount != null
        ? `⚠️ Unverified sourcer estimate used. API suggests ${apiCount} comparables (£${apiMin ?? '?'}–£${apiMax ?? '?'}/mo). Verify before proceeding.`
        : '⚠️ Unverified sourcer estimate used. No API comparables available. Verify before proceeding.'

    return {
      rentPCM: sourcerEstimatedRent,
      source: 'sourcer_estimate',
      sourceDetail: 'Deal sourcer estimate — unverified',
      confidence: 'medium',
      apiComparableCount: apiCount,
      apiComparableRange: apiMin != null && apiMax != null ? { min: apiMin, max: apiMax } : null,
      voidRiskPct: resolveVoidRiskPct('sourcer_estimate', isTenanted, tenantIssues),
      warning,
    }
  }

  // ── 4. API estimate (lowest confidence — always provide context) ─────────────
  if (apiData?.rentPCM != null && apiData.rentPCM > 0) {
    const confidence = calcApiConfidence(apiCount, apiMin, apiMax)
    const rangeStr = apiMin != null && apiMax != null ? `range £${apiMin}–£${apiMax}` : 'range unknown'
    const compStr  = apiCount != null ? `${apiCount} comparable${apiCount !== 1 ? 's' : ''}` : 'no comparables'

    const warning =
      confidence === 'low'
        ? `⚠️ Low confidence rent estimate (${compStr}, ${rangeStr}). Verify before proceeding.`
        : `API estimate based on ${compStr}, ${rangeStr}, confidence: ${confidence}.`

    return {
      rentPCM: apiData.rentPCM,
      source: 'api_estimate',
      sourceDetail: `PropertyData API estimate (${compStr})`,
      confidence,
      apiComparableCount: apiCount,
      apiComparableRange: apiMin != null && apiMax != null ? { min: apiMin, max: apiMax } : null,
      voidRiskPct: resolveVoidRiskPct('api_estimate', isTenanted, tenantIssues),
      warning,
    }
  }

  // ── No rent data at all ─────────────────────────────────────────────────────
  return {
    rentPCM: 0,
    source: 'api_estimate',
    sourceDetail: 'No rent data available',
    confidence: 'low',
    apiComparableCount: null,
    apiComparableRange: null,
    voidRiskPct: resolveVoidRiskPct('api_estimate', isTenanted, tenantIssues),
    warning: '⚠️ No rent data found (0 comparables, range unknown). Verify before proceeding.',
  }
}

module.exports = { resolveRent, calcApiConfidence, resolveVoidRiskPct }
