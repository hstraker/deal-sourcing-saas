import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"

// ─── prompt ──────────────────────────────────────────────────────────────────

const STREET_VIEW_PROMPT = `You are a UK property surveyor and investment analyst reviewing a Google Street View image of a residential property. Analyse the image and respond ONLY with valid JSON matching this schema exactly:
{
  "hasStreetViewData": boolean,
  "kerbAppeal": number | null,
  "frontageCondition": "excellent" | "good" | "average" | "poor" | "very_poor" | null,
  "neighbourhoodCharacter": "affluent" | "established" | "mixed" | "transitional" | "deprived" | null,
  "concerns": string[],
  "greenFlags": string[],
  "narrative": string
}
Rules:
- hasStreetViewData: false if the image is a grey/no-imagery placeholder, true otherwise
- kerbAppeal: integer 1-10 (10 = outstanding), null if no imagery
- frontageCondition: condition of the subject property frontage visible
- neighbourhoodCharacter: overall street/neighbourhood character
- concerns: up to 5 specific visible red flags (e.g. "boarded windows nearby", "fly-tipping visible", "graffiti", "unkempt gardens", "heavy commercial adjacency")
- greenFlags: up to 5 positive signals (e.g. "tree-lined street", "well-maintained gardens", "off-street parking", "quiet residential street", "recent development nearby")
- narrative: 2-3 sentences of professional investor-facing commentary on the street/frontage
If no imagery: return hasStreetViewData=false, all other fields null/empty, narrative="No street view imagery available for this location."
Do not add any text outside the JSON object.`

// ─── route ───────────────────────────────────────────────────────────────────

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    // 1. Auth
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
    }

    // 2. Fetch lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: { id: true, propertyAddress: true, propertyPostcode: true },
    })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // 3. Build location string
    const location = lead.propertyAddress ?? lead.propertyPostcode ?? ""
    if (!location) {
      return NextResponse.json({ error: "No address or postcode available for this lead" }, { status: 400 })
    }

    // 4. Google Maps API key
    const googleApiKey =
      process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!googleApiKey) {
      console.error("[street-view-analysis] Missing GOOGLE_MAPS_API_KEY")
      return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 })
    }

    // 5. Anthropic API key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      console.error("[street-view-analysis] Missing ANTHROPIC_API_KEY")
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
    }

    // 6. Fetch Street View image (server-side)
    const streetViewUrl =
      `https://maps.googleapis.com/maps/api/streetview` +
      `?size=800x450` +
      `&location=${encodeURIComponent(location)}` +
      `&fov=90&heading=235&pitch=0` +
      `&key=${googleApiKey}`

    const imageRes = await fetch(streetViewUrl)
    if (!imageRes.ok) {
      console.error("[street-view-analysis] Street View fetch failed", imageRes.status)
      return NextResponse.json(
        { error: "Failed to fetch Street View image", detail: `HTTP ${imageRes.status}` },
        { status: 502 }
      )
    }

    // 7. Convert to base64
    const base64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64")

    // 8. Content type (strip charset suffix)
    const contentType = (imageRes.headers.get("content-type") ?? "image/jpeg").split(";")[0]

    // 9. Call Claude Vision
    const client = new Anthropic({ apiKey: anthropicKey })
    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 768,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                data: base64,
              },
            },
            { type: "text", text: STREET_VIEW_PROMPT },
          ],
        },
      ],
    })

    // 10. Extract text and strip markdown fences
    const firstBlock = response.content[0]
    const raw = firstBlock.type === "text" ? firstBlock.text : ""
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/i, "")
      .trim()

    // 11. Parse JSON
    let analysis: unknown
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error("[street-view-analysis] JSON parse failed:", cleaned)
      return NextResponse.json(
        { error: "Failed to parse AI response", detail: cleaned },
        { status: 502 }
      )
    }

    // 12. Return result
    return NextResponse.json({ success: true, analysis })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[street-view-analysis] Unexpected error:", message)
    return NextResponse.json({ error: "Unexpected error", detail: message }, { status: 500 })
  }
}
