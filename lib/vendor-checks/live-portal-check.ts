/**
 * Live portal check service — Puppeteer-based.
 * Launches a single stealth browser (same settings as the batch scrapers) and
 * opens one page per portal in parallel to check whether the vendor's property
 * is currently listed on Rightmove, Zoopla, OnTheMarket, or PrimeLocation.
 *
 * Data extraction strategy per portal:
 *   Rightmove     — Node.js fetch to typeahead API → numeric identifier → search page → __NEXT_DATA__ → searchResults.properties
 *   Zoopla        — slug URL (sw16-3rd) → DOM: a[data-testid='listing-card-content'] + address element
 *   OnTheMarket   — slug URL (sw16-3rd) → __NEXT_DATA__ → props.initialReduxState.results.list
 *   PrimeLocation — slug URL (sw16-3rd) → DOM a[href*='/for-sale/details/'] with address element, RSC fallback
 *
 * The browser is always closed in a finally block — safe for fire-and-forget use.
 */

import puppeteer, { type Browser, type Page } from "puppeteer"
import { addressesMatch } from "./address-normaliser"
import type { MockScenarioId } from "./test-mode/mock-scenarios"
import { getMockLivePortalResults } from "./test-mode/mock-responses"
import type { PortalFlag } from "./portal-listing-check"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LivePortalStatus = "success" | "no_listings" | "blocked" | "error"

export interface LivePortalListing {
  listingUrl: string | null
  price: number
  address: string
  isSoldSTC: boolean
  bedrooms: number | null
  propertyType: string | null
  agent: { name?: string; phone?: string } | null
}

export interface LivePortalResult {
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  status: LivePortalStatus
  listings: LivePortalListing[]
  matchedListings: LivePortalListing[]
  errorMessage?: string
}

export interface LivePortalCheckResult {
  results: LivePortalResult[]
  flags: PortalFlag[]
  hasMatches: boolean
  blockedPortals: string[]
  isMockData: boolean
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

const PAGE_TIMEOUT_MS = 22_000
const STEALTH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"

async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
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
}

/**
 * Creates a new page with stealth patches applied.
 * withInterception = false for Rightmove (interception triggers their bot detection).
 */
async function setupPage(
  browser: Browser,
  withInterception = true
): Promise<Page> {
  const page = await browser.newPage()

  // Full stealth patches — mirrors rightmove-scraper.ts createPage()
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
    // Override permissions query (Rightmove bot detection checks this)
    const originalQuery = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = (params: any) =>
      params.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as PermissionStatus)
        : originalQuery(params)
  })

  await page.setUserAgent(STEALTH_UA)
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

  if (withInterception) {
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      const rt = req.resourceType()
      if (["image", "media", "font", "stylesheet"].includes(rt)) {
        req.abort()
      } else {
        req.continue()
      }
    })
  }

  return page
}

/** Click an "Accept cookies" button if it appears within 3 seconds. */
async function dismissCookieConsent(page: Page): Promise<void> {
  const selectors = [
    '[data-testid="accept-all-cookies"]',
    'button[aria-label="Accept all"]',
    "#onetrust-accept-btn-handler",
    ".cookie-accept",
    '[class*="accept-cookies"]',
  ]
  try {
    await page.waitForSelector(selectors.join(","), { timeout: 3_000 })
    for (const sel of selectors) {
      const btn = await page.$(sel)
      if (btn) {
        await btn.click()
        await new Promise((r) => setTimeout(r, 800))
        return
      }
    }
  } catch {
    // No consent banner — continue
  }
}

// ---------------------------------------------------------------------------
// Per-portal checkers
// ---------------------------------------------------------------------------

/**
 * Resolve a postcode or outcode to Rightmove's internal numeric location identifier
 * using a direct server-side fetch to Rightmove's typeahead API.
 *
 * The typeahead lives at https://los.rightmove.co.uk/typeahead and returns:
 *   { matches: [{ id: "834577", type: "POSTCODE", displayName: "SW16 3RD" }, ...] }
 *
 * We construct the locationIdentifier as `{TYPE}^{id}`, e.g. POSTCODE^834577.
 * This approach doesn't need Puppeteer — it's a plain HTTP call with spoofed headers.
 */
