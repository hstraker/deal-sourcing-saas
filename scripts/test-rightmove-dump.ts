/**
 * Diagnostic: Dump raw __NEXT_DATA__ content from Rightmove
 */
import puppeteer from "puppeteer"

const SEARCH_URL =
  "https://www.rightmove.co.uk/property-for-sale/find.html?locationIdentifier=OUTCODE%5E2245&sortType=6&includeSSTC=false"

async function test() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    defaultViewport: { width: 1920, height: 1080 },
  })

  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false })
  })
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
  )

  await page.goto(SEARCH_URL, { waitUntil: "networkidle2", timeout: 60000 })
  await new Promise((r) => setTimeout(r, 5000))

  // Get raw __NEXT_DATA__ text
  const rawText = await page.evaluate(() => {
    const el = document.querySelector("#__NEXT_DATA__")
    return el?.textContent?.substring(0, 5000) || "NOT FOUND"
  })

  console.log("=== Raw __NEXT_DATA__ (first 5000 chars) ===")
  console.log(rawText)

  // Also check all script tags for property data
  const scriptAnalysis = await page.evaluate(() => {
    const scripts = Array.from(document.querySelectorAll("script"))
    const results: string[] = []
    for (const s of scripts) {
      const text = s.textContent || ""
      if (text.includes("propert") && text.length > 100) {
        results.push(
          `[src=${s.src || "inline"}, len=${text.length}] ` +
            text.substring(0, 200).replace(/\s+/g, " ")
        )
      }
    }
    return results
  })

  console.log("\n=== Script tags with 'propert' ===")
  for (const r of scriptAnalysis) {
    console.log(r)
  }

  // Check all links with /properties/
  const propLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll("a"))
    const propLinks: string[] = []
    for (const a of links) {
      const href = a.getAttribute("href") || ""
      if (href.includes("/properties/") || href.includes("/property-for-sale/")) {
        propLinks.push(href)
      }
    }
    return [...new Set(propLinks)].slice(0, 20)
  })

  console.log("\n=== Property-related links ===")
  for (const l of propLinks) {
    console.log(l)
  }

  // Check full rendered HTML size
  const htmlSize = await page.evaluate(() => document.documentElement.outerHTML.length)
  console.log(`\nRendered HTML size: ${htmlSize} chars`)

  await browser.close()
}

test().catch(console.error)
