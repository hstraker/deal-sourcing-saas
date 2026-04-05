/**
 * POST /api/vendor-pipeline/leads/[id]/start-conversation
 *
 * Manually triggers the AI initial SMS for a vendor lead.
 * Used from the Outreach tab when auto-start was off or failed silently.
 * Normalises phone to E.164 before sending so UK numbers like 07xxx work.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"

/** Convert common UK phone formats → E.164 (+44...) */
function normaliseToE164(phone: string): string {
  // Strip spaces, dashes, parentheses
  const cleaned = phone.replace(/[\s\-\(\)]/g, "")

  // 07xxxxxxxxx → +447xxxxxxxxx
  if (/^07\d{9}$/.test(cleaned)) return "+44" + cleaned.slice(1)

  // 447xxxxxxxxx → +447xxxxxxxxx
  if (/^447\d{9}$/.test(cleaned)) return "+" + cleaned

  // Already E.164
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned

  // Return as-is — let Twilio surface the error with a clear message
  return cleaned
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      include: { smsMessages: { take: 1 } },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Prevent double-sending if a conversation is already in progress
    if (lead.smsMessages.length > 0) {
      return NextResponse.json(
        { error: "Conversation already started — messages exist for this lead" },
        { status: 409 }
      )
    }

    // Validate phone exists
    if (!lead.vendorPhone) {
      return NextResponse.json(
        { error: "Lead has no phone number — add one before starting AI conversation" },
        { status: 422 }
      )
    }

    // Normalise phone to E.164 and patch the lead if it changed
    const normalisedPhone = normaliseToE164(lead.vendorPhone)
    if (normalisedPhone !== lead.vendorPhone) {
      await prisma.vendorLead.update({
        where: { id: lead.id },
        data: { vendorPhone: normalisedPhone },
      })
      console.log(`[start-conversation] Normalised phone ${lead.vendorPhone} → ${normalisedPhone}`)
    }

    // Read requested channel (default to lead's preferredChannel, then "sms")
    let body: any = {}
    try { body = await request.json() } catch {}
    const channel: "sms" | "whatsapp" = body.channel === "whatsapp" ? "whatsapp" : "sms"

    // Send initial AI message — errors are surfaced, not swallowed
    await aiSMSAgent.sendInitialMessage(lead.id, channel)

    const channelLabel = channel === "whatsapp" ? "WhatsApp" : "SMS"
    return NextResponse.json({
      success: true,
      message: `AI conversation started — initial ${channelLabel} sent`,
      phone: normalisedPhone,
      channel,
    })
  } catch (error: any) {
    console.error("[start-conversation] Failed:", error)
    return NextResponse.json(
      {
        error: error.message || "Failed to start AI conversation",
        details: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    )
  }
}
