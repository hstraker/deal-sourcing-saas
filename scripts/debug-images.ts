/**
 * Diagnostic: Dump image-related fields from Zoopla and PrimeLocation __NEXT_DATA__
 *
 * Usage:
 *   npx tsx scripts/debug-images.ts                          # auto-picks a Zoopla listing
 *   npx tsx scripts/debug-images.ts --source primelocation   # auto-picks a PL listing
 *   npx tsx scripts/debug-images.ts --url https://www.zoopla.co.uk/for-sale/details/XXXXX/
 *   npx tsx scripts/debug-images.ts --url https://www.primelocation.com/for-sale/details/XXXXX/
 */

import puppeteer from "puppeteer"
import * as fs from "fs"
import * as path from "path"

function getArg(name: string): string | undefined {
  const args = process.argv.slice(2)
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) return args[idx + 1]
  return undefined
}

const targetUrl = getArg("url")
const source = (getArg("source") || "zoopla").toLowerCase()
const LOG_DIR = path.join(process.cwd(), "logs")
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

// Walk an object tree and collect every key that looks image-related or
// whose value is an array of strings/objects
function findImageFields(obj: any, currentPath: string, depth = 0): Array<{ path: string; type: string; sample: any }> {
  if (!obj || typeof obj !== "object" || depth > 8) return []
  const results: Array<{ path: string; type: string; sample: any }> = []
  for (const k of Object.keys(obj)) {
    const v = obj[k]
    const fullPath = `${currentPath}.${k}`
    const isImageKey = /image|photo|picture|gallery|media|thumb|hero/i.test(k)
    if (Array.isArray(v)) {
      if (isImageKey || (v.length > 0 && typeof v[0] === "string" && v[0].startsWith("http"))) {
        results.push({ path: fullPath, type: `Array(${v.length})`, sample: v.slice(0, 3) })
      }
      // Also recurse into arrays of objects (shallow)
      if (v.length > 0 && v[0] && typeof v[0] === "object" && isImageKey) {
        results.push({ path: fullPath + "[0]_keys", type: "ObjectKeys", sample: Object.keys(v[0]) })
      }
    } else if (isImageKey && v !== null && v !== undefined) {
      results.push({ path: fullPath, type: typeof v, sample: typeof v === "string" ? v.substring(0, 200) : JSON.stringify(v).substring(0, 200) })
    }
    if (v && typeof v === "object" && !Array.isArray(v) && depth < 7) {
      results.push(...findImageFields(v, fullPath, depth + 1))
    }
  }
  return results
}

