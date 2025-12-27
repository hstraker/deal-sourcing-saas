import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/investors/activities - Log investor activity
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { investorId, activityType, description, dealId, reservationId, packDeliveryId, metadata } = body

    if (!investorId || !activityType) {
      return NextResponse.json(
        { error: "investorId and activityType are required" },
        { status: 400 }
      )
    }

    // Create activity
    const activity = await prisma.investorActivity.create({
      data: {
        investorId,
        activityType,
        description,
        dealId,
        reservationId,
        packDeliveryId,
        metadata,
        triggeredById: session.user.id,
      },
    })

    // Update investor's lastActivityAt
    await prisma.investor.update({
      where: { id: investorId },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({ activity }, { status: 201 })
  } catch (error: any) {
    console.error("Error logging activity:", error)
    return NextResponse.json(
      { error: "Failed to log activity" },
      { status: 500 }
    )
  }
}

// GET /api/investors/activities?investorId=xxx - Get investor activities
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const investorId = searchParams.get("investorId")
    const limit = parseInt(searchParams.get("limit") || "50")

    if (!investorId) {
      return NextResponse.json(
        { error: "investorId is required" },
        { status: 400 }
      )
    }

    const activities = await prisma.investorActivity.findMany({
      where: { investorId },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        investor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ activities })
  } catch (error: any) {
    console.error("Error fetching activities:", error)
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    )
  }
}
