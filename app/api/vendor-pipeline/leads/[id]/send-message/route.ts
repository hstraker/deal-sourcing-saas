/**
 * Send Manual Message API
 * POST /api/vendor-pipeline/leads/[id]/send-message
 * Allows admins/sourcers to send manual SMS messages to vendors
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { getTwilioService } from "@/lib/vendor-pipeline/twilio-mock"
import { z } from "zod"

const sendMessageSchema = z.object({
  message: z.string().min(1).max(4096), // WhatsApp allows longer messages
  channel: z.enum(["sms", "whatsapp"]).optional(),
})

// POST /api/vendor-pipeline/leads/[id]/send-message
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

    const body = await request.json()
    const { message, channel: rawChannel } = sendMessageSchema.parse(body)

    // Get the vendor lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
    })

    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Use requested channel, fall back to lead's preferredChannel, then sms
    const channel = rawChannel ?? ((lead as any).preferredChannel ?? "sms") as "sms" | "whatsapp"

    // Send via Twilio service on the right channel
    const twilioService = getTwilioService()
    const result = await twilioService.sendMessage(lead.vendorPhone, message, channel)

    // If Twilio returned an error, surface it clearly rather than silently failing
    if (result.error) {
      const label = channel === "whatsapp" ? "WhatsApp" : "SMS"
      console.error(`[send-message] Twilio ${label} send failed:`, result.error)
      return NextResponse.json(
        { error: `${label} delivery failed: ${result.error}` },
        { status: 400 }
      )
    }

    const fromNumber = channel === "whatsapp"
      ? (process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER || undefined)
      : (process.env.TWILIO_PHONE_NUMBER || undefined)

    // Save message to database
    const smsMessage = await prisma.sMSMessage.create({
      data: {
        vendorLeadId: lead.id,
        direction: "outbound" as any,
        messageSid: result.messageSid || undefined,
        fromNumber,
        toNumber: lead.vendorPhone,
        messageBody: message,
        aiGenerated: false,
        status: result.status,
        channel,
      },
    })

    // Update lead's last contact time
    await prisma.vendorLead.update({
      where: { id: lead.id },
      data: {
        lastContactAt: new Date(),
      },
    })

    // Log pipeline event
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: lead.id,
        eventType: "manual_message_sent",
        details: {
          messageId: smsMessage.id,
          sentBy: session.user.id,
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: smsMessage,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error sending manual message:", error)
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    )
  }
}

