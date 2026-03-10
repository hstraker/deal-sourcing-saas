import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const alert = await prisma.sourcingAlert.findUnique({ where: { id: params.id } })
  if (!alert || alert.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const body = await req.json()
  const updated = await prisma.sourcingAlert.update({
    where: { id: params.id },
    data: {
      name: body.name !== undefined ? body.name : alert.name,
      address: body.address ?? alert.address,
      radius: body.radius ?? alert.radius,
      latitude: body.latitude !== undefined ? body.latitude : alert.latitude,
      longitude: body.longitude !== undefined ? body.longitude : alert.longitude,
      minPrice: body.minPrice !== undefined ? (body.minPrice ? parseInt(body.minPrice) : null) : alert.minPrice,
      maxPrice: body.maxPrice !== undefined ? (body.maxPrice ? parseInt(body.maxPrice) : null) : alert.maxPrice,
      minBedrooms: body.minBedrooms !== undefined ? (body.minBedrooms ? parseInt(body.minBedrooms) : null) : alert.minBedrooms,
      maxBedrooms: body.maxBedrooms !== undefined ? (body.maxBedrooms ? parseInt(body.maxBedrooms) : null) : alert.maxBedrooms,
      propertyTypes: body.propertyTypes !== undefined ? body.propertyTypes : alert.propertyTypes,
      isActive: body.isActive !== undefined ? Boolean(body.isActive) : alert.isActive,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const alert = await prisma.sourcingAlert.findUnique({ where: { id: params.id } })
  if (!alert || alert.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  await prisma.sourcingAlert.delete({ where: { id: params.id } })
  return NextResponse.json({ success: true })
}
