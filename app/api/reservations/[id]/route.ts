import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import {
  sendReservationPackSentEmail,
  sendReservationFeeRequestedEmail,
  sendReservationFeeConfirmedEmail,
  sendPofRequestedEmail,
  sendPofReceivedEmail,
  sendDealCompletedInvestorEmail,
  sendLockOutSentInvestorEmail,
  sendLockOutSentVendorEmail,
  sendLockOutSignedVendorEmail,
  sendDealCompletedVendorEmail,
} from "@/lib/email"

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
  status: z.enum(["pending", "pack_sent", "fee_pending", "fee_paid", "proof_of_funds_pending", "pof_received", "verified", "lock_out_sent", "locked_out", "completed", "cancelled"]).optional(),
  proofOfFundsReceivedAt: z.string().optional(),
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

    // Auto-set boolean flags from status transitions
    if (validatedData.status === "fee_paid" && !existingReservation.feePaid) {
      updateData.feePaid = true
      updateData.feePaidAt = new Date()
    }

    if (validatedData.status === "pof_received" && !existingReservation.proofOfFundsProvided) {
      updateData.proofOfFundsProvided = true
      updateData.proofOfFundsReceivedAt = new Date()
    }

    if (validatedData.proofOfFundsVerified === true && !existingReservation.proofOfFundsVerified) {
      updateData.proofOfFundsVerifiedAt = new Date()
      updateData.proofOfFundsVerifiedBy = validatedData.proofOfFundsVerifiedBy || session.user.id
    }

    if (validatedData.status === "verified" && !existingReservation.proofOfFundsVerified) {
      updateData.proofOfFundsVerified = true
      updateData.proofOfFundsVerifiedAt = new Date()
      updateData.proofOfFundsVerifiedBy = session.user.id
    }

    if (validatedData.lockOutAgreementSent === true && !existingReservation.lockOutAgreementSent) {
      updateData.lockOutAgreementSentAt = new Date()
    }

    if (validatedData.status === "lock_out_sent" && !existingReservation.lockOutAgreementSent) {
      updateData.lockOutAgreementSent = true
      updateData.lockOutAgreementSentAt = new Date()
    }

    if (validatedData.lockOutAgreementSigned === true && !existingReservation.lockOutAgreementSigned) {
      updateData.lockOutAgreementSignedAt = new Date()
    }

    if (validatedData.status === "locked_out" && !existingReservation.lockOutAgreementSigned) {
      updateData.lockOutAgreementSigned = true
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

    // Sync investor pipeline stage + deal status + vendor lead based on reservation status change
    if (validatedData.status && validatedData.status !== existingReservation.status) {
      const newStatus = validatedData.status

      if (newStatus === "completed") {
        // Reservation completed → investor is now a purchaser
        await prisma.investor.update({
          where: { id: existingReservation.investorId },
          data: {
            pipelineStage: "PURCHASED",
            dealsPurchased: { increment: 1 },
            lastActivityAt: new Date(),
          },
        })
        await prisma.investorActivity.create({
          data: {
            investorId: existingReservation.investorId,
            activityType: "PURCHASE_COMPLETED",
            description: `Reservation completed — investor moved to Purchased`,
            dealId: existingReservation.dealId,
            triggeredById: session.user.id,
          },
        })

        // Mark the deal as sold and link the investor
        await prisma.deal.update({
          where: { id: existingReservation.dealId },
          data: {
            status: "sold",
            soldToId: existingReservation.investorId,
            soldAt: new Date(),
          },
        })

        // Update the linked VendorLead (if any) to record the closed deal
        const vendorLeadForSale = await prisma.vendorLead.findFirst({
          where: { dealId: existingReservation.dealId },
        })
        if (vendorLeadForSale) {
          await prisma.vendorLead.update({
            where: { id: vendorLeadForSale.id },
            data: {
              dealClosedAt: new Date(),
              reservedByInvestorId: existingReservation.investorId,
              reservedAt: vendorLeadForSale.reservedAt ?? new Date(),
            },
          })
          await prisma.pipelineEvent.create({
            data: {
              vendorLeadId: vendorLeadForSale.id,
              eventType: "DEAL_SOLD_TO_INVESTOR",
              details: {
                investorId: existingReservation.investorId,
                reservationId: params.id,
                dealId: existingReservation.dealId,
              },
              createdBy: session.user.id,
            },
          })
        }

      } else if (newStatus === "locked_out") {
        // Lock-out agreement signed → reserve the deal and link vendor lead to investor
        await prisma.deal.update({
          where: { id: existingReservation.dealId },
          data: { status: "reserved" },
        })

        const vendorLeadForLockOut = await prisma.vendorLead.findFirst({
          where: { dealId: existingReservation.dealId },
        })
        if (vendorLeadForLockOut) {
          await prisma.vendorLead.update({
            where: { id: vendorLeadForLockOut.id },
            data: {
              reservedByInvestorId: existingReservation.investorId,
              reservedAt: new Date(),
            },
          })
          await prisma.pipelineEvent.create({
            data: {
              vendorLeadId: vendorLeadForLockOut.id,
              eventType: "INVESTOR_LOCK_OUT_SIGNED",
              details: {
                investorId: existingReservation.investorId,
                reservationId: params.id,
                dealId: existingReservation.dealId,
              },
              createdBy: session.user.id,
            },
          })
        }

      } else if (newStatus === "cancelled") {
        // If cancelled, check if they still have other active reservations
        const otherActiveReservations = await prisma.investorReservation.count({
          where: {
            investorId: existingReservation.investorId,
            id: { not: params.id },
            status: { notIn: ["cancelled", "completed"] },
          },
        })
        if (otherActiveReservations === 0) {
          await prisma.investor.update({
            where: { id: existingReservation.investorId },
            data: {
              pipelineStage: "VIEWING_DEALS",
              lastActivityAt: new Date(),
            },
          })
        }
        await prisma.investorActivity.create({
          data: {
            investorId: existingReservation.investorId,
            activityType: "RESERVATION_CANCELLED",
            description: `Reservation cancelled`,
            dealId: existingReservation.dealId,
            triggeredById: session.user.id,
          },
        })

        // If the cancelled reservation had locked/sold the deal, revert deal status
        // and clear the vendor lead link — unless another reservation is still locked
        const prevStatus = existingReservation.status
        if (prevStatus === "locked_out" || prevStatus === "completed") {
          const otherLockedReservations = await prisma.investorReservation.count({
            where: {
              dealId: existingReservation.dealId,
              id: { not: params.id },
              status: { in: ["locked_out", "completed"] },
            },
          })
          if (otherLockedReservations === 0) {
            await prisma.deal.update({
              where: { id: existingReservation.dealId },
              data: { status: "listed", soldToId: null, soldAt: null },
            })
            const vendorLeadToRevert = await prisma.vendorLead.findFirst({
              where: { dealId: existingReservation.dealId },
            })
            if (vendorLeadToRevert) {
              await prisma.vendorLead.update({
                where: { id: vendorLeadToRevert.id },
                data: { reservedByInvestorId: null, reservedAt: null },
              })
              await prisma.pipelineEvent.create({
                data: {
                  vendorLeadId: vendorLeadToRevert.id,
                  eventType: "INVESTOR_RESERVATION_CANCELLED",
                  details: {
                    investorId: existingReservation.investorId,
                    reservationId: params.id,
                    previousStatus: prevStatus,
                  },
                  createdBy: session.user.id,
                },
              })
            }
          }
        }
      }
      // All other status advances keep the investor at RESERVED — no deal/vendor change needed
    }

    // ── Send stage emails and log result ──────────────────────────────────────
    if (validatedData.status && validatedData.status !== existingReservation.status) {
      const newStatus = validatedData.status
      const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
      const fromName = process.env.SMTP_FROM_NAME || "DealStack"
      const investorEmail = reservation.investor.user.email
      const investorName =
        [reservation.investor.user.firstName, reservation.investor.user.lastName].filter(Boolean).join(" ") ||
        investorEmail
      const dealAddress = reservation.deal.address
      const dealId = reservation.deal.id

      const stageEmailLog: Record<string, { status: string; sentAt: string; to: string; error?: string }> = {}

      // Investor emails
      if (newStatus === "pack_sent") {
        const r = await sendReservationPackSentEmail({ to: investorEmail, investorName, dealAddress, dealId, appUrl })
        stageEmailLog["pack_sent"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] pack_sent → ${investorEmail}: ${stageEmailLog["pack_sent"].status}`)
      }
      if (newStatus === "fee_pending") {
        const r = await sendReservationFeeRequestedEmail({ to: investorEmail, investorName, dealAddress, feeAmount: Number(existingReservation.reservationFee) })
        stageEmailLog["fee_pending"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] fee_pending → ${investorEmail}: ${stageEmailLog["fee_pending"].status}`)
      }
      if (newStatus === "fee_paid") {
        const r = await sendReservationFeeConfirmedEmail({ to: investorEmail, investorName, dealAddress })
        stageEmailLog["fee_paid"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] fee_paid → ${investorEmail}: ${stageEmailLog["fee_paid"].status}`)
      }
      if (newStatus === "proof_of_funds_pending") {
        const r = await sendPofRequestedEmail({ to: investorEmail, investorName, dealAddress })
        stageEmailLog["proof_of_funds_pending"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] proof_of_funds_pending → ${investorEmail}: ${stageEmailLog["proof_of_funds_pending"].status}`)
      }
      if (newStatus === "pof_received") {
        const r = await sendPofReceivedEmail({ to: investorEmail, investorName, dealAddress })
        stageEmailLog["pof_received"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] pof_received → ${investorEmail}: ${stageEmailLog["pof_received"].status}`)
      }

      // Vendor emails (need to look up linked VendorLead via dealId)
      if (["lock_out_sent", "locked_out", "completed"].includes(newStatus) && existingReservation.dealId) {
        const vendorLead = await prisma.vendorLead.findFirst({
          where: { dealId: existingReservation.dealId },
          select: { vendorEmail: true, vendorName: true, propertyAddress: true },
        })
        if (vendorLead?.vendorEmail) {
          const vendorEmail = vendorLead.vendorEmail
          const propertyAddress = vendorLead.propertyAddress || dealAddress
          if (newStatus === "lock_out_sent") {
            const r = await sendLockOutSentVendorEmail({ to: vendorEmail, vendorName: vendorLead.vendorName, propertyAddress, companyName: fromName })
            stageEmailLog["lock_out_sent"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: vendorEmail, ...(r.error ? { error: r.error } : {}) }
            console.log(`[reservation email] lock_out_sent → ${vendorEmail}: ${stageEmailLog["lock_out_sent"].status}`)
            // Also notify investor
            sendLockOutSentInvestorEmail({ to: investorEmail, investorName, dealAddress }).catch(() => {})
          }
          if (newStatus === "locked_out") {
            const r = await sendLockOutSignedVendorEmail({ to: vendorEmail, vendorName: vendorLead.vendorName, propertyAddress, companyName: fromName })
            stageEmailLog["locked_out"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: vendorEmail, ...(r.error ? { error: r.error } : {}) }
            console.log(`[reservation email] locked_out (vendor) → ${vendorEmail}: ${stageEmailLog["locked_out"].status}`)
          }
          if (newStatus === "completed") {
            const r = await sendDealCompletedVendorEmail({ to: vendorEmail, vendorName: vendorLead.vendorName, propertyAddress, companyName: fromName })
            stageEmailLog["completed_vendor"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: vendorEmail, ...(r.error ? { error: r.error } : {}) }
            console.log(`[reservation email] completed (vendor) → ${vendorEmail}: ${stageEmailLog["completed_vendor"].status}`)
          }
        }
      }
      // Investor completed email
      if (newStatus === "completed") {
        const r = await sendDealCompletedInvestorEmail({ to: investorEmail, investorName, dealAddress })
        stageEmailLog["completed_investor"] = { status: r.success ? "sent" : r.noSmtp ? "no_smtp" : "failed", sentAt: new Date().toISOString(), to: investorEmail, ...(r.error ? { error: r.error } : {}) }
        console.log(`[reservation email] completed (investor) → ${investorEmail}: ${stageEmailLog["completed_investor"].status}`)
      }

      // Persist email log — merge with any existing entries
      if (Object.keys(stageEmailLog).length > 0) {
        const existing = ((existingReservation as any).stageEmails ?? {}) as Record<string, unknown>
        const merged = { ...existing, ...stageEmailLog }
        await prisma.investorReservation.update({
          where: { id: params.id },
          data: { stageEmails: merged as any },
        })
        // Attach to the response object so the client gets the updated log immediately
        ;(reservation as any).stageEmails = merged
      }
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

