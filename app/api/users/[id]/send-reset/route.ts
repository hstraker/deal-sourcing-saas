import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import crypto from "crypto"
import { sendPasswordResetEmail } from "@/lib/email"

// POST /api/users/[id]/send-reset — Admin sends a password reset email to any user
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: { id: true, email: true, firstName: true, lastName: true },
  })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  // Generate a 1-hour reset token
  const token   = crypto.randomBytes(32).toString("hex")
  const expires = new Date(Date.now() + 60 * 60 * 1000)

  await prisma.user.update({
    where: { id: params.id },
    data: { resetPasswordToken: token, resetPasswordTokenExpires: expires },
  })

  await sendPasswordResetEmail(user.email, token)

  return NextResponse.json({ ok: true, email: user.email })
}
