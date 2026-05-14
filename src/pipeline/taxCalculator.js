/**
 * Tax Calculator — Welsh LTT and English SDLT
 * --------------------------------------------
 * Langdon Property Group always purchases as a company / additional dwelling,
 * so only the additional-rate bands are applied.
 *
 * Important: Both LTT and SDLT (additional) use a FLAT rate applied to the
 * full purchase price within each band — NOT progressive like personal SDLT.
 * The applicable single rate is determined by which band the full purchase
 * price falls into.
 */

/**
 * Welsh Land Transaction Tax bands (additional dwelling / company).
 * Each band defines the UPPER ceiling of that band (inclusive).
 * The last band has no ceiling (Infinity).
 *
 * @type {Array<{label: string, ceiling: number, rate: number}>}
 */
const WELSH_LTT_BANDS = [
  { label: '£0 – £180,000',          ceiling: 180_000,     rate: 0.04  },
  { label: '£180,001 – £250,000',     ceiling: 250_000,     rate: 0.075 },
  { label: '£250,001 – £400,000',     ceiling: 400_000,     rate: 0.09  },
  { label: '£400,001 – £750,000',     ceiling: 750_000,     rate: 0.115 },
  { label: '£750,001 – £1,500,000',   ceiling: 1_500_000,   rate: 0.14  },
  { label: 'Above £1,500,000',        ceiling: Infinity,    rate: 0.16  },
]

/**
 * English SDLT bands (additional dwelling surcharge).
 *
 * @type {Array<{label: string, ceiling: number, rate: number}>}
 */
const ENGLISH_SDLT_BANDS = [
  { label: '£0 – £250,000',           ceiling: 250_000,     rate: 0.03  },
  { label: '£250,001 – £925,000',     ceiling: 925_000,     rate: 0.08  },
  { label: '£925,001 – £1,500,000',   ceiling: 1_500_000,   rate: 0.13  },
  { label: 'Above £1,500,000',        ceiling: Infinity,    rate: 0.15  },
]

/**
 * Find the applicable band for a purchase price and apply the flat rate.
 *
 * @param {number} purchasePrice
 * @param {Array<{label: string, ceiling: number, rate: number}>} bands
 * @returns {{ taxAmount: number, bandBreakdown: Array }}
 */
function applyFlatRateBands(purchasePrice, bands) {
  const applicableBand = bands.find(b => purchasePrice <= b.ceiling)
  // If somehow no band matches (shouldn't happen — last band is Infinity), use last
  const band = applicableBand || bands[bands.length - 1]

  const taxAmount = Math.round(purchasePrice * band.rate)

  const bandBreakdown = bands.map(b => ({
    band: b.label,
    rate: `${(b.rate * 100).toFixed(1)}%`,
    taxableAmount: purchasePrice <= b.ceiling ? purchasePrice : null,
    taxDue: b === band ? taxAmount : null,
    applicable: b === band,
  }))

  return { taxAmount, bandBreakdown }
}

/**
 * Calculate property transaction tax for a given purchase price and jurisdiction.
 *
 * @param {number} purchasePrice  - Purchase price in GBP (integer)
 * @param {'WALES' | 'ENGLAND'} jurisdiction
 * @param {Object} [options]
 * @param {number | null} [options.sourcerQuote] - Tax quote provided by the deal sourcer
 * @returns {{
 *   jurisdiction: 'WALES' | 'ENGLAND',
 *   taxType: 'LTT' | 'SDLT',
 *   taxAmount: number,
 *   bandBreakdown: Array,
 *   sourcerQuote: number | null,
 *   discrepancy: number | null,
 *   discrepancyFlag: boolean
 * }}
 *
 * @example
 * calculateTax(86000, 'WALES').taxAmount === 3440  // 86000 × 4%
 * calculateTax(86000, 'ENGLAND').taxAmount === 2580 // 86000 × 3%
 */
function calculateTax(purchasePrice, jurisdiction, options = {}) {
  const { sourcerQuote = null } = options

  const isWales = jurisdiction === 'WALES'
  const taxType = isWales ? 'LTT' : 'SDLT'
  const bands = isWales ? WELSH_LTT_BANDS : ENGLISH_SDLT_BANDS

  const { taxAmount, bandBreakdown } = applyFlatRateBands(purchasePrice, bands)

  const discrepancy = sourcerQuote != null ? sourcerQuote - taxAmount : null
  const discrepancyFlag = discrepancy != null && Math.abs(discrepancy) > 200

  return {
    jurisdiction,
    taxType,
    taxAmount,
    bandBreakdown,
    sourcerQuote,
    discrepancy,
    discrepancyFlag,
  }
}

module.exports = { calculateTax, WELSH_LTT_BANDS, ENGLISH_SDLT_BANDS }
