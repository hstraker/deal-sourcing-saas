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
import { Prisma } from "@prisma/client"
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

  // Pick up listings that have never been enriched (propertyDataAnalysis IS NULL in the DB).
  // Prisma requires Prisma.DbNull to match SQL NULL on a Json? column —
  // using plain `null` or `{ equals: null }` matches JSON literal null, not SQL NULL.
  const listings = await prisma.propertyListing.findMany({
    where: {
      propertyDataAnalysis: { equals: Prisma.DbNull },
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
