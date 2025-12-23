import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateInvestorSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().email().optional(),
  minBudget: z.number().positive().optional().nullable(),
  maxBudget: z.number().positive().optional().nullable(),
  preferredAreas: z.array(z.string()).optional(),
  strategy: z.array(z.string()).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  financingStatus: z.enum(["cash", "mortgage", "both"]).optional().nullable(),
  emailAlerts: z.boolean().optional(),
  smsAlerts: z.boolean().optional(),
})

// GET /api/investors/[id] - Get a single investor
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const investor = await prisma.investor.findUnique({
      where: { id: params.id },
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
            purchases: true,
            favorites: true,
          },
        },
      },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    return NextResponse.json(investor)
  } catch (error) {
    console.error("Error fetching investor:", error)
    return NextResponse.json(
      { error: "Failed to fetch investor" },
      { status: 500 }
    )
  }
}

// PUT /api/investors/[id] - Update an investor
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateInvestorSchema.parse(body)

    const investor = await prisma.investor.findUnique({
      where: { id: params.id },
      include: { user: true },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    // Update user data if provided
    if (validatedData.firstName !== undefined || validatedData.lastName !== undefined || validatedData.phone !== undefined || validatedData.email !== undefined) {
      await prisma.user.update({
        where: { id: investor.userId },
        data: {
          ...(validatedData.firstName !== undefined && { firstName: validatedData.firstName || null }),
          ...(validatedData.lastName !== undefined && { lastName: validatedData.lastName || null }),
          ...(validatedData.phone !== undefined && { phone: validatedData.phone || null }),
          ...(validatedData.email !== undefined && { email: validatedData.email }),
        },
      })
    }

    // Update investor data
    const updatedInvestor = await prisma.investor.update({
      where: { id: params.id },
      data: {
        ...(validatedData.minBudget !== undefined && { minBudget: validatedData.minBudget }),
        ...(validatedData.maxBudget !== undefined && { maxBudget: validatedData.maxBudget }),
        ...(validatedData.preferredAreas !== undefined && { preferredAreas: validatedData.preferredAreas }),
        ...(validatedData.strategy !== undefined && { strategy: validatedData.strategy }),
        ...(validatedData.experienceLevel !== undefined && { experienceLevel: validatedData.experienceLevel }),
        ...(validatedData.financingStatus !== undefined && { financingStatus: validatedData.financingStatus }),
        ...(validatedData.emailAlerts !== undefined && { emailAlerts: validatedData.emailAlerts }),
        ...(validatedData.smsAlerts !== undefined && { smsAlerts: validatedData.smsAlerts }),
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
            purchases: true,
            favorites: true,
          },
        },
      },
    })

    return NextResponse.json(updatedInvestor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating investor:", error)
    return NextResponse.json(
      { error: "Failed to update investor" },
      { status: 500 }
    )
  }
}

// DELETE /api/investors/[id] - Delete an investor
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const investor = await prisma.investor.findUnique({
      where: { id: params.id },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    // Delete investor (this will cascade delete the user due to onDelete: Cascade)
    await prisma.investor.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Investor deleted successfully" })
  } catch (error) {
    console.error("Error deleting investor:", error)
    return NextResponse.json(
      { error: "Failed to delete investor" },
      { status: 500 }
    )
  }
}