async function resolveRightmoveIdentifier(
  searchQuery: string
): Promise<string | undefined> {
  try {
    const url =
      `https://los.rightmove.co.uk/typeahead` +
      `?query=${encodeURIComponent(searchQuery)}&limit=6&exclude=STREET`

    const res = await fetch(url, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-GB,en;q=0.9",
        Origin: "https://www.rightmove.co.uk",
        Referer: "https://www.rightmove.co.uk/",
        "User-Agent": STEALTH_UA,
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-site",
        "Sec-Fetch-Dest": "empty",
      },
    })
    if (!res.ok) return undefined
    const data: any = await res.json()
    const matches: any[] = data?.matches ?? []
    if (matches.length === 0) return undefined
    // Prefer an exact match on the query (case-insensitive), fallback to first
    const exact = matches.find(
      (m) => m.displayName?.toLowerCase() === searchQuery.toLowerCase()
    )
    const best = exact ?? matches[0]
    if (!best?.id || !best?.type) return undefined
    return `${String(best.type).toUpperCase()}^${best.id}`
  } catch {
    return undefined
  }
}

async function checkRightmove(
  browser: Browser,
  postcode: string,
  vendorAddress: string
): Promise<LivePortalResult> {
  const source = "RIGHTMOVE" as const
  // Do NOT use request interception for Rightmove — it triggers bot detection
  // and prevents JS from hydrating. Same approach as the main rightmove-scraper.ts.
  const page = await setupPage(browser, false)

  try {
    const outcode = postcode.split(" ")[0].toUpperCase()
    const fullPostcode = postcode.toUpperCase().trim()

    // Step 1: Resolve the postcode → Rightmove's internal numeric location identifier.
    // Uses a direct Node.js fetch to los.rightmove.co.uk/typeahead — no browser needed.
    // SW16 3RD → POSTCODE^834577, SW16 → OUTCODE^2502
    // Try full postcode first (most precise — only properties in that postcode).
    let identifier = await resolveRightmoveIdentifier(fullPostcode)

    // Fallback: try just the outcode (broader area search)
    if (!identifier) {
      identifier = await resolveRightmoveIdentifier(outcode)
    }

    if (!identifier) {
      return {
        source,
        status: "error",
        listings: [],
        matchedListings: [],
        errorMessage: `Could not resolve Rightmove location identifier for postcode "${postcode}"`,
      }
    }

    // Step 2: Navigate to search results using the resolved identifier.
    // Capture ALL document response bodies and keep the largest — Rightmove serves
    // a tiny JS shell first (~3 KB), then the real SSR page (~460 KB with __NEXT_DATA__).
    const searchUrl =
      `https://www.rightmove.co.uk/property-for-sale/find.html` +
      `?locationIdentifier=${encodeURIComponent(identifier)}` +
      `&includeSSTC=true&numberOfPropertiesPerPage=24&radius=0.0&sortType=6`

    const htmlBodies: string[] = []
    const responseHandler = async (response: any) => {
      try {
        if (
          response.request().resourceType() === "document" &&
          response.status() === 200
        ) {
          htmlBodies.push(await response.text())
        }
      } catch {
        // Response body may already be consumed — ignored
      }
    }
    page.on("response", responseHandler)

    try {
      await page.goto(searchUrl, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT_MS,
      })
    } catch {
      // Navigation timeout is fine — response bodies may already be captured
    }

    page.off("response", responseHandler)
    // Allow async response.text() calls time to complete
    await new Promise((r) => setTimeout(r, 2_000))

    // Use the largest captured body — that's the real Rightmove SSR page
    const rawHtml =
      htmlBodies.sort((a, b) => b.length - a.length)[0] ??
      (await page.content().catch(() => ""))

    // Check for bot detection
    const pageTitle = await page.title().catch(() => "")
    if (
      pageTitle.toLowerCase().includes("challenge") ||
      pageTitle.toLowerCase().includes("captcha") ||
      pageTitle.toLowerCase().includes("blocked") ||
      pageTitle.toLowerCase().includes("access denied")
    ) {
      return {
        source,
        status: "blocked",
        listings: [],
        matchedListings: [],
        errorMessage: "Bot detection triggered on search page",
      }
    }

    // Step 3: Extract property listings from __NEXT_DATA__.
    // Rightmove has migrated to Next.js — data is at:
    //   pageProps.searchResults.properties  (confirmed by debug script)
    // Parse from raw HTML first; fall back to live DOM if needed.
    let properties: any[] = []

    const extractFromNextData = (html: string): any[] => {
      const match = html.match(
        /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
      )
      if (!match) return []
      try {
        const nd = JSON.parse(match[1])
        return nd?.props?.pageProps?.searchResults?.properties ?? []
      } catch {
        return []
      }
    }

    properties = extractFromNextData(rawHtml)

    if (properties.length === 0) {
      // Fall back to live DOM __NEXT_DATA__
      const ndRaw: string | null = await page
        .evaluate(() => {
          const el = document.getElementById("__NEXT_DATA__")
          return el ? el.textContent : null
        })
        .catch(() => null)
      if (ndRaw) {
        try {
          const nd = JSON.parse(ndRaw)
          properties = nd?.props?.pageProps?.searchResults?.properties ?? []
        } catch {
          // Ignore
        }
      }
    }

    const listings: LivePortalListing[] = properties.map((p: any) => ({
      listingUrl: p.propertyUrl
        ? `https://www.rightmove.co.uk${p.propertyUrl}`
        : p.id
          ? `https://www.rightmove.co.uk/properties/${p.id}`
          : null,
      price: p.price?.amount ?? 0,
      address: p.displayAddress ?? "",
      isSoldSTC:
        (p.displayStatus ?? "").toLowerCase().includes("sold") ||
        (p.productLabel?.title ?? "").toLowerCase().includes("sold"),
      bedrooms: p.bedrooms ?? null,
      propertyType: p.propertySubType ?? p.propertyType?.displayName ?? null,
      agent: p.customer
        ? {
            name:
              p.customer.brandPlusDisplayName ??
              p.customer.brandDisplayName ??
              p.customer.branchDisplayName,
            phone: p.customer.contactTelephone,
          }
        : null,
    }))

    const matchedListings = listings.filter((l) =>
      addressesMatch(l.address, vendorAddress)
    )
    return {
      source,
      status: listings.length === 0 ? "no_listings" : "success",
      listings,
      matchedListings,
    }
  } catch (err: any) {
    return {
      source,
      status: "error",
      listings: [],
      matchedListings: [],
      errorMessage: err.message ?? "Unknown error",
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function checkZoopla(
  browser: Browser,
  postcode: string,
  vendorAddress: string
): Promise<LivePortalResult> {
  const source = "ZOOPLA" as const
  const page = await setupPage(browser, true)

  try {
    // Zoopla uses slug-based URLs: postcode/outcode in the path, not a query param.
    // "SW16 3RD" → "sw16-3rd", "SW16" → "sw16"
    const postcodeSlug = postcode.toLowerCase().replace(/\s+/g, "-")
    const outcodeSlug = postcode.split(" ")[0].toLowerCase()

    const zooplaExtract = async (slugUrl: string): Promise<any[]> => {
      await page.goto(slugUrl, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT_MS,
      })
      await dismissCookieConsent(page)
      // Zoopla renders via RSC — give it 2 s to hydrate listing cards
      await new Promise((r) => setTimeout(r, 2_000))

      return page.evaluate(() => {
        const seen = new Set<string>()
        const results: any[] = []

        // Primary selector: confirmed working for SW16 3RD
        const primaryCards = document.querySelectorAll(
          "a[data-testid='listing-card-content'][href*='/for-sale/details/']"
        )
        // Fallback: any /for-sale/details/ link (deduplicated by listing ID)
        const fallbackCards = primaryCards.length === 0
          ? document.querySelectorAll("a[href*='/for-sale/details/']")
          : primaryCards

        fallbackCards.forEach((card) => {
          const href = card.getAttribute("href") ?? ""
          const m = href.match(/\/for-sale\/details\/(\d+)\//)
          if (!m || seen.has(m[1])) return
          seen.add(m[1])
          const address =
            (card as HTMLElement).querySelector("address")?.textContent?.trim() ?? ""
          const rawPrice =
            (card as HTMLElement).querySelector("p")?.textContent?.trim() ?? ""
          const isSoldSTC = /sold stc|sstc|under offer/i.test(
            (card as HTMLElement).textContent?.toLowerCase() ?? ""
          )
          results.push({ listingId: m[1], address, rawPrice, isSoldSTC })
        })
        return results
      }).catch(() => [])
    }

    // Try full postcode slug first; if it returns 0 results fall back to outcode
    let rawListings = await zooplaExtract(
      `https://www.zoopla.co.uk/for-sale/property/${postcodeSlug}/?include_sstc=true`
    )
    if (rawListings.length === 0) {
      rawListings = await zooplaExtract(
        `https://www.zoopla.co.uk/for-sale/property/${outcodeSlug}/?include_sstc=true`
      )
    }

    const listings: LivePortalListing[] = rawListings
      .map((l: any) => ({
        listingUrl: `https://www.zoopla.co.uk/for-sale/details/${l.listingId}/`,
        price: parseInt((l.rawPrice ?? "").replace(/[£,\s]/g, "")) || 0,
        address: l.address ?? "",
        isSoldSTC: l.isSoldSTC ?? false,
        bedrooms: null,
        propertyType: null,
        agent: null,
      }))
      .filter((l) => l.address)

    const matchedListings = listings.filter((l) =>
      addressesMatch(l.address, vendorAddress)
    )
    return {
      source,
      status: listings.length === 0 ? "no_listings" : "success",
      listings,
      matchedListings,
    }
  } catch (err: any) {
    return {
      source,
      status: "error",
      listings: [],
      matchedListings: [],
      errorMessage: err.message ?? "Unknown error",
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function checkOnTheMarket(
  browser: Browser,
  postcode: string,
  vendorAddress: string
): Promise<LivePortalResult> {
  const source = "ONTHEMARKET" as const
  const page = await setupPage(browser, true)

  try {
    // OTM uses slug-based search URLs: "SW16 3RD" → "sw16-3rd"
    const slug = postcode.toLowerCase().replace(/\s+/g, "-")
    const url = `https://www.onthemarket.com/for-sale/property/${slug}/`

    await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT_MS,
    })
    await dismissCookieConsent(page)

    const nextData: any = await page.evaluate(() => {
      const el = document.getElementById("__NEXT_DATA__")
      if (!el) return null
      try {
        return JSON.parse(el.textContent ?? "")
      } catch {
        return null
      }
    })

    if (!nextData) {
      return {
        source,
        status: "error",
        listings: [],
        matchedListings: [],
        errorMessage: "No __NEXT_DATA__ found on OnTheMarket search page",
      }
    }

    // OTM stores listings at: props.initialReduxState.results.list
    // (NOT pageProps.listings or initialReduxState.properties)
    // Field names: address, price (string "£325,000"), id, details-url,
    //              main-label, features (string[]), humanised-property-type
    const rawList: any[] =
      nextData?.props?.initialReduxState?.results?.list ?? []

    const listings: LivePortalListing[] = rawList
      .map((l: any) => {
        const priceStr = String(l.price ?? l["short-price"] ?? "")
        const price = parseInt(priceStr.replace(/[£,\s]/g, "")) || 0
        const featuresArr: string[] = Array.isArray(l.features) ? l.features : []
        const mainLabel = String(l["main-label"] ?? "").toLowerCase()
        const isSoldSTC =
          mainLabel.includes("stc") ||
          mainLabel.includes("sold") ||
          featuresArr.some((f) => /sstc|sold stc|under offer/i.test(f))
        return {
          listingUrl: l["details-url"]
            ? `https://www.onthemarket.com${l["details-url"]}`
            : l.id
              ? `https://www.onthemarket.com/details/${l.id}/`
              : null,
          price,
          address: l.address ?? "",
          isSoldSTC,
          bedrooms: l.bedrooms ?? null,
          propertyType: l["humanised-property-type"] ?? null,
          agent: l.agent
            ? { name: l.agent.name, phone: l.agent.telephone }
            : null,
        }
      })
      .filter((l) => l.address)

    const matchedListings = listings.filter((l) =>
      addressesMatch(l.address, vendorAddress)
    )
    return {
      source,
      status: listings.length === 0 ? "no_listings" : "success",
      listings,
      matchedListings,
    }
  } catch (err: any) {
    return {
      source,
      status: "error",
      listings: [],
      matchedListings: [],
      errorMessage: err.message ?? "Unknown error",
    }
  } finally {
    await page.close().catch(() => {})
  }
}

async function checkPrimeLocation(
  browser: Browser,
  postcode: string,
  vendorAddress: string
): Promise<LivePortalResult> {
  const source = "PRIMELOCATION" as const
  const page = await setupPage(browser, true)

  try {
    // PrimeLocation (Zoopla Group) uses slug-based URLs — same RSC architecture as Zoopla.
    // PL does NOT use data-testid="listing-card-content"; cards use class-based selectors.
    // Addresses are reliably available in the RSC payload as "address" JSON fields.
    const slug = postcode.toLowerCase().replace(/\s+/g, "-")
    const url = `https://www.primelocation.com/for-sale/property/${slug}/`

    // Capture raw HTML for RSC extraction
    const htmlBodies: string[] = []
    const responseHandler = async (response: any) => {
      try {
        if (
          response.request().resourceType() === "document" &&
          response.status() === 200
        ) {
          htmlBodies.push(await response.text())
        }
      } catch {}
    }
    page.on("response", responseHandler)

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: PAGE_TIMEOUT_MS,
      })
    } catch {}

    page.off("response", responseHandler)
    await dismissCookieConsent(page)
    await new Promise((r) => setTimeout(r, 2_000))

    const rawHtml =
      htmlBodies.sort((a, b) => b.length - a.length)[0] ??
      (await page.content().catch(() => ""))

    // Primary: DOM extraction — walk all /for-sale/details/ links, prefer whichever
    // copy of each listing contains an <address> element (text link vs image link).
    let rawListings: any[] = await page
      .evaluate(() => {
        const byId = new Map<string, any>()
        document
          .querySelectorAll("a[href*='/for-sale/details/']")
          .forEach((card) => {
            const href = (card as HTMLAnchorElement).getAttribute("href") ?? ""
            const m = href.match(/\/for-sale\/details\/(\d+)\//)
            if (!m) return
            const id = m[1]
            const address =
              (card as HTMLElement).querySelector("address")?.textContent?.trim() ?? ""
            const rawPrice =
              (card as HTMLElement).querySelector("p")?.textContent?.trim() ?? ""
            const isSoldSTC = /sold stc|sstc|under offer/i.test(
              (card as HTMLElement).textContent?.toLowerCase() ?? ""
            )
            // Keep the record with an address when both image and text links exist
            if (!byId.has(id) || (!byId.get(id).address && address)) {
              byId.set(id, { listingId: id, address, rawPrice, isSoldSTC })
            }
          })
        return Array.from(byId.values())
      })
      .catch(() => [])

    // Fallback: extract addresses from RSC payload when DOM cards lack address text
    if (rawListings.every((l) => !l.address) && rawHtml) {
      const rscRe = /self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g
      const chunks: string[] = []
      let m: RegExpExecArray | null
      while ((m = rscRe.exec(rawHtml)) !== null) chunks.push(m[1])
      const decoded = chunks.join("").replace(/\\"/g, '"').replace(/\\n/g, "\n")
      const addrRe = /"address":"([^"]+)"/g
      const rscAddresses: string[] = []
      while ((m = addrRe.exec(decoded)) !== null) {
        if (!rscAddresses.includes(m[1])) rscAddresses.push(m[1])
      }
      if (rscAddresses.length > 0) {
        // Merge RSC addresses into DOM-extracted stubs by index
        rawListings = rawListings.length > 0
          ? rawListings.map((l, i) => ({ ...l, address: rscAddresses[i] ?? "" }))
          : rscAddresses.map((addr) => ({ address: addr, rawPrice: "", isSoldSTC: false }))
      }
    }

    const listings: LivePortalListing[] = rawListings
      .map((l: any) => ({
        listingUrl: l.listingId
          ? `https://www.primelocation.com/for-sale/details/${l.listingId}/`
          : null,
        price: parseInt((l.rawPrice ?? "").replace(/[£,\s]/g, "")) || 0,
        address: l.address ?? "",
        isSoldSTC: l.isSoldSTC ?? false,
        bedrooms: null,
        propertyType: null,
        agent: null,
      }))
      .filter((l) => l.address)

    const matchedListings = listings.filter((l) =>
      addressesMatch(l.address, vendorAddress)
    )
    return {
      source,
      status: listings.length === 0 ? "no_listings" : "success",
      listings,
      matchedListings,
    }
  } catch (err: any) {
    return {
      source,
      status: "error",
      listings: [],
      matchedListings: [],
      errorMessage: err.message ?? "Unknown error",
    }
  } finally {
    await page.close().catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// Flag generation
// ---------------------------------------------------------------------------

function generateLiveFlags(results: LivePortalResult[]): PortalFlag[] {
  const flags: PortalFlag[] = []

  const activeSources = results
    .filter((r) => r.matchedListings.some((l) => !l.isSoldSTC))
    .map((r) => r.source)

  const soldSources = results
    .filter((r) => r.matchedListings.some((l) => l.isSoldSTC))
    .map((r) => r.source)

  if (activeSources.length > 0) {
    const firstMatch = results
      .find((r) => activeSources.includes(r.source))!
      .matchedListings[0]
    flags.push({
      code: "LIVE_CURRENTLY_LISTED",
      severity: "red_flag",
      label: "Live Listing Found (Direct Portal Check)",
      detail: `Property confirmed live on ${activeSources.join(", ")} at £${firstMatch.price.toLocaleString()}. Vendor must withdraw all listings before purchase can proceed.`,
    })
  }

  if (soldSources.length > 0) {
    flags.push({
      code: "LIVE_SOLD_STC",
      severity: "caution",
      label: "Sold STC / Under Offer (Direct Portal Check)",
      detail: `Property shows as Sold STC or Under Offer on ${soldSources.join(", ")}. Confirm vendor's current situation before progressing.`,
    })
  }

  return flags
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runLivePortalCheck(opts: {
  postcode: string
  vendorAddress: string
  vendorAskingPrice: number
  isMock?: boolean
  mockScenario?: MockScenarioId
}): Promise<LivePortalCheckResult> {
  const { postcode, vendorAddress, vendorAskingPrice, isMock, mockScenario } =
    opts

  if (isMock && mockScenario) {
    return getMockLivePortalResults(mockScenario, vendorAskingPrice, vendorAddress)
  }

  if (!postcode) {
    return {
      results: [],
      flags: [],
      hasMatches: false,
      blockedPortals: [],
      isMockData: false,
    }
  }

  let browser: Browser | null = null

  try {
    browser = await launchBrowser()

    // All 4 portals run in parallel — separate pages, shared browser instance
    const [rightmove, zoopla, otm, primelocation] = await Promise.all([
      checkRightmove(browser, postcode, vendorAddress),
      checkZoopla(browser, postcode, vendorAddress),
      checkOnTheMarket(browser, postcode, vendorAddress),
      checkPrimeLocation(browser, postcode, vendorAddress),
    ])

    const results = [rightmove, zoopla, otm, primelocation]
    const flags = generateLiveFlags(results)
    const hasMatches = results.some((r) => r.matchedListings.length > 0)
    const blockedPortals = results
      .filter((r) => r.status === "blocked" || r.status === "error")
      .map((r) => r.source)

    return { results, flags, hasMatches, blockedPortals, isMockData: false }
  } finally {
    if (browser) await browser.close().catch(() => {})
  }
}
