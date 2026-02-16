/**
 * Property Scraper CLI
 *
 * Usage:
 *   npx tsx scripts/run-scraper.ts
 *   npx tsx scripts/run-scraper.ts --source RIGHTMOVE --postcode B --maxPages 3
 *   npx tsx scripts/run-scraper.ts --maxPages 3 --addedSince 7days --debug
 *   npx tsx scripts/run-scraper.ts --dry-run                          # Just show search URLs
 *   npx tsx scripts/run-scraper.ts --search-only                      # Get URLs but don't visit details
 *   npx tsx scripts/run-scraper.ts --headful                          # Show browser window
 *   npx tsx scripts/run-scraper.ts --reset-db                         # Clear all scraper data
 *   npx tsx scripts/run-scraper.ts --use-saved                        # Use saved settings criteria
 *   npx tsx scripts/run-scraper.ts --discover "Newport"               # Discover Rightmove outcode ID
 *
 * Options:
 *   --source       RIGHTMOVE (default), ZOOPLA, ONTHEMARKET, PRIMELOCATION
 *   --category     RESIDENTIAL (default), COMMERCIAL, BOTH
 *   --postcode     UK postcode area code (e.g. B, NP, CF) — auto-resolves to Rightmove ID
 *   --outcode      (hidden alias for --postcode) Rightmove numeric outcode ID
 *   --name         Display name for location (default: auto from postcode)
 *   --minPrice     Minimum price filter
 *   --maxPrice     Maximum price filter
 *   --minBedrooms  Minimum bedrooms filter
 *   --maxBedrooms  Maximum bedrooms filter
 *   --addedSince   24hours, 3days, 7days, 14days
 *   --maxPages     Max search result pages per location (1-42, default: all)
 *   --debug        Verbose output — log every step
 *   --dry-run      Build search URLs and print them, but don't scrape
 *   --search-only  Scrape search result pages only — list property URLs, don't visit details
 *   --headful      Run browser visibly (not headless) for debugging
 *   --reset-db     Wipe all PropertyListing, ScraperJob data and exit
 *   --use-saved    Load search criteria from saved scraper settings instead of CLI args
 *   --discover     Discover a Rightmove outcode ID for a search term (e.g. "Newport")
 *   --help         Show this help
 */

import { PrismaClient } from "@prisma/client"
import type { ScraperCriteria, ScraperSettingsData } from "../lib/scrapers/types"
import { LOCATION_SLUGS, RIGHTMOVE_OUTCODES } from "../lib/scrapers/constants"

const prisma = new PrismaClient()

// ── Arg helpers ─────────────────────────────────────────────

function hasFlag(name: string): boolean {
  return process.argv.slice(2).includes(`--${name}`)
}

function getArg(name: string, defaultValue?: string): string | undefined {
  const args = process.argv.slice(2)
  const idx = args.indexOf(`--${name}`)
  if (idx !== -1 && args[idx + 1] && !args[idx + 1].startsWith("--")) {
    return args[idx + 1]
  }
  return defaultValue
}

// ── Postcode → Outcode resolution ────────────────────────────

/** Reverse lookup: find outcode by postcode prefix (e.g. "NP" → "1043") */
function resolvePostcode(input: string): { outcode: string; displayName: string } | null {
  const upper = input.toUpperCase().trim()

  // Try exact match on postcode prefix inside parentheses
  for (const [displayName, outcode] of Object.entries(RIGHTMOVE_OUTCODES)) {
    const match = displayName.match(/\(([^)]+)\)/)
    if (match && match[1].toUpperCase() === upper) {
      return { outcode, displayName }
    }
  }

  // Try partial name match
  for (const [displayName, outcode] of Object.entries(RIGHTMOVE_OUTCODES)) {
    if (displayName.toLowerCase().includes(input.toLowerCase())) {
      return { outcode, displayName }
    }
  }

  return null
}

// ── Help ────────────────────────────────────────────────────

