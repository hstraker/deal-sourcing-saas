/**
 * Diagnostic: Dump Rightmove __NEXT_DATA__ structure to find the correct data paths
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
  await new Promise((r) => setTimeout(r, 3000))

  // Extract and analyze __NEXT_DATA__
  const analysis = await page.evaluate(() => {
    const script = document.querySelector("#__NEXT_DATA__")
    if (!script?.textContent) return { error: "No __NEXT_DATA__ found" }

    try {
      const data = JSON.parse(script.textContent)

      // Get top-level keys
      const topKeys = Object.keys(data)

      // Get pageProps keys
      const pageProps = data?.props?.pageProps || {}
      const pagePropsKeys = Object.keys(pageProps)

      // Look for property arrays anywhere in pageProps
      const findArrays = (obj: any, path: string, results: any[], depth = 0) => {
        if (depth > 5 || !obj || typeof obj !== "object") return
        if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === "object") {
          const sample = obj[0]
          const keys = Object.keys(sample).slice(0, 10)
          results.push({
            path,
            length: obj.length,
            sampleKeys: keys,
            hasId: "id" in sample || "propertyId" in sample,
            hasPrice: "price" in sample || "pricing" in sample,
          })
        }
        if (!Array.isArray(obj)) {
          for (const key of Object.keys(obj).slice(0, 20)) {
            findArrays(obj[key], `${path}.${key}`, results, depth + 1)
          }
        }
      }

      const arrays: any[] = []
      findArrays(pageProps, "pageProps", arrays)

      // Look for specific known paths
      const knownPaths = {
        "pageProps.properties": !!pageProps.properties,
        "pageProps.searchResult": !!pageProps.searchResult,
        "pageProps.searchResult.properties": !!pageProps.searchResult?.properties,
        "pageProps.data": !!pageProps.data,
        "pageProps.data.properties": !!pageProps.data?.properties,
        "pageProps.results": !!pageProps.results,
        "pageProps.regularListingsFormatted": !!pageProps.regularListingsFormatted,
        "pageProps.searchResults": !!pageProps.searchResults,
        "pageProps.searchResults.properties": !!pageProps.searchResults?.properties,
      }

      // Get a sample of the full pageProps structure (first 2000 chars)
      const ppStr = JSON.stringify(pageProps, null, 2)

      return {
        topKeys,
        pagePropsKeys,
        arrays,
        knownPaths,
        pagePropsPreview: ppStr.substring(0, 3000),
        buildId: data.buildId,
        page: data.page,
      }
    } catch (e: any) {
      return { error: e.message }
    }
  })

  console.log("=== __NEXT_DATA__ Analysis ===\n")
  console.log("Top-level keys:", analysis.topKeys)
  console.log("Page:", analysis.page)
  console.log("BuildId:", analysis.buildId)
  console.log("\npageProps keys:", analysis.pagePropsKeys)
  console.log("\nKnown paths check:", JSON.stringify(analysis.knownPaths, null, 2))
  console.log("\nArrays found in pageProps:")
  for (const arr of (analysis.arrays || [])) {
    console.log(`  ${arr.path}: ${arr.length} items, keys: [${arr.sampleKeys.join(", ")}], hasId: ${arr.hasId}, hasPrice: ${arr.hasPrice}`)
  }
  console.log("\npageProps preview (first 3000 chars):")
  console.log(analysis.pagePropsPreview)

  await browser.close()
}

test().catch(console.error)
