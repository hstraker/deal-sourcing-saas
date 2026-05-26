/**
 * lib/welsh-detection.ts
 *
 * Detects whether a property is in Wales based on its postcode prefix.
 * Welsh postcodes: CF, NP, SA, LL, SY (partial), LD, HR (partial).
 *
 * This is used to:
 *  - Set is_welsh + jurisdiction on PropertyListing records
 *  - Drive LTT (Land Transaction Tax) vs SDLT calculation
 *  - Surface "Renting Homes Wales Act" compliance badge
 *  - Show Welsh flag badge on property cards
 */

// ─── Welsh postcode area prefixes ─────────────────────────────────────────────
// These areas are entirely or predominantly in Wales.
const WELSH_PREFIXES = new Set([
  "CF",  // Cardiff
  "NP",  // Newport / Monmouthshire
  "SA",  // Swansea / Carmarthenshire / Pembrokeshire / Ceredigion
  "LL",  // North Wales (Gwynedd / Anglesey / Conwy / Denbighshire / Flintshire)
  "LD",  // Powys (Llandrindod Wells)
  "SY",  // Partly Wales (Montgomeryshire / Ceredigion) — treated as Welsh here
])

// HR (Hereford) is English — excluded despite bordering Wales.

// ─── Detection helpers ────────────────────────────────────────────────────────

/**
 * Extract the alphabetic prefix (area code) from a UK postcode.
 * "CF10 1AB" → "CF"
 * "NP44 2XY" → "NP"
 * "SW1A 2AA" → "SW"
 */
function extractPostcodeArea(postcode: string): string {
  const normalised = postcode.trim().toUpperCase()
  const match = normalised.match(/^([A-Z]{1,2})/)
  return match?.[1] ?? ""
}

/**
 * Returns true if the postcode is in a Welsh area.
 * Handles full postcodes ("CF10 1AB"), outward codes ("CF10"), and area codes ("CF").
 */
export function isWelshPostcode(postcode: string | null | undefined): boolean {
  if (!postcode) return false
  const area = extractPostcodeArea(postcode)
  return WELSH_PREFIXES.has(area)
}

/**
 * Returns the jurisdiction string for a postcode.
 * Returns "WALES" | "ENGLAND" (defaults to ENGLAND for unknown postcodes).
 */
export function getJurisdiction(postcode: string | null | undefined): "WALES" | "ENGLAND" {
  return isWelshPostcode(postcode) ? "WALES" : "ENGLAND"
}

/**
 * Full result object used when enriching a PropertyListing.
 */
export interface WelshDetectionResult {
  isWelsh:      boolean
  jurisdiction: "WALES" | "ENGLAND"
}

export function detectWelshJurisdiction(postcode: string | null | undefined): WelshDetectionResult {
  const isWelsh     = isWelshPostcode(postcode)
  const jurisdiction = isWelsh ? "WALES" : "ENGLAND"
  return { isWelsh, jurisdiction }
}
