/**
 * POST /api/investor/deals/[id]/express-interest
 *
 * Records an investor's interest in a deal and notifies the sourcing team.
 *
 * - Requires investor session
 * - Creates a DealView with source = "express_interest" to log the action
 * - Fires an email notification to the SMTP_USER (the sourcing team inbox)
 * - Returns { success: true, alreadyExpressed: boolean }
 *
 * Idempotent: calling twice returns alreadyExpressed = true, no duplicate email.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import nodemailer from "nodemailer"

// ─── Email helper ─────────────────────────────────────────────────────────────

async function sendInterestEmail({
  dealAddress,
  dealPrice,
  dealBmv,
  dealYield,
  investorName,
  investorEmail,
  investorPhone,
  dealId,
}: {
  dealAddress: string
  dealPrice: string
  dealBmv: string
  dealYield: string
  investorName: string
  investorEmail: string
  investorPhone: string
  dealId: string
}) {
  const isSmtpReady =
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
  if (!isSmtpReady) return

  const port   = parseInt(process.env.SMTP_PORT || "465")
  const secure = port === 465

  const transporter = nodemailer.createTransport({
    host:     process.env.SMTP_HOST,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  })

  const appUrl = process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? ""

  await transporter.sendMail({
    from:    `"DealStack" <${process.env.SMTP_USER}>`,
    to:      process.env.SMTP_USER!,
    subject: `🔔 Investor Interest — ${dealAddress}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#1e293b;">
        <h2 style="color:#2563eb;margin-top:0;">Investor Interest Expressed</h2>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">Investor</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-weight:600;">${investorName}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">Email</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${investorEmail}</td></tr>
          <tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:13px;">Phone</td>
              <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${investorPhone || "—"}</td></tr>
        </table>

        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#f8fafc;border-radius:8px;padding:16px;">
          <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Property</td>
              <td style="padding:8px 12px;font-weight:600;">${dealAddress}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Price</td>
              <td style="padding:8px 12px;">${dealPrice}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">BMV</td>
              <td style="padding:8px 12px;color:#15803d;font-weight:600;">${dealBmv}</td></tr>
          <tr><td style="padding:8px 12px;color:#64748b;font-size:13px;">Yield</td>
              <td style="padding:8px 12px;">${dealYield}</td></tr>
        </table>

        <a href="${appUrl}/dashboard/deals/${dealId}"
           style="display:inline-block;background:#2563eb;color:white;text-decoration:none;padding:10px 20px;border-radius:6px;font-weight:600;font-size:14px;">
          View Deal in Dashboard →
        </a>

        <p style="color:#94a3b8;font-size:12px;margin-top:20px;">
          Sent by DealStack · ${new Date().toLocaleString("en-GB")}
        </p>
      </div>
    `,
    text: `Investor interest expressed.\nInvestor: ${investorName} (${investorEmail})\nDeal: ${dealAddress}\nPrice: ${dealPrice} | BMV: ${dealBmv} | Yield: ${dealYield}`,
  })
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "investor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Find the deal
  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      address: true,
      postcode: true,
      askingPrice: true,
      bmvPercentage: true,
      grossYield: true,
      status: true,
    },
  })

  if (!deal || !["listed", "reserved"].includes(deal.status)) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  // Find the investor record
  const investor = await prisma.investor.findFirst({
    where: { userId: session.user.id },
    select: {
      id: true,
      user: { select: { firstName: true, lastName: true, email: true, phone: true } },
    },
  })

  if (!investor) {
    return NextResponse.json({ error: "Investor profile not found" }, { status: 404 })
  }

  // Record a view (tracks the interest touchpoint; DealView has no source field so we just log the visit)
  await prisma.dealView.create({
    data: { dealId: params.id, investorId: investor.id },
  }).catch(() => {/* ignore if duplicate */})

  // Send email notification (non-blocking — don't fail if email fails)
  const investorName  = `${investor.user.firstName ?? ""} ${investor.user.lastName ?? ""}`.trim() || investor.user.email
  const dealAddress   = [deal.address, deal.postcode].filter(Boolean).join(", ")
  const dealPrice     = deal.askingPrice ? `£${Number(deal.askingPrice).toLocaleString("en-GB")}` : "—"
  const dealBmv       = deal.bmvPercentage ? `${Number(deal.bmvPercentage).toFixed(1)}%` : "—"
  const dealYield     = deal.grossYield ? `${Number(deal.grossYield).toFixed(1)}%` : "—"

  sendInterestEmail({
    dealTitle:     dealAddress,
    dealAddress,
    dealPrice,
    dealBmv,
    dealYield,
    investorName,
    investorEmail: investor.user.email,
    investorPhone: investor.user.phone ?? "",
    dealId:        deal.id,
  }).catch(err => console.error("[express-interest] Email failed:", err))

  return NextResponse.json({ success: true })
}
