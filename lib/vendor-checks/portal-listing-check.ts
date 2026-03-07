/**
 * Portal listing check service.
 * Calls PropertyData (real) or returns mock data (test mode) to determine
 * whether the vendor's property is currently listed on Rightmove / Zoopla / OnTheMarket.
 *
 * Flag codes produced:
 *   NEVER_LISTED              – no active or historical listings found
 *   RECENTLY_DELISTED         – removed from portals within the last 30 days
 *   CURRENTLY_LISTED_FULL_PRICE – active listing at or near vendor asking price (≤5% below)
 *   CURRENTLY_LISTED_REDUCED  – active listing at a reduced price (>5% below original)
 *   LONG_TIME_ON_MARKET       – listing has been active for >90 days
 *   PRICE_DISCREPANCY_HIGH    – portal price >10% above vendor asking price
 *   SOLE_AGENCY_RISK          – only one portal listing found (potential sole agency breach)
 */

import {
  fetchForSaleListings,
  fetchListingHistory,
  type ForSaleResult,
  type ListingHistoryResult,
  type ActiveListing,
} from '@/lib/propertydata'
import {
  getMockForSaleResult,
  getMockListingHistoryResult,
  type MockOwnershipData,
} from '@/lib/vendor-checks/test-mode'
import type { MockScenarioId } from '@/lib/vendor-checks/test-mode'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagSeverity = 'clear' | 'caution' | 'red_flag'

export interface PortalFlag {
  code: string
  severity: FlagSeverity
  label: string
  detail: string
}

