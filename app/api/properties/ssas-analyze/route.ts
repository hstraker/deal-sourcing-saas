/**
 * POST /api/properties/ssas-analyze
 *
 * Runs SSAS analysis on one or all commercial properties.
 *
 * Body (JSON):
 *  { id: string }           — analyze a single listing
 *  { all: true }            — batch analyze all COMMERCIAL listings
 *
 * Returns: { success, analyzed, result? }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { analyzeSsasProperty } from "@/lib/ssas-analyzer"

async function analyzeOne(listing: any) {
  const addr     = listing.address as any
  const commercial = listing.commercialDetails as any
  const bmv      = listing.bmvIndicators as any

  // Resolve annual rent: prefer explicit column, then commercialDetails.currentRent
  const annualRent = listing.annualRent
    ?? commercial?.currentRent
    ?? 0

  const result = analyzeSsasProperty({
    price:               Number(listing.price),
    annualRent,
    leaseYearsRemaining: commercial?.leaseYearsRemaining ?? 0,
    propertyType:        listing.propertyType ?? "Commercial",
    condition:           "Good",   // default — sourcer can override via SSAS panel
    tenantType:          commercial?.currentUse ?? "",
    postcode:            addr?.postcode ?? "",
    daysOnMarket:        listing.daysOnMarket ?? 0,
    epcRating:           listing.epcRating,
    hasReduction:        bmv?.hasReduction ?? false,
    reductionPct:        bmv?.reductionPercentage ?? 0,
  })

  await prisma.propertyListing.update({
    where: { id: listing.id },
    data:  {
      ssasAnalysis: result as any,
      annualRent:   annualRent > 0 ? annualRent : undefined,
    },
  })

  return result
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!["admin", "sourcer"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()

    // ── Single listing ─────────────────────────────────────────────────────
    if (body.id) {
      const listing = await prisma.propertyListing.findUnique({ where: { id: body.id } })
      if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const result = await analyzeOne(listing)
      return NextResponse.json({ success: true, analyzed: 1, result })
    }

    // ── Bulk — all COMMERCIAL listings ────────────────────────────────────
    if (body.all) {
      const listings = await prisma.propertyListing.findMany({
        where: { category: "COMMERCIAL" },
        orderBy: { scrapedAt: "desc" },
      })
      await Promise.all(listings.map(analyzeOne))
      return NextResponse.json({ success: true, analyzed: listings.length })
    }

    // ── Partial override — caller provides known values ──────────────────
    // body: { id, annualRent, leaseYears, condition, tenantType, loanRate, loanTerm, loanLtv }
    if (body.id && body.annualRent !== undefined) {
      const listing = await prisma.propertyListing.findUnique({ where: { id: body.id } })
      if (!listing) return NextResponse.json({ error: "Not found" }, { status: 404 })
      const addr     = listing.address as any
      const commercial = listing.commercialDetails as any
      const bmv      = listing.bmvIndicators as any
      const result   = analyzeSsasProperty({
        price:               Number(listing.price),
        annualRent:          body.annualRent,
        leaseYearsRemaining: body.leaseYears ?? commercial?.leaseYearsRemaining ?? 0,
        propertyType:        listing.propertyType ?? "Commercial",
        condition:           body.condition ?? "Good",
        tenantType:          body.tenantType ?? commercial?.currentUse ?? "",
        postcode:            addr?.postcode ?? "",
        daysOnMarket:        listing.daysOnMarket ?? 0,
        epcRating:           listing.epcRating,
        loanRatePercent:     body.loanRate,
        loanTermYears:       body.loanTerm,
        loanLtvPercent:      body.loanLtv,
        hasReduction:        bmv?.hasReduction ?? false,
        reductionPct:        bmv?.reductionPercentage ?? 0,
      })
      await prisma.propertyListing.update({
        where: { id: listing.id },
        data:  { ssasAnalysis: result as any, annualRent: body.annualRent },
      })
      return NextResponse.json({ success: true, analyzed: 1, result })
    }

    return NextResponse.json({ error: "Provide id or all:true" }, { status: 400 })
  } catch (error: any) {
    console.error("[SSAS Analyze]", error)
    return NextResponse.json({ error: error.message || "Failed" }, { status: 500 })
  }
}
