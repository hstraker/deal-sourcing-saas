// ============================================================================
// PROPERTY SCRAPER TYPES
// ============================================================================

// ---- Search Criteria ----

export interface ScraperCriteria {
  category: "RESIDENTIAL" | "COMMERCIAL" | "BOTH"
  locations: LocationCriteria[]
  minPrice?: number
  maxPrice?: number
  minBedrooms?: number
  maxBedrooms?: number
  propertyTypes?: string[]
  maxDaysOnMarket?: number
  includeSSTC?: boolean
  addedSince?: "24hours" | "3days" | "7days" | "14days"
  maxPages?: number
}

export interface LocationCriteria {
  outcode: string            // Rightmove location identifier
  displayName: string
  slug?: string              // Area slug for Zoopla/OTM (e.g., "birmingham")
}

// ---- Scraped Property Data (before DB insert) ----

export interface ScrapedProperty {
  sourceId: string
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  category: "RESIDENTIAL" | "COMMERCIAL"
  title: string
  description: string
  propertyType: string
  propertySubType?: string
  bedrooms: number
  bathrooms: number
  price: number
  priceHistory: PriceHistoryEntry[]
  address: ScrapedAddress
  squareFeet?: number
  squareMeters?: number
  pricePerSqFt?: number
  commercialDetails?: CommercialDetails
  bmvIndicators: BmvIndicators
  isAmbiguous: boolean
  ambiguityReasons: string[]
  images: string[]
  floorPlans: string[]
  agent: AgentInfo
  listingUrl: string
  listedDate?: Date
  daysOnMarket: number
  status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER"
  checksum: string

  // Additional listing details
  keyFeatures?: string[]           // Bullet-point feature list from the portal
  epcRating?: string               // A–G energy performance certificate rating
  tenure?: string                  // FREEHOLD | LEASEHOLD | SHARE_OF_FREEHOLD | COMMONHOLD
  isChainFree?: boolean
  isNewBuild?: boolean
  isRetirement?: boolean
  leaseYearsRemaining?: number
  groundRent?: number              // Annual ground rent £ (leasehold)
  serviceCharge?: number           // Annual service charge £
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

// ---- BMV Detection ----

export interface BmvIndicators {
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
  // Land Registry ownership intelligence (populated post-scrape)
  isCorporateOwned?: boolean
  isOverseasOwned?: boolean
  isPortfolioOwner?: boolean
  proprietorType?: string | null
  ownerCompanyName?: string | null
}

// ---- Scraper Job Progress ----

export interface ScraperProgress {
  jobId: string
  totalFound: number
  processed: number
  successful: number
  failed: number
  errors: ScraperError[]
  propertiesFound: string[]
}

export interface ScraperError {
  propertyId?: string
  url?: string
  message: string
  timestamp: string
}

// ---- Scraper Settings (typed mirror of DB model) ----

export interface ScraperSettingsData {
  enabled: boolean
  scheduleType: string
  rightmoveEnabled: boolean
  zooplaEnabled: boolean
  onthemarketEnabled: boolean
  primelocationEnabled: boolean
  autoAnalysisEnabled: boolean
  autoAnalysisThreshold?: number
  requireManualReview: boolean
  requestDelay: number
  maxConcurrent: number
  useProxy: boolean
  proxyUrl?: string
  // CLI/debug overrides (not persisted in DB)
  headful?: boolean
}
