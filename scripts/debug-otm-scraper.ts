/**
 * OTM Scraper Debug Log
 *
 * Scrapes 1-3 OTM properties and writes a detailed log to
 *   logs/debug-otm-scraper-{timestamp}.log
 *
 * Usage:
 *   npx tsx scripts/debug-otm-scraper.ts
 *   npx tsx scripts/debug-otm-scraper.ts --url https://www.onthemarket.com/details/12345678/
 *   npx tsx scripts/debug-otm-scraper.ts --count 3
 */

import puppeteer from "puppeteer"
import * as fs from "fs"
import * as path from "path"

const LOG_DIR = path.join(process.cwd(), "logs")
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19)
const LOG_FILE = path.join(LOG_DIR, `debug-otm-scraper-${ts}.log`)

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  fs.appendFileSync(LOG_FILE, line + "\n")
}

function logJson(label: string, obj: unknown) {
  log(`${label}:\n${JSON.stringify(obj, null, 2)}`)
}

// Replicate parseOtmReduxProperty date logic in Node (no browser context issues)
function simulateDateResolution(
  reduxProp: Record<string, unknown> | null,
  ldJsonDatePosted: string | null,
  addedOnText: string | null
): { daysOnMarket: number; resolvedBy: string } {
  const tryDate = (raw: unknown): number | null => {
    if (!raw || typeof raw !== "string") return null
    const d = new Date(raw)
    if (isNaN(d.getTime())) return null
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)))
  }

  const candidates: Array<[string, unknown]> = [
    ["data.listedOn",      reduxProp?.listedOn],
    ["data.addedOn",       reduxProp?.addedOn],
    ["data.publishedDate", reduxProp?.publishedDate],
    ["data.addedDate",     reduxProp?.addedDate],
    ["data.firstListed",   reduxProp?.firstListed],
    ["data.dateAdded",     reduxProp?.dateAdded],
    ["ldJsonDatePosted",   ldJsonDatePosted],
  ]

  for (const [name, val] of candidates) {
    const days = tryDate(val)
    if (days !== null) {
      return { daysOnMarket: days, resolvedBy: name }
    }
  }

  // DOM addedOnText
  if (addedOnText) {
    const cleaned = addedOnText.replace(/(\d+)(?:st|nd|rd|th)/gi, "$1")
    const days = tryDate(cleaned)
    if (days !== null) {
      return { daysOnMarket: days, resolvedBy: `addedOnText DOM: "${addedOnText}" → cleaned: "${cleaned}"` }
    }
  }

  // daysSinceAddedReduced fallback
  const ds = String(reduxProp?.daysSinceAddedReduced || "")
  if (/today/i.test(ds))     return { daysOnMarket: 0, resolvedBy: `daysSinceAddedReduced="today"` }
  if (/yesterday/i.test(ds)) return { daysOnMarket: 1, resolvedBy: `daysSinceAddedReduced="yesterday"` }
  const gt = ds.match(/>\s*(\d+)/)
  if (gt) {
    const n = -parseInt(gt[1])
    return { daysOnMarket: n, resolvedBy: `daysSinceAddedReduced minimum "${ds}" → stored as ${n}` }
  }
  const ex = ds.match(/(\d+)/)
  if (ex) {
    const n = parseInt(ex[1])
    return { daysOnMarket: n, resolvedBy: `daysSinceAddedReduced exact "${ds}" → ${n}` }
  }

  return { daysOnMarket: 0, resolvedBy: "no date found → 0 (shows --)" }
}

const cliArgs = process.argv.slice(2)
const urlArg = cliArgs.find(a => a.startsWith("http")) ?? null
const countIdx = cliArgs.indexOf("--count")
const countArg = countIdx !== -1 ? parseInt(cliArgs[countIdx + 1] ?? "2") : 2

