/**
 * Archive Deal API
 * POST /api/deals/[id]/archive
 * Archives a deal: sets status="archived", archivedAt=now()
 * Body (optional): { archiveLinkedLead?: boolean }
 * If archiveLinkedLead=true, also archives the linked VendorLead.
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

    const existing = await prisma.deal.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    let body: { archiveLinkedLead?: boolean } = {}
    try {
      body = await request.json()
    } catch {
      // body is optional — ignore parse errors
    }

    const { archiveLinkedLead } = body

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: { status: "archived", archivedAt: new Date() },
    })

    if (archiveLinkedLead) {
      await prisma.vendorLead.updateMany({
        where: { dealId: params.id },
        data: { pipelineStage: "DEAD_LEAD", archivedAt: new Date() },
      })
    }

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error("Error archiving deal:", error)
    return NextResponse.json(
      { error: "Failed to archive deal" },
      { status: 500 }
    )
  }
}
