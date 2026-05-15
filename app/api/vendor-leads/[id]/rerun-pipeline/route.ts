/**
 * POST /api/vendor-leads/[id]/rerun-pipeline
 *
 * Re-runs the full auto-trigger pipeline for an existing lead:
 *   Phase 1 — address normalisation
 *   Phase 2 — portal check + comparables (parallel)
 *   Phase 3 — BMV / validation calculation
 *   Phase 4 — update processingStatus + notify sourcers if passed
 *
 * Requires an active admin or sourcer session.
 * The call awaits the full pipeline before responding, so the client can
 * show a spinner and then refresh the lead row on completion.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { runVendorLeadAutoTriggers } from "@/lib/services/vendorLeadAutoTriggers"
import { prisma } from "@/lib/db"

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = params

  // ── Verify lead exists ───────────────────────────────────────────────────
  const lead = await prisma.vendorLead.findUnique({
    where: { id },
    select: { id: true },
  })
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }

  // ── Run pipeline ─────────────────────────────────────────────────────────
  try {
    await runVendorLeadAutoTriggers(id)
    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error(`[RerunPipeline] Error for lead ${id}:`, err?.message)
    return NextResponse.json(
      { error: err?.message ?? "Pipeline failed" },
      { status: 500 }
    )
  }
}
