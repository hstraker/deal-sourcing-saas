/**
 * API Route: POST /api/facebook-leads/webhook
 * Webhook endpoint for Facebook Lead Ads
 *
 * Receives lead submissions from:
 * 1. Real Facebook Lead Ads (when connected)
 * 2. Facebook Ad Simulator (for testing)
 *
 * Creates vendor lead and triggers AI SMS conversation
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { PipelineStage } from "@prisma/client"

// Facebook Lead Ad field mapping
interface FacebookLeadData {
  leadgen_id: string
  created_time: string
  field_data: Array<{
    name: string
    values: string[]
  }>
}

// Helper to extract field value from Facebook Lead Ad data
function getFieldValue(fieldData: FacebookLeadData["field_data"], fieldName: string): string | undefined {
  const field = fieldData.find(f => f.name === fieldName)
  return field?.values?.[0] || undefined
}

// Map urgency to our enum
function mapUrgency(urgency?: string): "urgent" | "quick" | "moderate" | "flexible" {
  if (!urgency) return "flexible"

  const normalized = urgency.toLowerCase()
  if (normalized.includes("urgent") || normalized.includes("week")) return "urgent"
  if (normalized.includes("soon") || normalized.includes("month")) return "quick"
  return "flexible"
}

export async function POST(request: NextRequest) {
  try {
    console.log("📩 [Facebook Webhook] Received lead submission")

    const body = await request.json()
    const leadData: FacebookLeadData = body

    // Extract field values
    const fullName = getFieldValue(leadData.field_data, "full_name")
    const phoneNumber = getFieldValue(leadData.field_data, "phone_number")
    const propertyAddress = getFieldValue(leadData.field_data, "property_address")
    const propertyPostcode = getFieldValue(leadData.field_data, "property_postcode")
    const email = getFieldValue(leadData.field_data, "email")
    const urgency = getFieldValue(leadData.field_data, "urgency")
    const sellingReason = getFieldValue(leadData.field_data, "selling_reason")

    console.log("📋 [Facebook Webhook] Extracted data:", {
      fullName,
      phoneNumber,
      propertyAddress,
      propertyPostcode,
      urgency
    })

    // Validate required fields
    if (!fullName || !phoneNumber || !propertyAddress) {
      console.error("❌ [Facebook Webhook] Missing required fields")
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields: full_name, phone_number, property_address"
        },
        { status: 400 }
      )
    }

    // Check for duplicate lead (by Facebook lead ID or phone number)
    const existingLead = await prisma.vendorLead.findFirst({
      where: {
        OR: [
          { facebookLeadId: leadData.leadgen_id },
          { vendorPhone: phoneNumber }
        ]
      }
    })

    if (existingLead) {
      console.log("⚠️ [Facebook Webhook] Duplicate lead detected:", existingLead.id)
      return NextResponse.json(
        {
          success: false,
          message: "Lead already exists",
          leadId: existingLead.id
        },
        { status: 409 }
      )
    }

    // Create vendor lead
    const lead = await prisma.vendorLead.create({
      data: {
        // Facebook Lead Ad info
        facebookLeadId: leadData.leadgen_id,
        leadSource: "facebook_ads",
        campaignId: body.campaign_id || null,

        // Vendor information
        vendorName: fullName,
        vendorPhone: phoneNumber,
        vendorEmail: email || null,

        // Property details
        propertyAddress: propertyAddress,
        propertyPostcode: propertyPostcode || null,

        // Workflow status
        pipelineStage: "NEW_LEAD" as PipelineStage,
        urgencyLevel: mapUrgency(urgency),

        // Additional metadata
        conversationState: {
          source: "facebook_lead_ad",
          urgency: urgency || "not_specified",
          sellingReason: sellingReason || "not_specified",
          submittedAt: leadData.created_time || new Date().toISOString()
        }
      }
    })

    console.log("✅ [Facebook Webhook] Created vendor lead:", lead.id)

    // Trigger AI SMS conversation
    try {
      console.log("🤖 [Facebook Webhook] Starting AI SMS conversation...")
      await aiSMSAgent.sendInitialMessage(lead.id)
      console.log("✅ [Facebook Webhook] Initial AI message sent")
    } catch (error: any) {
      // Log error but don't fail the webhook
      // The lead is created, AI conversation can be retried
      console.error("⚠️ [Facebook Webhook] Failed to send initial AI message:", error.message)
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: "Lead received and added to pipeline",
      leadId: lead.id,
      leadUrl: `/dashboard/vendors/pipeline?leadId=${lead.id}`,
      pipelineStage: lead.pipelineStage
    })

  } catch (error: any) {
    console.error("❌ [Facebook Webhook] Error processing lead:", error)
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to process lead",
        error: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

// GET endpoint for Facebook webhook verification (required by Facebook)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Facebook sends these parameters during webhook setup
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  console.log("🔍 [Facebook Webhook] Verification request:", { mode, token })

  // Verify token matches your configured token
  const VERIFY_TOKEN = process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN || "your_verify_token_here"

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ [Facebook Webhook] Verification successful")
    // Respond with challenge to complete verification
    return new NextResponse(challenge, { status: 200 })
  }

  console.log("❌ [Facebook Webhook] Verification failed")
  return NextResponse.json({ error: "Verification failed" }, { status: 403 })
}
