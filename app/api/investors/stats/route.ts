import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// GET /api/investors/stats - Get investor statistics
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Total investors
    const totalInvestors = await prisma.investor.count()

    // Investors by pipeline stage
    const byStage = await prisma.investor.groupBy({
      by: ["pipelineStage"],
      _count: true,
    })

    const stageStats = byStage.reduce((acc, item) => {
      acc[item.pipelineStage] = item._count
      return acc
    }, {} as Record<string, number>)

    // Active investors (activity in last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const activeInvestors = await prisma.investor.count({
      where: {
        lastActivityAt: {
          gte: thirtyDaysAgo,
        },
      },
    })

    // Total reservations
    const totalReservations = await prisma.investorReservation.count()

    // Active reservations
    const activeReservations = await prisma.investorReservation.count({
      where: {
        status: {
          in: ["pending", "fee_pending", "proof_of_funds_pending", "verified", "locked_out"],
        },
      },
    })

    // Total purchases
    const totalPurchases = await prisma.investor.aggregate({
      _sum: {
        dealsPurchased: true,
      },
    })

    // Total spent
    const totalRevenue = await prisma.investor.aggregate({
      _sum: {
        totalSpent: true,
      },
    })

    // Pack deliveries stats
    const totalPacksSent = await prisma.investorPackDelivery.count()
    const packsViewed = await prisma.investorPackDelivery.count({
      where: {
        viewedAt: { not: null },
      },
    })
    const packsDownloaded = await prisma.investorPackDelivery.count({
      where: {
        downloadedAt: { not: null },
      },
    })

    // Recent activities
    const recentActivities = await prisma.investorActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        investor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    })

    // Top investors by spend
    const topInvestors = await prisma.investor.findMany({
      orderBy: { totalSpent: "desc" },
      take: 10,
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

    // Conversion rates
    const conversionRates = {
      leadToQualified: stageStats.QUALIFIED / totalInvestors || 0,
      qualifiedToPurchased: stageStats.PURCHASED / (stageStats.QUALIFIED || 1),
      viewingToReserved:
        activeReservations / (stageStats.VIEWING_DEALS || 1),
    }

    return NextResponse.json({
      overview: {
        totalInvestors,
        activeInvestors,
        totalReservations,
        activeReservations,
        totalPurchases: totalPurchases._sum.dealsPurchased || 0,
        totalRevenue: Number(totalRevenue._sum.totalSpent) || 0,
      },
      byStage: stageStats,
      packStats: {
        totalPacksSent,
        packsViewed,
        packsDownloaded,
        viewRate: totalPacksSent > 0 ? (packsViewed / totalPacksSent) * 100 : 0,
        downloadRate:
          totalPacksSent > 0 ? (packsDownloaded / totalPacksSent) * 100 : 0,
      },
      conversionRates,
      recentActivities,
      topInvestors,
    })
  } catch (error: any) {
    console.error("Error fetching investor stats:", error)
    return NextResponse.json(
      { error: "Failed to fetch investor stats" },
      { status: 500 }
    )
  }
}
