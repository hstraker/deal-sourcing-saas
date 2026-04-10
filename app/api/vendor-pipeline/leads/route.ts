/**
 * Vendor Pipeline Leads API Routes
 * GET /api/vendor-pipeline/leads - List all vendor leads
 * POST /api/vendor-pipeline/leads - Create a new vendor lead
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { PipelineStage } from "@prisma/client"
import { estimateRentalIncome, estimateSquareFeet, calculateRentPerSqFt } from "@/lib/rental-estimator"
import { runVendorLeadAutoTriggers } from "@/lib/services/vendorLeadAutoTriggers"
import { aiSMSAgent } from "@/lib/vendor-pipeline/ai-sms-agent"
import { shouldAutoStartAI } from "@/lib/vendor-pipeline/ai-conversation-settings"

const createVendorLeadSchema = z.object({
  facebookLeadId: z.string().optional(),
  leadSource: z.string().default("manual"),  // dashboard-created leads are "manual" by default
  campaignId: z.string().optional(),
  vendorName: z.string().min(1),
  vendorPhone: z.string().min(1),
  vendorEmail: z.string().email().optional(),
  vendorAddress: z.string().optional(),
  propertyAddress: z.string().optional(),
  propertyPostcode: z.string().optional(),
  askingPrice: z.number().positive().optional(),
  propertyType: z.string().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().int().optional(),
})

// GET /api/vendor-pipeline/leads
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const searchParams = request.nextUrl.searchParams
    const stage = searchParams.get("stage") as PipelineStage | null
    const motivationMin = searchParams.get("motivation_min")
    const archived = searchParams.get("archived") === "true"
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: any = archived
      ? { NOT: { archivedAt: null } }
      : { archivedAt: null }

    if (stage) {
      where.pipelineStage = stage
    }
    if (motivationMin) {
      where.motivationScore = { gte: parseInt(motivationMin) }
    }

    const [leads, total] = await Promise.all([
      prisma.vendorLead.findMany({
        where,
        include: {
          smsMessages: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          portalChecks: {
            orderBy: { triggeredAt: "desc" },
            take: 1,
            select: {
              overallRisk: true,
              summaryFlags: true,
              portalCheckRaw: true,
              ownershipCheckRaw: true,
              checkStatus: true,
            },
          },
          offerRetries: {
            orderBy: { retryNumber: "asc" },
            select: {
              retryNumber: true,
              originalOfferAmount: true,
              adjustedOfferAmount: true,
              sentAt: true,
            },
          },
          _count: {
            select: {
              smsMessages: true,
              pipelineEvents: true,
              photos: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendorLead.count({ where }),
    ])

    // Batch-fetch investor reservations and investor details for enrichment
    const dealIds = leads.filter((l) => l.dealId).map((l) => l.dealId as string)
    const reservedInvestorIds = leads
      .filter((l) => l.reservedByInvestorId)
      .map((l) => l.reservedByInvestorId as string)

    const [activeReservations, reservedInvestors] = await Promise.all([
      dealIds.length > 0
        ? prisma.investorReservation.findMany({
            where: { dealId: { in: dealIds }, status: { notIn: ["cancelled"] } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              dealId: true,
              investorId: true,
              status: true,
              reservationFee: true,
              createdAt: true,
              updatedAt: true,
              investor: {
                select: {
                  id: true,
                  user: {
                    select: { firstName: true, lastName: true, email: true, phone: true },
                  },
                },
              },
            },
          })
        : [],
      reservedInvestorIds.length > 0
        ? prisma.investor.findMany({
            where: { id: { in: reservedInvestorIds } },
            select: {
              id: true,
              user: { select: { firstName: true, lastName: true, email: true, phone: true } },
            },
          })
        : [],
    ])

    // Map most-recent reservation per deal (first = most recent due to orderBy updatedAt desc)
    const reservationByDealId = new Map<string, (typeof activeReservations)[0]>()
    for (const res of activeReservations) {
      if (!reservationByDealId.has(res.dealId)) {
        reservationByDealId.set(res.dealId, res)
      }
    }
    const investorById = new Map(reservedInvestors.map((i) => [i.id, i]))

    const enrichedLeads = leads.map((lead) => ({
      ...lead,
      reservation: lead.dealId ? (reservationByDealId.get(lead.dealId) ?? null) : null,
      reservedByInvestor: lead.reservedByInvestorId
        ? (investorById.get(lead.reservedByInvestorId) ?? null)
        : null,
      // Flatten latest portal check for easy table consumption
      latestPortalCheck: lead.portalChecks?.[0] ?? null,
    }))

    return NextResponse.json({
      leads: enrichedLeads,
      total,
      page,
      pages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error("Error fetching vendor leads:", error)
    return NextResponse.json(
      { error: "Failed to fetch vendor leads" },
      { status: 500 }
    )
  }
}

// POST /api/vendor-pipeline/leads
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = createVendorLeadSchema.parse(body)

    // Check if vendor with phone already exists
    const existing = await prisma.vendorLead.findFirst({
      where: { vendorPhone: validatedData.vendorPhone },
    })

    if (existing) {
      return NextResponse.json(
        { error: "Vendor with this phone number already exists", lead: existing },
        { status: 400 }
      )
    }

    // Auto-estimate rental data if asking price is provided
    const createData: any = { ...validatedData }

    if (validatedData.askingPrice) {
      const rental = estimateRentalIncome(
        validatedData.askingPrice,
        validatedData.propertyType,
        validatedData.bedrooms,
        validatedData.propertyPostcode
      )

      createData.estimatedMonthlyRent = rental.monthlyRent
      createData.estimatedAnnualRent = rental.annualRent
      createData.rentConfidence = rental.confidence

      console.log(`[Rental Estimator] Auto-estimated rent for new lead: £${rental.monthlyRent}/mo (${rental.estimatedYield.toFixed(1)}% yield)`)
    }

    // Auto-estimate square footage if bedrooms are provided
    if (validatedData.bedrooms) {
      const estimatedSqFt = estimateSquareFeet(
        validatedData.propertyType,
        validatedData.bedrooms
      )
      if (estimatedSqFt) {
        createData.squareFeet = estimatedSqFt
        console.log(`[Rental Estimator] Auto-estimated square footage for new lead: ${estimatedSqFt} sq ft`)
      }
    }

    // Calculate rent per sq ft if we have both values
    if (createData.estimatedMonthlyRent && createData.squareFeet) {
      createData.rentPerSqFt = calculateRentPerSqFt(
        createData.estimatedMonthlyRent,
        createData.squareFeet
      )
    }

    const lead = await prisma.vendorLead.create({
      data: createData,
    })

    // Fire-and-forget: normalise address, run portal check + BMV screening
    runVendorLeadAutoTriggers(lead.id).catch((err) =>
      console.error("[AutoTrigger] Failed for lead:", lead.id, err?.message)
    )

    // Determine the lead source for AI settings check
    const source = validatedData.facebookLeadId ? "facebook"
      : validatedData.leadSource === "facebook_ads" ? "facebook"
      : validatedData.leadSource === "api" ? "api"
      : "manual"

    // AI conversation auto-start — awaited so the response includes the SMS result
    let aiStarted = false
    let aiError: string | null = null

    try {
      const autoStart = await shouldAutoStartAI(source as any)
      if (autoStart) {
        console.log(`🤖 [Leads API] Auto-starting AI conversation for ${source} lead ${lead.id}`)
        await aiSMSAgent.sendInitialMessage(lead.id)
        aiStarted = true
        console.log(`✅ [Leads API] Initial AI message sent for lead ${lead.id}`)
      } else {
        console.log(`⏸️ [Leads API] AI auto-start disabled for source "${source}" — skipping`)
      }
    } catch (err: any) {
      aiError = err?.message || "Failed to send AI message"
      console.error("[Leads API] AI send failed:", lead.id, aiError)
      // Don't fail the whole request — lead was created successfully
    }

    return NextResponse.json(
      {
        ...lead,
        _aiConversation: {
          started: aiStarted,
          source,
          error: aiError,
        },
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Error creating vendor lead:", error)
    return NextResponse.json(
      { error: "Failed to create vendor lead" },
      { status: 500 }
    )
  }
}

