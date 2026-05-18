/**
 * POST /api/vendor-pipeline/leads/[id]/notify-investor
 * Send a deal-alert email and/or SMS to a specific investor about this vendor lead.
 * Works without a linked Deal — uses raw lead data.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendOfferToInvestorEmail } from "@/lib/email"
import { TwilioService } from "@/lib/vendor-pipeline/twilio"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { investorId, message, channel = "email", offerAmountOverride } = body as {
      investorId: string
      message?: string
      channel?: "email" | "sms" | "both"
      offerAmountOverride?: number   // sourcer-edited offer price to show in the email
    }

    if (!investorId) {
      return NextResponse.json({ error: "investorId is required" }, { status: 400 })
    }

    // Fetch lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        propertyAddress: true,
        propertyPostcode: true,
        askingPrice: true,
        offerAmount: true,
        estimatedMarketValue: true,
        bmvScore: true,
        bedrooms: true,
        propertyType: true,
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Fetch investor (including phone for SMS)
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
      },
    })
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const investorName =
      [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ") ||
      investor.user.email
    const propertyAddress = lead.propertyAddress || lead.propertyPostcode || "Property"
    const dbOfferAmount = lead.offerAmount ? Number(lead.offerAmount) : 0
    const askingPrice   = lead.askingPrice ? Number(lead.askingPrice) : 0
    const marketValue   = lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

    // Use sourcer-overridden offer price if provided, otherwise fall back to DB value
    const offerAmount = (offerAmountOverride && offerAmountOverride > 0)
      ? offerAmountOverride
      : dbOfferAmount

    // BMV for the email = offer vs market value (not the stored bmvScore which is asking vs market value)
    // Falls back to offer vs asking price if market value not yet calculated.
    const offerBmvPct =
      marketValue && marketValue > 0
        ? ((marketValue - offerAmount) / marketValue) * 100
        : askingPrice > 0 && offerAmount > 0 && offerAmount < askingPrice
        ? ((askingPrice - offerAmount) / askingPrice) * 100
        : (lead.bmvScore ? Number(lead.bmvScore) : 0)

    const defaultMessage =
      message ||
      `We have a new deal that matches your investment criteria. ` +
      `${propertyAddress}${lead.bedrooms ? ` — ${lead.bedrooms} bed ${lead.propertyType ?? "property"}` : ""}. ` +
      `${offerBmvPct > 0 ? `Available at ${offerBmvPct.toFixed(0)}% BMV. ` : ""}` +
      `Please get in touch to find out more.`

    // Send email
    let emailSuccess = false
    let noSmtp = false

    if ((channel === "email" || channel === "both") && investor.user.email) {
      const result = await sendOfferToInvestorEmail({
        to: investor.user.email,
        investorName,
        propertyAddress,
        offerAmount,
        askingPrice,
        marketValue,
        bmvPct: offerBmvPct,
        message: defaultMessage,
        appUrl,
      })
      emailSuccess = result.success
      noSmtp = result.noSmtp ?? false
    }

    // Send SMS
    let smsSuccess = false
    const smsPhone = investor.user.phone ?? null

    if ((channel === "sms" || channel === "both") && smsPhone) {
      try {
        const smsMessage = `DealStack: New deal match — ${propertyAddress}${lead.bedrooms ? ` ${lead.bedrooms}bd` : ""}${bmvPct > 0 ? ` at ${bmvPct.toFixed(0)}% BMV` : ""}. Login: ${appUrl}/investor/marketplace`
        const twilio = new TwilioService()
        const smsResult = await twilio.sendSMS(smsPhone, smsMessage)
        smsSuccess = !smsResult.error
      } catch {
        // Twilio not configured — silently skip
        smsSuccess = false
      }
    }

    // Log notification in pipeline events
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: "investor_notified",
        details: {
          investorId: investor.id,
          investorName,
          investorEmail: investor.user.email,
          channel,
          emailSuccess,
          noSmtp,
          smsSuccess,
          smsPhone,
          message: defaultMessage,
          sentBy: session.user.id,
        },
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      emailDelivered: emailSuccess,
      smsDelivered: smsSuccess,
      noSmtp,
      channel,
    })
  } catch (error: any) {
    console.error("[notify-investor] Error:", error)
    return NextResponse.json({ error: "Failed to notify investor" }, { status: 500 })
  }
}
