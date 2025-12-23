import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const uploadProofOfFundsSchema = z.object({
  documentS3Key: z.string().min(1, "Document S3 key is required"),
})

// POST /api/reservations/[id]/proof-of-funds - Upload proof of funds document
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = uploadProofOfFundsSchema.parse(body)

    const reservation = await prisma.investorReservation.findUnique({
      where: { id: params.id },
    })

    if (!reservation) {
      return NextResponse.json({ error: "Reservation not found" }, { status: 404 })
    }

    // Update reservation with proof of funds document
    const updated = await prisma.investorReservation.update({
      where: { id: params.id },
      data: {
        proofOfFundsProvided: true,
        proofOfFundsDocumentS3Key: validatedData.documentS3Key,
      },
      include: {
        investor: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
          },
        },
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error uploading proof of funds:", error)
    return NextResponse.json(
      { error: "Failed to upload proof of funds" },
      { status: 500 }
    )
  }
}

