// app/api/analytics/kpis/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function parseFromDate(url: string): Date | undefined {
  const { searchParams } = new URL(url)
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fromDate = parseFromDate(request.url)
    const df = fromDate ? { createdAt: { gte: fromDate } } : {}

    // "dealsRecent" = deals created since fromDate (or since start of current month if no filter)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const recentSince = fromDate ?? monthStart

    const [
      totalDeals,
      dealsRecent,
      totalVendors,
      vendorsWithOffers,
      vendorsAccepted,
      totalReservations,
      reservationsWithProof,
    ] = await Promise.all([
      prisma.deal.count({ where: { ...df } }),
      prisma.deal.count({ where: { createdAt: { gte: recentSince } } }),
      prisma.vendor.count({ where: { ...df } }),
      prisma.vendor.count({ where: { status: { in: ["offer_made", "negotiating"] }, ...df } }),
      prisma.vendor.count({ where: { status: "offer_accepted", ...df } }),
      prisma.investorReservation.count({ where: { ...df } }),
      prisma.investorReservation.count({ where: { proofOfFundsVerified: true, ...df } }),
    ])

    const vendorConversionRate =
      totalVendors > 0 ? ((vendorsAccepted / totalVendors) * 100).toFixed(1) : "0"

    return NextResponse.json({
      totalDeals,
      dealsRecent,
      totalVendors,
      vendorsWithOffers,
      vendorsAccepted,
      totalReservations,
      reservationsWithProof,
      vendorConversionRate,
    })
  } catch (error) {
    console.error("Error fetching KPIs:", error)
    return NextResponse.json({ error: "Failed to fetch KPIs" }, { status: 500 })
  }
}
