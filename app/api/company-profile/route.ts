import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/company-profile - Get company profile (public for logo display)
export async function GET(request: NextRequest) {
  try {
    // Get the first (and should be only) company profile
    const profile = await prisma.companyProfile.findFirst()

    if (!profile) {
      // Return default if none exists
      return NextResponse.json({
        profile: {
          companyName: "DealStack",
          primaryColor: "#3b82f6",
          secondaryColor: "#10b981",
        },
      })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error("Error fetching company profile:", error)
    return NextResponse.json(
      { error: "Failed to fetch company profile" },
      { status: 500 }
    )
  }
}

// PATCH /api/company-profile - Update company profile (admin only)
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // Get existing profile or create if doesn't exist
    let profile = await prisma.companyProfile.findFirst()

    if (profile) {
      // Update existing
      profile = await prisma.companyProfile.update({
        where: { id: profile.id },
        data: {
          companyName: body.companyName,
          companyEmail: body.companyEmail || null,
          companyPhone: body.companyPhone || null,
          companyWebsite: body.companyWebsite || null,
          companyAddress: body.companyAddress || null,
          logoUrl: body.logoUrl || null,
          logoS3Key: body.logoS3Key || null,
          primaryColor: body.primaryColor || "#3b82f6",
          secondaryColor: body.secondaryColor || "#10b981",
          description: body.description || null,
          tagline: body.tagline || null,
          linkedinUrl: body.linkedinUrl || null,
          facebookUrl: body.facebookUrl || null,
          twitterUrl: body.twitterUrl || null,
          instagramUrl: body.instagramUrl || null,
          companyNumber: body.companyNumber || null,
          vatNumber: body.vatNumber || null,
          fcaNumber: body.fcaNumber || null,
        },
      })
    } else {
      // Create new
      profile = await prisma.companyProfile.create({
        data: {
          companyName: body.companyName || "DealStack",
          companyEmail: body.companyEmail || null,
          companyPhone: body.companyPhone || null,
          companyWebsite: body.companyWebsite || null,
          companyAddress: body.companyAddress || null,
          logoUrl: body.logoUrl || null,
          logoS3Key: body.logoS3Key || null,
          primaryColor: body.primaryColor || "#3b82f6",
          secondaryColor: body.secondaryColor || "#10b981",
          description: body.description || null,
          tagline: body.tagline || null,
          linkedinUrl: body.linkedinUrl || null,
          facebookUrl: body.facebookUrl || null,
          twitterUrl: body.twitterUrl || null,
          instagramUrl: body.instagramUrl || null,
          companyNumber: body.companyNumber || null,
          vatNumber: body.vatNumber || null,
          fcaNumber: body.fcaNumber || null,
        },
      })
    }

    return NextResponse.json({ profile })
  } catch (error: any) {
    console.error("Error updating company profile:", error)
    return NextResponse.json(
      { error: "Failed to update company profile" },
      { status: 500 }
    )
  }
}
