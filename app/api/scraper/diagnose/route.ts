/**
 * POST /api/scraper/diagnose
 *
 * Diagnostic endpoint — launches a real browser, builds the search URLs for a
 * given source/category/location, fetches the first search page, counts property
 * links, and optionally scrapes the first detail page.
 *
 * Admin-only. Intended for debugging why a portal/category combination returns 0.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { RightmoveScraper } from "@/lib/scrapers/rightmove-scraper"
import { ZooplaScraper } from "@/lib/scrapers/zoopla-scraper"
import { OnTheMarketScraper } from "@/lib/scrapers/onthemarket-scraper"
import { PrimeLocationScraper } from "@/lib/scrapers/primelocation-scraper"
import type { ScraperCriteria, ScraperSettingsData } from "@/lib/scrapers/types"

// Lightweight settings for diagnostic runs — no proxy, low delays
const DIAG_SETTINGS: ScraperSettingsData = {
  enabled: true,
  scheduleType: "TWICE_DAILY",
  rightmoveEnabled: true,
  zooplaEnabled: true,
  onthemarketEnabled: true,
  primelocationEnabled: true,
  autoAnalysisEnabled: false,
  requireManualReview: false,
  requestDelay: 1000,
  maxConcurrent: 1,
  useProxy: false,
  headful: false,
}

type Source = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

function makeScraper(source: Source) {
  const jobId = "diagnose-" + Date.now()
  switch (source) {
    case "RIGHTMOVE":    return new RightmoveScraper(DIAG_SETTINGS, jobId)
    case "ZOOPLA":       return new ZooplaScraper(DIAG_SETTINGS, jobId)
    case "ONTHEMARKET":  return new OnTheMarketScraper(DIAG_SETTINGS, jobId)
    case "PRIMELOCATION": return new PrimeLocationScraper(DIAG_SETTINGS, jobId)
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await request.json()
  const {
    source,
    category = "COMMERCIAL",
    location,
    minPrice,
    maxPrice,
    addedSince,
    testDetailPage = false,
  } = body

  if (!source || !location?.outcode || !location?.displayName) {
    return NextResponse.json({ error: "source, location.outcode and location.displayName are required" }, { status: 400 })
  }

  const logs: string[] = []
  const log = (msg: string) => { logs.push(`[${new Date().toISOString().slice(11, 23)}] ${msg}`) }
  const startMs = Date.now()

  const criteria: ScraperCriteria = {
    category,
    locations: [location],
    ...(minPrice && { minPrice }),
    ...(maxPrice && { maxPrice }),
    ...(addedSince && { addedSince }),
    maxPages: 1,
  }

  const scraper = makeScraper(source as Source)

  // ── Step 1: Build URLs ──────────────────────────────────────────────────────
  log(`Building search URLs for ${source} | category=${category} | location=${location.displayName}`)
  const searchUrls = scraper.buildSearchUrls(criteria)
  log(`Built ${searchUrls.length} URL(s): ${searchUrls.join(" | ")}`)

  if (searchUrls.length === 0) {
    return NextResponse.json({
      success: false,
      searchUrls: [],
      searchResults: [],
      logs,
      duration: Date.now() - startMs,
      summary: "No URLs were built — portal may not support this category, or no slug found for location",
    })
  }

  // ── Step 2: Launch browser ──────────────────────────────────────────────────
  log("Launching headless browser...")
  try {
    await scraper.initialize()
    log("Browser launched OK")
  } catch (err: any) {
    log(`Browser launch FAILED: ${err.message}`)
    return NextResponse.json({
      success: false,
      searchUrls,
      searchResults: [],
      logs,
      duration: Date.now() - startMs,
      summary: `Browser launch failed: ${err.message}`,
    })
  }

  // ── Step 3: Fetch each search URL ──────────────────────────────────────────
  const searchResults: Array<{
    url: string
    propertyLinksFound: number
    sampleLinks: string[]
    httpStatus?: number
    pageTitle?: string
    pageSnippet?: string
    error?: string
  }> = []

  let firstDetailUrl: string | undefined

  for (const url of searchUrls.slice(0, 3)) {
    log(`Fetching search page: ${url}`)
    try {
      const page = await (scraper as any).createPage()
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 })
      const httpStatus = response?.status()
      log(`HTTP ${httpStatus} — waiting for page to settle...`)
      await page.waitForTimeout(2000)

      // Try cookie consent
      try { await (scraper as any).handleCookieConsent?.(page) } catch {}
      try { await (scraper as any).handleZooplaCookieConsent?.(page) } catch {}

      const pageTitle = await page.title().catch(() => "(no title)")
      log(`Page title: "${pageTitle}"`)

      // Detect bot/block pages
      const bodyText = (await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? "").catch(() => "")) as string
      const isBlocked = /robot|captcha|blocked|access denied|cloudflare|403|verify you are human/i.test(bodyText + pageTitle)
      if (isBlocked) log("⚠️  Bot detection / block page detected!")

      // Extract property links
      const links: string[] = await scraper.scrapeSearchResults(page, url).catch(() => [])
      log(`Extracted ${links.length} property link(s)`)

      if (!firstDetailUrl && links.length > 0) firstDetailUrl = links[0]

      // Grab a short snippet of visible text for diagnosis
      const pageSnippet = bodyText.slice(0, 300).replace(/\s+/g, " ")

      searchResults.push({
        url,
        propertyLinksFound: links.length,
        sampleLinks: links.slice(0, 5),
        httpStatus,
        pageTitle,
        pageSnippet,
      })

      await page.close().catch(() => {})
    } catch (err: any) {
      log(`Error fetching ${url}: ${err.message}`)
      searchResults.push({ url, propertyLinksFound: 0, sampleLinks: [], error: err.message })
    }
  }

  // ── Step 4: Optional detail page test ─────────────────────────────────────
  let detailSample: { url: string; extracted: any; error?: string } | undefined

  if (testDetailPage && firstDetailUrl) {
    log(`Testing detail page: ${firstDetailUrl}`)
    try {
      const page = await (scraper as any).createPage()
      const property = await scraper.scrapePropertyDetail(page, firstDetailUrl)
      await page.close().catch(() => {})
      log(`Detail page OK — title="${property.title}" price=${property.price} category=${property.category}`)
      detailSample = {
        url: firstDetailUrl,
        extracted: {
          title: property.title,
          price: property.price,
          category: property.category,
          propertyType: property.propertyType,
          description: property.description?.slice(0, 200),
          address: property.address,
          bedrooms: property.bedrooms,
          source: property.source,
        },
      }
    } catch (err: any) {
      log(`Detail page FAILED: ${err.message}`)
      detailSample = { url: firstDetailUrl, extracted: null, error: err.message }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────────
  try { await (scraper as any).browser?.close() } catch {}
  log("Browser closed")

  const totalFound = searchResults.reduce((s, r) => s + r.propertyLinksFound, 0)
  const summary = totalFound === 0
    ? `Found 0 property links across ${searchResults.length} search page(s). ` +
      (searchResults.some(r => r.error) ? "Errors encountered — see details." :
       searchResults.some(r => /captcha|blocked|robot/i.test(r.pageTitle ?? "")) ? "Bot detection likely." :
       "Page loaded but no matching selectors found — URL format or selectors may be wrong.")
    : `Found ${totalFound} property link(s) across ${searchResults.length} page(s). Scraper is working.`

  log(`Done — ${summary}`)

  return NextResponse.json({
    success: totalFound > 0,
    searchUrls,
    searchResults,
    detailSample,
    logs,
    duration: Date.now() - startMs,
    summary,
  })
}
