import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

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

// GET /api/reservations/[id] - Get a single reservation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const reservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
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
            createdAt: true,
          },
        },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    return NextResponse.json(reservation)
  } catch (error) {
    console.error("Error fetching reservation:", error)
    return NextResponse.json(
      { error: "Failed to fetch reservation" },
      { status: 500 }
    )
  }
}

// PUT /api/reservations/[id] - Update a reservation
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateReservationSchema.parse(body)

    const existingReservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
    })

    if (!existingReservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    const updateData: any = {
      reservationFee: validatedData.reservationFee,
      feePaid: validatedData.feePaid,
      feePaymentId: validatedData.feePaymentId,
      proofOfFundsProvided: validatedData.proofOfFundsProvided,
      proofOfFundsVerified: validatedData.proofOfFundsVerified,
      proofOfFundsVerifiedBy: validatedData.proofOfFundsVerifiedBy,
      solicitorName: validatedData.solicitorName,
      solicitorEmail: validatedData.solicitorEmail || null,
      solicitorPhone: validatedData.solicitorPhone,
      solicitorFirm: validatedData.solicitorFirm,
      lockOutAgreementSent: validatedData.lockOutAgreementSent,
      lockOutAgreementSigned: validatedData.lockOutAgreementSigned,
      lockOutAgreementDocumentS3Key: validatedData.lockOutAgreementDocumentS3Key,
      status: validatedData.status,
      notes: validatedData.notes,
    }

    // Handle status transitions and timestamps
    if (validatedData.feePaid === true && !existingReservation.feePaid) {
      updateData.feePaidAt = new Date()
    }

    if (validatedData.proofOfFundsVerified === true && !existingReservation.proofOfFundsVerified) {
      updateData.proofOfFundsVerifiedAt = new Date()
      updateData.proofOfFundsVerifiedBy = validatedData.proofOfFundsVerifiedBy || session.user.id
    }

    if (validatedData.lockOutAgreementSent === true && !existingReservation.lockOutAgreementSent) {
      updateData.lockOutAgreementSentAt = new Date()
    }

    if (validatedData.lockOutAgreementSigned === true && !existingReservation.lockOutAgreementSigned) {
      updateData.lockOutAgreementSignedAt = new Date()
    }

    if (validatedData.status === "completed" && existingReservation.status !== "completed") {
      updateData.completedAt = new Date()
    }

    const reservation = await prisma.investorReservation.update({
      where: { id: params.id },
      data: updateData,
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

    // Update deal reservation stats
    if (existingReservation.dealId) {
      const reservationCount = await prisma.investorReservation.count({
        where: { dealId: existingReservation.dealId },
      })

      const reservationsWithProof = await prisma.investorReservation.count({
        where: {
          dealId: existingReservation.dealId,
          proofOfFundsVerified: true,
        },
      })

      await prisma.deal.update({
        where: { id: existingReservation.dealId },
        data: {
          reservationCount,
          reservationsWithProofOfFunds: reservationsWithProof,
        },
      })
    }

    return NextResponse.json(reservation)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating reservation:", error)
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    )
  }
}

// DELETE /api/reservations/[id] - Delete a reservation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const reservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    await prisma.investorReservation.delete({
      where: { id: params.id },
    })

    // Update deal reservation count
    if (reservation.dealId) {
      const reservationCount = await prisma.investorReservation.count({
        where: { dealId: reservation.dealId },
      })

      await prisma.deal.update({
        where: { id: reservation.dealId },
        data: { reservationCount },
      })
    }

    return NextResponse.json({ message: "Reservation deleted successfully" })
  } catch (error) {
    console.error("Error deleting reservation:", error)
    return NextResponse.json(
      { error: "Failed to delete reservation" },
      { status: 500 }
    )
  }
}

