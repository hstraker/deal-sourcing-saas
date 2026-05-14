/**
 * Deal Data Model / Schema
 * ------------------------
 * Defines the shape of a deal input object as JSDoc typedefs.
 * Used as documentation and validation reference across the pipeline.
 *
 * @typedef {Object} DealInput
 *
 * ── Core property fields ───────────────────────────────────────────────────
 * @property {string}  address          - Full property address
 * @property {string}  postcode         - UK postcode (e.g. 'SA11 1PE')
 * @property {number}  askingPrice      - Asking / purchase price in GBP
 * @property {number | null} marketValue - Current market valuation (from comparables)
 * @property {string}  propertyType     - e.g. 'terraced_house', 'semi', 'flat', 'commercial'
 * @property {string}  condition        - e.g. 'good', 'average', 'poor'
 * @property {number | null} bedrooms
 * @property {boolean} majorStructuralIssues - Disqualifies all strategies if true
 *
 * ── Rent fields ───────────────────────────────────────────────────────────
 * @property {number | null}  verifiedRent        - Actual sitting tenant rent (PCM)
 * @property {string | null}  verifiedRentSource  - e.g. "Lewis Pownall, sourcer"
 * @property {string | null}  verifiedRentDate    - ISO date string e.g. "2026-05-13"
 * @property {number | null}  agreedRent          - Rent agreed with prospective tenant
 * @property {number | null}  sourcerEstimatedRent - Unverified deal pack estimate
 *
 * ── Tenancy fields ────────────────────────────────────────────────────────
 * @property {boolean} isTenanted
 * @property {'ftsc' | 'periodic' | 'ast' | null} tenantContractType
 * @property {number | null}  tenantMonthsRemaining
 * @property {boolean} tenantIssues  - Flag if there are known tenant problems
 *
 * ── Add-value / BRRR fields ───────────────────────────────────────────────
 * @property {'none' | 'minor' | 'moderate' | 'major'} addValuePotential
 * @property {number | null} postWorksGDV  - Gross Development Value after refurb
 * @property {number | null} refurbCosts   - Estimated refurb cost
 * @property {number | null} closingCosts  - Legal, survey, and other closing costs
 *
 * ── Finance fields ────────────────────────────────────────────────────────
 * @property {number} [mortgageRate]  - e.g. 0.06 (6%). Default: 0.06
 * @property {number} [ltv]           - e.g. 0.75 (75%). Default: 0.75
 *
 * ── EPC ───────────────────────────────────────────────────────────────────
 * @property {string | null} epcRating   - e.g. 'D', 'E', 'F'
 *
 * ── Tax ───────────────────────────────────────────────────────────────────
 * @property {number | null} sourcerTaxQuote - Tax quote provided by sourcer
 */

/**
 * Default values for optional deal input fields.
 * Use Object.assign({}, DEAL_DEFAULTS, dealInput) to hydrate.
 */
const DEAL_DEFAULTS = {
  marketValue: null,
  bedrooms: null,
  condition: 'unknown',
  majorStructuralIssues: false,
  verifiedRent: null,
  verifiedRentSource: null,
  verifiedRentDate: null,
  agreedRent: null,
  sourcerEstimatedRent: null,
  isTenanted: false,
  tenantContractType: null,
  tenantMonthsRemaining: null,
  tenantIssues: false,
  addValuePotential: 'none',
  postWorksGDV: null,
  refurbCosts: 0,
  closingCosts: 1300,
  mortgageRate: 0.06,
  ltv: 0.75,
  epcRating: null,
  sourcerTaxQuote: null,
}

/**
 * Hydrate a raw deal input with defaults.
 *
 * @param {Partial<DealInput>} rawInput
 * @returns {DealInput}
 */
function hydrateDeal(rawInput) {
  return Object.assign({}, DEAL_DEFAULTS, rawInput)
}

module.exports = { DEAL_DEFAULTS, hydrateDeal }
