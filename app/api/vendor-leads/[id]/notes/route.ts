/**
 * GET  /api/vendor-leads/[id]/notes  — list notes for a lead (newest first)
 * POST /api/vendor-leads/[id]/notes  — create a new note
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Verify lead exists
  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const notes = await prisma.leadNote.findMany({
    where: { vendorLeadId: params.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      content: true,
      createdById: true,
      createdByName: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: notes })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const content: string = body?.content?.trim() ?? ""
  if (!content) {
    return NextResponse.json({ error: "Note content is required" }, { status: 400 })
  }
  if (content.length > 10_000) {
    return NextResponse.json({ error: "Note too long (max 10,000 chars)" }, { status: 400 })
  }

  // Verify lead exists
  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const user = session.user
  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
    user.email ||
    "Unknown"

  const note = await prisma.leadNote.create({
    data: {
      id: randomUUID(),
      vendorLeadId: params.id,
      content,
      createdById: user.id ?? null,
      createdByName: displayName,
    },
    select: {
      id: true,
      content: true,
      createdById: true,
      createdByName: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: note }, { status: 201 })
}
