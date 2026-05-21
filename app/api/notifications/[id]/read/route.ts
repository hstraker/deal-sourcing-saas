/**
 * PATCH /api/notifications/[id]/read
 * Marks a single notification as read. Only the owner may do this.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession }          from "next-auth"
import { authOptions }               from "@/lib/auth"
import { prisma }                    from "@/lib/db"

export async function PATCH(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const updated = await prisma.notification.updateMany({
      where: { id: params.id, userId: session.user.id },
      data:  { read: true },
    })

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[notifications/read]", msg)
    return NextResponse.json({ error: "Failed to mark read" }, { status: 500 })
  }
}
