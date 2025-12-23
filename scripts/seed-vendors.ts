/**
 * Seed script to create sample vendor data
 * 
 * Usage: npx tsx scripts/seed-vendors.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const sampleVendors = [
  {
    firstName: "John",
    lastName: "Smith",
    email: "john.smith@example.com",
    phone: "+44 7711 123456",
    address: "123 Main Street, London",
    source: "facebook_ad",
    facebookAdId: "fb_ad_001",
    campaignId: "campaign_q1_2024",
    askingPrice: 150000,
    propertyAddress: "45 High Street, Manchester",
    reasonForSale: "Relocating for work",
    status: "contacted" as const,
    notes: "Initial contact via Facebook ad. Interested in quick sale.",
  },
  {
    firstName: "Sarah",
    lastName: "Johnson",
    email: "sarah.j@example.com",
    phone: "+44 7722 234567",
    address: "78 Oak Avenue, Birmingham",
    source: "facebook_ad",
    facebookAdId: "fb_ad_002",
    campaignId: "campaign_q1_2024",
    askingPrice: 125000,
    propertyAddress: "12 Elm Road, Birmingham",
    reasonForSale: "Downsizing after children moved out",
    status: "validated" as const,
    notes: "Property validated. Good BMV opportunity.",
    qualifiedAt: new Date(),
  },
  {
    firstName: "Michael",
    lastName: "Brown",
    email: "m.brown@example.com",
    phone: "+44 7733 345678",
    address: "9 Park Lane, Leeds",
    source: "facebook_ad",
    facebookAdId: "fb_ad_003",
    campaignId: "campaign_q1_2024",
    askingPrice: 180000,
    propertyAddress: "67 Victoria Street, Leeds",
    reasonForSale: "Inherited property, needs quick sale",
    status: "offer_made" as const,
    notes: "First offer made. Awaiting response.",
    qualifiedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    firstName: "Emma",
    lastName: "Wilson",
    email: "emma.wilson@example.com",
    phone: "+44 7744 456789",
    address: "34 Green Way, Liverpool",
    source: "facebook_ad",
    facebookAdId: "fb_ad_004",
    campaignId: "campaign_q1_2024",
    askingPrice: 140000,
    propertyAddress: "23 Castle Street, Liverpool",
    reasonForSale: "Divorce settlement",
    status: "negotiating" as const,
    notes: "Vendor requested more information. Sent video tour.",
    qualifiedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
  },
  {
    firstName: "David",
    lastName: "Taylor",
    email: "d.taylor@example.com",
    phone: "+44 7755 567890",
    address: "56 Mill Road, Sheffield",
    source: "referral",
    facebookAdId: null,
    campaignId: null,
    askingPrice: 165000,
    propertyAddress: "89 Church Lane, Sheffield",
    reasonForSale: "Moving to retirement home",
    status: "offer_accepted" as const,
    notes: "Vendor accepted offer. Proceeding to lock-out agreement.",
    qualifiedAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
  },
  {
    firstName: "Lisa",
    lastName: "Anderson",
    email: "lisa.a@example.com",
    phone: "+44 7766 678901",
    address: "12 Bridge Street, Newcastle",
    source: "facebook_ad",
    facebookAdId: "fb_ad_005",
    campaignId: "campaign_q1_2024",
    askingPrice: 135000,
    propertyAddress: "45 Market Street, Newcastle",
    reasonForSale: "Financial difficulties",
    status: "locked_out" as const,
    notes: "Lock-out agreement signed. Ready to create deal.",
    qualifiedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    lockedOutAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    solicitorName: "Smith & Partners",
    solicitorEmail: "legal@smithpartners.co.uk",
    solicitorPhone: "+44 191 123 4567",
  },
]

const sampleOffers = [
  { vendorIndex: 2, amount: 170000, status: "pending" as const },
  { vendorIndex: 3, amount: 130000, status: "more_info_sent" as const },
  { vendorIndex: 3, amount: 132000, status: "pending" as const },
  { vendorIndex: 4, amount: 160000, status: "accepted" as const, vendorDecision: "accepted" as const },
]

const sampleConversations = [
  {
    vendorIndex: 0,
    direction: "outbound" as const,
    message: "Hi John, we saw your property listing. We're cash buyers interested in quick completion. Would you like to discuss?",
    aiResponse: "Thank you for your interest. I am looking for a quick sale. What kind of offer are you thinking?",
    intent: "initial_contact",
    confidence: 95.5,
    provider: "twilio",
  },
  {
    vendorIndex: 0,
    direction: "inbound" as const,
    message: "What kind of offer are you thinking?",
    aiResponse: "Based on the property details, we can offer around £140,000-£145,000. Would you like to schedule a viewing?",
    intent: "price_inquiry",
    confidence: 92.3,
    provider: "twilio",
  },
  {
    vendorIndex: 3,
    direction: "outbound" as const,
    message: "Hi Emma, we've prepared a video tour of similar properties we've purchased. Would you like to see it?",
    aiResponse: "Yes, I'd like to see the video.",
    intent: "more_info_request",
    confidence: 88.7,
    videoSent: true,
    videoUrl: "https://example.com/videos/property-tour.mp4",
    provider: "twilio",
  },
]

async function main() {
  console.log("🌱 Seeding vendor data...")

  // Get admin user to use as offer creator
  const adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  })

  if (!adminUser) {
    console.error("❌ No admin user found. Please run seed-admin.ts first.")
    process.exit(1)
  }

  // Create vendors
  const createdVendors = []
  for (const vendorData of sampleVendors) {
    // Check if vendor already exists by phone
    const existing = await prisma.vendor.findFirst({
      where: { phone: vendorData.phone },
    })

    if (existing) {
      console.log(`⚠️  Vendor with phone ${vendorData.phone} already exists, skipping...`)
      createdVendors.push(existing)
      continue
    }

    const vendor = await prisma.vendor.create({
      data: vendorData,
    })

    console.log(`✅ Created vendor: ${vendor.firstName} ${vendor.lastName}`)
    createdVendors.push(vendor)
  }

  // Create offers
  console.log("\n📝 Creating offers...")
  for (const offerData of sampleOffers) {
    const vendor = createdVendors[offerData.vendorIndex]
    if (!vendor) continue

    const offer = await prisma.vendorOffer.create({
      data: {
        vendorId: vendor.id,
        offerAmount: offerData.amount,
        status: offerData.status,
        vendorDecision: offerData.vendorDecision || null,
        vendorDecisionDate: offerData.vendorDecision === "accepted" ? new Date() : null,
        createdById: adminUser.id,
      },
    })

    console.log(`✅ Created offer: £${offerData.amount} for ${vendor.firstName} ${vendor.lastName}`)

    // Update vendor status if offer accepted
    if (offerData.status === "accepted") {
      await prisma.vendor.update({
        where: { id: vendor.id },
        data: { status: "offer_accepted" },
      })
    }
  }

  // Create conversations
  console.log("\n💬 Creating conversations...")
  for (const convData of sampleConversations) {
    const vendor = createdVendors[convData.vendorIndex]
    if (!vendor) continue

    await prisma.vendorAIConversation.create({
      data: {
        vendorId: vendor.id,
        direction: convData.direction,
        message: convData.message,
        aiResponse: convData.aiResponse || null,
        intent: convData.intent || null,
        confidence: convData.confidence || null,
        videoSent: convData.videoSent || false,
        videoUrl: convData.videoUrl || null,
        provider: convData.provider || null,
      },
    })

    console.log(`✅ Created conversation for ${vendor.firstName} ${vendor.lastName}`)
  }

  // Update deal offer counts
  console.log("\n📊 Updating deal statistics...")
  const vendorsWithOffers = await prisma.vendor.findMany({
    include: {
      _count: {
        select: { offers: true },
      },
      offers: {
        orderBy: { offerDate: "desc" },
        take: 1,
      },
    },
  })

  for (const vendor of vendorsWithOffers) {
    if (vendor.dealId && vendor.offers.length > 0) {
      const latestOffer = vendor.offers[0]
      await prisma.deal.update({
        where: { id: vendor.dealId },
        data: {
          offerCount: vendor._count.offers,
          latestOfferAmount: latestOffer.offerAmount,
          latestOfferDate: latestOffer.offerDate,
        },
      })
    }
  }

  console.log("\n✅ Vendor seeding completed!")
  console.log(`   Created ${createdVendors.length} vendors`)
  console.log(`   Created ${sampleOffers.length} offers`)
  console.log(`   Created ${sampleConversations.length} conversations`)
}

main()
  .catch((e) => {
    console.error("❌ Error seeding vendors:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

