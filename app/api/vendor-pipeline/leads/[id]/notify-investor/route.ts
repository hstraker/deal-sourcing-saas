/**
 * POST /api/vendor-pipeline/leads/[id]/notify-investor
 * Send a deal-alert email to a specific investor about this vendor lead.
 * Works without a linked Deal — uses raw lead data.
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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { investorId, message } = body as { investorId: string; message?: string }

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
        bmvScore: true,
        bedrooms: true,
        propertyType: true,
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Fetch investor
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: {
        id: true,
        user: { select: { firstName: true, lastName: true, email: true } },
      },
    })
    if (!investor) return NextResponse.json({ error: "Investor not found" }, { status: 404 })

    const investorName =
      [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ") ||
      investor.user.email
    const propertyAddress = lead.propertyAddress || lead.propertyPostcode || "Property"
    const offerAmount = lead.offerAmount ? Number(lead.offerAmount) : 0
    const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : 0
    const bmvPct = lead.bmvScore ? Number(lead.bmvScore) : 0
    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"

    const defaultMessage =
      message ||
      `We have a new deal that matches your investment criteria. ` +
      `${propertyAddress}${lead.bedrooms ? ` — ${lead.bedrooms} bed ${lead.propertyType ?? "property"}` : ""}. ` +
      `${bmvPct > 0 ? `Available at ${bmvPct.toFixed(0)}% BMV. ` : ""}` +
      `Please get in touch to find out more.`

    // Send email
    let emailSuccess = false
    let noSmtp = false

    if (investor.user.email) {
      const result = await sendOfferToInvestorEmail({
        to: investor.user.email,
        investorName,
        propertyAddress,
        offerAmount,
        askingPrice,
        bmvPct,
        message: defaultMessage,
        appUrl,
      })
      emailSuccess = result.success
      noSmtp = result.noSmtp ?? false
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
          channel: "email",
          emailSuccess,
          noSmtp,
          message: defaultMessage,
          sentBy: session.user.id,
        },
        createdBy: session.user.id,
      },
    })

    return NextResponse.json({
      success: true,
      emailDelivered: emailSuccess,
      noSmtp,
    })
  } catch (error: any) {
    console.error("[notify-investor] Error:", error)
    return NextResponse.json({ error: "Failed to notify investor" }, { status: 500 })
  }
}
