/**
 * DELETE /api/vendor-leads/[id]/notes/[noteId]  — delete a note
 * PATCH  /api/vendor-leads/[id]/notes/[noteId]  — edit note content
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const note = await prisma.leadNote.findUnique({
    where: { id: params.noteId },
    select: { id: true, vendorLeadId: true, createdById: true },
  })

  if (!note || note.vendorLeadId !== params.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 })
  }

  // Only the author or admin can delete
  if (session.user.role !== "admin" && note.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.leadNote.delete({ where: { id: params.noteId } })

  return NextResponse.json({ success: true })
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; noteId: string } }
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

  const note = await prisma.leadNote.findUnique({
    where: { id: params.noteId },
    select: { id: true, vendorLeadId: true, createdById: true },
  })

  if (!note || note.vendorLeadId !== params.id) {
    return NextResponse.json({ error: "Note not found" }, { status: 404 })
  }

  // Only the author or admin can edit
  if (session.user.role !== "admin" && note.createdById !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const updated = await prisma.leadNote.update({
    where: { id: params.noteId },
    data: { content },
    select: {
      id: true,
      content: true,
      createdById: true,
      createdByName: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return NextResponse.json({ success: true, data: updated })
}
