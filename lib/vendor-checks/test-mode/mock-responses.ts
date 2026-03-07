/**
 * Mock API response data for each test scenario.
 * Shapes EXACTLY match the real API client return types so flag-generation
 * logic processes mock data identically to real data.
 */

import type { MockScenarioId } from './mock-scenarios'
import type {
  ForSaleResult,
  ListingHistoryResult,
  ActiveListing,
  ListingHistoryEntry,
  PortalAgent,
} from '@/lib/propertydata'
import type { ScrapedPortalListing } from '@/lib/vendor-checks/scraped-listings-check'
import type { LivePortalCheckResult, LivePortalResult } from '@/lib/vendor-checks/live-portal-check'

const MOCK_AGENT_RIGHTMOVE: PortalAgent = {
  name: 'Bairstow Eves',
  phone: '01639 882200',
  branch: 'Port Talbot',
}

const MOCK_AGENT_ZOOPLA: PortalAgent = {
  name: 'Peter Alan',
  phone: '01639 891030',
  branch: 'Neath',
}

// ---------------------------------------------------------------------------
// Portal (PropertyData) mock responses
// ---------------------------------------------------------------------------

export function getMockForSaleResult(
  scenario: MockScenarioId,
  vendorAskingPrice: number,
  address: string
): ForSaleResult {
  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().split('T')[0]

  switch (scenario) {
    case 'CLEAR_NEVER_LISTED':
      return { listings: [], count: 0, creditsUsed: 1 }

    case 'CAUTION_RECENTLY_DELISTED':
      // Delisted — no active listings
      return { listings: [], count: 0, creditsUsed: 1 }

    case 'CAUTION_LONG_ON_MARKET': {
      const listing: ActiveListing = {
        address,
        price: Math.round(vendorAskingPrice * 0.92), // price reduced to below asking
        originalPrice: vendorAskingPrice,
        daysListed: 120,
        dateListed: daysAgo(120),
        bedrooms: 3,
        propertyType: 'Terraced house',
        listingId: 'rm_mock_002',
        source: 'rightmove',
        url: 'https://www.rightmove.co.uk/properties/mock002',
        agent: MOCK_AGENT_RIGHTMOVE,
        priceReductions: 2,
      }
      return { listings: [listing], count: 1, creditsUsed: 1 }
    }

    case 'RED_CURRENTLY_LISTED': {
      const rmListing: ActiveListing = {
        address,
        price: vendorAskingPrice,
        originalPrice: vendorAskingPrice,
        daysListed: 43,
        dateListed: daysAgo(43),
        bedrooms: 3,
        propertyType: 'Terraced house',
        listingId: 'rm_mock_003',
        source: 'rightmove',
        url: 'https://www.rightmove.co.uk/properties/mock003',
        agent: MOCK_AGENT_RIGHTMOVE,
        priceReductions: 0,
      }
      const zpListing: ActiveListing = {
        ...rmListing,
        listingId: 'zp_mock_003',
        source: 'zoopla',
        url: 'https://www.zoopla.co.uk/for-sale/details/mock003',
        agent: MOCK_AGENT_ZOOPLA,
      }
      return { listings: [rmListing, zpListing], count: 2, creditsUsed: 1 }
    }

    case 'RED_PRICE_DISCREPANCY': {
      const portalPrice = Math.round(vendorAskingPrice * 1.29) // 29% above vendor claim
      const listing: ActiveListing = {
        address,
        price: portalPrice,
        originalPrice: portalPrice,
        daysListed: 21,
        dateListed: daysAgo(21),
        bedrooms: 3,
        propertyType: 'Semi-detached house',
        listingId: 'rm_mock_004',
        source: 'rightmove',
        url: 'https://www.rightmove.co.uk/properties/mock004',
        agent: MOCK_AGENT_RIGHTMOVE,
        priceReductions: 0,
      }
      return { listings: [listing], count: 1, creditsUsed: 1 }
    }
  }
}

