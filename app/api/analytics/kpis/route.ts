// app/api/analytics/kpis/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PipelineStage } from "@prisma/client"

function parseFromDate(url: string): Date | undefined {
  const { searchParams } = new URL(url)
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}

// Stages that represent a dead/lost lead — excluded from "active" count
const DEAD_STAGES: PipelineStage[] = ["DEAD_LEAD", "OFFER_REJECTED"]

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fromDate = parseFromDate(request.url)
    const df = fromDate ? { createdAt: { gte: fromDate } } : {}

    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const recentSince = fromDate ?? monthStart

    const [
      activeLeads,
      leadsThisMonth,
      dealsReady,
      activeReservations,
      totalLeads,
      acceptedLeads,
    ] = await Promise.all([
      // Active leads = not dead/rejected
      prisma.vendorLead.count({
        where: { pipelineStage: { notIn: DEAD_STAGES }, ...df },
      }),
      // New leads since the selected date (or start of month)
      prisma.vendorLead.count({
        where: { createdAt: { gte: recentSince } },
      }),
      // Deals currently listed or ready for investors
      prisma.deal.count({
        where: { status: { in: ["ready", "listed"] } },
      }),
      // Reservations that haven't been cancelled
      prisma.investorReservation.count({
        where: { status: { not: "cancelled" } },
      }),
      // Total leads (for conversion rate denominator)
      prisma.vendorLead.count({ where: { ...df } }),
      // Leads where offer was accepted
      prisma.vendorLead.count({
        where: { pipelineStage: "OFFER_ACCEPTED", ...df },
      }),
    ])

    const conversionRate =
      totalLeads > 0 ? ((acceptedLeads / totalLeads) * 100).toFixed(1) : "0"

    return NextResponse.json({
      activeLeads,
      leadsThisMonth,
      dealsReady,
      activeReservations,
      totalLeads,
      acceptedLeads,
      conversionRate,
    })
  } catch (error) {
    console.error("Error fetching KPIs", error)
    return NextResponse.json({ error: "Failed to fetch KPIs" }, { status: 500 })
  }
}
