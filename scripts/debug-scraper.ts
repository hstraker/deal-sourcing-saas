/**
 * Scraper Data Debugger
 *
 * Scrapes 1-3 properties from a source and dumps the raw page data to
 * logs/debug-{SOURCE}-{timestamp}.json so you can inspect exactly what
 * fields are available (price, date, bedrooms, etc.).
 *
 * Usage:
 *   npx tsx scripts/debug-scraper.ts --source RIGHTMOVE
 *   npx tsx scripts/debug-scraper.ts --source ONTHEMARKET
 *   npx tsx scripts/debug-scraper.ts --source ZOOPLA
 *   npx tsx scripts/debug-scraper.ts --source PRIMELOCATION
 *   npx tsx scripts/debug-scraper.ts --url https://www.rightmove.co.uk/properties/12345
 *
 * Options:
 *   --source   RIGHTMOVE, ZOOPLA, ONTHEMARKET, PRIMELOCATION
 *   --url      Scrape a specific property URL directly
 *   --count    Number of properties to sample (default: 2)
 *   --postcode Postcode area to search in (default: B for Birmingham)
 *   --headful  Show browser window
 */

import puppeteer from "puppeteer"
import * as fs from "fs"
import * as path from "path"

function getArg(name: string, defaultValue?: string): string | undefined {
  const args = process.argv.slice(2)
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1]
  }
  return defaultValue
}

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

const source = getArg("source", "RIGHTMOVE")!.toUpperCase()
const targetUrl = getArg("url")
const sampleCount = parseInt(getArg("count", "2")!)
const postcode = getArg("postcode", "B")
const headful = hasFlag("headful")

const LOG_DIR = path.join(process.cwd(), "logs")
const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
const LOG_FILE = path.join(LOG_DIR, `debug-${source}-${timestamp}.json`)
const SUMMARY_FILE = path.join(LOG_DIR, `debug-${source}-${timestamp}-summary.txt`)

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const summaryLines: string[] = []

function log(line: string) {
  console.log(line)
  summaryLines.push(line)
}

function extractPriceFields(obj: any, prefix = "", depth = 0): Record<string, any> {
  if (!obj || typeof obj !== "object" || depth > 5) return {}
  const result: Record<string, any> = {}
  const priceKeywords = ["price", "amount", "cost", "value", "offer", "ask", "guid", "display"]
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const keyLower = key.toLowerCase()
    if (priceKeywords.some((k) => keyLower.includes(k))) {
      result[fullKey] = val
    }
    if (val && typeof val === "object" && !Array.isArray(val) && depth < 4) {
      Object.assign(result, extractPriceFields(val, fullKey, depth + 1))
    }
  }
  return result
}

function extractDateFields(obj: any, prefix = "", depth = 0): Record<string, any> {
  if (!obj || typeof obj !== "object" || depth > 5) return {}
  const result: Record<string, any> = {}
  const dateKeywords = ["date", "listed", "added", "published", "reduced", "created", "update", "first", "visible", "history"]
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    const keyLower = key.toLowerCase()
    if (dateKeywords.some((k) => keyLower.includes(k))) {
      result[fullKey] = val
    }
    if (val && typeof val === "object" && !Array.isArray(val) && depth < 4) {
      Object.assign(result, extractDateFields(val, fullKey, depth + 1))
    }
  }
  return result
}

async function getPropertyUrlsFromSearch(page: any, searchUrl: string, src: string): Promise<string[]> {
  log(`\n[Debug] Navigating to search: ${searchUrl}`)
  await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 45000 })
  await new Promise((r) => setTimeout(r, 3000))

  const urls: string[] = await page.evaluate((s: string) => {
    const links = Array.from(document.querySelectorAll("a"))
    const found: string[] = []
    for (const link of links) {
      const href = link.getAttribute("href") || ""
      if (s === "RIGHTMOVE" && /\/properties\/(\d{5,})/.test(href)) {
        const m = href.match(/\/properties\/(\d{5,})/)
        if (m) found.push(`https://www.rightmove.co.uk/properties/${m[1]}`)
      } else if ((s === "ZOOPLA" || s === "PRIMELOCATION") && /\/details\//.test(href)) {
        const base = s === "ZOOPLA" ? "https://www.zoopla.co.uk" : "https://www.primelocation.com"
        found.push(href.startsWith("http") ? href : `${base}${href}`)
      } else if (s === "ONTHEMARKET" && /\/details\/\d+/.test(href)) {
        const m = href.match(/\/details\/(\d+)/)
        if (m) found.push(`https://www.onthemarket.com/details/${m[1]}/`)
      }
    }
    return [...new Set(found)].slice(0, 5)
  }, src)

  return urls
}

