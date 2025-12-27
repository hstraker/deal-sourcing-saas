import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/investors/reservations - Create new reservation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      investorId,
      dealId,
      reservationFee,
      solicitorName,
      solicitorEmail,
      solicitorPhone,
      solicitorFirm,
      notes,
    } = body

    if (!investorId || !dealId || !reservationFee) {
      return NextResponse.json(
        { error: "investorId, dealId, and reservationFee are required" },
        { status: 400 }
      )
    }

    // Check if investor exists
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    // Check if deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, address: true, status: true },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Check if deal is already reserved or sold
    if (deal.status === "reserved" || deal.status === "sold") {
      return NextResponse.json(
        { error: `Deal is already ${deal.status}` },
        { status: 400 }
      )
    }

    // Create reservation
    const reservation = await prisma.investorReservation.create({
      data: {
        investorId,
        dealId,
        reservationFee,
        solicitorName,
        solicitorEmail,
        solicitorPhone,
        solicitorFirm,
        notes,
        status: "pending",
      },
    })

    // Update deal status to reserved
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        status: "reserved",
        reservationCount: { increment: 1 },
      },
    })

    // Update investor stats
    await prisma.investor.update({
      where: { id: investorId },
      data: {
        activeReservationsCount: { increment: 1 },
        pipelineStage: "RESERVED",
        lastActivityAt: new Date(),
      },
    })

    // Log activity
    await prisma.investorActivity.create({
      data: {
        investorId,
        activityType: "RESERVATION_MADE",
        description: `Reservation made for ${deal.address}`,
        dealId,
        reservationId: reservation.id,
        triggeredById: session.user.id,
        metadata: {
          reservationFee: Number(reservationFee),
        },
      },
    })

    return NextResponse.json({ reservation }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating reservation:", error)
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    )
  }
}

// GET /api/investors/reservations?investorId=xxx&dealId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const investorId = searchParams.get("investorId")
    const dealId = searchParams.get("dealId")
    const status = searchParams.get("status")

    const where: any = {}
    if (investorId) where.investorId = investorId
    if (dealId) where.dealId = dealId
    if (status) where.status = status

    const reservations = await prisma.investorReservation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        investor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        deal: {
          select: {
            address: true,
            postcode: true,
            askingPrice: true,
            propertyType: true,
            bedrooms: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ reservations })
  } catch (error: any) {
    console.error("Error fetching reservations:", error)
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    )
  }
}
