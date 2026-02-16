import { Page, HTTPResponse } from "puppeteer"
import { BaseScraper } from "./base-scraper"
import { detectBmvIndicators, detectAmbiguity } from "./bmv-detector"
import { computeChecksum } from "./checksum"
import { debugLog, debugLogStart, debugLogEnd } from "./scraper-debug-logger"
import { extractFeaturesFromText } from "./extract-features"
import {
  RIGHTMOVE_BASE_URL,
  RIGHTMOVE_RESIDENTIAL_SEARCH,
  RIGHTMOVE_COMMERCIAL_SEARCH,
  RIGHTMOVE_SELECTORS,
  ADDED_SINCE_MAP,
} from "./constants"
import type {
  ScraperCriteria,
  ScrapedProperty,
  ScrapedAddress,
  AgentInfo,
  PriceHistoryEntry,
} from "./types"

const LOG_PREFIX = "[Rightmove]"

export class RightmoveScraper extends BaseScraper {
  get sourceName(): "RIGHTMOVE" {
    return "RIGHTMOVE"
  }

  // ---- Stealth page creation (override base) ----
  // Rightmove has aggressive bot detection. We must:
  // 1. NOT block resources (triggers detection)
  // 2. Add stealth patches to hide headless Chrome indicators

  protected override async createPage(): Promise<Page> {
    if (!this.browser) throw new Error("Browser not initialized")

    const page = await this.browser.newPage()

    // Stealth patches BEFORE any navigation
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver flag
      Object.defineProperty(navigator, "webdriver", { get: () => false })

      // Add realistic plugins array
      Object.defineProperty(navigator, "plugins", {
        get: () => {
          return [
            { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
            { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
            { name: "Native Client", filename: "internal-nacl-plugin" },
          ]
        },
      })

      // Proper languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-GB", "en-US", "en"],
      })

      // Add chrome runtime object
      const w = window as any
      w.chrome = {
        runtime: {},
        loadTimes: function () {},
        csi: function () {},
        app: { isInstalled: false },
      }

      // Override permissions query
      const originalQuery = navigator.permissions.query.bind(navigator.permissions)
      navigator.permissions.query = (params: any) =>
        params.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
          : originalQuery(params)
    })

    await page.setUserAgent(this.getRandomUserAgent())
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-GB,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Upgrade-Insecure-Requests": "1",
    })

    // DO NOT set request interception — blocking resources triggers Rightmove bot detection
    // and prevents JavaScript from hydrating properly

    return page
  }

  // ---- URL Building ----

  buildSearchUrls(criteria: ScraperCriteria): string[] {
    const urls: string[] = []
    const categories: ("RESIDENTIAL" | "COMMERCIAL")[] =
      criteria.category === "BOTH"
        ? ["RESIDENTIAL", "COMMERCIAL"]
        : [criteria.category as "RESIDENTIAL" | "COMMERCIAL"]

    for (const location of criteria.locations) {
      for (const category of categories) {
        const basePath =
          category === "COMMERCIAL"
            ? RIGHTMOVE_COMMERCIAL_SEARCH
            : RIGHTMOVE_RESIDENTIAL_SEARCH

        const params = new URLSearchParams()
        // Support full identifiers like "REGION^991" as well as bare numeric outcode IDs
        const locIdentifier = location.outcode.includes("^")
          ? location.outcode
          : `OUTCODE^${location.outcode}`
        params.set("locationIdentifier", locIdentifier)
        params.set("includeSSTC", criteria.includeSSTC ? "true" : "false")

        if (criteria.minPrice) params.set("minPrice", String(criteria.minPrice))
        if (criteria.maxPrice) params.set("maxPrice", String(criteria.maxPrice))

        if (category === "RESIDENTIAL") {
          if (criteria.minBedrooms)
            params.set("minBedrooms", String(criteria.minBedrooms))
          if (criteria.maxBedrooms)
            params.set("maxBedrooms", String(criteria.maxBedrooms))
        }

        if (criteria.propertyTypes && criteria.propertyTypes.length > 0) {
          params.set("propertyTypes", criteria.propertyTypes.join(","))
        }

        if (criteria.addedSince && ADDED_SINCE_MAP[criteria.addedSince]) {
          params.set("maxDaysSinceAdded", ADDED_SINCE_MAP[criteria.addedSince])
        }

        // Sort by newest first
        params.set("sortType", "6")

        const url = `${RIGHTMOVE_BASE_URL}${basePath}?${params.toString()}`
        urls.push(url)

        console.log(
          `${LOG_PREFIX} Search URL (${category}): ${url}`
        )
      }
    }

    return urls
  }

  // ---- Search Results Extraction ----
  // Rightmove uses Next.js with client-side data fetching.
  // __NEXT_DATA__ only has config — property data loads via JS after hydration.
  // The primary strategy is extracting property links from the rendered DOM.

  async scrapeSearchResults(page: Page, _url: string): Promise<string[]> {
    try {
      // Wait for property links to appear in the DOM (client-side rendered)
      try {
        await page.waitForSelector('a[href*="/properties/"]', { timeout: 15000 })
        console.log(`${LOG_PREFIX} Property links detected in DOM`)
      } catch {
        console.warn(`${LOG_PREFIX} No property links appeared within 15s`)
      }

      // Primary strategy: Extract property links from rendered DOM
      const propertyUrls = await page.evaluate((baseUrl) => {
        // Get all links to property detail pages
        const links = Array.from(document.querySelectorAll("a"))
        const propertyIds = new Set<string>()

        for (const link of links) {
          const href = link.getAttribute("href") || ""
          // Match /properties/12345 (with optional hash/query suffix)
          const match = href.match(/\/properties\/(\d{5,})/)
          if (match) {
            propertyIds.add(match[1])
          }
        }

        // Also check contactBranch links which contain propertyId parameter
        for (const link of links) {
          const href = link.getAttribute("href") || ""
          const match = href.match(/propertyId=(\d{5,})/)
          if (match) {
            propertyIds.add(match[1])
          }
        }

        return [...propertyIds].map((id) => `${baseUrl}/properties/${id}`)
      }, RIGHTMOVE_BASE_URL)

      if (propertyUrls.length > 0) {
        console.log(
          `${LOG_PREFIX} Extracted ${propertyUrls.length} unique property URLs from DOM`
        )
        return propertyUrls
      }

      // Fallback: log debug info
      const debugInfo = await page.evaluate(() => {
        return {
          title: document.title,
          linkCount: document.querySelectorAll("a").length,
          htmlSize: document.documentElement.outerHTML.length,
          sampleLinks: Array.from(document.querySelectorAll("a"))
            .map((a) => a.getAttribute("href"))
            .filter((h) => h && h.includes("propert"))
            .slice(0, 5),
        }
      })
      console.warn(
        `${LOG_PREFIX} No properties found. Debug:`,
        JSON.stringify(debugInfo, null, 2)
      )

      return []
    } catch (error: any) {
      console.error(
        `${LOG_PREFIX} Error extracting search results: ${error.message}`
      )
      return []
    }
  }

  // ---- Override pagination to use networkidle2 + raw HTML parsing ----

  protected override async scrapeAllPages(
    page: Page,
    baseUrl: string,
    criteria?: ScraperCriteria
  ): Promise<string[]> {
    const jobId = this.progress.jobId
    debugLogStart(jobId, "RIGHTMOVE")
    debugLog(jobId, `baseUrl=${baseUrl}`)

    const allUrls: string[] = []
    let pageNum = 0
    const maxPages = criteria?.maxPages ?? 42
    let totalResultCount: number | null = null

    while (pageNum < maxPages) {
      const paginatedUrl =
        pageNum === 0 ? baseUrl : `${baseUrl}&index=${pageNum * 24}`

      const msg = `PAGE ${pageNum + 1}/${maxPages}: ${paginatedUrl}`
      console.log(`${LOG_PREFIX} Scraping search ${msg}`)
      debugLog(jobId, `--- ${msg}`)

      // ── Response-body capture ──────────────────────────────────────────────
      // We listen for the document HTTP response and grab the raw HTML body.
      // NOTE: the handler is async so Node.js does NOT await it.  The 2-second
      // delay below is meant to let response.text() resolve, but page.content()
      // is used as a reliable synchronous fallback.
      let rawHtml = ""
      let responseHandlerFired = false
      const responseHandler = async (response: HTTPResponse) => {
        try {
          const respUrl = response.url()
          const resType = response.request().resourceType()
          const status  = response.status()
          debugLog(jobId, `  RESP type=${resType} status=${status} url=${respUrl.substring(0, 120)}`)
          if (
            respUrl.includes(paginatedUrl.split("?")[0]) &&
            resType === "document" &&
            status === 200
          ) {
            responseHandlerFired = true
            rawHtml = await response.text()
            debugLog(jobId, `  RESP captured HTML: ${rawHtml.length} chars`)
          }
        } catch (e: any) {
          debugLog(jobId, `  RESP handler error: ${e.message}`)
        }
      }
      page.on("response", responseHandler)

      let navigationSucceeded = true
      try {
        debugLog(jobId, `  GOTO domcontentloaded timeout=30s`)
        await page.goto(paginatedUrl, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        })
        debugLog(jobId, `  GOTO resolved OK`)
      } catch (navErr: any) {
        navigationSucceeded = false
        const msg2 = `GOTO error: ${navErr.message}`
        console.warn(`${LOG_PREFIX} Navigation issue (continuing with captured HTML): ${navErr.message}`)
        debugLog(jobId, `  ${msg2}`)
      }

      page.off("response", responseHandler)

      // Give the async response handler time to finish calling response.text().
      await this.delay(2000)
      debugLog(jobId, `  After 2s delay: rawHtml=${rawHtml.length} chars, handlerFired=${responseHandlerFired}, navOK=${navigationSucceeded}`)

      // Fallback 1: page.content() — a direct synchronous command to the browser.
      if (!rawHtml) {
        try {
          const pageHtml = await page.content()
          if (pageHtml && pageHtml.length > 500) {
            rawHtml = pageHtml
            const msg3 = `page.content() fallback: ${rawHtml.length} chars`
            console.log(`${LOG_PREFIX} ${msg3}`)
            debugLog(jobId, `  ${msg3}`)
          } else {
            debugLog(jobId, `  page.content() returned only ${pageHtml?.length ?? 0} chars — too small`)
          }
        } catch (e: any) {
          const msg3 = `page.content() fallback failed: ${e.message}`
          console.warn(`${LOG_PREFIX} ${msg3}`)
          debugLog(jobId, `  ${msg3}`)
        }
      }

      // Fallback 2: retry navigation if still no HTML
      if (!rawHtml && !navigationSucceeded) {
        console.warn(`${LOG_PREFIX} Retrying navigation for page ${pageNum + 1}...`)
        debugLog(jobId, `  RETRY networkidle2 timeout=60s`)
        const retryHandler = async (response: HTTPResponse) => {
          try {
            if (
              response.url().includes(paginatedUrl.split("?")[0]) &&
              response.request().resourceType() === "document" &&
              response.status() === 200
            ) {
              rawHtml = await response.text()
              debugLog(jobId, `  RETRY RESP captured HTML: ${rawHtml.length} chars`)
            }
          } catch {}
        }
        page.on("response", retryHandler)
        try {
          await page.goto(paginatedUrl, {
            waitUntil: "networkidle2",
            timeout: 60000,
          })
          debugLog(jobId, `  RETRY resolved OK`)
        } catch (retryErr: any) {
          const msg4 = `RETRY also failed: ${retryErr.message}`
          console.warn(`${LOG_PREFIX} Retry also failed: ${retryErr.message}`)
          debugLog(jobId, `  ${msg4}`)
        }
        page.off("response", retryHandler)
        await this.delay(1000)
      }

      // Fallback 3: page.content() one final time after retry
      if (!rawHtml) {
        try {
          const pageHtml = await page.content()
          if (pageHtml && pageHtml.length > 500) {
            rawHtml = pageHtml
            const msg5 = `page.content() after retry: ${rawHtml.length} chars`
            console.log(`${LOG_PREFIX} ${msg5}`)
            debugLog(jobId, `  ${msg5}`)
          }
        } catch {}
      }

      const pageTitleCurrent = await page.title().catch(() => "(unknown)")
      debugLog(jobId, `  FINAL: rawHtml=${rawHtml.length} chars  pageTitle="${pageTitleCurrent}"`)
      console.log(`${LOG_PREFIX} HTML captured: ${rawHtml.length} chars, navOK: ${navigationSucceeded}`)

      await this.handleCookieConsent(page)
      await this.delay(1500)

      // Check for bot detection / challenge page
      const pageTitle = await page.title().catch(() => "")
      if (
        pageTitle.toLowerCase().includes("challenge") ||
        pageTitle.toLowerCase().includes("captcha") ||
        pageTitle.toLowerCase().includes("blocked") ||
        pageTitle.toLowerCase().includes("access denied")
      ) {
        const botMsg = `Bot detection triggered! Title="${pageTitle}"`
        console.warn(`${LOG_PREFIX} ${botMsg}. Waiting and retrying...`)
        debugLog(jobId, `  BOT DETECTED: ${botMsg}`)
        await this.delay(10000)
        await page.reload({ waitUntil: "networkidle2", timeout: 45000 })
        await this.delay(3000)
      }

      // Try to extract total result count from the page (first page only)
      if (pageNum === 0 && totalResultCount === null) {
        totalResultCount = await this.extractResultCount(page, rawHtml)
        if (totalResultCount !== null) {
          const estPages = Math.ceil(totalResultCount / 24)
          console.log(`${LOG_PREFIX} Total results: ${totalResultCount} (~${estPages} pages)`)
          debugLog(jobId, `  resultCount=${totalResultCount} (~${estPages} pages)`)
        } else {
          debugLog(jobId, `  resultCount not found`)
        }
      }

      // Strategy A: Parse property IDs from raw HTML response (bypasses JS execution issues)
      let pageUrlCount = 0
      let rawHtmlUrls: string[] = []
      if (rawHtml) {
        rawHtmlUrls = this.extractPropertyUrlsFromHtml(rawHtml)
        if (rawHtmlUrls.length > 0) {
          console.log(`${LOG_PREFIX} Extracted ${rawHtmlUrls.length} property URLs from raw HTML response`)
          debugLog(jobId, `  Strategy A (raw HTML): ${rawHtmlUrls.length} URLs found`)
          allUrls.push(...rawHtmlUrls)
          pageUrlCount = rawHtmlUrls.length
        } else {
          debugLog(jobId, `  Strategy A (raw HTML): 0 URLs found — checking first 500 chars of HTML:`)
          debugLog(jobId, `  ${rawHtml.substring(0, 500).replace(/\n/g, " ")}`)
        }
      } else {
        debugLog(jobId, `  Strategy A skipped: rawHtml is empty`)
      }

      // Strategy B: If raw HTML didn't work, try page.evaluate strategies
      if (rawHtmlUrls.length === 0) {
        debugLog(jobId, `  Strategy B (DOM evaluate)...`)
        const urls = await this.scrapeSearchResults(page, paginatedUrl)
        debugLog(jobId, `  Strategy B: ${urls.length} URLs`)
        if (urls.length === 0) {
          console.warn(`${LOG_PREFIX} No properties found on page ${pageNum + 1}, stopping pagination`)
          debugLog(jobId, `  STOPPING: 0 properties on page ${pageNum + 1}`)
          break
        }
        allUrls.push(...urls)
        pageUrlCount = urls.length
      }

      pageNum++

      // Decide whether to continue to next page:
      // 1. If we know the total, check if we've passed it
      if (totalResultCount !== null && pageNum * 24 >= totalResultCount) {
        console.log(`${LOG_PREFIX} Reached end of results (${totalResultCount} total)`)
        break
      }

      // 2. If this page returned fewer than expected, we're likely on the last page
      if (pageUrlCount < 20) {
        console.log(
          `${LOG_PREFIX} Page ${pageNum} had only ${pageUrlCount} results (< 20), likely last page`
        )
        break
      }

      // 3. Fallback: also check DOM for pagination button (but don't rely on it solely)
      const hasNext = await page.$(RIGHTMOVE_SELECTORS.paginationNext)
      if (hasNext) {
        const isDisabled = await page.evaluate((sel) => {
          const btn = document.querySelector(sel)
          return (
            btn?.hasAttribute("disabled") || btn?.classList.contains("disabled")
          )
        }, RIGHTMOVE_SELECTORS.paginationNext)

        if (isDisabled) {
          console.log(`${LOG_PREFIX} Next button is disabled, stopping`)
          break
        }
      }
      // If no next button found but we got a full page of results, continue anyway
      // (the selector may be stale but Rightmove pagination works via URL index param)

      await this.delay(this.randomDelay())
    }

    const dedupedUrls = [...new Set(allUrls)]
    console.log(
      `${LOG_PREFIX} Pagination complete: ${dedupedUrls.length} unique URLs from ${pageNum} page(s)`
    )
    debugLog(jobId, `PAGINATION COMPLETE: ${dedupedUrls.length} unique URLs from ${pageNum} page(s)`)
    debugLogEnd(jobId, dedupedUrls.length, dedupedUrls.length)
    return dedupedUrls
  }

  /**
   * Try to extract the total result count from the search page.
   * Rightmove shows something like "1,234 results" in the header.
   */
  private async extractResultCount(
    page: Page,
    rawHtml: string
  ): Promise<number | null> {
    // Try from raw HTML first — look for resultCount in jsonModel or page content
    if (rawHtml) {
      // Pattern: "resultCount":"1234" or resultCount:1234
      const countMatch = rawHtml.match(/"resultCount"\s*:\s*"?(\d+)"?/)
      if (countMatch) return parseInt(countMatch[1])

      // Pattern: searchHeader-resultCount or similar
      const headerMatch = rawHtml.match(
        /resultCount[^>]*>([^<]*\d[^<]*)</
      )
      if (headerMatch) {
        const num = parseInt(headerMatch[1].replace(/[^\d]/g, ""))
        if (!isNaN(num)) return num
      }
    }

    // Try from rendered DOM
    try {
      const count = await page.evaluate(() => {
        // Try common selectors for result count
        const selectors = [
          ".searchHeader-resultCount",
          "[data-testid='results-count']",
          "[class*='resultCount']",
          ".search-results-count",
        ]
        for (const sel of selectors) {
          const el = document.querySelector(sel)
          if (el?.textContent) {
            const num = parseInt(el.textContent.replace(/[^\d]/g, ""))
            if (!isNaN(num) && num > 0) return num
          }
        }
        // Also try extracting from page title like "1,234 properties for sale..."
        const title = document.title
        const match = title.match(/^([\d,]+)\s+propert/i)
        if (match) return parseInt(match[1].replace(/,/g, ""))
        return null
      })
      return count
    } catch {
      return null
    }
  }

  /**
   * Extract property URLs from raw HTML by parsing jsonModel or property links.
   * This works even when JS doesn't execute properly.
   */
  private extractPropertyUrlsFromHtml(html: string): string[] {
    const urls: string[] = []

    // Try 1: Extract from window.jsonModel assignment in script tags
    const jsonModelMatch = html.match(
      /window\.jsonModel\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/
    )
    if (jsonModelMatch) {
      try {
        const model = JSON.parse(jsonModelMatch[1])
        if (model.properties && Array.isArray(model.properties)) {
          for (const p of model.properties) {
            const id = p.id || p.propertyId
            if (id) urls.push(`${RIGHTMOVE_BASE_URL}/properties/${id}`)
          }
          if (urls.length > 0) {
            console.log(`${LOG_PREFIX} Parsed ${urls.length} properties from raw jsonModel`)
            return urls
          }
        }
      } catch (e: any) {
        console.warn(`${LOG_PREFIX} Failed to parse jsonModel from HTML: ${e.message}`)
      }
    }

    // Try 2: Extract property IDs via regex from any script content
    const idMatches = html.matchAll(/\/properties\/(\d{5,})/g)
    const ids = new Set<string>()
    for (const match of idMatches) {
      ids.add(match[1])
    }
    if (ids.size > 0) {
      for (const id of ids) {
        urls.push(`${RIGHTMOVE_BASE_URL}/properties/${id}`)
      }
      console.log(`${LOG_PREFIX} Found ${ids.size} property IDs via regex in HTML`)
    }

    return urls
  }

  // ---- Property Detail Extraction ----

  async scrapePropertyDetail(
    page: Page,
    url: string
  ): Promise<ScrapedProperty> {
    console.log(`${LOG_PREFIX} Scraping property detail: ${url}`)

    // Capture raw HTML response for fallback parsing
    let rawHtml = ""
    const responseHandler = async (response: HTTPResponse) => {
      try {
        if (
          response.request().resourceType() === "document" &&
          response.status() === 200
        ) {
          rawHtml = await response.text()
        }
      } catch {}
    }
    page.on("response", responseHandler)

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 })
    page.off("response", responseHandler)

    await this.handleCookieConsent(page)
    await this.delay(2000)

    // Strategy 1: Extract PAGE_MODEL from window (Rightmove's primary data object)
    const pageModel = await page.evaluate(() => {
      return (window as any).PAGE_MODEL || null
    })

    if (pageModel?.propertyData) {
      console.log(`${LOG_PREFIX} Using PAGE_MODEL for ${url}`)
      return this.parsePageModel(pageModel, url)
    }

    // Strategy 2: Extract from window.jsonModel (property detail variant)
    const jsonModel = await page.evaluate(() => {
      try {
        return (window as any).jsonModel || null
      } catch {
        return null
      }
    })

    if (jsonModel?.propertyData) {
      console.log(`${LOG_PREFIX} Using jsonModel for ${url}`)
      return this.parsePageModel(jsonModel, url)
    }

    // Strategy 3: Extract __NEXT_DATA__ (if Rightmove migrated to Next.js)
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

    if (nextData?.props?.pageProps?.propertyData) {
      console.log(`${LOG_PREFIX} Using __NEXT_DATA__ for ${url}`)
      return this.parsePageModel({ propertyData: nextData.props.pageProps.propertyData }, url)
    }

    // Check alternate __NEXT_DATA__ paths
    const altPropertyData =
      nextData?.props?.pageProps?.property ||
      nextData?.props?.pageProps?.data?.propertyData ||
      nextData?.props?.pageProps?.data?.property
    if (altPropertyData) {
      console.log(`${LOG_PREFIX} Using __NEXT_DATA__ (alt path) for ${url}`)
      return this.parsePageModel({ propertyData: altPropertyData }, url)
    }

    // Strategy 4: Parse PAGE_MODEL from raw HTML (works even if JS didn't execute)
    if (rawHtml) {
      const pageModelFromHtml = this.extractPageModelFromHtml(rawHtml)
      if (pageModelFromHtml?.propertyData) {
        console.log(`${LOG_PREFIX} Using PAGE_MODEL from raw HTML for ${url}`)
        return this.parsePageModel(pageModelFromHtml, url)
      }
    }

    // Strategy 5: Extract structured data from ld+json
    const ldJsonData = await page.evaluate(() => {
      const scripts = Array.from(
        document.querySelectorAll('script[type="application/ld+json"]')
      )
      for (const script of scripts) {
        try {
          const data = JSON.parse(script.textContent || "")
          if (data["@type"] === "Product" || data["@type"] === "RealEstateListing" || data["@type"] === "Residence") {
            return data
          }
        } catch {}
      }
      return null
    })

    if (ldJsonData) {
      console.log(`${LOG_PREFIX} Using ld+json structured data for ${url}`)
      return this.parseLdJson(ldJsonData, url)
    }

    // Strategy 6: Fallback to DOM scraping
    console.log(`${LOG_PREFIX} All JSON strategies failed, using DOM fallback for ${url}`)
    return this.parseDomFallback(page, url)
  }

  /**
   * Extract PAGE_MODEL from raw HTML by parsing the script tag that assigns it.
   */
  private extractPageModelFromHtml(html: string): any | null {
    // Rightmove embeds PAGE_MODEL in a script tag like:
    // window.PAGE_MODEL = {...};
    const match = html.match(
      /window\.PAGE_MODEL\s*=\s*(\{[\s\S]*?\})\s*;\s*<\/script>/
    )
    if (match) {
      try {
        return JSON.parse(match[1])
      } catch (e: any) {
        console.warn(`${LOG_PREFIX} Failed to parse PAGE_MODEL from HTML: ${e.message}`)
      }
    }
    return null
  }

  // ---- PAGE_MODEL Parser ----

  private parsePageModel(model: any, url: string): ScrapedProperty {
    const data = model.propertyData
    const sourceId = String(data.id)

    // Parse price — prefer clean numeric fields first
    // mortgageCalculator.price is always a plain integer (e.g. 200000) — most reliable
    const price = this.parsePrice(
      data.mortgageCalculator?.price ??       // CONFIRMED clean numeric (e.g. 200000)
      data.prices?.amount ??                  // numeric amount if present
      data.prices?.primaryPrice ??            // string like "£245,000" or raw number
      data.prices?.exchangedPriceDisplay ??   // alternative display price
      data.prices?.displayPrice ??            // fallback display string
      data.price ??                           // direct price field (some variants)
      "0"
    )

    // Parse previous price for price history
    const priceHistory: PriceHistoryEntry[] = []
    if (data.prices?.previousPrice) {
      const prevPrice = this.parsePrice(data.prices.previousPrice)
      if (prevPrice > 0 && prevPrice !== price) {
        priceHistory.push({
          date: new Date().toISOString(),
          price: prevPrice,
          changePercent: Math.round(((price - prevPrice) / prevPrice) * 100),
        })
      }
    }

    // Build address — prefer full postcode from any available field.
    // Rightmove sometimes only provides the outcode (e.g. "SA5") in address.outcode
    // with address.incode empty; check analytics/location objects as fallback.
    const rmPostcode =
      (data.address?.outcode && data.address?.incode
        ? `${data.address.outcode} ${data.address.incode}`.trim()
        : undefined) ||
      data.address?.postcode ||
      data.analytics?.postcode ||
      data.location?.postcode ||
      // outcode-only fallback (better than nothing)
      data.address?.outcode

    const address: ScrapedAddress = {
      displayAddress: data.address?.displayAddress || "",
      postcode: rmPostcode
        ? rmPostcode.toUpperCase().replace(/\s+/g, " ").trim()
        : undefined,
      town: data.address?.town,
      county: data.address?.county,
      latitude: data.location?.latitude,
      longitude: data.location?.longitude,
    }

    // Parse sizing
    let squareFeet: number | undefined
    let squareMeters: number | undefined
    if (data.sizings && data.sizings.length > 0) {
      const sizing = data.sizings[0]
      if (sizing.unit === "sqft") {
        squareFeet = sizing.minimumSize || sizing.maximumSize
        if (squareFeet) squareMeters = Math.round(squareFeet * 0.0929)
      } else if (sizing.unit === "sqm") {
        squareMeters = sizing.minimumSize || sizing.maximumSize
        if (squareMeters) squareFeet = Math.round(squareMeters * 10.764)
      }
    }

    // Parse images
    const images: string[] = (data.images || [])
      .map((img: any) => img.url || img.srcUrl)
      .filter(Boolean)

    // Parse floor plans
    const floorPlans: string[] = (data.floorplans || [])
      .map((fp: any) => fp.url || fp.srcUrl)
      .filter(Boolean)

    // Parse agent
    const agent: AgentInfo = {
      name: data.customer?.branchDisplayName,
      branch: data.customer?.branchName,
      phone: data.customer?.contactTelephone,
      logoUrl: data.customer?.logoUrl,
    }

    // Parse property type from title/phrase
    const titleText = data.text?.pageTitle || data.text?.propertyPhrase || ""
    const description = data.text?.description || ""
    const propertyType = this.extractPropertyType(titleText)
    const propertySubType = data.propertySubType || undefined

    // Determine category
    const category = this.isCommercial(propertyType, description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    // Parse listed date and days on market.
    // Rightmove's listingHistory.listingUpdateReason is the primary date source.
    // It is a display string like "Added on 06/02/2026" or "Reduced today".
    // NOTE: listingUpdateDate does NOT exist in Rightmove's PAGE_MODEL (confirmed by debug).

    const parseRmDateString = (s: string | undefined): string | null => {
      if (!s) return null
      // "Added on DD/MM/YYYY" or "Reduced on DD/MM/YYYY"
      const ddmmyyyy = s.match(/(\d{2})\/(\d{2})\/(\d{4})/)
      if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2]}-${ddmmyyyy[1]}`
      // "today" or "Reduced today" → today's date
      if (s.toLowerCase().includes("today")) return new Date().toISOString().substring(0, 10)
      // ISO date embedded: "2026-02-06"
      const iso = s.match(/(\d{4}-\d{2}-\d{2})/)
      if (iso) return iso[1]
      return null
    }

    const rawListedDate =
      parseRmDateString(data.listingHistory?.listingUpdateReason) ||  // "Added on DD/MM/YYYY" / "Reduced today"
      data.listingHistory?.listingUpdateDate ||  // might exist on some variants
      data.firstVisibleDate ||                   // ISO date or timestamp
      data.dateAdded ||                          // ISO date
      data.listingUpdateDate ||                  // direct ISO date field
      parseRmDateString(data.addedOrReducedDate) ||  // another display string field
      null
    const listedDate = rawListedDate ? new Date(rawListedDate) : undefined
    const daysOnMarket =
      listedDate && !isNaN(listedDate.getTime())
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - listedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0

    // Determine status
    let status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER" = "FOR_SALE"
    const statusText = (data.text?.shareDescription || "").toLowerCase()
    if (statusText.includes("sold stc") || statusText.includes("sold subject"))
      status = "SOLD_STC"
    else if (statusText.includes("under offer")) status = "UNDER_OFFER"

    // Calculate price per sqft
    const pricePerSqFt =
      squareFeet && squareFeet > 0
        ? Math.round((price / squareFeet) * 100) / 100
        : undefined

    // Build partial property for BMV detection
    const partialProperty = {
      title: titleText,
      description,
      priceHistory,
      price,
      daysOnMarket,
    }

    const bmvIndicators = detectBmvIndicators(partialProperty)

    // Extract EPC, tenure, chain-free, new build, etc.
    // Rightmove PAGE_MODEL provides structured tenure data; key features array fills the rest.
    const keyFeaturesRaw: string[] = data.keyFeatures || []
    const features = extractFeaturesFromText(description, keyFeaturesRaw)

    // Structured fields override text-scan results where available
    const tenure =
      data.tenure?.tenureType                                            // "FREEHOLD" / "LEASEHOLD"
        ? String(data.tenure.tenureType).toUpperCase().replace(/\s+/g, "_")
        : features.tenure

    const epcRating =
      data.epcGraphs?.[0]?.ratingBand ||
      data.epcGraphs?.[0]?.rating ||
      features.epcRating

    const leaseYearsRemaining =
      data.tenure?.yearsRemainingOnLease ?? features.leaseYearsRemaining

    const groundRent =
      data.tenure?.annualGroundRent ?? features.groundRent

    const serviceCharge =
      data.tenure?.serviceChargePerAnnum ?? features.serviceCharge

    // Build full property
    const property: ScrapedProperty = {
      sourceId,
      source: "RIGHTMOVE",
      category,
      title: titleText,
      description,
      propertyType,
      propertySubType,
      bedrooms: data.bedrooms || 0,
      bathrooms: data.bathrooms || 0,
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
      checksum: computeChecksum(titleText, price, description),
      keyFeatures: keyFeaturesRaw,
      epcRating: epcRating || undefined,
      tenure: tenure || undefined,
      isChainFree: features.isChainFree,
      isNewBuild: data.newHome ?? features.isNewBuild,
      isRetirement: features.isRetirement,
      leaseYearsRemaining,
      groundRent,
      serviceCharge,
    }

    // Commercial details
    if (category === "COMMERCIAL") {
      property.commercialDetails = {
        leaseType: data.tenure?.tenureType,
        currentRent: data.lettings?.rent
          ? this.parsePrice(String(data.lettings.rent))
          : undefined,
        useClass: data.commercialUseClass,
      }
    }

    // Detect ambiguity
    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- ld+json Structured Data Parser ----

  private parseLdJson(data: any, url: string): ScrapedProperty {
    const idMatch = url.match(/\/properties\/(\d+)/)
    const sourceId = idMatch ? idMatch[1] : `rm-${Date.now()}`

    const price = this.parsePrice(
      data.offers?.price || data.price || data.offers?.lowPrice || "0"
    )
    const title = data.name || data.description?.substring(0, 100) || ""
    const description = data.description || ""

    const address: ScrapedAddress = {
      displayAddress:
        data.address?.streetAddress ||
        data.address?.name ||
        title,
      postcode: data.address?.postalCode,
      town: data.address?.addressLocality,
      county: data.address?.addressRegion,
      latitude: data.geo?.latitude,
      longitude: data.geo?.longitude,
    }

    const bedroomMatch = title.match(/(\d+)\s*bed/i)
    const bathroomMatch = (title + " " + description).match(/(\d+)\s*bath/i)
    const propertyType = this.extractPropertyType(title)
    const category = this.isCommercial(propertyType, description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    const images: string[] = []
    if (data.image) {
      const imgList = Array.isArray(data.image) ? data.image : [data.image]
      images.push(...imgList.filter((i: any) => typeof i === "string"))
    }

    const ldDate = data.datePosted || data.datePublished || null
    const ldListedDate = ldDate ? new Date(ldDate) : undefined
    const ldDaysOnMarket =
      ldListedDate && !isNaN(ldListedDate.getTime())
        ? Math.max(
            0,
            Math.floor(
              (Date.now() - ldListedDate.getTime()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0

    const bmvIndicators = detectBmvIndicators({
      title,
      description,
      priceHistory: [],
      price,
      daysOnMarket: ldDaysOnMarket,
    })

    const property: ScrapedProperty = {
      sourceId,
      source: "RIGHTMOVE",
      category,
      title,
      description,
      propertyType,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : 0,
      bathrooms: bathroomMatch ? parseInt(bathroomMatch[1]) : 0,
      price,
      priceHistory: [],
      address,
      images,
      floorPlans: [],
      agent: {},
      bmvIndicators,
      isAmbiguous: false,
      ambiguityReasons: [],
      listingUrl: url,
      daysOnMarket: ldDaysOnMarket,
      status: "FOR_SALE",
      checksum: computeChecksum(title, price, description),
    }

    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- DOM Fallback Parser ----

  private async parseDomFallback(
    page: Page,
    url: string
  ): Promise<ScrapedProperty> {
    // Extract property ID from URL
    const idMatch = url.match(/\/properties\/(\d+)/)
    const sourceId = idMatch ? idMatch[1] : `unknown-${Date.now()}`

    const extracted = await page.evaluate(() => {
      const getText = (sel: string): string => {
        const el = document.querySelector(sel)
        return el?.textContent?.trim() || ""
      }

      const getAll = (sel: string): string[] => {
        return Array.from(document.querySelectorAll(sel)).map(
          (el) => el.textContent?.trim() || ""
        )
      }

      // Title: try stable selectors first, then generic h1
      const title =
        getText('h1[itemprop="name"]') ||
        getText('[data-testid="property-title"]') ||
        getText('[data-test="property-title"]') ||
        getText("h1")

      // Price: try stable data-test attributes, then meta tags, then generic
      const ogPrice = document
        .querySelector('meta[property="og:price:amount"]')
        ?.getAttribute("content")
      const priceText =
        getText('[data-testid="property-price"]') ||
        getText('[data-test="price"]') ||
        ogPrice ||
        getText('[class*="price" i] span') ||
        getText('[class*="Price" i]') ||
        ""

      // Address from meta
      const ogTitle = document
        .querySelector('meta[property="og:title"]')
        ?.getAttribute("content") || ""

      // Description: try stable selectors
      const description =
        getText('[data-testid="property-description"]') ||
        getText('[data-test="description"]') ||
        getText('[itemprop="description"]') ||
        getText('[class*="description" i]') ||
        ""

      // Key features
      const keyFeatures =
        getAll('[data-testid="key-feature"]') ||
        getAll('[data-test="keyFeature"]') ||
        getAll('li[class*="keyFeature" i]') ||
        []

      // Agent
      const agentName =
        getText('[data-testid="agent-name"]') ||
        getText('[data-test="agent-name"]') ||
        getText('[class*="agentName" i]') ||
        ""
      const agentPhone =
        getText('[data-testid="agent-phone"]') ||
        getText('[data-test="agent-phone"]') ||
        getText('[class*="agentPhone" i] a') ||
        ""

      // Images from OG tags (most reliable)
      const ogImage = document
        .querySelector('meta[property="og:image"]')
        ?.getAttribute("content")

      // Bedrooms/bathrooms from key features
      const fullText = `${title} ${ogTitle} ${keyFeatures.join(" ")}`

      // Try to get postcode from page
      const addressText = ogTitle || title

      return {
        title: title || ogTitle,
        priceText,
        description: description + (keyFeatures.length ? " " + keyFeatures.join(". ") : ""),
        agentName,
        agentPhone,
        ogImage,
        fullText,
        addressText,
      }
    })

    const price = this.parsePrice(extracted.priceText)
    const description = extracted.description
    const title = extracted.title

    // Extract bedrooms/bathrooms from title/features text
    const bedroomMatch = extracted.fullText.match(/(\d+)\s*bed/i)
    const bathroomMatch = extracted.fullText.match(/(\d+)\s*bath/i)

    // Try to extract postcode from address text
    const postcodeMatch = extracted.addressText.match(
      /\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/i
    )

    const propertyType = this.extractPropertyType(title)
    const category = this.isCommercial(propertyType, description)
      ? "COMMERCIAL"
      : "RESIDENTIAL"

    const bmvIndicators = detectBmvIndicators({
      title,
      description,
      priceHistory: [],
      price,
      daysOnMarket: 0,
    })

    const property: ScrapedProperty = {
      sourceId,
      source: "RIGHTMOVE",
      category,
      title,
      description,
      propertyType,
      bedrooms: bedroomMatch ? parseInt(bedroomMatch[1]) : 0,
      bathrooms: bathroomMatch ? parseInt(bathroomMatch[1]) : 0,
      price,
      priceHistory: [],
      address: {
        displayAddress: extracted.addressText || title,
        postcode: postcodeMatch ? postcodeMatch[1] : undefined,
      },
      images: extracted.ogImage ? [extracted.ogImage] : [],
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
      checksum: computeChecksum(title, price, description),
    }

    const ambiguity = detectAmbiguity(property)
    property.isAmbiguous = ambiguity.isAmbiguous
    property.ambiguityReasons = ambiguity.reasons

    return property
  }

  // ---- Utility methods ----

  private parsePrice(priceStr: string | number | null | undefined): number {
    if (priceStr === null || priceStr === undefined) return 0
    if (typeof priceStr === "number") return isNaN(priceStr) ? 0 : priceStr
    if (!priceStr) return 0
    const cleaned = String(priceStr).replace(/[£$€,\s]/g, "").replace(/pcm|pa/gi, "")
    const num = parseFloat(cleaned)
    return isNaN(num) ? 0 : num
  }

  private buildPostcode(
    outcode?: string,
    incode?: string
  ): string | undefined {
    if (!outcode) return undefined
    return incode ? `${outcode} ${incode}` : outcode
  }

  private extractPropertyType(title: string): string {
    const lower = title.toLowerCase()
    const types = [
      "detached house",
      "semi-detached house",
      "terraced house",
      "end of terrace house",
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
      "garage",
      "parking",
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

    // Check description for commercial indicators
    const descLower = description.toLowerCase()
    return (
      descLower.includes("commercial property") ||
      descLower.includes("business rates") ||
      descLower.includes("rateable value")
    )
  }
}