async function dumpPropertyData(page: any, url: string, src: string): Promise<any> {
  log(`\n${"─".repeat(60)}`)
  log(`[Debug] Scraping: ${url}`)

  await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 })
  await new Promise((r) => setTimeout(r, 3000))

  const rawData = await page.evaluate(() => {
    const result: any = {}

    // PAGE_MODEL (Rightmove)
    try {
      const pm = (window as any).PAGE_MODEL
      if (pm) result.PAGE_MODEL = pm
    } catch {}

    // window.jsonModel (Rightmove variant)
    try {
      const jm = (window as any).jsonModel
      if (jm) result.jsonModel = jm
    } catch {}

    // __NEXT_DATA__
    try {
      const nd = document.querySelector("#__NEXT_DATA__")
      if (nd?.textContent) result.__NEXT_DATA__ = JSON.parse(nd.textContent)
    } catch {}

    // window.__OTM__
    try {
      const otm = (window as any).__OTM__
      if (otm) result.__OTM__ = otm
    } catch {}

    // ld+json
    const ldJsonScripts: any[] = []
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { ldJsonScripts.push(JSON.parse(s.textContent || "")) } catch {}
    })
    if (ldJsonScripts.length) result.ldJson = ldJsonScripts

    // og: meta tags
    const og: Record<string, string> = {}
    document.querySelectorAll("meta[property^='og:'], meta[name]").forEach((m) => {
      const prop = m.getAttribute("property") || m.getAttribute("name") || ""
      const content = m.getAttribute("content") || ""
      if (prop && content) og[prop] = content
    })
    result.meta = og

    // DOM price text
    const priceSelectors = [
      ".price", '[data-testid="price"]', "span.price-value",
      '[class*="price"]', '[data-testid*="price"]', ".listing-price", ".guide-price",
      "h1", "h2",
    ]
    const domPrices: Record<string, string> = {}
    for (const sel of priceSelectors) {
      const el = document.querySelector(sel)
      if (el?.textContent?.trim()) {
        domPrices[sel] = el.textContent.trim().substring(0, 100)
      }
    }
    result.domPrices = domPrices

    return result
  })

  return { url, source: src, data: rawData }
}

