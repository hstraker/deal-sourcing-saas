import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createReservationSchema = z.object({
  investorId: z.string().uuid("Invalid investor ID"),
  dealId: z.string().uuid("Invalid deal ID"),
  reservationFee: z.number().positive("Reservation fee must be positive"),
  notes: z.string().optional(),
})

const updateReservationSchema = z.object({
  reservationFee: z.number().positive().optional(),
  feePaid: z.boolean().optional(),
  feePaymentId: z.string().optional(),
  proofOfFundsProvided: z.boolean().optional(),
  proofOfFundsVerified: z.boolean().optional(),
  proofOfFundsVerifiedBy: z.string().uuid().optional(),
  solicitorName: z.string().optional(),
  solicitorEmail: z.string().email().optional().or(z.literal("")),
  solicitorPhone: z.string().optional(),
  solicitorFirm: z.string().optional(),
  lockOutAgreementSent: z.boolean().optional(),
  lockOutAgreementSigned: z.boolean().optional(),
  lockOutAgreementDocumentS3Key: z.string().optional(),
  status: z.enum(["pending", "fee_pending", "proof_of_funds_pending", "verified", "locked_out", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
})

// GET /api/reservations - Get all reservations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const dealId = searchParams.get("dealId")
    const investorId = searchParams.get("investorId")
    const status = searchParams.get("status")

    const reservations = await prisma.investorReservation.findMany({
      where: {
        ...(dealId && { dealId }),
        ...(investorId && { investorId }),
        ...(status && { status: status as any }),
      },
      include: {
        investor: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
            askingPrice: true,
            status: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(reservations)
  } catch (error) {
    console.error("Error fetching reservations:", error)
    return NextResponse.json(
      { error: "Failed to fetch reservations" },
      { status: 500 }
    )
  }
}

// POST /api/reservations - Create a new reservation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createReservationSchema.parse(body)

    // Check if reservation already exists
    const existingReservation = await prisma.investorReservation.findUnique({
      where: {
        investorId_dealId: {
          investorId: validatedData.investorId,
          dealId: validatedData.dealId,
        },
      },
    })

    if (existingReservation) {
      return NextResponse.json(
        { error: "Reservation already exists for this investor and deal" },
        { status: 400 }
      )
    }

    // Verify investor and deal exist
    const [investor, deal] = await Promise.all([
      prisma.investor.findUnique({ where: { id: validatedData.investorId } }),
      prisma.deal.findUnique({ where: { id: validatedData.dealId } }),
    ])

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Create reservation
    const reservation = await prisma.investorReservation.create({
      data: {
        investorId: validatedData.investorId,
        dealId: validatedData.dealId,
        reservationFee: validatedData.reservationFee,
        notes: validatedData.notes,
        status: "pending",
      },
      include: {
        investor: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
            askingPrice: true,
            status: true,
          },
        },
      },
    })

    // Update deal reservation count
    const reservationCount = await prisma.investorReservation.count({
      where: { dealId: validatedData.dealId },
    })

    await prisma.deal.update({
      where: { id: validatedData.dealId },
      data: { reservationCount },
    })

    return NextResponse.json(reservation, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating reservation:", error)
    return NextResponse.json(
      { error: "Failed to create reservation" },
      { status: 500 }
    )
  }
}

