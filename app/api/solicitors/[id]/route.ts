import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { contactToSolicitor } from "@/lib/contacts/solicitor-compat"

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, type: "SOLICITOR" },
  })
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({ solicitor: contactToSolicitor(contact) })
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  // Prevent overwriting verification fields via PATCH
  const { sraVerified, sraVerifiedAt, sraStatus, sraDisplayName, ...rest } = body

  // Map Solicitor fields → Contact fields
  const updateData: Record<string, unknown> = {}
  if (rest.name !== undefined) {
    const nameTrimmed = String(rest.name).trim()
    const lastSpace = nameTrimmed.lastIndexOf(" ")
    updateData.firstName = lastSpace > -1 ? nameTrimmed.slice(0, lastSpace) : nameTrimmed
    updateData.lastName = lastSpace > -1 ? nameTrimmed.slice(lastSpace + 1) : ""
    updateData.fullName = nameTrimmed
  }
  if (rest.firmName !== undefined) updateData.company = rest.firmName
  if (rest.sraNumber !== undefined) updateData.sraNumber = rest.sraNumber?.trim() || null
  if (rest.email !== undefined) updateData.email = rest.email || null
  if (rest.phone !== undefined) updateData.phone = rest.phone || null
  if (rest.website !== undefined) updateData.website = rest.website || null
  if (rest.address !== undefined) updateData.addressLine1 = rest.address || null
  if (rest.specialisation !== undefined) {
    updateData.practiceAreas = rest.specialisation ? [rest.specialisation] : []
  }
  if (rest.notes !== undefined) updateData.notes = rest.notes || null

  const contact = await prisma.contact.update({
    where: { id: params.id },
    data: updateData,
  })

  return NextResponse.json({ solicitor: contactToSolicitor(contact) })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  await prisma.contact.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
