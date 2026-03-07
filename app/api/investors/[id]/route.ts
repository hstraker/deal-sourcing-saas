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
    const userFieldsToUpdate: Record<string, any> = {}
    if (validatedData.firstName !== undefined) userFieldsToUpdate.firstName = validatedData.firstName || null
    if (validatedData.lastName  !== undefined) userFieldsToUpdate.lastName  = validatedData.lastName  || null
    if (validatedData.phone     !== undefined) userFieldsToUpdate.phone     = validatedData.phone     || null

    // Only update email if it has actually changed
    if (validatedData.email !== undefined && validatedData.email !== investor.user.email) {
      // Check no other user already owns this email
      const existing = await prisma.user.findUnique({
        where: { email: validatedData.email },
        select: { id: true, role: true },
      })
      if (existing) {
        const roleLabel =
          existing.role === "admin"   ? "an admin account" :
          existing.role === "sourcer" ? "a team member account" :
                                       "another investor account"
        return NextResponse.json(
          { error: `That email address is already in use by ${roleLabel}. Please use a different email.` },
          { status: 409 }
        )
      }
      userFieldsToUpdate.email = validatedData.email
    }

    if (Object.keys(userFieldsToUpdate).length > 0) {
      await prisma.user.update({
        where: { id: investor.userId },
        data: userFieldsToUpdate,
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
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    // Unique constraint on email (P2002) — surface a readable message
    if (error?.code === "P2002" && error?.meta?.target?.includes("email")) {
      return NextResponse.json(
        { error: "That email address is already in use. Please choose a different email." },
        { status: 409 }
      )
    }

    console.error("Error updating investor:", error)
    return NextResponse.json(
      { error: "Failed to update investor" },
      { status: 500 }
    )
  }
}

// PATCH /api/investors/[id] - Partial update (e.g. defaultSolicitorId)
export async function PATCH(
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

    // Allow only safe fields in a PATCH
    const allowedFields = ["defaultSolicitorId"]
    const data: Record<string, any> = {}
    for (const key of allowedFields) {
      if (key in body) data[key] = body[key]
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "No updatable fields provided" }, { status: 400 })
    }

    const investor = await prisma.investor.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json({ investor })
  } catch (error) {
    console.error("Error patching investor:", error)
    return NextResponse.json({ error: "Failed to update investor" }, { status: 500 })
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

