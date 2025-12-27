/**
 * PropertyData API Client
 * 
 * Uses PropertyData API endpoints:
 * - /sourced-properties: Search for properties by postcode/location
 * - /sourced-property: Get detailed property data by property_id
 * 
 * Provides property data for UK properties including:
 * - Property details (bedrooms, type, square feet)
 * - Property price and location
 * - Days on market
 * 
 * Credit limit: 2,000 credits/month - cache aggressively!
 */

const PROPERTYDATA_API_URL = process.env.PROPERTYDATA_API_URL || "https://api.propertydata.co.uk"
const PROPERTYDATA_API_KEY = process.env.PROPERTYDATA_API_KEY

if (!PROPERTYDATA_API_KEY) {
  console.warn("⚠️ PROPERTYDATA_API_KEY not set - PropertyData features will be disabled")
}

export interface PropertyDataResponse {
  success: boolean
  data?: {
    // Property Details
    address?: string
    bedrooms?: number
    bathrooms?: number
    squareFeet?: number
    propertyType?: string
    yearBuilt?: number
    epcRating?: string
    
    // Valuation
    estimatedValue?: number
    valueRange?: {
      min: number
      max: number
    }
    
    // Comparables
    comparables?: ComparableSale[]
    
    // Rental
    estimatedRentalYield?: number
    estimatedMonthlyRent?: number
    areaAverageRent?: number
    
    // Area Statistics
    areaStats?: {
      averagePrice: number
      pricePerSquareFoot: number
      growthLastYear: number
      growthLast5Years: number
      rentalYield: number
    }
    
    // Historical Sales
    recentSales?: HistoricalSale[]
    
    // Location
    latitude?: number
    longitude?: number
    postcode?: string
  }
  error?: string
  warning?: string // Warning message (e.g., when no exact match found)
  creditsUsed?: number
}

export interface ComparableSale {
  address: string
  salePrice: number
  saleDate: string
  bedrooms: number
  bathrooms?: number
  squareFeet?: number
  distance: number // in miles
  propertyType: string
}

export interface HistoricalSale {
  salePrice: number
  saleDate: string
  saleType: string // 'freehold', 'leasehold'
}

export interface SoldProperty {
  address: string
  postcode?: string  // Individual property postcode
  salePrice: number
  saleDate: string
  bedrooms: number
  propertyType: string
  distance?: number // in miles (calculated if lat/lng available)
}

export interface PropertyDataCache {
  id: string
  address: string
  postcode: string | null
  data: PropertyDataResponse
  creditsUsed: number
  fetchedAt: Date
  expiresAt: Date
}

/**
 * Available PropertyData property lists
 */
export const PROPERTY_LISTS = [
  { id: "unmodernised-properties", label: "Unmodernised Properties", category: "condition" },
  { id: "cash-buyers-only-properties", label: "Cash Buyers Only", category: "sale-type" },
  { id: "repossessed-properties", label: "Repossessed Properties", category: "sale-type" },
  { id: "quick-sale-properties", label: "Quick Sale Properties", category: "sale-type" },
  { id: "hmo-licenced-properties", label: "HMO Licenced Properties", category: "investment" },
  { id: "reduced-properties", label: "Reduced Properties", category: "price" },
  { id: "two-to-three-bed-conversions", label: "2-3 Bed Conversions", category: "conversion" },
  { id: "one-to-two-bed-conversions", label: "1-2 Bed Conversions", category: "conversion" },
  { id: "cheap-per-square-foot", label: "Cheap Per Square Foot", category: "price" },
  { id: "land-plots-for-sale", label: "Land Plots for Sale", category: "type" },
  { id: "investment-portfolios", label: "Investment Portfolios", category: "investment" },
  { id: "mixed-use", label: "Mixed Use", category: "type" },
  { id: "large-properties", label: "Large Properties", category: "size" },
  { id: "auction-properties", label: "Auction Properties", category: "sale-type" },
  { id: "slow-to-sell-properties", label: "Slow to Sell", category: "market" },
  { id: "suitable-for-splitting", label: "Suitable for Splitting", category: "conversion" },
  { id: "back-on-market", label: "Back on Market", category: "market" },
  { id: "short-lease-properties", label: "Short Lease Properties", category: "lease" },
  { id: "high-yield-properties", label: "High Yield Properties", category: "investment" },
  { id: "properties-with-planning-granted", label: "Planning Granted", category: "development" },
  { id: "high-rental-demand", label: "High Rental Demand", category: "investment" },
  { id: "tenanted-properties-for-sale", label: "Tenanted Properties", category: "investment" },
  { id: "properties-on-a-corner-plot", label: "Corner Plot Properties", category: "location" },
  { id: "bungalows-for-sale", label: "Bungalows for Sale", category: "type" },
  { id: "properties-with-no-chain", label: "No Chain Properties", category: "sale-type" },
  { id: "properties-with-an-annexe", label: "Properties with Annexe", category: "features" },
  { id: "properties-with-good-views", label: "Good Views", category: "features" },
  { id: "walking-distance-to-town-centre", label: "Walking Distance to Town", category: "location" },
  { id: "holiday-let-properties", label: "Holiday Let Properties", category: "investment" },
  { id: "poor-epc-score", label: "Poor EPC Score", category: "condition" },
  { id: "georgian-houses", label: "Georgian Houses", category: "type" },
  { id: "high-population-growth", label: "High Population Growth", category: "location" },
  { id: "properties-near-a-university", label: "Near University", category: "location" },
  { id: "new-build-properties", label: "New Build Properties", category: "type" },
  { id: "near-green-space", label: "Near Green Space", category: "location" },
  { id: "near-large-development", label: "Near Large Development", category: "location" },
  { id: "properties-near-great-school", label: "Near Great School", category: "location" },
] as const

