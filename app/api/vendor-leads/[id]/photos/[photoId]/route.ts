import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteFile } from "@/lib/s3"

// DELETE /api/vendor-leads/[id]/photos/[photoId]
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; photoId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const photo = await prisma.propertyPhoto.findUnique({
    where: { id: params.photoId },
  })
  if (!photo || photo.vendorLeadId !== params.id) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 })
  }

  // Soft-delete (keep S3 object for now — or hard delete from S3 too)
  await prisma.propertyPhoto.update({
    where: { id: params.photoId },
    data: { isDeleted: true },
  })

  // Optionally remove from S3
  try {
    await deleteFile(photo.s3Key)
  } catch {
    // Non-fatal — S3 cleanup can fail silently
  }

  return NextResponse.json({ success: true })
}
