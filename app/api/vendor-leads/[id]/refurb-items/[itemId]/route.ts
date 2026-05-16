/**
 * PATCH  /api/vendor-leads/[id]/refurb-items/[itemId]  — update a line item
 * DELETE /api/vendor-leads/[id]/refurb-items/[itemId]  — delete a line item
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const body = await request.json()

  // Build SET clauses for only supplied fields
  const updates: string[] = []
  const values: any[] = []

  if (body.category !== undefined) {
    updates.push(`category = $${updates.length + 1}`)
    values.push(body.category)
  }
  if (body.description !== undefined) {
    updates.push(`description = $${updates.length + 1}`)
    values.push(body.description)
  }
  if (body.estimatedCost !== undefined) {
    updates.push(`estimated_cost = $${updates.length + 1}`)
    values.push(Math.max(0, Number(body.estimatedCost) || 0))
  }
  if (body.notes !== undefined) {
    updates.push(`notes = $${updates.length + 1}`)
    values.push(body.notes)
  }
  if (body.sortOrder !== undefined) {
    updates.push(`sort_order = $${updates.length + 1}`)
    values.push(Number(body.sortOrder))
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 })
  }

  updates.push(`updated_at = NOW()`)

  // Use tagged template literal for safe update
  await prisma.$executeRaw`
    UPDATE refurb_line_items
    SET
      category       = COALESCE(${body.category       ?? null}, category),
      description    = COALESCE(${body.description    ?? null}, description),
      estimated_cost = COALESCE(${body.estimatedCost != null ? Math.max(0, Number(body.estimatedCost)) : null}, estimated_cost),
      notes          = COALESCE(${body.notes          ?? null}, notes),
      sort_order     = COALESCE(${body.sortOrder      != null ? Number(body.sortOrder) : null}, sort_order),
      updated_at     = NOW()
    WHERE id = ${params.itemId}
      AND vendor_lead_id = ${params.id}
  `

  // Re-sync estimated_refurb_cost on the lead
  await prisma.$executeRaw`
    UPDATE vendor_leads
    SET estimated_refurb_cost = (
      SELECT COALESCE(SUM(estimated_cost), 0)
      FROM refurb_line_items
      WHERE vendor_lead_id = ${params.id}
    )
    WHERE id = ${params.id}
  `

  return NextResponse.json({ success: true })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; itemId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  await prisma.$executeRaw`
    DELETE FROM refurb_line_items
    WHERE id = ${params.itemId}
      AND vendor_lead_id = ${params.id}
  `

  // Re-sync estimated_refurb_cost on the lead
  await prisma.$executeRaw`
    UPDATE vendor_leads
    SET estimated_refurb_cost = (
      SELECT COALESCE(SUM(estimated_cost), 0)
      FROM refurb_line_items
      WHERE vendor_lead_id = ${params.id}
    )
    WHERE id = ${params.id}
  `

  return NextResponse.json({ success: true })
}
