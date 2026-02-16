/**
 * Discover Rightmove Outcode IDs
 *
 * Rightmove uses internal numeric IDs (outcodes) for location searches,
 * not standard UK postcodes. This script discovers those IDs.
 *
 * Usage:
 *   npx tsx scripts/discover-outcodes.ts "Newport"
 *   npx tsx scripts/discover-outcodes.ts "NP"
 *   npx tsx scripts/discover-outcodes.ts "SA"
 *   npx tsx scripts/discover-outcodes.ts "Pontypridd"
 *
 * How it works:
 *   1. Opens Rightmove search with your search term
 *   2. Rightmove redirects to a results page with locationIdentifier in the URL
 *   3. Extracts the numeric outcode ID from the URL
 *   4. Outputs the ID for you to add to lib/scrapers/constants.ts
 */

import puppeteer from "puppeteer"

async function discover(searchTerm: string) {
  console.log(`\n[Discover] Searching Rightmove for "${searchTerm}"...\n`)

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    )

    // Navigate to Rightmove search
    const searchUrl = `https://www.rightmove.co.uk/property-for-sale/search.html?searchLocation=${encodeURIComponent(searchTerm)}`
    console.log(`[Discover] URL: ${searchUrl}`)

    await page.goto(searchUrl, {
      waitUntil: "networkidle2",
      timeout: 30000,
    })

    // Allow time for redirect
    await new Promise((r) => setTimeout(r, 3000))

    const finalUrl = page.url()
    console.log(`[Discover] Redirected to: ${finalUrl}`)

    // Extract locationIdentifier
    const outcodeMatch = finalUrl.match(/locationIdentifier=OUTCODE%5E(\d+)/)
    const regionMatch = finalUrl.match(/locationIdentifier=REGION%5E(\d+)/)
    const userdefinedMatch = finalUrl.match(/locationIdentifier=USERDEFINED%5E(\d+)/)

    if (outcodeMatch) {
      const id = outcodeMatch[1]
      console.log(`\n${"=".repeat(50)}`)
      console.log(`  Search:       ${searchTerm}`)
      console.log(`  Type:         OUTCODE`)
      console.log(`  Rightmove ID: ${id}`)
      console.log(`${"=".repeat(50)}`)
      console.log(`\nTo add this location, update lib/scrapers/constants.ts:`)
      console.log(`\n  RIGHTMOVE_OUTCODES:`)
      console.log(`    "${searchTerm} (XX)": "${id}",`)
      console.log(`\n  LOCATION_SLUGS:`)
      console.log(`    "${searchTerm} (XX)": "${searchTerm.toLowerCase().replace(/\s+/g, "-")}",`)
    } else if (regionMatch) {
      const id = regionMatch[1]
      console.log(`\n${"=".repeat(50)}`)
      console.log(`  Search:       ${searchTerm}`)
      console.log(`  Type:         REGION (not an outcode)`)
      console.log(`  Rightmove ID: ${id}`)
      console.log(`${"=".repeat(50)}`)
      console.log(`\nNote: Rightmove returned a REGION, not an OUTCODE.`)
      console.log(`Try searching with a postcode prefix instead:`)
      console.log(`  npx tsx scripts/discover-outcodes.ts "NP"`)
    } else if (userdefinedMatch) {
      const id = userdefinedMatch[1]
      console.log(`\n${"=".repeat(50)}`)
      console.log(`  Search:       ${searchTerm}`)
      console.log(`  Type:         USERDEFINED`)
      console.log(`  Rightmove ID: ${id}`)
      console.log(`${"=".repeat(50)}`)
      console.log(`\nNote: This is a user-defined area. Try a postcode prefix for a standard outcode.`)
    } else {
      console.log(`\n[Discover] Could not extract a location identifier from the URL.`)
      console.log(`The URL was: ${finalUrl}`)
      console.log(`\nTips:`)
      console.log(`  - Try a postcode prefix (e.g. "NP" instead of "Newport")`)
      console.log(`  - Try a more specific area name`)
      console.log(`  - Check Rightmove manually and look for locationIdentifier in the URL`)
    }
  } finally {
    await browser.close()
  }

  console.log()
}

// ── Main ──

const searchTerm = process.argv[2]

if (!searchTerm || searchTerm === "--help" || searchTerm === "-h") {
  console.log(`
Discover Rightmove Outcode IDs
==============================

Usage:
  npx tsx scripts/discover-outcodes.ts <search-term>

Examples:
  npx tsx scripts/discover-outcodes.ts "Newport"
  npx tsx scripts/discover-outcodes.ts "NP"
  npx tsx scripts/discover-outcodes.ts "Pontypridd"
  npx tsx scripts/discover-outcodes.ts "SA"

This discovers the numeric Rightmove outcode ID for any UK location,
which you can then add to lib/scrapers/constants.ts.
`)
  process.exit(searchTerm ? 0 : 1)
}

discover(searchTerm).catch((error) => {
  console.error("[Discover] Error:", error.message)
  process.exit(1)
})
