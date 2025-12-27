/**
 * API Route: POST /api/vendor-leads/[id]/fetch-comparables
 * Fetch and store detailed comparable properties from PropertyData API
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import {
  fetchSoldPrices,
  filterComparables,
  calculateAverageComparablePrice,
  fetchDetailedComparables,
  DetailedComparableProperty,
} from "@/lib/propertydata"

/**
 * Calculate confidence score for a comparable property
 * Based on: recency, distance, similarity, data completeness
 */
function calculateConfidenceScore(
  comparable: {
    saleDate: string
    distance?: number
    bedrooms: number
    propertyType: string
    squareFeet?: number
  },
  targetBedrooms?: number,
  targetPropertyType?: string
): number {
  let score = 1.0

  // Recency factor (0.7 to 1.0)
  const saleDate = new Date(comparable.saleDate)
  const monthsAgo = (Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  if (monthsAgo <= 6) {
    score *= 1.0 // Last 6 months = full score
  } else if (monthsAgo <= 12) {
    score *= 0.9 // 6-12 months = 90%
  } else if (monthsAgo <= 18) {
    score *= 0.8 // 12-18 months = 80%
  } else {
    score *= 0.7 // 18+ months = 70%
  }

  // Distance factor (0.7 to 1.0)
  if (comparable.distance !== undefined) {
    if (comparable.distance <= 0.5) {
      score *= 1.0 // Under 0.5 miles = full score
    } else if (comparable.distance <= 1) {
      score *= 0.95 // 0.5-1 mile = 95%
    } else if (comparable.distance <= 2) {
      score *= 0.9 // 1-2 miles = 90%
    } else if (comparable.distance <= 3) {
      score *= 0.85 // 2-3 miles = 85%
    } else {
      score *= 0.7 // 3+ miles = 70%
    }
  }

  // Bedroom similarity factor (0.8 to 1.0)
  if (targetBedrooms && comparable.bedrooms) {
    const bedroomDiff = Math.abs(comparable.bedrooms - targetBedrooms)
    if (bedroomDiff === 0) {
      score *= 1.0 // Exact match = full score
    } else if (bedroomDiff === 1) {
      score *= 0.9 // ±1 bedroom = 90%
    } else {
      score *= 0.8 // ±2 bedrooms = 80%
    }
  }

  // Property type similarity factor (0.85 to 1.0)
  if (targetPropertyType && comparable.propertyType) {
    const targetType = targetPropertyType.toLowerCase()
    const compType = comparable.propertyType.toLowerCase()

    if (compType.includes(targetType) || targetType.includes(compType)) {
      score *= 1.0 // Exact match = full score
    } else if (
      (targetType.includes("house") && compType.includes("house")) ||
      (targetType.includes("flat") && compType.includes("flat"))
    ) {
      score *= 0.95 // Same category = 95%
    } else {
      score *= 0.85 // Different type = 85%
    }
  }

  // Data completeness factor (0.9 to 1.0)
  const hasDistance = comparable.distance !== undefined
  const hasSquareFeet = comparable.squareFeet !== undefined && comparable.squareFeet > 0
  const completeness = (hasDistance ? 0.5 : 0) + (hasSquareFeet ? 0.5 : 0)
  score *= 0.9 + (completeness * 0.1)

  return Math.max(0, Math.min(1, score)) // Clamp between 0 and 1
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const forceRefresh = body.forceRefresh ?? false

    // Fetch the vendor lead
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        propertyPostcode: true,
        bedrooms: true,
        propertyType: true,
        askingPrice: true,
        comparablesFetchedAt: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    // Check if postcode is available
    if (!lead.propertyPostcode) {
      return NextResponse.json(
        { error: "Property postcode is required to fetch comparables" },
        { status: 400 }
      )
    }

    // Check if recently fetched (unless force refresh)
    if (!forceRefresh && lead.comparablesFetchedAt) {
      const hoursSinceFetch = (Date.now() - lead.comparablesFetchedAt.getTime()) / (1000 * 60 * 60)
      if (hoursSinceFetch < 24) {
        // Fetch from database instead
        const existingComparables = await prisma.comparableProperty.findMany({
          where: { vendorLeadId: params.id },
          orderBy: [{ distance: "asc" }, { saleDate: "desc" }],
        })

        if (existingComparables.length > 0) {
          console.log(`[Fetch Comparables] Using cached comparables (fetched ${hoursSinceFetch.toFixed(1)}h ago)`)

          const prices = existingComparables.map((c) => c.salePrice.toNumber())
          const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)

          return NextResponse.json({
            success: true,
            cached: true,
            message: `Using cached comparables from ${lead.comparablesFetchedAt.toLocaleString()}`,
            data: {
              comparables: existingComparables.map((c) => ({
                id: c.id,
                address: c.address,
                salePrice: c.salePrice.toNumber(),
                saleDate: c.saleDate.toISOString(),
                bedrooms: c.bedrooms,
                distance: c.distance?.toNumber(),
              })),
              count: existingComparables.length,
              avgPrice,
              creditsUsed: 0,
            },
          })
        }
      }
    }

    // Get user's config or defaults
    const userConfig = await prisma.comparablesConfig.findUnique({
      where: { userId: session.user.id },
    })

    const searchRadius = body.searchRadius ?? userConfig?.searchRadius ?? 3
    const maxResults = body.maxResults ?? userConfig?.maxResults ?? 50
    const maxAgeMonths = userConfig?.maxAgeMonths ?? 12
    const bedroomTolerance = userConfig?.bedroomTolerance ?? 1

    console.log(`[Fetch Comparables] Fetching detailed comparables for lead ${params.id}:`, {
      postcode: lead.propertyPostcode,
      bedrooms: lead.bedrooms,
      propertyType: lead.propertyType,
      searchRadius,
      maxResults,
      maxAgeMonths,
    })

    // Fetch detailed comparables with rental data from PropertyData API
    const detailedResult = await fetchDetailedComparables(
      lead.propertyPostcode,
      lead.bedrooms || undefined,
      lead.propertyType || undefined,
      searchRadius,
      maxResults,
      maxAgeMonths
    )

    if (!detailedResult) {
      return NextResponse.json(
        { error: "Failed to fetch comparables from PropertyData API" },
        { status: 500 }
      )
    }

    console.log(`[Fetch Comparables] Found ${detailedResult.comparables.length} detailed comparables`)
    console.log(`[Fetch Comparables] Average rental yield: ${detailedResult.avgRentalYield ? detailedResult.avgRentalYield + '%' : 'N/A'}`)

    if (detailedResult.comparables.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          comparables: [],
          count: 0,
          avgPrice: null,
          avgRentalYield: null,
          confidence: "LOW",
          creditsUsed: detailedResult.creditsUsed,
          message: `No comparable properties found within ${searchRadius} miles. Try increasing the search radius.`,
        },
      })
    }

    // Delete old comparables for this lead
    await prisma.comparableProperty.deleteMany({
      where: { vendorLeadId: params.id },
    })

    // Store new comparables in database with confidence scores, rental data, and listing URLs
    const storedComparables = await Promise.all(
      detailedResult.comparables.map(async (comp: DetailedComparableProperty, index) => {
        const confidence = calculateConfidenceScore(
          {
            saleDate: comp.saleDate,
            distance: comp.distance,
            bedrooms: comp.bedrooms,
            propertyType: comp.propertyType,
            squareFeet: comp.squareFeet,
          },
          lead.bedrooms || undefined,
          lead.propertyType || undefined
        )

        // Log rental data before saving
        console.log(`[Fetch Comparables] Comparable ${index + 1}: ${comp.address}`)
        console.log(`  Monthly Rent: ${comp.monthlyRent ? '£' + comp.monthlyRent : 'NULL'}`)
        console.log(`  Rental Yield: ${comp.rentalYield ? comp.rentalYield + '%' : 'NULL'}`)

        return prisma.comparableProperty.create({
          data: {
            vendorLeadId: params.id,
            address: comp.address,
            postcode: comp.postcode || lead.propertyPostcode,
            salePrice: comp.salePrice,
            saleDate: new Date(comp.saleDate),
            bedrooms: comp.bedrooms,
            bathrooms: comp.bathrooms,
            propertyType: comp.propertyType,
            squareFeet: comp.squareFeet,
            distance: comp.distance,
            daysOnMarket: comp.daysOnMarket,
            priceReductions: comp.priceReductions || 0,
            // Rental data
            monthlyRent: comp.monthlyRent,
            weeklyRent: comp.weeklyRent,
            rentalYield: comp.rentalYield,
            rentalYieldMin: comp.rentalYieldMin,
            rentalYieldMax: comp.rentalYieldMax,
            areaAverageRent: comp.areaAverageRent,
            // Source information
            listingSource: comp.listingSource,
            listingUrl: comp.listingUrl,
            listingUrlSecondary: comp.listingUrlSecondary,
            propertyDataId: comp.propertyDataId,
            confidence,
            notes: null,
          },
        })
      })
    )

    console.log(`[Fetch Comparables] Stored ${storedComparables.length} comparables with rental data in database`)

    // Calculate statistics
    const avgPrice = detailedResult.avgSalePrice
    const minPrice = detailedResult.priceRange?.min || 0
    const maxPrice = detailedResult.priceRange?.max || 0
    const avgRentalYield = detailedResult.avgRentalYield

    // Calculate overall confidence
    const avgConfidence = storedComparables.reduce((sum, c) => sum + c.confidence.toNumber(), 0) / storedComparables.length
    let overallConfidence: "HIGH" | "MEDIUM" | "LOW" = "LOW"

    if (storedComparables.length >= 5 && avgConfidence >= 0.8) {
      overallConfidence = "HIGH"
    } else if (storedComparables.length >= 3 && avgConfidence >= 0.6) {
      overallConfidence = "MEDIUM"
    }

    // Update vendor lead with comparables stats
    await prisma.vendorLead.update({
      where: { id: params.id },
      data: {
        comparablesCount: storedComparables.length,
        comparablesFetchedAt: new Date(),
        comparablesSearchRadius: searchRadius,
        avgComparablePrice: avgPrice,
        comparablesConfidence: overallConfidence,
      },
    })

    console.log(`[Fetch Comparables] Updated vendor lead with stats:`, {
      count: storedComparables.length,
      avgPrice,
      confidence: overallConfidence,
    })

    // Create pipeline event
    await prisma.pipelineEvent.create({
      data: {
        vendorLeadId: params.id,
        eventType: "comparables_fetched",
        details: {
          description: `Fetched ${storedComparables.length} comparable properties`,
          avgPrice,
          priceRange: { min: minPrice, max: maxPrice },
          searchRadius,
          confidence: overallConfidence,
          creditsUsed: detailedResult.creditsUsed,
        },
      },
    })

    // Format response
    const formattedComparables = storedComparables.map((comp) => ({
      id: comp.id,
      address: comp.address,
      postcode: comp.postcode,
      salePrice: comp.salePrice.toNumber(),
      saleDate: comp.saleDate.toISOString(),
      bedrooms: comp.bedrooms,
      bathrooms: comp.bathrooms,
      propertyType: comp.propertyType,
      squareFeet: comp.squareFeet,
      distance: comp.distance?.toNumber(),
      daysOnMarket: comp.daysOnMarket,
      priceReductions: comp.priceReductions,
      // Rental data
      monthlyRent: comp.monthlyRent?.toNumber(),
      weeklyRent: comp.weeklyRent?.toNumber(),
      rentalYield: comp.rentalYield?.toNumber(),
      rentalYieldMin: comp.rentalYieldMin?.toNumber(),
      rentalYieldMax: comp.rentalYieldMax?.toNumber(),
      areaAverageRent: comp.areaAverageRent?.toNumber(),
      // Source information
      listingSource: comp.listingSource,
      listingUrl: comp.listingUrl,
      confidence: comp.confidence.toNumber(),
      // Calculated fields
      pricePerSqft: comp.squareFeet && comp.squareFeet > 0
        ? Math.round(comp.salePrice.toNumber() / comp.squareFeet)
        : null,
    }))

    return NextResponse.json({
      success: true,
      data: {
        comparables: formattedComparables,
        count: storedComparables.length,
        avgPrice,
        avgRentalYield,
        priceRange: { min: minPrice, max: maxPrice },
        rentalYieldRange: detailedResult.rentalYieldRange,
        confidence: overallConfidence,
        searchRadius,
        creditsUsed: detailedResult.creditsUsed,
      },
    })
  } catch (error: any) {
    console.error("[Fetch Comparables API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch comparables" },
      { status: 500 }
    )
  }
}
