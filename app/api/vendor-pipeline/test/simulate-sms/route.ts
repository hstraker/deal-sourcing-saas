/**
 * Test Endpoint: Simulate Inbound SMS
 * POST /api/vendor-pipeline/test/simulate-sms
 * 
 * Allows you to manually simulate receiving an SMS from a vendor
 * for testing AI conversations without Twilio
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { prisma } from "@/lib/db"
import { z } from "zod"

const simulateSMSSchema = z.object({
  vendorLeadId: z.string().uuid(),
  message: z.string().min(1),
  fromNumber: z.string().optional(), // Optional, will use lead's phone if not provided
})

// POST /api/vendor-pipeline/test/simulate-sms
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Allow in development even without proper auth
    if (process.env.NODE_ENV === "development" && !session) {
      console.warn("⚠️  Allowing test endpoint in development without auth")
    }

    const body = await request.json()
    const { vendorLeadId, message, fromNumber } = simulateSMSSchema.parse(body)

    // Get the lead to get phone number
    const lead = await prisma.vendorLead.findUnique({
      where: { id: vendorLeadId },
    })

    if (!lead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    const phoneNumber = fromNumber || lead.vendorPhone

    // Process the inbound message
    await aiSMSAgent.processInboundMessage(vendorLeadId, message, phoneNumber)

    return NextResponse.json({
      success: true,
      message: "SMS simulated and processed",
      vendorLeadId,
      sentMessage: message,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error simulating SMS:", error)
    return NextResponse.json(
      { error: "Failed to simulate SMS", details: error.message },
      { status: 500 }
    )
  }
}

