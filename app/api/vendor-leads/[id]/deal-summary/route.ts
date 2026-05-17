/**
 * POST /api/vendor-leads/[id]/deal-summary
 * Generate an AI investment case summary for a deal and persist it.
 *
 * GET /api/vendor-leads/[id]/deal-summary
 * Return the stored summary (if any).
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { AIProviderService } from "@/lib/vendor-pipeline/ai-provider"

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "unknown"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number | null | undefined): string {
  if (n == null) return "unknown"
  return `${Number(n).toFixed(1)}%`
}

// ── GET — fetch stored summary ────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const rows = await prisma.$queryRaw<
    Array<{ ai_deal_summary: string | null; ai_deal_summary_at: Date | null }>
  >`
    SELECT ai_deal_summary, ai_deal_summary_at
    FROM vendor_leads
    WHERE id = ${params.id}
    LIMIT 1
  `

  const row = rows[0]
  return NextResponse.json({
    summary: row?.ai_deal_summary ?? null,
    generatedAt: row?.ai_deal_summary_at ?? null,
  })
}

// ── POST — generate + persist ─────────────────────────────────────────────────

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "sourcer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Fetch lead with all metrics
  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: {
      propertyAddress: true,
      propertyPostcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      condition: true,
      askingPrice: true,
      estimatedMarketValue: true,
      bmvScore: true,
      estimatedMonthlyRent: true,
      estimatedRefurbCost: true,
      reasonForSelling: true,
      motivationScore: true,
      urgencyLevel: true,
      offerAmount: true,
      validationNotes: true,
      epcRating: true,
    },
  })

  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  // Fetch refurb line items total for context
  const refurbRows = await prisma.$queryRaw<Array<{ total: number }>>`
    SELECT COALESCE(SUM(estimated_cost), 0)::float AS total
    FROM refurb_line_items
    WHERE vendor_lead_id = ${params.id}
  `
  const refurbTotal = refurbRows[0]?.total ?? 0

  // Build the prompt context
  const bmvPct = lead.bmvScore
    ? `${Number(lead.bmvScore).toFixed(1)}% below market value`
    : "discount to market value not yet calculated"

  const grossYield =
    lead.estimatedMonthlyRent && lead.askingPrice
      ? ((Number(lead.estimatedMonthlyRent) * 12) / Number(lead.askingPrice)) * 100
      : null

  const refurbFigure =
    refurbTotal > 0
      ? fmt(refurbTotal)
      : lead.estimatedRefurbCost
      ? fmt(Number(lead.estimatedRefurbCost))
      : null

  const prompt = `You are writing a professional deal summary for a UK property investment sourcing firm.
Write a concise 3-paragraph investment case that a sourcer can use as the opening section of an investor pack.

PROPERTY DATA:
- Address: ${lead.propertyAddress ?? "Not specified"}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}
- Type: ${lead.propertyType ? lead.propertyType.replace(/_/g, " ") : "not specified"}
- Bedrooms: ${lead.bedrooms ?? "not specified"}, Bathrooms: ${lead.bathrooms ?? "not specified"}
- Condition: ${lead.condition ?? "not assessed"}
- EPC Rating: ${lead.epcRating ?? "not obtained"}
- Asking Price: ${fmt(lead.askingPrice ? Number(lead.askingPrice) : null)}
- Market Value: ${fmt(lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null)}
- Discount: ${bmvPct}
- Our Offer: ${fmt(lead.offerAmount ? Number(lead.offerAmount) : null)}
- Monthly Rent (est.): ${fmt(lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null)}
- Gross Yield (est.): ${grossYield ? pct(grossYield) : "not calculated"}
- Refurbishment Cost (est.): ${refurbFigure ?? "not assessed"}
- Vendor Motivation: ${lead.reasonForSelling ?? "not stated"} (score: ${lead.motivationScore ?? "n/a"}/10, urgency: ${lead.urgencyLevel ?? "unknown"})

WRITING INSTRUCTIONS:
- Paragraph 1: The opportunity — location, property type, asking price vs market value, and why this is a strong below-market acquisition.
- Paragraph 2: Income potential — estimated rental income, gross yield, and who this suits (BTL landlord, BRRR investor, etc.).
- Paragraph 3: Exit strategy — refurb scope if applicable, after-refurb value uplift potential, and recommended holding strategy.
- Tone: professional, direct, confident. No fluff. Written for an experienced UK property investor.
- Do not invent figures. If data is missing, acknowledge it briefly and move on.
- Do not use headers or bullet points — flowing paragraphs only.`

  const ai = new AIProviderService()
  const result = await ai.chat(
    [{ role: "user", content: "Generate the deal summary now." }],
    prompt
  )

  const summary = result.message.trim()

  // Persist to DB
  await prisma.$executeRaw`
    UPDATE vendor_leads
    SET ai_deal_summary = ${summary},
        ai_deal_summary_at = NOW()
    WHERE id = ${params.id}
  `

  return NextResponse.json({ summary, generatedAt: new Date() })
}