export function getMockListingHistoryResult(
  scenario: MockScenarioId,
  vendorAskingPrice: number,
  address: string
): ListingHistoryResult {
  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString().split('T')[0]

  switch (scenario) {
    case 'CLEAR_NEVER_LISTED':
      return { history: [], count: 0, creditsUsed: 1 }

    case 'CAUTION_RECENTLY_DELISTED': {
      const entry: ListingHistoryEntry = {
        address,
        listedPrice: vendorAskingPrice,
        finalPrice: vendorAskingPrice,
        daysListed: 67,
        dateListed: daysAgo(79),
        dateRemoved: daysAgo(12),
        source: 'rightmove',
        url: 'https://www.rightmove.co.uk/properties/mock001',
        agent: MOCK_AGENT_RIGHTMOVE,
        priceReductions: 1,
      }
      return { history: [entry], count: 1, creditsUsed: 1 }
    }

    case 'CAUTION_LONG_ON_MARKET':
      // Still active — no history yet
      return { history: [], count: 0, creditsUsed: 1 }

    case 'RED_CURRENTLY_LISTED':
      // Still active — no history yet
      return { history: [], count: 0, creditsUsed: 1 }

    case 'RED_PRICE_DISCREPANCY':
      // Still active — no history yet
      return { history: [], count: 0, creditsUsed: 1 }
  }
}

// ---------------------------------------------------------------------------
// Scraped portal database mock responses
// ---------------------------------------------------------------------------

export function getMockScrapedListings(
  scenario: MockScenarioId,
  vendorAskingPrice: number,
  address: string
): ScrapedPortalListing[] {
  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000)

  switch (scenario) {
    case 'CLEAR_NEVER_LISTED':
      return []

    case 'CAUTION_RECENTLY_DELISTED':
      // Already removed from portals — not in our active DB
      return []

    case 'CAUTION_LONG_ON_MARKET':
      return [
        {
          source: 'RIGHTMOVE',
          listingUrl: 'https://www.rightmove.co.uk/properties/mock_long_002',
          price: Math.round(vendorAskingPrice * 0.92),
          status: 'FOR_SALE',
          daysOnMarket: 120,
          hasReduction: true,
          reductionPct: 8,
          originalPrice: vendorAskingPrice,
          agent: { name: 'Bairstow Eves', branch: 'Port Talbot', phone: '01639 882200' },
          scrapedAt: daysAgo(1),
          propertyType: 'Terraced house',
          bedrooms: 3,
        },
      ]

    case 'RED_CURRENTLY_LISTED':
      return [
        {
          source: 'RIGHTMOVE',
          listingUrl: 'https://www.rightmove.co.uk/properties/mock_active_003',
          price: vendorAskingPrice,
          status: 'FOR_SALE',
          daysOnMarket: 43,
          hasReduction: false,
          reductionPct: null,
          originalPrice: null,
          agent: { name: 'Bairstow Eves', branch: 'Port Talbot', phone: '01639 882200' },
          scrapedAt: daysAgo(1),
          propertyType: 'Terraced house',
          bedrooms: 3,
        },
        {
          source: 'ZOOPLA',
          listingUrl: 'https://www.zoopla.co.uk/for-sale/details/mock_active_003',
          price: vendorAskingPrice,
          status: 'FOR_SALE',
          daysOnMarket: 43,
          hasReduction: false,
          reductionPct: null,
          originalPrice: null,
          agent: { name: 'Peter Alan', branch: 'Neath', phone: '01639 891030' },
          scrapedAt: daysAgo(1),
          propertyType: 'Terraced house',
          bedrooms: 3,
        },
        {
          source: 'ONTHEMARKET',
          listingUrl: 'https://www.onthemarket.com/details/mock_active_003',
          price: vendorAskingPrice,
          status: 'FOR_SALE',
          daysOnMarket: 41,
          hasReduction: false,
          reductionPct: null,
          originalPrice: null,
          agent: { name: 'Bairstow Eves', branch: 'Port Talbot', phone: '01639 882200' },
          scrapedAt: daysAgo(2),
          propertyType: 'Terraced house',
          bedrooms: 3,
        },
      ]

    case 'RED_PRICE_DISCREPANCY': {
      const portalPrice = Math.round(vendorAskingPrice * 1.29)
      return [
        {
          source: 'RIGHTMOVE',
          listingUrl: 'https://www.rightmove.co.uk/properties/mock_discrepancy_004',
          price: portalPrice,
          status: 'FOR_SALE',
          daysOnMarket: 21,
          hasReduction: false,
          reductionPct: null,
          originalPrice: null,
          agent: { name: 'Bairstow Eves', branch: 'Port Talbot', phone: '01639 882200' },
          scrapedAt: daysAgo(1),
          propertyType: 'Semi-detached house',
          bedrooms: 3,
        },
      ]
    }
  }
}