function printHelp() {
  // Build postcode area table
  const postcodeLines: string[] = []
  for (const [displayName, outcode] of Object.entries(RIGHTMOVE_OUTCODES)) {
    const match = displayName.match(/\(([^)]+)\)/)
    const code = match ? match[1] : "?"
    const name = displayName.replace(/ \([^)]+\)/, "")
    postcodeLines.push(`  ${code.padEnd(6)}${name.padEnd(24)}(Rightmove ID: ${outcode})`)
  }

  console.log(`
Property Scraper CLI
====================

USAGE
  npx tsx scripts/run-scraper.ts [options]

SEARCH OPTIONS
  --source <src>        RIGHTMOVE (default), ZOOPLA, ONTHEMARKET, PRIMELOCATION
  --category <cat>      RESIDENTIAL (default), COMMERCIAL, BOTH
  --postcode <code>     UK postcode area code (e.g. B, NP, CF)
  --name <name>         Location display name (default: auto from postcode)
  --minPrice <n>        Minimum price (£)
  --maxPrice <n>        Maximum price (£)
  --minBedrooms <n>     Minimum bedrooms
  --maxBedrooms <n>     Maximum bedrooms
  --addedSince <period> 24hours, 3days, 7days, 14days
  --maxPages <n>        Pages to scrape per location (1-42, default: all)
  --use-saved           Use search criteria saved in scraper settings

DEBUG / MODE OPTIONS
  --debug               Verbose logging
  --dry-run             Print search URLs only, don't scrape
  --search-only         Scrape search pages, list property URLs, skip details
  --headful             Show the browser window
  --reset-db            Delete ALL scraper data (listings, jobs, checksums)
  --discover <search>   Discover Rightmove outcode ID for a location
  --help                Show this help

EXAMPLES
  # Quick debug: 1 page, headful, Birmingham, last 24h
  npx tsx scripts/run-scraper.ts --maxPages 1 --addedSince 24hours --headful --debug

  # Scrape Newport (South Wales)
  npx tsx scripts/run-scraper.ts --postcode NP --maxPages 2

  # Scrape PrimeLocation
  npx tsx scripts/run-scraper.ts --source PRIMELOCATION --postcode B --maxPages 1

  # Discover the Rightmove ID for a location
  npx tsx scripts/run-scraper.ts --discover "Newport"

  # Dry run to see what URLs would be scraped
  npx tsx scripts/run-scraper.ts --dry-run --maxPages 3

  # Search only — find property URLs but don't visit each one
  npx tsx scripts/run-scraper.ts --search-only --maxPages 2

  # Use saved settings from the dashboard
  npx tsx scripts/run-scraper.ts --use-saved --debug

  # Scrape Manchester, 2+ beds, under £200k
  npx tsx scripts/run-scraper.ts --postcode M --minBedrooms 2 --maxPrice 200000

  # Wipe all scraper data to start fresh
  npx tsx scripts/run-scraper.ts --reset-db

AVAILABLE POSTCODE AREAS
${postcodeLines.join("\n")}
`)
}

// ── Discover mode ────────────────────────────────────────────

async function discoverOutcode(searchTerm: string) {
  console.log(`\n[Discover] Looking up Rightmove outcode for "${searchTerm}"...\n`)

  // First check local constants
  const local = resolvePostcode(searchTerm)
  if (local) {
    console.log(`[Discover] Found in local constants:`)
    console.log(`  Location:     ${local.displayName}`)
    console.log(`  Rightmove ID: ${local.outcode}`)
    console.log(`  Slug:         ${LOCATION_SLUGS[local.displayName] || "(not set)"}`)
    console.log(`\nUse with: --postcode ${searchTerm}\n`)
    return
  }

  // Try Puppeteer discovery
  console.log(`[Discover] Not found in local constants, searching Rightmove...`)
  const puppeteer = await import("puppeteer")
  const browser = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  })

  try {
    const page = await browser.newPage()
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    )

    const searchUrl = `https://www.rightmove.co.uk/property-for-sale/search.html?searchLocation=${encodeURIComponent(searchTerm)}`
    console.log(`[Discover] Navigating to: ${searchUrl}`)

    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 })

    // Wait for redirect to results page
    await new Promise((r) => setTimeout(r, 3000))

    const finalUrl = page.url()
    console.log(`[Discover] Redirected to: ${finalUrl}`)

    // Extract locationIdentifier from URL
    const outcodeMatch = finalUrl.match(/locationIdentifier=OUTCODE%5E(\d+)/)
    const regionMatch = finalUrl.match(/locationIdentifier=REGION%5E(\d+)/)

    if (outcodeMatch) {
      console.log(`\n[Discover] Found outcode:`)
      console.log(`  Search term:  ${searchTerm}`)
      console.log(`  Rightmove ID: ${outcodeMatch[1]}`)
      console.log(`  Type:         OUTCODE`)
      console.log(`\nAdd to constants.ts:`)
      console.log(`  "${searchTerm} (XX)": "${outcodeMatch[1]}",`)
    } else if (regionMatch) {
      console.log(`\n[Discover] Found region (not an outcode):`)
      console.log(`  Search term:  ${searchTerm}`)
      console.log(`  Rightmove ID: ${regionMatch[1]}`)
      console.log(`  Type:         REGION`)
      console.log(`\nNote: This is a REGION identifier, not an OUTCODE.`)
      console.log(`You may need to search with a postcode prefix instead (e.g. "NP" instead of "Newport")`)
    } else {
      console.log(`\n[Discover] Could not extract location identifier from URL.`)
      console.log(`  Try searching with a postcode prefix (e.g. "NP", "CF", "SA")`)
    }
  } finally {
    await browser.close()
  }
  console.log()
}

