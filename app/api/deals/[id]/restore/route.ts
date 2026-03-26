/**
 * Restore Deal API
 * POST /api/deals/[id]/restore
 * Restores a deal: clears archivedAt, sets status back to "review"
 * so it lands in a safe default state for manual review.
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

    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: { archivedAt: null, status: "review" },
    })

    return NextResponse.json({ deal })
  } catch (error: any) {
    console.error("Error restoring deal:", error)
    return NextResponse.json(
      { error: "Failed to restore deal" },
      { status: 500 }
    )
  }
}
