/**
 * GET  /api/vendor-leads/[id]/refurb-items  — list line items
 * POST /api/vendor-leads/[id]/refurb-items  — add a line item
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { randomUUID } from "crypto"

type RawItem = {
  id: string
  vendor_lead_id: string
  category: string
  description: string
  estimated_cost: string | number
  notes: string | null
  sort_order: number
  created_at: Date
  updated_at: Date
}

function formatItem(row: RawItem) {
  return {
    id: row.id,
    vendorLeadId: row.vendor_lead_id,
    category: row.category,
    description: row.description,
    estimatedCost: Number(row.estimated_cost),
    notes: row.notes,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const rows = await prisma.$queryRaw<RawItem[]>`
    SELECT * FROM refurb_line_items
    WHERE vendor_lead_id = ${params.id}
    ORDER BY sort_order ASC, created_at ASC
  `

  const items = rows.map(formatItem)
  const total = items.reduce((s, i) => s + i.estimatedCost, 0)

  return NextResponse.json({ items, total })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true },
  })
  if (!lead) return new NextResponse("Lead not found", { status: 404 })

  const body = await request.json()
  const { category = "other", description, estimatedCost = 0, notes, sortOrder = 0 } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 })
  }

  const id = randomUUID()
  const cost = Math.max(0, Number(estimatedCost) || 0)

  await prisma.$executeRaw`
    INSERT INTO refurb_line_items
      (id, vendor_lead_id, category, description, estimated_cost, notes, sort_order)
    VALUES
      (${id}, ${params.id}, ${category}, ${description.trim()}, ${cost}, ${notes ?? null}, ${sortOrder})
  `

  // Update the lead's estimated_refurb_cost to match the sum
  await prisma.$executeRaw`
    UPDATE vendor_leads
    SET estimated_refurb_cost = (
      SELECT COALESCE(SUM(estimated_cost), 0)
      FROM refurb_line_items
      WHERE vendor_lead_id = ${params.id}
    )
    WHERE id = ${params.id}
  `

  const rows = await prisma.$queryRaw<RawItem[]>`
    SELECT * FROM refurb_line_items WHERE id = ${id} LIMIT 1
  `

  return NextResponse.json({ item: formatItem(rows[0]) }, { status: 201 })
}