// ---------------------------------------------------------------------------
// Land Registry / ownership mock responses
// ---------------------------------------------------------------------------

export interface MockOwnershipData {
  lastSalePrice: number | null
  lastSaleDate: string | null   // ISO date "YYYY-MM-DD"
  tenure: string | null
  isCorporateOwned: boolean
  companyName: string | null
}

export function getMockOwnershipData(
  scenario: MockScenarioId,
  vendorAskingPrice: number
): MockOwnershipData {
  switch (scenario) {
    case 'CLEAR_NEVER_LISTED':
      return {
        lastSalePrice: Math.round(vendorAskingPrice * 0.65),
        lastSaleDate: '2018-03-15',
        tenure: 'Freehold',
        isCorporateOwned: false,
        companyName: null,
      }

    case 'CAUTION_RECENTLY_DELISTED':
      return {
        lastSalePrice: Math.round(vendorAskingPrice * 0.78),
        lastSaleDate: '2020-07-22',
        tenure: 'Freehold',
        isCorporateOwned: false,
        companyName: null,
      }

    case 'CAUTION_LONG_ON_MARKET':
      return {
        lastSalePrice: Math.round(vendorAskingPrice * 0.82),
        lastSaleDate: '2019-11-04',
        tenure: 'Freehold',
        isCorporateOwned: false,
        companyName: null,
      }

    case 'RED_CURRENTLY_LISTED':
      return {
        lastSalePrice: Math.round(vendorAskingPrice * 0.76),
        lastSaleDate: '2019-03-12',
        tenure: 'Freehold',
        isCorporateOwned: false,
        companyName: null,
      }

    case 'RED_PRICE_DISCREPANCY':
      return {
        lastSalePrice: Math.round(vendorAskingPrice * 0.90),
        lastSaleDate: '2021-06-17',
        tenure: 'Leasehold',
        isCorporateOwned: false,
        companyName: null,
      }
  }
}

// ---------------------------------------------------------------------------
// Live portal check mock responses
// ---------------------------------------------------------------------------

function makeResult(
  source: LivePortalResult['source'],
  status: LivePortalResult['status'],
  listings: LivePortalResult['listings'] = [],
  matchedListings: LivePortalResult['matchedListings'] = [],
  errorMessage?: string
): LivePortalResult {
  return { source, status, listings, matchedListings, errorMessage }
}

