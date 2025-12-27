import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createVendorSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
  source: z.string().default("facebook_ad"),
  facebookAdId: z.string().optional(),
  campaignId: z.string().optional(),
  askingPrice: z.number().positive().optional(),
  propertyAddress: z.string().optional(),
  reasonForSale: z.string().optional(),
  notes: z.string().optional(),
  dealId: z.string().uuid().optional(),
})

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

// GET /api/vendors - Get all vendors
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const pipelineStage = searchParams.get("pipelineStage")

    const vendorLeads = await prisma.vendorLead.findMany({
      where: {
        ...(pipelineStage && { pipelineStage: pipelineStage as any }),
      },
      include: {
        smsMessages: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: {
            id: true,
            direction: true,
            messageBody: true,
            createdAt: true,
            aiGenerated: true,
          },
        },
        _count: {
          select: {
            smsMessages: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(vendorLeads)
  } catch (error) {
    console.error("Error fetching vendors:", error)
    return NextResponse.json(
      { error: "Failed to fetch vendors" },
      { status: 500 }
    )
  }
}

// POST /api/vendors - Create a new vendor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createVendorSchema.parse(body)

    // Check if vendor with phone already exists
    const existingVendor = await prisma.vendor.findFirst({
      where: { phone: validatedData.phone },
    })

    if (existingVendor) {
      return NextResponse.json(
        { error: "Vendor with this phone number already exists", vendor: existingVendor },
        { status: 400 }
      )
    }

    // If dealId is provided, check if deal already has a vendor
    if (validatedData.dealId) {
      const existingDealVendor = await prisma.vendor.findUnique({
        where: { dealId: validatedData.dealId },
      })

      if (existingDealVendor) {
        return NextResponse.json(
          { error: "This deal already has a vendor assigned" },
          { status: 400 }
        )
      }
    }

    const vendor = await prisma.vendor.create({
      data: {
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        email: validatedData.email || null,
        phone: validatedData.phone,
        address: validatedData.address,
        source: validatedData.source,
        facebookAdId: validatedData.facebookAdId,
        campaignId: validatedData.campaignId,
        askingPrice: validatedData.askingPrice ? validatedData.askingPrice : null,
        propertyAddress: validatedData.propertyAddress,
        reasonForSale: validatedData.reasonForSale,
        notes: validatedData.notes,
        dealId: validatedData.dealId || null,
      },
      include: {
        deal: {
          select: {
            id: true,
            address: true,
          },
        },
      },
    })

    return NextResponse.json(vendor, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating vendor:", error)
    return NextResponse.json(
      { error: "Failed to create vendor" },
      { status: 500 }
    )
  }
}