async function analyseResult(result: any) {
  const { url, source: src, data } = result

  log(`\n[ANALYSIS] ${url}`)
  log(`  Source: ${src}`)

  // --- PRICE FIELDS ---
  log(`\n  === PRICE FIELDS ===`)

  if (src === "RIGHTMOVE") {
    const pd = data.PAGE_MODEL?.propertyData || data.jsonModel?.propertyData || data.__NEXT_DATA__?.props?.pageProps?.propertyData
    if (pd) {
      log(`  PAGE_MODEL.propertyData found ✓`)
      const priceFields = extractPriceFields(pd, "propertyData")
      if (Object.keys(priceFields).length > 0) {
        for (const [k, v] of Object.entries(priceFields)) {
          log(`    ${k}: ${JSON.stringify(v)}`)
        }
      } else {
        log(`    (no price fields found in propertyData)`)
      }
    } else {
      log(`  PAGE_MODEL.propertyData NOT found`)
      if (data.PAGE_MODEL) log(`  PAGE_MODEL keys: ${Object.keys(data.PAGE_MODEL).join(", ")}`)
      if (data.__NEXT_DATA__) log(`  __NEXT_DATA__.props.pageProps keys: ${Object.keys(data.__NEXT_DATA__?.props?.pageProps || {}).join(", ")}`)
    }
  } else {
    // Zoopla / OTM / PrimeLocation
    const pageProps = data.__NEXT_DATA__?.props?.pageProps
    const otm = data.__OTM__

    if (pageProps) {
      log(`  __NEXT_DATA__.props.pageProps found ✓`)
      log(`  pageProps keys: ${Object.keys(pageProps).join(", ")}`)
      const priceFields = extractPriceFields(pageProps, "pageProps")
      if (Object.keys(priceFields).length > 0) {
        for (const [k, v] of Object.entries(priceFields)) {
          log(`    ${k}: ${JSON.stringify(v)}`)
        }
      } else {
        log(`    (no price fields found in pageProps)`)
      }
    }
    if (otm) {
      log(`  __OTM__ found ✓`)
      const priceFields = extractPriceFields(otm, "__OTM__")
      for (const [k, v] of Object.entries(priceFields)) {
        log(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
    if (!pageProps && !otm) {
      log(`  No embedded JSON data found`)
    }
  }

  // DOM price fallback
  log(`  DOM price selectors:`)
  for (const [sel, text] of Object.entries(data.domPrices || {})) {
    if (String(text).includes("£") || String(text).match(/\d{3,}/)) {
      log(`    [${sel}]: "${text}"`)
    }
  }

  // ld+json price
  for (const ld of data.ldJson || []) {
    if (ld.offers?.price || ld.price) {
      log(`  ld+json price: ${JSON.stringify(ld.offers?.price || ld.price)}`)
    }
  }

  // --- DATE FIELDS ---
  log(`\n  === DATE FIELDS ===`)

  if (src === "RIGHTMOVE") {
    const pd = data.PAGE_MODEL?.propertyData || data.jsonModel?.propertyData
    if (pd) {
      const dateFields = extractDateFields(pd, "propertyData")
      if (Object.keys(dateFields).length > 0) {
        for (const [k, v] of Object.entries(dateFields)) {
          log(`    ${k}: ${JSON.stringify(v)}`)
        }
      } else {
        log(`    (no date fields found in propertyData)`)
      }
    }
  } else {
    const pageProps = data.__NEXT_DATA__?.props?.pageProps
    const otm = data.__OTM__
    if (pageProps) {
      const dateFields = extractDateFields(pageProps, "pageProps")
      for (const [k, v] of Object.entries(dateFields)) {
        log(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
    if (otm) {
      const dateFields = extractDateFields(otm, "__OTM__")
      for (const [k, v] of Object.entries(dateFields)) {
        log(`    ${k}: ${JSON.stringify(v)}`)
      }
    }
  }

  // --- META ---
  const ogPrice = data.meta?.["og:price:amount"] || data.meta?.["product:price:amount"]
  if (ogPrice) log(`  og:price:amount: ${ogPrice}`)
}

async function main() {
  log(`${"=".repeat(60)}`)
  log(`[Debug] Scraper Data Debugger`)
  log(`[Debug] Source:    ${source}`)
  log(`[Debug] Sample:    ${targetUrl ? "specific URL" : `${sampleCount} properties`}`)
  log(`[Debug] Log file:  ${LOG_FILE}`)
  log(`${"=".repeat(60)}`)

  const browser = await puppeteer.launch({
    headless: !headful,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  })

  const allResults: any[] = []

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    )
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-GB,en;q=0.9" })

    // Accept cookies helper
    const acceptCookies = async () => {
      try {
        await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll("button"))
          for (const btn of buttons) {
            const text = (btn.textContent || "").toLowerCase().trim()
            if (text.includes("accept all") || text.includes("accept cookies") || text === "agree") {
              ;(btn as HTMLButtonElement).click()
              return true
            }
          }
        })
        await new Promise((r) => setTimeout(r, 1000))
      } catch {}
    }

    let propertyUrls: string[] = []

    if (targetUrl) {
      propertyUrls = [targetUrl]
    } else {
      // Build search URL and get a few property URLs
      const searchUrls: Record<string, string> = {
        RIGHTMOVE: `https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=OUTCODE%5E2245&maxPages=1&sortType=6`,
        ZOOPLA: `https://www.zoopla.co.uk/for-sale/property/birmingham/?q=birmingham&results_per_page=10`,
        ONTHEMARKET: `https://www.onthemarket.com/for-sale/property/birmingham/`,
        PRIMELOCATION: `https://www.primelocation.com/for-sale/property/birmingham/`,
      }

      const searchUrl = searchUrls[source]
      if (!searchUrl) {
        console.error(`Unknown source: ${source}`)
        process.exit(1)
      }

      await acceptCookies()
      propertyUrls = await getPropertyUrlsFromSearch(page, searchUrl, source)
      await acceptCookies()
      propertyUrls = propertyUrls.slice(0, sampleCount)
    }

    log(`\n[Debug] Will scrape ${propertyUrls.length} property URL(s):`)
    for (const u of propertyUrls) log(`  ${u}`)

    for (const url of propertyUrls) {
      try {
        await acceptCookies()
        const result = await dumpPropertyData(page, url, source)
        allResults.push(result)
        await analyseResult(result)
        await new Promise((r) => setTimeout(r, 2000))
      } catch (err: any) {
        log(`[Debug] Error scraping ${url}: ${err.message}`)
      }
    }
  } finally {
    await browser.close()
  }

  // Write full raw data dump to JSON file
  fs.writeFileSync(LOG_FILE, JSON.stringify(allResults, null, 2), "utf8")

  // Write summary to text file
  fs.writeFileSync(SUMMARY_FILE, summaryLines.join("\n"), "utf8")

  log(`\n${"=".repeat(60)}`)
  log(`[Debug] Done!`)
  log(`  Full raw data: ${LOG_FILE}`)
  log(`  Summary:       ${SUMMARY_FILE}`)
  log(`${"=".repeat(60)}`)
}

main().catch((err) => {
  console.error("[Debug] Fatal:", err.message)
  process.exit(1)
})
