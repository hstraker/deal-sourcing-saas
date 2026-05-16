/**
 * POST /api/vendor-leads/[id]/handover
 *
 * Toggles AI handover mode on a vendor lead.
 * When ai_paused=true the SMS webhook will skip AI processing and let the
 * sourcer reply manually from the same Twilio number.
 *
 * Body: { paused: boolean }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const body = await request.json()
  const paused: boolean = Boolean(body.paused)

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!lead) return new NextResponse("Lead not found", { status: 404 })

  // Use $executeRaw because Prisma client doesn't yet know about ai_paused
  // (schema not regenerated yet — using raw SQL as per project pattern)
  await prisma.$executeRaw`
    UPDATE vendor_leads
    SET
      ai_paused       = ${paused},
      ai_paused_at    = ${paused ? new Date() : null},
      ai_paused_by_name = ${paused ? (session.user.name ?? session.user.email ?? "Unknown") : null}
    WHERE id = ${params.id}
  `

  return NextResponse.json({
    success: true,
    aiPaused: paused,
    message: paused
      ? "AI paused — you are now in control of the conversation"
      : "AI resumed — AI will handle inbound replies automatically",
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })

  const rows = await prisma.$queryRaw<
    Array<{ ai_paused: boolean; ai_paused_at: Date | null; ai_paused_by_name: string | null }>
  >`
    SELECT ai_paused, ai_paused_at, ai_paused_by_name
    FROM vendor_leads
    WHERE id = ${params.id}
    LIMIT 1
  `

  if (!rows.length) return new NextResponse("Lead not found", { status: 404 })

  const row = rows[0]
  return NextResponse.json({
    aiPaused: row.ai_paused,
    aiPausedAt: row.ai_paused_at,
    aiPausedByName: row.ai_paused_by_name,
  })
}
