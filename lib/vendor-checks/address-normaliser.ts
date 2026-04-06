/**
 * Lightweight UK address normaliser.
 * Extracts postcode and house number from a raw address string so that
 * portal API calls can be targeted as precisely as possible.
 */

// UK postcode regex — matches full (SW1A 2AA) and inward-only (SW1A) forms
const POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s*(\d[A-Z]{2})\b/i

// House / flat number at the start of the address string
// Handles: "42 High St", "Flat 30 Bamboo Court", "Apartment 4B Tower", "Ground Floor, 12 Main St"
const HOUSE_NUMBER_RE = /^(?:(?:flat|apartment|unit|room|floor|suite|plot)\s+)?(\d+[a-z]?)/i

// Generic words that appear in UK addresses but don't identify a specific street
const ADDRESS_STOPWORDS = new Set([
  'flat', 'apartment', 'unit', 'suite', 'room', 'floor', 'house', 'cottage',
  'ground', 'first', 'second', 'third', 'upper', 'lower', 'rear', 'front',
  'left', 'right', 'north', 'south', 'east', 'west', 'new', 'old', 'plot',
  'building', 'block', 'wing', 'annexe', 'annex', 'studio', 'mews', 'rise',
])

export interface NormalisedAddress {
  raw: string
  postcode: string | null       // e.g. "SW1A 2AA"
  postcodeOutward: string | null // e.g. "SW1A"
  houseNumber: string | null    // e.g. "42" or "42B"
  confidence: 'high' | 'medium' | 'low'
  // high   = postcode + house number found
  // medium = postcode only
  // low    = neither found (search will be broad)
}

// ---------------------------------------------------------------------------
// Address matching helpers — shared across all vendor check services
// ---------------------------------------------------------------------------

export function extractHouseNumber(address: string): string | null {
  const m = address.trim().match(HOUSE_NUMBER_RE)
  return m ? m[1].toLowerCase() : null
}

export function extractStreetToken(address: string): string | null {
  // Strip leading flat/unit prefix and any leading number
  const cleaned = address
    .replace(/^\s*(?:flat|apartment|unit|room|floor|suite|plot)\s+\d+[a-zA-Z]?\s*,?\s*/i, "")
    .replace(/^\s*\d+[a-zA-Z]?\s*,?\s*/, "")
    .trim()
  const parts = cleaned.split(/[\s,]+/)
  // Return first token that is ≥4 chars AND not a generic stopword
  return parts.find((p) => p.length >= 4 && !ADDRESS_STOPWORDS.has(p.toLowerCase()))?.toLowerCase() ?? null
}

/**
 * Returns true when the LR/portal address contains both the house number AND
 * first significant street token from the vendor's address.
 */
export function addressesMatch(dbAddress: string, vendorAddress: string): boolean {
  const houseNum = extractHouseNumber(vendorAddress)
  const streetToken = extractStreetToken(vendorAddress)
  if (!houseNum && !streetToken) return false
  const normalized = dbAddress.toLowerCase()
  const hasHouse = houseNum ? normalized.includes(houseNum) : true
  const hasStreet = streetToken ? normalized.includes(streetToken) : true
  return hasHouse && hasStreet
}

export function normaliseAddress(rawAddress: string): NormalisedAddress {
  const upper = rawAddress.toUpperCase().trim()

  // Extract postcode
  const pcMatch = upper.match(POSTCODE_RE)
  const postcode = pcMatch ? `${pcMatch[1]} ${pcMatch[2]}` : null
  const postcodeOutward = pcMatch ? pcMatch[1] : null

  // Extract house number (work on original string, not uppercased, to preserve case)
  const hnMatch = rawAddress.trim().match(HOUSE_NUMBER_RE)
  const houseNumber = hnMatch ? hnMatch[1].toUpperCase() : null

  const confidence: NormalisedAddress['confidence'] =
    postcode && houseNumber ? 'high' :
    postcode              ? 'medium' :
                            'low'

  return { raw: rawAddress, postcode, postcodeOutward, houseNumber, confidence }
}
