/**
 * POST /api/vendor-pipeline/leads/[id]/run-check
 * Manually triggers a vendor property portal check for the given lead.
 * Returns immediately after kicking off the async check.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { runVendorCheck } from "@/lib/vendor-checks/vendor-check-orchestrator"

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

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: { id: true },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Run synchronously so the caller gets the result immediately
    const result = await runVendorCheck(params.id, "manual")

    if (!result) {
      return NextResponse.json({ error: "Check failed — see check record for details" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      checkId: result.checkId,
      overallRisk: result.overallRisk,
      riskScore: result.riskScore,
      flagCount: result.flags.length,
      isMockData: result.isMockData,
      durationMs: result.durationMs,
    })
  } catch (error: any) {
    console.error("[run-check] Error:", error)
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