// ── Reset DB ────────────────────────────────────────────────

async function resetDatabase() {
  console.log("\n[Reset] Clearing all scraper data from the database...\n")

  const listingCount = await prisma.propertyListing.count()
  const jobCount = await prisma.scraperJob.count()

  if (listingCount === 0 && jobCount === 0) {
    console.log("[Reset] Database is already clean — no scraper data found.")
    return
  }

  console.log(`[Reset] Found ${listingCount} property listings, ${jobCount} scraper jobs`)

  // Delete in dependency order
  // PropertyExport references PropertyListing
  const exportsDel = await prisma.propertyExport.deleteMany({
    where: { propertyId: { not: null } },
  })
  console.log(`[Reset] Deleted ${exportsDel.count} property exports`)

  const listingsDel = await prisma.propertyListing.deleteMany({})
  console.log(`[Reset] Deleted ${listingsDel.count} property listings (inc. checksums)`)

  const jobsDel = await prisma.scraperJob.deleteMany({})
  console.log(`[Reset] Deleted ${jobsDel.count} scraper jobs`)

  console.log("\n[Reset] Done. Database is clean for a fresh scrape.\n")
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  if (hasFlag("help")) {
    printHelp()
    return
  }

  if (hasFlag("reset-db")) {
    await resetDatabase()
    return
  }

  // Discover mode
  const discoverSearch = getArg("discover")
  if (discoverSearch) {
    await discoverOutcode(discoverSearch)
    return
  }

  const debug = hasFlag("debug")
  const dryRun = hasFlag("dry-run")
  const searchOnly = hasFlag("search-only")
  const headful = hasFlag("headful")
  const useSaved = hasFlag("use-saved")

  // ── Build criteria ──

  let criteria: ScraperCriteria
  let source: string

  if (useSaved) {
    // Load from saved settings
    const settings = await prisma.scraperSettings.findFirst()
    const savedCriteria = settings?.searchCriteria as any
    if (!savedCriteria || !savedCriteria.locations?.length) {
      console.error(
        "[CLI] No saved search criteria found. Configure criteria at /dashboard/settings/scraper first, or pass CLI args."
      )
      process.exit(1)
    }
    source = getArg("source", "RIGHTMOVE")!
    criteria = {
      category: savedCriteria.category || "RESIDENTIAL",
      locations: savedCriteria.locations,
      ...(savedCriteria.minPrice && { minPrice: savedCriteria.minPrice }),
      ...(savedCriteria.maxPrice && { maxPrice: savedCriteria.maxPrice }),
      ...(savedCriteria.minBedrooms && { minBedrooms: savedCriteria.minBedrooms }),
      ...(savedCriteria.maxBedrooms && { maxBedrooms: savedCriteria.maxBedrooms }),
      ...(savedCriteria.propertyTypes?.length && { propertyTypes: savedCriteria.propertyTypes }),
      ...(savedCriteria.addedSince && { addedSince: savedCriteria.addedSince }),
      ...(savedCriteria.includeSSTC !== undefined && { includeSSTC: savedCriteria.includeSSTC }),
      ...(savedCriteria.maxPages && { maxPages: savedCriteria.maxPages }),
    }
    console.log("[CLI] Loaded saved search criteria from database")
  } else {
    source = getArg("source", "RIGHTMOVE")!
    const category = getArg("category", "RESIDENTIAL") as ScraperCriteria["category"]

    // Support both --postcode and --outcode (backwards compat)
    const postcodeArg = getArg("postcode") || getArg("outcode")
    let outcode: string
    let displayName: string

    if (postcodeArg) {
      // Try resolving as a postcode area code first
      const resolved = resolvePostcode(postcodeArg)
      if (resolved) {
        outcode = resolved.outcode
        displayName = getArg("name") || resolved.displayName
      } else if (/^\d+$/.test(postcodeArg)) {
        // Raw numeric outcode ID passed directly
        outcode = postcodeArg
        displayName = getArg("name", `Location (${postcodeArg})`)!
      } else {
        console.error(`[CLI] Unknown postcode area "${postcodeArg}". Run --help to see available areas, or use --discover "${postcodeArg}" to look it up.`)
        process.exit(1)
      }
    } else {
      outcode = "2245"
      displayName = getArg("name", "Birmingham (B)")!
    }

    const minPrice = getArg("minPrice")
    const maxPrice = getArg("maxPrice")
    const minBedrooms = getArg("minBedrooms")
    const maxBedrooms = getArg("maxBedrooms")
    const addedSince = getArg("addedSince") as ScraperCriteria["addedSince"]
    const maxPages = getArg("maxPages")

    const slug = LOCATION_SLUGS[displayName]

    criteria = {
      category,
      locations: [{ outcode, displayName, ...(slug && { slug }) }],
      ...(minPrice && { minPrice: parseInt(minPrice) }),
      ...(maxPrice && { maxPrice: parseInt(maxPrice) }),
      ...(minBedrooms && { minBedrooms: parseInt(minBedrooms) }),
      ...(maxBedrooms && { maxBedrooms: parseInt(maxBedrooms) }),
      ...(addedSince && { addedSince }),
      ...(maxPages && { maxPages: parseInt(maxPages) }),
    }
  }

  // ── Print config ──

  const hr = "=".repeat(60)
  console.log(`\n${hr}`)
  console.log("[Scraper CLI] Property Scraper")
  console.log(hr)
  console.log(`  Source:       ${source}`)
  console.log(`  Category:     ${criteria.category}`)
  console.log(`  Locations:    ${criteria.locations.map((l) => `${l.displayName} (${l.outcode})`).join(", ")}`)
  if (criteria.minPrice) console.log(`  Min Price:    £${criteria.minPrice.toLocaleString()}`)
  if (criteria.maxPrice) console.log(`  Max Price:    £${criteria.maxPrice.toLocaleString()}`)
  if (criteria.minBedrooms) console.log(`  Min Beds:     ${criteria.minBedrooms}`)
  if (criteria.maxBedrooms) console.log(`  Max Beds:     ${criteria.maxBedrooms}`)
  if (criteria.addedSince) console.log(`  Added Since:  ${criteria.addedSince}`)
  if (criteria.maxPages) console.log(`  Max Pages:    ${criteria.maxPages} (~${criteria.maxPages * 24} results)`)
  else console.log(`  Max Pages:    unlimited (up to 42)`)
  if (criteria.includeSSTC) console.log(`  Include SSTC: yes`)
  console.log(`  Mode:         ${dryRun ? "DRY RUN" : searchOnly ? "SEARCH ONLY" : "FULL SCRAPE"}`)
  if (headful) console.log(`  Browser:      HEADFUL (visible)`)
  if (debug) console.log(`  Debug:        ON`)
  console.log(hr)

  // ── Dry run: just build and display URLs ──

  if (dryRun) {
    const { RightmoveScraper } = await import("../lib/scrapers/rightmove-scraper")
    const { ZooplaScraper } = await import("../lib/scrapers/zoopla-scraper")
    const { OnTheMarketScraper } = await import("../lib/scrapers/onthemarket-scraper")
    const { PrimeLocationScraper } = await import("../lib/scrapers/primelocation-scraper")

    const dummySettings: ScraperSettingsData = {
      enabled: true,
      scheduleType: "MANUAL",
      rightmoveEnabled: true,
      zooplaEnabled: true,
      onthemarketEnabled: true,
      primelocationEnabled: true,
      autoAnalysisEnabled: false,
      requireManualReview: true,
      requestDelay: 3000,
      maxConcurrent: 1,
      useProxy: false,
    }

    let scraper
    switch (source) {
      case "RIGHTMOVE":
        scraper = new RightmoveScraper(dummySettings, "dry-run")
        break
      case "ZOOPLA":
        scraper = new ZooplaScraper(dummySettings, "dry-run")
        break
      case "ONTHEMARKET":
        scraper = new OnTheMarketScraper(dummySettings, "dry-run")
        break
      case "PRIMELOCATION":
        scraper = new PrimeLocationScraper(dummySettings, "dry-run")
        break
      default:
        console.error(`Unknown source: ${source}`)
        process.exit(1)
    }

    const urls = scraper.buildSearchUrls(criteria)
    console.log(`\n[Dry Run] ${urls.length} search URL(s) would be scraped:\n`)
    for (const url of urls) {
      console.log(`  ${url}`)
    }
    console.log()
    return
  }

  // ── Search-only mode ──

  if (searchOnly) {
    console.log("\n[Search Only] Scraping search pages to collect property URLs...\n")

    const { RightmoveScraper } = await import("../lib/scrapers/rightmove-scraper")
    const { ZooplaScraper } = await import("../lib/scrapers/zoopla-scraper")
    const { OnTheMarketScraper } = await import("../lib/scrapers/onthemarket-scraper")
    const { PrimeLocationScraper } = await import("../lib/scrapers/primelocation-scraper")

    const dummySettings: ScraperSettingsData = {
      enabled: true,
      scheduleType: "MANUAL",
      rightmoveEnabled: true,
      zooplaEnabled: true,
      onthemarketEnabled: true,
      primelocationEnabled: true,
      autoAnalysisEnabled: false,
      requireManualReview: true,
      requestDelay: 3000,
      maxConcurrent: 1,
      useProxy: false,
      headful,
    }

    let scraper
    switch (source) {
      case "RIGHTMOVE":
        scraper = new RightmoveScraper(dummySettings, "search-only")
        break
      case "ZOOPLA":
        scraper = new ZooplaScraper(dummySettings, "search-only")
        break
      case "ONTHEMARKET":
        scraper = new OnTheMarketScraper(dummySettings, "search-only")
        break
      case "PRIMELOCATION":
        scraper = new PrimeLocationScraper(dummySettings, "search-only")
        break
      default:
        console.error(`Unknown source: ${source}`)
        process.exit(1)
    }

    // Manually init browser, scrape search pages, then shut down
    await scraper.initialize()
    try {
      const searchUrls = scraper.buildSearchUrls(criteria)
      let allPropertyUrls: string[] = []

      for (const searchUrl of searchUrls) {
        console.log(`[Search Only] Scraping: ${searchUrl}`)
        const page = await (scraper as any).createPage()
        try {
          const urls = await (scraper as any).scrapeAllPages(page, searchUrl, criteria)
          console.log(`[Search Only] Found ${urls.length} property URLs`)
          allPropertyUrls.push(...urls)
        } finally {
          await page.close()
        }
      }

      // Deduplicate
      allPropertyUrls = [...new Set(allPropertyUrls)]

      console.log(`\n${hr}`)
      console.log(`[Search Only] Results: ${allPropertyUrls.length} unique property URLs`)
      console.log(hr)
      for (const url of allPropertyUrls) {
        console.log(`  ${url}`)
      }
      console.log()
    } finally {
      await (scraper as any).shutdown()
    }
    return
  }

  // ── Full scrape ──

  // Create job record
  const job = await prisma.scraperJob.create({
    data: {
      source: source as any,
      category: criteria.category === "BOTH" ? null : (criteria.category as any),
      criteria: criteria as any,
      status: "QUEUED",
      propertiesFound: [],
    },
  })
  console.log(`\n[CLI] Created job: ${job.id}`)

  if (debug) {
    console.log(`[CLI] Criteria: ${JSON.stringify(criteria, null, 2)}`)
  }

  // Load settings with headful override
  const { runScraperJob } = await import("../lib/scrapers/scraper-runner")

  // If headful, we need to override settings — patch the runner to read from env
  if (headful) {
    process.env.SCRAPER_HEADFUL = "1"
  }

  const startTime = Date.now()
  const progress = await runScraperJob(job.id, source, criteria)
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

  console.log(`\n${hr}`)
  console.log("[Scraper CLI] Results")
  console.log(hr)
  console.log(`  Total found:  ${progress.totalFound}`)
  console.log(`  Processed:    ${progress.processed}`)
  console.log(`  Successful:   ${progress.successful}`)
  console.log(`  Failed:       ${progress.failed}`)
  console.log(`  Errors:       ${progress.errors.length}`)
  console.log(`  Duration:     ${elapsed}s`)
  if (progress.errors.length > 0) {
    console.log("\n  Recent errors:")
    for (const err of progress.errors.slice(-10)) {
      console.log(`    - [${err.url || "?"}] ${err.message}`)
    }
  }
  console.log(hr)
}

main()
  .catch((error) => {
    console.error("\n[Scraper CLI] Fatal error:", error.message)
    if (hasFlag("debug")) {
      console.error(error.stack)
    }
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
