/**
 * Archive Vendor Lead API
 * POST /api/vendor-pipeline/leads/[id]/archive
 * Archives a lead: sets pipelineStage=DEAD_LEAD and archivedAt=now()
 * Body (optional): { reason?: string, archiveLinkedDeal?: boolean }
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  request: Request,
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

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    let body: { reason?: string; archiveLinkedDeal?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // body is optional — ignore parse errors
    }

    const { archiveLinkedDeal } = body

    const updatedLead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        pipelineStage: "DEAD_LEAD",
        archivedAt: new Date(),
      },
    })

    let updatedDeal = null
    if (archiveLinkedDeal && lead.dealId) {
      updatedDeal = await prisma.deal.update({
        where: { id: lead.dealId },
        data: { status: "archived", archivedAt: new Date() },
      })
    }

    return NextResponse.json({ lead: updatedLead, deal: updatedDeal })
  } catch (error: any) {
    console.error("Error archiving vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to archive vendor lead" },
      { status: 500 }
    )
  }
}
