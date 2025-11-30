import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { deleteFile, getSignedDownloadUrl } from "@/lib/s3"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const deal = await prisma.deal.findUnique({
      where: { id },
      select: {
        id: true,
        assignedToId: true,
        createdById: true,
        photos: {
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }, { uploadedAt: "desc" }],
        },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    if (
      session.user.role === "sourcer" &&
      deal.assignedToId !== session.user.id &&
      deal.createdById !== session.user.id &&
      deal.assignedToId !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Generate presigned URLs for viewing (valid for 1 hour)
    const photosWithUrls = await Promise.all(
      deal.photos.map(async (photo) => {
        const signedUrl = await getSignedDownloadUrl(photo.s3Key, 3600)
        return {
          ...photo,
          s3Url: signedUrl, // Replace stored URL with presigned URL
        }
      })
    )

    return NextResponse.json(photosWithUrls)
  } catch (error) {
    console.error("Error fetching deal photos:", error)
    return NextResponse.json(
      { error: "Failed to load photos" },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    console.log("Saving photo metadata for deal:", id)

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

    const body = await request.json()
    const { key, url, fileName, caption } = body

    console.log("Photo metadata received:", { key, url, fileName, dealId: deal.id })

    if (!key || !url || !fileName) {
      console.error("Missing required fields:", { key: !!key, url: !!url, fileName: !!fileName })
      return NextResponse.json(
        { error: "key, url, and fileName are required" },
        { status: 400 }
      )
    }

    const existingCount = await prisma.dealPhoto.count({
      where: { dealId: deal.id },
    })

    console.log("Existing photo count:", existingCount)

    const photo = await prisma.dealPhoto.create({
      data: {
        dealId: deal.id,
        s3Key: key,
        s3Url: url,
        caption: caption || null,
        sortOrder: existingCount,
        isCover: existingCount === 0,
        uploadedAt: new Date(),
      },
    })

    console.log("Photo saved successfully:", { photoId: photo.id, isCover: photo.isCover })
    return NextResponse.json(photo)
  } catch (error) {
    console.error("Error saving deal photo:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Failed to save photo: ${errorMessage}` },
      { status: 500 }
    )
  }
}


