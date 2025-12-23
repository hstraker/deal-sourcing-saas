/**
 * Test Script: Simulate AI SMS Conversation
 * 
 * This script creates a test vendor lead and simulates a conversation
 * to test the AI SMS agent without needing Twilio or Facebook.
 * 
 * Usage:
 *   tsx scripts/test-ai-conversation.ts
 */

import { prisma } from "../lib/db"
import { aiSMSAgent } from "../lib/vendor-pipeline/ai-sms-agent"
import { PipelineStage } from "@prisma/client"

async function testAIConversation() {
  console.log("🧪 Testing AI SMS Conversation")
  console.log("==============================\n")

  try {
    // Create a test vendor lead
    console.log("1. Creating test vendor lead...")
    const lead = await prisma.vendorLead.create({
      data: {
        vendorName: "John Smith",
        vendorPhone: "+447700900123",
        vendorEmail: "john.smith@example.com",
        propertyAddress: "123 High Street, London",
        propertyPostcode: "SW1A 1AA",
        askingPrice: 250000,
        propertyType: "terraced",
        bedrooms: 3,
        pipelineStage: "NEW_LEAD" as PipelineStage,
      },
    })

    console.log(`✅ Created lead: ${lead.id}\n`)

    // Send initial message
    console.log("2. Sending initial AI message...")
    await aiSMSAgent.sendInitialMessage(lead.id)
    console.log("✅ Initial message sent\n")

    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Simulate vendor responses
    const conversationFlow = [
      "Hi, yes I'm interested. Need to sell quickly, moving for work.",
      "The property is in good condition, just needs some modernisation. Looking for around £250k.",
      "We need to move in about 3 weeks if possible. No chain on our side.",
      "Haven't had any other offers yet, just listed it.",
    ]

    console.log("3. Simulating vendor responses...")
    for (let i = 0; i < conversationFlow.length; i++) {
      const message = conversationFlow[i]
      console.log(`\n--- Vendor message ${i + 1} ---`)
      console.log(`Vendor: ${message}`)

      await aiSMSAgent.processInboundMessage(lead.id, message, lead.vendorPhone)

      // Wait between messages
      await new Promise(resolve => setTimeout(resolve, 2000))

      // Check if conversation is complete
      const updatedLead = await prisma.vendorLead.findUnique({
        where: { id: lead.id },
      })

      if (updatedLead?.pipelineStage === "DEAL_VALIDATION") {
        console.log("\n✅ Conversation complete! Moved to DEAL_VALIDATION stage")
        break
      }
    }

    // Get final state
    console.log("\n4. Final lead state:")
    const finalLead = await prisma.vendorLead.findUnique({
      where: { id: lead.id },
      include: {
        smsMessages: {
          orderBy: { createdAt: "asc" },
        },
      },
    })

    console.log(`   Stage: ${finalLead?.pipelineStage}`)
    console.log(`   Motivation Score: ${finalLead?.motivationScore || "N/A"}`)
    console.log(`   Messages: ${finalLead?.smsMessages.length || 0}`)
    console.log(`   Property Address: ${finalLead?.propertyAddress}`)
    console.log(`   Asking Price: £${finalLead?.askingPrice?.toLocaleString()}`)
    console.log(`   Urgency Level: ${finalLead?.urgencyLevel || "N/A"}`)

    console.log("\n5. Conversation History:")
    finalLead?.smsMessages.forEach((msg, idx) => {
      const direction = msg.direction === "inbound" ? "Vendor" : "AI"
      const preview = msg.messageBody.substring(0, 80)
      console.log(`   ${idx + 1}. [${direction}] ${preview}${msg.messageBody.length > 80 ? "..." : ""}`)
    })

    console.log("\n✅ Test completed successfully!")
    console.log(`\nTo clean up, delete the test lead:`)
    console.log(`  DELETE FROM vendor_leads WHERE id = '${lead.id}';`)

  } catch (error: any) {
    console.error("\n❌ Error:", error)
    console.error(error.stack)
    process.exit(1)
  }
}

// Run the test
testAIConversation()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })

