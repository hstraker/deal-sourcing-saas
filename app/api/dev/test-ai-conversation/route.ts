/**
 * API Route: POST /api/dev/test-ai-conversation
 * Execute AI conversation test with custom parameters
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { PipelineStage } from "@prisma/client"

export async function POST(request: NextRequest) {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized - Admin only" }, { status: 401 })
    }

    const body = await request.json()
    const {
      vendorName = "Test Vendor",
      vendorPhone = "+447700900123",
      vendorEmail = "test@example.com",
      propertyAddress = "123 High Street, London",
      propertyPostcode = "SW1A 1AA",
      askingPrice = 250000,
      propertyType = "terraced",
      bedrooms = 3,
      conversationMessages = [
        "Hi, yes I'm interested. Need to sell quickly, moving for work.",
        "The property is in good condition, just needs some modernisation.",
        "We need to move in about 3 weeks if possible. No chain on our side.",
      ]
    } = body

    console.log("🧪 [Dev Mode] Starting AI Conversation Test")
    console.log("=========================================")

    const logs: string[] = []
    const addLog = (message: string) => {
      console.log(message)
      logs.push(message)
    }

    // 1. Create test vendor lead
    addLog("\n1. Creating test vendor lead...")
    const lead = await prisma.vendorLead.create({
      data: {
        vendorName,
        vendorPhone,
        vendorEmail,
        propertyAddress,
        propertyPostcode,
        askingPrice,
        propertyType,
        bedrooms,
        pipelineStage: "NEW_LEAD" as PipelineStage,
      },
    })
    addLog(`✅ Created lead: ${lead.id}`)
    addLog(`   Name: ${vendorName}`)
    addLog(`   Property: ${propertyAddress}, ${propertyPostcode}`)

    // 2. Send initial AI message
    addLog("\n2. Sending initial AI message...")
    try {
      await aiSMSAgent.sendInitialMessage(lead.id)
      addLog("✅ Initial message sent")
    } catch (error: any) {
      addLog(`⚠️ Initial message error: ${error.message}`)
    }

    await new Promise(resolve => setTimeout(resolve, 1000))

    // 3. Simulate vendor responses
    addLog("\n3. Simulating vendor conversation...")
    const messages: Array<{ from: string; message: string; timestamp: string }> = []

    for (let i = 0; i < conversationMessages.length; i++) {
      const message = conversationMessages[i]
      addLog(`\n--- Message ${i + 1} ---`)
      addLog(`Vendor: ${message}`)

      try {
        // Process the message (AI response is saved to DB, not returned)
        await aiSMSAgent.processInboundMessage(
          lead.id,
          message,
          vendorPhone
        )

        messages.push({
          from: "vendor",
          message,
          timestamp: new Date().toISOString()
        })

        addLog(`✅ Message processed by AI`)
      } catch (error: any) {
        addLog(`❌ Error processing message: ${error.message}`)
      }

      await new Promise(resolve => setTimeout(resolve, 1500))

      // Check pipeline stage
      const updatedLead = await prisma.vendorLead.findUnique({
        where: { id: lead.id },
      })

      if (updatedLead) {
        addLog(`   Pipeline stage: ${updatedLead.pipelineStage}`)

        if (updatedLead.pipelineStage === "DEAL_VALIDATION") {
          addLog("\n✅ Conversation complete! Moved to DEAL_VALIDATION")
          break
        }
      }
    }

    // 4. Get final state
    addLog("\n4. Final lead state:")
    const finalLead = await prisma.vendorLead.findUnique({
      where: { id: lead.id },
      include: {
        smsMessages: {
          orderBy: { createdAt: "asc" },
          take: 20
        }
      }
    })

    if (finalLead) {
      addLog(`   Pipeline: ${finalLead.pipelineStage}`)
      addLog(`   Total messages: ${finalLead.smsMessages.length}`)
      addLog(`   Lead ID: ${finalLead.id}`)
    }

    addLog("\n✅ Test complete!")
    addLog(`\nView lead: /dashboard/vendors/pipeline?leadId=${lead.id}`)

    return NextResponse.json({
      success: true,
      leadId: lead.id,
      leadUrl: `/dashboard/vendors/pipeline?leadId=${lead.id}`,
      finalStage: finalLead?.pipelineStage,
      messageCount: finalLead?.smsMessages.length || 0,
      messages,
      logs
    })

  } catch (error: any) {
    console.error("[Dev Mode] Test error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}
