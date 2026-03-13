import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import crypto from "crypto"
import { sendInviteEmail } from "@/lib/email"

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "sourcer"]),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  permissions: z.array(z.string()).optional(),
})

// GET /api/users - Get all staff users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const users = await prisma.user.findMany({
      where: {
        role: { in: ["admin", "sourcer"] },
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        profilePictureS3Key: true,
        createdAt: true,
        lastLogin: true,
        isActive: true,
        passwordHash: true, // used to determine pending status
        permissions: true,
        _count: {
          select: {
            dealsCreated: true,
            dealsAssigned: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }],
    })

    // Map: replace passwordHash with isPending flag (never send hash to client)
    const safeUsers = users.map(({ passwordHash, ...u }) => ({
      ...u,
      isPending: !passwordHash,
    }))

    return NextResponse.json(safeUsers)
  } catch (error) {
    console.error("Error fetching users:", error)
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 })
  }
}

// POST /api/users - Invite a new staff user (admin only)
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createUserSchema.parse(body)

    // Check for duplicate email
    const existing = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })
    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 400 }
      )
    }

    // Determine permissions — admins always get all sections
    const permissions =
      validatedData.role === "admin"
        ? ["invest", "manage", "finance", "admin"]
        : (validatedData.permissions ?? ["invest", "manage"])

    // Generate invite token (48h expiry)
    const inviteToken = crypto.randomBytes(32).toString("hex")
    const inviteExpires = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        role: validatedData.role as any,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        phone: validatedData.phone,
        isActive: false,
        permissions,
        resetPasswordToken: inviteToken,
        resetPasswordTokenExpires: inviteExpires,
      },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        createdAt: true,
        isActive: true,
        permissions: true,
      },
    })

    const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
    const inviteUrl = `${appUrl}/reset-password?token=${inviteToken}`

    const displayName =
      [validatedData.firstName, validatedData.lastName].filter(Boolean).join(" ") ||
      validatedData.email

    const emailResult = await sendInviteEmail(validatedData.email, displayName, inviteUrl)

    return NextResponse.json(
      {
        user: { ...user, isPending: true },
        inviteUrl,
        emailSent: emailResult.success,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("Error creating user:", error)
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 })
  }
}
