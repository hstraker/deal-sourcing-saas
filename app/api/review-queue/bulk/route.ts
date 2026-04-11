import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { enrichDealData } from "@/lib/deal-enrichment"

const bulkReviewSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  ids: z.array(z.string()).min(1),
  notes: z.string().optional(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = bulkReviewSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const { action, ids, notes } = validationResult.data
    const vendorLeadIds: string[] = []

    if (action === "APPROVED") {
      const listings = await prisma.propertyListing.findMany({
        where: { id: { in: ids } },
      })

      const cleanValue = (value: any) => {
        if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null
        return value
      }

      const now = new Date()

      const sourceLabels: Record<string, string> = {
        RIGHTMOVE:     "Scraper: RM",
        ZOOPLA:        "Scraper: Z",
        ONTHEMARKET:   "Scraper: OTM",
        PRIMELOCATION: "Scraper: PL",
      }

      for (const listing of listings) {
        const address = listing.address as any
        const agent = listing.agent as any
        const askingPrice = Number(listing.price)
        const postcode = address?.postcode || null

        // Build a proper address string — append postcode if not already present
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
          ? `Enriched with ${enrichment.comparablesCount} comparables`
          : enrichment.marketValueSource === "valuation_api"
            ? "Enriched with PropertyData valuation"
            : "Enriched with estimated values"

        // Mark listing as reviewed
        await prisma.propertyListing.update({
          where: { id: listing.id },
          data: {
            reviewStatus: action,
            reviewNotes:  notes || null,
            reviewedBy:   session.user.id,
            reviewedAt:   now,
          },
        })

        // Create Vendor Lead only — no Deal.
        // The lead goes through the full workflow (Property Details → Comparables →
        // Validation → Offer Analysis). A Deal is created only when the investor
        // decides to make an offer at the Offer Analysis step.
        const vendorLead = await prisma.vendorLead.create({
          data: {
            vendorName:           agent?.name || `${listing.source} Listing`,
            vendorPhone:          agent?.phone || "N/A",
            leadSource:           sourceLabels[listing.source] || `Scraper: ${listing.source}`,
            propertyAddress:      propertyAddress,
            propertyPostcode:     cleanValue(postcode),
            askingPrice:          askingPrice > 0 ? askingPrice : null,
            propertyType:         cleanValue(listing.propertyType),
            bedrooms:             cleanValue(listing.bedrooms),
            bathrooms:            cleanValue(listing.bathrooms),
            squareFeet:           cleanValue(listing.squareFeet),
            estimatedMarketValue: enrichment.marketValue,
            estimatedMonthlyRent: enrichment.estimatedMonthlyRent,
            estimatedRefurbCost:  enrichment.estimatedRefurbCost,
            // Only save a real BMV score — never save the 1.15× fallback estimate,
            // which would display a misleading 13.0% for every un-comparable lead.
            bmvScore:             enrichment.marketValueSource !== "estimated"
                                    ? calculatedMetrics.bmvPercentage
                                    : null,
            comparablesCount:     enrichment.comparablesCount ?? null,
            avgComparablePrice:   enrichment.avgComparablePrice ?? null,
            pipelineStage:        "NEW_LEAD",
            validationNotes:      `Scraped from ${listing.source}. ${enrichmentNote}`,
          },
        })

        vendorLeadIds.push(vendorLead.id)
      }
    } else {
      // Rejection: bulk update listings only
      await prisma.propertyListing.updateMany({
        where: { id: { in: ids } },
        data: {
          reviewStatus: action,
          reviewNotes:  notes || null,
          reviewedBy:   session.user.id,
          reviewedAt:   new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      updatedCount: ids.length,
      vendorLeadIds: vendorLeadIds.length > 0 ? vendorLeadIds : undefined,
    })
  } catch (error) {
    console.error("[Review Queue API] Error bulk reviewing:", error)
    return NextResponse.json(
      { error: "Failed to bulk review properties" },
      { status: 500 }
    )
  }
}
