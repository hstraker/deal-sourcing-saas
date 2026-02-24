/**
 * API Route: POST /api/underwriting/screening
 * Runs BMV screening only (no Capital Allocator). Returns ScreeningResult.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { runBmvScreening } from "@/lib/engine"
import { z } from "zod"

const screeningBodySchema = z.object({
  askingPrice: z.number(),
  marketValue: z.number(),
  monthlyRent: z.number().optional(),
  refurbCost: z.number().optional(),
  screeningConfig: z
    .object({
      minDiscountPercent: z.number().optional(),
      minGrossYieldPercent: z.number().optional(),
    })
    .optional(),
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
    const parsed = screeningBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const { askingPrice, marketValue, screeningConfig } = parsed.data
    const monthlyRent = parsed.data.monthlyRent ?? 0
    const refurbCost = parsed.data.refurbCost ?? 0

    const result = runBmvScreening(
      { askingPrice, marketValue, monthlyRent, refurbCost },
      screeningConfig
    )
    return NextResponse.json(result)
  } catch (error) {
    console.error("[Underwriting Screening] Error:", error)
    return NextResponse.json(
      { error: "Screening calculation failed" },
      { status: 500 }
    )
  }
}
