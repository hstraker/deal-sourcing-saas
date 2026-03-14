/**
 * GET /api/vendors/[id]/processing-status
 * Lightweight polling endpoint — returns processingStatus + timestamps.
 * Used by the vendor leads table to show per-row progress.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        processingStatus: true,
        bmvValidatedAt: true,
        portalCheckedAt: true,
        latestCheckRisk: true,
        latestCheckedAt: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    return NextResponse.json(lead)
  } catch (error: any) {
    console.error("[ProcessingStatus] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch processing status" },
      { status: 500 }
    )
  }
}
