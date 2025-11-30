/**
 * Check which deals have rent data and which are missing it
 * 
 * Usage: npx tsx scripts/check-deal-rent-data.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Checking rent data for all deals...\n")
  
  // Fetch all deals with rent information
  const deals = await prisma.deal.findMany({
    select: {
      id: true,
      address: true,
      askingPrice: true,
      estimatedMonthlyRent: true,
      bedrooms: true,
      propertyType: true,
      postcode: true,
    },
    orderBy: {
      address: "asc",
    },
  })

  console.log(`📊 Found ${deals.length} deals\n`)
  
  if (deals.length === 0) {
    console.log("ℹ️  No deals found.")
    return
  }

  let withRent = 0
  let withoutRent = 0

  console.log("=" .repeat(80))
  for (const deal of deals) {
    const rent = deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null
    const askingPrice = Number(deal.askingPrice)
    
    if (rent && rent > 0) {
      withRent++
      const annualRent = rent * 12
      const grossYield = (annualRent / askingPrice) * 100
      console.log(`✅ ${deal.address || deal.id}`)
      console.log(`   - Monthly Rent: £${rent.toFixed(2)}`)
      console.log(`   - Asking Price: £${askingPrice.toLocaleString()}`)
      console.log(`   - Gross Yield: ${grossYield.toFixed(2)}%`)
      console.log(`   - Bedrooms: ${deal.bedrooms || "N/A"}`)
      console.log("")
    } else {
      withoutRent++
      console.log(`❌ ${deal.address || deal.id}`)
      console.log(`   - Monthly Rent: MISSING`)
      console.log(`   - Asking Price: £${askingPrice.toLocaleString()}`)
      console.log(`   - Bedrooms: ${deal.bedrooms || "N/A"}`)
      console.log(`   - Property Type: ${deal.propertyType || "N/A"}`)
      console.log(`   - Postcode: ${deal.postcode || "N/A"}`)
      console.log("")
    }
  }

  console.log("=" .repeat(80))
  console.log("📈 Summary:")
  console.log(`   ✅ Deals with rent data: ${withRent}`)
  console.log(`   ❌ Deals missing rent data: ${withoutRent}`)
  console.log("=" .repeat(80))
  
  if (withoutRent > 0) {
    console.log("\n💡 To fix missing rent data:")
    console.log("   1. Edit each deal in the UI and add the monthly rent")
    console.log("   2. Or update directly in the database:")
    console.log("      UPDATE deals SET estimated_monthly_rent = 650 WHERE id = 'deal-id';")
    console.log("   3. Then run: npm run recalculate:metrics")
  }
}

main()
  .catch((e) => {
    console.error("❌ Fatal error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

