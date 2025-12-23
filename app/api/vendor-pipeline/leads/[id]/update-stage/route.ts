/**
 * Update Pipeline Stage API
 * PATCH /api/vendor-pipeline/leads/[id]/update-stage
 * Updates the pipeline stage of a vendor lead (for drag-and-drop)
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PipelineStage } from "@prisma/client"
import { z } from "zod"

const updateStageSchema = z.object({
  pipelineStage: z.string(),
})

// PATCH /api/vendor-pipeline/leads/[id]/update-stage
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
    const { pipelineStage } = updateStageSchema.parse(body)

    // Get current lead to check stage transitions
    const currentLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!currentLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // If pipeline stage is changing, log event
    if (pipelineStage !== currentLead.pipelineStage) {
      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "stage_transition",
          details: {
            fromStage: currentLead.pipelineStage,
            toStage: pipelineStage,
            changedBy: session.user.id,
            changedAt: new Date().toISOString(),
          },
        },
      })
    }

    // Update the lead
    const lead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        pipelineStage: pipelineStage as PipelineStage,
      },
    })

    return NextResponse.json({ lead })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating pipeline stage:", error)
    return NextResponse.json(
      { error: "Failed to update pipeline stage" },
      { status: 500 }
    )
  }
}

