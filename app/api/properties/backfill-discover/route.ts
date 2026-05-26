/**
 * POST /api/properties/backfill-discover
 *
 * Admin-only endpoint that:
 *  1. Streams through all PropertyListings in batches of 100
 *  2. Computes motivationScore + motivationSignals using lib/motivation-scorer
 *  3. Computes isWelsh + jurisdiction using lib/welsh-detection
 *  4. Computes strategyViability using lib/strategy-viability
 *  5. Writes results back to DB
 *
 * Returns { processed, updated, skipped } summary.
 *
 * Safe to run multiple times (idempotent).
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { computeMotivationScore } from "@/lib/motivation-scorer"
import { computeStrategyViability } from "@/lib/strategy-viability"
import { detectWelshJurisdiction } from "@/lib/welsh-detection"
import { toPropertyListingForClient } from "@/types/property-listing"

const BATCH_SIZE = 100

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden — admin only" }, { status: 403 })
  }

  let processed = 0
  let updated   = 0
  let cursor: string | undefined

  try {
    while (true) {
      const batch = await prisma.propertyListing.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        orderBy: { id: "asc" },
      })

      if (batch.length === 0) break

      cursor = batch[batch.length - 1].id
      processed += batch.length

      await Promise.all(
        batch.map(async (raw) => {
          const listing = toPropertyListingForClient(raw)
          const address = listing.address as any

          // Welsh detection
          const { isWelsh, jurisdiction } = detectWelshJurisdiction(address?.postcode)

          // Motivation scoring
          const { motivationScore, motivationSignals } = computeMotivationScore({
            price:         listing.price,
            priceHistory:  listing.priceHistory ?? [],
            bmvIndicators: listing.bmvIndicators,
            epcRating:     listing.epcRating,
            isChainFree:   listing.isChainFree,
            keyFeatures:   listing.keyFeatures,
            daysOnMarket:  listing.daysOnMarket,
            listedDate:    listing.listedDate,
          })

          // Strategy viability
          const strategyViability = computeStrategyViability({
            price:               listing.price,
            bedrooms:            listing.bedrooms,
            propertyType:        listing.propertyType,
            epcRating:           listing.epcRating,
            isChainFree:         listing.isChainFree,
            tenure:              listing.tenure,
            leaseYearsRemaining: listing.leaseYearsRemaining,
            daysOnMarket:        listing.daysOnMarket,
            bmvIndicators:       listing.bmvIndicators,
            isWelsh,
            keyFeatures:         listing.keyFeatures,
          })

          await prisma.propertyListing.update({
            where: { id: raw.id },
            data: {
              motivationScore,
              motivationSignals: motivationSignals as any,
              isWelsh,
              jurisdiction,
              strategyViability: strategyViability as any,
            },
          })

          updated++
        })
      )
    }

    return NextResponse.json({ success: true, processed, updated })
  } catch (error: any) {
    console.error("[Backfill Discover] Error:", error)
    return NextResponse.json(
      { error: error.message || "Backfill failed", processed, updated },
      { status: 500 }
    )
  }
}
