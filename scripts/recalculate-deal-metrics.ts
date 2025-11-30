/**
 * Recalculate and update metrics for all existing deals
 * 
 * Usage: npx tsx scripts/recalculate-deal-metrics.ts
 */

import { PrismaClient } from "@prisma/client"
import { calculateAllMetrics } from "../lib/calculations/deal-metrics"
import { calculateDealScore } from "../lib/deal-scoring"

const prisma = new PrismaClient()

async function main() {
  console.log("🔄 Fetching all deals from database...")
  
  // Fetch all deals
  const deals = await prisma.deal.findMany({
    select: {
      id: true,
      address: true,
      askingPrice: true,
      marketValue: true,
      estimatedRefurbCost: true,
      afterRefurbValue: true,
      estimatedMonthlyRent: true,
      bedrooms: true,
      propertyType: true,
      postcode: true,
    },
  })

  console.log(`📊 Found ${deals.length} deals to process\n`)

  if (deals.length === 0) {
    console.log("ℹ️  No deals found. Nothing to update.")
    return
  }

  let updated = 0
  let skipped = 0
  let errors = 0

  for (const deal of deals) {
    try {
      // Prepare input for calculations
      const input = {
        askingPrice: Number(deal.askingPrice),
        marketValue: deal.marketValue ? Number(deal.marketValue) : null,
        estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
        afterRefurbValue: deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null,
        estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
        bedrooms: deal.bedrooms,
        propertyType: deal.propertyType,
        postcode: deal.postcode || undefined,
        // Optional scores - will use calculated defaults if not provided
        marketTrendsScore: null,
        propertyConditionScore: null,
      }

      // Check if estimatedMonthlyRent is missing
      if (!input.estimatedMonthlyRent || input.estimatedMonthlyRent <= 0) {
        console.log(`⚠️  Warning: ${deal.address || deal.id} is missing estimatedMonthlyRent`)
        console.log(`   - This will cause Gross Yield, Net Yield, and ROI to show as N/A`)
        console.log(`   - Please update the deal with monthly rent information`)
        console.log("")
      }

      // Calculate all metrics
      const metrics = calculateAllMetrics(input)

      // Calculate deal score with breakdown
      const { score: dealScore, breakdown: dealScoreBreakdown } = calculateDealScore(input)

      // Update the deal with recalculated metrics
      await prisma.deal.update({
        where: { id: deal.id },
        data: {
          bmvPercentage: metrics.bmvPercentage,
          grossYield: metrics.grossYield,
          netYield: metrics.netYield,
          roi: metrics.roi,
          roce: metrics.roce,
          dealScore: dealScore,
          dealScoreBreakdown: dealScoreBreakdown as any,
          packTier: metrics.packTier,
          packPrice: metrics.packPrice,
        },
      })

      updated++
      console.log(`✅ Updated: ${deal.address || deal.id}`)
      console.log(`   - BMV: ${metrics.bmvPercentage?.toFixed(1) || "N/A"}%`)
      console.log(`   - Gross Yield: ${metrics.grossYield?.toFixed(1) || "N/A"}% (requires estimatedMonthlyRent)`)
      if (!input.estimatedMonthlyRent) {
        console.log(`   - ⚠️  Missing monthly rent data`)
      }
      console.log(`   - Deal Score: ${dealScore || "N/A"}/100`)
      console.log("")
    } catch (error) {
      errors++
      console.error(`❌ Error updating deal ${deal.id}:`, error)
      console.log("")
    }
  }

  console.log("=" .repeat(50))
  console.log("📈 Summary:")
  console.log(`   ✅ Updated: ${updated} deals`)
  console.log(`   ⏭️  Skipped: ${skipped} deals`)
  console.log(`   ❌ Errors: ${errors} deals`)
  console.log("=" .repeat(50))
  
  if (updated > 0) {
    console.log("\n✨ All deals have been updated with recalculated metrics!")
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

