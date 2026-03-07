import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Decimal } from "@prisma/client/runtime/library"
import bcrypt from "bcryptjs"

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
        // Include ALL active reservations so InvestorList can show each deal's workflow status
        reservations: {
          where: { status: { notIn: ["cancelled", "completed"] } },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            dealId: true,
            deal: { select: { address: true } },
          },
        },
        defaultSolicitor: {
          select: {
            id: true,
            fullName: true,
            company: true,
            sraNumber: true,
            email: true,
            phone: true,
            practiceAreas: true,
            sraVerified: true,
            sraVerifiedAt: true,
            sraStatus: true,
            sraDisplayName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Map Contact fields → legacy Solicitor shape for backwards compatibility with investor-list UI
    const mapped = investors.map((inv) => ({
      ...inv,
      defaultSolicitor: inv.defaultSolicitor
        ? {
            id: inv.defaultSolicitor.id,
            name: inv.defaultSolicitor.fullName,
            firmName: inv.defaultSolicitor.company ?? "",
            sraNumber: inv.defaultSolicitor.sraNumber,
            email: inv.defaultSolicitor.email,
            phone: inv.defaultSolicitor.phone,
            specialisation: inv.defaultSolicitor.practiceAreas.join(", ") || null,
            website: null,
            address: null,
            notes: null,
            sraVerified: inv.defaultSolicitor.sraVerified,
            sraVerifiedAt: inv.defaultSolicitor.sraVerifiedAt,
            sraStatus: inv.defaultSolicitor.sraStatus,
            sraDisplayName: inv.defaultSolicitor.sraDisplayName,
          }
        : null,
    }))

    return NextResponse.json({ investors: mapped })
  } catch (error) {
    console.error("Error fetching investors:", error)
    return NextResponse.json(
      { error: "Failed to fetch investors" },
      { status: 500 }
    )
  }
}

// POST /api/investors - Create a new investor
// Accepts either { userId } (legacy) or { email, firstName, lastName, phone, ...investorFields }
// If the email already belongs to an existing user (e.g. admin), that user's account is reused
// and an investor profile is created for them without changing their role.
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
    const { userId: providedUserId, email, firstName, lastName, phone,
            minBudget, maxBudget, preferredAreas, strategy,
            experienceLevel, financingStatus, emailAlerts, smsAlerts } = body

    let resolvedUserId: string

    if (providedUserId) {
      // Legacy path: caller already has a userId
      const user = await prisma.user.findUnique({
        where: { id: providedUserId },
        include: { investor: true },
      })
      if (!user) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }
      if (user.investor) {
        return NextResponse.json({ error: "This user already has an investor profile" }, { status: 409 })
      }
      resolvedUserId = providedUserId
    } else {
      // Email-based path: find existing user or create a new one
      if (!email) {
        return NextResponse.json({ error: "email is required" }, { status: 400 })
      }

      const existingUser = await prisma.user.findUnique({
        where: { email },
        include: { investor: true },
      })

      if (existingUser) {
        // User account already exists (could be admin, sourcer, or investor)
        if (existingUser.investor) {
          return NextResponse.json(
            { error: "An investor profile already exists for this email address" },
            { status: 409 }
          )
        }
        // Reuse the existing account — no role change needed
        resolvedUserId = existingUser.id
      } else {
        // Create a brand-new user account with investor role
        const passwordHash = await bcrypt.hash("TempPassword123!", 10)
        const newUser = await prisma.user.create({
          data: {
            email,
            firstName: firstName || null,
            lastName: lastName || null,
            phone: phone || null,
            role: "investor",
            passwordHash,
            isActive: true,
          },
        })
        resolvedUserId = newUser.id
      }
    }

    // Create the investor profile
    const investor = await prisma.investor.create({
      data: {
        userId: resolvedUserId,
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

