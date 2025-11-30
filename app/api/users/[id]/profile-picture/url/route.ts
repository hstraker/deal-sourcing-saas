import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSignedDownloadUrl } from "@/lib/s3"

// GET /api/users/[id]/profile-picture/url - Get presigned download URL for profile picture
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Users can view their own profile picture, admins can view any
    if (session.user.role !== "admin" && session.user.id !== params.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: { profilePictureS3Key: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (!user.profilePictureS3Key) {
      return NextResponse.json({ error: "No profile picture" }, { status: 404 })
    }

    // Generate presigned download URL (valid for 1 hour)
    const url = await getSignedDownloadUrl(user.profilePictureS3Key, 3600)

    return NextResponse.json({ url })
  } catch (error) {
    console.error("Error generating profile picture URL:", error)
    return NextResponse.json(
      { error: "Failed to generate profile picture URL" },
      { status: 500 }
    )
  }
}

