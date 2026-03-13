import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import crypto from "crypto"
import { sendInviteEmail } from "@/lib/email"

// POST /api/users/[id]/resend-invite — Resend invite to a pending user (admin only)
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        passwordHash: true,
        isActive: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.passwordHash) {
      return NextResponse.json(
        { error: "User has already accepted their invite" },
        { status: 400 }
      )
    }

    // Regenerate token (48h expiry — old token is invalidated)
    const inviteToken = crypto.randomBytes(32).toString("hex")
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: params.id },
      data: {
        resetPasswordToken: inviteToken,
        resetPasswordTokenExpires: inviteExpires,
      },
    })

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const inviteUrl = `${appUrl}/reset-password?token=${inviteToken}`

    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

    const emailResult = await sendInviteEmail(user.email, displayName, inviteUrl)

    return NextResponse.json({ inviteUrl, emailSent: emailResult.success })
  } catch (error) {
    console.error("Error resending invite:", error)
    return NextResponse.json({ error: "Failed to resend invite" }, { status: 500 })
  }
}
