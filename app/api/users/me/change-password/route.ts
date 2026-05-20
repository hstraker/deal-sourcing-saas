import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const { currentPassword, newPassword } = body

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "currentPassword and newPassword are required" }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  })

  if (!user?.passwordHash) {
    return NextResponse.json({ error: "No password set — use the reset link instead" }, { status: 400 })
  }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 })
  }

  const hash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: hash },
  })

  return NextResponse.json({ ok: true })
}
