import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface RouteParams {
  params: { id: string }
}

interface SendOfferBody {
  strategy: "flip" | "hold"
  round: number
  offerPrice: number
}

// POST /api/deals/[id]/send-offer
// Records a sent offer rung in the negotiation ladder state
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
    select: { id: true, negotiationLadder: true, offerOutcome: true },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  if (deal.offerOutcome === "accepted" || deal.offerOutcome === "walked_away") {
    return NextResponse.json(
      { error: "Negotiation already concluded" },
      { status: 409 }
    )
  }

  let body: SendOfferBody
  try {
    body = (await req.json()) as SendOfferBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { strategy, round, offerPrice } = body

  if (typeof round !== "number" || typeof offerPrice !== "number") {
    return NextResponse.json({ error: "round and offerPrice are required" }, { status: 400 })
  }

  const updatedDeal = await prisma.deal.update({
    where: { id: params.id },
    data: {
      negotiationStrategy: strategy,
      currentOfferRound: round,
      currentOfferPrice: offerPrice,
      offerOutcome: "in_progress",
      latestOfferAmount: offerPrice,
      latestOfferDate: new Date(),
      offerCount: { increment: 1 },
    },
    select: {
      id: true,
      negotiationStrategy: true,
      currentOfferRound: true,
      currentOfferPrice: true,
      offerOutcome: true,
      offerCount: true,
    },
  })

  return NextResponse.json(updatedDeal)
}
