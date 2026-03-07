/**
 * Scraped listings check service.
 * Queries our own PropertyListing database (scraped from Rightmove, Zoopla,
 * OnTheMarket, and PrimeLocation) to find if the vendor's property is listed
 * on one of these portals.
 *
 * Complements the PropertyData API check with:
 *   - Portal-specific listing URLs (direct links to Rightmove / Zoopla etc.)
 *   - Agent name, branch, and phone from the scraped listing
 *   - Detailed price history (how many reductions, original list price)
 *   - Status: FOR_SALE, SOLD_STC, or UNDER_OFFER
 *
 * Flag codes produced:
 *   SCRAPED_CURRENTLY_LISTED          – active listing found in our portal database
 *   SCRAPED_CURRENTLY_LISTED_REDUCED  – active listing but price has been reduced
 *   SCRAPED_LONG_ON_MARKET            – active listing for >90 days
 *   SCRAPED_PRICE_DISCREPANCY         – portal price >10% above vendor asking price
 *   SCRAPED_SOLD_STC                  – listing shows Sold STC / Under Offer
 */

import { prisma } from "@/lib/db"
import type { PortalFlag, FlagSeverity } from "./portal-listing-check"
import type { MockScenarioId } from "./test-mode/mock-scenarios"
import { getMockScrapedListings } from "./test-mode/mock-responses"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedPortalListing {
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  listingUrl: string | null
  price: number
  status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER"
  daysOnMarket: number
  hasReduction: boolean
  reductionPct: number | null
  originalPrice: number | null
  agent: {
    name?: string
    branch?: string
    phone?: string
  }
  scrapedAt: Date
  propertyType: string
  bedrooms: number
}

export interface ScrapedListingsResult {
  found: boolean
  listings: ScrapedPortalListing[]
  flags: PortalFlag[]
  isMockData: boolean
}

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

const LONG_ON_MARKET_DAYS = 90
const PRICE_DISCREPANCY_PCT = 0.1 // >10% above vendor claim
const REDUCED_THRESHOLD_PCT = 5 // >5% below original = reduced

// ---------------------------------------------------------------------------
// Address-matching helpers (local to avoid circular imports)
// ---------------------------------------------------------------------------

function extractHouseNumber(address: string): string | null {
  const m = address.match(/^\s*(\d+[a-zA-Z]?)[\s,]/)
  return m ? m[1].toLowerCase() : null
}

function extractStreetToken(address: string): string | null {
  // Strip leading house number then take first meaningful word
  const cleaned = address.replace(/^\s*\d+[a-zA-Z]?\s*,?\s*/, "").trim()
  const parts = cleaned.split(/[\s,]+/)
  return parts.find((p) => p.length >= 4)?.toLowerCase() ?? null
}

