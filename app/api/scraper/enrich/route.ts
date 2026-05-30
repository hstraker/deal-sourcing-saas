/**
 * POST /api/scraper/enrich
 *
 * Backfill PropertyData enrichment (EPC, sold comparables, BMV%) for
 * existing property listings that have not yet been enriched.
 *
 * No limit parameter needed — the endpoint fetches ALL unenriched listings
 * and passes them to the enricher.  The enricher itself caps at
 * MAX_POSTCODES_PER_RUN postcodes per run to protect the credit budget.
 * The response includes how many listings/postcodes were deferred so the
 * client can show accurate "click again" messaging.
 *
 * Returns:
 *   {
 *     enriched:            number   — listings covered by this run's postcodes
 *     deferredListings:    number   — listings whose postcode is beyond the cap
 *     processingPostcodes: number   — postcodes being enriched now
 *     deferredPostcodes:   number   — postcodes queued for the next click
 *     totalListings:       number   — total unenriched listings found
 *   }
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import { batchEnrichNewListings } from "@/lib/scrapers/batch-enricher"

/** Must match MAX_POSTCODES_PER_RUN in batch-enricher.ts */
const MAX_POSTCODES_PER_RUN = 15

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Fetch ALL unenriched listing IDs + addresses (lightweight — IDs + JSON address only).
  // Prisma requires Prisma.DbNull to match SQL NULL on a Json? column.
  const listings = await prisma.propertyListing.findMany({
    where: {
      propertyDataAnalysis: { equals: Prisma.DbNull },
    },
    select: { id: true, address: true },
    orderBy: { scrapedAt: "desc" },
  })

  if (listings.length === 0) {
    return NextResponse.json({
      message: "No listings to enrich",
      enriched: 0,
      deferredListings: 0,
      processingPostcodes: 0,
      deferredPostcodes: 0,
      totalListings: 0,
    })
  }

  // ── Mirror the postcode-grouping logic from batch-enricher so we can return
  //    accurate counts BEFORE the async enrichment actually runs. ─────────────
  const byPostcode = new Map<string, string[]>()
  const noPostcodeIds: string[] = []

  for (const l of listings) {
    const pc = (l.address as any)?.postcode as string | undefined
    if (!pc?.includes(" ")) {
      noPostcodeIds.push(l.id)
      continue
    }
    const key = pc.toUpperCase()
    if (!byPostcode.has(key)) byPostcode.set(key, [])
    byPostcode.get(key)!.push(l.id)
  }

  // Sort postcodes: most listings first (mirrors batch-enricher priority).
  const allPostcodes = [...byPostcode.keys()].sort(
    (a, b) => byPostcode.get(b)!.length - byPostcode.get(a)!.length
  )
  const processingPostcodes = allPostcodes.slice(0, MAX_POSTCODES_PER_RUN)
  const deferredPostcodeKeys = allPostcodes.slice(MAX_POSTCODES_PER_RUN)

  const listingsInBatch = processingPostcodes.reduce(
    (n, pc) => n + byPostcode.get(pc)!.length,
    0
  )
  const listingsDeferred = listings.length - listingsInBatch - noPostcodeIds.length

  // ── Fire-and-forget — response returns immediately ─────────────────────────
  const ids = listings.map((l) => l.id)
  batchEnrichNewListings(ids).catch((err) =>
    console.warn("[EnrichRoute] Background enrichment error:", err.message)
  )

  return NextResponse.json({
    message: `Enrichment started`,
    enriched: listingsInBatch,
    deferredListings: Math.max(0, listingsDeferred),
    processingPostcodes: processingPostcodes.length,
    deferredPostcodes: deferredPostcodeKeys.length,
    totalListings: listings.length,
  })
}
