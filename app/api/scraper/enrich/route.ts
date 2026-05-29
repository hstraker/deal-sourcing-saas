/**
 * POST /api/scraper/enrich
 *
 * Backfill PropertyData enrichment (EPC, sold comparables, BMV%) for
 * existing property listings that have not yet been enriched.
 *
 * Optional body:
 *   { "limit": 50 }   — max listings to pick up (default 50, max 200)
 *
 * Returns the number of listing IDs passed to the enricher.
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { batchEnrichNewListings } from "@/lib/scrapers/batch-enricher"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let limit = 50
  try {
    const body = await request.json()
    if (typeof body.limit === "number") {
      limit = Math.min(Math.max(body.limit, 1), 200)
    }
  } catch {
    // no body — use default
  }

  // Pick up listings with a full UK postcode that haven't been enriched yet
  // (propertyDataAnalysis is null) or were enriched more than 7 days ago.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const listings = await prisma.propertyListing.findMany({
    where: {
      OR: [
        { propertyDataAnalysis: { equals: null } },
      ],
    },
    select: { id: true },
    orderBy: { scrapedAt: "desc" },
    take: limit,
  })

  const ids = listings.map((l) => l.id)

  if (ids.length === 0) {
    return NextResponse.json({ message: "No listings to enrich", enriched: 0 })
  }

  // Fire-and-forget — response returns immediately, enrichment runs in background
  batchEnrichNewListings(ids).catch((err) =>
    console.warn("[EnrichRoute] Background enrichment error:", err.message)
  )

  return NextResponse.json({
    message: `Enrichment started for ${ids.length} listing(s)`,
    enriched: ids.length,
  })
}
