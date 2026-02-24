import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { calculatePropertyOffer } from "@/lib/offer-engine/property-offer-calculator"
import type { OfferEngineInputs } from "@/lib/offer-engine/property-offer-calculator"
import { generateBothLadders } from "@/lib/offer-engine/negotiation-ladder"

interface RouteParams {
  params: { id: string }
}

// POST /api/deals/[id]/calculate-offer
// Body: optional overrides { gdv?, estimatedRent?, totalRefurbishment?, ...other inputs }
// Returns: OfferCalculationResult (also saves to deal record)
export async function POST(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      askingPrice: true,
      afterRefurbValue: true,
      estimatedRefurbCost: true,
      estimatedMonthlyRent: true,
      squareFeet: true,
    },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  // Parse optional overrides from request body
  let overrides: Partial<OfferEngineInputs> = {}
  try {
    const body = await req.json()
    if (body && typeof body === "object") {
      overrides = body as Partial<OfferEngineInputs>
    }
  } catch {
    // No body or invalid JSON — use defaults
  }

  const askingPrice = Number(deal.askingPrice)
  const gdv = overrides.gdv ?? (deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null)
  const totalRefurbishment =
    overrides.totalRefurbishment ??
    (deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null)
  const estimatedRent =
    overrides.estimatedRent ??
    (deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null)

  if (!gdv || !totalRefurbishment || !estimatedRent) {
    return NextResponse.json(
      {
        error: "Missing required fields",
        missing: {
          gdv: !gdv,
          totalRefurbishment: !totalRefurbishment,
          estimatedRent: !estimatedRent,
        },
        hint: "Provide gdv, totalRefurbishment, and estimatedRent on the deal or as overrides in the request body.",
      },
      { status: 422 }
    )
  }

  const inputs: OfferEngineInputs = {
    askingPrice,
    gdv,
    estimatedRent,
    totalRefurbishment,
    propertySize: deal.squareFeet ? deal.squareFeet * 0.0929 : undefined, // sqft → sqm
    ...overrides,
  }

  const result = calculatePropertyOffer(inputs)
  const ladders = generateBothLadders(result)

  // Persist result and ladders to deal record
  await prisma.deal.update({
    where: { id: params.id },
    data: {
      offerCalculation: result as object,
      offerCalculatedAt: new Date(),
      flipOfferPrice: result.flip.offerPrice > 0 ? result.flip.offerPrice : null,
      holdOfferPrice: result.hold.offerPrice > 0 ? result.hold.offerPrice : null,
      recommendedStrategy: result.recommendedStrategy,
      negotiationLadder: ladders as object,
    },
  })

  return NextResponse.json({ ...result, ladders })
}

// GET /api/deals/[id]/calculate-offer
// Returns cached offer calculation if available
export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions)
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const deal = await prisma.deal.findUnique({
    where: { id: params.id },
    select: { offerCalculation: true, offerCalculatedAt: true },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  if (!deal.offerCalculation) {
    return NextResponse.json({ offerCalculation: null, offerCalculatedAt: null })
  }

  return NextResponse.json({
    offerCalculation: deal.offerCalculation,
    offerCalculatedAt: deal.offerCalculatedAt?.toISOString() ?? null,
  })
}
