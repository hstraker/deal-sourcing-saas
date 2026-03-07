import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const contact = await prisma.contact.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ contact })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  // Prevent overwriting SRA verification fields via PATCH
  const { sraVerified, sraVerifiedAt, sraStatus, sraDisplayName, ...safe } = body

  // Recompute fullName if names change
  if (safe.firstName || safe.lastName) {
    const existing = await prisma.contact.findUnique({
      where: { id: params.id },
      select: { firstName: true, lastName: true },
    })
    if (existing) {
      const fn = (safe.firstName ?? existing.firstName).trim()
      const ln = (safe.lastName ?? existing.lastName).trim()
      safe.fullName = `${fn} ${ln}`.trim()
    }
  }

  if (safe.postcode) {
    safe.postcode = safe.postcode.trim().toUpperCase()
  }

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: safe,
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
  })

  return NextResponse.json({ contact })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  // Refuse if contact is linked to active vendor leads
  const linkedCount = await prisma.contact.findUnique({
    where: { id: params.id },
    select: { _count: { select: { vendorLeads: true, investors: true } } },
  })

  if (!linkedCount) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const total = linkedCount._count.vendorLeads + linkedCount._count.investors
  if (total > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete: this contact is linked to ${linkedCount._count.vendorLeads} lead(s) and ${linkedCount._count.investors} investor(s). Unlink them first.`,
      },
      { status: 409 }
    )
  }

  await prisma.contact.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
