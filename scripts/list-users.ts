/**
 * List all users in the database
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
    })

    console.log(`Found ${users.length} user(s):\n`)

    if (users.length === 0) {
      console.log("No users found in database.")
      console.log("You may need to create an admin user using:")
      console.log("  npx tsx scripts/seed-admin.ts")
    } else {
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email}`)
        console.log(`   ID: ${user.id}`)
        console.log(`   Role: ${user.role}`)
        console.log(`   Active: ${user.isActive}`)
        console.log(`   Has Password: ${user.passwordHash ? "Yes" : "No"}`)
        console.log(`   Created: ${user.createdAt}`)
        console.log("")
      })
    }
  } catch (error: any) {
    console.error("❌ Error listing users:", error.message)
    console.error(error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

listUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })

