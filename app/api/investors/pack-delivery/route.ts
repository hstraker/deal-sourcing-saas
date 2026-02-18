import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { sendInvestorPackEmail } from "@/lib/email"

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

    // Create or generate pack record first if needed
    let packGenerationId = generationId

    if (!packGenerationId) {
      // Create a generation record for this pack delivery
      const generation = await prisma.investorPackGeneration.create({
        data: {
          dealId,
          propertyAddress: deal.address,
          askingPrice: deal.askingPrice,
          generatedById: session.user.id,
        },
      })
      packGenerationId = generation.id
    }

    // Create delivery record (or update if exists with same generation)
    // Note: Prisma upsert does not support null in composite unique keys,
    // so we use findFirst + create/update instead.
    const existingDelivery = await prisma.investorPackDelivery.findFirst({
      where: {
        investorId,
        dealId,
        generationId: packGenerationId,
        partNumber: partNumber ?? null,
      },
    })

    const delivery = existingDelivery
      ? await prisma.investorPackDelivery.update({
          where: { id: existingDelivery.id },
          data: { sentAt: new Date(), notes },
        })
      : await prisma.investorPackDelivery.create({
          data: {
            investorId,
            dealId,
            generationId: packGenerationId,
            partNumber: partNumber ?? null,
            deliveryMethod: deliveryMethod || "email",
            recipientEmail: recipientEmail || investor.user.email,
            notes,
            sentAt: new Date(),
          },
        })

    // Send email if delivery method is email
    let emailStatus = "pending"
    let emailError: string | undefined

    if (!deliveryMethod || deliveryMethod === "email") {
      const recipientEmailAddress = recipientEmail || investor.user.email
      const appUrl = process.env.APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
      const partLabel = partNumber ? `Part ${partNumber} of investor pack` : "Complete investor pack"

      const emailResult = await sendInvestorPackEmail({
        to: recipientEmailAddress,
        investorName: `${investor.user.firstName || ""} ${investor.user.lastName || ""}`.trim() || recipientEmailAddress,
        dealAddress: deal.address,
        dealId,
        packLabel: partLabel,
        appUrl,
      })

      if (emailResult.noSmtp) {
        emailStatus = "no_smtp"
        emailError = emailResult.error
      } else if (emailResult.success) {
        emailStatus = "sent"
      } else {
        emailStatus = "failed"
        emailError = emailResult.error
      }

      // Update delivery with email status
      await prisma.investorPackDelivery.update({
        where: { id: delivery.id },
        data: { emailStatus, emailError: emailError || null },
      })
    } else {
      emailStatus = "not_applicable"
      await prisma.investorPackDelivery.update({
        where: { id: delivery.id },
        data: { emailStatus },
      })
    }

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

    // Auto-advance reservation status to pack_sent if currently pending
    await prisma.investorReservation.updateMany({
      where: {
        investorId,
        dealId,
        status: "pending",
      },
      data: { status: "pack_sent" },
    })

    return NextResponse.json({ delivery, emailStatus }, { status: 201 })
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
