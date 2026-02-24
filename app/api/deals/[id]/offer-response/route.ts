import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface RouteParams {
  params: { id: string }
}

interface OfferResponseBody {
  round: number
  response: "accepted" | "rejected"
  notes?: string
  agreedPrice?: number
}

// POST /api/deals/[id]/offer-response
// Records vendor acceptance or rejection of an offer rung
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
      currentOfferPrice: true,
      currentOfferRound: true,
      offerOutcome: true,
    },
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

  let body: OfferResponseBody
  try {
    body = (await req.json()) as OfferResponseBody
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { response, agreedPrice } = body

  if (response === "accepted") {
    const agreedAt = new Date()
    const finalPrice = agreedPrice ?? deal.currentOfferPrice ?? undefined

    const updatedDeal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        offerOutcome: "accepted",
        dealAgreedPrice: finalPrice,
        dealAgreedAt: agreedAt,
        offerAcceptedAt: agreedAt,
        status: "in_progress",
      },
      select: {
        id: true,
        offerOutcome: true,
        dealAgreedPrice: true,
        dealAgreedAt: true,
        status: true,
      },
    })

    return NextResponse.json(updatedDeal)
  } else {
    // Rejected — advance to next round
    const updatedDeal = await prisma.deal.update({
      where: { id: params.id },
      data: {
        currentOfferRound: { increment: 1 },
        offerOutcome: "in_progress",
      },
      select: {
        id: true,
        currentOfferRound: true,
        offerOutcome: true,
      },
    })

    return NextResponse.json(updatedDeal)
  }
}
