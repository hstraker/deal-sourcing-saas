/**
 * Twilio SMS + WhatsApp Webhook Handler
 * POST /api/vendor-pipeline/webhook/sms
 *
 * Single endpoint handles both SMS and WhatsApp inbound messages from Twilio.
 * WhatsApp messages have `To` / `From` prefixed with "whatsapp:", which we
 * detect automatically to set the correct channel for AI replies.
 *
 * Configure this URL in both your Twilio SMS and WhatsApp sender settings.
 */

import { NextRequest, NextResponse } from "next/server"
import { getTwilioService } from "@/lib/vendor-pipeline/twilio-mock"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { prisma } from "@/lib/db"

const TWIML_EMPTY = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

// POST /api/vendor-pipeline/webhook/sms
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const body: Record<string, string> = {}

    // Convert FormData to object
    for (const [key, value] of formData.entries()) {
      body[key] = value as string
    }

    // Validate Twilio signature (optional but recommended)
    const twilioService = getTwilioService()
    const signature = request.headers.get("x-twilio-signature")

    // Reconstruct the public-facing URL — request.url is often an internal/localhost URL
    // behind a reverse proxy, but Twilio signed with the real external URL.
    const forwardedProto = request.headers.get("x-forwarded-proto") || "https"
    const forwardedHost =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      new URL(process.env.NEXTAUTH_URL || process.env.APP_URL || request.url).host
    const webhookUrl = `${forwardedProto}://${forwardedHost}/api/vendor-pipeline/webhook/sms`

    console.log(`[Webhook] Validating signature against URL: ${webhookUrl}`)

    if (signature && process.env.TWILIO_AUTH_TOKEN && typeof twilioService.validateWebhookSignature === 'function') {
      const isValid = twilioService.validateWebhookSignature(webhookUrl, body, signature)
      if (!isValid) {
        console.warn(`[Webhook] Invalid Twilio signature. URL used: ${webhookUrl}`)
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
      }
    }

    // Parse inbound message — detects channel from whatsapp: prefix automatically
    const { messageSid, fromNumber, toNumber, messageBody, channel } =
      twilioService.parseInboundMessage(body)

    console.log(`[Webhook] Inbound ${channel.toUpperCase()} from ${fromNumber}: "${messageBody}"`)

    // Find vendor lead by phone number (strip any whatsapp: prefix already done in parseInboundMessage)
    const lead = await prisma.vendorLead.findFirst({
      where: { vendorPhone: fromNumber },
      orderBy: { createdAt: "desc" },
    })

    if (!lead) {
      console.warn(`[Webhook] No vendor lead found for phone: ${fromNumber}`)
      return new Response(TWIML_EMPTY, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      })
    }

    // Process inbound message with AI — reply on same channel
    await aiSMSAgent.processInboundMessage(lead.id, messageBody, fromNumber, channel)

    // Return TwiML response (empty — AI reply sent separately via API, not TwiML)
    return new Response(TWIML_EMPTY, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  } catch (error: any) {
    console.error("[Webhook] Error processing inbound message:", error)
    // Return 200 to Twilio to prevent retries on our errors
    return new Response(TWIML_EMPTY, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    })
  }
}
