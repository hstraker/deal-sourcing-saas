/**
 * POST /api/vendor-pipeline/leads/[id]/negotiation-coach
 *
 * Generates a full AI negotiation coaching playbook for a vendor lead using
 * the frameworks of Chris Voss, Oren Klaff, Roger Dawson, and UK property
 * sourcing professionals (Samuel Leeds, Rob Moore).
 *
 * Body (mode: "playbook"):
 *   {
 *     mode: "playbook"
 *     strategy: "flip" | "hold" | "both"
 *     ceiling: number
 *     rungs: NegotiationRung[]
 *     refurbCost?: number | null
 *     gdv?: number | null
 *     monthlyRent?: number | null
 *     grossYield?: number | null
 *   }
 *
 * Body (mode: "copilot"):
 *   {
 *     mode: "copilot"
 *     vendorMessage: string
 *     currentRound: number
 *     rungs: NegotiationRung[]
 *     ceiling: number
 *     vendorMotivation: string
 *   }
 *
 * Returns: CoachOutput (mode: "playbook") | CopilotResponse (mode: "copilot")
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Anthropic from "@anthropic-ai/sdk"
import {
  buildCoachSystemPrompt,
  buildCoachUserPrompt,
  buildCopilotPrompt,
  type CoachOutput,
  type CopilotResponse,
} from "@/lib/vendor-pipeline/negotiation-coach"
import type { NegotiationRung } from "@/lib/offer-engine/negotiation-ladder"

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Strip JSON code fences if Claude wraps the output in markdown */
function extractJson(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim()
}

// ─── route ────────────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // ── Auth ─────────────────────────────────────────────────────────────────
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const mode = (body.mode ?? "playbook") as "playbook" | "copilot"

    // ── Fetch lead ────────────────────────────────────────────────────────────
    const forceRegenerate = body.force === true

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        propertyAddress: true,
        propertyType: true,
        bedrooms: true,
        askingPrice: true,
        vendorName: true,
        motivationScore: true,
        urgencyLevel: true,
        reasonForSelling: true,
        timelineDays: true,
        competingOffers: true,
        negotiationCoach: true,
        negotiationCoachAt: true,
        smsMessages: {
          orderBy: { createdAt: "asc" },
          take: 12,
          select: {
            direction: true,
            messageBody: true,
            createdAt: true,
          },
        },
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // ── Return cached coach if available (and not forcing regeneration) ────────
    if (mode === "playbook" && !forceRegenerate && lead.negotiationCoach) {
      return NextResponse.json(lead.negotiationCoach)
    }

    const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : 0

    // ── Build conversation snippet from last SMS messages ─────────────────────
    const conversationSnippet = lead.smsMessages
      .map((m) => {
        const who = m.direction === "outbound" ? "Sourcer" : "Vendor"
        return `${who}: ${m.messageBody}`
      })
      .join("\n")

    // ── Handle copilot mode ───────────────────────────────────────────────────
    if (mode === "copilot") {
      const { vendorMessage, currentRound, rungs, ceiling, vendorMotivation } = body as {
        vendorMessage: string
        currentRound: number
        rungs: NegotiationRung[]
        ceiling: number
        vendorMotivation: string
      }

      if (!vendorMessage) {
        return NextResponse.json({ error: "vendorMessage is required" }, { status: 400 })
      }

      const copilotPrompt = buildCopilotPrompt(
        vendorMessage,
        currentRound,
        rungs,
        ceiling,
        vendorMotivation,
      )

      const response = await client.messages.create({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
        max_tokens: 1024,
        messages: [{ role: "user", content: copilotPrompt }],
      })

      const rawText = response.content[0].type === "text" ? response.content[0].text.trim() : ""

      let parsed: CopilotResponse
      try {
        parsed = JSON.parse(extractJson(rawText))
      } catch {
        return NextResponse.json(
          { error: "Claude returned malformed JSON for copilot response", raw: rawText },
          { status: 502 }
        )
      }

      return NextResponse.json(parsed)
    }

    // ── Handle playbook mode ──────────────────────────────────────────────────
    const { strategy, ceiling, rungs, refurbCost, gdv, monthlyRent, grossYield } = body as {
      strategy: "flip" | "hold" | "both"
      ceiling: number
      rungs: NegotiationRung[]
      refurbCost?: number | null
      gdv?: number | null
      monthlyRent?: number | null
      grossYield?: number | null
    }

    if (!strategy || !ceiling || !rungs?.length) {
      return NextResponse.json(
        { error: "strategy, ceiling, and rungs are required" },
        { status: 400 }
      )
    }

    const userPrompt = buildCoachUserPrompt({
      // Property
      propertyAddress: lead.propertyAddress ?? `Lead ${params.id}`,
      propertyType: lead.propertyType,
      bedrooms: lead.bedrooms,
      askingPrice,
      // Offer engine
      strategy,
      ceiling,
      rungs,
      refurbCost: refurbCost ?? null,
      gdv: gdv ?? null,
      monthlyRent: monthlyRent ?? null,
      grossYield: grossYield ?? null,
      // Vendor
      vendorName: lead.vendorName ?? "the vendor",
      motivationScore: lead.motivationScore ? Number(lead.motivationScore) : null,
      urgencyLevel: lead.urgencyLevel,
      reasonForSelling: lead.reasonForSelling,
      timelineDays: lead.timelineDays,
      competingOffers: lead.competingOffers ?? false,
      // Conversation
      conversationSnippet,
    })

    // ── Stream the response back so the client sees life immediately ──────────
    // We pipe Claude's token stream directly to the HTTP response.
    // The client accumulates the chunks and parses JSON when the stream closes.
    const anthropicStream = await client.messages.stream({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
      max_tokens: 8192,
      system: buildCoachSystemPrompt(),
      messages: [{ role: "user", content: userPrompt }],
    })

    const leadId = params.id
    const readable = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder()
        let fullText = ""
        try {
          for await (const event of anthropicStream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(enc.encode(event.delta.text))
              fullText += event.delta.text
            }
          }
          // Persist the coach output to DB so future visits load instantly
          try {
            const clean = fullText
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```$/, "")
              .trim()
            const parsed: CoachOutput = JSON.parse(clean)
            await prisma.vendorLead.update({
              where: { id: leadId },
              data: {
                negotiationCoach:   parsed,
                negotiationCoachAt: new Date(),
              },
            })
          } catch {
            // Non-fatal — the client still received the full stream
            console.error("[negotiation-coach] Failed to persist coach output")
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error: any) {
    console.error("[negotiation-coach] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate negotiation coach playbook" },
      { status: 500 }
    )
  }
}
