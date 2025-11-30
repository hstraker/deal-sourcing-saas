import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { dealSchema } from "@/lib/validations/deal"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { appendStatusHistory } from "@/lib/status-history"

// GET /api/deals/[id] - Get single deal
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can access deals
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
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
          orderBy: [{ isCover: "desc" }, { sortOrder: "asc" }],
        },
        _count: {
          select: {
            photos: true,
            favorites: true,
            dealViews: true,
          },
        },
      },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Check permissions for sourcers
    if (
      session.user.role === "sourcer" &&
      deal.assignedToId !== session.user.id &&
      deal.createdById !== session.user.id &&
      deal.assignedToId !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json(deal)
  } catch (error) {
    console.error("Error fetching deal:", error)
    return NextResponse.json(
      { error: "Failed to fetch deal" },
      { status: 500 }
    )
  }
}

// PUT /api/deals/[id] - Update deal
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin and sourcer can update deals
    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if deal exists and user has permission
    const existingDeal = await prisma.deal.findUnique({
      where: { id: params.id },
    })

    if (!existingDeal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Check permissions for sourcers
    if (
      session.user.role === "sourcer" &&
      existingDeal.assignedToId !== session.user.id &&
      existingDeal.createdById !== session.user.id &&
      existingDeal.assignedToId !== null
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()

    // For updates, we only validate the fields that are being updated
    // Use partial schema to allow updating individual fields
    const updateSchema = dealSchema.partial().extend({
      // Still require address and askingPrice if they're being updated
      address: dealSchema.shape.address.optional(),
      askingPrice: dealSchema.shape.askingPrice.optional(),
    })

    // Validate input
    const validationResult = updateSchema.safeParse(body)

    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data
    const now = new Date()
    const nextStatus = data.status ?? existingDeal.status
    const statusChanged = nextStatus !== existingDeal.status

    // Helper to clean data - convert empty strings and undefined to null
    const cleanValue = (value: any) => {
      if (value === "" || value === undefined || (typeof value === "number" && Number.isNaN(value))) return null
      return value
    }

    // Use existing deal values for fields that aren't being updated
    const askingPrice = data.askingPrice ?? Number(existingDeal.askingPrice)
    const marketValue = cleanValue(data.marketValue) ?? (existingDeal.marketValue ? Number(existingDeal.marketValue) : null)
    const estimatedRefurbCost = cleanValue(data.estimatedRefurbCost) ?? (existingDeal.estimatedRefurbCost ? Number(existingDeal.estimatedRefurbCost) : null)
    const afterRefurbValue = cleanValue(data.afterRefurbValue) ?? (existingDeal.afterRefurbValue ? Number(existingDeal.afterRefurbValue) : null)
    const estimatedMonthlyRent = cleanValue(data.estimatedMonthlyRent) ?? (existingDeal.estimatedMonthlyRent ? Number(existingDeal.estimatedMonthlyRent) : null)
    const bedrooms = cleanValue(data.bedrooms) ?? existingDeal.bedrooms
    const propertyType = cleanValue(data.propertyType) ?? existingDeal.propertyType
    const postcode = cleanValue(data.postcode) ?? existingDeal.postcode

    // Auto-calculate metrics if we have the necessary data
    const calculatedMetrics = calculateAllMetrics({
      askingPrice,
      marketValue,
      estimatedRefurbCost,
      afterRefurbValue,
      estimatedMonthlyRent,
      bedrooms,
      propertyType,
      postcode,
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

    // Build update data - only include fields that are being updated
    const updateData: any = {}
    
    if (data.address !== undefined) updateData.address = data.address
    if (data.postcode !== undefined) updateData.postcode = cleanValue(data.postcode)
    if (data.propertyType !== undefined) updateData.propertyType = cleanValue(data.propertyType)
    if (data.bedrooms !== undefined) updateData.bedrooms = cleanValue(data.bedrooms)
    if (data.bathrooms !== undefined) updateData.bathrooms = cleanValue(data.bathrooms)
    if (data.squareFeet !== undefined) updateData.squareFeet = cleanValue(data.squareFeet)
    if (data.askingPrice !== undefined) updateData.askingPrice = data.askingPrice
    if (data.marketValue !== undefined) updateData.marketValue = cleanValue(data.marketValue)
    if (data.estimatedRefurbCost !== undefined) updateData.estimatedRefurbCost = cleanValue(data.estimatedRefurbCost)
    if (data.afterRefurbValue !== undefined) updateData.afterRefurbValue = cleanValue(data.afterRefurbValue)
    if (data.estimatedMonthlyRent !== undefined) updateData.estimatedMonthlyRent = cleanValue(data.estimatedMonthlyRent)
    if (data.assignedToId !== undefined) updateData.assignedToId = cleanValue(data.assignedToId)
    if (data.status !== undefined) {
      updateData.status = nextStatus
      updateData.statusUpdatedAt = statusChanged ? now : undefined
      updateData.statusHistory = statusChanged
        ? appendStatusHistory(existingDeal.statusHistory, {
            status: nextStatus,
            changedAt: now.toISOString(),
            changedBy: session.user.id,
            note: "Status updated via deal edit",
          })
        : undefined
      updateData.listedAt = statusChanged && nextStatus === "listed" ? now : undefined
      updateData.archivedAt = statusChanged && nextStatus === "archived" ? now : undefined
    }
    if (data.dataSource !== undefined) updateData.dataSource = data.dataSource || existingDeal.dataSource || "manual"
    if (data.externalId !== undefined) updateData.externalId = cleanValue(data.externalId)
    if (data.agentName !== undefined) updateData.agentName = cleanValue(data.agentName)
    if (data.agentPhone !== undefined) updateData.agentPhone = cleanValue(data.agentPhone)
    if (data.listingUrl !== undefined) updateData.listingUrl = cleanValue(data.listingUrl)
    
    // Only update metrics if we have pricing data to calculate from
    if (data.askingPrice !== undefined || data.marketValue !== undefined || 
        data.estimatedRefurbCost !== undefined || data.afterRefurbValue !== undefined ||
        data.estimatedMonthlyRent !== undefined) {
      updateData.bmvPercentage = finalMetrics.bmvPercentage
      updateData.grossYield = finalMetrics.grossYield
      updateData.netYield = finalMetrics.netYield
      updateData.roi = finalMetrics.roi
      updateData.roce = finalMetrics.roce
      updateData.dealScore = finalMetrics.dealScore
      updateData.dealScoreBreakdown = calculatedMetrics.dealScoreBreakdown
      updateData.packTier = finalMetrics.packTier
      updateData.packPrice = finalMetrics.packPrice
    } else {
      // If only updating assignment, preserve existing metrics
      if (data.bmvPercentage !== undefined) updateData.bmvPercentage = cleanValue(data.bmvPercentage)
      if (data.grossYield !== undefined) updateData.grossYield = cleanValue(data.grossYield)
      if (data.netYield !== undefined) updateData.netYield = cleanValue(data.netYield)
      if (data.roi !== undefined) updateData.roi = cleanValue(data.roi)
      if (data.roce !== undefined) updateData.roce = cleanValue(data.roce)
      if (data.dealScore !== undefined) updateData.dealScore = cleanValue(data.dealScore)
      if (data.packTier !== undefined) updateData.packTier = cleanValue(data.packTier)
      if (data.packPrice !== undefined) updateData.packPrice = cleanValue(data.packPrice)
    }

    // Update deal
    const deal = await prisma.deal.update({
      where: { id: params.id },
      data: updateData,
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

    return NextResponse.json(deal)
  } catch (error) {
    console.error("Error updating deal:", error)
    return NextResponse.json(
      { error: "Failed to update deal" },
      { status: 500 }
    )
  }
}

// DELETE /api/deals/[id] - Delete deal
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Only admin can delete deals
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const deal = await prisma.deal.findUnique({
      where: { id: params.id },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    await prisma.deal.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: "Deal deleted successfully" })
  } catch (error) {
    console.error("Error deleting deal:", error)
    return NextResponse.json(
      { error: "Failed to delete deal" },
      { status: 500 }
    )
  }
}

