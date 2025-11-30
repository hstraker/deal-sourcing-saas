import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"

export async function DELETE(
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
      include: {
        photos: true,
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

    await deleteFile(photo.s3Key)
    await prisma.dealPhoto.delete({ where: { id: photo.id } })

    if (photo.isCover) {
      const nextPhoto = await prisma.dealPhoto.findFirst({
        where: { dealId: id },
        orderBy: [{ sortOrder: "asc" }, { uploadedAt: "desc" }],
      })

      if (nextPhoto) {
        await prisma.dealPhoto.update({
          where: { id: nextPhoto.id },
          data: { isCover: true },
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting photo:", error)
    return NextResponse.json(
      { error: "Failed to delete photo" },
      { status: 500 }
    )
  }
}


