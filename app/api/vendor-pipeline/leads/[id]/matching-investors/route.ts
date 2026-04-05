/**
 * GET /api/vendor-pipeline/leads/[id]/matching-investors
 * Returns investors ranked by how well they match this lead's criteria,
 * plus any notification history for each investor on this lead.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { matchInvestors } from "@/lib/deals/investor-matcher"

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Fetch lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        propertyPostcode: true,
        offerAmount: true,
        askingPrice: true,
        bmvScore: true,
        estimatedMonthlyRent: true,
        estimatedAnnualRent: true,
        validationNotes: true,
        validationPassed: true,
        pipelineEvents: {
          where: { eventType: "investor_notified" },
          select: { details: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // Build notification history: investorId → most recent notification date
    const notifiedMap: Record<string, { sentAt: string; channel: string }> = {}
    for (const ev of lead.pipelineEvents) {
      const d = ev.details as Record<string, any>
      const iid = d?.investorId as string | undefined
      if (iid && !notifiedMap[iid]) {
        notifiedMap[iid] = { sentAt: ev.createdAt.toISOString(), channel: d?.channel ?? "email" }
      }
    }

    // Derive matching values from validation notes (strategy) + lead fields
    const price = lead.offerAmount
      ? Number(lead.offerAmount)
      : lead.askingPrice
      ? Number(lead.askingPrice)
      : 0

    const bmvPct = lead.bmvScore ? Number(lead.bmvScore) : null

    // Parse recommended strategy from validation notes [STRATEGY_DATA]
    let recommendedStrategy: string | null = null
    if (lead.validationNotes) {
      const m = lead.validationNotes.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/)
      if (m) {
        try {
          const parsed = JSON.parse(m[1])
          const strategies: Array<{ key: string; viable: boolean }> = parsed.strategies ?? []
          const viable = strategies.filter((s) => s.viable).map((s) => s.key.toLowerCase())
          if (viable.includes("flip")) {
            recommendedStrategy = viable.includes("btl") || viable.includes("buyhold") ? "both" : "flip"
          } else if (viable.includes("btl") || viable.includes("buyhold") || viable.includes("brr")) {
            recommendedStrategy = "hold"
          }
        } catch {}
      }
    }

    // Gross yield from rent
    let grossYield: number | null = null
    if (lead.estimatedAnnualRent && price > 0) {
      grossYield = (Number(lead.estimatedAnnualRent) / price) * 100
    } else if (lead.estimatedMonthlyRent && price > 0) {
      grossYield = (Number(lead.estimatedMonthlyRent) * 12 / price) * 100
    }

    // Fetch all investors with criteria set
    const investors = await prisma.investor.findMany({
      where: {
        OR: [
          { preferredAreas: { isEmpty: false } },
          { minBudget: { not: null } },
          { maxBudget: { not: null } },
          { minYield: { not: null } },
          { minBmv: { not: null } },
          { strategy: { isEmpty: false } },
        ],
      },
      select: {
        id: true,
        preferredAreas: true,
        minBudget: true,
        maxBudget: true,
        minYield: true,
        minBmv: true,
        strategy: true,
        financingStatus: true,
        experienceLevel: true,
        pipelineStage: true,
        user: {
          select: { firstName: true, lastName: true, email: true, phone: true },
        },
      },
    })

    const normalised = investors.map((inv) => ({
      id: inv.id,
      name: [inv.user.firstName, inv.user.lastName].filter(Boolean).join(" ") || inv.user.email,
      preferredAreas: inv.preferredAreas,
      minBudget: inv.minBudget ?? null,
      maxBudget: inv.maxBudget ?? null,
      minYield: inv.minYield ? Number(inv.minYield) : null,
      minBmv: inv.minBmv ? Number(inv.minBmv) : null,
      strategy: inv.strategy,
    }))

    const matches = matchInvestors(normalised, {
      postcode: lead.propertyPostcode,
      askingPrice: price,
      bmvPercentage: bmvPct,
      grossYield,
      recommendedStrategy,
    })

    // Enrich matches with notification status and investor profile details
    const enriched = matches.map((m) => {
      const inv = investors.find((i) => i.id === m.investorId)!
      return {
        ...m,
        email: inv.user.email,
        phone: inv.user.phone ?? null,
        pipelineStage: inv.pipelineStage,
        financingStatus: inv.financingStatus ?? null,
        notification: notifiedMap[m.investorId] ?? null,
      }
    })

    return NextResponse.json({
      matches: enriched,
      dealValues: { price, bmvPct, grossYield, recommendedStrategy },
    })
  } catch (error: any) {
    console.error("[matching-investors] Error:", error)
    return NextResponse.json({ error: "Failed to fetch matching investors" }, { status: 500 })
  }
}
