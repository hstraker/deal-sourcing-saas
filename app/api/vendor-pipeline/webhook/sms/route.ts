/**
 * Twilio SMS Webhook Handler
 * POST /api/vendor-pipeline/webhook/sms
 * Receives inbound SMS messages from Twilio
 */

import { NextRequest, NextResponse } from "next/server"
import { getTwilioService } from "@/lib/vendor-pipeline/twilio-mock"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { prisma } from "@/lib/db"

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
    const url = request.url

    if (signature && process.env.TWILIO_AUTH_TOKEN && typeof twilioService.validateWebhookSignature === 'function') {
      const isValid = twilioService.validateWebhookSignature(url, body, signature)
      if (!isValid) {
        console.warn("Invalid Twilio webhook signature")
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 })
      }
    }

    // Parse inbound message
    const { messageSid, fromNumber, toNumber, messageBody } =
      twilioService.parseInboundMessage(body)

    // Find vendor lead by phone number
    const lead = await prisma.vendorLead.findFirst({
      where: { vendorPhone: fromNumber },
      orderBy: { createdAt: "desc" },
    })

    if (!lead) {
      console.warn(`No vendor lead found for phone number: ${fromNumber}`)
      // Return 200 to Twilio even if we don't have a lead (prevents retries)
      return NextResponse.xml(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { status: 200 }
      )
    }

    // Process inbound message with AI
    await aiSMSAgent.processInboundMessage(lead.id, messageBody, fromNumber)

    // Return TwiML response (empty to not send auto-reply)
    return NextResponse.xml(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200 }
    )
  } catch (error: any) {
    console.error("Error processing SMS webhook:", error)
    // Return 200 to Twilio to prevent retries on our errors
    return NextResponse.xml(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200 }
    )
  }
}

