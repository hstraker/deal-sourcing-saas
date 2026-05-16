/**
 * GET  /api/investor/deals/[id]  — full deal detail (tracks view)
 * POST /api/investor/deals/[id]  — toggle favorite
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    include: {
      photos: {
        orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        select: { id: true, s3Key: true, url: true, isCover: true, caption: true },
      },
    },
  })

  if (!deal || !["listed", "reserved"].includes(deal.status)) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  // Track view
  const investor = await prisma.investor.findFirst({
    where: { userId: session.user.id },
    select: { id: true, favorites: { where: { dealId: params.id }, select: { id: true } } },
  })

  if (investor) {
    // Create a new view record (each visit is tracked separately)
    await prisma.dealView.create({
      data: { dealId: params.id, investorId: investor.id },
    }).catch(() => {/* ignore errors */})

    // Increment viewsCount
    await prisma.deal.update({
      where: { id: params.id },
      data: { viewsCount: { increment: 1 } },
    }).catch(() => {})
  }

  // Check for existing reservation
  const reservation = investor
    ? await prisma.investorReservation.findFirst({
        where: { dealId: params.id, investorId: investor.id, status: { not: "cancelled" } },
        select: { id: true, status: true, createdAt: true },
      })
    : null

  const isFavorited = (investor?.favorites.length ?? 0) > 0

  return NextResponse.json({
    deal: {
      ...deal,
      askingPrice: deal.askingPrice ? Number(deal.askingPrice) : null,
      marketValue: deal.marketValue ? Number(deal.marketValue) : null,
      estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
      estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
      bmvPercentage: deal.bmvPercentage ? Number(deal.bmvPercentage) : null,
      grossYield: deal.grossYield ? Number(deal.grossYield) : null,
      netYield: deal.netYield ? Number(deal.netYield) : null,
    },
    isFavorited,
    reservation,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const investor = await prisma.investor.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!investor) return NextResponse.json({ error: "Investor profile not found" }, { status: 404 })

  const body = await request.json()
  const action = body.action as string  // "favorite" | "unfavorite"

  if (action === "favorite") {
    await prisma.favorite.upsert({
      where: { investorId_dealId: { investorId: investor.id, dealId: params.id } },
      create: { investorId: investor.id, dealId: params.id },
      update: {},
    })
    await prisma.deal.update({
      where: { id: params.id },
      data: { favoritesCount: { increment: 1 } },
    }).catch(() => {})
    return NextResponse.json({ favorited: true })
  }

  if (action === "unfavorite") {
    await prisma.favorite.deleteMany({
      where: { investorId: investor.id, dealId: params.id },
    })
    await prisma.deal.update({
      where: { id: params.id },
      data: { favoritesCount: { decrement: 1 } },
    }).catch(() => {})
    return NextResponse.json({ favorited: false })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
