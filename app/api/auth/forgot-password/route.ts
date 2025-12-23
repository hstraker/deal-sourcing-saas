import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPasswordResetEmail } from "@/lib/email"
import { z } from "zod"
import crypto from "crypto"

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
})

// POST /api/auth/forgot-password - Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = forgotPasswordSchema.parse(body)

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    })

    // Don't reveal if user exists for security reasons
    // Always return success message
    if (!user) {
      return NextResponse.json(
        { message: "If that email exists, a password reset link has been sent." },
        { status: 200 }
      )
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    // Save reset token to database
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordTokenExpires: resetTokenExpires,
      },
    })

    // Send password reset email
    try {
      await sendPasswordResetEmail(user.email, resetToken)
    } catch (emailError) {
      console.error("Error sending password reset email:", emailError)
      // Still return success to avoid revealing errors
    }

    return NextResponse.json(
      { message: "If that email exists, a password reset link has been sent." },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error in forgot password:", error)
    return NextResponse.json(
      { error: "An error occurred. Please try again later." },
      { status: 500 }
    )
  }
}

