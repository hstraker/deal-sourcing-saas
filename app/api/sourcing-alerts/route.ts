import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const alerts = await prisma.sourcingAlert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })

  return NextResponse.json(alerts)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const { name, address, radius, latitude, longitude, minPrice, maxPrice, minBedrooms, maxBedrooms, propertyTypes } = body

  if (!address || !radius) {
    return NextResponse.json({ error: "address and radius are required" }, { status: 400 })
  }

  const alert = await prisma.sourcingAlert.create({
    data: {
      userId: session.user.id,
      name: name || null,
      address,
      radius,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      minPrice: minPrice ? parseInt(minPrice) : null,
      maxPrice: maxPrice ? parseInt(maxPrice) : null,
      minBedrooms: minBedrooms ? parseInt(minBedrooms) : null,
      maxBedrooms: maxBedrooms ? parseInt(maxBedrooms) : null,
      propertyTypes: propertyTypes ?? [],
      isActive: true,
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
