import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getSignedUploadUrl, generateS3Key, deleteFile } from "@/lib/s3"

// GET /api/users/[id]/profile-picture - Get presigned upload URL
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can upload profile pictures for other users
    // Users can upload their own profile picture
    if (session.user.role !== "admin" && session.user.id !== params.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get filename from query params
    const { searchParams } = new URL(request.url)
    const filename = searchParams.get("filename") || "profile.jpg"
    const contentType = searchParams.get("contentType") || "image/jpeg"

    // Generate S3 key
    const s3Key = generateS3Key("profile-pictures", filename)

    // Generate presigned upload URL (valid for 5 minutes)
    const uploadUrl = await getSignedUploadUrl(s3Key, contentType, 300)

    return NextResponse.json({
      uploadUrl,
      s3Key,
    })
  } catch (error) {
    console.error("Error generating profile picture upload URL:", error)
    return NextResponse.json(
      { error: "Failed to generate upload URL" },
      { status: 500 }
    )
  }
}

// POST /api/users/[id]/profile-picture - Update user's profile picture S3 key
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can update profile pictures for other users
    // Users can update their own profile picture
    if (session.user.role !== "admin" && session.user.id !== params.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { s3Key } = body

    if (!s3Key) {
      return NextResponse.json(
        { error: "S3 key is required" },
        { status: 400 }
      )
    }

    // Get existing user to check for old profile picture
    const existingUser = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Update user with new profile picture S3 key
    const user = await prisma.user.update({
      where: { id: params.id },
      data: {
        profilePictureS3Key: s3Key,
      },
      select: {
        id: true,
        profilePictureS3Key: true,
      },
    })

    // Delete old profile picture from S3 if it exists and is different
    if (existingUser.profilePictureS3Key && existingUser.profilePictureS3Key !== s3Key) {
      try {
        await deleteFile(existingUser.profilePictureS3Key)
      } catch (error) {
        console.error("Error deleting old profile picture from S3:", error)
        // Continue even if deletion fails
      }
    }

    return NextResponse.json(user)
  } catch (error) {
    console.error("Error updating profile picture:", error)
    return NextResponse.json(
      { error: "Failed to update profile picture" },
      { status: 500 }
    )
  }
}

// DELETE /api/users/[id]/profile-picture - Remove profile picture
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can delete profile pictures for other users
    // Users can delete their own profile picture
    if (session.user.role !== "admin" && session.user.id !== params.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: params.id },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Delete profile picture from S3 if it exists
    if (user.profilePictureS3Key) {
      try {
        await deleteFile(user.profilePictureS3Key)
      } catch (error) {
        console.error("Error deleting profile picture from S3:", error)
        // Continue with update even if S3 deletion fails
      }
    }

    // Remove profile picture reference from user
    await prisma.user.update({
      where: { id: params.id },
      data: {
        profilePictureS3Key: null,
      },
    })

    return NextResponse.json({ message: "Profile picture removed successfully" })
  } catch (error) {
    console.error("Error removing profile picture:", error)
    return NextResponse.json(
      { error: "Failed to remove profile picture" },
      { status: 500 }
    )
  }
}