;(async () => {
  log("=== OTM Scraper Debug ===")
  log(`Log file: ${LOG_FILE}`)

  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] })
  const page = await browser.newPage()
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  )

  const propertyUrls: string[] = []

  if (urlArg) {
    propertyUrls.push(urlArg)
  } else {
    log("No URL given — searching OTM Birmingham...")
    await page.goto(
      "https://www.onthemarket.com/for-sale/property/birmingham/?page_size=12&view=list",
      { waitUntil: "networkidle2", timeout: 45000 }
    )
    await new Promise(r => setTimeout(r, 2000))

    const found: string[] = await page.evaluate(function () {
      return Array.from(document.querySelectorAll("a[href*='/details/']"))
        .map(function (a) { return a.getAttribute("href") })
        .filter(function (h) { return !!h && h.indexOf("/details/") !== -1 })
        .map(function (h) { return h!.startsWith("http") ? h! : "https://www.onthemarket.com" + h! })
        .filter(function (v, i, arr) { return arr.indexOf(v) === i })
        .slice(0, 4)
    })

    propertyUrls.push(...found.slice(0, countArg))
    log(`Found ${propertyUrls.length} property URLs`)
    propertyUrls.forEach(u => log(`  • ${u}`))
  }

  for (const url of propertyUrls) {
    log(`\n${"=".repeat(70)}`)
    log(`SCRAPING: ${url}`)
    log("=".repeat(70))

    await page.goto(url, { waitUntil: "networkidle2", timeout: 45000 })
    await new Promise(r => setTimeout(r, 2000))

    // ── Extract all raw data from page (no TypeScript inside evaluate) ──
    const raw = await page.evaluate(function () {
      // Parse __NEXT_DATA__
      var nextScript = document.querySelector("#__NEXT_DATA__")
      var reduxProp = null
      var pagePropsKeys: string[] = []
      var parseError = null
      if (nextScript && nextScript.textContent) {
        try {
          var parsed = JSON.parse(nextScript.textContent)
          reduxProp = (parsed && parsed.props && parsed.props.initialReduxState && parsed.props.initialReduxState.property) || null
          var pp = (parsed && parsed.props && parsed.props.pageProps) || {}
          pagePropsKeys = Object.keys(pp)
        } catch (e: any) {
          parseError = e.message
        }
      }

      // All redux keys
      var allReduxKeys = reduxProp ? Object.keys(reduxProp) : []

      // Date-related fields
      var dateFields: Record<string, unknown> = {}
      for (var i = 0; i < allReduxKeys.length; i++) {
        var k = allReduxKeys[i]
        if (/date|time|added|listed|since|reduced|published|created|updated/i.test(k)) {
          dateFields[k] = (reduxProp as any)[k]
        }
      }

      // ld+json
      var ldJsonAll: unknown[] = []
      var ldJsonDatePosted = null
      var scripts = document.querySelectorAll("script[type='application/ld+json']")
      for (var j = 0; j < scripts.length; j++) {
        try {
          var d = JSON.parse(scripts[j].textContent || "")
          ldJsonAll.push(d)
          if ((d["@type"] === "RealEstateListing" || d["@type"] === "Residence" || d.offers) && d.datePosted) {
            ldJsonDatePosted = d.datePosted
          }
        } catch (_) {}
      }

      // Body text scan
      var bodyText = (document.body && document.body.textContent) ? document.body.textContent : ""
      var addedOnMatch = bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}(?:st|nd|rd|th)?\s+\w{3,12}\s+\d{4}|\d{1,2}\/\d{2}\/\d{4})/i)
      var addedOnText = addedOnMatch ? addedOnMatch[1] : null

      var addedIdx = bodyText.toLowerCase().indexOf("added")
      var addedContext = addedIdx >= 0 ? bodyText.substring(Math.max(0, addedIdx - 30), addedIdx + 120) : null

      var dateLines: string[] = []
      var lines = bodyText.split("\n")
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li].trim()
        if (/\b(added|reduced)\b/i.test(line) && line.length < 200) {
          dateLines.push(line)
          if (dateLines.length >= 10) break
        }
      }

      return {
        hasReduxProp: !!reduxProp,
        allReduxKeys: allReduxKeys,
        pagePropsKeys: pagePropsKeys,
        parseError: parseError,
        dateFields: dateFields,
        reduxProp: reduxProp,
        ldJsonAll: ldJsonAll,
        ldJsonDatePosted: ldJsonDatePosted,
        addedOnText: addedOnText,
        addedContext: addedContext,
        dateLines: dateLines,
      }
    })

    log(`Has redux prop: ${raw.hasReduxProp}`)
    log(`All redux keys: ${raw.allReduxKeys.join(", ")}`)
    log(`pageProps keys: [${raw.pagePropsKeys.join(", ")}]`)
    if (raw.parseError) log(`PARSE ERROR: ${raw.parseError}`)

    log("\n--- Date-related redux fields ---")
    logJson("dateFields", raw.dateFields)

    log("\n--- All date candidate values ---")
    const reduxProp = raw.reduxProp as Record<string, unknown> | null
    logJson("candidates", {
      "data.listedOn":          reduxProp?.listedOn,
      "data.addedOn":           reduxProp?.addedOn,
      "data.publishedDate":     reduxProp?.publishedDate,
      "data.addedDate":         reduxProp?.addedDate,
      "data.firstListed":       reduxProp?.firstListed,
      "data.dateAdded":         reduxProp?.dateAdded,
      "ldJsonDatePosted":       raw.ldJsonDatePosted,
      "addedOnText (DOM)":      raw.addedOnText,
      "daysSinceAddedReduced":  reduxProp?.daysSinceAddedReduced,
      "recentlyAdded":          reduxProp?.recentlyAdded,
    })

    log("\n--- ld+json on page ---")
    logJson("ldJson", raw.ldJsonAll)

    log("\n--- DOM body text scan ---")
    log(`addedOnText:  ${raw.addedOnText ?? "NOT FOUND"}`)
    log(`addedContext: ${raw.addedContext ?? "NOT FOUND"}`)
    log(`dateLines (${raw.dateLines.length}):`)
    raw.dateLines.forEach((l: string) => log(`  • ${l}`))

    // ── Simulate the scraper's date resolution logic ──
    const { daysOnMarket, resolvedBy } = simulateDateResolution(
      reduxProp,
      raw.ldJsonDatePosted as string | null,
      raw.addedOnText as string | null
    )

    log("\n--- RESULT ---")
    log(`Resolved by:   ${resolvedBy}`)
    log(`daysOnMarket:  ${daysOnMarket}`)
    if (daysOnMarket > 0)       log(`UI will show:  "${daysOnMarket} days on market"`)
    else if (daysOnMarket < 0)  log(`UI will show:  "${Math.abs(daysOnMarket)}+ days on market"`)
    else                        log(`UI will show:  "— days on market"`)
  }

  await browser.close()

  log(`\n${"=".repeat(70)}`)
  log(`Debug complete. Log: ${LOG_FILE}`)
  console.log(`\nFull log written to: ${LOG_FILE}`)
})()