export interface PortalListingCheckResult {
  flags: PortalFlag[]
  overallRisk: FlagSeverity   // highest severity seen
  activeListing: ActiveListing | null  // most relevant active listing
  activeListingCount: number
  recentlyDelisted: boolean
  isMockData: boolean
  raw: {
    forSale: ForSaleResult | null
    history: ListingHistoryResult | null
  }
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const RECENTLY_DELISTED_DAYS = 30
const LONG_ON_MARKET_DAYS    = 90
const PRICE_DISCREPANCY_PCT  = 0.10   // >10% above vendor claim → HIGH flag
const REDUCED_THRESHOLD_PCT  = 0.05   // >5% below original → counts as reduced

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

interface RunPortalCheckOptions {
  postcode: string
  vendorAskingPrice: number
  address: string
  // Test-mode — if both provided, mock data is used instead of real API
  isMock?: boolean
  mockScenario?: MockScenarioId
}

export async function runPortalListingCheck(
  opts: RunPortalCheckOptions
): Promise<PortalListingCheckResult> {
  const { postcode, vendorAskingPrice, address, isMock, mockScenario } = opts

  let forSaleResult: ForSaleResult | null
  let historyResult: ListingHistoryResult | null

  if (isMock && mockScenario) {
    forSaleResult = getMockForSaleResult(mockScenario, vendorAskingPrice, address)
    historyResult = getMockListingHistoryResult(mockScenario, vendorAskingPrice, address)
  } else {
    ;[forSaleResult, historyResult] = await Promise.all([
      fetchForSaleListings(postcode),
      fetchListingHistory(postcode),
    ])
  }

  const flags = generateFlags(forSaleResult, historyResult, vendorAskingPrice)
  const overallRisk = deriveRisk(flags)

  // Surface the most notable active listing (highest price or most days)
  const activeListings = forSaleResult?.listings ?? []
  const activeListing =
    activeListings.length > 0
      ? activeListings.sort((a, b) => (b.daysListed ?? 0) - (a.daysListed ?? 0))[0]
      : null

  const recentlyDelisted = (historyResult?.history ?? []).some(entry => {
    if (!entry.dateRemoved) return false
    const removedMs = new Date(entry.dateRemoved).getTime()
    const nowMs = Date.now()
    return (nowMs - removedMs) / 86_400_000 <= RECENTLY_DELISTED_DAYS
  })

  return {
    flags,
    overallRisk,
    activeListing,
    activeListingCount: activeListings.length,
    recentlyDelisted,
    isMockData: !!(isMock && mockScenario),
    raw: { forSale: forSaleResult, history: historyResult },
  }
}

// ---------------------------------------------------------------------------
// Flag generation logic
// ---------------------------------------------------------------------------

function generateFlags(
  forSale: ForSaleResult | null,
  history: ListingHistoryResult | null,
  vendorAskingPrice: number
): PortalFlag[] {
  const flags: PortalFlag[] = []
  const activeListings = forSale?.listings ?? []
  const historyEntries = history?.history ?? []

  // ---- No presence at all ----
  if (activeListings.length === 0 && historyEntries.length === 0) {
    flags.push({
      code: 'NEVER_LISTED',
      severity: 'clear',
      label: 'Never Listed',
      detail: 'No active or historical portal listings found for this postcode.',
    })
    return flags
  }

  // ---- Active listings ----
  if (activeListings.length > 0) {
    for (const listing of activeListings) {
      const discrepancyPct =
        vendorAskingPrice > 0
          ? (listing.price - vendorAskingPrice) / vendorAskingPrice
          : 0

      const originalPrice = listing.originalPrice ?? listing.price
      const isReduced = originalPrice > 0 && (originalPrice - listing.price) / originalPrice > REDUCED_THRESHOLD_PCT

      if (discrepancyPct > PRICE_DISCREPANCY_PCT) {
        flags.push({
          code: 'PRICE_DISCREPANCY_HIGH',
          severity: 'red_flag',
          label: 'Price Discrepancy',
          detail: `Portal price £${listing.price.toLocaleString()} is ${Math.round(discrepancyPct * 100)}% above vendor asking price of £${vendorAskingPrice.toLocaleString()}.`,
        })
      }

      if (isReduced) {
        flags.push({
          code: 'CURRENTLY_LISTED_REDUCED',
          severity: 'caution',
          label: 'Listed at Reduced Price',
          detail: `Property listed at £${listing.price.toLocaleString()} — reduced from £${originalPrice.toLocaleString()} on ${listing.source}.`,
        })
      } else if (discrepancyPct <= PRICE_DISCREPANCY_PCT) {
        flags.push({
          code: 'CURRENTLY_LISTED_FULL_PRICE',
          severity: 'red_flag',
          label: 'Currently Listed at Full Price',
          detail: `Active listing on ${listing.source} at £${listing.price.toLocaleString()} for ${listing.daysListed ?? '?'} days.`,
        })
      }

      if ((listing.daysListed ?? 0) > LONG_ON_MARKET_DAYS) {
        flags.push({
          code: 'LONG_TIME_ON_MARKET',
          severity: 'caution',
          label: 'Long Time on Market',
          detail: `Listed for ${listing.daysListed} days on ${listing.source}. Vendor may be motivated.`,
        })
      }
    }

    // Sole agency risk: vendor claims direct / off-market but appears on a portal with only one listing
    if (activeListings.length === 1) {
      flags.push({
        code: 'SOLE_AGENCY_RISK',
        severity: 'caution',
        label: 'Sole Agency Risk',
        detail: `Property found on one portal (${activeListings[0].source}). Verify vendor has no active agency agreement.`,
      })
    }
  }

  // ---- Historical listings ----
  for (const entry of historyEntries) {
    if (!entry.dateRemoved) continue
    const removedMs = new Date(entry.dateRemoved).getTime()
    const daysSince = (Date.now() - removedMs) / 86_400_000
    if (daysSince <= RECENTLY_DELISTED_DAYS) {
      flags.push({
        code: 'RECENTLY_DELISTED',
        severity: 'caution',
        label: 'Recently Delisted',
        detail: `Property was removed from ${entry.source} ${Math.round(daysSince)} day(s) ago (listed for ${entry.daysListed} days).`,
      })
      // Add sole agency risk when delisted
      if (!flags.find(f => f.code === 'SOLE_AGENCY_RISK')) {
        flags.push({
          code: 'SOLE_AGENCY_RISK',
          severity: 'caution',
          label: 'Sole Agency Risk',
          detail: 'Property was recently listed via an agent. Verify the sole agency period has expired.',
        })
      }
    }
  }

  return deduplicateFlags(flags)
}

function deduplicateFlags(flags: PortalFlag[]): PortalFlag[] {
  const seen = new Set<string>()
  return flags.filter(f => {
    if (seen.has(f.code)) return false
    seen.add(f.code)
    return true
  })
}

function deriveRisk(flags: PortalFlag[]): FlagSeverity {
  if (flags.some(f => f.severity === 'red_flag')) return 'red_flag'
  if (flags.some(f => f.severity === 'caution')) return 'caution'
  return 'clear'
}
