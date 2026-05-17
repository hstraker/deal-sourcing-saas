/**
 * GET /api/investor/deals
 *
 * Returns deals visible to investors: status = "listed" or "reserved".
 * Attaches `isFavorited` flag for the calling investor.
 * Supports ?search=, ?minBedrooms=, ?maxPrice=, ?strategy= filters.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Find this investor's record
  const investor = await prisma.investor.findFirst({
    where: { userId: session.user.id },
    select: { id: true, favorites: { select: { dealId: true } } },
  })

  const favoritedIds = new Set(investor?.favorites.map((f) => f.dealId) ?? [])

  const sp = request.nextUrl.searchParams
  const search      = sp.get("search") ?? ""
  const minBedrooms = sp.get("minBedrooms") ? Number(sp.get("minBedrooms")) : null
  const maxPrice    = sp.get("maxPrice")    ? Number(sp.get("maxPrice"))    : null
  const strategy    = sp.get("strategy")   ?? ""   // "BTL" | "Flip" | "BRR" | ""

  const where: any = {
    status: { in: ["listed", "reserved"] },
  }

  if (search) {
    where.OR = [
      { address: { contains: search, mode: "insensitive" } },
      { postcode: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } },
    ]
  }
  if (minBedrooms) where.bedrooms = { gte: minBedrooms }
  if (maxPrice)    where.askingPrice = { lte: maxPrice }

  const deals = await prisma.deal.findMany({
    where,
    select: {
      id: true,
      address: true,
      postcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      squareFeet: true,
      askingPrice: true,
      marketValue: true,
      estimatedRefurbCost: true,
      estimatedMonthlyRent: true,
      bmvPercentage: true,
      grossYield: true,
      netYield: true,
      dealScore: true,
      status: true,
      packTier: true,
      listedAt: true,
      viewsCount: true,
      favoritesCount: true,
      photos: {
        where: { isCover: true },
        take: 1,
        select: { s3Key: true, s3Url: true },
      },
      _count: {
        select: { photos: true },
      },
    },
    orderBy: { listedAt: "desc" },
    take: 100,
  })

  const result = deals.map((d) => ({
    ...d,
    askingPrice: d.askingPrice ? Number(d.askingPrice) : null,
    marketValue: d.marketValue ? Number(d.marketValue) : null,
    estimatedMonthlyRent: d.estimatedMonthlyRent ? Number(d.estimatedMonthlyRent) : null,
    estimatedRefurbCost: d.estimatedRefurbCost ? Number(d.estimatedRefurbCost) : null,
    bmvPercentage: d.bmvPercentage ? Number(d.bmvPercentage) : null,
    grossYield: d.grossYield ? Number(d.grossYield) : null,
    netYield: d.netYield ? Number(d.netYield) : null,
    isFavorited: favoritedIds.has(d.id),
    isReserved: d.status === "reserved",
    coverPhoto: d.photos[0] ? { url: d.photos[0].s3Url, s3Key: d.photos[0].s3Key } : null,
  }))

  return NextResponse.json({ deals: result })
}
