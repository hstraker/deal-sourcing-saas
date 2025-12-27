/**
 * API Route: /api/comparables/config
 * Manage user's comparable property search configuration
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

/**
 * GET /api/comparables/config
 * Get current user's comparables configuration
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Fetch user's config or return defaults
    let config = await prisma.comparablesConfig.findUnique({
      where: { userId: session.user.id },
    })

    // If no config exists, return default values
    if (!config) {
      return NextResponse.json({
        success: true,
        config: {
          searchRadius: 3,
          maxResults: 5,
          maxAgeMonths: 12,
          bedroomTolerance: 1,
          includePropertyTypes: [], // Empty = all types
          minConfidenceScore: 0.7,
        },
      })
    }

    return NextResponse.json({
      success: true,
      config: {
        searchRadius: config.searchRadius,
        maxResults: config.maxResults,
        maxAgeMonths: config.maxAgeMonths,
        bedroomTolerance: config.bedroomTolerance,
        includePropertyTypes: config.includePropertyTypes,
        minConfidenceScore: config.minConfidenceScore.toNumber(),
      },
    })
  } catch (error: any) {
    console.error("[Comparables Config API] GET Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch config" },
      { status: 500 }
    )
  }
}

/**
 * POST /api/comparables/config
 * Save user's comparables configuration
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()

    // Validate inputs
    const searchRadius = body.searchRadius ?? 3
    const maxResults = body.maxResults ?? 5
    const maxAgeMonths = body.maxAgeMonths ?? 12
    const bedroomTolerance = body.bedroomTolerance ?? 1
    const includePropertyTypes = body.includePropertyTypes ?? []
    const minConfidenceScore = body.minConfidenceScore ?? 0.7

    // Validation rules
    if (searchRadius < 0.25 || searchRadius > 10) {
      return NextResponse.json(
        { error: "Search radius must be between 0.25 and 10 miles" },
        { status: 400 }
      )
    }

    if (maxResults < 3 || maxResults > 20) {
      return NextResponse.json(
        { error: "Max results must be between 3 and 20" },
        { status: 400 }
      )
    }

    if (maxAgeMonths < 6 || maxAgeMonths > 24) {
      return NextResponse.json(
        { error: "Max age must be between 6 and 24 months" },
        { status: 400 }
      )
    }

    if (bedroomTolerance < 0 || bedroomTolerance > 2) {
      return NextResponse.json(
        { error: "Bedroom tolerance must be between 0 and 2" },
        { status: 400 }
      )
    }

    if (minConfidenceScore < 0 || minConfidenceScore > 1) {
      return NextResponse.json(
        { error: "Min confidence score must be between 0.0 and 1.0" },
        { status: 400 }
      )
    }

    // Validate property types if provided
    const validTypes = ["terraced", "semi", "detached", "flat"]
    if (includePropertyTypes.length > 0) {
      const invalidTypes = includePropertyTypes.filter((type: string) => !validTypes.includes(type))
      if (invalidTypes.length > 0) {
        return NextResponse.json(
          { error: `Invalid property types: ${invalidTypes.join(", ")}` },
          { status: 400 }
        )
      }
    }

    // Upsert config (create or update)
    const config = await prisma.comparablesConfig.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        searchRadius,
        maxResults,
        maxAgeMonths,
        bedroomTolerance,
        includePropertyTypes,
        minConfidenceScore,
      },
      update: {
        searchRadius,
        maxResults,
        maxAgeMonths,
        bedroomTolerance,
        includePropertyTypes,
        minConfidenceScore,
        updatedAt: new Date(),
      },
    })

    console.log(`[Comparables Config API] Saved config for user ${session.user.id}:`, {
      searchRadius,
      maxResults,
      maxAgeMonths,
      bedroomTolerance,
      includePropertyTypes,
      minConfidenceScore,
    })

    return NextResponse.json({
      success: true,
      config: {
        searchRadius: config.searchRadius,
        maxResults: config.maxResults,
        maxAgeMonths: config.maxAgeMonths,
        bedroomTolerance: config.bedroomTolerance,
        includePropertyTypes: config.includePropertyTypes,
        minConfidenceScore: config.minConfidenceScore.toNumber(),
      },
    })
  } catch (error: any) {
    console.error("[Comparables Config API] POST Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to save config" },
      { status: 500 }
    )
  }
}
