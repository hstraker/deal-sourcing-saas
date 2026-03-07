/**
 * GET /api/vendor-pipeline/leads/[id]/check-results
 * Returns the most recent completed VendorPropertyCheck for the lead,
 * plus a summary list of all check history.
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
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        latestCheckRisk: true,
        latestCheckedAt: true,
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Most recent completed check
    const latestCheck = await prisma.vendorPropertyCheck.findFirst({
      where: {
        vendorLeadId: params.id,
        checkStatus: "success",
      },
      orderBy: { triggeredAt: "desc" },
    })

    // Full history (summary only)
    const history = await prisma.vendorPropertyCheck.findMany({
      where: { vendorLeadId: params.id },
      orderBy: { triggeredAt: "desc" },
      select: {
        id: true,
        triggeredBy: true,
        triggeredAt: true,
        completedAt: true,
        checkStatus: true,
        overallRisk: true,
        riskScore: true,
        isMockData: true,
        mockScenarioId: true,
        durationMs: true,
      },
    })

    return NextResponse.json({
      lead: {
        id: lead.id,
        latestCheckRisk: lead.latestCheckRisk,
        latestCheckedAt: lead.latestCheckedAt,
      },
      latestCheck,
      history,
    })
  } catch (error: any) {
    console.error("[check-results] Error:", error)
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
