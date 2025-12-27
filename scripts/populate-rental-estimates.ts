/**
 * Script to populate rental estimates for vendor leads
 * Estimates based on typical UK property yields (6% default)
 */

import { prisma } from '../lib/db'

interface RentalEstimate {
  monthlyRent: number
  annualRent: number
  estimatedYield: number
}

/**
 * Estimate rental income based on property details
 * Uses conservative yield estimates based on location and property type
 */
function estimateRentalIncome(
  askingPrice: number,
  propertyType?: string | null,
  bedrooms?: number | null,
  postcode?: string | null
): RentalEstimate {
  // Base yield estimate (conservative UK average)
  let yieldPercentage = 6.0

  // Adjust based on property type
  if (propertyType) {
    const type = propertyType.toLowerCase()
    if (type.includes('flat') || type.includes('apartment')) {
      yieldPercentage = 6.5 // Flats typically higher yield
    } else if (type.includes('detached')) {
      yieldPercentage = 5.0 // Detached typically lower yield
    } else if (type.includes('terraced')) {
      yieldPercentage = 6.5 // Terraced good for rentals
    }
  }

  // Adjust based on location (basic postcode analysis)
  if (postcode) {
    const postcodeUpper = postcode.toUpperCase()
    // London postcodes typically lower yields
    if (
      postcodeUpper.startsWith('SW') ||
      postcodeUpper.startsWith('SE') ||
      postcodeUpper.startsWith('N') ||
      postcodeUpper.startsWith('E') ||
      postcodeUpper.startsWith('W') ||
      postcodeUpper.startsWith('NW') ||
      postcodeUpper.startsWith('EC')
    ) {
      yieldPercentage = 4.0
    }
  }

  // Adjust based on bedrooms
  if (bedrooms) {
    if (bedrooms === 1) {
      yieldPercentage += 0.5 // Studio/1-bed higher yield
    } else if (bedrooms >= 4) {
      yieldPercentage -= 0.5 // Larger properties lower yield
    }
  }

  // Calculate annual and monthly rent
  const annualRent = Math.round((askingPrice * yieldPercentage) / 100)
  const monthlyRent = Math.round(annualRent / 12)

  return {
    monthlyRent,
    annualRent,
    estimatedYield: yieldPercentage,
  }
}

/**
 * Estimate square footage based on property type and bedrooms
 */
function estimateSquareFeet(
  propertyType?: string | null,
  bedrooms?: number | null
): number | null {
  if (!bedrooms) return null

  // Average UK property sizes by bedroom count
  const baseSize = bedrooms * 400 // 400 sq ft per bedroom as base

  let multiplier = 1.0

  if (propertyType) {
    const type = propertyType.toLowerCase()
    if (type.includes('flat') || type.includes('apartment')) {
      multiplier = 0.8 // Flats typically smaller
    } else if (type.includes('detached')) {
      multiplier = 1.3 // Detached typically larger
    } else if (type.includes('semi')) {
      multiplier = 1.1 // Semi-detached medium
    }
  }

  return Math.round(baseSize * multiplier)
}

async function populateRentalEstimates() {
  console.log('🏠 Starting rental estimates population...\n')

  // Find all vendor leads with asking price but no rental data
  const leadsToUpdate = await prisma.vendorLead.findMany({
    where: {
      askingPrice: { not: null },
      estimatedMonthlyRent: null,
    },
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      askingPrice: true,
      propertyType: true,
      bedrooms: true,
      propertyPostcode: true,
      squareFeet: true,
    },
  })

  console.log(`📊 Found ${leadsToUpdate.length} leads to update\n`)

  let updatedCount = 0
  let errors = 0

  for (const lead of leadsToUpdate) {
    try {
      const askingPrice = Number(lead.askingPrice)

      // Estimate rental income
      const rental = estimateRentalIncome(
        askingPrice,
        lead.propertyType,
        lead.bedrooms,
        lead.propertyPostcode
      )

      // Estimate square footage if not present
      const squareFeet =
        lead.squareFeet ||
        estimateSquareFeet(lead.propertyType, lead.bedrooms)

      // Update the lead
      await prisma.vendorLead.update({
        where: { id: lead.id },
        data: {
          estimatedMonthlyRent: rental.monthlyRent,
          estimatedAnnualRent: rental.annualRent,
          squareFeet: squareFeet,
        },
      })

      updatedCount++
      console.log(
        `✅ ${lead.vendorName} - ${lead.propertyAddress || 'No address'}`
      )
      console.log(
        `   Asking: £${askingPrice.toLocaleString()} → Rent: £${rental.monthlyRent.toLocaleString()}/mo (${rental.estimatedYield.toFixed(1)}% yield)`
      )
      if (squareFeet) {
        console.log(`   Square Feet: ${squareFeet.toLocaleString()} sq ft`)
      }
      console.log('')
    } catch (error) {
      errors++
      console.error(`❌ Error updating ${lead.vendorName}:`, error)
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`✨ Complete!`)
  console.log(`   Updated: ${updatedCount} leads`)
  console.log(`   Errors: ${errors}`)
  console.log(`${'='.repeat(60)}\n`)

  await prisma.$disconnect()
}

// Run the script
populateRentalEstimates().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
