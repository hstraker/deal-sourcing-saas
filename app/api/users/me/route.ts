import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSignedDownloadUrl } from "@/lib/s3"

// ── GET /api/users/me — return the current user's full profile ────────────────
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id:                  true,
      email:               true,
      firstName:           true,
      lastName:            true,
      phone:               true,
      bio:                 true,
      timezone:            true,
      role:                true,
      permissions:         true,
      profilePictureS3Key: true,
      isActive:            true,
      createdAt:           true,
      lastLogin:           true,
      notificationPrefs:   true,
    },
  })

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Resolve a signed URL for the profile picture if one is stored
  let profilePictureUrl: string | null = null
  if (user.profilePictureS3Key) {
    try {
      profilePictureUrl = await getSignedDownloadUrl(user.profilePictureS3Key, 3600)
    } catch {
      // Non-fatal — picture may have been deleted from S3
    }
  }

  return NextResponse.json({ ...user, profilePictureUrl })
}

// ── PUT /api/users/me — update own profile ────────────────────────────────────
export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const { firstName, lastName, phone, bio, timezone } = body

  // Validate timezone if provided
  const validTimezones = Intl.supportedValuesOf?.("timeZone") ?? []
  if (timezone && validTimezones.length > 0 && !validTimezones.includes(timezone)) {
    return NextResponse.json({ error: "Invalid timezone" }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      ...(firstName  !== undefined ? { firstName:  firstName?.trim()  || null } : {}),
      ...(lastName   !== undefined ? { lastName:   lastName?.trim()   || null } : {}),
      ...(phone      !== undefined ? { phone:      phone?.trim()      || null } : {}),
      ...(bio        !== undefined ? { bio:        bio?.trim()        || null } : {}),
      ...(timezone   !== undefined ? { timezone } : {}),
    },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      phone: true, bio: true, timezone: true, role: true,
    },
  })

  return NextResponse.json(updated)
}
