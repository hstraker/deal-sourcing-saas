/**
 * API Route: GET /api/comparables/top-yields
 * Fetch comparable properties with highest rental yields
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "10")

    // Fetch comparables with highest rental yields
    const comparables = await prisma.comparableProperty.findMany({
      where: {
        rentalYield: {
          not: null,
        },
      },
      take: Math.min(limit, 50), // Max 50
      orderBy: {
        rentalYield: "desc",
      },
      select: {
        id: true,
        vendorLeadId: true,
        address: true,
        postcode: true,
        salePrice: true,
        saleDate: true,
        bedrooms: true,
        propertyType: true,
        distance: true,
        rentalYield: true,
        monthlyRent: true,
      },
    })

    // Format response
    const formattedComparables = comparables.map((comp) => ({
      id: comp.id,
      vendorLeadId: comp.vendorLeadId,
      address: comp.address,
      postcode: comp.postcode,
      salePrice: comp.salePrice.toNumber(),
      saleDate: comp.saleDate.toISOString(),
      bedrooms: comp.bedrooms,
      propertyType: comp.propertyType,
      distance: comp.distance?.toNumber(),
      rentalYield: comp.rentalYield!.toNumber(),
      monthlyRent: comp.monthlyRent?.toNumber(),
    }))

    return NextResponse.json({
      success: true,
      comparables: formattedComparables,
      count: formattedComparables.length,
    })
  } catch (error: any) {
    console.error("[Top Yields API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch top yields" },
      { status: 500 }
    )
  }
}
