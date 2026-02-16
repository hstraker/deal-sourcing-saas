/**
 * Manual Rightmove Test Script
 *
 * Tests whether Rightmove allows scraping by navigating to a search page
 * and logging exactly what the browser sees.
 *
 * Usage:
 *   npx tsx scripts/test-rightmove.ts
 *
 * What this checks:
 * 1. Does the page load at all?
 * 2. Is there a captcha/challenge page?
 * 3. Does window.jsonModel or PAGE_MODEL exist?
 * 4. Are there any property links in the HTML?
 * 5. What does the raw HTML response contain?
 */

import puppeteer from "puppeteer"

const SEARCH_URL =
  "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=OUTCODE%5E2245&sortType=6&includeSSTC=false"

const DETAIL_URL = "https://www.rightmove.co.uk/properties/154640646"

async function testRightmove() {
  console.log("=== Rightmove Scraping Test ===\n")

  const browser = await puppeteer.launch({
    headless: true,
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

  const page = await browser.newPage()

  // Stealth patches
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
    Object.defineProperty(navigator, "plugins", {
      get: () => [
        { name: "Chrome PDF Plugin", filename: "internal-pdf-viewer" },
        { name: "Chrome PDF Viewer", filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai" },
        { name: "Native Client", filename: "internal-nacl-plugin" },
      ],
    })
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-GB", "en-US", "en"],
    })
    const w = window as any
    w.chrome = {
      runtime: {},
      loadTimes: function () {},
      csi: function () {},
      app: { isInstalled: false },
    }
  })

  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  )
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

  // Capture raw HTML
  let rawHtml = ""
  page.on("response", async (response) => {
    try {
      if (
        response.request().resourceType() === "document" &&
        response.status() === 200
      ) {
        rawHtml = await response.text()
      }
    } catch {}
  })

  // ====== TEST 1: Search Page ======
  console.log("--- Test 1: Search Page ---")
  console.log(`URL: ${SEARCH_URL}\n`)

  try {
    const response = await page.goto(SEARCH_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })

    console.log(`HTTP Status: ${response?.status()}`)
    console.log(`Final URL: ${page.url()}`)

    // Wait a bit for JS
    await new Promise((r) => setTimeout(r, 3000))

    const title = await page.title()
    console.log(`Page Title: "${title}"`)

    // Check for challenge/captcha indicators
    const bodyText = await page.evaluate(() => document.body?.textContent?.substring(0, 1000) || "")
    const isChallenged =
      title.toLowerCase().includes("challenge") ||
      title.toLowerCase().includes("captcha") ||
      title.toLowerCase().includes("blocked") ||
      title.toLowerCase().includes("access denied") ||
      bodyText.toLowerCase().includes("please verify") ||
      bodyText.toLowerCase().includes("are you a robot") ||
      bodyText.toLowerCase().includes("captcha")

    console.log(`Bot Detection: ${isChallenged ? "YES - BLOCKED" : "No (page loaded normally)"}`)

    // Check for data objects
    const dataCheck = await page.evaluate(() => {
      return {
        hasNextData: !!document.querySelector("#__NEXT_DATA__"),
        hasJsonModel: !!(window as any).jsonModel,
        hasPageModel: !!(window as any).PAGE_MODEL,
        jsonModelKeys: (window as any).jsonModel ? Object.keys((window as any).jsonModel) : [],
        jsonModelPropertyCount: (window as any).jsonModel?.properties?.length ?? 0,
        propertyLinks: Array.from(document.querySelectorAll('a[href*="/properties/"]'))
          .map((a) => a.getAttribute("href"))
          .filter((h) => h && /\/properties\/\d+/.test(h))
          .slice(0, 5),
        allLinksCount: document.querySelectorAll("a").length,
        scriptCount: document.querySelectorAll("script").length,
        resultCountText:
          document.querySelector(".searchHeader-resultCount")?.textContent ||
          document.querySelector('[data-testid="result-count"]')?.textContent ||
          null,
      }
    })

    console.log(`\n--- Data Objects ---`)
    console.log(`#__NEXT_DATA__: ${dataCheck.hasNextData}`)
    console.log(`window.jsonModel: ${dataCheck.hasJsonModel}`)
    if (dataCheck.hasJsonModel) {
      console.log(`  jsonModel keys: ${dataCheck.jsonModelKeys.join(", ")}`)
      console.log(`  jsonModel.properties count: ${dataCheck.jsonModelPropertyCount}`)
    }
    console.log(`window.PAGE_MODEL: ${dataCheck.hasPageModel}`)

    console.log(`\n--- DOM Analysis ---`)
    console.log(`Total <a> links: ${dataCheck.allLinksCount}`)
    console.log(`Total <script> tags: ${dataCheck.scriptCount}`)
    console.log(`Result count text: ${dataCheck.resultCountText || "NOT FOUND"}`)
    console.log(`Property links found: ${dataCheck.propertyLinks.length}`)
    if (dataCheck.propertyLinks.length > 0) {
      console.log(`  Sample: ${dataCheck.propertyLinks.join("\n          ")}`)
    }

    // Check raw HTML
    console.log(`\n--- Raw HTML Analysis ---`)
    console.log(`Raw HTML length: ${rawHtml.length} chars`)
    const rawJsonModel = rawHtml.match(/window\.jsonModel\s*=\s*\{/)
    console.log(`window.jsonModel in HTML: ${rawJsonModel ? "YES" : "NO"}`)
    const rawPropertyIds = rawHtml.match(/\/properties\/(\d{5,})/g)
    console.log(
      `Property IDs in HTML: ${rawPropertyIds ? [...new Set(rawPropertyIds)].length : 0}`
    )
    if (rawPropertyIds) {
      console.log(`  Sample: ${[...new Set(rawPropertyIds)].slice(0, 5).join(", ")}`)
    }

    // Body text snippet
    console.log(`\n--- Page Content Snippet ---`)
    console.log(bodyText.substring(0, 500).replace(/\s+/g, " ").trim())

    // Save screenshot
    await page.screenshot({ path: "scripts/rightmove-search-test.png", fullPage: false })
    console.log(`\nScreenshot saved: scripts/rightmove-search-test.png`)
  } catch (error: any) {
    console.error(`ERROR: ${error.message}`)
  }

  // ====== TEST 2: Property Detail Page ======
  console.log("\n\n--- Test 2: Property Detail Page ---")
  console.log(`URL: ${DETAIL_URL}\n`)
  rawHtml = ""

  try {
    const page2 = await browser.newPage()
    await page2.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => false })
      ;(window as any).chrome = { runtime: {} }
    })
    await page2.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    )

    page2.on("response", async (response) => {
      try {
        if (response.request().resourceType() === "document" && response.status() === 200) {
          rawHtml = await response.text()
        }
      } catch {}
    })

    const response = await page2.goto(DETAIL_URL, {
      waitUntil: "networkidle2",
      timeout: 60000,
    })

    console.log(`HTTP Status: ${response?.status()}`)
    await new Promise((r) => setTimeout(r, 3000))

    const title = await page2.title()
    console.log(`Page Title: "${title}"`)

    const detailCheck = await page2.evaluate(() => {
      return {
        hasPageModel: !!(window as any).PAGE_MODEL,
        pageModelKeys: (window as any).PAGE_MODEL
          ? Object.keys((window as any).PAGE_MODEL)
          : [],
        hasPropertyData: !!(window as any).PAGE_MODEL?.propertyData,
        hasJsonModel: !!(window as any).jsonModel,
        hasNextData: !!document.querySelector("#__NEXT_DATA__"),
        ogTitle:
          document.querySelector('meta[property="og:title"]')?.getAttribute("content") || null,
        ogPrice:
          document.querySelector('meta[property="og:price:amount"]')?.getAttribute("content") || null,
        h1: document.querySelector("h1")?.textContent?.trim() || null,
        priceEl:
          document.querySelector('[data-testid="property-price"]')?.textContent?.trim() ||
          document.querySelector('[class*="price" i]')?.textContent?.trim() ||
          null,
      }
    })

    console.log(`\n--- Data Objects ---`)
    console.log(`window.PAGE_MODEL: ${detailCheck.hasPageModel}`)
    if (detailCheck.hasPageModel) {
      console.log(`  Keys: ${detailCheck.pageModelKeys.join(", ")}`)
      console.log(`  Has propertyData: ${detailCheck.hasPropertyData}`)
    }
    console.log(`window.jsonModel: ${detailCheck.hasJsonModel}`)
    console.log(`#__NEXT_DATA__: ${detailCheck.hasNextData}`)

    console.log(`\n--- DOM Elements ---`)
    console.log(`og:title: ${detailCheck.ogTitle}`)
    console.log(`og:price:amount: ${detailCheck.ogPrice}`)
    console.log(`h1: ${detailCheck.h1}`)
    console.log(`Price element: ${detailCheck.priceEl}`)

    // Raw HTML check
    console.log(`\n--- Raw HTML Analysis ---`)
    console.log(`Raw HTML length: ${rawHtml.length} chars`)
    console.log(
      `PAGE_MODEL in HTML: ${rawHtml.includes("window.PAGE_MODEL") ? "YES" : "NO"}`
    )
    console.log(
      `jsonModel in HTML: ${rawHtml.includes("window.jsonModel") ? "YES" : "NO"}`
    )

    await page2.screenshot({ path: "scripts/rightmove-detail-test.png", fullPage: false })
    console.log(`Screenshot saved: scripts/rightmove-detail-test.png`)
    await page2.close()
  } catch (error: any) {
    console.error(`ERROR: ${error.message}`)
  }

  await browser.close()
  console.log("\n=== Test Complete ===")
}

testRightmove().catch(console.error)
