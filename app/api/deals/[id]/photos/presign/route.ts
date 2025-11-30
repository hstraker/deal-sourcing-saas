import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { generateS3Key, getPublicUrl, getSignedUploadUrl } from "@/lib/s3"

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"]

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

    const { fileName, fileType } = await request.json()

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "fileName and fileType are required" },
        { status: 400 }
      )
    }

    if (!ALLOWED_FILE_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPEG, PNG, or WEBP images." },
        { status: 400 }
      )
    }

    const key = generateS3Key(`deals/${id}`, fileName)
    console.log("Generating presigned URL:", { key, fileType, dealId: id })
    
    const uploadUrl = await getSignedUploadUrl(key, fileType)
    const fileUrl = getPublicUrl(key)

    console.log("Presigned URL generated successfully:", {
      key,
      uploadUrlPreview: uploadUrl.substring(0, 100) + "...",
      fileUrl,
    })

    return NextResponse.json({ uploadUrl, key, url: fileUrl })
  } catch (error) {
    console.error("Error generating upload URL:", error)
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred"
    return NextResponse.json(
      { error: `Failed to generate upload URL: ${errorMessage}` },
      { status: 500 }
    )
  }
}


