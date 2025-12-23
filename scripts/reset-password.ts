/**
 * Reset Password Script
 * 
 * Usage:
 *   npx tsx scripts/reset-password.ts <email> <newPassword>
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function resetPassword() {
  const email = process.argv[2]
  const newPassword = process.argv[3]

  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/reset-password.ts <email> <newPassword>")
    process.exit(1)
  }

  try {
    console.log(`Resetting password for: ${email}`)
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.error(`❌ User not found: ${email}`)
      await prisma.$disconnect()
      process.exit(1)
    }

    console.log(`Found user: ${user.email} (ID: ${user.id})`)

    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 10)

    // Update user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: {
        passwordHash,
        isActive: true, // Make sure user is active
      },
    })

    console.log("✅ Password reset successfully!")
    console.log(`   Email: ${updatedUser.email}`)
    console.log(`   User ID: ${updatedUser.id}`)
    console.log(`   Role: ${updatedUser.role}`)
    console.log(`   Active: ${updatedUser.isActive}`)
  } catch (error: any) {
    console.error("❌ Error resetting password:", error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

resetPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

