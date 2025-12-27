import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH /api/investors/reservations/[id] - Update reservation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const {
      status,
      feePaid,
      feePaymentId,
      proofOfFundsProvided,
      proofOfFundsDocumentS3Key,
      proofOfFundsVerified,
      solicitorName,
      solicitorEmail,
      solicitorPhone,
      solicitorFirm,
      lockOutAgreementSent,
      lockOutAgreementSigned,
      lockOutAgreementDocumentS3Key,
      notes,
    } = body

    const reservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
      include: {
        deal: true,
        investor: true,
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    const updateData: any = {}
    const activityLogs: any[] = []

    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (solicitorName !== undefined) updateData.solicitorName = solicitorName
    if (solicitorEmail !== undefined) updateData.solicitorEmail = solicitorEmail
    if (solicitorPhone !== undefined) updateData.solicitorPhone = solicitorPhone
    if (solicitorFirm !== undefined) updateData.solicitorFirm = solicitorFirm

    // Fee payment
    if (feePaid !== undefined) {
      updateData.feePaid = feePaid
      if (feePaid) {
        updateData.feePaidAt = new Date()
        updateData.feePaymentId = feePaymentId
        activityLogs.push({
          investorId: reservation.investorId,
          activityType: "RESERVATION_MADE",
          description: `Reservation fee paid for ${reservation.deal.address}`,
          dealId: reservation.dealId,
          reservationId: reservation.id,
          triggeredById: session.user.id,
        })
      }
    }

    // Proof of funds
    if (proofOfFundsProvided !== undefined) {
      updateData.proofOfFundsProvided = proofOfFundsProvided
      if (proofOfFundsProvided && proofOfFundsDocumentS3Key) {
        updateData.proofOfFundsDocumentS3Key = proofOfFundsDocumentS3Key
      }
    }

    if (proofOfFundsVerified !== undefined) {
      updateData.proofOfFundsVerified = proofOfFundsVerified
      if (proofOfFundsVerified) {
        updateData.proofOfFundsVerifiedAt = new Date()
        updateData.proofOfFundsVerifiedBy = session.user.id

        // Update deal counter
        await prisma.deal.update({
          where: { id: reservation.dealId },
          data: {
            reservationsWithProofOfFunds: { increment: 1 },
          },
        })
      }
    }

    // Lock-out agreement
    if (lockOutAgreementSent !== undefined) {
      updateData.lockOutAgreementSent = lockOutAgreementSent
      if (lockOutAgreementSent) {
        updateData.lockOutAgreementSentAt = new Date()
      }
    }

    if (lockOutAgreementSigned !== undefined) {
      updateData.lockOutAgreementSigned = lockOutAgreementSigned
      if (lockOutAgreementSigned) {
        updateData.lockOutAgreementSignedAt = new Date()
        if (lockOutAgreementDocumentS3Key) {
          updateData.lockOutAgreementDocumentS3Key = lockOutAgreementDocumentS3Key
        }
      }
    }

    // Completion
    if (status === "completed") {
      updateData.completedAt = new Date()

      // Update investor stats
      await prisma.investor.update({
        where: { id: reservation.investorId },
        data: {
          dealsPurchased: { increment: 1 },
          activeReservationsCount: { decrement: 1 },
          pipelineStage: "PURCHASED",
          lastActivityAt: new Date(),
        },
      })

      // Update deal status
      await prisma.deal.update({
        where: { id: reservation.dealId },
        data: {
          status: "sold",
          soldAt: new Date(),
          soldToId: reservation.investorId,
        },
      })

      activityLogs.push({
        investorId: reservation.investorId,
        activityType: "PURCHASE_COMPLETED",
        description: `Purchase completed for ${reservation.deal.address}`,
        dealId: reservation.dealId,
        reservationId: reservation.id,
        triggeredById: session.user.id,
      })
    }

    // Cancellation
    if (status === "cancelled") {
      // Update investor stats
      await prisma.investor.update({
        where: { id: reservation.investorId },
        data: {
          activeReservationsCount: { decrement: 1 },
          lastActivityAt: new Date(),
        },
      })

      // Update deal status back to ready
      await prisma.deal.update({
        where: { id: reservation.dealId },
        data: {
          status: "ready",
        },
      })

      activityLogs.push({
        investorId: reservation.investorId,
        activityType: "RESERVATION_CANCELLED",
        description: `Reservation cancelled for ${reservation.deal.address}`,
        dealId: reservation.dealId,
        reservationId: reservation.id,
        triggeredById: session.user.id,
      })
    }

    // Update reservation
    const updatedReservation = await prisma.investorReservation.update({
      where: { id: params.id },
      data: updateData,
    })

    // Create activity logs
    if (activityLogs.length > 0) {
      await prisma.investorActivity.createMany({
        data: activityLogs,
      })
    }

    // Update investor lastActivityAt
    await prisma.investor.update({
      where: { id: reservation.investorId },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({ reservation: updatedReservation })
  } catch (error: any) {
    console.error("Error updating reservation:", error)
    return NextResponse.json(
      { error: "Failed to update reservation" },
      { status: 500 }
    )
  }
}

// DELETE /api/investors/reservations/[id] - Cancel/delete reservation
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
      include: { deal: true },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    // Update investor stats
    await prisma.investor.update({
      where: { id: reservation.investorId },
      data: {
        activeReservationsCount: { decrement: 1 },
      },
    })

    // Update deal status back to ready
    await prisma.deal.update({
      where: { id: reservation.dealId },
      data: {
        status: "ready",
        reservationCount: { decrement: 1 },
      },
    })

    // Log activity
    await prisma.investorActivity.create({
      data: {
        investorId: reservation.investorId,
        activityType: "RESERVATION_CANCELLED",
        description: `Reservation cancelled for ${reservation.deal.address}`,
        dealId: reservation.dealId,
        reservationId: reservation.id,
        triggeredById: session.user.id,
      },
    })

    // Delete reservation
    await prisma.investorReservation.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting reservation:", error)
    return NextResponse.json(
      { error: "Failed to delete reservation" },
      { status: 500 }
    )
  }
}
