/**
 * Vendor check orchestrator.
 * Ties together:
 *   1. PropertyData API portal listing check
 *   2. Land Registry ownership check
 *   3. Scraped portal database check (Rightmove / Zoopla / OnTheMarket / PrimeLocation)
 *
 * Persists the combined result to VendorPropertyCheck and updates the lead's
 * latestCheckRisk. Safe to call fire-and-forget from the webhook (auto) or
 * awaited from the manual re-run API endpoint.
 */

import { prisma } from '@/lib/db'
import { normaliseAddress } from './address-normaliser'
import { runPortalListingCheck } from './portal-listing-check'
import { runOwnershipCheck } from './ownership-check'
import { runScrapedListingsCheck } from './scraped-listings-check'
import type { ScrapedPortalListing } from './scraped-listings-check'
import { runLivePortalCheck } from './live-portal-check'
import type { LivePortalResult } from './live-portal-check'
import { runFreeholdsCheck } from './freeholds-check'
import type { FreeholdsTitle } from './freeholds-check'
import { shouldUseMockData, getTestScenario } from './test-mode'
import type { PortalFlag, FlagSeverity } from './portal-listing-check'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrchestratorResult {
  checkId: string
  overallRisk: FlagSeverity
  riskScore: number
  flags: PortalFlag[]
  isMockData: boolean
  durationMs: number
  scrapedListings: ScrapedPortalListing[]
  livePortalResults: LivePortalResult[]
  blockedPortals: string[]
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Run a full vendor property check for the given lead.
 * Safe to call fire-and-forget — all errors are caught and written to DB.
 */
export async function runVendorCheck(
  vendorLeadId: string,
  triggeredBy: 'auto' | 'manual'
): Promise<OrchestratorResult | null> {
  const startMs = Date.now()

  // --- 1. Create pending check record ---
  const check = await prisma.vendorPropertyCheck.create({
    data: {
      vendorLeadId,
      triggeredBy,
      checkStatus: 'running',
    },
  })

  try {
    // --- 2. Fetch lead ---
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
      select: {
        id: true,
        propertyAddress: true,
        propertyPostcode: true,
        askingPrice: true,
        isTest: true,
        testScenario: true,
        leadSource: true,
      },
    })

    if (!lead) throw new Error(`VendorLead ${vendorLeadId} not found`)

    // --- 3. Resolve address / postcode ---
    const normAddr = normaliseAddress(
      [lead.propertyAddress, lead.propertyPostcode].filter(Boolean).join(', ')
    )
    const postcode = normAddr.postcode ?? lead.propertyPostcode ?? ''
    const vendorAskingPrice = lead.askingPrice ? Number(lead.askingPrice) : 0
    const vendorAddress = lead.propertyAddress ?? ''

    // --- 4. Determine test mode ---
    const useMock = shouldUseMockData(lead)
    const mockScenario = useMock ? getTestScenario(lead) : null

    // --- 5. Run all five checks in parallel ---
    const [portalResult, ownershipResult, scrapedResult, liveResult, freeholdsResult] = await Promise.all([
      runPortalListingCheck({
        postcode,
        vendorAskingPrice,
        address: vendorAddress,
        isMock: useMock,
        mockScenario: mockScenario ?? undefined,
      }),
      runOwnershipCheck({
        postcode,
        address: vendorAddress,
        vendorAskingPrice,
        isMock: useMock,
        mockScenario: mockScenario ?? undefined,
      }),
      runScrapedListingsCheck({
        postcode,
        vendorAddress,
        vendorAskingPrice,
        isMock: useMock,
        mockScenario: mockScenario ?? undefined,
      }),
      runLivePortalCheck({
        postcode,
        vendorAddress,
        vendorAskingPrice,
        isMock: useMock,
        mockScenario: mockScenario ?? undefined,
      }),
      runFreeholdsCheck({
        postcode,
        isMock: useMock,
      }),
    ])

    // --- 6. Combine results ---
    const allFlags: PortalFlag[] = [
      ...portalResult.flags,
      ...ownershipResult.flags,
      ...scrapedResult.flags,
      ...liveResult.flags,
      ...freeholdsResult.flags,
    ]

    const overallRisk = deriveOverallRisk([
      portalResult.overallRisk,
      ...ownershipResult.flags.map((f) => f.severity),
      ...scrapedResult.flags.map((f) => f.severity),
      ...liveResult.flags.map((f) => f.severity),
      ...freeholdsResult.flags.map((f) => f.severity),
    ])
    const riskScore = computeRiskScore(allFlags)
    const durationMs = Date.now() - startMs

    // --- 7. Persist ---
    const updatedCheck = await prisma.vendorPropertyCheck.update({
      where: { id: check.id },
      data: {
        completedAt: new Date(),
        durationMs,
        checkStatus: 'success',
        isMockData: useMock,
        mockScenarioId: mockScenario,
        // Store full portal result + scraped matches + live results together
        portalCheckRaw: {
          activeListing: portalResult.activeListing,
          activeListingCount: portalResult.activeListingCount,
          recentlyDelisted: portalResult.recentlyDelisted,
          raw: portalResult.raw,
          scrapedMatches: scrapedResult.listings,
          liveResults: liveResult.results,
          blockedPortals: liveResult.blockedPortals,
        } as any,
        ownershipCheckRaw: {
          isCorporateOwned: ownershipResult.isCorporateOwned,
          isOverseasOwned: ownershipResult.isOverseasOwned,
          isPortfolioOwner: ownershipResult.isPortfolioOwner,
          companyName: ownershipResult.companyName,
          lastSalePrice: ownershipResult.lastSalePrice,
          lastSaleDate: ownershipResult.lastSaleDate,
          tenure: ownershipResult.tenure ?? freeholdsResult.inferredTenure,
          equityEstimate: ownershipResult.equityEstimate,
          // Freehold title data from PropertyData /freeholds
          freeholds: {
            inferredTenure: freeholdsResult.inferredTenure,
            resultCount: freeholdsResult.resultCount,
            nearestTitle: freeholdsResult.nearestTitle,
            allTitles: freeholdsResult.allTitles,
          },
        } as any,
        overallRisk,
        riskScore,
        summaryFlags: allFlags as any,
        recommendedAction: buildRecommendedAction(overallRisk, allFlags),
      },
    })

    // --- 8. Update lead summary ---
    await prisma.vendorLead.update({
      where: { id: vendorLeadId },
      data: {
        latestCheckRisk: overallRisk,
        latestCheckedAt: new Date(),
      },
    })

    return {
      checkId: updatedCheck.id,
      overallRisk,
      riskScore,
      flags: allFlags,
      isMockData: useMock,
      durationMs,
      scrapedListings: scrapedResult.listings,
      livePortalResults: liveResult.results,
      blockedPortals: liveResult.blockedPortals,
    }

  } catch (error: any) {
    // Write failure state — never throw (safe for fire-and-forget usage)
    console.error(`[VendorCheck] Failed for lead ${vendorLeadId}:`, error)

    await prisma.vendorPropertyCheck.update({
      where: { id: check.id },
      data: {
        checkStatus: 'failed',
        errorMessage: error?.message ?? 'Unknown error',
        completedAt: new Date(),
        durationMs: Date.now() - startMs,
      },
    }).catch(() => {})

    return null
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveOverallRisk(severities: FlagSeverity[]): FlagSeverity {
  if (severities.includes('red_flag')) return 'red_flag'
  if (severities.includes('caution')) return 'caution'
  return 'clear'
}

const SEVERITY_SCORE: Record<FlagSeverity, number> = {
  clear: 0,
  caution: 25,
  red_flag: 50,
}

function computeRiskScore(flags: PortalFlag[]): number {
  const total = flags.reduce((sum, f) => sum + SEVERITY_SCORE[f.severity], 0)
  return Math.min(total, 100)
}

function buildRecommendedAction(risk: FlagSeverity, flags: PortalFlag[]): string {
  const codes = flags.map((f) => f.code)

  if (codes.includes('LIVE_CURRENTLY_LISTED')) {
    return 'Property confirmed live on portals via direct check. Vendor must withdraw all listings and confirm no active sole agency agreement before purchase can proceed.'
  }
  if (codes.includes('CURRENTLY_LISTED_FULL_PRICE') || codes.includes('SCRAPED_CURRENTLY_LISTED')) {
    return 'Property is currently listed on portals at full price. Confirm vendor intends to withdraw from all agency agreements before proceeding.'
  }
  if (codes.includes('PRICE_DISCREPANCY_HIGH') || codes.includes('SCRAPED_PRICE_DISCREPANCY')) {
    return 'Significant price discrepancy between vendor claim and portal listing. Clarify which price is correct before making an offer.'
  }
  if (codes.includes('RECENTLY_DELISTED')) {
    return 'Property was recently delisted. Ask vendor to confirm the sole agency period has expired.'
  }
  if (codes.includes('SCRAPED_SOLD_STC')) {
    return 'Property appears as Sold STC or Under Offer in our portal database. Verify with vendor before progressing.'
  }
  if (risk === 'caution') {
    return 'Review flagged items with the vendor before progressing. Pipeline continues — no immediate block.'
  }
  return 'No significant issues found. Proceed with standard due diligence.'
}
