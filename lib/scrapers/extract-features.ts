/**
 * Shared utility for extracting structured property features from text/arrays.
 * Used by all scrapers as a fallback when structured API fields are absent.
 */

export interface ExtractedFeatures {
  epcRating?: string               // A–G
  tenure?: string                  // FREEHOLD | LEASEHOLD | SHARE_OF_FREEHOLD | COMMONHOLD
  isChainFree?: boolean
  isNewBuild?: boolean
  isRetirement?: boolean
  leaseYearsRemaining?: number
  groundRent?: number              // annual £
  serviceCharge?: number           // annual £
  keyFeatures: string[]
}

/**
 * Scan a description string and/or an array of key feature bullets for
 * EPC rating, tenure, chain-free, new build, retirement, lease length,
 * ground rent, and service charge.
 */
export function extractFeaturesFromText(
  description: string,
  keyFeaturesArray: string[] = []
): ExtractedFeatures {
  const bullets = keyFeaturesArray.join(" | ")
  const allText = `${description} ${bullets}`

  // ── EPC Rating (A–G) ──
  let epcRating: string | undefined
  const epcMatch =
    allText.match(/\bepc\s*(?:rating\s*)?[:\-–]?\s*([a-g])\b/i) ||
    allText.match(/energy\s*(?:efficiency\s*|performance\s*)?(?:rating\s*)?[:\-–]?\s*([a-g])\b/i) ||
    allText.match(/\bepc[:\s]*([a-g])\b/i)
  if (epcMatch) epcRating = epcMatch[1].toUpperCase()

  // ── Tenure ──
  let tenure: string | undefined
  if (/share[\s-]of[\s-]freehold/i.test(allText)) tenure = "SHARE_OF_FREEHOLD"
  else if (/commonhold/i.test(allText)) tenure = "COMMONHOLD"
  else if (/\bfreehold\b/i.test(allText)) tenure = "FREEHOLD"
  else if (/\bleasehold\b/i.test(allText)) tenure = "LEASEHOLD"

  // ── Chain Free ──
  const isChainFree =
    /no[\s-](?:upward\s+)?chain\b/i.test(allText) ||
    /chain[\s-]free\b/i.test(allText) ||
    /vacant\s+possession/i.test(allText) ||
    /\bno\s+chain\b/i.test(allText)

  // ── New Build ──
  const isNewBuild =
    /\bnew[\s-]build\b/i.test(allText) ||
    /newly?\s+built\b/i.test(allText) ||
    /\bnew\s+(?:home|development|property)\b/i.test(allText) ||
    /\bbrand[\s-]new\b/i.test(allText)

  // ── Retirement / Sheltered Housing ──
  const isRetirement =
    /\bretirement\s+(?:home|housing|property|flat|apartment|living)\b/i.test(allText) ||
    /\bsheltered\s+(?:housing|accommodation)\b/i.test(allText) ||
    /\bage[\s-](?:restricted|exclusive)\b/i.test(allText) ||
    /\bover[\s-]55s?\b/i.test(allText) ||
    /\b55\+\s+(?:living|community)\b/i.test(allText)

  // ── Lease Years Remaining ──
  let leaseYearsRemaining: number | undefined
  const leaseMatch =
    allText.match(/(\d+)[\s-]*(?:year|yr)s?\s+(?:remaining|left|unexpired)\s+(?:on\s+(?:the\s+)?lease)?/i) ||
    allText.match(/lease\s+(?:has\s+)?(?:approximately\s+)?(\d+)\s+year/i) ||
    allText.match(/(\d{2,4})\s+year(?:s)?\s+(?:remaining\s+)?lease/i)
  if (leaseMatch) {
    const n = parseInt(leaseMatch[1])
    // Sanity check: lease length should be 1–999 years
    if (n >= 1 && n <= 999) leaseYearsRemaining = n
  }

  // ── Ground Rent (annual £) ──
  let groundRent: number | undefined
  const grMatch =
    allText.match(/ground\s+rent\s*(?:of\s*)?(?:approximately\s*)?£\s*([\d,]+)/i) ||
    allText.match(/£\s*([\d,]+)\s*(?:per\s+(?:year|annum)|p\.?a\.?|\/year)\s+ground\s+rent/i)
  if (grMatch) {
    const n = parseFloat(grMatch[1].replace(/,/g, ""))
    if (!isNaN(n) && n < 100000) groundRent = n
  }

  // ── Service Charge (annual £) ──
  let serviceCharge: number | undefined
  const scMatch =
    allText.match(/service\s+charge\s*(?:of\s*)?(?:approximately\s*)?£\s*([\d,]+)/i) ||
    allText.match(/maintenance\s+charge\s*(?:of\s*)?£\s*([\d,]+)/i) ||
    allText.match(/£\s*([\d,]+)\s*(?:per\s+(?:year|annum)|p\.?a\.?|\/year)\s+service\s+charge/i)
  if (scMatch) {
    const n = parseFloat(scMatch[1].replace(/,/g, ""))
    if (!isNaN(n) && n < 100000) serviceCharge = n
  }

  return {
    epcRating,
    tenure: tenure || undefined,
    isChainFree: isChainFree || undefined,
    isNewBuild: isNewBuild || undefined,
    isRetirement: isRetirement || undefined,
    leaseYearsRemaining,
    groundRent,
    serviceCharge,
    keyFeatures: keyFeaturesArray,
  }
}
