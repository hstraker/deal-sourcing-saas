/**
 * POST /api/vendor-leads/[id]/fetch-epc
 *
 * Standalone EPC fetch — calls PropertyData energy-efficiency endpoint
 * and stores the result on the lead without running a full BMV calculation.
 * Free endpoint (uses 0 PropertyData credits — EPC is a free lookup).
 *
 * Sourcer / Admin only.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { fetchEpcData, matchEpcRecord } from "@/lib/propertydata"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true, propertyAddress: true, propertyPostcode: true },
  })
  if (!lead) return new NextResponse("Lead not found", { status: 404 })

  if (!lead.propertyPostcode) {
    return NextResponse.json(
      { error: "No postcode on this lead — add a full postcode first" },
      { status: 400 }
    )
  }

  // Full postcode check (outcode-only won't work)
  const isFullPostcode = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/i.test(
    lead.propertyPostcode.trim()
  )
  if (!isFullPostcode) {
    return NextResponse.json(
      { error: `"${lead.propertyPostcode}" looks like an outcode — need a full postcode (e.g. SA5 1AB)` },
      { status: 400 }
    )
  }

  try {
    const records = await fetchEpcData(lead.propertyPostcode)

    if (!records || records.length === 0) {
      return NextResponse.json({
        success: false,
        found: false,
        message: "No EPC records found for this postcode",
      })
    }

    const best = matchEpcRecord(records, lead.propertyAddress ?? null)

    if (!best || !/^[A-Ga-g]$/.test(best.rating)) {
      return NextResponse.json({
        success: false,
        found: false,
        message: `EPC record found but rating "${best?.rating}" is not a valid A–G band`,
      })
    }

    // Persist to DB
    await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        epcRating: best.rating.toUpperCase(),
        epcScore: best.score,
        epcInspectionDate: best.inspectionDate,
      },
    })

    const isMortgageRisk = ["D", "E", "F", "G"].includes(best.rating.toUpperCase())

    return NextResponse.json({
      success: true,
      found: true,
      epcRating: best.rating.toUpperCase(),
      epcScore: best.score,
      epcInspectionDate: best.inspectionDate,
      totalRecords: records.length,
      matchedAddress: best.address,
      mortgageRisk: isMortgageRisk,
      message: isMortgageRisk
        ? `EPC ${best.rating.toUpperCase()} (${best.score}/100) — ⚠️ D or below may affect mortgage lending`
        : `EPC ${best.rating.toUpperCase()} (${best.score}/100) — good energy efficiency`,
    })
  } catch (err: any) {
    console.error("[fetch-epc] Error:", err)
    return NextResponse.json(
      { error: "EPC fetch failed", detail: err?.message },
      { status: 500 }
    )
  }
}
