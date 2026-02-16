/**
 * Debug: Zoopla Postcode Extraction
 *
 * Visits a Zoopla listing with the same stealth setup as the real scraper and
 * dumps every possible postcode source so we can see exactly what is available.
 *
 * Usage:
 *   npx tsx scripts/debug-zoopla-postcode.ts --url https://www.zoopla.co.uk/for-sale/details/NNNNN/
 *   npx tsx scripts/debug-zoopla-postcode.ts          # searches Swansea SA6 automatically
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

const targetUrl = getArg("url")
const LOG_DIR = path.join(process.cwd(), "logs")
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

async function main() {
  console.log("=".repeat(70))
  console.log("[PostcodeDebug] Zoopla Postcode Extraction Debugger")
  console.log("=".repeat(70))

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
      "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  })

  try {
    const page = await browser.newPage()

    // Same stealth patches as the real scraper
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      Object.defineProperty(navigator, "languages", { get: () => ["en-GB", "en-US", "en"] })
      const w = window as any
      w.chrome = { runtime: {}, loadTimes: function () {}, csi: function () {} }
    })
    await page.setUserAgent(USER_AGENTS[0])
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-GB,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    })

    let propertyUrl = targetUrl

    if (!propertyUrl) {
      // Search Swansea SA6 area on Zoopla to get a sample listing
      console.log("[PostcodeDebug] No --url given, searching Swansea SA6 on Zoopla...")
      const searchUrl = "https://www.zoopla.co.uk/for-sale/property/swansea/?q=swansea&price_max=200000&pn=1&page_size=10"
      console.log("[PostcodeDebug] Search URL:", searchUrl)

      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 45000 })

      // Accept cookies
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button"))
        for (const btn of btns) {
          if (/accept all/i.test(btn.textContent || "")) { btn.click(); break }
        }
      })
      await new Promise(r => setTimeout(r, 2000))

      // Extract listing IDs from __NEXT_DATA__
      const ids = await page.evaluate(() => {
        const nd = document.querySelector("#__NEXT_DATA__")
        if (!nd?.textContent) return []
        try {
          const data = JSON.parse(nd.textContent)
          const listings = data?.props?.pageProps?.regularListingsFormatted || []
          return listings.slice(0, 3).map((l: any) => l.listingId).filter(Boolean)
        } catch { return [] }
      })

      if (ids.length === 0) {
        console.log("[PostcodeDebug] No listings found via __NEXT_DATA__, trying DOM link extraction...")
        const domIds = await page.evaluate(() => {
          return Array.from(document.querySelectorAll("a[href*='/details/']"))
            .map(a => { const m = a.getAttribute("href")?.match(/\/details\/(\d+)/); return m?.[1] })
            .filter(Boolean)
            .slice(0, 3)
        })
        console.log("[PostcodeDebug] DOM extracted IDs:", domIds)
        if (domIds.length > 0) propertyUrl = `https://www.zoopla.co.uk/for-sale/details/${domIds[0]}/`
      } else {
        console.log("[PostcodeDebug] Listing IDs from search:", ids)
        propertyUrl = `https://www.zoopla.co.uk/for-sale/details/${ids[0]}/`
      }
    }

    if (!propertyUrl) {
      console.error("[PostcodeDebug] Could not get a property URL to test. Use --url flag.")
      return
    }

    console.log("\n[PostcodeDebug] Testing property URL:", propertyUrl)
    console.log("─".repeat(70))

    await page.goto(propertyUrl, { waitUntil: "networkidle2", timeout: 45000 })
    await new Promise(r => setTimeout(r, 2000))

    // Accept cookies again
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      for (const btn of btns) {
        if (/accept all/i.test(btn.textContent || "")) { btn.click(); break }
      }
    })
    await new Promise(r => setTimeout(r, 1000))

    const result = await page.evaluate(() => {
      const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/i
      const OUTCODE_RE = /\b([A-Z]{1,2}\d{1,2})\b/

      // ── 1. __NEXT_DATA__ ─────────────────────────────────────────────────
      let nextData: any = null
      let nextDataExists = false
      try {
        const nd = document.querySelector("#__NEXT_DATA__")
        if (nd?.textContent) {
          nextData = JSON.parse(nd.textContent)
          nextDataExists = true
        }
      } catch {}

      // Recursively find all address-like fields — use a stack to avoid named recursion
      // (named functions inside page.evaluate can fail due to tsx transforms)
      const nextDataAddressFields: Record<string, any> = {}
      if (nextDataExists && nextData?.props?.pageProps) {
        const stack: Array<{ obj: any; path: string; depth: number }> = [
          { obj: nextData.props.pageProps, path: "pageProps", depth: 0 },
        ]
        while (stack.length > 0) {
          const { obj, path: p, depth } = stack.pop()!
          if (!obj || typeof obj !== "object" || depth > 8) continue
          Object.keys(obj).forEach(k => {
            const v = obj[k]
            const fullPath = p + "." + k
            if (/post|outc|inc(?!lud)|addr|town|county|uprn|lati|longi|coord/i.test(k)) {
              nextDataAddressFields[fullPath] = v
            }
            if (v && typeof v === "object" && !Array.isArray(v) && depth < 7) {
              stack.push({ obj: v, path: fullPath, depth: depth + 1 })
            }
          })
        }
      }

      // ── 2. DOM address elements ──────────────────────────────────────────
      const getMeta = (prop: string) =>
        document.querySelector(`meta[property="${prop}"]`)?.getAttribute("content") ||
        document.querySelector(`meta[name="${prop}"]`)?.getAttribute("content") || ""

      const domSelectors: Record<string, string | null> = {}
      const selectors = [
        "h1",
        '[data-testid="address-label"]',
        '[data-testid="listing-address"]',
        '[data-testid="address"]',
        '[itemprop="address"]',
        ".dp-sidebar-wrapper__summary",
        ".listing-details-address",
        '[class*="address"]',
      ]
      selectors.forEach(s => {
        const el = document.querySelector(s)
        if (el) domSelectors[s] = el.textContent?.trim() || null
      })

      // ── 3. og: meta tags ─────────────────────────────────────────────────
      const ogTitle = getMeta("og:title")
      const ogDesc = getMeta("og:description")
      const ogUrl = getMeta("og:url")
      const metaDesc = getMeta("description")
      const geoLat = getMeta("place:location:latitude") || getMeta("geo.position")?.split(";")[0]
      const geoLng = getMeta("place:location:longitude") || getMeta("geo.position")?.split(";")[1]

      // ── 4. ld+json ───────────────────────────────────────────────────────
      const ldJsonItems: any[] = []
      document.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
        try { ldJsonItems.push(JSON.parse(s.textContent || "")) } catch {}
      })

      // ── 5. Full page postcode search ─────────────────────────────────────
      const fullText = document.body?.textContent || ""
      const allPostcodesInPage = Array.from(
        new Set([...fullText.matchAll(/\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/gi)].map(m => m[1].toUpperCase()))
      )

      // ── 6. Postcode from title/og ─────────────────────────────────────────
      const postcodeInTitle = (document.title || "").match(UK_POSTCODE_RE)?.[1]
      const postcodeInOgTitle = ogTitle.match(UK_POSTCODE_RE)?.[1]
      const postcodeInH1 = document.querySelector("h1")?.textContent?.match(UK_POSTCODE_RE)?.[1]
      const outcodeInH1 = document.querySelector("h1")?.textContent?.match(OUTCODE_RE)?.[1]

      // ── 7. Window objects ─────────────────────────────────────────────────
      const windowObjects: Record<string, string> = {}
      const windowKeys = ["__ZPG_LISTING__", "__LISTING_DATA__", "__PROPERTY__", "listingData", "propertyData"]
      windowKeys.forEach(k => {
        const val = (window as any)[k]
        if (val) windowObjects[k] = typeof val === "object" ? JSON.stringify(val).substring(0, 500) : String(val)
      })

      return {
        nextDataExists,
        nextDataAddressFields,
        pageTitle: document.title,
        ogTitle,
        ogDesc: ogDesc.substring(0, 200),
        ogUrl,
        metaDesc: metaDesc.substring(0, 200),
        geoLat,
        geoLng,
        domSelectors,
        ldJsonAddresses: ldJsonItems.map(l => ({ "@type": l["@type"], address: l.address, geo: l.geo })).filter(l => l.address || l.geo),
        allPostcodesInPage,
        postcodeInTitle,
        postcodeInOgTitle,
        postcodeInH1,
        outcodeInH1,
        windowObjects,
      }
    })

    console.log("\n[1] __NEXT_DATA__ exists:", result.nextDataExists)
    console.log("\n[2] __NEXT_DATA__ address fields:")
    if (Object.keys(result.nextDataAddressFields).length === 0) {
      console.log("    (none found)")
    } else {
      Object.entries(result.nextDataAddressFields).forEach(([k, v]) =>
        console.log(`    ${k}: ${JSON.stringify(v)}`)
      )
    }

    console.log("\n[3] Page/OG metadata:")
    console.log("    title:", result.pageTitle?.substring(0, 100))
    console.log("    og:title:", result.ogTitle?.substring(0, 100))
    console.log("    og:url:", result.ogUrl)
    console.log("    geo lat/lng:", result.geoLat, "/", result.geoLng)

    console.log("\n[4] DOM address selectors:")
    Object.entries(result.domSelectors).forEach(([sel, txt]) => {
      if (txt) console.log(`    ${sel}: "${txt?.substring(0, 120)}"`)
    })

    console.log("\n[5] ld+json address/geo:")
    result.ldJsonAddresses.forEach((l: any) => console.log("    ", JSON.stringify(l)))

    console.log("\n[6] ALL full postcodes found in page body:", result.allPostcodesInPage)
    console.log("\n[7] Postcode in page title:", result.postcodeInTitle)
    console.log("    Postcode in og:title:", result.postcodeInOgTitle)
    console.log("    Postcode in H1:", result.postcodeInH1)
    console.log("    Outcode in H1:", result.outcodeInH1)

    if (Object.keys(result.windowObjects).length > 0) {
      console.log("\n[8] Window objects:", result.windowObjects)
    }

    // Save full result to log file
    const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
    const logFile = path.join(LOG_DIR, `debug-zoopla-postcode-${ts}.json`)
    fs.writeFileSync(logFile, JSON.stringify({ url: propertyUrl, result }, null, 2))
    console.log("\n[PostcodeDebug] Full result saved to:", logFile)

  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error("[PostcodeDebug] Fatal:", err.message)
  process.exit(1)
})
