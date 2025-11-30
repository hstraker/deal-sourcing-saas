/**
 * Seed script to create an initial admin user
 * 
 * Usage: npx tsx scripts/seed-admin.ts
 * Or: node --loader ts-node/esm scripts/seed-admin.ts
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.env.ADMIN_EMAIL || "admin@dealstack.com"
  const password = process.env.ADMIN_PASSWORD || "Admin123!"
  const firstName = process.env.ADMIN_FIRST_NAME || "Admin"
  const lastName = process.env.ADMIN_LAST_NAME || "User"

  // Check if admin already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { email },
  })

  if (existingAdmin) {
    console.log(`Admin user with email ${email} already exists`)
    return
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create admin user
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "admin",
      firstName,
      lastName,
      isActive: true,
    },
  })

  console.log(`✅ Admin user created successfully!`)
  console.log(`   Email: ${admin.email}`)
  console.log(`   ID: ${admin.id}`)
  console.log(`   Role: ${admin.role}`)
}

main()
  .catch((e) => {
    console.error("❌ Error creating admin user:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

