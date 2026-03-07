/**
 * POST /api/vendor-pipeline/leads/[id]/send-vendor-offer
 * Send (or log) an offer to the vendor via email, SMS, or phone call note.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendVendorOfferEmail } from "@/lib/email"
import { generateVendorOfferToken } from "@/lib/vendor-token"

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
    const { channel, message, round, offerPrice, strategy } = body as {
      channel: "email" | "sms" | "phone"
      message: string
      round?: number
      offerPrice?: number
      strategy?: "flip" | "hold"
    }

    if (!channel || !["email", "sms", "phone"].includes(channel)) {
      return NextResponse.json({ error: "Invalid channel. Must be email, sms, or phone." }, { status: 400 })
    }

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const vendorEmail = lead.vendorEmail
    const vendorPhone = lead.vendorPhone
    const propertyAddress = lead.propertyAddress || "Property"

    // ── Email ─────────────────────────────────────────────────────────────────
    if (channel === "email") {
      if (!vendorEmail) {
        return NextResponse.json({ error: "Vendor has no email address" }, { status: 400 })
      }

      // Increment offerTokenVersion to invalidate any previous accept/reject links
      const newVersion = (lead.offerTokenVersion ?? 0) + 1
      await prisma.vendorLead.update({
        where: { id: params.id },
        data: { offerTokenVersion: newVersion },
      })

      // Generate CTA links
      const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
      const acceptToken = generateVendorOfferToken(params.id, newVersion, "accept")
      const rejectToken = generateVendorOfferToken(params.id, newVersion, "reject")
      const acceptLink = `${appUrl}/api/vendor-response?token=${acceptToken}`
      const rejectLink = `${appUrl}/api/vendor-response?token=${rejectToken}`

      const emailResult = await sendVendorOfferEmail({
        to: vendorEmail,
        vendorName: lead.vendorName,
        propertyAddress,
        message,
        acceptLink,
        rejectLink,
      })
      const emailSuccess = emailResult.success
      const noSmtp = emailResult.noSmtp ?? false

      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "vendor_offer_sent",
          details: {
            channel: "email",
            vendorEmail,
            round: round ?? null,
            offerPrice: offerPrice ?? null,
            strategy: strategy ?? null,
            emailSuccess,
            noSmtp,
          },
          createdBy: session.user.id,
        },
      })

      await prisma.vendorLead.update({
        where: { id: params.id },
        data: { offerSentAt: new Date() },
      })

      return NextResponse.json({ success: true, channel: "email", emailDelivered: emailSuccess, noSmtp })
    }

    // ── SMS ───────────────────────────────────────────────────────────────────
    if (channel === "sms") {
      if (!vendorPhone) {
        return NextResponse.json({ error: "Vendor has no phone number" }, { status: 400 })
      }

      let smsSid: string | null = null
      let smsSuccess = false
      let smsError: string | undefined

      try {
        const { TwilioService } = await import("@/lib/vendor-pipeline/twilio")
        const twilio = new TwilioService()
        const smsResult = await twilio.sendSMS(vendorPhone, message)
        smsSid = smsResult.messageSid
        smsSuccess = true
      } catch (err: any) {
        smsError = err.message || "SMS failed"
        console.error("[send-vendor-offer] SMS failed:", err)
      }

      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "vendor_offer_sent",
          details: {
            channel: "sms",
            vendorPhone,
            round: round ?? null,
            offerPrice: offerPrice ?? null,
            strategy: strategy ?? null,
            smsSuccess,
            smsSid: smsSid ?? null,
            smsError: smsError ?? null,
          },
          createdBy: session.user.id,
        },
      })

      await prisma.vendorLead.update({
        where: { id: params.id },
        data: { offerSentAt: new Date() },
      })

      return NextResponse.json({ success: true, channel: "sms", smsDelivered: smsSuccess, error: smsError })
    }

    // ── Phone (log only) ──────────────────────────────────────────────────────
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: "vendor_offer_sent",
        details: {
          channel: "phone",
          vendorPhone: vendorPhone ?? null,
          round: round ?? null,
          offerPrice: offerPrice ?? null,
          strategy: strategy ?? null,
          notes: message,
        },
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({ success: true, channel: "phone" })
  } catch (error: any) {
    console.error("[send-vendor-offer] Error:", error)
    return NextResponse.json({ error: "Failed to send offer" }, { status: 500 })
  }
}
