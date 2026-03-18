// app/api/user/theme/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { ThemeTokens } from "@/lib/theme/types"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const userTheme = await prisma.userTheme.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ tokens: (userTheme?.tokens ?? {}) as ThemeTokens })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const body = await req.json()
  const incoming = (body.tokens ?? {}) as ThemeTokens

  // Merge incoming tokens with existing ones
  const existing = await prisma.userTheme.findUnique({
    where: { userId: session.user.id },
  })
  const merged = { ...((existing?.tokens ?? {}) as ThemeTokens), ...incoming }

  const updated = await prisma.userTheme.upsert({
    where: { userId: session.user.id },
    update: { tokens: merged },
    create: { userId: session.user.id, tokens: merged },
  })

  return NextResponse.json({ tokens: updated.tokens as ThemeTokens })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  await prisma.userTheme.upsert({
    where: { userId: session.user.id },
    update: { tokens: {} },
    create: { userId: session.user.id, tokens: {} },
  })

  return NextResponse.json({ tokens: {} })
}
