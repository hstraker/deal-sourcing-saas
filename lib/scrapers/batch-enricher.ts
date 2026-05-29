/**
 * lib/scrapers/batch-enricher.ts
 *
 * Post-scrape enrichment pipeline for property listings.
 *
 * Runs after each scraper job and enriches newly saved listings with:
 *   1. EPC rating (PropertyData /energy-efficiency) — fills gaps the scraper missed
 *   2. Sold comparable prices (PropertyData /sold-prices) → calculates true BMV%
 *   3. Rental estimate (PropertyData /rents) → gross yield
 *   4. Re-scores motivationScore if EPC was updated
 *
 * Credit strategy: groups listings by postcode so each API call services
 * ALL listings in that postcode, not just one. Minimises credit spend.
 *
 * Safety guards:
 *   - Skips listings enriched within the last 48 h
 *   - Skips listings without a full UK postcode
 *   - Requires PROPERTYDATA_API_KEY env var
 *   - Caps to MAX_POSTCODES_PER_RUN to protect the credit budget
 */

import { prisma } from "../db"
import {
  fetchEpcData,
  matchEpcRecord,
  fetchSoldPrices,
  filterComparables,
  calculateAverageComparablePrice,
  fetchRentalData,
} from "../propertydata"
import { computeMotivationScore } from "../motivation-scorer"

const LOG_PREFIX = "[Enricher]"

/** Hard cap: postcodes enriched per scraper run.
 *  Each postcode costs ≤ 3 credits (EPC + sold prices + rents).
 *  At 2000 credits/month and 60 runs/month → ≈ 33 credits/run → 11 postcodes/run.
 *  We set 15 to give a comfortable margin but stay well under the monthly limit.
 */
const MAX_POSTCODES_PER_RUN = 15

/** Skip listings enriched more recently than this. */
const ENRICH_TTL_HOURS = 48

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Enrich a batch of newly scraped listing IDs.
 * Groups by postcode, fetches external data once per postcode, then updates
 * each listing in the group.  Designed to run fire-and-forget after a scrape.
 */
