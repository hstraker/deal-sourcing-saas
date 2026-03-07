import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { contactToSolicitor } from "@/lib/contacts/solicitor-compat"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const search = req.nextUrl.searchParams.get("search")?.trim()

  const contacts = await prisma.contact.findMany({
    where: {
      type: "SOLICITOR",
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: "insensitive" } },
              { company: { contains: search, mode: "insensitive" } },
              { sraNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { fullName: "asc" },
  })

  return NextResponse.json({ solicitors: contacts.map(contactToSolicitor) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const { name, firmName, sraNumber, email, phone, website, address, specialisation, notes } = body

  if (!name || !firmName) {
    return NextResponse.json(
      { error: "name and firmName are required" },
      { status: 400 }
    )
  }

  const normalised = sraNumber?.trim() || null
  if (normalised) {
    const existing = await prisma.contact.findUnique({ where: { sraNumber: normalised } })
    if (existing) {
      return NextResponse.json(
        { error: "A solicitor with this SRA number already exists", existing: contactToSolicitor(existing) },
        { status: 409 }
      )
    }
  }

  // Split full name into first/last
  const nameTrimmed = (name as string).trim()
  const lastSpace = nameTrimmed.lastIndexOf(" ")
  const firstName = lastSpace > -1 ? nameTrimmed.slice(0, lastSpace) : nameTrimmed
  const lastName = lastSpace > -1 ? nameTrimmed.slice(lastSpace + 1) : ""

  const contact = await prisma.contact.create({
    data: {
      type: "SOLICITOR",
      firstName,
      lastName,
      fullName: nameTrimmed,
      company: firmName,
      sraNumber: normalised,
      email: email || null,
      phone: phone || null,
      website: website || null,
      addressLine1: address || null,
      practiceAreas: specialisation ? [specialisation] : [],
      notes: notes || null,
    },
  })

  return NextResponse.json({ solicitor: contactToSolicitor(contact) }, { status: 201 })
}
