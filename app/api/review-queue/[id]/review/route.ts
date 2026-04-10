import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { enrichDealData } from "@/lib/deal-enrichment"

const reviewSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  notes: z.string().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!["admin", "sourcer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = reviewSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { action, notes } = validationResult.data

    // Fetch full listing
    const listing = await prisma.propertyListing.findUnique({
      where: { id: params.id },
    })

    if (!listing) {
      return NextResponse.json(
        { error: "Property listing not found" },
        { status: 404 }
      )
    }

    // Mark the listing as reviewed
    const updated = await prisma.propertyListing.update({
      where: { id: params.id },
      data: {
        reviewStatus: action,
        reviewNotes: notes || null,
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
      select: {
        id: true,
        reviewStatus: true,
        reviewedAt: true,
        reviewedBy: true,
      },
    })

    let vendorLeadId: string | null = null

    if (action === "APPROVED") {
      const address = listing.address as any
      const agent = listing.agent as any
      const askingPrice = Number(listing.price)
      const postcode = address?.postcode || null

      // Build a proper address string — never fall back to listing.title
      const baseAddress =
        address?.displayAddress ||
        [address?.street, address?.town, address?.county]
          .filter(Boolean)
          .join(", ") ||
        (postcode ? `Property at ${postcode}` : "Address not available")
      const propertyAddress =
        postcode && !baseAddress.includes(postcode)
          ? `${baseAddress}, ${postcode}`
          : baseAddress

      const cleanValue = (value: any) => {
        if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null
        return value
      }

      // Enrich with comparables, valuation and rental data so the
      // Vendor Lead workflow tabs (Comparables, Validation, etc.) are pre-populated
      const enrichment = await enrichDealData({
        askingPrice,
        postcode,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        squareFeet: listing.squareFeet,
        propertyType: listing.propertyType,
      })

      const calculatedMetrics = calculateAllMetrics({
        askingPrice,
        marketValue: enrichment.marketValue,
        estimatedRefurbCost: enrichment.estimatedRefurbCost,
        afterRefurbValue: enrichment.afterRefurbValue,
        estimatedMonthlyRent: enrichment.estimatedMonthlyRent,
        bedrooms: cleanValue(listing.bedrooms),
        propertyType: cleanValue(listing.propertyType),
        postcode: cleanValue(postcode),
      })

      const enrichmentNote = enrichment.marketValueSource === "comparable_sales"
        ? `Enriched with ${enrichment.comparablesCount} comparables (avg £${enrichment.avgComparablePrice?.toLocaleString()})`
        : enrichment.marketValueSource === "valuation_api"
          ? "Enriched with PropertyData valuation API"
          : "Enriched with estimated values"

      const sourceLabels: Record<string, string> = {
        RIGHTMOVE:     "Scraper: RM",
        ZOOPLA:        "Scraper: Z",
        ONTHEMARKET:   "Scraper: OTM",
        PRIMELOCATION: "Scraper: PL",
      }

      // Create Vendor Lead only — no Deal.
      // The lead goes through the full workflow (Property Details → Comparables →
      // Validation → Offer Analysis). A Deal is created only when the investor
      // decides to make an offer at the Offer Analysis step.
      const vendorLead = await prisma.vendorLead.create({
        data: {
          vendorName:            agent?.name || `${listing.source} Listing`,
          vendorPhone:           agent?.phone || "N/A",
          leadSource:            sourceLabels[listing.source] || `Scraper: ${listing.source}`,
          propertyAddress:       propertyAddress,
          propertyPostcode:      cleanValue(postcode),
          askingPrice:           askingPrice > 0 ? askingPrice : null,
          propertyType:          cleanValue(listing.propertyType),
          bedrooms:              cleanValue(listing.bedrooms),
          bathrooms:             cleanValue(listing.bathrooms),
          squareFeet:            cleanValue(listing.squareFeet),
          estimatedMarketValue:  enrichment.marketValue,
          estimatedMonthlyRent:  enrichment.estimatedMonthlyRent,
          estimatedRefurbCost:   enrichment.estimatedRefurbCost,
          bmvScore:              calculatedMetrics.bmvPercentage,
          comparablesCount:      enrichment.comparablesCount ?? null,
          avgComparablePrice:    enrichment.avgComparablePrice ?? null,
          pipelineStage:         "NEW_LEAD",
          validationNotes:       `Scraped from ${listing.source}. ${enrichmentNote}`,
        },
      })

      vendorLeadId = vendorLead.id
    }

    return NextResponse.json({
      success: true,
      listing: {
        ...updated,
        reviewedAt: updated.reviewedAt?.toISOString(),
      },
      vendorLeadId,
    })
  } catch (error) {
    console.error("[Review Queue API] Error reviewing property:", error)
    return NextResponse.json(
      { error: "Failed to review property" },
      { status: 500 }
    )
  }
}
