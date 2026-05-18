import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { fetchS3ObjectAsBase64 } from "@/lib/s3"
import Anthropic from "@anthropic-ai/sdk"

// POST /api/vendor-leads/[id]/floorplan/analyse
// body: { photoId: string }
// → { success, analysis } | { error }

const FLOORPLAN_PROMPT = `You are analysing a property floorplan image. Extract the following information and respond ONLY with valid JSON matching this schema exactly:
{
  "totalSqFt": number | null,
  "totalSqM": number | null,
  "bedrooms": number | null,
  "bathrooms": number | null,
  "receptions": number | null,
  "layoutType": "open_plan" | "traditional" | "mixed" | null,
  "hasGarage": boolean,
  "hasGarden": boolean,
  "hasExtensionPotential": boolean,
  "hasLoftPotential": boolean,
  "storeys": number | null,
  "notes": string | null
}
If you cannot determine a value, use null. Do not add any text outside the JSON object.`

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const lead = await prisma.vendorLead.findUnique({ where: { id: params.id }, select: { id: true } })
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

  const { photoId } = (await request.json()) as { photoId: string }
  if (!photoId) return NextResponse.json({ error: "Missing photoId" }, { status: 400 })

  const photo = await prisma.propertyPhoto.findUnique({ where: { id: photoId } })
  if (!photo || photo.vendorLeadId !== lead.id || photo.source !== "floorplan_upload") {
    return NextResponse.json({ error: "Floorplan not found" }, { status: 404 })
  }

  // PDFs cannot be vision-analysed — tell the caller clearly
  if (photo.mimeType === "application/pdf") {
    return NextResponse.json(
      { error: "PDF floorplans cannot be AI-analysed — convert to image first" },
      { status: 422 }
    )
  }

  try {
    const { base64, contentType } = await fetchS3ObjectAsBase64(photo.s3Key)

    const anthropicKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not configured")
    const client = new Anthropic({ apiKey: anthropicKey })

    const response = await client.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-opus-4-5",
      max_tokens: 512,
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
            { type: "text", text: FLOORPLAN_PROMPT },
          ],
        },
      ],
    })

    const raw = response.content.find((c) => c.type === "text")?.text ?? ""
    // Strip markdown code fences if present
    const text = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim()

    let analysis: Record<string, unknown>
    try {
      analysis = JSON.parse(text)
    } catch {
      console.error("[floorplan analyse] Failed to parse AI response:", raw)
      return NextResponse.json({ error: "AI returned invalid JSON", raw }, { status: 502 })
    }

    await prisma.propertyPhoto.update({
      where: { id: photoId },
      data: {
        aiDescription: JSON.stringify(analysis),
        aiAnalysedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true, analysis })
  } catch (err: unknown) {
    console.error("[floorplan analyse]", err)
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: "Analysis failed", detail: message }, { status: 500 })
  }
}
