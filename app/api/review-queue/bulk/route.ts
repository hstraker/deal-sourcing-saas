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
    const dealIds: string[] = []

    if (action === "APPROVED") {
      // Fetch all listings for deal creation
      const listings = await prisma.propertyListing.findMany({
        where: { id: { in: ids } },
      })

      const cleanValue = (value: any) => {
        if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null
        return value
      }

      const now = new Date()

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

        // Run full enrichment: comparables, valuation, rental data
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

        const statusHistoryEntry = {
          status: "new",
          changedAt: now.toISOString(),
          changedBy: session.user.id,
          note: `Created from approved scraper listing. ${enrichmentNote}`,
        }

        const deal = await prisma.deal.create({
          data: {
            address: propertyAddress,
            postcode: cleanValue(postcode),
            propertyType: cleanValue(listing.propertyType),
            bedrooms: cleanValue(listing.bedrooms),
            bathrooms: cleanValue(listing.bathrooms),
            squareFeet: cleanValue(listing.squareFeet),
            askingPrice,
            marketValue: enrichment.marketValue,
            estimatedRefurbCost: enrichment.estimatedRefurbCost,
            afterRefurbValue: enrichment.afterRefurbValue,
            estimatedMonthlyRent: enrichment.estimatedMonthlyRent,
            bmvPercentage: calculatedMetrics.bmvPercentage,
            grossYield: calculatedMetrics.grossYield,
            netYield: calculatedMetrics.netYield,
            roi: calculatedMetrics.roi,
            roce: calculatedMetrics.roce,
            dealScore: calculatedMetrics.dealScore,
            dealScoreBreakdown: calculatedMetrics.dealScoreBreakdown as any,
            status: "new",
            statusUpdatedAt: now,
            statusHistory: [statusHistoryEntry],
            packTier: calculatedMetrics.packTier,
            packPrice: calculatedMetrics.packPrice,
            dataSource: listing.source.toLowerCase(),
            externalId: cleanValue(listing.sourceId),
            agentName: cleanValue(agent?.name),
            agentPhone: cleanValue(agent?.phone),
            listingUrl: cleanValue(listing.listingUrl),
            createdById: session.user.id,
          },
        })

        dealIds.push(deal.id)

        // Update listing: set review status and link to deal
        await prisma.propertyListing.update({
          where: { id: listing.id },
          data: {
            reviewStatus: action,
            reviewNotes: notes || null,
            reviewedBy: session.user.id,
            reviewedAt: now,
            dealId: deal.id,
          },
        })

        // Create VendorLead so it appears on the Vendor page
        const sourceLabels: Record<string, string> = {
          RIGHTMOVE: "Scraper: RM",
          ZOOPLA: "Scraper: Z",
          ONTHEMARKET: "Scraper: OTM",
          PRIMELOCATION: "Scraper: PL",
        }

        await prisma.vendorLead.create({
          data: {
            vendorName: agent?.name || `${listing.source} Listing`,
            vendorPhone: agent?.phone || "N/A",
            leadSource: sourceLabels[listing.source] || `Scraper: ${listing.source}`,
            propertyAddress: propertyAddress,
            propertyPostcode: cleanValue(postcode),
            askingPrice: askingPrice > 0 ? askingPrice : null,
            propertyType: cleanValue(listing.propertyType),
            bedrooms: cleanValue(listing.bedrooms),
            bathrooms: cleanValue(listing.bathrooms),
            squareFeet: cleanValue(listing.squareFeet),
            estimatedMarketValue: enrichment.marketValue,
            estimatedMonthlyRent: enrichment.estimatedMonthlyRent,
            pipelineStage: "NEW_LEAD",
            dealId: deal.id,
            validationNotes: `Scraped from ${listing.source}. ${enrichmentNote}`,
          },
        })
      }
    } else {
      // Rejection: bulk update as before
      await prisma.propertyListing.updateMany({
        where: { id: { in: ids } },
        data: {
          reviewStatus: action,
          reviewNotes: notes || null,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      updatedCount: ids.length,
      dealIds: dealIds.length > 0 ? dealIds : undefined,
    })
  } catch (error) {
    console.error("[Review Queue API] Error bulk reviewing:", error)
    return NextResponse.json(
      { error: "Failed to bulk review properties" },
      { status: 500 }
    )
  }
}
