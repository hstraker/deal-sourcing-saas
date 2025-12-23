/**
 * Create or update a user account
 * 
 * Usage:
 *   npx tsx scripts/create-user.ts <email> <password> <role>
 *   
 * Example:
 *   npx tsx scripts/create-user.ts henrystraker@gmail.com password123 admin
 */

import { PrismaClient, UserRole } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function createUser() {
  const email = process.argv[2]
  const password = process.argv[3]
  const role = (process.argv[4] || "admin") as UserRole

  if (!email || !password) {
    console.error("Usage: npx tsx scripts/create-user.ts <email> <password> [role]")
    console.error("Example: npx tsx scripts/create-user.ts henrystraker@gmail.com password123 admin")
    process.exit(1)
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      console.log(`User ${email} already exists. Updating password and ensuring active...`)
      
      const passwordHash = await bcrypt.hash(password, 10)
      
      const updatedUser = await prisma.user.update({
        where: { email },
        data: {
          passwordHash,
          isActive: true,
        },
      })
      
      console.log("✅ User updated successfully!")
      console.log(`   Email: ${updatedUser.email}`)
      console.log(`   ID: ${updatedUser.id}`)
      console.log(`   Role: ${updatedUser.role}`)
      console.log(`   Active: ${updatedUser.isActive}`)
    } else {
      // Create new user
      const passwordHash = await bcrypt.hash(password, 10)
      
      const newUser = await prisma.user.create({
        data: {
          email,
          passwordHash,
          role,
          isActive: true,
          firstName: email.split("@")[0],
        },
      })
      
      console.log("✅ User created successfully!")
      console.log(`   Email: ${newUser.email}`)
      console.log(`   ID: ${newUser.id}`)
      console.log(`   Role: ${newUser.role}`)
      console.log(`   Active: ${newUser.isActive}`)
    }
  } catch (error: any) {
    console.error("❌ Error:", error.message)
    if (error.code === "P2002") {
      console.error("   A user with this email already exists")
    }
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

createUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

