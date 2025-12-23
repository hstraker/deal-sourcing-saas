import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/analytics/workflow - Get workflow analytics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Vendor Pipeline Analytics
    const vendorsByStage = await prisma.vendor.groupBy({
      by: ["status"],
      _count: {
        id: true,
      },
    })

    // Calculate time in each stage
    const vendorsWithStageTime = await prisma.vendor.findMany({
      where: {
        status: {
          not: "contacted",
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        qualifiedAt: true,
        lockedOutAt: true,
      },
    })

    // Calculate average time in stages
    const stageTimes: Record<string, number[]> = {}
    vendorsWithStageTime.forEach((vendor) => {
      const now = new Date()
      const created = new Date(vendor.createdAt)
      
      if (vendor.status === "validated" && vendor.qualifiedAt) {
        const timeInContacted = (new Date(vendor.qualifiedAt).getTime() - created.getTime()) / (1000 * 60 * 60 * 24) // days
        if (!stageTimes["contacted"]) stageTimes["contacted"] = []
        stageTimes["contacted"].push(timeInContacted)
      }
      
      if (["offer_made", "negotiating", "offer_accepted"].includes(vendor.status) && vendor.qualifiedAt) {
        const timeInValidated = vendor.qualifiedAt ? (now.getTime() - new Date(vendor.qualifiedAt).getTime()) / (1000 * 60 * 60 * 24) : 0
        if (!stageTimes["validated"]) stageTimes["validated"] = []
        stageTimes["validated"].push(timeInValidated)
      }
    })

    const avgStageTimes: Record<string, number> = {}
    Object.keys(stageTimes).forEach((stage) => {
      const times = stageTimes[stage]
      avgStageTimes[stage] = times.length > 0
        ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
        : 0
    })

    // Conversion Rates
    const totalContacted = await prisma.vendor.count({
      where: { status: "contacted" },
    })
    const totalValidated = await prisma.vendor.count({
      where: { status: "validated" },
    })
    const totalOffersMade = await prisma.vendor.count({
      where: { status: { in: ["offer_made", "negotiating"] } },
    })
    const totalAccepted = await prisma.vendor.count({
      where: { status: "offer_accepted" },
    })
    const totalLockedOut = await prisma.vendor.count({
      where: { status: "locked_out" },
    })

    const conversionRates = {
      contactedToValidated: totalContacted > 0 ? (totalValidated / totalContacted) * 100 : 0,
      validatedToOffer: totalValidated > 0 ? (totalOffersMade / totalValidated) * 100 : 0,
      offerToAccepted: totalOffersMade > 0 ? (totalAccepted / totalOffersMade) * 100 : 0,
      acceptedToLockedOut: totalAccepted > 0 ? (totalLockedOut / totalAccepted) * 100 : 0,
      overallContactedToLockedOut: totalContacted > 0 ? (totalLockedOut / totalContacted) * 100 : 0,
    }

    // Offer Statistics
    const allOffers = await prisma.vendorOffer.findMany({
      include: {
        vendor: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    const offersByDeal = await prisma.vendorOffer.groupBy({
      by: ["dealId"],
      _count: {
        id: true,
      },
      where: {
        dealId: {
          not: null,
        },
      },
    })

    const avgOffersPerDeal = offersByDeal.length > 0
      ? offersByDeal.reduce((sum, group) => sum + group._count.id, 0) / offersByDeal.length
      : 0

    // Negotiation Time (time from first offer to acceptance)
    const acceptedOffers = await prisma.vendorOffer.findMany({
      where: {
        vendorDecision: "accepted",
        vendorDecisionDate: {
          not: null,
        },
      },
      include: {
        vendor: {
          select: {
            id: true,
            offers: {
              orderBy: {
                offerDate: "asc",
              },
              take: 1,
            },
          },
        },
      },
    })

    const negotiationTimes: number[] = []
    acceptedOffers.forEach((offer) => {
      if (offer.vendor.offers.length > 0 && offer.vendorDecisionDate) {
        const firstOfferDate = new Date(offer.vendor.offers[0].offerDate)
        const acceptedDate = new Date(offer.vendorDecisionDate)
        const days = (acceptedDate.getTime() - firstOfferDate.getTime()) / (1000 * 60 * 60 * 24)
        negotiationTimes.push(days)
      }
    })

    const avgNegotiationTime = negotiationTimes.length > 0
      ? Math.round((negotiationTimes.reduce((a, b) => a + b, 0) / negotiationTimes.length) * 10) / 10
      : 0

    // Investor Reservation Conversion
    const totalReservations = await prisma.investorReservation.count()
    const reservationsWithProof = await prisma.investorReservation.count({
      where: { proofOfFundsVerified: true },
    })
    const reservationsLockedOut = await prisma.investorReservation.count({
      where: { status: "locked_out" },
    })
    const reservationsCompleted = await prisma.investorReservation.count({
      where: { status: "completed" },
    })

    const reservationConversionRates = {
      reservationToProof: totalReservations > 0 ? (reservationsWithProof / totalReservations) * 100 : 0,
      proofToLockedOut: reservationsWithProof > 0 ? (reservationsLockedOut / reservationsWithProof) * 100 : 0,
      lockedOutToCompleted: reservationsLockedOut > 0 ? (reservationsCompleted / reservationsLockedOut) * 100 : 0,
      overallReservationToCompleted: totalReservations > 0 ? (reservationsCompleted / totalReservations) * 100 : 0,
    }

    return NextResponse.json({
      vendorPipeline: {
        byStage: vendorsByStage.map((stage) => ({
          stage: stage.status,
          count: stage._count.id,
        })),
        conversionRates,
        avgStageTimes,
        avgOffersPerDeal: Math.round(avgOffersPerDeal * 10) / 10,
        avgNegotiationTime,
        totalVendors: await prisma.vendor.count(),
        totalOffers: allOffers.length,
      },
      investorPipeline: {
        conversionRates: reservationConversionRates,
        totalReservations,
        reservationsWithProof,
        reservationsLockedOut,
        reservationsCompleted,
      },
    })
  } catch (error) {
    console.error("Error fetching workflow analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow analytics" },
      { status: 500 }
    )
  }
}

