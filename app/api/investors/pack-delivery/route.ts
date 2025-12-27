import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// POST /api/investors/pack-delivery - Send investor pack to specific investor
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { investorId, dealId, generationId, deliveryMethod, recipientEmail, notes, partNumber } = body

    if (!investorId || !dealId) {
      return NextResponse.json(
        { error: "investorId and dealId are required" },
        { status: 400 }
      )
    }

    // Check if investor exists
    const investor = await prisma.investor.findUnique({
      where: { id: investorId },
      include: {
        user: {
          select: { email: true, firstName: true, lastName: true },
        },
      },
    })

    if (!investor) {
      return NextResponse.json({ error: "Investor not found" }, { status: 404 })
    }

    // Check if deal exists
    const deal = await prisma.deal.findUnique({
      where: { id: dealId },
      select: { id: true, address: true, askingPrice: true },
    })

    if (!deal) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 })
    }

    // Create delivery record (or update if exists)
    const delivery = await prisma.investorPackDelivery.upsert({
      where: {
        investorId_dealId_generationId_partNumber: {
          investorId,
          dealId,
          generationId: generationId || null,
          partNumber: partNumber || null,
        },
      },
      create: {
        investorId,
        dealId,
        generationId,
        partNumber: partNumber || null,
        deliveryMethod: deliveryMethod || "email",
        recipientEmail: recipientEmail || investor.user.email,
        notes,
        sentAt: new Date(),
      },
      update: {
        sentAt: new Date(),
        notes,
      },
    })

    // Update investor stats
    await prisma.investor.update({
      where: { id: investorId },
      data: {
        packsRequested: { increment: 1 },
        lastActivityAt: new Date(),
      },
    })

    // Create activity description based on part number
    const partLabel = partNumber
      ? `Part ${partNumber} of investor pack`
      : 'Complete investor pack'

    // Log activity
    await prisma.investorActivity.create({
      data: {
        investorId,
        activityType: "PACK_REQUESTED",
        description: `${partLabel} sent for ${deal.address}`,
        dealId,
        packDeliveryId: delivery.id,
        triggeredById: session.user.id,
        metadata: {
          partNumber: partNumber || null,
        },
      },
    })

    // Update deal stats
    await prisma.deal.update({
      where: { id: dealId },
      data: {
        investorPackSent: true,
        investorPackSentAt: new Date(),
        investorPackSentCount: { increment: 1 },
      },
    })

    return NextResponse.json({ delivery }, { status: 201 })
  } catch (error: any) {
    console.error("Error creating pack delivery:", error)
    return NextResponse.json(
      { error: "Failed to create pack delivery" },
      { status: 500 }
    )
  }
}

// GET /api/investors/pack-delivery?investorId=xxx&dealId=xxx - Get deliveries
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const investorId = searchParams.get("investorId")
    const dealId = searchParams.get("dealId")

    const where: any = {}
    if (investorId) where.investorId = investorId
    if (dealId) where.dealId = dealId

    const deliveries = await prisma.investorPackDelivery.findMany({
      where,
      orderBy: { sentAt: "desc" },
      include: {
        investor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        deal: {
          select: {
            address: true,
            askingPrice: true,
            propertyType: true,
            bedrooms: true,
          },
        },
        generation: {
          select: {
            template: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })

    return NextResponse.json({ deliveries })
  } catch (error: any) {
    console.error("Error fetching deliveries:", error)
    return NextResponse.json(
      { error: "Failed to fetch deliveries" },
      { status: 500 }
    )
  }
}
