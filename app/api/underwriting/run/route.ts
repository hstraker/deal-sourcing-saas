/**
 * API Route: POST /api/underwriting/run
 * Runs the dual-layer underwriting engine (BMV screening + Capital Allocator).
 * Body: UnderwritingInput. Returns: UnderwritingResponse.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { runUnderwriting } from "@/lib/engine"
import { z } from "zod"

const investorTargetsSchema = z.object({
  BTL: z.object({ minCashOnCash: z.number(), minDSCR: z.number() }),
  BRRR: z.object({ maxCapitalLeftPercent: z.number(), minDSCR: z.number() }),
  Flip: z.object({ minROI: z.number(), minAnnualisedROI: z.number() }),
  BuyHold: z.object({ minIRR: z.number() }),
})

const underwritingInputSchema = z.object({
  purchasePrice: z.number(),
  askingPrice: z.number(),
  marketValue: z.number(),
  refurbCost: z.number(),
  monthlyRent: z.number(),
  annualRentGrowth: z.number(),
  annualGrowthRate: z.number(),
  mortgageRate: z.number(),
  mortgageTermYears: z.number(),
  ltv: z.number(),
  refinanceLTV: z.number(),
  buyingCosts: z.number(),
  sellingCostsPercent: z.number(),
  annualOperatingCosts: z.number(),
  holdPeriodYears: z.number(),
  investorTargets: investorTargetsSchema,
})

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
    const parsed = underwritingInputSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const result = runUnderwriting(parsed.data)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Underwriting] Error:", error)
    return NextResponse.json(
      { error: "Underwriting calculation failed" },
      { status: 500 }
    )
  }
}