function addressesMatch(dbAddress: string, vendorAddress: string): boolean {
  const houseNum = extractHouseNumber(vendorAddress)
  const streetToken = extractStreetToken(vendorAddress)
  if (!houseNum && !streetToken) return false
  const normalized = dbAddress.toLowerCase()
  const hasHouse = houseNum ? normalized.includes(houseNum) : true
  const hasStreet = streetToken ? normalized.includes(streetToken) : true
  return hasHouse && hasStreet
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

interface RunScrapedListingsCheckOptions {
  postcode: string
  vendorAddress: string
  vendorAskingPrice: number
  isMock?: boolean
  mockScenario?: MockScenarioId
}

export async function runScrapedListingsCheck(
  opts: RunScrapedListingsCheckOptions
): Promise<ScrapedListingsResult> {
  const { postcode, vendorAddress, vendorAskingPrice, isMock, mockScenario } = opts

  // --- Mock mode ---
  if (isMock && mockScenario) {
    const mockListings = getMockScrapedListings(mockScenario, vendorAskingPrice, vendorAddress)
    const flags = generateFlags(mockListings, vendorAskingPrice)
    return { found: mockListings.length > 0, listings: mockListings, flags, isMockData: true }
  }

  if (!postcode) {
    return { found: false, listings: [], flags: [], isMockData: false }
  }

  // --- Query PropertyListing by postcode (stored in JSON address field) ---
  let dbRows: any[]
  try {
    dbRows = await prisma.propertyListing.findMany({
      where: {
        address: {
          path: ["postcode"],
          equals: postcode.toUpperCase().trim(),
        },
        status: { in: ["FOR_SALE", "SOLD_STC", "UNDER_OFFER"] },
      },
      select: {
        source: true,
        listingUrl: true,
        price: true,
        status: true,
        daysOnMarket: true,
        bmvIndicators: true,
        agent: true,
        scrapedAt: true,
        propertyType: true,
        bedrooms: true,
        address: true,
      },
      orderBy: { scrapedAt: "desc" },
      take: 50, // cap — postcodes rarely have >10 active listings
    })
  } catch {
    // DB error — degrade gracefully
    return { found: false, listings: [], flags: [], isMockData: false }
  }

  // --- Address-match ---
  const matched = dbRows.filter((row) => {
    const addr = row.address as any
    const dbAddress: string = addr?.displayAddress ?? addr?.street ?? ""
    return addressesMatch(dbAddress, vendorAddress)
  })

  const listings: ScrapedPortalListing[] = matched.map((row) => {
    const bmi = (row.bmvIndicators as any) ?? {}
    return {
      source: row.source as ScrapedPortalListing["source"],
      listingUrl: row.listingUrl ?? null,
      price: Number(row.price),
      status: row.status as ScrapedPortalListing["status"],
      daysOnMarket: row.daysOnMarket ?? 0,
      hasReduction: bmi.hasReduction ?? false,
      reductionPct: bmi.reductionPercentage ?? null,
      originalPrice: bmi.originalPrice ?? null,
      agent: (row.agent as any) ?? {},
      scrapedAt: row.scrapedAt,
      propertyType: row.propertyType ?? "",
      bedrooms: row.bedrooms ?? 0,
    }
  })

  const flags = generateFlags(listings, vendorAskingPrice)
  return { found: listings.length > 0, listings, flags, isMockData: false }
}

// ---------------------------------------------------------------------------
// Flag generation
// ---------------------------------------------------------------------------

function generateFlags(
  listings: ScrapedPortalListing[],
  vendorAskingPrice: number
): PortalFlag[] {
  const flags: PortalFlag[] = []
  if (listings.length === 0) return flags

  const active = listings.filter((l) => l.status === "FOR_SALE")
  const soldSTC = listings.filter(
    (l) => l.status === "SOLD_STC" || l.status === "UNDER_OFFER"
  )

  // ---- Active listings ----
  if (active.length > 0) {
    const sources = [...new Set(active.map((l) => l.source))].join(", ")

    // Price discrepancy (highest portal price vs vendor claim)
    const maxDiscrepancy = Math.max(
      ...active.map((l) =>
        vendorAskingPrice > 0 ? (l.price - vendorAskingPrice) / vendorAskingPrice : 0
      )
    )
    if (maxDiscrepancy > PRICE_DISCREPANCY_PCT) {
      const worst = active.reduce((a, b) =>
        (b.price - vendorAskingPrice) / vendorAskingPrice >
        (a.price - vendorAskingPrice) / vendorAskingPrice
          ? b
          : a
      )
      flags.push({
        code: "SCRAPED_PRICE_DISCREPANCY",
        severity: "red_flag",
        label: "Price Discrepancy (Our Portal Database)",
        detail: `${worst.source}: portal price £${worst.price.toLocaleString()} is ${Math.round(maxDiscrepancy * 100)}% above vendor asking price of £${vendorAskingPrice.toLocaleString()}.`,
      })
    }

    // Long on market
    const longest = active.reduce((a, b) => (b.daysOnMarket > a.daysOnMarket ? b : a))
    if (longest.daysOnMarket > LONG_ON_MARKET_DAYS) {
      flags.push({
        code: "SCRAPED_LONG_ON_MARKET",
        severity: "caution",
        label: "Long Time on Market (Our Portal Database)",
        detail: `Found on ${longest.source} for ${longest.daysOnMarket} days. Vendor may be motivated to accept a lower offer.`,
      })
    }

    // Currently listed (reduced or full price)
    const anyReduced = active.some(
      (l) => l.hasReduction && (l.reductionPct ?? 0) >= REDUCED_THRESHOLD_PCT
    )
    if (anyReduced) {
      const reduced = active.filter(
        (l) => l.hasReduction && (l.reductionPct ?? 0) >= REDUCED_THRESHOLD_PCT
      )
      const r = reduced[0]
      flags.push({
        code: "SCRAPED_CURRENTLY_LISTED_REDUCED",
        severity: "caution",
        label: "Active Listing at Reduced Price (Our Portal Database)",
        detail: `Found on ${sources} at £${r.price.toLocaleString()}${r.originalPrice ? ` — reduced from £${r.originalPrice.toLocaleString()} (${r.reductionPct?.toFixed(1)}% off)` : ""}. Listed on ${active.length} portal(s).`,
      })
    } else {
      flags.push({
        code: "SCRAPED_CURRENTLY_LISTED",
        severity: "red_flag",
        label: "Active Listing Found (Our Portal Database)",
        detail: `Property found in our portal database on ${sources} at £${active[0].price.toLocaleString()}. Listed for ${active[0].daysOnMarket} days.`,
      })
    }
  }

  // ---- Sold STC / Under Offer ----
  if (soldSTC.length > 0) {
    const sources = [...new Set(soldSTC.map((l) => l.source))].join(", ")
    flags.push({
      code: "SCRAPED_SOLD_STC",
      severity: "caution",
      label: "Sold STC / Under Offer (Our Portal Database)",
      detail: `Property is marked as ${soldSTC[0].status.replace("_", " ")} on ${sources}. Verify vendor's current situation before proceeding.`,
    })
  }

  return flags
}
