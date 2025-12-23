import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateVendorSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  address: z.string().optional(),
  source: z.string().optional(),
  facebookAdId: z.string().optional(),
  campaignId: z.string().optional(),
  askingPrice: z.number().positive().optional(),
  propertyAddress: z.string().optional(),
  reasonForSale: z.string().optional(),
  status: z.enum(["contacted", "validated", "offer_made", "offer_accepted", "offer_rejected", "negotiating", "locked_out", "withdrawn"]).optional(),
  solicitorName: z.string().optional(),
  solicitorEmail: z.string().email().optional().or(z.literal("")),
  solicitorPhone: z.string().optional(),
  notes: z.string().optional(),
  dealId: z.string().uuid().nullable().optional(),
})

// GET /api/vendors/[id] - Get a single vendor
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

    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
      include: {
        deal: {
          select: {
            id: true,
            address: true,
            askingPrice: true,
            status: true,
            createdAt: true,
          },
        },
        offers: {
          orderBy: { offerDate: "desc" },
          include: {
            createdBy: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        aiConversations: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    return NextResponse.json(vendor)
  } catch (error) {
    console.error("Error fetching vendor:", error)
    return NextResponse.json(
      { error: "Failed to fetch vendor" },
      { status: 500 }
    )
  }
}

// PUT /api/vendors/[id] - Update a vendor
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
    const validatedData = updateVendorSchema.parse(body)

    const existingVendor = await prisma.vendor.findUnique({
      where: { id: params.id },
    })

    if (!existingVendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    // If updating dealId, check if the new deal already has a vendor
    if (validatedData.dealId !== undefined && validatedData.dealId !== existingVendor.dealId) {
      if (validatedData.dealId) {
        const existingDealVendor = await prisma.vendor.findUnique({
          where: { dealId: validatedData.dealId },
        })

        if (existingDealVendor && existingDealVendor.id !== params.id) {
          return NextResponse.json(
            { error: "This deal already has a vendor assigned" },
            { status: 400 }
          )
        }
      }
    }

    const updateData: any = {
      firstName: validatedData.firstName,
      lastName: validatedData.lastName,
      email: validatedData.email || null,
      phone: validatedData.phone,
      address: validatedData.address,
      source: validatedData.source,
      facebookAdId: validatedData.facebookAdId,
      campaignId: validatedData.campaignId,
      askingPrice: validatedData.askingPrice !== undefined ? (validatedData.askingPrice || null) : undefined,
      propertyAddress: validatedData.propertyAddress,
      reasonForSale: validatedData.reasonForSale,
      status: validatedData.status,
      solicitorName: validatedData.solicitorName,
      solicitorEmail: validatedData.solicitorEmail || null,
      solicitorPhone: validatedData.solicitorPhone,
      notes: validatedData.notes,
      dealId: validatedData.dealId !== undefined ? validatedData.dealId : undefined,
    }

    // Handle status transitions
    if (validatedData.status === "validated" && !existingVendor.qualifiedAt) {
      updateData.qualifiedAt = new Date()
    }
    if (validatedData.status === "locked_out" && !existingVendor.lockedOutAt) {
      updateData.lockedOutAt = new Date()
    }

    const vendor = await prisma.vendor.update({
      where: { id: params.id },
      data: updateData,
      include: {
        deal: {
          select: {
            id: true,
            address: true,
            askingPrice: true,
            status: true,
          },
        },
        _count: {
          select: {
            offers: true,
            aiConversations: true,
          },
        },
      },
    })

    return NextResponse.json(vendor)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating vendor:", error)
    return NextResponse.json(
      { error: "Failed to update vendor" },
      { status: 500 }
    )
  }
}

// DELETE /api/vendors/[id] - Delete a vendor
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

    await prisma.vendor.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Vendor deleted successfully" })
  } catch (error) {
    console.error("Error deleting vendor:", error)
    return NextResponse.json(
      { error: "Failed to delete vendor" },
      { status: 500 }
    )
  }
}

