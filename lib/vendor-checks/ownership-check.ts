/**
 * Ownership check service.
 * Wraps the existing Land Registry + Price Paid Data utilities to produce
 * a simple summary suitable for vendor due-diligence.
 *
 * Flag codes produced:
 *   CORPORATE_OWNED     – CCOD/OCOD record address-matched to vendor's property
 *   OVERSEAS_OWNED      – company is incorporated overseas (OCOD)
 *   PORTFOLIO_OWNER     – same company owns 5+ titles in our DB
 *   RECENTLY_PURCHASED  – last sale within 18 months (potential quick flip)
 *
 * IMPORTANT — postcode vs address matching:
 *   CCOD/OCOD data is indexed by postcode. A postcode can contain many
 *   properties. We therefore do a best-effort address match against the LR
 *   record's propertyAddress before raising any corporate-ownership flag.
 *   If no record closely matches the vendor's address, we suppress the flags
 *   to avoid false positives on neighbouring company-owned properties.
 */

import { getMockOwnershipData } from '@/lib/vendor-checks/test-mode'
import type { MockScenarioId } from '@/lib/vendor-checks/test-mode'
import type { PortalFlag } from './portal-listing-check'
import { prisma } from '@/lib/db'
import { normalizePostcode } from '@/lib/land-registry'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OwnershipCheckResult {
  flags: PortalFlag[]
  isCorporateOwned: boolean
  isOverseasOwned: boolean
  isPortfolioOwner: boolean
  companyName: string | null
  lastSalePrice: number | null
  lastSaleDate: string | null       // ISO "YYYY-MM-DD"
  tenure: string | null
  equityEstimate: number | null     // vendorAskingPrice - lastSalePrice (rough)
  isMockData: boolean
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

interface RunOwnershipCheckOptions {
  postcode: string
  address: string       // vendor's property address — used for address-level matching
  vendorAskingPrice: number
  // Test-mode
  isMock?: boolean
  mockScenario?: MockScenarioId
}

const RECENTLY_PURCHASED_MONTHS = 18

export async function runOwnershipCheck(
  opts: RunOwnershipCheckOptions
): Promise<OwnershipCheckResult> {
  const { postcode, address, vendorAskingPrice, isMock, mockScenario } = opts

  if (isMock && mockScenario) {
    return buildMockResult(mockScenario, vendorAskingPrice)
  }

  return buildRealResult(postcode, address, vendorAskingPrice)
}

// ---------------------------------------------------------------------------
// Address similarity helpers
// ---------------------------------------------------------------------------

/**
 * Extract the first numeric token from an address string (the house number).
 * "18 Ingles, Welwyn..." → "18"
 * "Flat 30, Bamboo Court..." → "30"
 */
function extractHouseNumber(address: string): string | null {
  const m = address.match(/\b(\d+[a-z]?)\b/i)
  return m ? m[1].toLowerCase() : null
}

/**
 * Extract the first meaningful street/place token (≥4 chars, non-numeric).
 * "18 Ingles, Welwyn..." → "ingles"
 * "Flat 30, Bamboo Court..." → "bamboo"
 */
function extractStreetToken(address: string): string | null {
  const tokens = address.toLowerCase().split(/[\s,]+/)
  const skip = new Set(['flat', 'apartment', 'unit', 'house', 'the', 'and'])
  for (const t of tokens) {
    if (t.length >= 4 && !/^\d/.test(t) && !skip.has(t)) return t
  }
  return null
}

/**
 * Returns true when the LR propertyAddress plausibly refers to the same
 * property as the vendor's address.
 * Requires BOTH house number AND street token to match (case-insensitive).
 * Falls back to street-only when no house number is present in the vendor address.
 */
function addressesMatch(lrAddress: string, vendorAddress: string): boolean {
  const lrLower = lrAddress.toLowerCase()
  const houseNo = extractHouseNumber(vendorAddress)
  const street  = extractStreetToken(vendorAddress)

  if (!street) return false  // can't make a reliable comparison

  const streetMatch = lrLower.includes(street)
  if (!houseNo) return streetMatch  // no house number to check — street alone

  // Require house number to appear as a word boundary in the LR address
  const houseMatch = new RegExp(`\\b${houseNo}\\b`).test(lrLower)
  return streetMatch && houseMatch
}

// ---------------------------------------------------------------------------
// Real data path
// ---------------------------------------------------------------------------

async function buildRealResult(
  postcode: string,
  vendorAddress: string,
  vendorAskingPrice: number
): Promise<OwnershipCheckResult> {
  const flags: PortalFlag[] = []

  const normalized = normalizePostcode(postcode)

  // Query all company-ownership records at this postcode (max 20)
  let ownershipRecords: Array<{
    companyName: string
    companyRegNumber: string | null
    proprietorCategory: string | null
    isOverseas: boolean
    tenure: string | null
    propertyAddress: string
    pricePaid: any
    dateProprietary: string | null
  }> = []

  try {
    ownershipRecords = await prisma.companyOwnership.findMany({
      where: { postcodeNormalized: normalized },
      select: {
        companyName: true,
        companyRegNumber: true,
        proprietorCategory: true,
        isOverseas: true,
        tenure: true,
        propertyAddress: true,
        pricePaid: true,
        dateProprietary: true,
      },
      take: 20,
    })
  } catch {
    // No ownership data imported — skip silently
  }

  if (ownershipRecords.length === 0) {
    // Nothing found at all — return clean result
    return { flags, isCorporateOwned: false, isOverseasOwned: false, isPortfolioOwner: false, companyName: null, lastSalePrice: null, lastSaleDate: null, tenure: null, equityEstimate: null, isMockData: false }
  }

  // Try to find a record that matches the vendor's specific address
  const matchedRecord = ownershipRecords.find(r => addressesMatch(r.propertyAddress, vendorAddress))

  // If no record matches the vendor's address, there's a company-owned property
  // nearby in the same postcode but it's NOT this property — suppress all flags.
  if (!matchedRecord) {
    return { flags, isCorporateOwned: false, isOverseasOwned: false, isPortfolioOwner: false, companyName: null, lastSalePrice: null, lastSaleDate: null, tenure: null, equityEstimate: null, isMockData: false }
  }

  // --- Address-matched: this specific property appears to be company-owned ---
  const isCorporateOwned = true
  const isOverseasOwned  = matchedRecord.isOverseas
  const rawCompanyName   = matchedRecord.companyName
  const companyName      = rawCompanyName && rawCompanyName.toLowerCase() !== 'unknown' ? rawCompanyName : null
  const tenure           = matchedRecord.tenure ?? null

  // Check portfolio ownership (company holds 5+ titles)
  let isPortfolioOwner = false
  if (matchedRecord.companyRegNumber) {
    try {
      const count = await prisma.companyOwnership.count({
        where: { companyRegNumber: matchedRecord.companyRegNumber },
      })
      isPortfolioOwner = count >= 5
    } catch { /* non-critical */ }
  }

  // Parse last sale price and date
  let lastSalePrice: number | null = null
  let lastSaleDate:  string | null = null

  if (matchedRecord.pricePaid !== null) {
    lastSalePrice = Number(matchedRecord.pricePaid)
  }
  if (matchedRecord.dateProprietary) {
    const parts = matchedRecord.dateProprietary.split('/')
    if (parts.length === 3) {
      lastSaleDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
    }
  }

  // Leasehold + corporate: for flats the matched record might be a head-lease
  // holder rather than the freehold owner of the vendor's specific unit.
  // Keep the flag but soften the detail text.
  const isLeasehold = tenure?.toUpperCase().includes('LEASEHOLD') ?? false

  const nameClause = companyName ? ` (${companyName})` : ''
  flags.push({
    code: 'CORPORATE_OWNED',
    severity: 'caution',
    label: 'Corporate Owned',
    detail: isLeasehold
      ? `A company${nameClause} holds a leasehold title matching this address. This may be a head-lease holder rather than the occupying owner — confirm with vendor.`
      : `This property's title appears to be held by a company${nameClause}. Confirm whether the vendor is authorised to sell.`,
  })

  if (isOverseasOwned) {
    flags.push({
      code: 'OVERSEAS_OWNED',
      severity: 'caution',
      label: 'Overseas Owner',
      detail: "The company that owns this title is incorporated overseas. Verify the vendor's authority to sell.",
    })
  }

  if (isPortfolioOwner) {
    flags.push({
      code: 'PORTFOLIO_OWNER',
      severity: 'caution',
      label: 'Portfolio Owner',
      detail: `${companyName ?? 'The company'} holds 5+ titles in Land Registry data — potential portfolio seller.`,
    })
  }

  const equityEstimate =
    lastSalePrice && vendorAskingPrice ? vendorAskingPrice - lastSalePrice : null

  return {
    flags,
    isCorporateOwned,
    isOverseasOwned,
    isPortfolioOwner,
    companyName,
    lastSalePrice,
    lastSaleDate,
    tenure,
    equityEstimate,
    isMockData: false,
  }
}

// ---------------------------------------------------------------------------
// Mock data path
// ---------------------------------------------------------------------------

function buildMockResult(
  scenario: MockScenarioId,
  vendorAskingPrice: number
): OwnershipCheckResult {
  const mock = getMockOwnershipData(scenario, vendorAskingPrice)
  const flags: PortalFlag[] = []

  if (mock.isCorporateOwned) {
    flags.push({
      code: 'CORPORATE_OWNED',
      severity: 'caution',
      label: 'Corporate Owned',
      detail: `Property owned by ${mock.companyName ?? 'a company'}.`,
    })
  }

  if (mock.lastSaleDate) {
    const monthsSince =
      (Date.now() - new Date(mock.lastSaleDate).getTime()) / (30 * 24 * 60 * 60 * 1000)
    if (monthsSince <= RECENTLY_PURCHASED_MONTHS) {
      flags.push({
        code: 'RECENTLY_PURCHASED',
        severity: 'caution',
        label: 'Recently Purchased',
        detail: `Property last sold ${Math.round(monthsSince)} month(s) ago for £${mock.lastSalePrice?.toLocaleString() ?? '?'}.`,
      })
    }
  }

  return {
    flags,
    isCorporateOwned: mock.isCorporateOwned,
    isOverseasOwned: false,
    isPortfolioOwner: false,
    companyName: mock.companyName,
    lastSalePrice: mock.lastSalePrice,
    lastSaleDate: mock.lastSaleDate,
    tenure: mock.tenure,
    equityEstimate:
      mock.lastSalePrice && vendorAskingPrice
        ? vendorAskingPrice - mock.lastSalePrice
        : null,
    isMockData: true,
  }
}
