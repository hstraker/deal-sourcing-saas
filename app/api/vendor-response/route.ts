/**
 * GET /api/vendor-response?token=...
 * Public endpoint — no authentication required.
 * Validates a vendor offer token and updates the pipeline stage accordingly.
 * Redirects to /vendor-response?result=accepted|rejected|expired|invalid
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { verifyVendorOfferToken } from "@/lib/vendor-token"
import { sendVendorOfferAcceptedEmail, sendVendorOfferRejectedEmail } from "@/lib/email"
import { ensureDealForVendorLead } from "@/lib/vendor-pipeline/auto-deal"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/vendor-response?result=invalid", request.url))
  }

  // We need to load the lead to check the current offerTokenVersion.
  // First decode the leadId from the token (without verifying version yet).
  const parts = token.split(".")
  if (parts.length !== 2) {
    return NextResponse.redirect(new URL("/vendor-response?result=invalid", request.url))
  }

  let leadId: string
  try {
    const raw = JSON.parse(Buffer.from(parts[0], "base64url").toString())
    leadId = raw.leadId
    if (!leadId) throw new Error("no leadId")
  } catch {
    return NextResponse.redirect(new URL("/vendor-response?result=invalid", request.url))
  }

  const lead = await prisma.vendorLead.findUnique({
    where: { id: leadId },
    select: { id: true, offerTokenVersion: true, pipelineStage: true, vendorName: true, propertyAddress: true, vendorEmail: true, offerAmount: true },
  })

  if (!lead) {
    return NextResponse.redirect(new URL("/vendor-response?result=invalid", request.url))
  }

  const result = verifyVendorOfferToken(token, lead.offerTokenVersion)

  if (!result.valid) {
    const reason = result.error === "expired" ? "expired" : "invalid"
    return NextResponse.redirect(new URL(`/vendor-response?result=${reason}`, request.url))
  }

  const action = result.action!

  // Idempotency — if already accepted or rejected, surface the existing result
  if (
    (action === "accept" && lead.pipelineStage === "OFFER_ACCEPTED") ||
    (action === "reject" && lead.pipelineStage === "OFFER_REJECTED")
  ) {
    return NextResponse.redirect(new URL(`/vendor-response?result=${action}ed`, request.url))
  }

  // Update pipeline stage + timestamps
  if (action === "accept") {
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: {
        pipelineStage: "OFFER_ACCEPTED",
        offerAcceptedAt: new Date(),
      },
    })

    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: leadId,
        eventType: "offer_accepted",
        details: { source: "vendor_email_cta", action: "accept" },
      },
    })

    if (lead.vendorEmail) {
      sendVendorOfferAcceptedEmail({
        to: lead.vendorEmail,
        vendorName: lead.vendorName,
        propertyAddress: lead.propertyAddress || "your property",
        offerAmount: lead.offerAmount ? Number(lead.offerAmount) : null,
      }).catch((e) => console.error("[vendor-response] offer-accepted email failed:", e))
    }
    ensureDealForVendorLead(leadId).catch((e) => console.error("[vendor-response] auto-deal failed:", e))
  } else {
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: {
        pipelineStage: "OFFER_REJECTED",
        offerRejectedAt: new Date(),
      },
    })

    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: leadId,
        eventType: "offer_rejected",
        details: { source: "vendor_email_cta", action: "reject" },
      },
    })

    if (lead.vendorEmail) {
      sendVendorOfferRejectedEmail({
        to: lead.vendorEmail,
        vendorName: lead.vendorName,
        propertyAddress: lead.propertyAddress || "your property",
      }).catch((e) => console.error("[vendor-response] offer-rejected email failed:", e))
    }
  }

  return NextResponse.redirect(
    new URL(`/vendor-response?result=${action}ed`, request.url)
  )
}
