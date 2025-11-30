import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { dealSchema } from "@/lib/validations/deal"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"

// GET /api/deals - List all deals
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can access deals
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get("status")
    const postcode = searchParams.get("postcode")
    const assignedToId = searchParams.get("assignedToId")

    const where: any = {}

    if (status) {
      where.status = status
    }

    if (postcode) {
      where.postcode = {
        contains: postcode,
        mode: "insensitive",
      }
    }

    if (assignedToId) {
      where.assignedToId = assignedToId
    }

    // Sourcers can only see their own deals or unassigned deals
    if (session.user.role === "sourcer") {
      where.OR = [
        { assignedToId: session.user.id },
        { assignedToId: null },
        { createdById: session.user.id },
      ]
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        photos: {
          where: { isCover: true },
          take: 1,
        },
        _count: {
          select: {
            photos: true,
            favorites: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    return NextResponse.json(deals)
  } catch (error) {
    console.error("Error fetching deals:", error)
    return NextResponse.json(
      { error: "Failed to fetch deals" },
      { status: 500 }
    )
  }
}

// POST /api/deals - Create new deal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can create deals
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    
    // Validate input
    const validationResult = dealSchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const now = new Date()
    const nextStatus = data.status ?? "new"

    // Helper to clean data - convert empty strings and undefined to null
    const cleanValue = (value: any) => {
      if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null
      return value
    }

    // Auto-calculate metrics if we have the necessary data
    const calculatedMetrics = calculateAllMetrics({
      askingPrice: data.askingPrice,
      marketValue: cleanValue(data.marketValue),
      estimatedRefurbCost: cleanValue(data.estimatedRefurbCost),
      afterRefurbValue: cleanValue(data.afterRefurbValue),
      estimatedMonthlyRent: cleanValue(data.estimatedMonthlyRent),
      bedrooms: cleanValue(data.bedrooms),
      propertyType: cleanValue(data.propertyType),
      postcode: cleanValue(data.postcode),
    })

    // Use calculated metrics, but allow manual overrides if provided
    const finalMetrics = {
      bmvPercentage: cleanValue(data.bmvPercentage) ?? calculatedMetrics.bmvPercentage,
      grossYield: cleanValue(data.grossYield) ?? calculatedMetrics.grossYield,
      netYield: cleanValue(data.netYield) ?? calculatedMetrics.netYield,
      roi: cleanValue(data.roi) ?? calculatedMetrics.roi,
      roce: cleanValue(data.roce) ?? calculatedMetrics.roce,
      dealScore: cleanValue(data.dealScore) ?? calculatedMetrics.dealScore,
      packTier: cleanValue(data.packTier) ?? calculatedMetrics.packTier,
      packPrice: cleanValue(data.packPrice) ?? calculatedMetrics.packPrice,
    }

    const statusHistoryEntry = {
      status: nextStatus,
      changedAt: now.toISOString(),
      changedBy: session.user.id,
      note: "Deal created",
    }

    // Create deal
    const deal = await prisma.deal.create({
      data: {
        address: data.address,
        postcode: cleanValue(data.postcode),
        propertyType: cleanValue(data.propertyType),
        bedrooms: cleanValue(data.bedrooms),
        bathrooms: cleanValue(data.bathrooms),
        squareFeet: cleanValue(data.squareFeet),
        askingPrice: data.askingPrice,
        marketValue: cleanValue(data.marketValue),
        estimatedRefurbCost: cleanValue(data.estimatedRefurbCost),
        afterRefurbValue: cleanValue(data.afterRefurbValue),
        estimatedMonthlyRent: cleanValue(data.estimatedMonthlyRent),
        bmvPercentage: finalMetrics.bmvPercentage,
        grossYield: finalMetrics.grossYield,
        netYield: finalMetrics.netYield,
        roi: finalMetrics.roi,
        roce: finalMetrics.roce,
        dealScore: finalMetrics.dealScore,
        dealScoreBreakdown: calculatedMetrics.dealScoreBreakdown,
        status: nextStatus,
        statusUpdatedAt: now,
        statusHistory: [statusHistoryEntry],
        packTier: finalMetrics.packTier,
        packPrice: finalMetrics.packPrice,
        dataSource: data.dataSource || "manual",
        externalId: cleanValue(data.externalId),
        agentName: cleanValue(data.agentName),
        agentPhone: cleanValue(data.agentPhone),
        listingUrl: cleanValue(data.listingUrl),
        assignedToId: cleanValue(data.assignedToId),
        createdById: session.user.id,
        listedAt: nextStatus === "listed" ? now : undefined,
        archivedAt: nextStatus === "archived" ? now : undefined,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    })

    return NextResponse.json(deal, { status: 201 })
  } catch (error) {
    console.error("Error creating deal:", error)
    return NextResponse.json(
      { error: "Failed to create deal" },
      { status: 500 }
    )
  }
}

