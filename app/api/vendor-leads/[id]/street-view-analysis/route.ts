import { NextRequest, NextResponse } from "next/server"
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

const VALID_MEDIA_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type ValidMediaType = typeof VALID_MEDIA_TYPES[number]

function toValidMediaType(ct: string): ValidMediaType {
  const stripped = ct.split(";")[0].trim()
  return (VALID_MEDIA_TYPES as readonly string[]).includes(stripped)
    ? (stripped as ValidMediaType)
    : "image/jpeg"
}

// ─── route ───────────────────────────────────────────────────────────────────

export async function POST(
  req: NextRequest,
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

    // 3. Anthropic key
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) {
      return NextResponse.json({ error: "Anthropic API key not configured" }, { status: 500 })
    }

    // ── 4. Obtain the image as base64 ────────────────────────────────────────
    //
    // Strategy A (preferred): the client fetches the Street View Static image
    // itself (browser sends correct Referer, satisfying API key restrictions)
    // and POSTs the base64 here. We use that directly.
    //
    // Strategy B (fallback): the client couldn't fetch the image (CORS etc.),
    // so we fetch it server-side. This only works when the API key has NO
    // HTTP referrer restrictions (or a GOOGLE_MAPS_API_KEY env var with IP
    // restrictions is set separately).

    let imageBase64: string
    let mediaType: ValidMediaType

    // Check for client-provided base64 in the request body
    let body: { imageBase64?: string; contentType?: string } = {}
    try {
      body = await req.json()
    } catch {
      // empty body is fine — fall through to server-side fetch
    }

    if (body.imageBase64 && body.imageBase64.length > 100) {
      // Strategy A — use what the client sent
      imageBase64 = body.imageBase64
      mediaType = toValidMediaType(body.contentType ?? "image/jpeg")
    } else {
      // Strategy B — server-side fetch
      const location = lead.propertyAddress ?? lead.propertyPostcode ?? ""
      if (!location) {
        return NextResponse.json({ error: "No address or postcode on this lead" }, { status: 400 })
      }

      const googleApiKey =
        process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
      if (!googleApiKey) {
        return NextResponse.json({ error: "Google Maps API key not configured" }, { status: 500 })
      }

      const streetViewUrl =
        `https://maps.googleapis.com/maps/api/streetview` +
        `?size=800x450` +
        `&location=${encodeURIComponent(location)}` +
        `&fov=90&heading=235&pitch=0` +
        `&key=${googleApiKey}`

      // Inject Referer so HTTP-referrer-restricted keys accept server requests
      const appUrl =
        process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
      const imageRes = await fetch(streetViewUrl, { headers: { Referer: appUrl } })

      if (!imageRes.ok) {
        return NextResponse.json(
          { error: `Street View fetch failed (HTTP ${imageRes.status})` },
          { status: 502 }
        )
      }

      const ct = (imageRes.headers.get("content-type") ?? "").split(";")[0].trim()
      if (!ct.startsWith("image/")) {
        const snippet = (await imageRes.text()).slice(0, 200)
        console.error("[street-view-analysis] Non-image response from Google:", ct, snippet)
        return NextResponse.json(
          {
            error:
              "Street View Static API returned an error page instead of an image. " +
              "Your API key likely has HTTP referrer restrictions that block server-side requests. " +
              "Either remove referrer restrictions (use IP restrictions instead) or create a separate GOOGLE_MAPS_API_KEY env var with no restrictions.",
          },
          { status: 502 }
        )
      }

      imageBase64 = Buffer.from(await imageRes.arrayBuffer()).toString("base64")
      mediaType = toValidMediaType(ct)
    }

    // 5. Call Claude Vision
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
              source: { type: "base64", media_type: mediaType, data: imageBase64 },
            },
            { type: "text", text: STREET_VIEW_PROMPT },
          ],
        },
      ],
    })

    // 6. Parse response
    const raw = response.content[0].type === "text" ? response.content[0].text : ""
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()

    let analysis: unknown
    try {
      analysis = JSON.parse(cleaned)
    } catch {
      console.error("[street-view-analysis] JSON parse failed:", cleaned)
      return NextResponse.json({ error: "AI returned invalid JSON", detail: cleaned }, { status: 502 })
    }

    // Persist the analysis to the lead record so any sourcer sees it on next open
    await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        streetViewAnalysis: analysis as Record<string, unknown>,
        streetViewAnalysedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, analysis, analysedAt: new Date().toISOString() })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[street-view-analysis] Unexpected error:", message)
    return NextResponse.json({ error: "Unexpected error", detail: message }, { status: 500 })
  }
}
