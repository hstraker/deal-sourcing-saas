/**
 * Verify User Script
 * Check if a user exists and their account status
 * 
 * Usage:
 *   npx tsx scripts/verify-user.ts <email>
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function verifyUser() {
  const email = process.argv[2]

  if (!email) {
    console.error("Usage: npx tsx scripts/verify-user.ts <email>")
    process.exit(1)
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.error(`❌ User not found: ${email}`)
      await prisma.$disconnect()
      process.exit(1)
    }

    console.log("✅ User found:")
    console.log(`   Email: ${user.email}`)
    console.log(`   ID: ${user.id}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Active: ${user.isActive}`)
    console.log(`   Has Password: ${user.passwordHash ? "Yes" : "No"}`)
    console.log(`   Last Login: ${user.lastLogin || "Never"}`)
    
    if (!user.isActive) {
      console.log("\n⚠️  WARNING: User account is inactive! This will prevent login.")
    }
    
    if (!user.passwordHash) {
      console.log("\n⚠️  WARNING: User has no password set! This will prevent login.")
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

verifyUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

