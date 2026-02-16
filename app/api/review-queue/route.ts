import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { toPropertyListingForClient } from "@/types/property-listing"

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (!["admin", "sourcer"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "20")
    const source = searchParams.get("source")
    const category = searchParams.get("category")
    const isAmbiguous = searchParams.get("isAmbiguous")
    const search = searchParams.get("search")
    const sortField = searchParams.get("sortField") || "scrapedAt"
    const sortDirection = (searchParams.get("sortDirection") || "desc") as "asc" | "desc"
    const reviewStatus = searchParams.get("reviewStatus")

    // Build where clause
    const where: any = {}

    // Default: show items needing review
    if (reviewStatus) {
      where.reviewStatus = reviewStatus
    } else {
      where.reviewStatus = { in: ["PENDING", "AUTO_APPROVED"] }
    }

    if (source) {
      where.source = source
    }
    if (category) {
      where.category = category
    }
    if (isAmbiguous === "true") {
      where.isAmbiguous = true
    } else if (isAmbiguous === "false") {
      where.isAmbiguous = false
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ]
    }

    // Build orderBy
    const validSortFields: Record<string, string> = {
      scrapedAt: "scrapedAt",
      price: "price",
      daysOnMarket: "daysOnMarket",
      title: "title",
    }
    const orderByField = validSortFields[sortField] || "scrapedAt"
    const orderBy = { [orderByField]: sortDirection }

    const [listings, total] = await Promise.all([
      prisma.propertyListing.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.propertyListing.count({ where }),
    ])

    const listingsForClient = listings.map(toPropertyListingForClient)

    return NextResponse.json({
      success: true,
      listings: listingsForClient,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error("[Review Queue API] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch review queue" },
      { status: 500 }
    )
  }
}
