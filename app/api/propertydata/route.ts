import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { fetchPropertyData, getPropertyAnalysis, type PropertyDataResponse } from "@/lib/propertydata"

// GET /api/propertydata?address=...&postcode=... OR ?property_id=...
// Fetch property data with aggressive caching
// 
// Two ways to fetch:
// 1. By address + postcode: searches /sourced-properties, then fetches /sourced-property
// 2. By property_id: directly fetches /sourced-property
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can fetch property data
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get("address")
    const postcode = searchParams.get("postcode")
    const propertyId = searchParams.get("property_id")
    const forceRefresh = searchParams.get("refresh") === "true"

    // If property_id is provided, use it directly
    // Otherwise, either address or postcode is required
    if (!propertyId && !address && !postcode) {
      return NextResponse.json(
        { error: "Either address, postcode, or property_id is required" },
        { status: 400 }
      )
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cacheKey = propertyId 
        ? `property_id:${propertyId}`
        : postcode 
          ? `${address}|${postcode}` 
          : address
      
      const cached = await prisma.propertyDataCache.findFirst({
        where: propertyId
          ? {
              address: `property_id:${propertyId}`, // Store property_id in address field for caching
              postcode: { equals: null },
            }
          : {
              address: address || undefined,
              postcode: postcode || { equals: null },
            },
      })

      if (cached && cached.expiresAt > new Date()) {
        // Return cached data
        return NextResponse.json({
          ...(cached.data as unknown as PropertyDataResponse),
          cached: true,
          fetchedAt: cached.fetchedAt,
        })
      }
    }

    // Fetch from API
    console.log(`[API] Fetching property data: address="${address}", postcode="${postcode}", propertyId="${propertyId}"`)
    const propertyData = await fetchPropertyData(
      address || "", 
      postcode || null,
      propertyId || undefined
    )

    console.log(`[API] Property data result:`, propertyData?.success ? "success" : "failed", propertyData?.error || "")

    if (!propertyData || !propertyData.success) {
      return NextResponse.json(
        {
          success: false,
          error: propertyData?.error || "Failed to fetch property data",
        },
        { status: 500 }
      )
    }
    
    console.log(`[API] Property data fields:`, {
      bedrooms: propertyData.data?.bedrooms,
      squareFeet: propertyData.data?.squareFeet,
      propertyType: propertyData.data?.propertyType,
      estimatedValue: propertyData.data?.estimatedValue,
    })

    // Cache the response (30 days)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Check if exists
    const existing = await prisma.propertyDataCache.findFirst({
      where: propertyId
        ? {
            address: `property_id:${propertyId}`,
            postcode: null,
          }
        : {
            address: address || "",
            postcode: postcode || null,
          },
    })

    if (existing) {
      await prisma.propertyDataCache.update({
        where: { id: existing.id },
        data: {
          data: propertyData as any,
          creditsUsed: propertyData.creditsUsed || 1,
          expiresAt: expiresAt,
          fetchedAt: new Date(),
        },
      })
    } else {
      await prisma.propertyDataCache.create({
        data: {
          address: propertyId ? `property_id:${propertyId}` : (address || ""),
          postcode: propertyId ? null : (postcode || null),
          data: propertyData as any,
          creditsUsed: propertyData.creditsUsed || 1,
          expiresAt: expiresAt,
        },
      })
    }

    // Get analysis insights
    const analysis = getPropertyAnalysis(propertyData)

    return NextResponse.json({
      ...propertyData,
      analysis,
      cached: false,
      fetchedAt: new Date(),
    })
  } catch (error) {
    console.error("Error fetching property data:", error)
    
    // Log full error for debugging
    if (error instanceof Error) {
      console.error("Error stack:", error.stack)
    }
    
    // Always return JSON, never HTML
    return NextResponse.json(
      { 
        success: false,
        error: "Failed to fetch property data", 
        details: error instanceof Error ? error.message : "Unknown error",
        // Include helpful debugging info in development
        ...(process.env.NODE_ENV === "development" && {
          stack: error instanceof Error ? error.stack : undefined
        })
      },
      { 
        status: 500,
        headers: {
          "Content-Type": "application/json"
        }
      }
    )
  }
}

// Note: Usage stats endpoint moved to app/api/propertydata/usage/route.ts

