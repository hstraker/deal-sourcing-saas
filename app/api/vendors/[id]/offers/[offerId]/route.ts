import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const updateOfferSchema = z.object({
  status: z.enum(["pending", "more_info_sent", "accepted", "rejected", "counter_offered", "expired", "withdrawn"]).optional(),
  vendorDecision: z.enum(["accepted", "rejected", "more_info_requested", "counter_offer"]).optional(),
  vendorNotes: z.string().optional(),
  moreInfoRequested: z.boolean().optional(),
  videoSent: z.boolean().optional(),
  counterOfferAmount: z.number().positive().optional(),
})

// PUT /api/vendors/[id]/offers/[offerId] - Update an offer
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string; offerId: string } }
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
    const validatedData = updateOfferSchema.parse(body)

    const existingOffer = await prisma.vendorOffer.findUnique({
      where: { id: params.offerId },
      include: { vendor: true },
    })

    if (!existingOffer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    if (existingOffer.vendorId !== params.id) {
      return NextResponse.json({ error: "Offer does not belong to this vendor" }, { status: 400 })
    }

    const updateData: any = {
      status: validatedData.status,
      vendorDecision: validatedData.vendorDecision,
      vendorNotes: validatedData.vendorNotes,
      moreInfoRequested: validatedData.moreInfoRequested,
      videoSent: validatedData.videoSent,
      counterOfferAmount: validatedData.counterOfferAmount,
    }

    // If vendor decision is provided, set the decision date
    if (validatedData.vendorDecision && !existingOffer.vendorDecisionDate) {
      updateData.vendorDecisionDate = new Date()
    }

    // If offer is accepted, update vendor and deal status
    if (validatedData.status === "accepted" || validatedData.vendorDecision === "accepted") {
      await prisma.vendor.update({
        where: { id: params.id },
        data: { status: "offer_accepted" },
      })

      if (existingOffer.dealId) {
        await prisma.deal.update({
          where: { id: existingOffer.dealId },
          data: { offerAcceptedAt: new Date() },
        })
      }
    }

    const offer = await prisma.vendorOffer.update({
      where: { id: params.offerId },
      data: updateData,
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

    return NextResponse.json(offer)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error updating offer:", error)
    return NextResponse.json(
      { error: "Failed to update offer" },
      { status: 500 }
    )
  }
}

// DELETE /api/vendors/[id]/offers/[offerId] - Delete an offer
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string; offerId: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const offer = await prisma.vendorOffer.findUnique({
      where: { id: params.offerId },
    })

    if (!offer) {
      return NextResponse.json({ error: "Offer not found" }, { status: 404 })
    }

    await prisma.vendorOffer.delete({
      where: { id: params.offerId },
    })

    // Update deal offer count
    if (offer.dealId) {
      const offerCount = await prisma.vendorOffer.count({
        where: { dealId: offer.dealId },
      })

      await prisma.deal.update({
        where: { id: offer.dealId },
        data: { offerCount },
      })
    }

    return NextResponse.json({ message: "Offer deleted successfully" })
  } catch (error) {
    console.error("Error deleting offer:", error)
    return NextResponse.json(
      { error: "Failed to delete offer" },
      { status: 500 }
    )
  }
}

