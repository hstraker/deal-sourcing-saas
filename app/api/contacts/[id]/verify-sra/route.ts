import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { verifySolicitorSRA } from "@/lib/sra-verification"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const contact = await prisma.contact.findUnique({ where: { id: params.id } })
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 })
  if (contact.type !== "SOLICITOR") {
    return NextResponse.json({ error: "SRA verification is only for SOLICITOR contacts" }, { status: 400 })
  }
  if (!contact.sraNumber) {
    return NextResponse.json({ error: "No SRA number on record for this contact" }, { status: 400 })
  }

  const result = await verifySolicitorSRA(contact.sraNumber)

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: {
      sraVerified: result.verified,
      sraStatus: result.status,
      sraDisplayName: result.displayName,
      sraVerifiedAt: new Date(),
    },
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
  })

  return NextResponse.json({ contact: updated, verification: result })
}
