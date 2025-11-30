import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, photoId } = await params
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: {
        id: true,
        assignedToId: true,
        createdById: true,
      },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (
      session.user.role !== "admin" &&
      session.user.role !== "sourcer"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (
      session.user.role === "sourcer" &&
      deal.assignedToId !== session.user.id &&
      deal.createdById !== session.user.id &&
      deal.assignedToId !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const photo = await prisma.dealPhoto.findUnique({
      where: { id: photoId },
    })

    if (!photo || photo.dealId !== id) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 })
    }

    await prisma.dealPhoto.updateMany({
      where: { dealId: id, isCover: true },
      data: { isCover: false },
    })

    await prisma.dealPhoto.update({
      where: { id: photo.id },
      data: { isCover: true },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating cover photo:", error)
    return NextResponse.json(
      { error: "Failed to update cover photo" },
      { status: 500 }
    )
  }
}


