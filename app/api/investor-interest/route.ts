/**
 * GET /api/investor-interest?token=...
 * Public endpoint — no authentication required.
 * Validates a signed interest token and records the investor's interest in a deal.
 * Updates investor pipeline stage and logs activity, then redirects to thank-you page.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyInterestToken } from "@/lib/investor-token"
import { sendReservationFeeRequestedEmail } from "@/lib/email"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/investor-interest?result=invalid", request.url))
  }

  const { valid, deliveryId, dealId, investorId } = verifyInterestToken(token)

  if (!valid || !deliveryId || !dealId || !investorId) {
    return NextResponse.redirect(new URL("/investor-interest?result=invalid", request.url))
  }

  try {
    // Load delivery, investor (with user email/name), deal, and reservation in one go
    const delivery = await prisma.investorPackDelivery.findUnique({
      where: { id: deliveryId },
      select: {
        id: true,
        viewedAt: true,
        investor: {
          include: {
            user: { select: { email: true, firstName: true, lastName: true } },
          },
        },
        deal: { select: { id: true, address: true } },
      },
    })

    if (!delivery) {
      return NextResponse.redirect(new URL("/investor-interest?result=invalid", request.url))
    }

    // Find active reservation for this investor + deal
    const reservation = await prisma.investorReservation.findFirst({
      where: {
        investorId,
        dealId,
        status: { notIn: ["cancelled", "completed"] as any },
      },
      select: { id: true, status: true, reservationFee: true },
    })

    // Advance investor pipeline stage to VIEWING_DEALS if not already further along
    await prisma.investor.updateMany({
      where: {
        id: investorId,
        pipelineStage: { in: ["LEAD", "CONTACTED", "QUALIFIED"] },
      },
      data: {
        pipelineStage: "VIEWING_DEALS",
        lastActivityAt: new Date(),
      },
    })

    // Advance reservation to fee_pending and send fee email
    if (reservation && ["pending", "pack_sent"].includes(reservation.status as string)) {
      await prisma.investorReservation.update({
        where: { id: reservation.id },
        data: { status: "fee_pending" },
      })

      const investorEmail = delivery.investor.user.email
      const investorName =
        `${delivery.investor.user.firstName || ""} ${delivery.investor.user.lastName || ""}`.trim() ||
        investorEmail

      sendReservationFeeRequestedEmail({
        to: investorEmail,
        investorName,
        dealAddress: delivery.deal.address,
        feeAmount: Number(reservation.reservationFee),
      }).catch((err) => console.error("[investor-interest] Fee email failed:", err))
    }

    // Log interest activity
    await prisma.investorActivity.create({
      data: {
        investorId,
        activityType: "DEAL_VIEWED",
        description: "Expressed interest via investor pack CTA button",
        dealId,
        packDeliveryId: deliveryId,
      },
    })

    // Mark pack as viewed if not already
    if (!delivery.viewedAt) {
      await prisma.investorPackDelivery.update({
        where: { id: deliveryId },
        data: { viewedAt: new Date(), viewCount: { increment: 1 } },
      })
    }
  } catch (error) {
    console.error("[investor-interest] Error recording interest:", error)
    // Still redirect to success — don't show the investor an error
  }

  return NextResponse.redirect(new URL("/investor-interest?result=success", request.url))
}
