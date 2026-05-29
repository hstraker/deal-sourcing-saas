/**
 * GET /api/properties/listings/[id]/portal-data
 *
 * Fetches live portal intelligence for a scraped property listing:
 *   1. Listing history  — when was this address previously listed, at what price, via which agent?
 *   2. Active listings  — is it currently on multiple portals / agents?
 *   3. Sold price match — address-matched entries from the area sold-price dataset
 *                         to approximate a property-specific sold history.
 *
 * Results are cached back into the listing's propertyDataAnalysis JSON field
 * (under the "portalData" key) so repeat opens cost 0 credits.
 * Cache TTL: 24 h — after which the next open re-fetches.
 *
 * Requires PROPERTYDATA_API_KEY.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  fetchListingHistory,
  fetchForSaleListings,
  fetchSoldPrices,
  filterComparables,
} from "@/lib/propertydata"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const listing = await prisma.propertyListing.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      address: true,
      bedrooms: true,
      propertyType: true,
      price: true,
      propertyDataAnalysis: true,
    },
  })

  if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const address = listing.address as any
  const postcode: string | undefined = address?.postcode

  if (!postcode || !postcode.includes(" ")) {
    return NextResponse.json({ error: "No full postcode available for this listing" }, { status: 422 })
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  const existingAnalysis = (listing.propertyDataAnalysis ?? {}) as Record<string, any>
  const cached = existingAnalysis.portalData as any
  if (cached?.fetchedAt) {
    const hoursSince = (Date.now() - new Date(cached.fetchedAt).getTime()) / 3_600_000
    if (hoursSince < 24) {
      return NextResponse.json({ cached: true, ...cached })
    }
  }

  if (!process.env.PROPERTYDATA_API_KEY) {
    return NextResponse.json({ error: "PropertyData API key not configured" }, { status: 503 })
  }

  // ── Fetch from PropertyData ────────────────────────────────────────────────
  const [historyResult, forSaleResult, soldResult] = await Promise.allSettled([
    fetchListingHistory(postcode, 0.1),   // tight radius — this specific address
    fetchForSaleListings(postcode, 0.1),  // tight radius — other agents at same postcode
    fetchSoldPrices(postcode, undefined, 0.25, 50), // slightly wider for sold history
  ])

  const history  = historyResult.status  === "fulfilled" ? historyResult.value  : null
  const forSale  = forSaleResult.status  === "fulfilled" ? forSaleResult.value  : null
  const soldData = soldResult.status     === "fulfilled" ? soldResult.value      : null

  // ── Extract address-matched sold price entries ─────────────────────────────
  const displayAddress: string = address?.displayAddress ?? ""
  const houseNumber = displayAddress.match(/^\d+[a-zA-Z]?/)?.[0]?.toLowerCase()

  const soldMatches = soldData?.soldProperties.filter((p) => {
    if (!p.address) return false
    const pAddr = p.address.toLowerCase()
    // Match on house number AND at least one street word
    const streetWords = displayAddress.toLowerCase().split(/[\s,]+/).filter(w => w.length > 3 && !/^\d/.test(w))
    const numberMatch = houseNumber ? pAddr.includes(houseNumber) : false
    const streetMatch = streetWords.some(w => pAddr.includes(w))
    return numberMatch && streetMatch
  }) ?? []

  // Sort sold history newest first
  soldMatches.sort((a, b) => new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime())

  // ── Build response ─────────────────────────────────────────────────────────
  const portalData = {
    fetchedAt: new Date().toISOString(),
    listingHistory: history?.history ?? [],
    activeListings: forSale?.listings ?? [],
    soldHistory: soldMatches.slice(0, 10),
  }

  // ── Cache into propertyDataAnalysis ───────────────────────────────────────
  await prisma.propertyListing.update({
    where: { id: params.id },
    data: {
      propertyDataAnalysis: {
        ...existingAnalysis,
        portalData,
      },
    },
  })

  return NextResponse.json({ cached: false, ...portalData })
}
