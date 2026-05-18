/**
 * POST /api/vendor-pipeline/leads/[id]/generate-investor-pitch
 *
 * Uses Claude to generate a personalised investor pitch email + SMS for a
 * specific investor about a specific lead. Tailors tone and emphasis to the
 * investor's buy-box (strategy, areas, budget, experience level, financing).
 *
 * Body: { investorId: string }
 * Returns: { subject: string, email: string, sms: string }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── helpers ──────────────────────────────────────────────────────────────────

function gbp(n: number | null | undefined) {
  if (n == null) return null
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number | null | undefined, dp = 1) {
  if (n == null) return null
  return `${n.toFixed(dp)}%`
}

// ─── route ────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const { investorId } = body as { investorId: string }

    if (!investorId) {
      return NextResponse.json({ error: "investorId is required" }, { status: 400 })
    }

    // ── Fetch lead ───────────────────────────────────────────────────────────
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        propertyAddress: true,
        propertyPostcode: true,
        propertyType: true,
        bedrooms: true,
        askingPrice: true,
        offerAmount: true,
        estimatedMarketValue: true,
        bmvScore: true,
        estimatedMonthlyRent: true,
        estimatedAnnualRent: true,
        estimatedRefurbCost: true,
        photoConditionScore: true,
        epcRating: true,
        floodRiskZone: true,
        tenureType: true,
        validationNotes: true,
        validationPassed: true,
        latestCheckRisk: true,
        _count: {
          select: { photos: true },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // ── Fetch investor ───────────────────────────────────────────────────────
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      select: {
        preferredAreas: true,
        minBudget: true,
        maxBudget: true,
        minYield: true,
        minBmv: true,
        strategy: true,
        experienceLevel: true,
        financingStatus: true,
        user: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    // ── Build deal context ───────────────────────────────────────────────────
    const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : null
    const offerPrice  = lead.offerAmount ? Number(lead.offerAmount) : askingPrice
    const marketValue = lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null
    const bmvPct      = lead.bmvScore ? Number(lead.bmvScore) : null
    const monthlyRent = lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null
    const annualRent  = lead.estimatedAnnualRent
      ? Number(lead.estimatedAnnualRent)
      : monthlyRent ? monthlyRent * 12 : null
    const grossYield  = annualRent && offerPrice && offerPrice > 0
      ? (annualRent / offerPrice) * 100
      : null
    const refurbCost  = lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null

    // Parse recommended strategy from validation notes
    let strategies: string[] = []
    if (lead.validationNotes) {
      const m = lead.validationNotes.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/)
      if (m) {
        try {
          const parsed = JSON.parse(m[1])
          strategies = (parsed.strategies as Array<{ key: string; viable: boolean }>)
            .filter((s) => s.viable)
            .map((s) => s.key.toUpperCase())
        } catch {}
      }
    }

    const dealLines: string[] = []
    dealLines.push(`Property: ${lead.propertyAddress ?? lead.propertyPostcode ?? "Address TBC"}`)
    if (lead.propertyType) dealLines.push(`Type: ${lead.bedrooms ? `${lead.bedrooms}-bed ` : ""}${lead.propertyType}`)
    if (offerPrice) dealLines.push(`Offer price: ${gbp(offerPrice)}`)
    if (marketValue) dealLines.push(`Market value: ${gbp(marketValue)}`)
    if (bmvPct != null) dealLines.push(`BMV: ${pct(bmvPct)} below market`)
    if (monthlyRent) dealLines.push(`Estimated monthly rent: ${gbp(monthlyRent)}/mo`)
    if (grossYield != null) dealLines.push(`Gross yield: ${pct(grossYield)}`)
    if (refurbCost) dealLines.push(`Estimated refurb cost: ${gbp(refurbCost)}`)
    if (lead.epcRating) dealLines.push(`EPC rating: ${lead.epcRating}`)
    if (lead.floodRiskZone) {
      const floodLabel = lead.floodRiskZone === "zone1" ? "Zone 1 (low risk)"
        : lead.floodRiskZone === "zone2" ? "Zone 2 (medium risk — check insurance)"
        : lead.floodRiskZone === "zone3" ? "Zone 3 (high risk)"
        : "Unknown"
      dealLines.push(`Flood zone: ${floodLabel}`)
    }
    if (lead.tenureType) dealLines.push(`Tenure: ${lead.tenureType}`)
    if (lead.latestCheckRisk) {
      const riskLabel = lead.latestCheckRisk === "clear" ? "Clear ✓"
        : lead.latestCheckRisk === "caution" ? "Caution ⚠"
        : "Red flag ⛔"
      dealLines.push(`Portal risk check: ${riskLabel}`)
    }
    if (lead.photoConditionScore != null) dealLines.push(`Property condition score (AI): ${lead.photoConditionScore}/100`)
    if (lead._count.photos > 0) dealLines.push(`Photos available: ${lead._count.photos}`)
    if (strategies.length > 0) dealLines.push(`Viable strategies: ${strategies.join(", ")}`)

    // ── Build investor context ────────────────────────────────────────────────
    const investorFirstName = investor.user.firstName || investor.user.email.split("@")[0]
    const investorLines: string[] = []
    investorLines.push(`Name: ${[investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ") || investor.user.email}`)
    if (investor.strategy.length > 0) investorLines.push(`Preferred strategies: ${investor.strategy.join(", ")}`)
    if (investor.preferredAreas.length > 0) investorLines.push(`Preferred areas: ${investor.preferredAreas.join(", ")}`)
    if (investor.minBudget != null && investor.maxBudget != null) {
      investorLines.push(`Budget: ${gbp(Number(investor.minBudget))} – ${gbp(Number(investor.maxBudget))}`)
    }
    if (investor.minYield != null) investorLines.push(`Minimum yield target: ${pct(Number(investor.minYield))}`)
    if (investor.minBmv != null) investorLines.push(`Minimum BMV target: ${pct(Number(investor.minBmv))}`)
    if (investor.experienceLevel) investorLines.push(`Experience level: ${investor.experienceLevel}`)
    if (investor.financingStatus) investorLines.push(`Financing: ${investor.financingStatus}`)

    // ── Call Claude ───────────────────────────────────────────────────────────
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are an expert UK property deal sourcer generating a personalised investor pitch. Write a professional, concise pitch email and an SMS for this specific investor about this specific deal.

INVESTOR PROFILE:
${investorLines.join("\n")}

DEAL DATA:
${dealLines.join("\n")}

INSTRUCTIONS:
- Address the investor by first name (${investorFirstName})
- Tailor the pitch to their specific strategy, preferred areas, and financial criteria
- Lead with the numbers that best match what they care about (yield for BTL/BRRR, BMV for flips)
- If their strategy is BRRR/BTL, emphasise yield and rental income first, BMV second
- If their strategy is Flip, emphasise BMV discount and profit potential first
- Mention 1-2 risk flags honestly but briefly (e.g. EPC, flood zone) — credibility builds trust
- Keep email to 150–180 words. Professional but warm in tone. No hyperbole or pushy language.
- Sign off as "The DealStack Team"
- For SMS: under 140 characters, ultra-concise — the key numbers + call to action

Respond ONLY with a valid JSON object (no markdown, no explanation):
{
  "subject": "concise email subject line",
  "email": "full email body text (plain text, no HTML, use line breaks for paragraphs)",
  "sms": "SMS text under 140 chars"
}`,
        },
      ],
    })

    // ── Parse response ────────────────────────────────────────────────────────
    const rawText =
      response.content[0].type === "text" ? response.content[0].text.trim() : ""

    let parsed: { subject: string; email: string; sms: string }
    try {
      // Strip any markdown code fences if present
      const jsonStr = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim()
      parsed = JSON.parse(jsonStr)
    } catch {
      // Fallback: return raw text as email
      const address = lead.propertyAddress ?? lead.propertyPostcode ?? "the property"
      parsed = {
        subject: `New deal match — ${address}`,
        email: rawText,
        sms: `DealStack: New deal match — ${address}${bmvPct != null ? ` at ${bmvPct.toFixed(0)}% BMV` : ""}. Login to view.`,
      }
    }

    return NextResponse.json({
      subject: parsed.subject ?? "New deal match",
      email: parsed.email ?? "",
      sms: parsed.sms ?? "",
    })
  } catch (error: any) {
    console.error("[generate-investor-pitch] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate pitch" },
      { status: 500 }
    )
  }
}
