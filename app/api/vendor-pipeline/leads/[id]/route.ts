/**
 * Vendor Pipeline Lead Detail API Routes
 * GET /api/vendor-pipeline/leads/[id] - Get lead details
 * PATCH /api/vendor-pipeline/leads/[id] - Update lead
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PipelineStage } from "@prisma/client"

// GET /api/vendor-pipeline/leads/[id]
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

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      include: {
        smsMessages: {
          orderBy: { createdAt: "asc" },
        },
        pipelineEvents: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        offerRetries: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    return NextResponse.json({ lead })
  } catch (error: any) {
    console.error("Error fetching vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to fetch vendor lead" },
      { status: 500 }
    )
  }
}

// PATCH /api/vendor-pipeline/leads/[id]
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

    // Get current lead to check stage transitions
    const currentLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!currentLead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // If pipeline stage is changing, log event
    if (body.pipelineStage && body.pipelineStage !== currentLead.pipelineStage) {
      await prisma.pipelineEvent.create({
        data: {
          vendorLeadId: params.id,
          eventType: "stage_transition",
          details: {
            fromStage: currentLead.pipelineStage,
            toStage: body.pipelineStage,
            changedBy: session.user.id,
          },
        },
      })
    }

    const lead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: body,
    })

    return NextResponse.json({ lead })
  } catch (error: any) {
    console.error("Error updating vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to update vendor lead" },
      { status: 500 }
    )
  }
}

