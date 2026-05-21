/**
 * POST /api/vendor-leads/[id]/property-history/analyse
 *
 * Accepts the property history payload in the request body and asks Claude
 * to produce a structured investor intelligence narrative.
 *
 * Response shape:
 * {
 *   narrative:       string   — 3-4 sentence investor-facing summary
 *   offerStrategy:   string   — one-sentence recommended approach
 *   keyFlags:        string[] — up to 5 bullet points of actionable signals
 *   pricingVerdict:  "overpriced" | "fair" | "underpriced" | "unknown"
 *   motivationRead:  string   — inferred vendor motivation / urgency
 *   negotiationTip:  string   — specific tactic based on signals
 * }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession }          from "next-auth"
import { authOptions }               from "@/lib/auth"
import { prisma }                    from "@/lib/db"
import Anthropic                     from "@anthropic-ai/sdk"

const PROMPT = `You are an expert UK property investment analyst. You have been given a property's full history intelligence report. Analyse the data and respond ONLY with valid JSON matching this exact schema:

{
  "narrative": string,
  "offerStrategy": string,
  "keyFlags": string[],
  "pricingVerdict": "overpriced" | "fair" | "underpriced" | "unknown",
  "motivationRead": string,
  "negotiationTip": string
}

Rules:
- narrative: 3-4 sentences, investor-facing, professional tone. Cover price trajectory, time on market, and what the pattern suggests about the vendor.
- offerStrategy: One clear sentence on recommended approach (e.g. "Open 12% BMV justified by 2 reductions and 97-day DOM")
- keyFlags: Up to 5 concise bullet strings (no bullet character), ranked by importance. Each flag should be an actionable observation.
- pricingVerdict: Compare the current asking price vs. last sold price, area average, and reduction history.
- motivationRead: Infer vendor urgency/motivation from the combined signals in plain English (2 sentences max).
- negotiationTip: One specific, tactical tip for the sourcer based on the distress score and history (e.g. "Reference the two failed sales and current 97 DOM when submitting — data supports a BMV offer").
Do not add any text outside the JSON object.`

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: { id: true, propertyAddress: true, askingPrice: true },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const body = await request.json()
    const historyData = body.historyData

    if (!historyData) {
      return NextResponse.json({ error: "Missing historyData in body" }, { status: 400 })
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })

    const client = new Anthropic({ apiKey: anthropicKey })

    // Build a concise context string for Claude
    const context = JSON.stringify({
      address:        historyData.address,
      askingPrice:    lead.askingPrice ? `£${Number(lead.askingPrice).toLocaleString()}` : "unknown",
      distressScore:  historyData.distress?.score,
      distressSignals:historyData.distress?.signals,
      soldHistory: {
        transactionCount:  historyData.soldHistory?.transactionCount,
        firstSalePrice:    historyData.soldHistory?.firstSalePrice,
        firstSaleDate:     historyData.soldHistory?.firstSaleDate,
        lastSalePrice:     historyData.soldHistory?.lastSalePrice,
        lastSaleDate:      historyData.soldHistory?.lastSaleDate,
        gainPct:           historyData.soldHistory?.gainPct,
        flips:             historyData.soldHistory?.flips,
        areaAvgPrice:      historyData.soldHistory?.areaAvgPrice,
        soldBelowAreaAvg:  historyData.soldHistory?.soldBelowAreaAvg,
      },
      listingHistory: {
        count:                historyData.listingHistory?.count,
        totalReductions:      historyData.listingHistory?.totalReductions,
        totalReductionAmount: historyData.listingHistory?.totalReductionAmount,
        maxDaysOnMarket:      historyData.listingHistory?.maxDaysOnMarket,
        hasFailedSale:        historyData.listingHistory?.hasFailedSale,
        originalListingPrice: historyData.listingHistory?.originalListingPrice,
      },
      epc: {
        latestRating:    historyData.epc?.latestRating,
        potentialRating: historyData.epc?.potentialRating,
        improvementGap:  historyData.epc?.improvementGap,
      },
      ownership: {
        isCorporate: historyData.ownership?.isCorporate,
        isOverseas:  historyData.ownership?.isOverseas,
        companyName: historyData.ownership?.companyName,
      },
    }, null, 2)

    const response = await client.messages.create({
      model:      process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 800,
      messages: [
        {
          role: "user",
          content: `${PROMPT}\n\nProperty History Data:\n${context}`,
        },
      ],
    })

    const raw     = response.content[0].type === "text" ? response.content[0].text : ""
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()

    let analysis: any
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error("[property-history/analyse] JSON parse failed:", cleaned)
      return NextResponse.json({ error: "AI returned invalid JSON", raw: cleaned }, { status: 502 })
    }

    return NextResponse.json({ success: true, analysis })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[property-history/analyse]", message)
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 })
  }
}