/**
 * Get property list insights for deal analysis
 */
export function getPropertyListInsights(listId: string): {
  insights: string[]
  riskFactors: string[]
  recommendations: string[]
} {
  const insights: string[] = []
  const riskFactors: string[] = []
  const recommendations: string[] = []

  switch (listId) {
    case "repossessed-properties":
      insights.push("Chain-free purchase - reliable transaction")
      insights.push("Often priced below market value")
      recommendations.push("Verify property condition - may need repairs")
      break
    case "reduced-properties":
      insights.push("Price has been reduced - potential BMV opportunity")
      recommendations.push("Research why price was reduced")
      break
    case "quick-sale-properties":
      insights.push("Seller motivated - potential for negotiation")
      recommendations.push("Act quickly - may have time constraints")
      break
    case "cash-buyers-only-properties":
      riskFactors.push("Requires cash purchase - no mortgage option")
      recommendations.push("Ensure funding is available")
      break
    case "high-yield-properties":
      insights.push("Strong rental yield potential")
      recommendations.push("Excellent for buy-to-let investment")
      break
    case "properties-with-no-chain":
      insights.push("No chain - faster transaction")
      recommendations.push("Reliable purchase with quick completion")
      break
    case "auction-properties":
      riskFactors.push("Auction purchase - requires immediate payment")
      recommendations.push("Get property surveyed before auction")
      break
    case "poor-epc-score":
      riskFactors.push("Low energy efficiency - may need improvements")
      recommendations.push("Budget for energy efficiency upgrades")
      break
    case "short-lease-properties":
      riskFactors.push("Short lease remaining - may affect value")
      recommendations.push("Check lease extension costs")
      break
    case "properties-with-planning-granted":
      insights.push("Planning permission granted - development potential")
      recommendations.push("Consider value-add opportunities")
      break
    case "suitable-for-splitting":
      insights.push("Potential to split into multiple units")
      recommendations.push("Calculate split costs and rental yields")
      break
    case "back-on-market":
      insights.push("Previously sold - may have issues")
      recommendations.push("Investigate why sale fell through")
      break
  }

  return { insights, riskFactors, recommendations }
}

/**
 * Search for properties using PropertyData API
 * 
 * @param postcode - UK postcode (required)
 * @param lists - Property list IDs (default: ["repossessed-properties"])
 * @param radius - Radius in miles (default: 5)
 * @param maxAge - Max age in days (optional)
 * @param results - Max results per list (default: 20, max: 500)
 * @returns List of properties with their source list, or null if error
 */
