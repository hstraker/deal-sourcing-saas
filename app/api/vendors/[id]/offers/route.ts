import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const createOfferSchema = z.object({
  offerAmount: z.number().positive("Offer amount must be positive"),
  dealId: z.string().uuid().optional(),
  vendorNotes: z.string().optional(),
})

const updateOfferSchema = z.object({
  status: z.enum(["pending", "more_info_sent", "accepted", "rejected", "counter_offered", "expired", "withdrawn"]).optional(),
  vendorDecision: z.enum(["accepted", "rejected", "more_info_requested", "counter_offer"]).optional(),
  vendorNotes: z.string().optional(),
  moreInfoRequested: z.boolean().optional(),
  videoSent: z.boolean().optional(),
  counterOfferAmount: z.number().positive().optional(),
})

// GET /api/vendors/[id]/offers - Get all offers for a vendor
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

    const offers = await prisma.vendorOffer.findMany({
      where: { vendorId: params.id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        deal: {
          select: {
            id: true,
            address: true,
          },
        },
      },
      orderBy: { offerDate: "desc" },
    })

    return NextResponse.json(offers)
  } catch (error) {
    console.error("Error fetching offers:", error)
    return NextResponse.json(
      { error: "Failed to fetch offers" },
      { status: 500 }
    )
  }
}

// POST /api/vendors/[id]/offers - Create a new offer
export async function POST(
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
    const validatedData = createOfferSchema.parse(body)

    // Verify vendor exists
    const vendor = await prisma.vendor.findUnique({
      where: { id: params.id },
    })

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 })
    }

    // Create offer
    const offer = await prisma.vendorOffer.create({
      data: {
        vendorId: params.id,
        dealId: validatedData.dealId || vendor.dealId || null,
        offerAmount: validatedData.offerAmount,
        vendorNotes: validatedData.vendorNotes,
        createdById: session.user.id,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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

    // Update vendor status to "offer_made" if not already
    if (vendor.status !== "offer_made" && vendor.status !== "offer_accepted") {
      await prisma.vendor.update({
        where: { id: params.id },
        data: { status: "offer_made" },
      })
    }

    // Update deal offer count and latest offer info
    if (offer.dealId) {
      const offerCount = await prisma.vendorOffer.count({
        where: { dealId: offer.dealId },
      })

      await prisma.deal.update({
        where: { id: offer.dealId },
        data: {
          offerCount,
          latestOfferAmount: validatedData.offerAmount,
          latestOfferDate: new Date(),
        },
      })
    }

    return NextResponse.json(offer, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating offer:", error)
    return NextResponse.json(
      { error: "Failed to create offer" },
      { status: 500 }
    )
  }
}

