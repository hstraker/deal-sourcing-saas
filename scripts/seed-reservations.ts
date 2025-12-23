/**
 * Seed script for investor reservations
 * 
 * This script creates sample investor reservations for testing Phase 2 functionality.
 * Run with: npx tsx scripts/seed-reservations.ts
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Seeding investor reservations...")

  // Get or create an admin user for creating deals
  let adminUser = await prisma.user.findFirst({
    where: { role: "admin" },
  })

  if (!adminUser) {
    console.log("⚠️  No admin user found. Creating a sample admin user...")
    const passwordHash = await bcrypt.hash("Admin123!", 10)
    adminUser = await prisma.user.create({
      data: {
        email: "admin@example.com",
        firstName: "Admin",
        lastName: "User",
        passwordHash,
        role: "admin",
        isActive: true,
      },
    })
    console.log("✅ Created admin user:", adminUser.email)
  }

  // Get existing deals or create sample ones
  let deals = await prisma.deal.findMany({
    take: 5, // Use first 5 deals
  })

  if (deals.length === 0) {
    console.log("⚠️  No deals found. Creating sample deals...")
    const sampleAddresses = [
      "123 High Street, London",
      "45 Oak Avenue, Manchester",
      "78 Elm Road, Birmingham",
      "12 Park Lane, Leeds",
      "34 Church Street, Bristol",
    ]

    for (const address of sampleAddresses) {
      const deal = await prisma.deal.create({
        data: {
          address,
          postcode: "SW1A 1AA",
          propertyType: "terraced",
          bedrooms: 3,
          bathrooms: 2,
          askingPrice: Math.floor(Math.random() * 200000) + 150000, // £150k-£350k
          marketValue: Math.floor(Math.random() * 250000) + 200000, // £200k-£450k
          status: "listed",
          createdById: adminUser.id,
          statusHistory: [
            {
              status: "listed",
              changedAt: new Date().toISOString(),
              changedBy: adminUser.id,
              note: "Deal created",
            },
          ],
        },
      })
      deals.push(deal)
    }
    console.log(`✅ Created ${deals.length} sample deals`)
  }

  // Get existing investors or create sample ones
  let investors = await prisma.investor.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
    take: 10, // Use first 10 investors
  })

  if (investors.length === 0) {
    console.log("⚠️  No investors found. Creating sample investors...")
    const sampleInvestors = [
      { email: "investor1@example.com", firstName: "John", lastName: "Smith" },
      { email: "investor2@example.com", firstName: "Sarah", lastName: "Johnson" },
      { email: "investor3@example.com", firstName: "Michael", lastName: "Brown" },
      { email: "investor4@example.com", firstName: "Emma", lastName: "Davis" },
      { email: "investor5@example.com", firstName: "David", lastName: "Wilson" },
    ]

    for (const investorData of sampleInvestors) {
      // Create user first
      const passwordHash = await bcrypt.hash("Password123!", 10)
      const user = await prisma.user.create({
        data: {
          email: investorData.email,
          firstName: investorData.firstName,
          lastName: investorData.lastName,
          passwordHash,
          role: "investor",
          isActive: true,
        },
      })

      // Create investor profile
      const investor = await prisma.investor.create({
        data: {
          userId: user.id,
          minBudget: 100000,
          maxBudget: 500000,
          strategy: ["BRRRR", "BTL"],
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      })
      investors.push(investor)
    }
    console.log(`✅ Created ${investors.length} sample investors`)
  }

  const statuses: Array<"pending" | "fee_pending" | "proof_of_funds_pending" | "verified" | "locked_out" | "completed" | "cancelled"> = [
    "pending",
    "fee_pending",
    "proof_of_funds_pending",
    "verified",
    "locked_out",
    "completed",
  ]

  let created = 0
  let skipped = 0

  // Create reservations for each deal
  for (const deal of deals) {
    // Create 2-4 reservations per deal
    const numReservations = Math.floor(Math.random() * 3) + 2

    for (let i = 0; i < numReservations && i < investors.length; i++) {
      const investor = investors[i]
      const status = statuses[Math.floor(Math.random() * statuses.length)]
      
      // Check if reservation already exists
      const existing = await prisma.investorReservation.findUnique({
        where: {
          investorId_dealId: {
            investorId: investor.id,
            dealId: deal.id,
          },
        },
      })

      if (existing) {
        skipped++
        continue
      }

      // Determine reservation details based on status
      const feePaid = ["verified", "locked_out", "completed"].includes(status)
      const proofOfFundsProvided = ["verified", "locked_out", "completed"].includes(status)
      const proofOfFundsVerified = ["verified", "locked_out", "completed"].includes(status)
      const lockOutAgreementSent = ["locked_out", "completed"].includes(status)
      const lockOutAgreementSigned = ["locked_out", "completed"].includes(status)

      const reservationFee = Math.floor(Math.random() * 2000) + 500 // £500-£2500

      await prisma.investorReservation.create({
        data: {
          investorId: investor.id,
          dealId: deal.id,
          reservationFee,
          feePaid,
          feePaymentId: feePaid ? `pi_${Math.random().toString(36).substring(7)}` : null,
          feePaidAt: feePaid ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null,
          proofOfFundsProvided,
          proofOfFundsDocumentS3Key: proofOfFundsProvided ? `proof-of-funds/${investor.id}/${deal.id}.pdf` : null,
          proofOfFundsVerified,
          proofOfFundsVerifiedAt: proofOfFundsVerified ? new Date(Date.now() - Math.random() * 20 * 24 * 60 * 60 * 1000) : null,
          solicitorName: proofOfFundsVerified ? `Solicitor ${i + 1}` : null,
          solicitorEmail: proofOfFundsVerified ? `solicitor${i + 1}@example.com` : null,
          solicitorPhone: proofOfFundsVerified ? `+44 20 ${Math.floor(Math.random() * 9000) + 1000} ${Math.floor(Math.random() * 9000) + 1000}` : null,
          solicitorFirm: proofOfFundsVerified ? `Law Firm ${i + 1}` : null,
          lockOutAgreementSent,
          lockOutAgreementSentAt: lockOutAgreementSent ? new Date(Date.now() - Math.random() * 10 * 24 * 60 * 60 * 1000) : null,
          lockOutAgreementSigned,
          lockOutAgreementSignedAt: lockOutAgreementSigned ? new Date(Date.now() - Math.random() * 5 * 24 * 60 * 60 * 1000) : null,
          lockOutAgreementDocumentS3Key: lockOutAgreementSigned ? `lock-out/${investor.id}/${deal.id}.pdf` : null,
          status,
          notes: status === "completed" ? "Ready for completion" : null,
          completedAt: status === "completed" ? new Date() : null,
        },
      })

      created++
    }

    // Update deal reservation count
    const reservationCount = await prisma.investorReservation.count({
      where: { dealId: deal.id },
    })

    const reservationsWithProof = await prisma.investorReservation.count({
      where: {
        dealId: deal.id,
        proofOfFundsVerified: true,
      },
    })

    await prisma.deal.update({
      where: { id: deal.id },
      data: {
        reservationCount,
        reservationsWithProofOfFunds: reservationsWithProof,
      },
    })
  }

  console.log(`✅ Created ${created} reservations`)
  if (skipped > 0) {
    console.log(`⏭️  Skipped ${skipped} existing reservations`)
  }
  console.log("🎉 Seeding complete!")
}

main()
  .catch((e) => {
    console.error("❌ Error seeding reservations:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

