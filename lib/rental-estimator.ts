/**
 * Rental income estimation utility
 * Estimates rental income based on property details
 */

export interface RentalEstimate {
  monthlyRent: number
  annualRent: number
  estimatedYield: number
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
}

/**
 * Estimate rental income based on property details
 * Uses conservative yield estimates based on location and property type
 */
export function estimateRentalIncome(
  askingPrice: number,
  propertyType?: string | null,
  bedrooms?: number | null,
  postcode?: string | null
): RentalEstimate {
  // Base yield estimate (conservative UK average)
  let yieldPercentage = 6.0
  let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM'

  // Adjust based on property type
  if (propertyType) {
    const type = propertyType.toLowerCase()
    if (type.includes('flat') || type.includes('apartment')) {
      yieldPercentage = 6.5 // Flats typically higher yield
    } else if (type.includes('detached')) {
      yieldPercentage = 5.0 // Detached typically lower yield
    } else if (type.includes('terraced')) {
      yieldPercentage = 6.5 // Terraced good for rentals
    } else if (type.includes('semi')) {
      yieldPercentage = 5.5 // Semi-detached medium
    }
  }

  // Adjust based on location (basic postcode analysis)
  if (postcode) {
    const postcodeUpper = postcode.toUpperCase().trim()

    // London postcodes typically lower yields but higher confidence
    if (
      postcodeUpper.startsWith('SW') ||
      postcodeUpper.startsWith('SE') ||
      postcodeUpper.startsWith('N') ||
      postcodeUpper.startsWith('E') ||
      postcodeUpper.startsWith('W') ||
      postcodeUpper.startsWith('NW') ||
      postcodeUpper.startsWith('EC') ||
      postcodeUpper.startsWith('WC')
    ) {
      yieldPercentage = 4.0
      confidence = 'MEDIUM'
    }

    // Major cities - medium yields
    else if (
      postcodeUpper.startsWith('M') ||  // Manchester
      postcodeUpper.startsWith('B') ||  // Birmingham
      postcodeUpper.startsWith('LS') || // Leeds
      postcodeUpper.startsWith('L') ||  // Liverpool
      postcodeUpper.startsWith('G') ||  // Glasgow
      postcodeUpper.startsWith('EH')    // Edinburgh
    ) {
      yieldPercentage = 6.0
      confidence = 'MEDIUM'
    }

    // Provincial areas typically higher yields
    else {
      yieldPercentage = 6.5
      confidence = 'MEDIUM'
    }
  }

  // Adjust based on bedrooms
  if (bedrooms) {
    if (bedrooms === 1) {
      yieldPercentage += 0.5 // Studio/1-bed higher yield
      confidence = 'HIGH'
    } else if (bedrooms === 2) {
      confidence = 'HIGH' // 2-bed most common rental
    } else if (bedrooms >= 4) {
      yieldPercentage -= 0.5 // Larger properties lower yield
      confidence = 'MEDIUM'
    }
  } else {
    confidence = 'LOW' // No bedroom data reduces confidence
  }

  // Calculate annual and monthly rent
  const annualRent = Math.round((askingPrice * yieldPercentage) / 100)
  const monthlyRent = Math.round(annualRent / 12)

  return {
    monthlyRent,
    annualRent,
    estimatedYield: yieldPercentage,
    confidence,
  }
}

/**
 * Estimate square footage based on property type and bedrooms
 */
export function estimateSquareFeet(
  propertyType?: string | null,
  bedrooms?: number | null
): number | null {
  if (!bedrooms) return null

  // Average UK property sizes by bedroom count (sq ft)
  const baseSizes: Record<number, number> = {
    1: 500,
    2: 750,
    3: 1000,
    4: 1400,
    5: 1800,
  }

  const baseSize = baseSizes[bedrooms] || bedrooms * 400

  let multiplier = 1.0

  if (propertyType) {
    const type = propertyType.toLowerCase()
    if (type.includes('flat') || type.includes('apartment')) {
      multiplier = 0.8 // Flats typically smaller
    } else if (type.includes('detached')) {
      multiplier = 1.3 // Detached typically larger
    } else if (type.includes('semi')) {
      multiplier = 1.1 // Semi-detached medium
    } else if (type.includes('terraced')) {
      multiplier = 0.9 // Terraced slightly smaller
    }
  }

  return Math.round(baseSize * multiplier)
}

/**
 * Calculate rent per square foot
 */
export function calculateRentPerSqFt(
  monthlyRent: number,
  squareFeet: number
): number {
  if (squareFeet <= 0) return 0
  return Number((monthlyRent / squareFeet).toFixed(2))
}
