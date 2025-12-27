/**
 * Vendor Pipeline Stats API
 * GET /api/vendor-pipeline/stats
 * Returns pipeline statistics and metrics
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PipelineStage } from "@prisma/client"

// GET /api/vendor-pipeline/stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get counts by stage
    const stages = Object.values(PipelineStage)
    const byStage: Record<PipelineStage, number> = {} as any

    for (const stage of stages) {
      byStage[stage] = await prisma.vendorLead.count({
        where: { pipelineStage: stage },
      })
    }

    // Calculate conversion rates
    const totalLeads = await prisma.vendorLead.count()
    const leadsWithOffers = await prisma.vendorLead.count({
      where: {
        pipelineStage: {
          in: [
            "OFFER_MADE",
            "OFFER_ACCEPTED",
            "OFFER_REJECTED",
            "VIDEO_SENT",
            "RETRY_1",
            "RETRY_2",
            "RETRY_3",
          ] as PipelineStage[],
        },
      },
    })
    const leadsAccepted = await prisma.vendorLead.count({
      where: { pipelineStage: "OFFER_ACCEPTED" as PipelineStage },
    })

    const leadToOfferRate =
      totalLeads > 0 ? (leadsWithOffers / totalLeads) * 100 : 0
    const offerToAcceptanceRate =
      leadsWithOffers > 0 ? (leadsAccepted / leadsWithOffers) * 100 : 0
    const overallConversionRate =
      totalLeads > 0 ? (leadsAccepted / totalLeads) * 100 : 0

    // Calculate average times
    const conversations = await prisma.vendorLead.findMany({
      where: {
        pipelineStage: "DEAL_VALIDATION" as PipelineStage,
        conversationStartedAt: { not: null },
      },
      select: {
        conversationStartedAt: true,
        updatedAt: true,
      },
    })

    const avgConversationDuration =
      conversations.length > 0
        ? conversations.reduce((sum, c) => {
            if (c.conversationStartedAt) {
              const duration =
                (new Date(c.updatedAt).getTime() -
                  new Date(c.conversationStartedAt).getTime()) /
                (1000 * 60 * 60) // Convert to hours
              return sum + duration
            }
            return sum
          }, 0) / conversations.length
        : 0

    // Calculate average time from conversation start to offer sent
    const leadsWithOfferTiming = await prisma.vendorLead.findMany({
      where: {
        offerSentAt: { not: null },
        conversationStartedAt: { not: null },
      },
      select: {
        conversationStartedAt: true,
        offerSentAt: true,
      },
    })

    const avgTimeToOffer =
      leadsWithOfferTiming.length > 0
        ? leadsWithOfferTiming.reduce((sum, lead) => {
            if (lead.conversationStartedAt && lead.offerSentAt) {
              const duration =
                (new Date(lead.offerSentAt).getTime() -
                  new Date(lead.conversationStartedAt).getTime()) /
                (1000 * 60 * 60) // Convert to hours
              return sum + duration
            }
            return sum
          }, 0) / leadsWithOfferTiming.length
        : 0

    // Calculate average time from offer accepted to deal closed
    const leadsWithCloseTiming = await prisma.vendorLead.findMany({
      where: {
        offerAcceptedAt: { not: null },
      },
      select: {
        offerAcceptedAt: true,
        dealClosedAt: true,
      },
    })

    const avgTimeToClose =
      leadsWithCloseTiming.length > 0
        ? leadsWithCloseTiming.reduce((sum, lead) => {
            if (lead.offerAcceptedAt) {
              // If dealClosedAt exists, use it; otherwise use current time
              const closeTime = lead.dealClosedAt
                ? new Date(lead.dealClosedAt).getTime()
                : Date.now()
              const duration =
                (closeTime - new Date(lead.offerAcceptedAt).getTime()) /
                (1000 * 60 * 60 * 24) // Convert to days
              return sum + duration
            }
            return sum
          }, 0) / leadsWithCloseTiming.length
        : 0

    // Financial metrics
    const offers = await prisma.vendorLead.findMany({
      where: {
        offerAmount: { not: null },
      },
      select: {
        offerAmount: true,
        bmvScore: true,
        pipelineStage: true,
      },
    })

    const totalOffersMade = offers.reduce(
      (sum, o) => sum + Number(o.offerAmount || 0),
      0
    )
    const acceptedOffers = offers.filter(
      (o) => o.pipelineStage === "OFFER_ACCEPTED"
    )
    const totalAcceptedValue = acceptedOffers.reduce(
      (sum, o) => sum + Number(o.offerAmount || 0),
      0
    )
    const avgBmvPercentage =
      offers.length > 0
        ? offers.reduce((sum, o) => sum + Number(o.bmvScore || 0), 0) /
          offers.length
        : 0

    return NextResponse.json({
      stats: {
        totalLeads,
        byStage,
        conversionRates: {
          leadToOffer: Math.round(leadToOfferRate * 100) / 100,
          offerToAcceptance: Math.round(offerToAcceptanceRate * 100) / 100,
          overall: Math.round(overallConversionRate * 100) / 100,
        },
        avgTimes: {
          conversationDurationHours: Math.round(avgConversationDuration * 100) / 100,
          timeToOfferHours: Math.round(avgTimeToOffer * 100) / 100,
          timeToCloseDays: Math.round(avgTimeToClose * 100) / 100,
        },
        financial: {
          totalOffersMade: Math.round(totalOffersMade),
          totalAcceptedValue: Math.round(totalAcceptedValue),
          avgBmvPercentage: Math.round(avgBmvPercentage * 100) / 100,
        },
      },
    })
  } catch (error: any) {
    console.error("Error fetching pipeline stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch pipeline stats" },
      { status: 500 }
    )
  }
}

