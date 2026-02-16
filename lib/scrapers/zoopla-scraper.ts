import { Page } from "puppeteer"
import { BaseScraper } from "./base-scraper"
import { detectBmvIndicators, detectAmbiguity } from "./bmv-detector"
import { computeChecksum } from "./checksum"
import { extractFeaturesFromText } from "./extract-features"
import {
  ZOOPLA_BASE_URL,
  ZOOPLA_SALE_SEARCH,
  ZOOPLA_COMMERCIAL_SEARCH,
  ZOOPLA_SELECTORS,
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

const LOG_PREFIX = "[Zoopla]"

export class ZooplaScraper extends BaseScraper {
  get sourceName(): "ZOOPLA" {
    return "ZOOPLA"
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
            ? ZOOPLA_COMMERCIAL_SEARCH
            : ZOOPLA_SALE_SEARCH

        const params = new URLSearchParams()
        params.set("page_size", "25")
        params.set("pn", "1")

        if (criteria.minPrice) params.set("price_min", String(criteria.minPrice))
        if (criteria.maxPrice) params.set("price_max", String(criteria.maxPrice))

        if (category === "RESIDENTIAL") {
          if (criteria.minBedrooms)
            params.set("beds_min", String(criteria.minBedrooms))
          if (criteria.maxBedrooms)
            params.set("beds_max", String(criteria.maxBedrooms))
        }

        if (criteria.addedSince) {
          const days = ADDED_SINCE_MAP[criteria.addedSince]
          if (days) params.set("added", days)
        }

        if (!criteria.includeSSTC) {
          params.set("include_sstc", "false")
        }

        const url = `${ZOOPLA_BASE_URL}${basePath}${slug}/?${params.toString()}`
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
      // Try extracting from __NEXT_DATA__ first (structured data)
      const nextData = await page.evaluate(() => {
        const script = document.querySelector("#__NEXT_DATA__")
        if (script?.textContent) {
          try {
            return JSON.parse(script.textContent)
          } catch {
            return null
          }
        }
        return null
      })

      if (nextData?.props?.pageProps?.regularListingsFormatted) {
        const listings = nextData.props.pageProps.regularListingsFormatted
        for (const listing of listings) {
          if (listing.listingId) {
            urls.push(
              `${ZOOPLA_BASE_URL}/for-sale/details/${listing.listingId}/`
            )
          }
        }
        console.log(
          `${LOG_PREFIX} Extracted ${urls.length} property URLs from __NEXT_DATA__`
        )
        return urls
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
              detailLinks.push(`${baseUrl}/for-sale/details/${match[1]}/`)
            }
          }
        }

        return [...new Set(detailLinks)]
      }, ZOOPLA_BASE_URL)

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

  // ---- Override pagination to use Zoopla's pn= parameter ----

  protected override async scrapeAllPages(
    page: Page,
    baseUrl: string,
    criteria?: ScraperCriteria
  ): Promise<string[]> {
    const allUrls: string[] = []
    const maxPages = criteria?.maxPages ?? 42

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      // Replace pn parameter
      const paginatedUrl = baseUrl.replace(/pn=\d+/, `pn=${pageNum}`)

      console.log(
        `${LOG_PREFIX} Scraping search page ${pageNum}: ${paginatedUrl}`
      )

      await page.goto(paginatedUrl, {
        waitUntil: "networkidle2",
        timeout: 45000,
      })
      await this.handleZooplaCookieConsent(page)
      await this.delay(2000)

      const urls = await this.scrapeSearchResults(page, paginatedUrl)
      if (urls.length === 0) break

      allUrls.push(...urls)

      // Check for next page
      const hasNext = await page.$(ZOOPLA_SELECTORS.paginationNext)
      const hasNextAlt = await page.$(ZOOPLA_SELECTORS.paginationNextAlt)
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
    await this.handleZooplaCookieConsent(page)
    await this.delay(1500)

    // Strategy 1: Extract __NEXT_DATA__ from detail page (try multiple paths)
    const nextData = await page.evaluate(() => {
      const script = document.querySelector("#__NEXT_DATA__")
      if (script?.textContent) {
        try {
          return JSON.parse(script.textContent)
        } catch {
          return null
        }
      }
      return null
    })

    if (nextData?.props?.pageProps) {
      const pp = nextData.props.pageProps
      // Try all known paths for Zoopla listing data
      const listingData =
        pp.listingDetails ||
        pp.data?.listing ||
        pp.listing ||
        pp.listingDetail ||
        pp.data?.listingDetails ||
        pp.propertyDetails ||
        pp.data?.propertyDetails
      if (listingData) {
        console.log(`${LOG_PREFIX} Using __NEXT_DATA__ for ${url}`)
        return this.parseNextData(listingData, url)
      }

      // If pageProps exists but no known path, try to find listing data dynamically
      const deepListing = this.findListingDataDeep(pp)
      if (deepListing) {
        console.log(`${LOG_PREFIX} Using __NEXT_DATA__ (deep search) for ${url}`)
        return this.parseNextData(deepListing, url)
      }

      console.warn(
        `${LOG_PREFIX} __NEXT_DATA__ found but no listing data. Keys: ${Object.keys(pp).join(", ")}`
      )
    }

    // Strategy 2: Enhanced DOM scraping with og: meta tags
    console.log(
      `${LOG_PREFIX} __NEXT_DATA__ not found or empty, using DOM fallback for ${url}`
    )
    return this.parseDomFallback(page, url)
  }

  /**
   * Recursively search pageProps for an object that looks like listing data.
   * Must have at least price/address to be considered a listing.
   */
  private findListingDataDeep(obj: any, depth = 0): any | null {
    if (!obj || typeof obj !== "object" || depth > 4) return null
    // Check if this object looks like listing data
    if (
      (obj.price || obj.pricing) &&
      (obj.address || obj.displayAddress || obj.title)
    ) {
      return obj
    }
    for (const key of Object.keys(obj)) {
      if (key.startsWith("_") || key === "buildId") continue
      const result = this.findListingDataDeep(obj[key], depth + 1)
      if (result) return result
    }
    return null
  }

  // ---- __NEXT_DATA__ Parser ----

  private parseNextData(data: any, url: string): ScrapedProperty {
    const sourceId = String(
      data.listingId || data.id || data.listing_id || this.extractIdFromUrl(url)
    )

    // Prefer numeric fields first to avoid non-numeric label strings (e.g. "Guide price £350,000")
    const price = this.parsePrice(
      data.pricing?.amount ??             // numeric amount
      data.price?.amount ??               // numeric amount
      data.price?.value ??                // numeric value
      data.analyticsTaxonomy?.priceActual ??  // contact-variant URL: always clean numeric
      data.analyticsTaxonomy?.price ??    // analytics taxonomy price
      data.pricing?.label ??             // display string like "£350,000"
      data.price?.displayPrice ??        // display string
      data.price ??                      // direct price (string or number)
      "0"
    )

    // Price history
    const priceHistory: PriceHistoryEntry[] = []
    if (data.pricing?.previousPrice || data.priceHistory) {
      const history = data.priceHistory || []
      for (const entry of history) {
        priceHistory.push({
          date: entry.date || new Date().toISOString(),
          price: this.parsePrice(String(entry.price || entry.amount || 0)),
        })
      }
    }

    // Address — try every field Zoopla embeds before falling back to outcode-only.
    // Zoopla frequently withholds the incode in address.postcode / address.incode for
    // privacy, but adTargeting and analyticsTaxonomy usually carry the full postcode.
    const rawPostcode =
      data.address?.postcode ||
      data.adTargeting?.postcode ||
      data.location?.postcode ||
      data.analyticsTaxonomy?.postcode ||
      // adTargeting split outcode + incode
      (data.adTargeting?.outcode && data.adTargeting?.incode
        ? `${data.adTargeting.outcode} ${data.adTargeting.incode}`.trim()
        : undefined) ||
      // analyticsTaxonomy split
      (data.analyticsTaxonomy?.outcode && data.analyticsTaxonomy?.incode
        ? `${data.analyticsTaxonomy.outcode} ${data.analyticsTaxonomy.incode}`.trim()
        : undefined) ||
      // address split (incode may be missing for privacy — only use full pair)
      (data.address?.outcode && data.address?.incode
        ? `${data.address.outcode} ${data.address.incode}`.trim()
        : undefined) ||
      // Last resort: outcode only (better than nothing for PropertyData radius queries)
      data.address?.outcode ||
      data.adTargeting?.outcode ||
      data.analyticsTaxonomy?.outcode

    // Normalise: uppercase and ensure single space between outcode and incode
    const postcode = rawPostcode
      ? rawPostcode.toUpperCase().replace(/\s+/g, " ").trim()
      : undefined

    const address: ScrapedAddress = {
      displayAddress:
        data.address?.displayAddress ||
        data.adTargeting?.displayAddress ||
        "",
      postcode,
      town: data.address?.town || data.address?.townOrCity,
      county: data.address?.county,
      latitude: data.location?.coordinates?.latitude || data.location?.lat,
      longitude: data.location?.coordinates?.longitude || data.location?.lng,
    }

    // Sizing
    let squareFeet: number | undefined
    let squareMeters: number | undefined
    if (data.floorArea?.value) {
      if (data.floorArea.unit === "SQFT" || data.floorArea.unit === "sqft") {
        squareFeet = data.floorArea.value
        squareMeters = Math.round(data.floorArea.value * 0.0929)
      } else {
        squareMeters = data.floorArea.value
        squareFeet = Math.round(data.floorArea.value * 10.764)
      }
    }

    // Images
    const images: string[] = (data.images || data.propertyImages || [])
      .map(
        (img: any) =>
          img.src || img.url || img.filename || img.original || img.caption?.url
      )
      .filter(Boolean)

    // Floor plans
    const floorPlans: string[] = (data.floorPlan || data.floorPlans || [])
      .map((fp: any) => fp.src || fp.url || fp.image)
      .filter(Boolean)

    // Agent
    const agentData = data.branch || data.agent || data.customer || {}
    const agent: AgentInfo = {
      name: agentData.name || agentData.branchName || agentData.displayName,
      branch: agentData.branchDetailsUri || agentData.address,
      phone: agentData.phone || agentData.phoneNumber,
      logoUrl: agentData.logoUrl || agentData.logo,
    }

    // Property type
    const title =
      data.title || data.summaryDescription || data.address?.displayAddress || ""
    const description =
      data.detailedDescription || data.description || data.features?.join(". ") || ""
    const propertyType = this.extractPropertyType(
      data.propertyType || data.category || title
    )

    const category = this.isCommercial(propertyType, description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    // Listed date — try multiple field paths including analyticsTaxonomy
    const rawListedDate =
      data.publishedOn ||
      data.firstPublishedDate ||
      data.listingDate ||
      data.dateAdded ||
      data.analyticsTaxonomy?.listingDate ||
      data.analyticsTaxonomy?.dateAdded ||
      data.detail?.publishedOn ||
      data.listing?.publishedOn ||
      null
    const listedDate = rawListedDate ? new Date(rawListedDate) : undefined
    const listedDateValid = listedDate && !isNaN(listedDate.getTime())
    const daysOnMarket = listedDateValid
      ? Math.max(0, Math.floor((Date.now() - listedDate!.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    // Status
    let status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER" = "FOR_SALE"
    const statusStr = (data.listing_status || data.status || "").toLowerCase()
    if (statusStr.includes("sstc") || statusStr.includes("sold"))
      status = "SOLD_STC"
    else if (statusStr.includes("under offer")) status = "UNDER_OFFER"

    const pricePerSqFt =
      squareFeet && squareFeet > 0
        ? Math.round((price / squareFeet) * 100) / 100
        : undefined

    // BMV detection
    const bmvIndicators = detectBmvIndicators({
      title,
      description,
      priceHistory,
      price,
      daysOnMarket,
    })

    // Extract bedrooms/bathrooms from multiple possible paths
    const bedrooms =
      data.bedrooms ||
      data.counts?.numBedrooms ||
      data.num_bedrooms ||
      data.features?.bedrooms ||
      data.bedroomCount ||
      0
    const bathrooms =
      data.bathrooms ||
      data.counts?.numBathrooms ||
      data.num_bathrooms ||
      data.features?.bathrooms ||
      data.bathroomCount ||
      0

    // Log data quality
    console.log(
      `${LOG_PREFIX} __NEXT_DATA__ extracted: id=${sourceId}, price=${price}, beds=${bedrooms}, baths=${bathrooms}, title="${title?.substring(0, 60)}"`
    )

    // Extract EPC, tenure, chain-free, new build etc.
    const keyFeaturesRaw: string[] = data.keyFeatures || data.bulletPoints || data.features || []
    const features = extractFeaturesFromText(description, keyFeaturesRaw)

    const tenure =
      data.tenure || data.analyticsTaxonomy?.tenure
        ? String(data.tenure || data.analyticsTaxonomy?.tenure).toUpperCase().replace(/\s+/g, "_")
        : features.tenure

    const property: ScrapedProperty = {
      sourceId,
      source: "ZOOPLA",
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
      keyFeatures: keyFeaturesRaw,
      epcRating: features.epcRating,
      tenure: tenure || undefined,
      isChainFree: features.isChainFree,
      isNewBuild: data.newHome ?? features.isNewBuild,
      isRetirement: features.isRetirement,
      leaseYearsRemaining: features.leaseYearsRemaining,
      groundRent: features.groundRent,
      serviceCharge: features.serviceCharge,
    }

    if (category === "COMMERCIAL") {
      property.commercialDetails = {
        leaseType: data.tenure,
        currentRent: data.pricing?.annualRent
          ? this.parsePrice(String(data.pricing.annualRent))
          : undefined,
      }
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

      // Title: try multiple selectors + og:title
      const title =
        document.querySelector('[data-testid="listing-title"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="address-label"]')?.textContent?.trim() ||
        document.querySelector("h1")?.textContent?.trim() ||
        getMeta("og:title") ||
        ""

      // Price: try data-testid, then og: tags, then any element with price-like content
      const priceText =
        document.querySelector('[data-testid="price"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="listing-price"]')?.textContent?.trim() ||
        getMeta("og:price:amount") ||
        getMeta("product:price:amount") ||
        // Find elements containing £ symbol
        (() => {
          const spans = Array.from(document.querySelectorAll("h2, span, p, div"))
          for (const el of spans) {
            const text = el.textContent?.trim() || ""
            if (/^£[\d,]+$/.test(text.replace(/\s/g, ""))) return text
          }
          return ""
        })() ||
        ""

      // Description: comprehensive selector chain
      const description =
        document.querySelector('[data-testid="truncated_text_container"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="listing-description"]')?.textContent?.trim() ||
        getMeta("og:description") ||
        getMeta("description") ||
        ""

      // Agent
      const agentName =
        document.querySelector('[data-testid="agent-name"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="branch-name"]')?.textContent?.trim() ||
        ""
      const agentPhone =
        document.querySelector('[data-testid="agent-phone"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="branch-phone"]')?.textContent?.trim() ||
        ""

      // Images from og: and data attributes
      const ogImage = getMeta("og:image")
      const images: string[] = []
      if (ogImage) images.push(ogImage)
      document.querySelectorAll('img[data-testid*="gallery"], img[data-testid*="image"]').forEach((img) => {
        const src = img.getAttribute("src")
        if (src && src.startsWith("http")) images.push(src)
      })

      // Try to extract bedrooms/bathrooms from icons or dedicated elements
      const bedsText =
        document.querySelector('[data-testid="beds-label"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="bed"]')?.textContent?.trim() ||
        ""
      const bathsText =
        document.querySelector('[data-testid="baths-label"]')?.textContent?.trim() ||
        document.querySelector('[data-testid="bath"]')?.textContent?.trim() ||
        ""

      // Try ld+json structured data
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

      // Address from og:title or ld+json
      const addressText = getMeta("og:title") || title

      // ── Postcode extraction strategy ────────────────────────────────────────
      //
      // Zoopla deliberately withholds the full postcode for privacy — they only
      // embed the outcode (e.g. "SA6") in their page data.  The page body DOES
      // contain full postcodes from nearby/similar properties.
      //
      // Priority:
      //   1. address/h1 element  (rarely has full postcode, but try first)
      //   2. og:title            (same — only outcode visible)
      //   3. ld+json             (postalCode intentionally omitted by Zoopla)
      //   4. Analytics JSON      → extract the outcode for this property, then
      //      find the FIRST full postcode in the body that matches that outcode.
      //      This gives a nearby postcode (same SA6 area) which is close enough
      //      for PropertyData's 3-mile radius comparable search.
      //   5. Last resort: any full postcode in the body (may be SE1 2LH etc.)
      //
      const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}\s\d[A-Z]{2})\b/i   // full only
      const OUTCODE_RE = /\b([A-Z]{1,2}\d{1,2})\b/i

      // Step 1 — address element
      const addressEl =
        document.querySelector('[data-testid="address-label"]') ||
        document.querySelector('[data-testid="listing-address"]') ||
        document.querySelector('[data-testid="address"]') ||
        document.querySelector('[itemprop="address"]') ||
        document.querySelector("h1")
      const postcodeInAddressEl = addressEl?.textContent?.match(UK_POSTCODE_RE)

      // Step 2 — og:title
      const postcodeInOg =
        getMeta("og:title").match(UK_POSTCODE_RE) ||
        getMeta("og:description").match(UK_POSTCODE_RE)

      // Step 3 — ld+json
      const ldAddress = ldJson?.address?.postalCode || ""
      const postcodeInLd = ldAddress ? ldAddress.match(UK_POSTCODE_RE) : null

      // Step 4 — analytics JSON: extract the subject property's outcode, then
      //          find the first body postcode that shares that outcode.
      let analyticsOutcode: string | null = null
      let firstMatchingBodyPostcode: string | null = null
      document.querySelectorAll('script[type="application/json"]').forEach((s) => {
        if (analyticsOutcode) return
        try {
          const d = JSON.parse(s.textContent || "")
          const oc = d.outcode || d.analytics?.outcode
          if (oc && typeof oc === "string") analyticsOutcode = oc.toUpperCase().trim()
        } catch {}
      })
      // Also try to get outcode from the address element or og:title
      if (!analyticsOutcode) {
        const outcodeInTitle = addressText.match(OUTCODE_RE)
        if (outcodeInTitle) analyticsOutcode = outcodeInTitle[1].toUpperCase()
      }

      if (analyticsOutcode) {
        // Search body for all full postcodes, then pick the first that matches the outcode
        const bodyText = document.body?.textContent || ""
        const allBody = bodyText.match(/\b[A-Z]{1,2}\d{1,2}\s\d[A-Z]{2}\b/gi) || []
        const escaped = analyticsOutcode.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        const outcodeBodyRe = new RegExp("^" + escaped + "\\s", "i")
        for (const m of allBody) {
          if (outcodeBodyRe.test(m)) {
            firstMatchingBodyPostcode = m.toUpperCase().replace(/\s+/g, " ").trim()
            break
          }
        }
      }

      // Step 5 — any full postcode in body (may be SE1 2LH / unrelated)
      const postcodeInBody = (document.body?.textContent || "").match(UK_POSTCODE_RE)

      const postcodeMatch =
        postcodeInAddressEl ||
        postcodeInOg ||
        postcodeInLd ||
        null  // steps 1-3 resolved above

      const rawPostcodeStr = postcodeMatch
        ? postcodeMatch[1].toUpperCase().replace(/\s+/g, " ").trim()
        : firstMatchingBodyPostcode  // nearby property same outcode — best approximation
          || (postcodeInBody ? postcodeInBody[1].toUpperCase().replace(/\s+/g, " ").trim() : null)

      return {
        title,
        priceText,
        description,
        agentName,
        agentPhone,
        images,
        bedsText,
        bathsText,
        addressText,
        postcode: rawPostcodeStr,
        analyticsOutcode,           // pass through so Node.js side can log it
        usingApproximatePostcode: !postcodeMatch && !!firstMatchingBodyPostcode,
        ldJson,
      }
    })

    // Log postcode quality
    if (extracted.usingApproximatePostcode) {
      console.log(`${LOG_PREFIX} Using nearby-property postcode "${extracted.postcode}" as approximation for outcode "${extracted.analyticsOutcode}" (Zoopla withholds exact postcode)`)
    } else if (extracted.analyticsOutcode && !extracted.postcode) {
      console.log(`${LOG_PREFIX} Outcode "${extracted.analyticsOutcode}" found but no matching nearby postcode in page body`)
    }

    // Parse price from ld+json first, then DOM text
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

    // Log data quality for debugging
    // Listing date from ld+json datePosted (Schema.org standard field)
    const ldJsonDate = extracted.ldJson?.datePosted
      ? new Date(extracted.ldJson.datePosted)
      : undefined
    const ldJsonDateValid = ldJsonDate && !isNaN(ldJsonDate.getTime())
    const daysOnMarket = ldJsonDateValid
      ? Math.max(0, Math.floor((Date.now() - ldJsonDate!.getTime()) / (1000 * 60 * 60 * 24)))
      : 0

    console.log(`${LOG_PREFIX} DOM fallback extracted for ${sourceId}: price=${price}, beds=${bedroomMatch?.[1] ?? '?'}, baths=${bathroomMatch?.[1] ?? '?'}, daysOnMarket=${daysOnMarket}, title="${extracted.title?.substring(0, 60)}"`)

    const bmvIndicators = detectBmvIndicators({
      title: extracted.title,
      description: extracted.description,
      priceHistory: [],
      price,
      daysOnMarket,
    })

    const property: ScrapedProperty = {
      sourceId,
      source: "ZOOPLA",
      category,
      title: extracted.title,
      description: extracted.description,
      propertyType,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : 0,
      bathrooms: bathroomMatch ? parseInt(bathroomMatch[1]) : 0,
      price,
      priceHistory: [],
      address: {
        displayAddress: extracted.addressText || extracted.title,
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
      listedDate: ldJsonDateValid ? ldJsonDate : undefined,
      daysOnMarket,
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

  // ---- Cookie consent (Zoopla-specific) ----

  private async handleZooplaCookieConsent(page: Page): Promise<void> {
    try {
      // Zoopla uses Usercentrics CMP — find "Accept all" button by text
      const clicked = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll("button"))
        for (const btn of buttons) {
          const text = btn.textContent?.trim().toLowerCase() || ""
          if (text === "accept all" || text === "accept all cookies") {
            btn.click()
            return true
          }
        }
        return false
      })

      if (clicked) {
        console.log(`${LOG_PREFIX} Accepted cookie consent`)
        await this.delay(1500)
        return
      }

      // Fallback: try standard selectors
      const btn = await page.$(ZOOPLA_SELECTORS.cookieAccept)
      if (btn) {
        await btn.click()
        await this.delay(1000)
        return
      }
      const btnAlt = await page.$(ZOOPLA_SELECTORS.cookieAcceptAlt)
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
    return match ? match[1] : `zoopla-${Date.now()}`
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
