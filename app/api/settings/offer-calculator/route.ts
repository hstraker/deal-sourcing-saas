import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const configUpdateSchema = z.object({
  enableStrategyMode:    z.boolean().optional(),
  activeStrategies:      z.array(z.string()).optional(),
  defaultStrategy:       z.string().optional(),
  baseDiscountMin:       z.number().min(0).max(50).optional(),
  baseDiscountMax:       z.number().min(10).max(60).optional(),
  poorConditionDiscount: z.number().min(0).max(30).optional(),
  avgConditionDiscount:  z.number().min(0).max(20).optional(),
  leaseholdDiscount:     z.number().min(0).max(20).optional(),
  longChainDiscount:     z.number().min(0).max(20).optional(),
  shortChainDiscount:    z.number().min(0).max(10).optional(),
  highDemandThreshold:   z.number().int().min(1).max(10).optional(),
  highDemandReduction:   z.number().min(0).max(20).optional(),
  flipMarketValuePct:    z.number().min(50).max(90).optional(),
  brrLtvPercent:         z.number().min(50).max(85).optional(),
  buyHoldMinYield:       z.number().min(1).max(20).optional(),
  btlMinYield:           z.number().min(1).max(20).optional(),
  minBmvPercentage:      z.number().min(0).max(50).optional(),
  minProfitPotential:    z.number().min(0).optional(),
})

const DEFAULTS = {
  enableStrategyMode:    false,
  activeStrategies:      ["BuyHold", "BTL"],
  defaultStrategy:       "BuyHold",
  baseDiscountMin:       10,
  baseDiscountMax:       40,
  poorConditionDiscount: 10,
  avgConditionDiscount:  3,
  leaseholdDiscount:     5,
  longChainDiscount:     5,
  shortChainDiscount:    2,
  highDemandThreshold:   8,
  highDemandReduction:   5,
  flipMarketValuePct:    70,
  brrLtvPercent:         75,
  buyHoldMinYield:       8,
  btlMinYield:           7,
  minBmvPercentage:      15,
  minProfitPotential:    10000,
}

async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session) return null
  if (session.user.role !== "admin") return null
  return session
}

export async function GET() {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let config = await prisma.offerCalculatorConfig.findFirst()

    if (!config) {
      config = await prisma.offerCalculatorConfig.create({ data: DEFAULTS })
    }

    return NextResponse.json({ success: true, config })
  } catch (error) {
    console.error("[Offer Calculator Settings] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdmin()
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = configUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const existing = await prisma.offerCalculatorConfig.findFirst()

    let config
    if (existing) {
      config = await prisma.offerCalculatorConfig.update({
        where: { id: existing.id },
        data: parsed.data,
      })
    } else {
      config = await prisma.offerCalculatorConfig.create({
        data: { ...DEFAULTS, ...parsed.data },
      })
    }

    return NextResponse.json({ success: true, config })
  } catch (error) {
    console.error("[Offer Calculator Settings] PUT error:", error)
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 })
  }
}
