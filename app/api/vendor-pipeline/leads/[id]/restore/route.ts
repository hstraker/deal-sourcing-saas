/**
 * Restore Vendor Lead API
 * POST /api/vendor-pipeline/leads/[id]/restore
 * Restores a lead: clears archivedAt, sets pipelineStage back to DEAD_LEAD
 * so it's visible for review but not dumped back into the active pipeline.
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

    const existing = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!existing) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    const lead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: { archivedAt: null, pipelineStage: "DEAD_LEAD" },
    })

    return NextResponse.json({ lead })
  } catch (error: any) {
    console.error("Error restoring vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to restore vendor lead" },
      { status: 500 }
    )
  }
}
