/**
 * GET  /api/notifications  — list the current user's notifications (newest first, max 50)
 * Response: { notifications: Notification[], unreadCount: number }
 */

import { NextResponse }      from "next/server"
import { getServerSession }  from "next-auth"
import { authOptions }       from "@/lib/auth"
import { prisma }            from "@/lib/db"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        take:    50,
        select: {
          id:        true,
          type:      true,
          category:  true,
          title:     true,
          body:      true,
          link:      true,
          read:      true,
          meta:      true,
          createdAt: true,
        },
      }),
      prisma.notification.count({
        where: { userId: session.user.id, read: false },
      }),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[notifications/GET]", msg)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
