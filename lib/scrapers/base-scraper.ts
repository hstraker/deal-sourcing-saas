import puppeteer, { Browser, Page } from "puppeteer"
import { prisma } from "../db"
import { USER_AGENTS, RIGHTMOVE_SELECTORS } from "./constants"
import { detectBmvIndicators, detectAmbiguity } from "./bmv-detector"
import { computeChecksum } from "./checksum"
import { enrichPropertyWithOwnership, resolvePostcodeFromAddress } from "../land-registry"
import type {
  ScraperCriteria,
  ScrapedProperty,
  ScraperProgress,
  ScraperSettingsData,
} from "./types"

const LOG_PREFIX = "[Scraper]"

export abstract class BaseScraper {
  protected browser: Browser | null = null
  protected settings: ScraperSettingsData
  protected progress: ScraperProgress

  constructor(settings: ScraperSettingsData, jobId: string) {
    this.settings = settings
    this.progress = {
      jobId,
      totalFound: 0,
      processed: 0,
      successful: 0,
      failed: 0,
      errors: [],
      propertiesFound: [],
    }
  }

  // ---- Abstract methods (each source implements) ----

  abstract get sourceName(): "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  abstract buildSearchUrls(criteria: ScraperCriteria): string[]
  abstract scrapeSearchResults(page: Page, url: string): Promise<string[]>
  abstract scrapePropertyDetail(
    page: Page,
    url: string
  ): Promise<ScrapedProperty>

  // ---- Lifecycle ----

  async initialize(): Promise<void> {
    console.log(`${LOG_PREFIX} Launching browser...`)

    const launchArgs = [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1920,1080",
    ]

    if (this.settings.useProxy && this.settings.proxyUrl) {
      launchArgs.push(`--proxy-server=${this.settings.proxyUrl}`)
    }

    this.browser = await puppeteer.launch({
      headless: this.settings.headful ? false : true,
      args: launchArgs,
      defaultViewport: { width: 1920, height: 1080 },
    })

    try {
      await prisma.scraperJob.update({
        where: { id: this.progress.jobId },
        data: { status: "RUNNING", startedAt: new Date() },
      })
    } catch {
      // Job record may not exist (e.g. search-only CLI mode)
    }

    console.log(`${LOG_PREFIX} Browser launched, job marked RUNNING`)
  }

  async shutdown(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }

    const failRate =
      this.progress.processed > 0
        ? this.progress.failed / this.progress.processed
        : 0
    const status = failRate > 0.5 ? "FAILED" : "COMPLETED"

    try {
      await prisma.scraperJob.update({
        where: { id: this.progress.jobId },
        data: {
          status: status as any,
          completedAt: new Date(),
          totalFound: this.progress.totalFound,
          processed: this.progress.processed,
          successful: this.progress.successful,
          failed: this.progress.failed,
          errors: this.progress.errors as any,
          propertiesFound: this.progress.propertiesFound,
        },
      })
    } catch {
      // Job record may not exist (e.g. search-only CLI mode)
    }

