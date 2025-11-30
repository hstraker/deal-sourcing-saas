import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { searchProperties } from "@/lib/propertydata"

// GET /api/propertydata/search?postcode=...&list=...&radius=...&results=...
// Search for properties by postcode and return a list
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can search properties
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const postcode = searchParams.get("postcode")
    // Support multiple lists: ?lists=repossessed-properties,reduced-properties or ?list=repossessed-properties
    const listsParam = searchParams.get("lists") || searchParams.get("list")
    const lists = listsParam 
      ? listsParam.split(",").map(l => l.trim()).filter(Boolean)
      : ["repossessed-properties", "reduced-properties", "quick-sale-properties", "properties-with-no-chain"] // Default to multiple relevant lists
    const radius = parseInt(searchParams.get("radius") || "5") // Default to 5 miles for more relevant results
    const maxAge = searchParams.get("max_age") ? parseInt(searchParams.get("max_age")!) : undefined
    const results = parseInt(searchParams.get("results") || "20") // Get more results to allow filtering

    if (!postcode) {
      return NextResponse.json(
        { error: "Postcode is required" },
        { status: 400 }
      )
    }

    console.log(`[API] Searching properties: postcode="${postcode}", lists=[${lists.join(", ")}], radius=${radius}, results=${results}`)

    const searchResults = await searchProperties(postcode, lists, radius, maxAge, results)

    if (!searchResults) {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to search properties",
        },
        { status: 500 }
      )
    }

    if (searchResults.properties.length === 0) {
      return NextResponse.json(
        {
          success: true,
          properties: [],
          message: `No properties found for postcode ${postcode}`,
        },
        { status: 200 }
      )
    }

    console.log(`[API] Found ${searchResults.properties.length} properties`)

    // Sort properties: exact postcode matches first, then by distance
    const searchPostcodeUpper = postcode.toUpperCase().replace(/\s+/g, " ")
    const sortedProperties = [...searchResults.properties].sort((a, b) => {
      const aPostcode = (a.postcode || "").toUpperCase().replace(/\s+/g, " ")
      const bPostcode = (b.postcode || "").toUpperCase().replace(/\s+/g, " ")
      
      const aIsExact = aPostcode === searchPostcodeUpper
      const bIsExact = bPostcode === searchPostcodeUpper
      
      // Exact matches first
      if (aIsExact && !bIsExact) return -1
      if (!aIsExact && bIsExact) return 1
      
      // Then sort by distance
      const aDistance = parseFloat(a.distance_to || "999")
      const bDistance = parseFloat(b.distance_to || "999")
      return aDistance - bDistance
    })
    
    // Ensure sourceList and sourceListLabel are preserved
    const propertiesWithSource = sortedProperties.map(prop => ({
      ...prop,
      sourceList: prop.sourceList || "unknown",
      sourceListLabel: prop.sourceListLabel || "Unknown",
    }))

    return NextResponse.json({
      success: true,
      properties: propertiesWithSource,
      apiCallsCost: searchResults.apiCallsCost,
      count: propertiesWithSource.length,
      searchPostcode: postcode,
    })
  } catch (error) {
    console.error("Error searching properties:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to search properties",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

