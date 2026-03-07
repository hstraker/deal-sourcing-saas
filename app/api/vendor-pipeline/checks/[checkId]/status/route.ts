/**
 * GET /api/vendor-pipeline/checks/[checkId]/status
 * Lightweight polling endpoint — returns just the status + risk of a single check.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  request: NextRequest,
  { params }: { params: { checkId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const check = await prisma.vendorPropertyCheck.findUnique({
      where: { id: params.checkId },
      select: {
        id: true,
        checkStatus: true,
        overallRisk: true,
        riskScore: true,
        isMockData: true,
        completedAt: true,
        durationMs: true,
        errorMessage: true,
      },
    })

    if (!check) return NextResponse.json({ error: "Check not found" }, { status: 404 })

    return NextResponse.json(check)
  } catch (error: any) {
    return NextResponse.json({ error: error.message ?? "Internal server error" }, { status: 500 })
  }
}
