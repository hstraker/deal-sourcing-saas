// app/api/action-counts/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export interface ActionItem {
  type: "deal" | "vendor"
  id: string
  label: string
  href: string
  action: string
  urgency: "high" | "medium" | "low"
  reason: string
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)

    const [dealsInProgress, needsActionLeads] = await Promise.all([
      prisma.deal.findMany({
        where: {
          status: "in_progress",
          investorReservations: { none: { status: { not: "cancelled" } } },
        },
        select: { id: true, address: true, postcode: true },
        orderBy: { updatedAt: "desc" },
        take: 20,
      }),
      prisma.vendorLead.findMany({
        where: {
          archivedAt: null,
          OR: [
            // Validation passed but no offer made yet
            { validationPassed: true, offerAmount: null, pipelineStage: { in: ["DEAL_VALIDATION", "AI_CONVERSATION"] } },
            // Offer accepted — need to complete deal setup
            { pipelineStage: "OFFER_ACCEPTED" },
            // Offer rejected — need to decide next action
            { pipelineStage: "OFFER_REJECTED" },
            // In retry stages — need revised offer
            { pipelineStage: { in: ["RETRY_1", "RETRY_2", "RETRY_3"] } },
            // Stale leads — no progression in 14+ days
            { pipelineStage: { in: ["NEW_LEAD", "AI_CONVERSATION", "DEAL_VALIDATION", "OFFER_MADE", "PAPERWORK_SENT"] }, updatedAt: { lt: fourteenDaysAgo } },
          ],
        },
        select: {
          id: true,
          vendorName: true,
          propertyAddress: true,
          pipelineStage: true,
          validationPassed: true,
          offerAmount: true,
          updatedAt: true,
          bmvScore: true,
        },
        orderBy: { updatedAt: "asc" },
        take: 50,
      }),
    ])

    const items: ActionItem[] = [
      ...dealsInProgress.map((d) => ({
        type: "deal" as const,
        id: d.id,
        label: [d.address, d.postcode].filter(Boolean).join(", "),
        href: `/dashboard/deals/${d.id}`,
        action: "Complete Setup",
        urgency: "medium" as const,
        reason: "In progress — no investor reservation yet",
      })),
      ...needsActionLeads.map((v) => {
        const stage = v.pipelineStage
        const daysSinceUpdate = Math.floor((Date.now() - new Date(v.updatedAt).getTime()) / 86400000)
        let action = "Review"
        let urgency: "high" | "medium" | "low" = "medium"
        let reason = ""

        if (stage === "OFFER_ACCEPTED") {
          action = "Complete Deal Setup"
          urgency = "high"
          reason = "Offer accepted — create and complete deal record"
        } else if (stage === "OFFER_REJECTED") {
          action = "Decide Next Step"
          urgency = "high"
          reason = "Offer rejected — retry, nurture, or close lead"
        } else if (stage === "RETRY_1" || stage === "RETRY_2" || stage === "RETRY_3") {
          action = "Send Revised Offer"
          urgency = "medium"
          reason = `${stage.replace("_", " ")} — send revised offer to vendor`
        } else if (v.validationPassed && !v.offerAmount) {
          action = "Make Offer"
          urgency = "high"
          reason = `Validation passed${v.bmvScore ? ` (${Number(v.bmvScore).toFixed(1)}% BMV)` : ""} — ready to offer`
        } else {
          action = "Review"
          urgency = "low"
          reason = `Stale ${daysSinceUpdate}d — no progression`
        }

        return {
          type: "vendor" as const,
          id: v.id,
          label: v.propertyAddress ?? v.vendorName,
          href: `/dashboard/vendors`,
          action,
          urgency,
          reason,
        }
      }),
    ]

    const highCount = items.filter((i) => i.type === "vendor" && i.urgency === "high").length
    const totalVendorCount = items.filter((i) => i.type === "vendor").length

    return NextResponse.json({
      dealsCount: dealsInProgress.length,
      vendorsCount: totalVendorCount,
      needsActionCount: highCount,
      items,
    })
  } catch (error) {
    console.error("Error fetching action counts:", error)
    return NextResponse.json({ error: "Failed to fetch action counts" }, { status: 500 })
  }
}
