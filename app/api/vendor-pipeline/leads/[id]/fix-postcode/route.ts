/**
 * POST /api/vendor-pipeline/leads/[id]/fix-postcode
 *
 * Resolves a missing or incorrect postcode for a single vendor lead using the
 * three-tier resolution: stored postcode validation → Land Registry lookup →
 * postcodes.io fallback.
 *
 * Returns: { postcode, source, corrected, lead }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePostcodeFromAddress } from "@/lib/land-registry"

export async function POST(
  _request: NextRequest,
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
      select: { id: true, propertyAddress: true, propertyPostcode: true },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    if (!lead.propertyAddress) {
      return NextResponse.json(
        { error: "No property address set — add an address first" },
        { status: 400 }
      )
    }

    const resolved = await resolvePostcodeFromAddress(
      lead.propertyAddress,
      lead.propertyPostcode,
      new Map()
    )

    if (!resolved) {
      return NextResponse.json(
        { error: "Could not extract a postcode area from the address — try including a town or outcode (e.g. SA5, CF10)" },
        { status: 422 }
      )
    }

    if (!resolved.corrected) {
      // Postcode is already correct — return without updating
      return NextResponse.json({
        postcode: resolved.postcode,
        source: resolved.source,
        corrected: false,
        message: "Postcode is already correct",
      })
    }

    // Update the lead
    const updated = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        propertyPostcode: resolved.postcode,
        propertyPostcodeSource: resolved.source,
        propertyPostcodeFixed: true,
      },
    })

    return NextResponse.json({
      postcode: resolved.postcode,
      source: resolved.source,
      corrected: true,
      lead: updated,
    })
  } catch (error: any) {
    console.error("[FixPostcode] Error:", error)
    return NextResponse.json({ error: error.message ?? "Failed to fix postcode" }, { status: 500 })
  }
}
