/**
 * API Route: GET /api/vendor-leads/[id]/comparables
 * Retrieve stored comparable properties for a vendor lead
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET(
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

    // Fetch the vendor lead to verify it exists
    const lead = await prisma.vendorLead.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        propertyAddress: true,
        propertyPostcode: true,
        askingPrice: true,
        avgComparablePrice: true,
        comparablesCount: true,
        comparablesFetchedAt: true,
        comparablesSearchRadius: true,
        comparablesConfidence: true,
      },
    })

    if (!lead) {
      return NextResponse.json({ error: "Vendor lead not found" }, { status: 404 })
    }

    // Fetch stored comparables
    const comparables = await prisma.comparableProperty.findMany({
      where: { vendorLeadId: params.id },
      orderBy: [
        { distance: "asc" }, // Closest first
        { saleDate: "desc" }, // Most recent first
      ],
    })

    if (comparables.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          comparables: [],
          count: 0,
          avgPrice: null,
          priceRange: null,
          confidence: null,
          lastFetchedAt: null,
          message: "No comparables have been fetched yet. Click 'Fetch Comparables' to get started.",
        },
      })
    }

    // Calculate statistics
    const prices = comparables.map((c) => c.salePrice.toNumber())
    const avgPrice = Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length)
    const minPrice = Math.min(...prices)
    const maxPrice = Math.max(...prices)

    // Calculate rental yield statistics
    const rentalYields = comparables
      .map((c) => c.rentalYield?.toNumber())
      .filter((y): y is number => y !== undefined && y !== null)

    const avgRentalYield = rentalYields.length > 0
      ? Number((rentalYields.reduce((sum, y) => sum + y, 0) / rentalYields.length).toFixed(2))
      : null

    const rentalYieldRange = rentalYields.length > 0
      ? { min: Math.min(...rentalYields), max: Math.max(...rentalYields) }
      : null

    // Calculate confidence level based on data quality
    let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW"
    const avgConfidence = comparables.reduce((sum, c) => sum + c.confidence.toNumber(), 0) / comparables.length

    if (comparables.length >= 5 && avgConfidence >= 0.8) {
      confidence = "HIGH"
    } else if (comparables.length >= 3 && avgConfidence >= 0.6) {
      confidence = "MEDIUM"
    }

    // Format comparables for response
    const formattedComparables = comparables.map((comp) => ({
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
      listingUrlSecondary: comp.listingUrlSecondary,
      propertyDataId: comp.propertyDataId,
      confidence: comp.confidence.toNumber(),
      // Calculated fields
      pricePerSqft: comp.squareFeet && comp.squareFeet > 0
        ? Math.round(comp.salePrice.toNumber() / comp.squareFeet)
        : null,
      notes: comp.notes,
      fetchedAt: comp.fetchedAt.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: {
        comparables: formattedComparables,
        count: comparables.length,
        avgPrice,
        avgRentalYield,
        priceRange: { min: minPrice, max: maxPrice },
        rentalYieldRange,
        confidence,
        searchRadius: lead.comparablesSearchRadius,
        lastFetchedAt: lead.comparablesFetchedAt?.toISOString(),
        // Lead context
        leadContext: {
          propertyAddress: lead.propertyAddress,
          propertyPostcode: lead.propertyPostcode,
          askingPrice: lead.askingPrice?.toNumber(),
          avgComparablePrice: lead.avgComparablePrice?.toNumber(),
        },
      },
    })
  } catch (error: any) {
    console.error("[Get Comparables API] Error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch comparables" },
      { status: 500 }
    )
  }
}
