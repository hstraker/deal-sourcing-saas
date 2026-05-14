/**
 * Jurisdiction Detector
 * ---------------------
 * Determines whether a UK property postcode falls under Welsh or English
 * jurisdiction. This drives which tax regime (LTT vs SDLT), tenancy law
 * (Renting Homes Wales Act vs Housing Act 1988), and notice period rules apply.
 *
 * Welsh postcode prefixes: CF, NP, SA, LL, LD
 */

/** @type {ReadonlyArray<string>} */
const WELSH_PREFIXES = ['CF', 'NP', 'SA', 'LL', 'LD']

/**
 * Normalise a raw postcode string: trim whitespace and uppercase.
 * @param {string} postcode
 * @returns {string}
 */
function normalise(postcode) {
  return (postcode || '').trim().toUpperCase()
}

/**
 * Detect the jurisdiction for a given UK postcode.
 *
 * @param {string} postcode - Raw postcode string (e.g. 'SA11 1PE', 'sa11 1pe', ' CF24 0AB ')
 * @returns {'WALES' | 'ENGLAND'}
 *
 * @example
 * detectJurisdiction('SA11 1PE') // → 'WALES'
 * detectJurisdiction('M1 1AA')   // → 'ENGLAND'
 */
function detectJurisdiction(postcode) {
  const clean = normalise(postcode)
  const prefix = WELSH_PREFIXES.find(p => clean.startsWith(p))
  return prefix ? 'WALES' : 'ENGLAND'
}

/**
 * Convenience boolean helper — returns true if the postcode is in Wales.
 *
 * @param {string} postcode
 * @returns {boolean}
 *
 * @example
 * isWelsh('CF24 0AB') // → true
 * isWelsh('SW1A 1AA') // → false
 */
function isWelsh(postcode) {
  return detectJurisdiction(postcode) === 'WALES'
}

module.exports = { detectJurisdiction, isWelsh }
