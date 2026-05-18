/**
 * POST /api/vendor-leads/[id]/flood-risk-analysis
 *
 * Generates an AI investor summary from flood risk data using Claude.
 * Accepts the flood check result in the request body so Claude can assess
 * zone classification, nearby flood areas, and live warnings together.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"

// ─── types ────────────────────────────────────────────────────────────────────

interface FloodAnalysisRequest {
  zone: "zone1" | "zone2" | "zone3" | "unknown"
  nearbyAreas: { label: string; riverOrSea: string }[]
  activeWarnings: {
    severity: string
    severityLevel: number
    description: string
    area: string
    riverOrSea: string
  }[]
  postcode: string
  lat: number
  lng: number
}

// ─── prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(
  data: FloodAnalysisRequest,
  lead: { propertyAddress?: string | null; propertyType?: string | null; askingPrice?: unknown }
): string {
  const zoneLabel =
    data.zone === "zone1" ? "Low Risk (Zone 1 — <0.1% annual probability)"
    : data.zone === "zone2" ? "Medium Risk (Zone 2 — 0.1–1% annual probability)"
    : data.zone === "zone3" ? "High Risk (Zone 3 — >1% annual probability)"
    : "Unknown (could not classify)"

  const areasText =
    data.nearbyAreas.length === 0
      ? "None within 2km"
      : data.nearbyAreas
          .slice(0, 5)
          .map((a) => `  - ${a.label || a.riverOrSea}${a.riverOrSea && a.label ? ` (${a.riverOrSea})` : ""}`)
          .join("\n")

  const warningsText =
    data.activeWarnings.length === 0
      ? "None active within 5km"
      : data.activeWarnings
          .map((w) => `  - [${w.severity}] ${w.description || w.riverOrSea || w.area}`)
          .join("\n")

  const askingPrice =
    lead.askingPrice != null
      ? `£${Number(lead.askingPrice).toLocaleString("en-GB")}`
      : "not specified"

  return `You are a senior UK property investment analyst specialising in environmental risk assessment. Analyse the following flood risk data for a property and respond ONLY with valid JSON matching the schema below.

PROPERTY DETAILS:
- Address: ${lead.propertyAddress ?? data.postcode}
- Type: ${lead.propertyType ?? "not specified"}
- Asking price: ${askingPrice}
- Postcode: ${data.postcode}
- Coordinates: ${data.lat.toFixed(4)}, ${data.lng.toFixed(4)}

FLOOD RISK DATA:
- EA Flood Zone: ${zoneLabel}
- Nearby Flood Alert Areas (within 2km):
${areasText}
- Live EA Flood Warnings (within 5km):
${warningsText}

Respond ONLY with this JSON:
{
  "verdict": "proceed" | "caution" | "avoid",
  "verdictReason": string,
  "narrative": string,
  "mortgageImpact": string,
  "insuranceImpact": string,
  "dueDiligence": string[]
}

Rules:
- verdict: "proceed" if Zone 1 with no warnings; "caution" if Zone 2 or Zone 1 with alerts; "avoid" if Zone 3 or active Flood Warning/Severe Warning
- verdictReason: one concise sentence explaining the verdict
- narrative: 2–3 sentences of professional investor-facing commentary on the flood risk picture for this specific area
- mortgageImpact: 1–2 sentences covering lender appetite, specialist lender requirements, and LTV implications for this zone
- insuranceImpact: 1 sentence on buildings insurance availability and likely premium loading
- dueDiligence: 3–5 specific recommended actions (e.g. "Commission a Flood Risk Assessment from a CIWEM-accredited consultant", "Request conveyancer to check flood history in property searches", "Verify buildings insurance quote before exchange", "Check if property has been flood-proofed or has flood resilience measures")
- Use UK English and UK regulatory context throughout
- Do not add any text outside the JSON object`
}

// ─── route ────────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

    // 2. Fetch lead for property context
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        propertyAddress: true,
        propertyPostcode: true,
        propertyType: true,
        askingPrice: true,
      },
    })
    if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    // 3. Parse flood data from request body
    let body: FloodAnalysisRequest
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    if (!body.zone) {
      return NextResponse.json({ error: "zone is required" }, { status: 400 })
    }

    // 4. Anthropic
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
    }

    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 768,
      messages: [
        {
          role: "user",
          content: buildPrompt(body, lead),
        },
      ],
    })

    // 5. Parse response
    const raw = response.content[0].type === "text" ? response.content[0].text : ""
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()

    let analysis: unknown
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error("[flood-risk-analysis] JSON parse failed:", cleaned)
      return NextResponse.json({ error: "AI returned invalid JSON", detail: cleaned }, { status: 502 })
    }

    return NextResponse.json({
      success: true,
      analysis,
      analysedAt: new Date().toISOString(),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[flood-risk-analysis] Unexpected error:", message)
    return NextResponse.json({ error: "Unexpected error", detail: message }, { status: 500 })
  }
}
