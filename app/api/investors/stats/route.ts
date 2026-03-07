import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // ── Fire all independent queries in parallel ───────────────────────────────
    const [
      totalInvestors,
      activeInvestors,
      byStage,
      totalPurchases,
      totalRevenue,
      allReservations,
      totalPacksSent,
      packsViewed,
      packsDownloaded,
      recentActivities,
      topInvestors,
    ] = await Promise.all([
      prisma.investor.count(),
      prisma.investor.count({ where: { lastActivityAt: { gte: thirtyDaysAgo } } }),
      prisma.investor.groupBy({ by: ["pipelineStage"], _count: true }),
      prisma.investor.aggregate({ _sum: { dealsPurchased: true } }),
      prisma.investor.aggregate({ _sum: { totalSpent: true } }),
      prisma.investorReservation.findMany({
        select: {
          status: true,
          reservationFee: true,
          feePaid: true,
          proofOfFundsVerified: true,
          lockOutAgreementSigned: true,
        },
      }),
      prisma.investorPackDelivery.count(),
      prisma.investorPackDelivery.count({ where: { viewedAt: { not: null } } }),
      prisma.investorPackDelivery.count({ where: { downloadedAt: { not: null } } }),
      prisma.investorActivity.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          investor: {
            include: { user: { select: { firstName: true, lastName: true, email: true } } },
          },
        },
      }),
      prisma.investor.findMany({
        orderBy: { totalSpent: "desc" },
        take: 10,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
      }),
    ])

    // ── Derive reservation stats in-memory (single pass each) ─────────────────
    const stageStats = byStage.reduce((acc, item) => {
      acc[item.pipelineStage] = item._count
      return acc
    }, {} as Record<string, number>)

    const TERMINAL = ["completed", "cancelled"]
    const activeRes = allReservations.filter((r) => !TERMINAL.includes(r.status))
    const completedRes = allReservations.filter((r) => r.status === "completed")
    const cancelledRes = allReservations.filter((r) => r.status === "cancelled")
    const feePaidRes = allReservations.filter((r) => r.feePaid)
    const feeUnpaidActiveRes = activeRes.filter((r) => !r.feePaid)

    const feesCollected = feePaidRes.reduce((s, r) => s + Number(r.reservationFee), 0)
    const feesOutstanding = feeUnpaidActiveRes.reduce((s, r) => s + Number(r.reservationFee), 0)
    const pofVerified = allReservations.filter((r) => r.proofOfFundsVerified).length
    const lockOutSigned = allReservations.filter((r) => r.lockOutAgreementSigned).length

    // Count per reservation status — single reduce pass
    const ALL_STATUSES = [
      "pending", "pack_sent", "fee_pending", "fee_paid",
      "proof_of_funds_pending", "pof_received", "verified",
      "lock_out_sent", "locked_out", "completed", "cancelled",
    ]
    const byReservationStatus = allReservations.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    ALL_STATUSES.forEach((s) => { if (!(s in byReservationStatus)) byReservationStatus[s] = 0 })

    // ── Conversion rates ───────────────────────────────────────────────────────
    const conversionRates = {
      leadToQualified: totalInvestors > 0 ? (stageStats.QUALIFIED || 0) / totalInvestors : 0,
      qualifiedToPurchased: (stageStats.QUALIFIED || 0) > 0 ? (stageStats.PURCHASED || 0) / stageStats.QUALIFIED : 0,
      viewingToReserved: (stageStats.VIEWING_DEALS || 0) > 0 ? activeRes.length / stageStats.VIEWING_DEALS : 0,
    }

    return NextResponse.json({
      overview: {
        totalInvestors,
        activeInvestors,
        totalReservations: allReservations.length,
        activeReservations: activeRes.length,
        completedReservations: completedRes.length,
        cancelledReservations: cancelledRes.length,
        totalPurchases: totalPurchases._sum.dealsPurchased || 0,
        totalRevenue: Number(totalRevenue._sum.totalSpent) || 0,
      },
      reservationStats: {
        feesCollected,
        feesOutstanding,
        feesCollectedCount: feePaidRes.length,
        feesPendingCount: feeUnpaidActiveRes.length,
        pofVerified,
        lockOutSigned,
      },
      byStage: stageStats,
      byReservationStatus,
      packStats: {
        totalPacksSent,
        packsViewed,
        packsDownloaded,
        viewRate: totalPacksSent > 0 ? (packsViewed / totalPacksSent) * 100 : 0,
        downloadRate: totalPacksSent > 0 ? (packsDownloaded / totalPacksSent) * 100 : 0,
      },
      conversionRates,
      recentActivities,
      topInvestors,
    })
  } catch (error: any) {
    console.error("Error fetching investor stats:", error)
    return NextResponse.json({ error: "Failed to fetch investor stats" }, { status: 500 })
  }
}
