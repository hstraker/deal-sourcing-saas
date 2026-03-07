import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { verifySolicitorSRA } from "@/lib/sra-verification"
import { contactToSolicitor } from "@/lib/contacts/solicitor-compat"

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const contact = await prisma.contact.findFirst({
    where: { id: params.id, type: "SOLICITOR" },
  })
  if (!contact) return NextResponse.json({ error: "Solicitor not found" }, { status: 404 })
  if (!contact.sraNumber) return NextResponse.json({ error: "No SRA number on record for this solicitor" }, { status: 400 })

  const result = await verifySolicitorSRA(contact.sraNumber)

  const updated = await prisma.contact.update({
    where: { id: params.id },
    data: {
      sraVerified: result.verified,
      sraStatus: result.status,
      sraDisplayName: result.displayName,
      sraVerifiedAt: new Date(),
    },
  })

  return NextResponse.json({
    solicitor: contactToSolicitor(updated),
    verification: result,
  })
}
