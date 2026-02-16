/**
 * OTM Date Debug Script
 * Opens an OTM property detail page and dumps all date-related info so we
 * can fix the days-on-market extraction.
 *
 * Usage:
 *   npx tsx scripts/debug-otm-date.ts --url "https://www.onthemarket.com/details/12345678/"
 *   npx tsx scripts/debug-otm-date.ts   (searches for a Birmingham property automatically)
 */

import puppeteer from "puppeteer"

const targetUrl = process.argv.find((a) => a.startsWith("http")) ?? null

;(async () => {
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] })
  const page = await browser.newPage()
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  )

  let propertyUrl = targetUrl

  if (!propertyUrl) {
    console.log("No URL provided — searching OTM for a Birmingham property...")
    await page.goto("https://www.onthemarket.com/for-sale/property/birmingham/?page_size=6&view=list", {
      waitUntil: "networkidle2",
      timeout: 45000,
    })

    // Accept cookies if present
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button"))
      for (const btn of btns) {
        const t = btn.textContent?.toLowerCase() || ""
        if (t.includes("accept") || t.includes("agree")) { btn.click(); return }
      }
    })
    await new Promise(r => setTimeout(r, 2000))

    // Extract first property URL from search results
    propertyUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/details/"]'))
      const href = links[0]?.getAttribute("href") || null
      return href ? `https://www.onthemarket.com${href}` : null
    })
    if (!propertyUrl) {
      console.error("Could not find a property URL from search results")
      await browser.close()
      return
    }
    console.log(`Found property: ${propertyUrl}`)
  }

  console.log(`\nNavigating to: ${propertyUrl}`)
  await page.goto(propertyUrl, { waitUntil: "networkidle2", timeout: 45000 })

  // Accept cookies
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"))
    for (const btn of btns) {
      const t = btn.textContent?.toLowerCase() || ""
      if (t.includes("accept") || t.includes("agree")) { btn.click(); return }
    }
  })
  await new Promise(r => setTimeout(r, 2000))

  const result = await page.evaluate(() => {
    // 1. All keys in initialReduxState.property
    let reduxKeys: string[] = []
    let reduxDateFields: Record<string, any> = {}
    let daysSinceStr = ""
    let keyInfo: any = null
    let propertyDetails: any = null
    let propertyLabels: any = null
    let iconLabels: any = null
    let features: any = null
    let headerData: any = null
    try {
      const s = document.querySelector("#__NEXT_DATA__")?.textContent
      if (s) {
        const p = JSON.parse(s)
        const prop = p?.props?.initialReduxState?.property
        if (prop) {
          reduxKeys = Object.keys(prop)
          // Extract any field that looks date-related
          for (const key of reduxKeys) {
            if (/date|time|added|listed|since|reduced|published|created|updated/i.test(key)) {
              reduxDateFields[key] = prop[key]
            }
          }
          daysSinceStr = prop.daysSinceAddedReduced || ""
          keyInfo = prop.keyInfo ?? null
          propertyDetails = prop.propertyDetails ?? null
          propertyLabels = prop.propertyLabels ?? null
          iconLabels = prop.iconLabels ?? null
          features = prop.features ?? null
          headerData = prop.headerData ?? null
        }
      }
    } catch {}

    // 2. All ld+json scripts
    const ldJsonAll: any[] = []
    document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try { ldJsonAll.push(JSON.parse(s.textContent || "")) } catch {}
    })

    // 3. Grab all text from the page that contains "added" or "reduced"
    const bodyText = document.body?.textContent || ""
    const lines = bodyText.split("\n").map(l => l.trim()).filter(l => l.length > 0)
    const dateLines = lines.filter(l =>
      /\b(added|reduced)\b/i.test(l) && l.length < 200
    ).slice(0, 20)

    // 4. Try ALL regex patterns we might use
    const patterns: Record<string, string | null> = {
      "DD MMM YYYY":           (bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i) || [])[1] ?? null,
      "DDth MMM YYYY":         (bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}(?:st|nd|rd|th)\s+\w{3,9}\s+\d{4})/i) || [])[1] ?? null,
      "DD MMMM YYYY":          (bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}\s+\w{4,12}\s+\d{4})/i) || [])[1] ?? null,
      "DDth MMMM YYYY":        (bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}(?:st|nd|rd|th)\s+\w{4,12}\s+\d{4})/i) || [])[1] ?? null,
      "DD/MM/YYYY":            (bodyText.match(/(?:Added|Reduced)\s+on\s+(\d{1,2}\/\d{2}\/\d{4})/i) || [])[1] ?? null,
      "Without 'on'":          (bodyText.match(/(?:Added|Reduced)\s+(\d{1,2}\s+\w{3,9}\s+\d{4})/i) || [])[1] ?? null,
      "Any date near added":   (bodyText.match(/Added[^.]{0,30}?(\d{1,2}\s+\w{3,9}\s+\d{4})/i) || [])[1] ?? null,
      "meta datePosted":       document.querySelector('meta[property="article:published_time"]')?.getAttribute("content") ?? null,
    }

    // 5. Capture text around the word "added" in the body
    const addedIdx = bodyText.toLowerCase().indexOf("added on")
    const addedContext = addedIdx >= 0 ? bodyText.substring(Math.max(0, addedIdx - 20), addedIdx + 80) : null

    return {
      reduxKeys,
      reduxDateFields,
      daysSinceStr,
      keyInfo,
      propertyDetails,
      propertyLabels,
      iconLabels,
      features,
      headerData,
      ldJsonAll,
      dateLines,
      patterns,
      addedContext,
    }
  })

  console.log("\n=== initialReduxState.property keys ===")
  console.log(result.reduxKeys.join(", "))

  console.log("\n=== Date-related redux fields ===")
  console.log(JSON.stringify(result.reduxDateFields, null, 2))

  console.log("\n=== daysSinceAddedReduced value ===")
  console.log(JSON.stringify(result.daysSinceStr))

  console.log("\n=== ld+json scripts ===")
  for (const lj of result.ldJsonAll) {
    console.log(JSON.stringify(lj, null, 2))
  }

  console.log("\n=== Lines containing 'added' or 'reduced' (from body text) ===")
  result.dateLines.forEach(l => console.log(" •", l))

  console.log("\n=== Regex pattern results ===")
  for (const [pattern, match] of Object.entries(result.patterns)) {
    console.log(` ${match ? "✓" : "✗"} ${pattern}: ${match ?? "NO MATCH"}`)
  }

  console.log("\n=== Context around 'added on' in body ===")
  console.log(result.addedContext ?? "NOT FOUND")

  console.log("\n=== keyInfo ===")
  console.log(JSON.stringify(result.keyInfo, null, 2))

  console.log("\n=== propertyDetails ===")
  console.log(JSON.stringify(result.propertyDetails, null, 2))

  console.log("\n=== propertyLabels ===")
  console.log(JSON.stringify(result.propertyLabels, null, 2))

  console.log("\n=== iconLabels ===")
  console.log(JSON.stringify(result.iconLabels, null, 2))

  console.log("\n=== features (first 5) ===")
  console.log(JSON.stringify(Array.isArray(result.features) ? result.features.slice(0, 5) : result.features, null, 2))

  console.log("\n=== headerData ===")
  console.log(JSON.stringify(result.headerData, null, 2))

  await browser.close()
})()
