import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH /api/investors/[id]/pipeline - Update investor pipeline stage
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { pipelineStage, assignedToId } = body

    if (!pipelineStage) {
      return NextResponse.json(
        { error: "pipelineStage is required" },
        { status: 400 }
      )
    }

    const investor = await prisma.investor.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    const updateData: any = {
      pipelineStage,
      lastActivityAt: new Date(),
    }

    if (assignedToId !== undefined) {
      updateData.assignedToId = assignedToId
    }

    // Update investor
    const updatedInvestor = await prisma.investor.update({
      where: { id: params.id },
      data: updateData,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    // Log activity
    await prisma.investorActivity.create({
      data: {
        investorId: params.id,
        activityType: "PROFILE_UPDATED",
        description: `Pipeline stage updated to ${pipelineStage}`,
        triggeredById: session.user.id,
        metadata: {
          previousStage: investor.pipelineStage,
          newStage: pipelineStage,
        },
      },
    })

    return NextResponse.json({ investor: updatedInvestor })
  } catch (error: any) {
    console.error("Error updating pipeline stage:", error)
    return NextResponse.json(
      { error: "Failed to update pipeline stage" },
      { status: 500 }
    )
  }
}