export function getMockLivePortalResults(
  scenario: MockScenarioId,
  vendorAskingPrice: number,
  vendorAddress: string
): LivePortalCheckResult {
  switch (scenario) {
    case 'CLEAR_NEVER_LISTED':
      return {
        results: [
          makeResult('RIGHTMOVE', 'no_listings'),
          makeResult('ZOOPLA', 'no_listings'),
          makeResult('ONTHEMARKET', 'no_listings'),
          makeResult('PRIMELOCATION', 'no_listings'),
        ],
        flags: [],
        hasMatches: false,
        blockedPortals: [],
        isMockData: true,
      }

    case 'CAUTION_RECENTLY_DELISTED':
      // Was listed but now removed — portals return no active listing
      return {
        results: [
          makeResult('RIGHTMOVE', 'no_listings'),
          makeResult('ZOOPLA', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
          makeResult('ONTHEMARKET', 'no_listings'),
          makeResult('PRIMELOCATION', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
        ],
        flags: [],
        hasMatches: false,
        blockedPortals: ['ZOOPLA', 'PRIMELOCATION'],
        isMockData: true,
      }

    case 'CAUTION_LONG_ON_MARKET': {
      const listing = {
        listingUrl: 'https://www.rightmove.co.uk/properties/mock_long_002',
        price: Math.round(vendorAskingPrice * 0.92),
        address: vendorAddress,
        isSoldSTC: false,
        bedrooms: 3,
        propertyType: 'Terraced house',
        agent: { name: 'Bairstow Eves', phone: '01639 882200' },
      }
      return {
        results: [
          makeResult('RIGHTMOVE', 'success', [listing], [listing]),
          makeResult('ZOOPLA', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
          makeResult('ONTHEMARKET', 'no_listings'),
          makeResult('PRIMELOCATION', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
        ],
        flags: [
          {
            code: 'LIVE_CURRENTLY_LISTED',
            severity: 'red_flag',
            label: 'Live Listing Found (Direct Portal Check)',
            detail: `Property found live on RIGHTMOVE at £${Math.round(vendorAskingPrice * 0.92).toLocaleString()}. Vendor must withdraw listing before purchase can proceed.`,
          },
        ],
        hasMatches: true,
        blockedPortals: ['ZOOPLA', 'PRIMELOCATION'],
        isMockData: true,
      }
    }

    case 'RED_CURRENTLY_LISTED': {
      const rmListing = {
        listingUrl: 'https://www.rightmove.co.uk/properties/mock_active_003',
        price: vendorAskingPrice,
        address: vendorAddress,
        isSoldSTC: false,
        bedrooms: 3,
        propertyType: 'Terraced house',
        agent: { name: 'Bairstow Eves', phone: '01639 882200' },
      }
      const otmListing = {
        listingUrl: 'https://www.onthemarket.com/details/mock_active_003/',
        price: vendorAskingPrice,
        address: vendorAddress,
        isSoldSTC: false,
        bedrooms: 3,
        propertyType: 'Terraced house',
        agent: { name: 'Bairstow Eves', phone: '01639 882200' },
      }
      return {
        results: [
          makeResult('RIGHTMOVE', 'success', [rmListing], [rmListing]),
          makeResult('ZOOPLA', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
          makeResult('ONTHEMARKET', 'success', [otmListing], [otmListing]),
          makeResult('PRIMELOCATION', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
        ],
        flags: [
          {
            code: 'LIVE_CURRENTLY_LISTED',
            severity: 'red_flag',
            label: 'Live Listing Found (Direct Portal Check)',
            detail: `Property found live on RIGHTMOVE, ONTHEMARKET at £${vendorAskingPrice.toLocaleString()}. Vendor must withdraw listing before purchase can proceed.`,
          },
        ],
        hasMatches: true,
        blockedPortals: ['ZOOPLA', 'PRIMELOCATION'],
        isMockData: true,
      }
    }

    case 'RED_PRICE_DISCREPANCY': {
      const portalPrice = Math.round(vendorAskingPrice * 1.29)
      const listing = {
        listingUrl: 'https://www.rightmove.co.uk/properties/mock_discrepancy_004',
        price: portalPrice,
        address: vendorAddress,
        isSoldSTC: false,
        bedrooms: 3,
        propertyType: 'Semi-detached house',
        agent: { name: 'Bairstow Eves', phone: '01639 882200' },
      }
      return {
        results: [
          makeResult('RIGHTMOVE', 'success', [listing], [listing]),
          makeResult('ZOOPLA', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
          makeResult('ONTHEMARKET', 'no_listings'),
          makeResult('PRIMELOCATION', 'blocked', [], [], 'RSC streaming — data not extractable without browser'),
        ],
        flags: [
          {
            code: 'LIVE_CURRENTLY_LISTED',
            severity: 'red_flag',
            label: 'Live Listing Found (Direct Portal Check)',
            detail: `Property found live on RIGHTMOVE at £${portalPrice.toLocaleString()}. Vendor must withdraw listing before purchase can proceed.`,
          },
        ],
        hasMatches: true,
        blockedPortals: ['ZOOPLA', 'PRIMELOCATION'],
        isMockData: true,
      }
    }
  }
}
