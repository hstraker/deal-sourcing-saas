/**
 * PATCH /api/notifications/read-all
 * Marks every unread notification for the current user as read.
 */

import { NextResponse }     from "next/server"
import { getServerSession } from "next-auth"
import { authOptions }      from "@/lib/auth"
import { prisma }           from "@/lib/db"

export async function PATCH() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { count } = await prisma.notification.updateMany({
      where: { userId: session.user.id, read: false },
      data:  { read: true },
    })

    return NextResponse.json({ success: true, marked: count })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[notifications/read-all]", msg)
    return NextResponse.json({ error: "Failed to mark all read" }, { status: 500 })
  }
}
