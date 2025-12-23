/**
 * Create Test Vendor Lead
 * Creates a new vendor lead and optionally starts AI conversation
 * 
 * Usage:
 *   npx tsx scripts/create-test-lead.ts
 *   npx tsx scripts/create-test-lead.ts --start-conversation
 */

import { prisma } from "../lib/db"
import { aiSMSAgent } from "../lib/vendor-pipeline/ai-sms-agent"

async function createTestLead() {
  const startConversation = process.argv.includes("--start-conversation")

  try {
    console.log("🧪 Creating test vendor lead...")

    // Create a test vendor lead
    const lead = await prisma.vendorLead.create({
      data: {
        vendorName: "Jane Smith",
        vendorPhone: "+447700900456",
        vendorEmail: "jane.smith@example.com",
        propertyAddress: "45 Oak Street, Manchester",
        propertyPostcode: "M1 1AA",
        askingPrice: 275000,
        propertyType: "semi-detached",
        bedrooms: 4,
        bathrooms: 2,
        pipelineStage: "NEW_LEAD" as any,
      },
    })

    console.log("✅ Test lead created!")
    console.log(`   ID: ${lead.id}`)
    console.log(`   Name: ${lead.vendorName}`)
    console.log(`   Phone: ${lead.vendorPhone}`)
    console.log(`   Property: ${lead.propertyAddress}`)
    console.log(`   Stage: ${lead.pipelineStage}`)

    if (startConversation) {
      console.log("\n🤖 Starting AI conversation...")
      
      try {
        await aiSMSAgent.sendInitialMessage(lead.id)
        console.log("✅ Initial AI message sent!")
        console.log("\n📱 View in dashboard:")
        console.log(`   http://localhost:3000/dashboard/vendors/pipeline`)
        console.log(`\n   Click on the lead card to see the conversation.`)
      } catch (error: any) {
        console.error("❌ Error starting conversation:", error.message)
        console.log("\n💡 Lead was created but conversation not started.")
        console.log("   You can manually trigger it from the dashboard or run:")
        console.log(`   npx tsx scripts/test-ai-conversation.ts`)
      }
    } else {
      console.log("\n💡 To start AI conversation:")
      console.log(`   npx tsx scripts/create-test-lead.ts --start-conversation`)
      console.log(`\n   Or view in dashboard and the service will process it automatically:`)
      console.log(`   http://localhost:3000/dashboard/vendors/pipeline`)
    }

    console.log(`\n🔗 View in dashboard:`)
    console.log(`   http://localhost:3000/dashboard/vendors/pipeline`)

  } catch (error: any) {
    console.error("❌ Error creating test lead:", error.message)
    if (error.code === "P2002") {
      console.error("   A lead with this phone number already exists")
      console.error("   Try using a different phone number or delete the existing lead")
    }
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createTestLead()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

