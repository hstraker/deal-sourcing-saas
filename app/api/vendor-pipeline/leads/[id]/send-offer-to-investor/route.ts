/**
 * POST /api/vendor-pipeline/leads/[id]/send-offer-to-investor
 * Send (or log) an offer to the investor linked via the active InvestorReservation on the deal.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendOfferToInvestorEmail } from "@/lib/email"

export async function POST(
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
    const { channel, message } = body as { channel: "email" | "sms" | "phone"; message: string }

    if (!channel || !["email", "sms", "phone"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel. Must be email, sms, or phone." }, { status: 400 })
    }

    // Fetch the lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }
    if (!lead.dealId) {
      return NextResponse.json({ error: "No deal linked to this lead" }, { status: 400 })
    }

    // Find the active reservation on the linked deal
    const reservation = await prisma.investorReservation.findFirst({
      where: { dealId: lead.dealId, status: { notIn: ["cancelled"] } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        investorId: true,
        investor: {
          select: {
            id: true,
            user: { select: { firstName: true, lastName: true, email: true, phone: true } },
          },
        },
      },
    })

    if (!reservation) {
      return NextResponse.json({ error: "No active investor reservation on this deal" }, { status: 400 })
    }

    const investor = reservation.investor
    const investorName =
      [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ") || investor.user.email
    const propertyAddress = lead.propertyAddress || "Property"
    const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : 0
    const offerAmount = lead.offerAmount ? Number(lead.offerAmount) : 0
    const bmvPct = lead.bmvScore ? Number(lead.bmvScore) : 0
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

    if (channel === "email") {
      if (!investor.user.email) {
        return NextResponse.json({ error: "Investor has no email address" }, { status: 400 })
      }

      const emailResult = await sendOfferToInvestorEmail({
        to: investor.user.email,
        investorName,
        propertyAddress,
        offerAmount,
        askingPrice,
        bmvPct,
        message,
        appUrl,
      })

      await prisma.communication.create({
        data: {
          investorId: investor.id,
          type: "email",
          subject: `Investment Opportunity: ${propertyAddress}`,
          message,
          emailSent: emailResult.success,
          sentById: session.user.id,
        },
      })

      await prisma.vendorLead.update({
        where: { id: params.id },
        data: { offerSentAt: new Date() },
      })

      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "offer_sent_to_investor",
          details: {
            channel: "email",
            investorId: investor.id,
            investorEmail: investor.user.email,
            reservationId: reservation.id,
            emailSuccess: emailResult.success,
            noSmtp: emailResult.noSmtp ?? false,
          },
          createdBy: session.user.id,
        },
      })

      return NextResponse.json({
        success: true,
        channel: "email",
        emailDelivered: emailResult.success,
        noSmtp: emailResult.noSmtp ?? false,
      })
    }

    if (channel === "sms") {
      if (!investor.user.phone) {
        return NextResponse.json({ error: "Investor has no phone number" }, { status: 400 })
      }

      let smsSid: string | null = null
      let smsSuccess = false
      let smsError: string | undefined

      try {
        const { TwilioService } = await import("@/lib/vendor-pipeline/twilio")
        const twilio = new TwilioService()
        const smsResult = await twilio.sendSMS(investor.user.phone, message)
        smsSid = smsResult.messageSid
        smsSuccess = true
      } catch (err: any) {
        smsError = err.message || "SMS failed"
        console.error("[send-offer-to-investor] SMS failed:", err)
      }

      await prisma.communication.create({
        data: {
          investorId: investor.id,
          type: "sms",
          message,
          smsMessageId: smsSid,
          smsDirection: "outbound",
          sentById: session.user.id,
        },
      })

      await prisma.vendorLead.update({
        where: { id: params.id },
        data: { offerSentAt: new Date() },
      })

      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "offer_sent_to_investor",
          details: {
            channel: "sms",
            investorId: investor.id,
            investorPhone: investor.user.phone,
            reservationId: reservation.id,
            smsSuccess,
            smsError: smsError ?? null,
          },
          createdBy: session.user.id,
        },
      })

      return NextResponse.json({ success: true, channel: "sms", smsDelivered: smsSuccess, error: smsError })
    }

    // channel === "phone" — log only
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: "offer_call_logged",
        details: {
          investorId: investor.id,
          investorPhone: investor.user.phone,
          reservationId: reservation.id,
          notes: message,
        },
        createdBy: session.user.id,
      },
    })

    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: "offer_sent_to_investor",
        details: {
          channel: "phone",
          investorId: investor.id,
          reservationId: reservation.id,
        },
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, channel: "phone" })
  } catch (error: any) {
    console.error("[send-offer-to-investor] Error:", error)
    return NextResponse.json({ error: "Failed to send offer" }, { status: 500 })
  }
}
