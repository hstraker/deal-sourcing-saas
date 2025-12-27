import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"

// GET /api/investors - Get all investors
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const investors = await prisma.investor.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            reservations: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json({ investors })
  } catch (error) {
    console.error("Error fetching investors:", error)
    return NextResponse.json(
      { error: "Failed to fetch investors" },
      { status: 500 }
    )
  }
}

// POST /api/investors - Create a new investor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { userId, minBudget, maxBudget, preferredAreas, strategy, experienceLevel, financingStatus, emailAlerts, smsAlerts } = body

    // Verify user exists and is an investor
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { investor: true },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (user.role !== "investor") {
      return NextResponse.json({ error: "User must have investor role" }, { status: 400 })
    }

    if (user.investor) {
      return NextResponse.json({ error: "Investor profile already exists for this user" }, { status: 400 })
    }

    // Create investor profile
    const investor = await prisma.investor.create({
      data: {
        userId,
        minBudget: (minBudget ? new Decimal(minBudget) : null) as any,
        maxBudget: (maxBudget ? new Decimal(maxBudget) : null) as any,
        preferredAreas: preferredAreas || [],
        strategy: strategy || [],
        experienceLevel: experienceLevel || null,
        financingStatus: financingStatus || null,
        emailAlerts: emailAlerts !== undefined ? emailAlerts : true,
        smsAlerts: smsAlerts !== undefined ? smsAlerts : false,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
            isActive: true,
          },
        },
        _count: {
          select: {
            reservations: true,
          },
        },
      },
    })

    return NextResponse.json(investor, { status: 201 })
  } catch (error) {
    console.error("Error creating investor:", error)
    return NextResponse.json(
      { error: "Failed to create investor" },
      { status: 500 }
    )
  }
}

