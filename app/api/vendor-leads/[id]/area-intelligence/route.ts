/**
 * POST /api/vendor-leads/[id]/area-intelligence
 * Generate an AI area intelligence assessment based on comparable sales data.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import Anthropic from "@anthropic-ai/sdk"

// ── types ─────────────────────────────────────────────────────────────────────

interface ComparableLike {
  excluded?: boolean
  daysOnMarket?: number | null
  priceReductions?: number | null
  saleDate?: string
}

interface RequestBody {
  comparables: ComparableLike[]
  askingPrice?: number | null
  propertyType?: string | null
  bedrooms?: number | null
  postcode?: string | null
  bmvPercent?: number | null
  avgPrice?: number | null
  avgRentalYield?: number | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return "unknown"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return "unknown"
  return `${Number(n).toFixed(decimals)}%`
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse + validate body
    const body: RequestBody = await req.json()
    const { comparables, askingPrice, propertyType, bedrooms, postcode, bmvPercent, avgPrice, avgRentalYield } = body

    if (!Array.isArray(comparables) || comparables.length === 0) {
      return NextResponse.json(
        { error: "No comparables provided — fetch comparables first" },
        { status: 400 }
      )
    }

    // 3. API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      console.error("[area-intelligence] ANTHROPIC_API_KEY is not set")
      return NextResponse.json(
        { error: "AI service not configured" },
        { status: 500 }
      )
    }

    // 4. Compute derived signals
    const activeComps = comparables.filter((c) => !c.excluded)

    // Average days on market (integer or null)
    const withDom = activeComps.filter((c) => c.daysOnMarket != null)
    const avgDom: number | null = withDom.length
      ? Math.round(withDom.reduce((sum, c) => sum + (c.daysOnMarket ?? 0), 0) / withDom.length)
      : null

    // Price reduction rate (0-100 integer or null)
    const withReductionData = activeComps.filter((c) => c.priceReductions != null)
    const reductionRate: number | null = withReductionData.length
      ? Math.round(
          (withReductionData.filter((c) => (c.priceReductions ?? 0) > 0).length /
            activeComps.length) *
            100
        )
      : null

    // Recent / stale sales
    const now = Date.now()
    const SIX_MONTHS_MS = 6 * 30.44 * 24 * 60 * 60 * 1000
    const EIGHTEEN_MONTHS_MS = 18 * 30.44 * 24 * 60 * 60 * 1000

    const recentSales = activeComps.filter((c) => {
      try {
        return c.saleDate ? now - new Date(c.saleDate).getTime() < SIX_MONTHS_MS : false
      } catch {
        return false
      }
    }).length

    const staleSales = activeComps.filter((c) => {
      try {
        return c.saleDate ? now - new Date(c.saleDate).getTime() > EIGHTEEN_MONTHS_MS : false
      } catch {
        return false
      }
    }).length

    // 5. Build prompt
    const prompt = `You are a UK property investment analyst. Based on the following market data, provide a structured area intelligence assessment. Respond ONLY with valid JSON matching this exact schema:

{
  "liquidityScore": number,
  "liquidityAssessment": string,
  "demandTrend": "rising" | "stable" | "softening" | "declining",
  "strategyFit": string[],
  "priceSensitivity": string,
  "narrative": string
}

Rules:
- liquidityScore: integer 1-10 (10 = highly liquid, properties sell fast)
- liquidityAssessment: 1-2 sentences on ease of exit (sell or let) for this deal
- demandTrend: overall direction of buyer demand based on available data
- strategyFit: ordered list of 2-4 best exit strategies for this market (e.g. "Buy-to-Let", "Flip/Refurb", "Buy-to-Sell", "HMO", "Serviced Accommodation", "Auction")
- priceSensitivity: 1-2 sentences on negotiating dynamics (buyer's vs seller's market, room to negotiate)
- narrative: 3-4 sentence professional investment summary suitable for a deal pack

Property:
- Postcode: ${postcode ?? "unknown"}
- Type: ${propertyType ?? "unknown"}, ${bedrooms ?? "unknown"} bedrooms
- Asking price: ${fmtCurrency(askingPrice)}
- BMV: ${fmtPct(bmvPercent)}
- Avg comparable price: ${fmtCurrency(avgPrice)}
- Avg rental yield: ${fmtPct(avgRentalYield)}

Market signals from ${activeComps.length} active comparable sales:
- Average days on market: ${avgDom != null ? `${avgDom} days` : "data unavailable"}
- Sales in last 6 months: ${recentSales} of ${activeComps.length}
- Sales older than 18 months: ${staleSales} of ${activeComps.length}
- Price reductions seen: ${reductionRate != null ? `${reductionRate}% of comps had price cuts` : "data unavailable"}

Do not add any text outside the JSON object.`

    // 6. Call Claude
    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 768,
      messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    })

    // 7. Parse response
    const raw =
      response.content[0].type === "text" ? response.content[0].text : ""

    // Strip markdown fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim()

    let analysis: unknown
    try {
      analysis = JSON.parse(cleaned)
    } catch (parseErr) {
      console.error("[area-intelligence] Failed to parse AI response:", raw, parseErr)
      return NextResponse.json(
        { error: "AI returned an unparseable response" },
        { status: 502 }
      )
    }

    // 8. Return success
    return NextResponse.json({
      success: true,
      analysis,
      signals: {
        avgDom,
        reductionRate,
        recentSales,
        staleSales,
        activeCount: activeComps.length,
      },
    })
  } catch (err: unknown) {
    console.error("[area-intelligence] Unexpected error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
