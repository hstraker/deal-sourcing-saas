/**
 * API Route: /api/vendor-leads/[id]
 * CRUD operations for individual vendor leads
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateVendorLeadSchema = z.object({
  vendorName: z.string().optional(),
  vendorPhone: z.string().optional(),
  vendorEmail: z.string().email().optional().nullable(),
  vendorAddress: z.string().optional().nullable(),
  propertyAddress: z.string().optional().nullable(),
  propertyPostcode: z.string().optional().nullable(),
  askingPrice: z.number().positive().optional().nullable(),
  propertyType: z.string().optional().nullable(),
  bedrooms: z.number().int().positive().optional().nullable(),
  bathrooms: z.number().int().positive().optional().nullable(),
  condition: z.enum(["excellent", "good", "needs_work", "needs_modernisation", "poor"]).optional().nullable(),
  pipelineStage: z.string().optional(),
  motivationScore: z.number().int().min(1).max(10).optional().nullable(),
  urgencyLevel: z.enum(["urgent", "quick", "moderate", "flexible"]).optional().nullable(),
  reasonForSelling: z.enum(["relocation", "financial", "divorce", "inheritance", "downsize", "other"]).optional().nullable(),
  timelineDays: z.number().int().positive().optional().nullable(),
  competingOffers: z.boolean().optional(),
  estimatedMarketValue: z.number().positive().optional().nullable(),
  estimatedRefurbCost: z.number().positive().optional().nullable(),
  solicitorName: z.string().optional().nullable(),
  solicitorFirm: z.string().optional().nullable(),
  solicitorPhone: z.string().optional().nullable(),
  solicitorEmail: z.string().email().optional().nullable(),
})

// GET /api/vendor-leads/[id] - Get a single vendor lead
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

    const vendorLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      include: {
        smsMessages: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        pipelineEvents: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            smsMessages: true,
            pipelineEvents: true,
          },
        },
      },
    })

    if (!vendorLead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    return NextResponse.json(vendorLead)
  } catch (error) {
    console.error("Error fetching vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to fetch vendor lead" },
      { status: 500 }
    )
  }
}

// PATCH /api/vendor-leads/[id] - Update a vendor lead
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
    const validatedData = updateVendorLeadSchema.parse(body)

    // Check if vendor lead exists
    const existingLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    // Update the vendor lead
    const updatedLead = await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        ...validatedData,
        updatedAt: new Date(),
      } as any,
    })

    return NextResponse.json(updatedLead)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to update vendor lead" },
      { status: 500 }
    )
  }
}

// DELETE /api/vendor-leads/[id] - Delete a vendor lead
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
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Check if vendor lead exists
    const existingLead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!existingLead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    // Delete the vendor lead (cascade will delete related records)
    await prisma.vendorLead.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true, message: "Vendor lead deleted" })
  } catch (error) {
    console.error("Error deleting vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to delete vendor lead" },
      { status: 500 }
    )
  }
}
