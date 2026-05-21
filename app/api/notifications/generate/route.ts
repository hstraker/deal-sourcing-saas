/**
 * POST /api/notifications/generate
 *
 * Runs all notification generators for the current user and returns the
 * updated notification list + unread count.  Called by the bell component
 * on mount and every 10 minutes.
 */

import { NextResponse }                    from "next/server"
import { getServerSession }                from "next-auth"
import { authOptions }                     from "@/lib/auth"
import { prisma }                          from "@/lib/db"
import { generateNotificationsForUser }    from "@/lib/notifications"

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await generateNotificationsForUser(session.user.id, session.user.role ?? "sourcer")

    // Return the refreshed list
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
    console.error("[notifications/generate]", msg)
    return NextResponse.json({ error: "Generation failed", detail: msg }, { status: 500 })
  }
}