export async function batchEnrichNewListings(listingIds: string[]): Promise<void> {
  if (!process.env.PROPERTYDATA_API_KEY) {
    console.log(`${LOG_PREFIX} PROPERTYDATA_API_KEY not set — skipping enrichment`)
    return
  }

  if (listingIds.length === 0) return

  console.log(`${LOG_PREFIX} Starting enrichment for ${listingIds.length} listing(s)`)

  // ── Load listing data ────────────────────────────────────────────────────────
  const listings = await prisma.propertyListing.findMany({
    where: { id: { in: listingIds } },
    select: {
      id: true,
      price: true,
      bedrooms: true,
      propertyType: true,
      epcRating: true,
      address: true,
      bmvIndicators: true,
      priceHistory: true,
      isChainFree: true,
      keyFeatures: true,
      daysOnMarket: true,
      listedDate: true,
      motivationScore: true,
      motivationSignals: true,
      propertyDataAnalysis: true,
    },
  })

  // ── Filter: full postcode only, not recently enriched ────────────────────────
  const eligible = listings.filter((l) => {
    const address = l.address as any
    const postcode = address?.postcode as string | undefined
    if (!postcode || !postcode.includes(" ")) return false // need full postcode

    const analysis = l.propertyDataAnalysis as any
    if (analysis?.enrichedAt) {
      const hoursSince = (Date.now() - new Date(analysis.enrichedAt).getTime()) / 3_600_000
      if (hoursSince < ENRICH_TTL_HOURS) return false
    }
    return true
  })

  if (eligible.length === 0) {
    console.log(`${LOG_PREFIX} No eligible listings (all already enriched or missing postcode)`)
    return
  }

  // ── Group by postcode (so we share API calls within the same postcode) ────────
  const byPostcode = new Map<string, typeof eligible>()
  for (const l of eligible) {
    const postcode = ((l.address as any)?.postcode as string).toUpperCase()
    if (!byPostcode.has(postcode)) byPostcode.set(postcode, [])
    byPostcode.get(postcode)!.push(l)
  }

  const postcodesAll = [...byPostcode.keys()]
  // Prioritise postcodes with the most listings (maximise credit efficiency)
  postcodesAll.sort((a, b) => byPostcode.get(b)!.length - byPostcode.get(a)!.length)
  const postcodes = postcodesAll.slice(0, MAX_POSTCODES_PER_RUN)

  console.log(
    `${LOG_PREFIX} Enriching ${postcodes.length} postcode(s) ` +
    `covering ${postcodes.reduce((n, pc) => n + byPostcode.get(pc)!.length, 0)} listing(s) ` +
    `(${postcodesAll.length - postcodes.length} postcode(s) deferred to next run)`
  )

  let totalCredits = 0

  // ── Process each postcode group ───────────────────────────────────────────────
  for (const postcode of postcodes) {
    const group = byPostcode.get(postcode)!

    try {
      // 1. EPC lookup — 1 credit, shared across all listings in this postcode
      const epcRecords = await fetchEpcData(postcode)
      totalCredits += 1

      // 2. Sold prices — 1 credit, shared
      const soldResult = await fetchSoldPrices(postcode, undefined, 3, 150)
      if (soldResult) totalCredits += soldResult.creditsUsed

      // 3. Rental estimate — 1 credit, shared (use the group's median bedroom count)
      const medianBeds = medianBedrooms(group.map((l) => l.bedrooms))
      const rentalData = await fetchRentalData(postcode, medianBeds, undefined)
      if (rentalData) totalCredits += 1

      // 4. Apply to each listing in the group
      for (const listing of group) {
        await enrichOneListing(listing, epcRecords, soldResult, rentalData)
      }

      console.log(
        `${LOG_PREFIX} ${postcode}: enriched ${group.length} listing(s) ` +
        `| EPC records: ${epcRecords?.length ?? 0} ` +
        `| Sold props: ${soldResult?.soldProperties.length ?? 0}`
      )

      // Small pause between postcodes — respect API rate limits
      await sleep(250)
    } catch (err: any) {
      console.warn(`${LOG_PREFIX} ${postcode}: enrichment failed — ${err.message}`)
    }
  }

  console.log(`${LOG_PREFIX} Enrichment complete. API credits used this run: ${totalCredits}`)
}

// ─── Per-listing enrichment ───────────────────────────────────────────────────

