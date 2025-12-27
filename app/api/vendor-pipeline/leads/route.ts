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

const createVendorLeadSchema = z.object({
  facebookLeadId: z.string().optional(),
  leadSource: z.string().default("facebook_ads"),
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
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: any = {}
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
          _count: {
            select: {
              smsMessages: true,
              pipelineEvents: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.vendorLead.count({ where }),
    ])

    return NextResponse.json({
      leads,
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

    return NextResponse.json(lead, { status: 201 })
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

