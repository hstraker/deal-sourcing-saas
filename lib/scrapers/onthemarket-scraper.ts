import { Page } from "puppeteer"
import { BaseScraper } from "./base-scraper"
import { detectBmvIndicators, detectAmbiguity } from "./bmv-detector"
import { computeChecksum } from "./checksum"
import { extractFeaturesFromText } from "./extract-features"
import {
  ONTHEMARKET_BASE_URL,
  ONTHEMARKET_SALE_SEARCH,
  ONTHEMARKET_COMMERCIAL_SEARCH,
  ONTHEMARKET_SELECTORS,
  LOCATION_SLUGS,
  ADDED_SINCE_MAP,
} from "./constants"
import type {
  ScraperCriteria,
  ScrapedProperty,
  ScrapedAddress,
  AgentInfo,
  PriceHistoryEntry,
} from "./types"

const LOG_PREFIX = "[OnTheMarket]"

export class OnTheMarketScraper extends BaseScraper {
  get sourceName(): "ONTHEMARKET" {
    return "ONTHEMARKET"
  }

  // ---- URL Building ----

  buildSearchUrls(criteria: ScraperCriteria): string[] {
    const urls: string[] = []
    const categories: ("RESIDENTIAL" | "COMMERCIAL")[] =
      criteria.category === "BOTH"
        ? ["RESIDENTIAL", "COMMERCIAL"]
        : [criteria.category as "RESIDENTIAL" | "COMMERCIAL"]

    for (const location of criteria.locations) {
      const slug = location.slug || LOCATION_SLUGS[location.displayName]
      if (!slug) {
        console.warn(
          `${LOG_PREFIX} No slug found for "${location.displayName}", skipping`
        )
        continue
      }

      for (const category of categories) {
        const basePath =
          category === "COMMERCIAL"
            ? ONTHEMARKET_COMMERCIAL_SEARCH
            : ONTHEMARKET_SALE_SEARCH

        const params = new URLSearchParams()

        if (criteria.minPrice)
          params.set("min-price", String(criteria.minPrice))
        if (criteria.maxPrice)
          params.set("max-price", String(criteria.maxPrice))

        if (category === "RESIDENTIAL") {
          if (criteria.minBedrooms)
            params.set("min-bedrooms", String(criteria.minBedrooms))
          if (criteria.maxBedrooms)
            params.set("max-bedrooms", String(criteria.maxBedrooms))
        }

        if (criteria.addedSince) {
          const days = ADDED_SINCE_MAP[criteria.addedSince]
          if (days) params.set("added-since", days)
        }

        if (!criteria.includeSSTC) {
          params.set("exclude-sstc", "true")
        }

        const queryStr = params.toString()
        const url = `${ONTHEMARKET_BASE_URL}${basePath}${slug}/${queryStr ? `?${queryStr}` : ""}`
        urls.push(url)

        console.log(
          `${LOG_PREFIX} Search URL (${category}): ${location.displayName}`
        )
      }
    }

    return urls
  }

  // ---- Search Results Extraction ----

  async scrapeSearchResults(page: Page, _url: string): Promise<string[]> {
    const urls: string[] = []

    try {
      // Try extracting embedded JSON data first
      const otmData = await page.evaluate(() => {
        // OnTheMarket may embed data in __NEXT_DATA__ or a custom variable
        const nextScript = document.querySelector("#__NEXT_DATA__")
        if (nextScript?.textContent) {
          try {
            return { type: "next", data: JSON.parse(nextScript.textContent) }
          } catch {
            // Not valid JSON
          }
        }

        // Check for inline script data
        const scripts = Array.from(document.querySelectorAll("script"))
        for (const script of scripts) {
          const text = script.textContent || ""
          if (text.includes("window.__OTM__") || text.includes("window.__NEXT_DATA__")) {
            try {
              const match = text.match(
                /window\.__OTM__\s*=\s*({[\s\S]*?});/
              )
              if (match) {
                return { type: "otm", data: JSON.parse(match[1]) }
              }
            } catch {
              // Not valid JSON
            }
          }
        }

        return null
      })

      if (otmData?.type === "next" && otmData.data?.props?.pageProps) {
        const pageProps = otmData.data.props.pageProps
        const listings =
          pageProps.properties ||
          pageProps.listings ||
          pageProps.results ||
          []

        for (const listing of listings) {
          const id =
            listing.id || listing.propertyId || listing.listingId
          if (id) {
            urls.push(`${ONTHEMARKET_BASE_URL}/details/${id}/`)
          }
        }

        if (urls.length > 0) {
          console.log(
            `${LOG_PREFIX} Extracted ${urls.length} property URLs from embedded data`
          )
          return urls
        }
      }

      // Fallback: extract property links from DOM
      const propertyUrls = await page.evaluate((baseUrl) => {
        const links = Array.from(document.querySelectorAll("a"))
        const detailLinks: string[] = []

        for (const link of links) {
          const href = link.getAttribute("href")
          if (href && /\/details\/\d+/.test(href)) {
            const match = href.match(/\/details\/(\d+)/)
            if (match) {
              detailLinks.push(`${baseUrl}/details/${match[1]}/`)
            }
          }
        }

        return [...new Set(detailLinks)]
      }, ONTHEMARKET_BASE_URL)

      urls.push(...propertyUrls)
      console.log(
        `${LOG_PREFIX} Extracted ${propertyUrls.length} property URLs from DOM`
      )
    } catch (error: any) {
      console.error(
        `${LOG_PREFIX} Error extracting search results: ${error.message}`
      )
    }

    return urls
  }

