/**
 * GET  /api/investor/reservations  — list this investor's reservations
 * POST /api/investor/reservations  — register interest (creates pending reservation, no payment)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const investor = await prisma.investor.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
  })
  if (!investor) return NextResponse.json({ reservations: [] })

  const reservations = await prisma.investorReservation.findMany({
    where: { investorId: investor.id },
    include: {
      deal: {
        select: {
          id: true,
          address: true,
          postcode: true,
          propertyType: true,
          bedrooms: true,
          askingPrice: true,
          bmvPercentage: true,
          grossYield: true,
          status: true,
          photos: {
            where: { isCover: true },
            take: 1,
            select: { url: true, s3Key: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json({
    reservations: reservations.map((r) => ({
      ...r,
      reservationFee: r.reservationFee ? Number(r.reservationFee) : null,
      deal: {
        ...r.deal,
        askingPrice: r.deal.askingPrice ? Number(r.deal.askingPrice) : null,
        bmvPercentage: r.deal.bmvPercentage ? Number(r.deal.bmvPercentage) : null,
        grossYield: r.deal.grossYield ? Number(r.deal.grossYield) : null,
        coverPhoto: r.deal.photos[0] ?? null,
      },
    })),
  })
}

export async function POST(request: NextRequest) {
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
  const { dealId, notes } = body

  if (!dealId) return NextResponse.json({ error: "dealId is required" }, { status: 400 })

  // Check deal is available
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: { id: true, status: true, address: true },
  })
  if (!deal || !["listed", "reserved"].includes(deal.status)) {
    return NextResponse.json({ error: "Deal not available" }, { status: 400 })
  }

  // Prevent duplicate interest registrations
  const existing = await prisma.investorReservation.findFirst({
    where: { investorId: investor.id, dealId, status: { not: "cancelled" } },
  })
  if (existing) {
    return NextResponse.json({ error: "You have already registered interest in this deal" }, { status: 409 })
  }

  // Create the reservation in "pending" status — no payment yet
  const reservation = await prisma.investorReservation.create({
    data: {
      id: randomUUID(),
      investorId: investor.id,
      dealId,
      status: "pending",
      reservationFee: 0,  // Stripe will be added later
      notes: notes ?? null,
    },
  })

  // Log activity
  await prisma.investorActivity.create({
    data: {
      investorId: investor.id,
      activityType: "RESERVATION_MADE",
      dealId,
      reservationId: reservation.id,
      metadata: { deal: deal.address, status: "pending" },
    },
  }).catch(() => {})

  // Update deal status → reserved if it was listed
  if (deal.status === "listed") {
    await prisma.deal.update({
      where: { id: dealId },
      data: { status: "reserved" },
    }).catch(() => {})
  }

  return NextResponse.json({ reservation }, { status: 201 })
}