    console.log(
      `${LOG_PREFIX} Shutdown complete. Status: ${status} | ` +
        `Found: ${this.progress.totalFound} | Saved: ${this.progress.successful} | Failed: ${this.progress.failed}`
    )
  }

  // ---- Main run loop ----

  async run(criteria: ScraperCriteria): Promise<ScraperProgress> {
    await this.initialize()

    try {
      const searchUrls = this.buildSearchUrls(criteria)
      console.log(
        `${LOG_PREFIX} Built ${searchUrls.length} search URL(s) for ${this.sourceName}`
      )

      for (const searchUrl of searchUrls) {
        const page = await this.createPage()

        try {
          // Collect all property detail URLs from search results (with pagination)
          const detailUrls = await this.scrapeAllPages(page, searchUrl, criteria)
          this.progress.totalFound += detailUrls.length
          console.log(
            `${LOG_PREFIX} Found ${detailUrls.length} properties from search`
          )

          // Persist totalFound to DB immediately so the UI shows the correct
          // count before any detail pages are processed (previously the count
          // stayed at 0 until the 10th property was saved).
          await this.updateJobProgress()

          await page.close()

          // Visit each detail page
          for (const detailUrl of detailUrls) {
            await this.delay(this.randomDelay())

            const detailPage = await this.createPage()
            try {
              const property = await this.scrapePropertyDetail(
                detailPage,
                detailUrl
              )
              const listingId = await this.saveProperty(property)
              this.progress.successful++
              this.progress.propertiesFound.push(listingId)
            } catch (error: any) {
              this.progress.failed++
              this.progress.errors.push({
                url: detailUrl,
                message: error.message,
                timestamp: new Date().toISOString(),
              })
              console.error(
                `${LOG_PREFIX} Failed to scrape ${detailUrl}: ${error.message}`
              )
            } finally {
              this.progress.processed++
              await detailPage.close()
            }

            // Persist progress every 10 properties
            if (this.progress.processed % 10 === 0) {
              await this.updateJobProgress()
            }
          }
        } catch (error: any) {
          console.error(
            `${LOG_PREFIX} Error processing search URL ${searchUrl}: ${error.message}`
          )
          this.progress.errors.push({
            url: searchUrl,
            message: `Search page error: ${error.message}`,
            timestamp: new Date().toISOString(),
          })
        }
      }
    } finally {
      await this.shutdown()
    }

    return this.progress
  }

  // ---- Page helpers ----

  protected async createPage(): Promise<Page> {
    if (!this.browser) throw new Error("Browser not initialized")

    const page = await this.browser.newPage()

    // Stealth patches to reduce bot detection
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-GB", "en-US", "en"],
      })
      const w = window as any
      w.chrome = { runtime: {}, loadTimes: function () {}, csi: function () {} }
    })

    await page.setUserAgent(this.getRandomUserAgent())
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-GB,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    })

    // Block images and fonts to speed up scraping
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      const type = req.resourceType()
      if (type === "image" || type === "font" || type === "media") {
        req.abort()
      } else {
        req.continue()
      }
    })

    return page
  }

  protected async handleCookieConsent(page: Page): Promise<void> {
    try {
      const cookieBtn = await page.$(RIGHTMOVE_SELECTORS.cookieAccept)
      if (cookieBtn) {
        await cookieBtn.click()
        await this.delay(500)
        return
      }

      const cookieBtnAlt = await page.$(RIGHTMOVE_SELECTORS.cookieAcceptAlt)
      if (cookieBtnAlt) {
        await cookieBtnAlt.click()
        await this.delay(500)
      }
    } catch {
      // Cookie consent not found or already dismissed — continue
    }
  }

  // ---- Pagination (delegates to scrapeSearchResults) ----

  protected async scrapeAllPages(
    page: Page,
    baseUrl: string,
    criteria?: ScraperCriteria
  ): Promise<string[]> {
    const allUrls: string[] = []
    let pageNum = 0
    const maxPages = criteria?.maxPages ?? 42

    while (pageNum < maxPages) {
      const paginatedUrl =
        pageNum === 0 ? baseUrl : `${baseUrl}&index=${pageNum * 24}`

      console.log(
        `${LOG_PREFIX} Scraping search page ${pageNum + 1} (index=${pageNum * 24})`
      )

      await page.goto(paginatedUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      })
      await this.handleCookieConsent(page)
      await this.delay(1000) // Let page settle

      const urls = await this.scrapeSearchResults(page, paginatedUrl)
      if (urls.length === 0) break

      allUrls.push(...urls)
      pageNum++

      // Check for next page
      const hasNext = await page.$(RIGHTMOVE_SELECTORS.paginationNext)
      if (!hasNext) break

      const isDisabled = await page.evaluate((sel) => {
        const btn = document.querySelector(sel)
        return btn?.hasAttribute("disabled") || btn?.classList.contains("disabled")
      }, RIGHTMOVE_SELECTORS.paginationNext)

      if (isDisabled) break

      await this.delay(this.randomDelay())
    }

    // Deduplicate
    return [...new Set(allUrls)]
  }

  // ---- Property save (upsert) ----

  protected async saveProperty(property: ScrapedProperty): Promise<string> {
    // ── Postcode resolution ──────────────────────────────────────────────────
    // Correct wrong or incomplete postcodes BEFORE writing to the DB.
    // Scrapers (especially Zoopla) can capture the wrong postcode:
    //   - "SE1 2LH" — Zoopla's London office address appears in the page footer
    //   - "SA6"     — outcode only (Zoopla withholds the incode for privacy)
    // We validate the stored postcode against the outcode in the display address,
    // then resolve via Land Registry data → postcodes.io as fallback.
    if (property.address?.displayAddress) {
      try {
        const resolved = await resolvePostcodeFromAddress(
          property.address.displayAddress,
          property.address.postcode ?? null
        )
        if (resolved) {
          if (resolved.corrected) {
            console.log(
              `${LOG_PREFIX} Postcode resolved for ${property.sourceId}: ` +
              `"${property.address.postcode ?? "none"}" → "${resolved.postcode}" (via ${resolved.source})`
            )
            ;(property.address as any).postcodeFixed = true
            ;(property.address as any).postcodeSource = resolved.source
          }
          property.address.postcode = resolved.postcode
        }
      } catch (err) {
        // Non-fatal — scraper continues with whatever postcode the scraper extracted
        console.warn(`${LOG_PREFIX} Postcode resolution failed for ${property.sourceId}:`, err)
      }
    }

    // Data quality warnings
    const warnings: string[] = []
    if (!property.price || property.price === 0) warnings.push("missing price")
    if (!property.title) warnings.push("missing title")
    if (property.bedrooms === 0) warnings.push("0 bedrooms")
    if (!property.address?.displayAddress) warnings.push("missing address")
    if (!property.description) warnings.push("missing description")
    if (warnings.length > 0) {
      console.warn(
        `${LOG_PREFIX} Data quality issues for ${property.sourceId}: ${warnings.join(", ")}`
      )
    }

    const existing = await prisma.propertyListing.findUnique({
      where: {
        source_sourceId: {
          source: property.source as any,
          sourceId: property.sourceId,
        },
      },
      select: { id: true, checksum: true, priceHistory: true, price: true },
    })

    if (existing) {
      if (existing.checksum === property.checksum) {
        // No changes — just update lastChecked
        await prisma.propertyListing.update({
          where: { id: existing.id },
          data: { lastChecked: new Date() },
        })
        console.log(
          `${LOG_PREFIX} Property ${property.sourceId} unchanged, updated lastChecked`
        )
        return existing.id
      }

      // Property changed — update and append to price history
      const existingHistory = (existing.priceHistory as any[]) || []
      const currentPrice = Number(existing.price)
      if (currentPrice !== property.price) {
        existingHistory.push({
          date: new Date().toISOString(),
          price: currentPrice,
          changePercent: Math.round(
            ((property.price - currentPrice) / currentPrice) * 100
          ),
        })
      }

      const updated = await prisma.propertyListing.update({
        where: { id: existing.id },
        data: {
          title: property.title,
          description: property.description,
          propertyType: property.propertyType,
          propertySubType: property.propertySubType,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
          price: property.price,
          priceHistory: existingHistory,
          address: property.address as any,
          squareFeet: property.squareFeet,
          squareMeters: property.squareMeters,
          pricePerSqFt: property.pricePerSqFt,
          commercialDetails: property.commercialDetails as any,
          bmvIndicators: property.bmvIndicators as any,
          isAmbiguous: property.isAmbiguous,
          ambiguityReasons: property.ambiguityReasons,
          images: property.images,
          floorPlans: property.floorPlans,
          agent: property.agent as any,
          status: property.status as any,
          daysOnMarket: property.daysOnMarket,
          keyFeatures: (property.keyFeatures ?? []) as any,
          epcRating: property.epcRating,
          tenure: property.tenure,
          isChainFree: property.isChainFree,
          isNewBuild: property.isNewBuild,
          isRetirement: property.isRetirement,
          leaseYearsRemaining: property.leaseYearsRemaining,
          groundRent: property.groundRent,
          serviceCharge: property.serviceCharge,
          lastChecked: new Date(),
          checksum: property.checksum,
        },
      })

      console.log(
        `${LOG_PREFIX} Property ${property.sourceId} updated (price change detected)`
      )
      this.triggerOwnershipEnrichment(updated.id, property.address?.postcode)
      return updated.id
    }

    // New property — determine review status
    let reviewStatus: "PENDING" | "AUTO_APPROVED" = "PENDING"
    if (!property.isAmbiguous) {
      if (!this.settings.requireManualReview) {
        // Manual review globally disabled — fast-track all non-ambiguous properties
        reviewStatus = "AUTO_APPROVED"
      } else if (
        this.settings.autoAnalysisEnabled &&
        this.settings.autoAnalysisThreshold != null &&
        property.bmvIndicators.bmvScore >= this.settings.autoAnalysisThreshold
      ) {
        // BMV score meets the auto-approve threshold — fast-track high-scoring properties
        reviewStatus = "AUTO_APPROVED"
        console.log(
          `${LOG_PREFIX} Auto-approved (BMV score ${property.bmvIndicators.bmvScore} ≥ threshold ${this.settings.autoAnalysisThreshold}): ${property.address?.displayAddress ?? property.sourceId}`
        )
      }
    }

    const created = await prisma.propertyListing.create({
      data: {
        sourceId: property.sourceId,
        source: property.source as any,
        category: property.category as any,
        title: property.title,
        description: property.description,
        propertyType: property.propertyType,
        propertySubType: property.propertySubType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        price: property.price,
        priceHistory: property.priceHistory as any,
        address: property.address as any,
        squareFeet: property.squareFeet,
        squareMeters: property.squareMeters,
        pricePerSqFt: property.pricePerSqFt,
        commercialDetails: property.commercialDetails as any,
        bmvIndicators: property.bmvIndicators as any,
        isAmbiguous: property.isAmbiguous,
        ambiguityReasons: property.ambiguityReasons,
        images: property.images,
        floorPlans: property.floorPlans,
        agent: property.agent as any,
        listingUrl: property.listingUrl,
        listedDate: property.listedDate,
        daysOnMarket: property.daysOnMarket,
        status: property.status as any,
        checksum: property.checksum,
        reviewStatus: reviewStatus as any,
        keyFeatures: (property.keyFeatures ?? []) as any,
        epcRating: property.epcRating,
        tenure: property.tenure,
        isChainFree: property.isChainFree,
        isNewBuild: property.isNewBuild,
        isRetirement: property.isRetirement,
        leaseYearsRemaining: property.leaseYearsRemaining,
        groundRent: property.groundRent,
        serviceCharge: property.serviceCharge,
      },
    })

    const idx = this.progress.processed + 1
    const total = this.progress.totalFound
    const priceStr = property.price ? `£${property.price.toLocaleString()}` : "£?"
    const bedsStr = property.bedrooms ? `${property.bedrooms} bed` : ""
    const bathsStr = property.bathrooms ? `${property.bathrooms} bath` : ""
    const bedBath = [bedsStr, bathsStr].filter(Boolean).join(" ") || "? bed"
    const typeStr = property.propertyType || "property"
    const addrStr = property.address?.displayAddress || property.sourceId
    const postStr = property.address?.postcode ? ` ${property.address.postcode}` : ""
    console.log(
      `${LOG_PREFIX} #${idx}/${total} | ${priceStr} | ${bedBath} | ${typeStr} | ${addrStr}${postStr} | BMV: ${property.bmvIndicators.bmvScore} | ${reviewStatus}`
    )
    this.triggerOwnershipEnrichment(created.id, property.address?.postcode)
    return created.id
  }

  /** Fire-and-forget Land Registry ownership enrichment — never blocks the scraper */
  private triggerOwnershipEnrichment(listingId: string, postcode?: string): void {
    if (!postcode) return
    enrichPropertyWithOwnership(listingId, postcode).catch((e) =>
      console.warn(
        `${LOG_PREFIX} Ownership enrichment failed for ${listingId}: ${e.message}`
      )
    )
  }

  // ---- Job progress persistence ----

  protected async updateJobProgress(): Promise<void> {
    await prisma.scraperJob.update({
      where: { id: this.progress.jobId },
      data: {
        totalFound: this.progress.totalFound,
        processed: this.progress.processed,
        successful: this.progress.successful,
        failed: this.progress.failed,
        propertiesFound: this.progress.propertiesFound,
      },
    })
  }

  // ---- Delay / rate limiting ----

  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  protected randomDelay(): number {
    return (
      this.settings.requestDelay +
      Math.floor(Math.random() * 2000)
    )
  }

  protected getRandomUserAgent(): string {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
  }
}
