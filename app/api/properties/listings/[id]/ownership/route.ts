import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { findOwnershipByPostcode, normalizePostcode } from "@/lib/land-registry"

// GET /api/properties/listings/[id]/ownership
// Returns Land Registry ownership intel for a property listing
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

    const listing = await prisma.propertyListing.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        address: true,
        bmvIndicators: true,
      },
    })

    if (!listing) {
      return NextResponse.json({ error: "Listing not found" }, { status: 404 })
    }

    const address = listing.address as { postcode?: string; displayAddress?: string }
    const postcode = address?.postcode

    if (!postcode) {
      return NextResponse.json({
        ownership: null,
        message: "No postcode available for this listing",
        cachedInBmvIndicators: null,
      })
    }

    // Return cached ownership intel from bmvIndicators if present
    const bmv = listing.bmvIndicators as Record<string, unknown>
    const hasOwnershipIntel = bmv?.isCorporateOwned !== undefined

    // Always do a fresh DB lookup for the full details
    const ownership = await findOwnershipByPostcode(postcode)

    // Also return the raw ownership records for display
    const rawRecords = await prisma.companyOwnership.findMany({
      where: { postcodeNormalized: normalizePostcode(postcode) },
      select: {
        titleNumber: true,
        tenure: true,
        propertyAddress: true,
        companyName: true,
        companyRegNumber: true,
        proprietorCategory: true,
        countryIncorporated: true,
        isOverseas: true,
        dateProprietary: true,
        pricePaid: true,
      },
      take: 10,
    })

    return NextResponse.json({
      postcode,
      ownership,
      rawRecords: rawRecords.map((r) => ({
        ...r,
        pricePaid: r.pricePaid ? Number(r.pricePaid) : null,
      })),
      cachedInBmvIndicators: hasOwnershipIntel
        ? {
            isCorporateOwned: bmv.isCorporateOwned,
            isOverseasOwned: bmv.isOverseasOwned,
            isPortfolioOwner: bmv.isPortfolioOwner,
            proprietorType: bmv.proprietorType,
            ownerCompanyName: bmv.ownerCompanyName,
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching ownership for listing:", error)
    return NextResponse.json(
      { error: "Failed to fetch ownership data" },
      { status: 500 }
    )
  }
}