export async function searchProperties(
  postcode: string,
  lists: string | string[] = ["repossessed-properties"],
  radius: number = 5,
  maxAge?: number,
  results: number = 20
): Promise<{ properties: Array<any & { sourceList: string; sourceListLabel: string }>; apiCallsCost: number } | null> {
  if (!PROPERTYDATA_API_KEY) {
    return null
  }

  // Normalize lists to array
  const listArray = Array.isArray(lists) ? lists : [lists]
  
  try {
    const allProperties: Array<any & { sourceList: string; sourceListLabel: string }> = []
    let totalApiCallsCost = 0

    // Search each list
    for (const list of listArray) {
      const params = new URLSearchParams({
        key: PROPERTYDATA_API_KEY,
        list: list,
        postcode: postcode,
        radius: radius.toString(),
        results: Math.min(Math.max(results, 10), 500).toString(),
      })

      if (maxAge) {
        params.append("max_age", maxAge.toString())
      }

      const url = `${PROPERTYDATA_API_URL}/sourced-properties?${params.toString()}`
      
      const response = await fetch(url, {
        method: "GET",
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error(`PropertyData search error for list ${list}:`, response.status, errorText)
        continue // Skip this list and continue with others
      }

      const data = await response.json()
      
      if (data.status === "success" && data.properties) {
        const listLabel = PROPERTY_LISTS.find(l => l.id === list)?.label || list
        // Add source list info to each property
        const propertiesWithSource = data.properties.map((prop: any) => ({
          ...prop,
          sourceList: list,
          sourceListLabel: listLabel,
        }))
        allProperties.push(...propertiesWithSource)
        totalApiCallsCost += data.api_calls_cost || 1
      }
    }

    // Remove duplicates based on property ID
    const uniqueProperties = Array.from(
      new Map(allProperties.map(prop => [prop.id, prop])).values()
    )

    return {
      properties: uniqueProperties,
      apiCallsCost: totalApiCallsCost,
    }
  } catch (error) {
    console.error("Error searching properties:", error)
    return null
  }
}

/**
 * Fetch property valuation from PropertyData API using detailed property characteristics
 * 
 * @param postcode - Full UK postcode (required)
 * @param propertyType - Property type (e.g., "flat", "house")
 * @param internalArea - Internal area in square feet (min 300)
 * @param bedrooms - Number of bedrooms (0-5)
 * @param bathrooms - Number of bathrooms (0-5)
 * @param constructionDate - Construction date (optional, defaults to "unknown")
 * @param finishQuality - Interior finish quality (optional, defaults to "average")
 * @param outdoorSpace - Outdoor space type (optional, defaults to "none")
 * @param offStreetParking - Off-street parking spaces (optional, defaults to 0)
 * @returns Valuation with estimate and margin or null if error
 */
export async function fetchPropertyValuation(
  postcode: string,
  propertyType: string,
  internalArea: number,
  bedrooms: number,
  bathrooms: number = 1,
  constructionDate: string = "unknown",
  finishQuality: string = "average",
  outdoorSpace: string = "none",
  offStreetParking: number = 0
): Promise<{ estimate: number; margin: number; minValue: number; maxValue: number } | null> {
  if (!PROPERTYDATA_API_KEY) {
    return null
  }

  // Validate internal area (min 300 sqft)
  if (internalArea < 300) {
    console.warn(`[PropertyData] Internal area ${internalArea} sqft is below minimum 300 sqft for valuation`)
    return null
  }

  try {
    const params = new URLSearchParams({
      key: PROPERTYDATA_API_KEY,
      postcode: postcode,
      property_type: propertyType.toLowerCase(),
      internal_area: internalArea.toString(),
      bedrooms: bedrooms.toString(),
      bathrooms: bathrooms.toString(),
      construction_date: constructionDate,
      finish_quality: finishQuality,
      outdoor_space: outdoorSpace,
      off_street_parking: offStreetParking.toString(),
    })

    const url = `${PROPERTYDATA_API_URL}/valuation-sale?${params.toString()}`
    
    const response = await fetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("PropertyData valuation API error:", response.status, errorText)
      return null
    }

    const data = await response.json()
    
    if (data.status === "success" && data.result) {
      const estimate = data.result.estimate
      const margin = data.result.margin
      
      console.log(`[PropertyData] Valuation: estimate=£${estimate}, margin=±£${margin}`)
      
      return {
        estimate,
        margin,
        minValue: estimate - margin,
        maxValue: estimate + margin,
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching property valuation:", error)
    return null
  }
}

/**
 * Fetch rental data from PropertyData API
 * 
 * @param postcode - UK postcode
 * @param bedrooms - Number of bedrooms (optional, 0-5)
 * @param propertyType - Property type filter (optional)
 * @returns Rental data with monthly rent estimate or null if error
 */
export async function fetchRentalData(
  postcode: string,
  bedrooms?: number,
  propertyType?: string
): Promise<{ monthlyRent: number; weeklyRent: number; confidenceRange: { min: number; max: number } } | null> {
  if (!PROPERTYDATA_API_KEY) {
    return null
  }

  try {
    const params = new URLSearchParams({
      key: PROPERTYDATA_API_KEY,
      postcode: postcode,
      points: "20", // Default number of points to analyze
    })

    if (bedrooms !== undefined && bedrooms !== null) {
      params.append("bedrooms", bedrooms.toString())
    }

    // Map property type to PropertyData API format
    // API accepts: flat, terraced_house, semi-detached_house (with hyphen!), detached_house
    if (propertyType) {
      const typeMap: Record<string, string> = {
        'flat': 'flat',
        'apartment': 'flat',
        'terraced': 'terraced_house',
        'terraced_house': 'terraced_house',
        'semi-detached': 'semi-detached_house',  // NOTE: hyphen, not underscore!
        'semi_detached': 'semi-detached_house',
        'semidetached': 'semi-detached_house',
        'semi-detached_house': 'semi-detached_house',
        'semi_detached_house': 'semi-detached_house',
        'detached': 'detached_house',
        'detached_house': 'detached_house',
      }

      const normalized = propertyType.toLowerCase().replace(/\s+/g, '_')
      const mappedType = typeMap[normalized] || typeMap[propertyType.toLowerCase()]

      if (mappedType) {
        params.append("type", mappedType)
        console.log(`[PropertyData] Property type mapped: "${propertyType}" → "${mappedType}"`)
      } else {
        console.log(`[PropertyData] Property type "${propertyType}" not recognized, fetching without type filter`)
      }
    }

    const url = `${PROPERTYDATA_API_URL}/rents?${params.toString()}`
    
    const response = await fetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("PropertyData rental API error:", response.status, errorText)
      return null
    }

    const data = await response.json()
    
    if (data.status === "success" && data.data?.long_let) {
      const rentalData = data.data.long_let
      const weeklyRent = rentalData.average
      const monthlyRent = weeklyRent * 4.333 // Convert weekly to monthly
      const confidenceRange = rentalData["70pc_range"] || [weeklyRent * 0.9, weeklyRent * 1.1]
      
      console.log(`[PropertyData] Rental data: weekly=£${weeklyRent}, monthly=£${monthlyRent.toFixed(2)}`)
      
      return {
        monthlyRent: Math.round(monthlyRent),
        weeklyRent: Math.round(weeklyRent),
        confidenceRange: {
          min: Math.round(confidenceRange[0] * 4.333),
          max: Math.round(confidenceRange[1] * 4.333),
        },
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching rental data:", error)
    return null
  }
}

/**
 * Fetch sold prices (comparable properties) from PropertyData API
 *
 * @param postcode - UK postcode
 * @param bedrooms - Number of bedrooms (optional filter)
 * @param radius - Search radius in miles (default: 3)
 * @param maxResults - Maximum results to return (default: 50)
 * @returns Array of sold properties or null if error
 */
export async function fetchSoldPrices(
  postcode: string,
  bedrooms?: number,
  radius: number = 3,
  maxResults: number = 50
): Promise<{ soldProperties: SoldProperty[]; creditsUsed: number } | null> {
  if (!PROPERTYDATA_API_KEY) {
    return null
  }

  try {
    const params = new URLSearchParams({
      key: PROPERTYDATA_API_KEY,
      postcode: postcode,
      radius: radius.toString(),
      results: Math.min(maxResults, 500).toString(),
    })

    if (bedrooms !== undefined && bedrooms !== null) {
      params.append("bedrooms", bedrooms.toString())
    }

    const url = `${PROPERTYDATA_API_URL}/sold-prices?${params.toString()}`

    console.log(`[PropertyData] Fetching sold prices for postcode: ${postcode}, bedrooms: ${bedrooms || 'any'}, radius: ${radius} miles`)

    const response = await fetch(url, {
      method: "GET",
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error("PropertyData sold-prices API error:", response.status, errorText)
      return null
    }

    const data = await response.json()

    if (data.status === "success" && data.data?.raw_data) {
      const rawData = data.data.raw_data

      console.log(`[PropertyData] Found ${rawData.length} sold properties`)

      // Log first raw item to see what API actually returns
      if (rawData.length > 0) {
        console.log(`[PropertyData] Sample raw API data:`, {
          address: rawData[0].address || rawData[0].Address,
          postcode: rawData[0].postcode || rawData[0].Postcode || 'NOT IN API',
          availableKeys: Object.keys(rawData[0])
        })
      }

      // Transform to our format
      const soldProperties: SoldProperty[] = rawData.map((item: any, index: number) => {
        const address = item.address || item.Address || ""

        // Try to get postcode from API response first, then extract from address
        let propertyPostcode = item.postcode || item.Postcode
        if (!propertyPostcode && address) {
          propertyPostcode = extractPostcode(address)
          console.log(`[PropertyData] Extracted postcode "${propertyPostcode}" from address: "${address}"`)
        }

        const property = {
          address,
          postcode: propertyPostcode || undefined,
          salePrice: Number(item.sale_price || item.price || item.Price || 0),
          saleDate: item.sale_date || item.date || item.Date || "",
          bedrooms: Number(item.bedrooms || item.Bedrooms || 0),
          propertyType: item.property_type || item.type || item.Type || "",
          distance: item.distance ? Number(item.distance) : undefined,
        }

        // Log first property to verify postcode extraction
        if (index === 0) {
          console.log(`[PropertyData] First property: ${property.address}, postcode: ${property.postcode || 'NOT FOUND'}`)
        }

        return property
      })

      // Filter out invalid entries (missing critical data)
      const validProperties = soldProperties.filter(
        prop => prop.salePrice > 0 && prop.address && prop.saleDate
      )

      console.log(`[PropertyData] Returning ${validProperties.length} valid sold properties`)

      return {
        soldProperties: validProperties,
        creditsUsed: 1, // PropertyData charges 1 credit for sold-prices endpoint
      }
    }

    return null
  } catch (error) {
    console.error("Error fetching sold prices:", error)
    return null
  }
}

/**
 * Filter and sort comparable properties for BMV analysis
 *
 * @param soldProperties - Array of sold properties
 * @param targetBedrooms - Target property bedrooms
 * @param targetPropertyType - Target property type
 * @param maxAgeMonths - Maximum age of sales in months (default: 12)
 * @param maxResults - Maximum comparables to return (default: 5)
 * @returns Filtered and sorted comparable properties
 */
export function filterComparables(
  soldProperties: SoldProperty[],
  targetBedrooms?: number,
  targetPropertyType?: string,
  maxAgeMonths: number = 12,
  maxResults: number = 5
): SoldProperty[] {
  const now = new Date()
  const maxAgeMs = maxAgeMonths * 30 * 24 * 60 * 60 * 1000

  let filtered = soldProperties.filter(prop => {
    // Filter by age
    const saleDate = new Date(prop.saleDate)
    const ageMs = now.getTime() - saleDate.getTime()
    if (ageMs > maxAgeMs) return false

    // Filter by bedrooms (±1 bedroom)
    if (targetBedrooms !== undefined && prop.bedrooms > 0) {
      const bedroomDiff = Math.abs(prop.bedrooms - targetBedrooms)
      if (bedroomDiff > 1) return false
    }

    // Filter by property type (if provided and matches)
    if (targetPropertyType && prop.propertyType) {
      const targetType = targetPropertyType.toLowerCase()
      const propType = prop.propertyType.toLowerCase()

      // Flexible matching
      if (
        !propType.includes(targetType) &&
        !targetType.includes(propType) &&
        !(targetType.includes("house") && propType.includes("house")) &&
        !(targetType.includes("flat") && propType.includes("flat"))
      ) {
        return false
      }
    }

    return true
  })

  // Sort by relevance (recency and distance)
  filtered.sort((a, b) => {
    // First priority: distance (if available)
    if (a.distance !== undefined && b.distance !== undefined) {
      const distanceDiff = a.distance - b.distance
      if (Math.abs(distanceDiff) > 0.1) return distanceDiff
    }

    // Second priority: recency
    const dateA = new Date(a.saleDate).getTime()
    const dateB = new Date(b.saleDate).getTime()
    return dateB - dateA // Most recent first
  })

  // Return top N results
  return filtered.slice(0, maxResults)
}

/**
 * Calculate average price from comparable properties
 *
 * @param comparables - Array of comparable properties
 * @returns Average sale price or null if no comparables
 */
export function calculateAverageComparablePrice(comparables: SoldProperty[]): number | null {
  if (comparables.length === 0) return null

  const total = comparables.reduce((sum, prop) => sum + prop.salePrice, 0)
  return Math.round(total / comparables.length)
}

/**
 * Fetch detailed property data from PropertyData API using property_id
 *
 * @param propertyId - Property ID from PropertyData API
 * @returns Property data or null if error
 */
export async function fetchPropertyDataById(
  propertyId: string
): Promise<PropertyDataResponse | null> {
  if (!PROPERTYDATA_API_KEY) {
    return {
      success: false,
      error: "PropertyData API key not configured",
    }
  }

  try {
    const params = new URLSearchParams({
      key: PROPERTYDATA_API_KEY,
      property_id: propertyId,
    })

    const url = `${PROPERTYDATA_API_URL}/sourced-property?${params.toString()}`
    
    const response = await fetch(url, {
      method: "GET",
    })

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type")
    if (!contentType || !contentType.includes("application/json")) {
      const errorText = await response.text()
      console.error("PropertyData API returned non-JSON:", response.status, errorText.substring(0, 200))
      return {
        success: false,
        error: `API returned HTML instead of JSON. Status: ${response.status}. Check API endpoint and authentication.`,
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
      console.error("PropertyData API error:", response.status, errorData)
      return {
        success: false,
        error: `API error: ${response.status} - ${errorData.error || errorData.message || "Unknown error"}`,
      }
    }

    const data = await response.json()
    
    // Transform PropertyData API response to our format
    if (data.status !== "success" || !data.property) {
      return {
        success: false,
        error: data.error || "Property not found",
      }
    }

    const property = data.property

    // Handle null/undefined values properly
    const squareFeet = property.sqf !== null && property.sqf !== undefined 
      ? Number(property.sqf) 
      : undefined
    
    const price = property.price !== null && property.price !== undefined
      ? Number(property.price)
      : undefined

    // Map property type to our form's expected values
    const mappedPropertyType = mapPropertyType(property.type)

    // Fetch rental data if postcode is available
    let rentalData = null
    if (property.postcode) {
      console.log(`[PropertyData] Fetching rental data for postcode: ${property.postcode}, bedrooms: ${property.bedrooms}`)
      rentalData = await fetchRentalData(
        property.postcode,
        property.bedrooms !== null && property.bedrooms !== undefined ? Number(property.bedrooms) : undefined,
        property.type || undefined
      )
    }

    // Fetch detailed valuation if we have enough data
    let valuationData = null
    if (property.postcode && squareFeet && squareFeet >= 300 && property.bedrooms !== null && property.bedrooms !== undefined) {
      // Map property type for valuation API (must be: flat, house, bungalow, maisonette)
      let valuationPropertyType = "flat" // Default
      if (property.type) {
        const normalizedType = property.type.toLowerCase().trim()
        if (normalizedType.includes("flat") || normalizedType.includes("apartment")) {
          valuationPropertyType = "flat"
        } else if (normalizedType.includes("house") || normalizedType.includes("detached") || normalizedType.includes("semi") || normalizedType.includes("terraced")) {
          valuationPropertyType = "house"
        } else if (normalizedType.includes("bungalow")) {
          valuationPropertyType = "bungalow"
        } else if (normalizedType.includes("maisonette")) {
          valuationPropertyType = "maisonette"
        }
      }
      
      // Use default values for missing fields (API expects specific values)
      const bathrooms = 1 // Default to 1 if not available
      const constructionDate = "unknown" // Options: pre_1914, 1914_1945, 1945_1965, 1965_1980, 1980_2000, 2000_2010, 2010_onwards, unknown
      const finishQuality = "average" // Options: below_average, average, above_average
      const outdoorSpace = "none" // Options: none, balcony, garden, large_garden
      const offStreetParking = 0 // 0-3 spaces
      
      console.log(`[PropertyData] Fetching detailed valuation for postcode: ${property.postcode}, type: ${valuationPropertyType}, sqft: ${squareFeet}`)
      valuationData = await fetchPropertyValuation(
        property.postcode,
        valuationPropertyType,
        squareFeet,
        Number(property.bedrooms),
        bathrooms,
        constructionDate,
        finishQuality,
        outdoorSpace,
        offStreetParking
      )
    }

    // Use valuation estimate if available, otherwise use price from property data
    const marketValue = valuationData?.estimate || price

    // Calculate rental yield if we have both market value and rental data
    let estimatedRentalYield: number | undefined = undefined
    if (marketValue && rentalData?.monthlyRent) {
      const annualRent = rentalData.monthlyRent * 12
      estimatedRentalYield = (annualRent / marketValue) * 100
    }

    console.log(`[PropertyData] Mapped property data:`, {
      address: property.address,
      bedrooms: property.bedrooms,
      squareFeet,
      propertyType: property.type,
      mappedPropertyType,
      askingPrice: price,
      marketValue: marketValue,
      valuationEstimate: valuationData?.estimate,
      valuationMargin: valuationData?.margin,
      postcode: property.postcode,
      monthlyRent: rentalData?.monthlyRent,
      rentalYield: estimatedRentalYield,
    })

    return {
      success: true,
      data: {
        // Include address from API response
        address: property.address || undefined,
        bedrooms: property.bedrooms !== null && property.bedrooms !== undefined ? Number(property.bedrooms) : undefined,
        bathrooms: undefined, // Not in API response - PropertyData API doesn't provide this
        squareFeet: squareFeet,
        propertyType: mappedPropertyType, // Mapped to our form's expected values
        yearBuilt: undefined, // Not in API response
        epcRating: undefined, // Not in API response
        estimatedValue: marketValue, // Use valuation estimate if available, otherwise use asking price
        valueRange: valuationData ? {
          min: valuationData.minValue,
          max: valuationData.maxValue,
        } : undefined,
        comparables: undefined, // Not in API response
        estimatedRentalYield: estimatedRentalYield,
        estimatedMonthlyRent: rentalData?.monthlyRent,
        areaAverageRent: rentalData?.monthlyRent, // Use same value for area average
        areaStats: undefined, // Not in API response
        recentSales: undefined, // Not in API response
        latitude: property.lat ? Number(property.lat) : undefined,
        longitude: property.lng ? Number(property.lng) : undefined,
        postcode: property.postcode || undefined,
      },
      creditsUsed: (rentalData ? 1 : 0) + (valuationData ? 1 : 0) + 1, // 1 for property data, 1 for rental, 1 for valuation
    }
  } catch (error) {
    console.error("Error fetching property data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Fetch property data from PropertyData API
 * 
 * This function searches for properties by postcode first, then fetches details
 * for the first matching property. Alternatively, you can use property_id directly.
 * 
 * @param address - Full property address (used for matching)
 * @param postcode - UK postcode (required for searching)
 * @param propertyId - Optional property ID for direct lookup
 * @returns Property data or null if error
 */
/**
 * Map PropertyData property type to our form's expected values
 */
function mapPropertyType(propertyType: string | undefined | null): "terraced" | "semi" | "detached" | "flat" | undefined {
  if (!propertyType) return undefined
  
  const normalized = propertyType.toLowerCase().trim()
  
  // Map common PropertyData types to our form values
  if (normalized.includes("flat") || normalized.includes("apartment")) {
    return "flat"
  }
  if (normalized.includes("detached")) {
    return "detached"
  }
  if (normalized.includes("semi") || normalized.includes("semi-detached")) {
    return "semi"
  }
  if (normalized.includes("terraced") || normalized.includes("terrace")) {
    return "terraced"
  }
  
  // Default to undefined if no match
  return undefined
}

/**
 * Extract UK postcode from address string
 * UK postcode format: AA9 9AA or A9 9AA or A99 9AA or AA99 9AA
 */
function extractPostcode(address: string): string | null {
  // UK postcode regex: matches patterns like N7 8TY, SW1A 1AA, etc.
  const postcodeRegex = /\b([A-Z]{1,2}\d{1,2}\s?\d[A-Z]{2})\b/i
  const match = address.match(postcodeRegex)
  return match ? match[1].replace(/\s+/g, " ").trim() : null
}

export async function fetchPropertyData(
  address: string,
  postcode?: string | null,
  propertyId?: string
): Promise<PropertyDataResponse | null> {
  if (!PROPERTYDATA_API_KEY) {
    return {
      success: false,
      error: "PropertyData API key not configured",
    }
  }

  // If property_id is provided, fetch directly
  if (propertyId) {
    return fetchPropertyDataById(propertyId)
  }

  // Extract postcode from address if not provided
  let searchPostcode = postcode || extractPostcode(address)
  
  if (!searchPostcode) {
    return {
      success: false,
      error: "Postcode is required. Please provide a postcode or include it in the address.",
    }
  }

  // Clean up postcode (remove extra spaces)
  searchPostcode = searchPostcode.replace(/\s+/g, " ").trim()

  console.log(`[PropertyData] Searching for: address="${address}", postcode="${searchPostcode}"`)

  try {
    // Search for properties in the area
    const searchResults = await searchProperties(searchPostcode, "repossessed-properties", 20, undefined, 50)
    
    console.log(`[PropertyData] Search returned ${searchResults?.properties?.length || 0} properties`)
    
    if (!searchResults || searchResults.properties.length === 0) {
      return {
        success: false,
        error: `No properties found for postcode ${searchPostcode}. Try a different postcode or property list.`,
      }
    }

    // Try to find a matching property by address
    // Normalize addresses for comparison
    const normalizedAddress = address.toLowerCase().trim().replace(/\s+/g, " ")
    // Extract key parts of address (street name, number) for better matching
    const addressParts = normalizedAddress.split(/\s+/).filter(part => 
      part.length > 2 && !/^\d+$/.test(part) // Filter out short words and pure numbers
    )
    console.log(`[PropertyData] Looking for match with normalized address: "${normalizedAddress}"`)
    console.log(`[PropertyData] Address key parts:`, addressParts)
    
    let matchingProperty = searchResults.properties.find((p: any) => {
      const propAddress = (p.address?.toLowerCase() || "").replace(/\s+/g, " ")
      
      // Try multiple matching strategies
      // 1. Exact substring match
      const exactMatch = propAddress.includes(normalizedAddress) || normalizedAddress.includes(propAddress)
      
      // 2. Match by key words (street name, etc.)
      const keyWordMatch = addressParts.length > 0 && addressParts.some(part => 
        propAddress.includes(part) && part.length > 3
      )
      
      // 3. Match by street number if present
      const streetNumberMatch = /^\d+/.test(normalizedAddress) && 
        propAddress.match(/^\d+[a-z]?/) && 
        normalizedAddress.match(/^\d+[a-z]?/)?.[0] === propAddress.match(/^\d+[a-z]?/)?.[0]
      
      const addressMatch = exactMatch || keyWordMatch || streetNumberMatch
      console.log(`[PropertyData] Comparing: "${propAddress}" with "${normalizedAddress}" -> ${addressMatch} (exact: ${exactMatch}, keywords: ${keyWordMatch}, number: ${streetNumberMatch})`)
      return addressMatch
    })

    // If no exact match, warn but still use first property
    let matchWarning: string | undefined
    if (!matchingProperty) {
      console.warn(`[PropertyData] ⚠️ No exact match found for "${address}" in search results`)
      console.warn(`[PropertyData] Available properties:`, searchResults.properties.map((p: any) => p.address))
      console.warn(`[PropertyData] Using first property: ${searchResults.properties[0].address} (${searchResults.properties[0].id})`)
      matchingProperty = searchResults.properties[0]
      matchWarning = `No exact match found for "${address}". Showing data for "${matchingProperty.address}" instead.`
    } else {
      console.log(`[PropertyData] ✅ Found matching property: ${matchingProperty.address} (${matchingProperty.id})`)
    }

    // Fetch detailed data for the matching property
    const propertyData = await fetchPropertyDataById(matchingProperty.id)
    console.log(`[PropertyData] Fetched property data:`, propertyData?.success ? "success" : "failed")
    
    // Add warning to response if no exact match
    if (propertyData && matchWarning) {
      propertyData.warning = matchWarning
    }
    
    return propertyData
  } catch (error) {
    console.error("[PropertyData] Error fetching property data:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Get analysis insights from property data
 */
export function getPropertyAnalysis(
  propertyData: PropertyDataResponse,
  askingPrice?: number
): {
  insights: string[]
  recommendations: string[]
  riskFactors: string[]
} {
  const insights: string[] = []
  const recommendations: string[] = []
  const riskFactors: string[] = []

  if (!propertyData.data) {
    return { insights, recommendations, riskFactors }
  }

  const { data } = propertyData

  // BMV Analysis
  if (data.estimatedValue && askingPrice) {
    const bmv = ((data.estimatedValue - askingPrice) / data.estimatedValue) * 100
    if (bmv > 20) {
      insights.push(`Excellent BMV opportunity: ${bmv.toFixed(1)}% below market value`)
      recommendations.push("This is a strong investment opportunity with significant discount")
    } else if (bmv > 10) {
      insights.push(`Good BMV: ${bmv.toFixed(1)}% below market value`)
    } else if (bmv < 0) {
      riskFactors.push(`Property is priced ${Math.abs(bmv).toFixed(1)}% above estimated market value`)
    }
  }

  // Rental Yield Analysis
  if (data.estimatedRentalYield) {
    if (data.estimatedRentalYield > 8) {
      insights.push(`Strong rental yield: ${data.estimatedRentalYield.toFixed(1)}%`)
      recommendations.push("Excellent for buy-to-let investment")
    } else if (data.estimatedRentalYield < 5) {
      riskFactors.push(`Low rental yield: ${data.estimatedRentalYield.toFixed(1)}% - may not cover costs`)
    }
  }

  // Area Growth Analysis
  if (data.areaStats) {
    if (data.areaStats.growthLastYear > 5) {
      insights.push(`Strong area growth: ${data.areaStats.growthLastYear.toFixed(1)}% in last year`)
    }
    if (data.areaStats.growthLast5Years > 20) {
      insights.push(`Excellent long-term growth: ${data.areaStats.growthLast5Years.toFixed(1)}% over 5 years`)
    } else if (data.areaStats.growthLast5Years < 0) {
      riskFactors.push(`Area showing negative growth: ${data.areaStats.growthLast5Years.toFixed(1)}% over 5 years`)
    }
  }

  // Comparables Analysis
  if (data.comparables && data.comparables.length > 0) {
    const avgComparablePrice = data.comparables.reduce((sum, c) => sum + c.salePrice, 0) / data.comparables.length
    if (askingPrice && askingPrice < avgComparablePrice * 0.9) {
      insights.push(`Priced below comparable sales average (${avgComparablePrice.toLocaleString('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 })})`)
    }
    insights.push(`${data.comparables.length} comparable sales found in the area`)
  }

  // EPC Rating
  if (data.epcRating) {
    if (['A', 'B', 'C'].includes(data.epcRating)) {
      insights.push(`Good EPC rating: ${data.epcRating} - energy efficient`)
    } else if (['F', 'G'].includes(data.epcRating)) {
      riskFactors.push(`Poor EPC rating: ${data.epcRating} - may require energy improvements`)
      recommendations.push("Consider energy efficiency improvements to increase value")
    }
  }

  return { insights, recommendations, riskFactors }
}

/**
 * Detailed Comparable Property interface with rental data
 */
export interface DetailedComparableProperty extends SoldProperty {
  // Rental Data
  monthlyRent?: number
  weeklyRent?: number
  rentalYield?: number
  rentalYieldMin?: number
  rentalYieldMax?: number
  areaAverageRent?: number

  // Enhanced Property Data
  bathrooms?: number
  squareFeet?: number

  // Market Data
  daysOnMarket?: number
  priceReductions?: number

  // Source Links
  listingSource?: 'rightmove' | 'zoopla' | 'onthemarket' | 'multiple'
  listingUrl?: string
  listingUrlSecondary?: string // Secondary portal link (e.g., Zoopla)
  propertyDataId?: string

  // Calculated Fields
  pricePerSqft?: number
  grossYield?: number // Annual rental income / purchase price
}

/**
 * Fetch detailed comparable properties with rental data
 *
 * This function combines sold prices with rental data to provide
 * comprehensive comparable analysis including investment potential
 *
 * @param postcode - UK postcode
 * @param bedrooms - Number of bedrooms
 * @param propertyType - Property type filter
 * @param searchRadius - Search radius in miles (default: 3)
 * @param maxResults - Maximum comparables to return (default: 5)
 * @param maxAgeMonths - Maximum age of sold properties (default: 12)
 * @returns Detailed comparables with rental data and yields
 */
export async function fetchDetailedComparables(
  postcode: string,
  bedrooms?: number,
  propertyType?: string,
  searchRadius: number = 3,
  maxResults: number = 5,
  maxAgeMonths: number = 12
): Promise<{
  comparables: DetailedComparableProperty[]
  avgSalePrice: number | null
  avgRentalYield: number | null
  priceRange: { min: number; max: number } | null
  rentalYieldRange: { min: number; max: number } | null
  creditsUsed: number
} | null> {
  if (!PROPERTYDATA_API_KEY) {
    console.warn("[PropertyData] API key not configured")
    return null
  }

  try {
    let totalCreditsUsed = 0

    // Step 1: Fetch sold prices (comparables)
    console.log(`[PropertyData] Fetching sold prices for postcode: ${postcode}`)
    const soldPricesResult = await fetchSoldPrices(
      postcode,
      bedrooms,
      searchRadius,
      maxResults * 2 // Fetch more to account for filtering
    )

    if (!soldPricesResult || soldPricesResult.soldProperties.length === 0) {
      console.log("[PropertyData] No sold properties found")
      return {
        comparables: [],
        avgSalePrice: null,
        avgRentalYield: null,
        priceRange: null,
        rentalYieldRange: null,
        creditsUsed: soldPricesResult?.creditsUsed || 0,
      }
    }

    totalCreditsUsed += soldPricesResult.creditsUsed

    // Step 2: Filter comparables by age, bedrooms, property type
    const filteredComparables = filterComparables(
      soldPricesResult.soldProperties,
      bedrooms,
      propertyType,
      maxAgeMonths,
      maxResults
    )

    console.log(`[PropertyData] Filtered to ${filteredComparables.length} comparables`)

    if (filteredComparables.length === 0) {
      return {
        comparables: [],
        avgSalePrice: null,
        avgRentalYield: null,
        priceRange: null,
        rentalYieldRange: null,
        creditsUsed: totalCreditsUsed,
      }
    }

    // Step 3: Fetch rental data for the area (1 credit for area rental data)
    console.log(`[PropertyData] Fetching rental data for area: ${postcode}, bedrooms: ${bedrooms}`)
    const rentalData = await fetchRentalData(postcode, bedrooms, propertyType)

    if (rentalData) {
      console.log(`[PropertyData] ✅ Rental data fetched successfully:`, {
        weeklyRent: rentalData.weeklyRent,
        monthlyRent: rentalData.monthlyRent,
        confidenceMin: rentalData.confidenceRange.min,
        confidenceMax: rentalData.confidenceRange.max,
      })
      totalCreditsUsed += 1 // Rental data costs 1 credit
    } else {
      console.warn(`[PropertyData] ⚠️ No rental data returned from API for ${postcode}`)
    }

    // Step 4: Enrich each comparable with rental data and calculated fields
    const detailedComparables: DetailedComparableProperty[] = filteredComparables.map((comp) => {
      const detailed: DetailedComparableProperty = {
        ...comp,
      }

      // Add rental data if available
      if (rentalData) {
        detailed.monthlyRent = rentalData.monthlyRent
        detailed.weeklyRent = rentalData.weeklyRent
        detailed.areaAverageRent = rentalData.monthlyRent

        // Calculate rental yield: (Annual Rent / Sale Price) * 100
        if (comp.salePrice > 0) {
          const annualRent = rentalData.monthlyRent * 12
          detailed.rentalYield = Number(((annualRent / comp.salePrice) * 100).toFixed(2))
          detailed.grossYield = detailed.rentalYield

          // Calculate yield range based on rental confidence range
          if (rentalData.confidenceRange) {
            const annualRentMin = rentalData.confidenceRange.min * 12
            const annualRentMax = rentalData.confidenceRange.max * 12
            detailed.rentalYieldMin = Number(((annualRentMin / comp.salePrice) * 100).toFixed(2))
            detailed.rentalYieldMax = Number(((annualRentMax / comp.salePrice) * 100).toFixed(2))
          }
        }

        console.log(`[PropertyData] Enriched comparable ${comp.address} with rental data: £${detailed.monthlyRent}/mo, yield: ${detailed.rentalYield}%`)
      } else {
        console.log(`[PropertyData] No rental data to enrich comparable: ${comp.address}`)
      }

      // Generate listing URLs - Multiple portals for better coverage
      // IMPORTANT: Always use the comparable's actual postcode, not the search postcode
      const compPostcode = comp.postcode || postcode
      if (compPostcode) {
        const propertyPostcode = compPostcode.replace(/\s+/g, '-').toLowerCase()
        const propertyAddress = comp.address.split(',')[0].trim() // Get first part of address

        // Rightmove House Prices - shows all sales in postcode
        const rightmoveUrl = `https://www.rightmove.co.uk/house-prices/${propertyPostcode}.html`

        // Zoopla - includes address in search for better accuracy
        const zooplaUrl = `https://www.zoopla.co.uk/house-prices/${propertyPostcode}/?q=${encodeURIComponent(propertyAddress)}`

        detailed.listingSource = 'multiple'
        detailed.listingUrl = rightmoveUrl // Primary link (Rightmove)
        detailed.listingUrlSecondary = zooplaUrl // Secondary link (Zoopla)

        console.log(`[PropertyData] Generated links for ${comp.address} (${compPostcode}): Rightmove=${rightmoveUrl}`)
      }

      return detailed
    })

    // Calculate statistics
    const salePrices = detailedComparables.map((c) => c.salePrice)
    const avgSalePrice = salePrices.length > 0
      ? Math.round(salePrices.reduce((sum, p) => sum + p, 0) / salePrices.length)
      : null

    const priceRange = salePrices.length > 0
      ? { min: Math.min(...salePrices), max: Math.max(...salePrices) }
      : null

    const rentalYields = detailedComparables
      .map((c) => c.rentalYield)
      .filter((y): y is number => y !== undefined)

    const avgRentalYield = rentalYields.length > 0
      ? Number((rentalYields.reduce((sum, y) => sum + y, 0) / rentalYields.length).toFixed(2))
      : null

    const rentalYieldRange = rentalYields.length > 0
      ? { min: Math.min(...rentalYields), max: Math.max(...rentalYields) }
      : null

    console.log(`[PropertyData] Detailed comparables summary:`, {
      count: detailedComparables.length,
      avgSalePrice,
      avgRentalYield,
      creditsUsed: totalCreditsUsed,
    })

    return {
      comparables: detailedComparables,
      avgSalePrice,
      avgRentalYield,
      priceRange,
      rentalYieldRange,
      creditsUsed: totalCreditsUsed,
    }
  } catch (error) {
    console.error("[PropertyData] Error fetching detailed comparables:", error)
    return null
  }
}