  // ---- Override pagination for OTM page= parameter ----

  protected override async scrapeAllPages(
    page: Page,
    baseUrl: string,
    criteria?: ScraperCriteria
  ): Promise<string[]> {
    const allUrls: string[] = []
    const maxPages = criteria?.maxPages ?? 42

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      const separator = baseUrl.includes("?") ? "&" : "?"
      const paginatedUrl =
        pageNum === 1 ? baseUrl : `${baseUrl}${separator}page=${pageNum}`

      console.log(`${LOG_PREFIX} Scraping search page ${pageNum}: ${paginatedUrl}`)

      await page.goto(paginatedUrl, {
        waitUntil: "networkidle2",
        timeout: 45000,
      })
      await this.handleOtmCookieConsent(page)
      await this.delay(2000)

      const urls = await this.scrapeSearchResults(page, paginatedUrl)
      if (urls.length === 0) break

      allUrls.push(...urls)

      // Check for next page
      const hasNext = await page.$(ONTHEMARKET_SELECTORS.paginationNext)
      const hasNextAlt = await page.$(ONTHEMARKET_SELECTORS.paginationNextAlt)
      if (!hasNext && !hasNextAlt) break

      await this.delay(this.randomDelay())
    }

    return [...new Set(allUrls)]
  }

  // ---- Property Detail Extraction ----

  async scrapePropertyDetail(
    page: Page,
    url: string
  ): Promise<ScrapedProperty> {
    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 })
    await this.handleOtmCookieConsent(page)
    await this.delay(1500)

    // Strategy 1: Extract __NEXT_DATA__ or __OTM__ embedded data
    // OTM stores property data in initialReduxState.property (NOT pageProps which is always empty)
    const detailData = await page.evaluate(() => {
      // Extract ld+json datePosted regardless of which data path we use
      let ldJsonDatePosted: string | null = null
      document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
          const d = JSON.parse(script.textContent || "")
          if ((d["@type"] === "RealEstateListing" || d["@type"] === "Residence" || d.offers) && d.datePosted) {
            ldJsonDatePosted = d.datePosted
          }
        } catch {}
      })

      // OTM shows "Added on 15 Jan 2025" or "Reduced on 15/01/2025" in page body text
      // Use regex on full page text as OTM has no ISO date in redux state
      let addedOnText: string | null = null
      const bodyText = document.body?.textContent || ""
      const addedOnMatch = bodyText.match(
        /(?:Added|Reduced)\s+on\s+(\d{1,2}\s+\w{3,9}\s+\d{4}|\d{1,2}\/\d{2}\/\d{4})/i
      )
      if (addedOnMatch) addedOnText = addedOnMatch[1]

      const nextScript = document.querySelector("#__NEXT_DATA__")
      if (nextScript?.textContent) {
        try {
          const parsed = JSON.parse(nextScript.textContent)
          // Primary OTM path: initialReduxState.property (confirmed by debug — pageProps is always {})
          const reduxProp = parsed?.props?.initialReduxState?.property
          if (reduxProp && (reduxProp.priceRaw || reduxProp.price || reduxProp.id)) {
            return { source: "otm_redux", data: reduxProp, ldJsonDatePosted, addedOnText }
          }
          if (parsed?.props?.pageProps) return { source: "nextdata", data: parsed.props.pageProps, ldJsonDatePosted, addedOnText }
        } catch {}
      }

      // Try window.__OTM__
      try {
        const otm = (window as any).__OTM__
        if (otm?.property) return { source: "otm_property", data: otm.property, ldJsonDatePosted, addedOnText }
        if (otm) return { source: "otm", data: otm, ldJsonDatePosted, addedOnText }
      } catch {}

      return null
    })

    if (detailData) {
      // OTM Redux state: primary path (initialReduxState.property)
      if (detailData.source === "otm_redux") {
        console.log(`${LOG_PREFIX} Using initialReduxState.property for ${url}`)
        return this.parseOtmReduxProperty(
          detailData.data,
          url,
          detailData.ldJsonDatePosted ?? undefined,
          detailData.addedOnText ?? undefined
        )
      }

      const d = detailData.data
      // Try multiple paths for the property object
      const propertyData =
        d.property ||
        d.listing ||
        d.details ||
        d.propertyDetails ||
        d.data?.property ||
        d.data?.listing ||
        d
      if (propertyData && (propertyData.id || propertyData.propertyId || propertyData.price)) {
        console.log(`${LOG_PREFIX} Using embedded data (${detailData.source}) for ${url}`)
        return this.parseEmbeddedData(propertyData, url)
      }

      // Deep search for listing data
      const deepResult = this.findListingDataDeep(d)
      if (deepResult) {
        console.log(`${LOG_PREFIX} Using embedded data (deep search) for ${url}`)
        return this.parseEmbeddedData(deepResult, url)
      }

      if (detailData.source === "nextdata") {
        console.warn(
          `${LOG_PREFIX} __NEXT_DATA__ found but no listing data. Keys: ${Object.keys(d).join(", ")}`
        )
      }
    }

    // Strategy 2: Enhanced DOM scraping with og: meta + ld+json
    console.log(
      `${LOG_PREFIX} Embedded data not found, using DOM fallback for ${url}`
    )
    return this.parseDomFallback(page, url)
  }

  /**
   * Recursively search for an object that looks like listing data.
   */
  private findListingDataDeep(obj: any, depth = 0): any | null {
    if (!obj || typeof obj !== "object" || depth > 4) return null
    // Check for price in multiple possible fields (OTM uses different structures)
    const hasPrice =
      obj.price ||
      obj.displayPrice ||
      obj.pricing ||
      obj.askingPrice ||
      obj.currentPrice ||
      obj.listPrice
    const hasIdentifier =
      obj.address ||
      obj.displayAddress ||
      obj.title ||
      obj.heading ||
      obj.propertyId ||
      obj.id
    if (hasPrice && hasIdentifier) {
      return obj
    }
    for (const key of Object.keys(obj)) {
      if (key.startsWith("_") || key === "buildId") continue
      const result = this.findListingDataDeep(obj[key], depth + 1)
      if (result) return result
    }
    return null
  }

  // ---- Embedded Data Parser ----

  private parseEmbeddedData(data: any, url: string): ScrapedProperty {
    const sourceId = String(
      data.id || data.propertyId || this.extractIdFromUrl(url)
    )

    // Prefer numeric fields first; fall back to display strings
    const price = this.parsePrice(
      data.price?.amount ??        // numeric amount
      data.price?.value ??         // numeric value
      data.pricing?.amount ??      // alternative pricing object
      data.pricing?.value ??       // pricing value
      data.askingPrice ??          // OTM-specific field
      data.currentPrice ??         // OTM-specific field
      data.listPrice ??            // OTM-specific field
      data.displayPrice ??         // OTM sometimes uses top-level displayPrice
      data.price ??                // direct field (string or number)
      "0"
    )

    // Price history
    const priceHistory: PriceHistoryEntry[] = []
    if (data.priceHistory && Array.isArray(data.priceHistory)) {
      for (const entry of data.priceHistory) {
        priceHistory.push({
          date: entry.date || new Date().toISOString(),
          price: this.parsePrice(entry.price || entry.amount || 0),
        })
      }
    }

    // Address
    const addr = data.address || {}
    const address: ScrapedAddress = {
      displayAddress:
        addr.displayAddress || addr.display || data.displayAddress || "",
      postcode: addr.postcode,
      street: addr.street || addr.line1,
      town: addr.town || addr.city || addr.locality,
      county: addr.county || addr.region,
      latitude: data.location?.lat || data.latitude,
      longitude: data.location?.lng || data.longitude,
    }

    // Sizing
    let squareFeet: number | undefined
    let squareMeters: number | undefined
    const size = data.size || data.floorArea
    if (size) {
      if (size.sqft || size.squareFeet) {
        squareFeet = size.sqft || size.squareFeet
        squareMeters = Math.round((squareFeet || 0) * 0.0929)
      } else if (size.sqm || size.squareMeters) {
        squareMeters = size.sqm || size.squareMeters
        squareFeet = Math.round((squareMeters || 0) * 10.764)
      }
    }

    // Images
    const images: string[] = (data.images || data.photos || [])
      .map((img: any) => img.url || img.src || img.original || img)
      .filter((x: any) => typeof x === "string")

    // Floor plans
    const floorPlans: string[] = (data.floorPlans || data.floorplan || [])
      .map((fp: any) => fp.url || fp.src || fp)
      .filter((x: any) => typeof x === "string")

    // Agent
    const agentData = data.agent || data.branch || data.advertiser || {}
    const agent: AgentInfo = {
      name:
        agentData.name ||
        agentData.companyName ||
        agentData.displayName,
      branch: agentData.branchName || agentData.address,
      phone: agentData.phone || agentData.telephone,
      logoUrl: agentData.logo || agentData.logoUrl,
    }

    // Property type
    const title = data.title || data.heading || address.displayAddress || ""
    const description =
      data.description ||
      data.summary ||
      data.fullDescription ||
      ""
    const propertyType = this.extractPropertyType(
      data.propertyType || data.type || title
    )

    const category = this.isCommercial(propertyType, description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    // Listed date — try multiple fields; parse UK date format if needed
    const rawOtmDate = data.listedOn || data.firstListed || data.publishedDate || data.addedDate || null
    const parsedOtmDate = rawOtmDate
      ? (() => {
          // UK date: "25/01/2025"
          const ddmmyyyy = String(rawOtmDate).match(/(\d{2})\/(\d{2})\/(\d{4})/)
          if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
          return String(rawOtmDate) // might already be ISO
        })()
      : null
    const listedDate = parsedOtmDate ? new Date(parsedOtmDate) : undefined
    const listedDateValid = listedDate && !isNaN(listedDate.getTime())
    const daysOnMarket = listedDateValid
      ? Math.max(0, Math.floor((Date.now() - listedDate!.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    // Status
    let status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER" = "FOR_SALE"
    const statusStr = (data.status || data.listing_status || "").toLowerCase()
    if (statusStr.includes("sstc") || statusStr.includes("sold"))
      status = "SOLD_STC"
    else if (statusStr.includes("under offer")) status = "UNDER_OFFER"

    const pricePerSqFt =
      squareFeet && squareFeet > 0
        ? Math.round((price / squareFeet) * 100) / 100
        : undefined

    const bmvIndicators = detectBmvIndicators({
      title,
      description,
      priceHistory,
      price,
      daysOnMarket,
    })

    const bedrooms = data.bedrooms || data.numBedrooms || data.bedroom_count || data.features?.bedrooms || 0
    const bathrooms = data.bathrooms || data.numBathrooms || data.bathroom_count || data.features?.bathrooms || 0

    // Log data quality
    console.log(
      `${LOG_PREFIX} Embedded data extracted: id=${sourceId}, price=${price}, beds=${bedrooms}, baths=${bathrooms}, title="${title?.substring(0, 60)}"`
    )

    const property: ScrapedProperty = {
      sourceId,
      source: "ONTHEMARKET",
      category,
      title,
      description,
      propertyType,
      bedrooms,
      bathrooms,
      price,
      priceHistory,
      address,
      squareFeet,
      squareMeters,
      pricePerSqFt,
      bmvIndicators,
      isAmbiguous: false,
      ambiguityReasons: [],
      images,
      floorPlans,
      agent,
      listingUrl: url,
      listedDate,
      daysOnMarket,
      status,
      checksum: computeChecksum(title, price, description),
    }

    if (category === "COMMERCIAL") {
      property.commercialDetails = {
        leaseType: data.tenure,
        rateableValue: data.rateableValue,
        currentRent: data.rent
          ? this.parsePrice(String(data.rent))
          : undefined,
      }
    }

    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- OTM initialReduxState.property Parser ----
  // This is the primary data source for OTM detail pages (pageProps is always empty).
  // Data structure confirmed via debug: priceRaw, displayAddress, bedrooms, bathrooms,
  // propertyTitle, summary, humanisedPropertyType, daysSinceAddedReduced, images[], id

  private parseOtmReduxProperty(data: any, url: string, ldJsonDatePosted?: string, addedOnText?: string): ScrapedProperty {
    const sourceId = String(data.id || this.extractIdFromUrl(url))

    // Price: priceRaw is clean numeric (e.g. 257500), price is "£257,500"
    const price = this.parsePrice(
      data.priceRaw ??       // CONFIRMED clean numeric
      data.price ??          // "£257,500" string fallback
      "0"
    )

    // Title
    const title = data.propertyTitle || data.propertySerpTitle || data.displayAddress || ""

    // Description: data.description is a plain string (confirmed)
    const description = typeof data.description === "string"
      ? data.description
      : data.summary || ""

    // Address
    const address: ScrapedAddress = {
      displayAddress: data.displayAddress || "",
      postcode: data.postcode || undefined,
      town: data.addressLocality || undefined,
      latitude: data.location?.lat,
      longitude: data.location?.lon,
    }

    // Images: each image has largeUrl (full-size) and url (thumbnail)
    const images: string[] = (data.images || [])
      .map((img: any) => img.largeUrl || img.url)
      .filter((x: any): x is string => typeof x === "string")

    // Floor plans
    const floorPlans: string[] = (data.floorplans || [])
      .map((fp: any) => fp.largeUrl || fp.url)
      .filter((x: any): x is string => typeof x === "string")

    // Agent
    const agentData = data.agent || {}
    const agent: AgentInfo = {
      name: agentData.name || agentData.companyName,
      phone: agentData.telephone || agentData.phone,
      logoUrl: agentData.logoUrl || agentData.logo,
    }

    // Property type
    const propertyType = this.extractPropertyType(
      data.humanisedPropertyType || data.propSubId || title
    )
    const category = this.isCommercial(propertyType, description) ? "COMMERCIAL" : "RESIDENTIAL"

    // Sizing
    let squareFeet: number | undefined
    let squareMeters: number | undefined
    if (data.minimumAreaSqFt) squareFeet = data.minimumAreaSqFt
    if (data.minimumAreaSqM) squareMeters = data.minimumAreaSqM
    if (squareFeet && !squareMeters) squareMeters = Math.round(squareFeet * 0.0929)
    if (squareMeters && !squareFeet) squareFeet = Math.round(squareMeters * 10.764)

    // Days on market: prefer actual ISO date fields, then ld+json datePosted,
    // then DOM-scraped "Added on DD MMM YYYY" text, then display string (capped at 14)
    const parseOtmDateStr = (s: string): Date | null => {
      // DD/MM/YYYY → YYYY-MM-DD
      const dmy = s.match(/^(\d{1,2})\/(\d{2})\/(\d{4})$/)
      if (dmy) return new Date(`${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`)
      // "15 Jan 2025" → let JS parse it
      const d = new Date(s)
      return isNaN(d.getTime()) ? null : d
    }

    const rawOtmDate =
      data.listedOn ||
      data.addedOn ||
      data.publishedDate ||
      data.addedDate ||
      data.firstListed ||
      data.dateAdded ||
      ldJsonDatePosted ||
      null

    let daysOnMarket = 0
    let listedDate: Date | undefined

    if (rawOtmDate) {
      const d = new Date(rawOtmDate)
      if (!isNaN(d.getTime())) {
        listedDate = d
        daysOnMarket = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)))
      }
    }

    // Try DOM-scraped "Added on DD MMM YYYY" text (most reliable OTM source)
    if (!listedDate && addedOnText) {
      const d = parseOtmDateStr(addedOnText)
      if (d) {
        listedDate = d
        daysOnMarket = Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)))
      }
    }

    // Last resort: daysSinceAddedReduced display string e.g. "Added > 14 days"
    // OTM caps at "> 14 days" for older listings — store as negative to signal "at least X days"
    // so the UI renders "14+" rather than an exact "14".
    //
    // IMPORTANT: "Reduced < X days" / "Reduced today" etc. refer to PRICE REDUCTION events,
    // NOT listing date. We cannot determine listing age from these — leave daysOnMarket = 0.
    // "Added < X days" means an unknown count between 2 and X−1 days; we store 0 (unknown)
    // rather than X to avoid displaying a misleading exact count.
    if (!listedDate) {
      const daysSinceStr = (data.daysSinceAddedReduced || "") as string
      const lower = daysSinceStr.toLowerCase()
      if (daysSinceStr && lower.startsWith("added")) {
        if (lower.includes("today")) {
          // We know it was listed today — record the actual date so future re-scrapes track dynamically
          listedDate = new Date()
          listedDate.setHours(0, 0, 0, 0)
          daysOnMarket = 0
        } else if (lower.includes("yesterday")) {
          // We know it was listed yesterday — record the actual date for dynamic tracking
          const yesterday = new Date()
          yesterday.setDate(yesterday.getDate() - 1)
          yesterday.setHours(0, 0, 0, 0)
          listedDate = yesterday
          daysOnMarket = 1
        } else {
          const greaterThan = daysSinceStr.match(/>\s*(\d+)/)
          if (greaterThan) {
            // "Added > 14 days" → -14 signals minimum (at least 14 days)
            daysOnMarket = -parseInt(greaterThan[1])
          }
          // "Added < 7 days" / "Added < 14 days" → upper bound only, exact unknown → leave 0
        }
      }
      // "Reduced ..." → price reduction event, not listing date → daysOnMarket stays 0
    }

    // Price history
    const priceHistory: PriceHistoryEntry[] = []

    // Key features: OTM stores them as data.features array (strings) or data.bulletPoints
    const keyFeaturesRaw: string[] = data.features || data.bulletPoints || data.keyFeatures || []
    const features = extractFeaturesFromText(description, keyFeaturesRaw)

    // Tenure: OTM sometimes exposes data.tenure as a string
    const tenureRaw = data.tenure ? String(data.tenure).toUpperCase().replace(/\s+/g, "_") : features.tenure

    // EPC: OTM sometimes provides data.epcRating or data.energyRating
    const epcRating = data.epcRating || data.energyRating || features.epcRating

    // BMV
    const bmvIndicators = detectBmvIndicators({ title, description, priceHistory, price, daysOnMarket })

    console.log(
      `${LOG_PREFIX} Redux extracted: id=${sourceId}, price=${price}, beds=${data.bedrooms}, baths=${data.bathrooms}, daysOnMarket=${daysOnMarket}, title="${title?.substring(0, 60)}"`
    )

    const property: ScrapedProperty = {
      sourceId,
      source: "ONTHEMARKET",
      category,
      title,
      description,
      propertyType,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
      price,
      priceHistory,
      address,
      squareFeet,
      squareMeters,
      pricePerSqFt: squareFeet && squareFeet > 0 ? Math.round((price / squareFeet) * 100) / 100 : undefined,
      bmvIndicators,
      isAmbiguous: false,
      ambiguityReasons: [],
      images,
      floorPlans,
      agent,
      listingUrl: url,
      listedDate,
      daysOnMarket,
      status: "FOR_SALE",
      checksum: computeChecksum(title, price, description),
      keyFeatures: keyFeaturesRaw.length > 0 ? keyFeaturesRaw : features.keyFeatures,
      epcRating,
      tenure: tenureRaw,
      isChainFree: features.isChainFree,
      isNewBuild: features.isNewBuild,
      isRetirement: features.isRetirement,
      leaseYearsRemaining: features.leaseYearsRemaining,
      groundRent: features.groundRent,
      serviceCharge: features.serviceCharge,
    }

    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- DOM Fallback Parser (enhanced with og: meta + ld+json) ----

  private async parseDomFallback(
    page: Page,
    url: string
  ): Promise<ScrapedProperty> {
    const sourceId = this.extractIdFromUrl(url)

    const extracted = await page.evaluate(() => {
      const getMeta = (prop: string) =>
        document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") ||
        document.querySelector(`meta[name="${prop}"]`)?.getAttribute("content") ||
        ""

      const title =
        document.querySelector("h1.title")?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        document.querySelector('[data-testid="listing-title"]')?.textContent?.trim() ||
        getMeta("og:title") ||
        ""

      const addressText =
        document.querySelector('[data-testid="address"]')?.textContent?.trim() ||
        document.querySelector(".address")?.textContent?.trim() ||
        title

      const priceText =
        document.querySelector(".price")?.textContent?.trim() ||
        document.querySelector('[data-testid="price"]')?.textContent?.trim() ||
        document.querySelector("span.price-value")?.textContent?.trim() ||
        document.querySelector('[class*="price"]')?.textContent?.trim() ||
        document.querySelector('[data-testid*="price"]')?.textContent?.trim() ||
        document.querySelector(".listing-price")?.textContent?.trim() ||
        document.querySelector(".guide-price")?.textContent?.trim() ||
        getMeta("og:price:amount") ||
        getMeta("product:price:amount") ||
        // Find any element containing a £ price — be lenient with format
        (() => {
          const els = Array.from(document.querySelectorAll(
            'h1, h2, h3, [class*="price"], [data-testid*="price"], span, p'
          ))
          for (const el of els) {
            // Skip if element has lots of children (container element)
            if (el.children.length > 3) continue
            const text = (el.textContent || "").trim()
            const match = text.match(/£([\d,]+)/)
            if (match && text.length < 40) return `£${match[1]}`
          }
          return ""
        })() ||
        ""

      const description =
        document.querySelector(".description")?.textContent?.trim() ||
        document.querySelector('[data-testid="description"]')?.textContent?.trim() ||
        document.querySelector(".property-description")?.textContent?.trim() ||
        getMeta("og:description") ||
        getMeta("description") ||
        ""

      const agentName =
        document.querySelector(".agent-name")?.textContent?.trim() ||
        document.querySelector('[data-testid="agent-name"]')?.textContent?.trim() ||
        ""
      const agentPhone =
        document.querySelector(".agent-phone")?.textContent?.trim() ||
        document.querySelector('[data-testid="agent-phone"]')?.textContent?.trim() ||
        ""

      // Images from og: and page
      const ogImage = getMeta("og:image")
      const images: string[] = []
      if (ogImage) images.push(ogImage)

      // Try ld+json
      let ldJson: any = null
      document.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
        try {
          const data = JSON.parse(script.textContent || "")
          if (data["@type"] === "Product" || data["@type"] === "RealEstateListing" ||
              data["@type"] === "Residence" || data.offers) {
            ldJson = data
          }
        } catch {}
      })

      // Postcode extraction — prioritise address elements before full page to
      // avoid matching the site's own office postcode in the footer.
      const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/i

      const addressEl =
        document.querySelector('[data-testid="address"]') ||
        document.querySelector('[data-testid="listing-address"]') ||
        document.querySelector('[itemprop="address"]') ||
        document.querySelector("h1")
      const postcodeInAddressEl = addressEl?.textContent?.match(UK_POSTCODE_RE)

      const postcodeInOg =
        getMeta("og:title").match(UK_POSTCODE_RE) ||
        getMeta("og:description").match(UK_POSTCODE_RE)

      const ldAddress = ldJson?.address?.postalCode || ""
      const postcodeInLd = ldAddress.match(UK_POSTCODE_RE)

      const fullPageText = document.body?.textContent || ""
      const postcodeInBody = fullPageText.match(UK_POSTCODE_RE)

      const postcodeMatch =
        postcodeInAddressEl || postcodeInOg || postcodeInLd || postcodeInBody

      // Try to find bedrooms/bathrooms from icons or dedicated elements
      const bedsText =
        document.querySelector('[data-testid="beds"]')?.textContent?.trim() ||
        document.querySelector(".beds")?.textContent?.trim() ||
        ""
      const bathsText =
        document.querySelector('[data-testid="baths"]')?.textContent?.trim() ||
        document.querySelector(".baths")?.textContent?.trim() ||
        ""

      return {
        title,
        priceText,
        description,
        agentName,
        agentPhone,
        images,
        addressText,
        postcode: postcodeMatch ? postcodeMatch[1].toUpperCase().replace(/\s+/g, " ").trim() : null,
        bedsText,
        bathsText,
        ldJson,
      }
    })

    // Parse price from ld+json first, then DOM
    let price = 0
    if (extracted.ldJson?.offers?.price) {
      price = this.parsePrice(extracted.ldJson.offers.price)
    }
    if (!price) {
      price = this.parsePrice(extracted.priceText)
    }

    // Parse bedrooms/bathrooms from multiple sources
    const titleAndDesc = `${extracted.title} ${extracted.description} ${extracted.bedsText} ${extracted.bathsText}`
    const bedroomMatch = extracted.bedsText.match(/(\d+)/) || titleAndDesc.match(/(\d+)\s*bed/i)
    const bathroomMatch = extracted.bathsText.match(/(\d+)/) || titleAndDesc.match(/(\d+)\s*bath/i)

    const propertyType = this.extractPropertyType(extracted.title)
    const category = this.isCommercial(propertyType, extracted.description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    // Log data quality
    console.log(
      `${LOG_PREFIX} DOM fallback extracted for ${sourceId}: price=${price}, beds=${bedroomMatch?.[1] ?? '?'}, baths=${bathroomMatch?.[1] ?? '?'}, title="${extracted.title?.substring(0, 60)}"`
    )

    const bmvIndicators = detectBmvIndicators({
      title: extracted.title,
      description: extracted.description,
      priceHistory: [],
      price,
      daysOnMarket: 0,
    })

    const property: ScrapedProperty = {
      sourceId,
      source: "ONTHEMARKET",
      category,
      title: extracted.title,
      description: extracted.description,
      propertyType,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : 0,
      bathrooms: bathroomMatch ? parseInt(bathroomMatch[1]) : 0,
      price,
      priceHistory: [],
      address: {
        displayAddress: extracted.addressText,
        postcode: extracted.postcode || undefined,
      },
      images: extracted.images.length > 0 ? extracted.images : [],
      floorPlans: [],
      agent: {
        name: extracted.agentName || undefined,
        phone: extracted.agentPhone || undefined,
      },
      bmvIndicators,
      isAmbiguous: false,
      ambiguityReasons: [],
      listingUrl: url,
      daysOnMarket: 0,
      status: "FOR_SALE",
      checksum: computeChecksum(
        extracted.title,
        price,
        extracted.description
      ),
    }

    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- Cookie consent (OTM-specific) ----

  private async handleOtmCookieConsent(page: Page): Promise<void> {
    try {
      // Try text-based button finding first (handles CMP variations)
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim().toLowerCase()
          if (
            text === "accept all" ||
            text === "accept all cookies" ||
            text === "accept cookies" ||
            text === "agree"
          ) {
            btn.click()
            return true
          }
        }
        return false
      })

      if (clicked) {
        console.log(`${LOG_PREFIX} Accepted cookie consent`)
        await this.delay(1000)
        return
      }

      // Fallback: standard selectors
      const btn = await page.$(ONTHEMARKET_SELECTORS.cookieAccept)
      if (btn) {
        await btn.click()
        await this.delay(1000)
        return
      }
      const btnAlt = await page.$(ONTHEMARKET_SELECTORS.cookieAcceptAlt)
      if (btnAlt) {
        await btnAlt.click()
        await this.delay(1000)
      }
    } catch {
      // Not present or already dismissed
    }
  }

  // ---- Utility methods ----

  private extractIdFromUrl(url: string): string {
    const match = url.match(/\/details\/(\d+)/)
    return match ? match[1] : `otm-${Date.now()}`
  }

  private parsePrice(priceStr: string | number): number {
    if (typeof priceStr === "number") return priceStr
    if (!priceStr) return 0
    const cleaned = String(priceStr)
      .replace(/[£$€,\s]/g, "")
      .replace(/pcm|pa|pw/gi, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  private extractPropertyType(input: string): string {
    const lower = (input || "").toLowerCase()
    const types = [
      "detached house",
      "semi-detached house",
      "terraced house",
      "end of terrace",
      "town house",
      "cottage",
      "bungalow",
      "flat",
      "apartment",
      "maisonette",
      "studio",
      "penthouse",
      "house",
      "office",
      "retail",
      "warehouse",
      "industrial",
      "land",
      "plot",
      "farm",
    ]

    for (const type of types) {
      if (lower.includes(type)) return type
    }

    return "property"
  }

  private isCommercial(propertyType: string, description: string): boolean {
    const commercialTypes = [
      "office",
      "retail",
      "warehouse",
      "industrial",
      "shop",
      "commercial",
    ]
    const lower = propertyType.toLowerCase()
    if (commercialTypes.some((t) => lower.includes(t))) return true

    const descLower = description.toLowerCase()
    return (
      descLower.includes("commercial property") ||
      descLower.includes("business rates") ||
      descLower.includes("rateable value")
    )
  }
}
