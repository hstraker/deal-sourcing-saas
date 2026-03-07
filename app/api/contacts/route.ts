import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ContactType, Prisma } from "@prisma/client"

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const { searchParams } = req.nextUrl
  const type = searchParams.get("type") as ContactType | null
  const search = searchParams.get("search")?.trim()
  const isPreferred = searchParams.get("isPreferred")
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"))
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50")))
  const skip = (page - 1) * limit

  const where: Prisma.ContactWhereInput = {
    ...(type ? { type } : {}),
    ...(isPreferred === "true" ? { isPreferred: true } : {}),
    ...(search
      ? {
          OR: [
            { fullName: { contains: search, mode: "insensitive" } },
            { company: { contains: search, mode: "insensitive" } },
            { sraNumber: { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
            { phone: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  }

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      orderBy: [{ isPreferred: "desc" }, { fullName: "asc" }],
      skip,
      take: limit,
      include: {
        _count: { select: { vendorLeads: true, investors: true } },
      },
    }),
    prisma.contact.count({ where }),
  ])

  return NextResponse.json({ contacts, total, page, limit })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const {
    type, firstName, lastName, company, jobTitle,
    email, phone, mobilePhone,
    addressLine1, addressLine2, city, county, postcode,
    sraNumber, notes, tags, isPreferred, website,
    practiceAreas,
  } = body

  if (!type || !firstName || !lastName) {
    return NextResponse.json(
      { error: "type, firstName, and lastName are required" },
      { status: 400 }
    )
  }

  const normalised = sraNumber?.trim() || null
  if (normalised) {
    const existing = await prisma.contact.findUnique({ where: { sraNumber: normalised } })
    if (existing) {
      return NextResponse.json(
        { error: "A contact with this SRA number already exists" },
        { status: 409 }
      )
    }
  }

  const contact = await prisma.contact.create({
    data: {
      type,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      company: company || null,
      jobTitle: jobTitle || null,
      email: email || null,
      phone: phone || null,
      mobilePhone: mobilePhone || null,
      addressLine1: addressLine1 || null,
      addressLine2: addressLine2 || null,
      city: city || null,
      county: county || null,
      postcode: postcode?.trim().toUpperCase() || null,
      sraNumber: normalised,
      notes: notes || null,
      tags: tags ?? [],
      isPreferred: isPreferred ?? false,
      website: website || null,
      practiceAreas: practiceAreas ?? [],
    },
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
  })

  return NextResponse.json({ contact }, { status: 201 })
}
