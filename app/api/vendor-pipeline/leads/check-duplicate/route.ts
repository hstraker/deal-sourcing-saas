/**
 * GET /api/vendor-pipeline/leads/check-duplicate?phone={phone}&excludeId={id}
 * Checks whether a vendor lead with a matching phone number already exists.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/** Normalise a UK phone number and return its last 10 digits for matching. */
function normalisePhone(raw: string): string {
  // Strip whitespace, dashes, brackets, dots
  let p = raw.replace(/[\s\-().+]/g, "")

  // Convert common UK prefixes to E.164 digits-only
  if (p.startsWith("447")) {
    // already 447xxxxxxxxx — keep as-is
  } else if (p.startsWith("07")) {
    p = "447" + p.slice(1) // 07xxx → 447xxx
  } else if (p.startsWith("0")) {
    p = "44" + p.slice(1)  // 0xxx → 44xxx (other UK landlines)
  }

  // Return last 10 digits for flexible matching
  return p.replace(/\D/g, "").slice(-10)
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const phone = searchParams.get("phone")
    const excludeId = searchParams.get("excludeId")

    if (!phone || phone.trim().length < 7) {
      return NextResponse.json({ isDuplicate: false })
    }

    const last10 = normalisePhone(phone.trim())

    if (last10.length < 7) {
      return NextResponse.json({ isDuplicate: false })
    }

    const where: any = {
      vendorPhone: { contains: last10 },
      archivedAt: null,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const existing = await prisma.vendorLead.findFirst({
      where,
      select: {
        id: true,
        vendorName: true,
        pipelineStage: true,
        createdAt: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ isDuplicate: false })
    }

    return NextResponse.json({
      isDuplicate: true,
      existingLead: {
        id: existing.id,
        vendorName: existing.vendorName,
        pipelineStage: existing.pipelineStage,
        createdAt: existing.createdAt.toISOString(),
      },
    })
  } catch (err: any) {
    console.error("[check-duplicate] error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
