/**
 * Update Pipeline Stage API
 * PATCH /api/vendor-pipeline/leads/[id]/update-stage
 * Updates the pipeline stage of a vendor lead (for drag-and-drop)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PipelineStage } from "@prisma/client"
import { z } from "zod"
import { sendVendorOfferMadeEmail, sendVendorOfferAcceptedEmail, sendSourcerOfferAcceptedEmail, sendSourcerOfferRejectedEmail } from "@/lib/email"
import { ensureDealForVendorLead } from "@/lib/vendor-pipeline/auto-deal"

const updateStageSchema = z.object({
  pipelineStage: z.string(),
})

// PATCH /api/vendor-pipeline/leads/[id]/update-stage
export async function PATCH(
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
    const { pipelineStage } = updateStageSchema.parse(body)

    // Get current lead to check stage transitions
    const currentLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!currentLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // If pipeline stage is changing, log event
    if (pipelineStage !== currentLead.pipelineStage) {
      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "stage_transition",
          details: {
            fromStage: currentLead.pipelineStage,
            toStage: pipelineStage,
            changedBy: session.user.id,
            changedAt: new Date().toISOString(),
          },
        },
      })
    }

    // Update the lead
    const lead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        pipelineStage: pipelineStage as PipelineStage,
      },
    })

    // Send automated emails on key stage transitions
    if (pipelineStage !== currentLead.pipelineStage) {
      // ── Vendor-facing emails (only when vendor has an email address) ───────
      if (currentLead.vendorEmail) {
        if (pipelineStage === "OFFER_MADE") {
          sendVendorOfferMadeEmail({
            to: currentLead.vendorEmail,
            vendorName: currentLead.vendorName,
            propertyAddress: currentLead.propertyAddress || "your property",
            offerAmount: currentLead.offerAmount ? Number(currentLead.offerAmount) : null,
            offerPercentage: currentLead.offerPercentage ? Number(currentLead.offerPercentage) : null,
          }).catch((e) => console.error("[update-stage] offer-made email failed:", e))
        } else if (pipelineStage === "OFFER_ACCEPTED") {
          sendVendorOfferAcceptedEmail({
            to: currentLead.vendorEmail,
            vendorName: currentLead.vendorName,
            propertyAddress: currentLead.propertyAddress || "your property",
            offerAmount: currentLead.offerAmount ? Number(currentLead.offerAmount) : null,
          }).catch((e) => console.error("[update-stage] offer-accepted email failed:", e))
        }
      }

      // ── Sourcer-facing emails (always fire regardless of vendor email) ────
      if (pipelineStage === "OFFER_ACCEPTED") {
        // Auto-create deal then notify sourcer(s)
        ensureDealForVendorLead(params.id)
          .then((dealId) => {
            prisma.user.findMany({
              where: { role: { in: ["admin", "sourcer"] }, isActive: true },
              select: { email: true, firstName: true, lastName: true },
            }).then((users) => {
              for (const u of users) {
                sendSourcerOfferAcceptedEmail({
                  to: u.email,
                  sourcerName: u.firstName ?? u.email,
                  vendorName: currentLead.vendorName,
                  propertyAddress: currentLead.propertyAddress || "Unknown address",
                  offerAmount: currentLead.offerAmount ? Number(currentLead.offerAmount) : null,
                  dealId: dealId ?? null,
                  leadId: params.id,
                }).catch((e) => console.error("[update-stage] sourcer accepted email failed:", e))
              }
            }).catch(() => {})
          })
          .catch((e) => console.error("[update-stage] auto-deal failed:", e))
      } else if (pipelineStage === "OFFER_REJECTED") {
        prisma.user.findMany({
          where: { role: { in: ["admin", "sourcer"] }, isActive: true },
          select: { email: true, firstName: true, lastName: true },
        }).then((users) => {
          for (const u of users) {
            sendSourcerOfferRejectedEmail({
              to: u.email,
              sourcerName: u.firstName ?? u.email,
              vendorName: currentLead.vendorName,
              propertyAddress: currentLead.propertyAddress || "Unknown address",
              offerAmount: currentLead.offerAmount ? Number(currentLead.offerAmount) : null,
              retryCount: currentLead.retryCount ?? 0,
              leadId: params.id,
            }).catch((e) => console.error("[update-stage] sourcer rejected email failed:", e))
          }
        }).catch(() => {})
      }
    }

    return NextResponse.json({ lead })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating pipeline stage:", error)
    return NextResponse.json(
      { error: "Failed to update pipeline stage" },
      { status: 500 }
    )
  }
}