async function enrichOneListing(
  listing: {
    id: string
    price: any
    bedrooms: number
    propertyType: string
    epcRating: string | null
    address: any
    bmvIndicators: any
    priceHistory: any
    isChainFree: boolean | null
    keyFeatures: any
    daysOnMarket: number
    listedDate: Date | null
    motivationScore: number | null
    motivationSignals: any
  },
  epcRecords: Awaited<ReturnType<typeof fetchEpcData>>,
  soldResult: Awaited<ReturnType<typeof fetchSoldPrices>>,
  rentalData: Awaited<ReturnType<typeof fetchRentalData>>
): Promise<void> {
  const dbUpdates: Record<string, any> = {}
  const analysis: Record<string, any> = { enrichedAt: new Date().toISOString() }

  const postcode = ((listing.address as any)?.postcode as string | undefined)?.toUpperCase() ?? ""
  const askingPrice = Number(listing.price)

  // ── EPC ────────────────────────────────────────────────────────────────────
  let enrichedEpc = listing.epcRating
  if (!enrichedEpc && epcRecords && epcRecords.length > 0) {
    const address = listing.address as any
    const matched = matchEpcRecord(epcRecords, address?.displayAddress ?? null)
    if (matched) {
      enrichedEpc = matched.rating
      dbUpdates.epcRating = matched.rating
      analysis.epcRating = matched.rating
      analysis.epcScore = matched.score
      analysis.epcSource = "propertydata"
      analysis.epcInspectionDate = matched.inspectionDate.toISOString()
    }
  } else if (enrichedEpc) {
    analysis.epcRating = enrichedEpc
    analysis.epcSource = "scraped"
  }

  // ── Sold comparables → BMV% ───────────────────────────────────────────────
  if (soldResult && soldResult.soldProperties.length > 0) {
    // Progressive relaxation: strict match first, then broaden
    let comparables = filterComparables(
      soldResult.soldProperties, listing.bedrooms || undefined,
      listing.propertyType, 24, 10, postcode, 1
    )
    if (comparables.length < 3 && listing.bedrooms) {
      comparables = filterComparables(
        soldResult.soldProperties, listing.bedrooms,
        listing.propertyType, 36, 10, postcode, 2
      )
    }
    if (comparables.length < 2) {
      comparables = filterComparables(
        soldResult.soldProperties, undefined, undefined, 36, 10, postcode, 1
      )
    }

    const avgPrice = calculateAverageComparablePrice(comparables)
    if (avgPrice && avgPrice > 0) {
      const bmvPct = ((avgPrice - askingPrice) / avgPrice) * 100
      analysis.avgComparablePrice = avgPrice
      analysis.comparablesCount = comparables.length
      analysis.bmvPercent = Math.round(bmvPct * 10) / 10
      analysis.comparablesConfidence =
        comparables.length >= 5 ? "HIGH" : comparables.length >= 3 ? "MEDIUM" : "LOW"

      // Merge into bmvIndicators so the existing table/scorer can see it
      const existingBmv = (listing.bmvIndicators as any) ?? {}
      dbUpdates.bmvIndicators = {
        ...existingBmv,
        comparableAvgPrice: avgPrice,
        bmvPercent: analysis.bmvPercent,
        comparablesCount: comparables.length,
        comparablesConfidence: analysis.comparablesConfidence,
      }
    }
  }

  // ── Rental / yield ────────────────────────────────────────────────────────
  if (rentalData) {
    // Scale to this listing's bedroom count if it differs from the area fetch
    const bedsHere = listing.bedrooms || 3
    const bedsBase = medianBedrooms([listing.bedrooms]) // same as bedsHere for single item
    const ratio = BEDROOM_RENT_RATIO[Math.min(bedsHere, 6)] / BEDROOM_RENT_RATIO[Math.min(bedsBase, 6)]
    const monthlyRent = Math.round(rentalData.monthlyRent * ratio)
    const grossYield = askingPrice > 0 ? (monthlyRent * 12 / askingPrice) * 100 : null

    analysis.monthlyRentEstimate = monthlyRent
    if (grossYield !== null) analysis.grossYieldEstimate = Math.round(grossYield * 10) / 10
  }

  // ── Recalculate motivation score if EPC was enriched ─────────────────────
  if (enrichedEpc && enrichedEpc !== listing.epcRating) {
    const { motivationScore, motivationSignals } = computeMotivationScore({
      price:         askingPrice,
      priceHistory:  (listing.priceHistory as any[]) ?? [],
      bmvIndicators: (listing.bmvIndicators as any) ?? {},
      epcRating:     enrichedEpc,
      isChainFree:   listing.isChainFree,
      keyFeatures:   (listing.keyFeatures as string[]) ?? [],
      daysOnMarket:  listing.daysOnMarket,
      listedDate:    listing.listedDate?.toISOString() ?? null,
    })
    if (motivationScore !== listing.motivationScore) {
      dbUpdates.motivationScore = motivationScore
      dbUpdates.motivationSignals = motivationSignals
      analysis.motivationScoreUpdated = true
      analysis.prevMotivationScore = listing.motivationScore ?? 0
    }
  }

  // ── Write to DB ───────────────────────────────────────────────────────────
  await prisma.propertyListing.update({
    where: { id: listing.id },
    data: {
      ...dbUpdates,
      propertyDataAnalysis: analysis,
    },
  })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Bedroom count → monthly rent multiplier, relative to a 3-bed baseline. */
const BEDROOM_RENT_RATIO: Record<number, number> = {
  0: 0.52, 1: 0.70, 2: 0.86, 3: 1.00, 4: 1.18, 5: 1.35, 6: 1.50,
}

function medianBedrooms(beds: number[]): number {
  if (beds.length === 0) return 3
  const sorted = [...beds].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)] || 3
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
