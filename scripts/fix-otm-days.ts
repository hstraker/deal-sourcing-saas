import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  // Show before
  const before = await prisma.propertyListing.groupBy({
    by: ["daysOnMarket"],
    where: { source: "ONTHEMARKET" },
    _count: true,
    orderBy: { daysOnMarket: "asc" },
  })
  console.log("Before:", JSON.stringify(before))

  // Fix 1: positive 14 → -14  (from "Added < 14 days" previously parsed as exact 14)
  const fix14 = await prisma.propertyListing.updateMany({
    where: { source: "ONTHEMARKET", daysOnMarket: 14 },
    data: { daysOnMarket: -14 },
  })
  console.log(`Fixed ${fix14.count} records: daysOnMarket 14 → -14`)

  // Fix 2: positive 7 → 0  (from "Reduced < 7 days" or "Added < 7 days" — unreliable, no exact count known)
  const fix7 = await prisma.propertyListing.updateMany({
    where: { source: "ONTHEMARKET", daysOnMarket: 7 },
    data: { daysOnMarket: 0 },
  })
  console.log(`Fixed ${fix7.count} records: daysOnMarket 7 → 0`)

  // Show after
  const after = await prisma.propertyListing.groupBy({
    by: ["daysOnMarket"],
    where: { source: "ONTHEMARKET" },
    _count: true,
    orderBy: { daysOnMarket: "asc" },
  })
  console.log("After:", JSON.stringify(after))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
