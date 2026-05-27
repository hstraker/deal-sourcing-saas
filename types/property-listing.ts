// Client-safe PropertyListing types (Decimals → numbers, Dates → strings)

export interface PropertyListingForClient {
  id: string
  sourceId: string
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  category: "RESIDENTIAL" | "COMMERCIAL"
  title: string
  description: string
  propertyType: string
  propertySubType: string | null
  bedrooms: number
  bathrooms: number
  price: number
  priceHistory: PriceHistoryEntry[]
  address: ScrapedAddress
  squareFeet: number | null
  squareMeters: number | null
  pricePerSqFt: number | null
  commercialDetails: CommercialDetails | null
  bmvIndicators: BmvIndicatorsData
  isAmbiguous: boolean
  ambiguityReasons: string[]
  reviewStatus: "PENDING" | "APPROVED" | "REJECTED" | "AUTO_APPROVED"
  reviewNotes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  propertyDataAnalysis: any | null
  aiAnalysis: any | null
  images: string[]
  floorPlans: string[]
  agent: AgentInfo
  listingUrl: string | null
  listedDate: string | null
  daysOnMarket: number
  status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER" | "REMOVED"
  scrapedAt: string
  lastChecked: string
  checksum: string | null
  dealId: string | null
  isFavorited: boolean
  // Property feature fields
  keyFeatures: string[]
  epcRating: string | null
  tenure: string | null
  isChainFree: boolean | null
  isNewBuild: boolean | null
  isRetirement: boolean | null
  leaseYearsRemaining: number | null
  groundRent: number | null
  serviceCharge: number | null
  // ── Phase 1 Discover fields ─────────────────────────────────────────────────
  motivationScore:   number
  motivationSignals: MotivationSignal[]
  isWelsh:           boolean
  jurisdiction:      "WALES" | "ENGLAND"
  strategyViability: StrategyViabilitySnapshot
  trackerStage:      "watchlist" | "viewing" | "offer" | "rejected" | null
  // ── SSAS ───────────────────────────────────────────────────────────────────
  ssasAnalysis:      any | null
  annualRent:        number | null
}

export interface PriceHistoryEntry {
  date: string
  price: number
  changePercent?: number
}

export interface ScrapedAddress {
  displayAddress: string
  postcode?: string
  street?: string
  town?: string
  county?: string
  latitude?: number
  longitude?: number
}

export interface AgentInfo {
  name?: string
  branch?: string
  phone?: string
  logoUrl?: string
  address?: string
}

export interface CommercialDetails {
  rateableValue?: number
  leaseType?: string
  leaseYearsRemaining?: number
  businessRates?: number
  currentRent?: number
  estimatedYield?: number
  useClass?: string
  currentUse?: string
  parkingSpaces?: number
}

export interface BmvIndicatorsData {
  hasReduction: boolean
  reductionPercentage?: number
  originalPrice?: number
  needsWorkKeywords: string[]
  motivatedSellerKeywords: string[]
  isAuction: boolean
  isRepossession: boolean
  isProbate: boolean
  isCashBuyersOnly: boolean
  longTimeOnMarket: boolean
  daysOnMarket: number
  bmvScore: number
  // Land Registry ownership intelligence (populated post-scrape when data is imported)
  isCorporateOwned?: boolean
  isOverseasOwned?: boolean
  isPortfolioOwner?: boolean
  proprietorType?: string | null
  ownerCompanyName?: string | null
}

// ── Phase 1 Discover types ─────────────────────────────────────────────────────

export interface MotivationSignal {
  name:   string
  points: number
}

export interface StrategyResult {
  viable:   boolean
  score:    number
  reasons:  string[]
  warnings: string[]
}

export interface StrategyViabilitySnapshot {
  btl?:  StrategyResult
  brrr?: StrategyResult
  hmo?:  StrategyResult
  flip?: StrategyResult
}

/** Normalise keyFeatures regardless of whether they were stored as strings or {id, feature} objects */
function normalizeKeyFeatures(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item) => {
    if (typeof item === "string") return item
    if (item && typeof item === "object" && "feature" in item) return String((item as any).feature)
    return String(item)
  }).filter(Boolean)
}

// Helper to convert Prisma PropertyListing to client-safe type
export function toPropertyListingForClient(listing: any): PropertyListingForClient {
  const listedDate = listing.listedDate instanceof Date
    ? listing.listedDate.toISOString()
    : listing.listedDate || null

  // Recompute daysOnMarket dynamically from listedDate so it stays current
  const daysOnMarket = listedDate
    ? Math.max(0, Math.floor((Date.now() - new Date(listedDate).getTime()) / 86400000))
    : (listing.daysOnMarket ?? 0)

  return {
    ...listing,
    price: Number(listing.price),
    pricePerSqFt: listing.pricePerSqFt ? Number(listing.pricePerSqFt) : null,
    groundRent: listing.groundRent ? Number(listing.groundRent) : null,
    serviceCharge: listing.serviceCharge ? Number(listing.serviceCharge) : null,
    keyFeatures: normalizeKeyFeatures(listing.keyFeatures),
    scrapedAt: listing.scrapedAt instanceof Date ? listing.scrapedAt.toISOString() : listing.scrapedAt,
    lastChecked: listing.lastChecked instanceof Date ? listing.lastChecked.toISOString() : listing.lastChecked,
    listedDate,
    reviewedAt: listing.reviewedAt instanceof Date ? listing.reviewedAt.toISOString() : listing.reviewedAt || null,
    daysOnMarket,
    // ── Phase 1 Discover fields ─────────────────────────────────────────────
    motivationScore:   listing.motivationScore ?? 0,
    motivationSignals: Array.isArray(listing.motivationSignals) ? listing.motivationSignals : [],
    isWelsh:           listing.isWelsh ?? false,
    jurisdiction:      (listing.jurisdiction ?? "ENGLAND") as "WALES" | "ENGLAND",
    strategyViability: (listing.strategyViability as StrategyViabilitySnapshot) ?? {},
    trackerStage:      (listing.trackerStage ?? null) as "watchlist" | "viewing" | "offer" | "rejected" | null,
    ssasAnalysis:      listing.ssasAnalysis ?? null,
    annualRent:        listing.annualRent ?? null,
  }
}