async function main() {
  console.log("=".repeat(70))
  console.log(`[ImageDebug] Source: ${source}`)
  console.log("=".repeat(70))

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage",
      "--disable-gpu", "--disable-blink-features=AutomationControlled", "--window-size=1920,1080",
    ],
    defaultViewport: { width: 1920, height: 1080 },
  })

  try {
    const page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      Object.defineProperty(navigator, "languages", { get: () => ["en-GB", "en-US", "en"] })
      ;(window as any).chrome = { runtime: {}, loadTimes: function () {}, csi: function () {} }
    })
    await page.setUserAgent(USER_AGENT)
    await page.setExtraHTTPHeaders({ "Accept-Language": "en-GB,en;q=0.9" })

    let propertyUrl = targetUrl

    if (!propertyUrl) {
      const ispl = source === "primelocation"
      const searchUrl = ispl
        ? "https://www.primelocation.com/for-sale/property/swansea/?q=swansea&price_max=300000&pn=1&page_size=10"
        : "https://www.zoopla.co.uk/for-sale/property/swansea/?q=swansea&price_max=300000&pn=1&page_size=10"
      const baseUrl = ispl ? "https://www.primelocation.com" : "https://www.zoopla.co.uk"

      console.log(`[ImageDebug] Searching: ${searchUrl}`)
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 45000 })
      // accept cookies
      const accepted = await page.evaluate(function() {
        var btns = Array.from(document.querySelectorAll("button"))
        for (var i = 0; i < btns.length; i++) {
          if (/accept all/i.test(btns[i].textContent || "")) { btns[i].click(); return true }
        }
        return false
      })
      if (accepted) await new Promise(r => setTimeout(r, 1500))

      // Pull raw __NEXT_DATA__ text for parsing in Node.js
      const rawText = await page.evaluate(function() {
        var nd = document.querySelector("#__NEXT_DATA__")
        return nd ? nd.textContent : null
      })
      if (rawText) {
        try {
          const data = JSON.parse(rawText)
          const listings = data?.props?.pageProps?.regularListingsFormatted || []
          const ids = listings.slice(0, 3).map((l: any) => l.listingId).filter(Boolean)
          if (ids.length > 0) {
            propertyUrl = `${baseUrl}/for-sale/details/${ids[0]}/`
            console.log(`[ImageDebug] Picked listing ID ${ids[0]}`)
          }
        } catch {}
      }
      if (!propertyUrl) {
        const href = await page.evaluate(function() {
          var a = document.querySelector("a[href*='/details/']")
          return a ? a.getAttribute("href") : null
        })
        if (href) {
          const m = href.match(/\/details\/(\d+)/)
          if (m) propertyUrl = `${baseUrl}/for-sale/details/${m[1]}/`
        }
      }
    }

    if (!propertyUrl) {
      console.error("[ImageDebug] Could not find a listing URL. Use --url flag.")
      return
    }

    console.log(`\n[ImageDebug] Visiting: ${propertyUrl}`)
    console.log("─".repeat(70))

    await page.goto(propertyUrl, { waitUntil: "networkidle2", timeout: 45000 })
    await page.evaluate(function() {
      var btns = Array.from(document.querySelectorAll("button"))
      for (var i = 0; i < btns.length; i++) {
        if (/accept all/i.test(btns[i].textContent || "")) { btns[i].click(); break }
      }
    })
    await new Promise(r => setTimeout(r, 2000))

    // Pull just the raw strings from the page — NO TypeScript in evaluate, NO arrow functions
    const rawPageData = await page.evaluate(function() {
      var nextDataEl = document.querySelector("#__NEXT_DATA__")
      var nextDataText = nextDataEl ? nextDataEl.textContent : null

      var metaOgImage = document.querySelector('meta[property="og:image"]')
      var ogImageContent = metaOgImage ? (metaOgImage as HTMLMetaElement).content : ""

      var imgEls = Array.from(document.querySelectorAll("img"))
      var domImages: string[] = []
      for (var i = 0; i < imgEls.length; i++) {
        var src = (imgEls[i] as HTMLImageElement).src || imgEls[i].getAttribute("data-src") || ""
        if (src && src.indexOf("http") === 0 && src.indexOf("logo") === -1) domImages.push(src)
      }

      return { nextDataText, ogImage: ogImageContent, domImages: domImages.slice(0, 10) }
    })

    console.log(`\n[1] og:image: ${rawPageData.ogImage || "(none)"}`)
    console.log(`[2] DOM <img> count: ${rawPageData.domImages.length}`)
    rawPageData.domImages.slice(0, 5).forEach((s: string) => console.log(`    ${s.substring(0, 100)}`))
    console.log(`[3] __NEXT_DATA__ found: ${!!rawPageData.nextDataText} (${rawPageData.nextDataText?.length ?? 0} chars)`)

    if (!rawPageData.nextDataText) {
      console.log("[ImageDebug] No __NEXT_DATA__ — only DOM fallback available.")
      return
    }

    // Parse in Node.js — no browser context issues
    const nextData = JSON.parse(rawPageData.nextDataText)
    const pp = nextData?.props?.pageProps || {}

    console.log(`\n[4] pageProps top-level keys: [${Object.keys(pp).join(", ")}]`)

    // ── Known listing data paths ──────────────────────────────────────────
    const knownPaths = [
      ["listingDetails",       (p: any) => p.listingDetails],
      ["data.listing",         (p: any) => p.data?.listing],
      ["listing",              (p: any) => p.listing],
      ["listingDetail",        (p: any) => p.listingDetail],
      ["data.listingDetails",  (p: any) => p.data?.listingDetails],
      ["propertyDetails",      (p: any) => p.propertyDetails],
      ["data.propertyDetails", (p: any) => p.data?.propertyDetails],
    ] as const

    console.log(`\n[5] Known listing data paths:`)
    let listingData: any = null
    for (const [label, getter] of knownPaths) {
      const val = getter(pp)
      if (val) {
        console.log(`    ${label}: FOUND — keys: [${Object.keys(val).slice(0, 25).join(", ")}]`)
        if (!listingData) listingData = val
      } else {
        console.log(`    ${label}: not found`)
      }
    }

    // ── Image fields inside listing data ─────────────────────────────────
    console.log(`\n[6] Image fields inside listing data (${listingData ? "found" : "NOT FOUND"}):`)
    if (listingData) {
      const imgKeys = ["images", "propertyImages", "propertyImage", "gallery", "media",
                       "photos", "pictures", "imageUrls", "imageList"]
      let anyFound = false
      for (const k of imgKeys) {
        if (listingData[k] !== undefined) {
          anyFound = true
          const v = listingData[k]
          if (Array.isArray(v)) {
            console.log(`    "${k}": Array(${v.length}) — first item: ${JSON.stringify(v[0]).substring(0, 300)}`)
            if (v.length > 0 && typeof v[0] === "object") {
              console.log(`        keys of item[0]: [${Object.keys(v[0]).join(", ")}]`)
            }
          } else {
            console.log(`    "${k}": ${JSON.stringify(v).substring(0, 200)}`)
          }
        }
      }
      if (!anyFound) console.log("    (none of the expected image keys found in listing data)")
    }

    // ── Walk full pageProps tree for any image-like arrays ────────────────
    console.log(`\n[7] All image-related fields found anywhere in pageProps tree:`)
    const imageFields = findImageFields(pp, "pageProps")
    if (imageFields.length === 0) {
      console.log("    (none found)")
    } else {
      for (const f of imageFields) {
        console.log(`    PATH: ${f.path}`)
        console.log(`    TYPE: ${f.type}`)
        console.log(`    SAMPLE: ${JSON.stringify(f.sample).substring(0, 400)}`)
        console.log()
      }
    }

    // ── Save full pageProps to disk for manual inspection ─────────────────
    const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
    const logFile = path.join(LOG_DIR, `debug-images-${source}-${ts}.json`)
    // Save the whole pageProps (can be large) — truncate deep arrays to save space
    const saveable = JSON.parse(JSON.stringify(pp, (key, val) => {
      if (Array.isArray(val) && val.length > 20) return val.slice(0, 20)
      return val
    }))
    fs.writeFileSync(logFile, JSON.stringify({ url: propertyUrl, pageProps: saveable }, null, 2))
    console.log(`\n[ImageDebug] Full pageProps saved to: ${logFile}`)

  } finally {
    await browser.close()
  }
}

main().catch(err => {
  console.error("[ImageDebug] Fatal:", err.message)
  process.exit(1)
})
