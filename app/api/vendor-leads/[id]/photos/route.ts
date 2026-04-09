import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSignedDownloadUrl } from "@/lib/s3"

// GET /api/vendor-leads/[id]/photos
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const photos = await prisma.propertyPhoto.findMany({
      where: { vendorLeadId: params.id, isDeleted: false },
      orderBy: [{ sortOrder: "asc" }, { uploadedAt: "asc" }],
    })

    // Replace stored URLs with signed URLs for private S3 objects
    const photosWithUrls = await Promise.all(
      photos.map(async (photo) => {
        if (photo.s3Key) {
          try {
            const signedUrl = await getSignedDownloadUrl(photo.s3Key, 3600)
            return { ...photo, url: signedUrl }
          } catch {
            return photo
          }
        }
        return photo
      })
    )

    return NextResponse.json({ photos: photosWithUrls })
  } catch (error) {
    console.error("[photos GET]", error)
    return NextResponse.json({ photos: [], error: "Failed to load photos" }, { status: 500 })
  }
}
