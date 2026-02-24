import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface RouteParams {
  params: { id: string }
}

interface WalkAwayBody {
  strategy?: "flip" | "hold"
  reason?: string
}

// POST /api/deals/[id]/walk-away
// Records a walk-away decision after best & final is rejected
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
    select: { id: true, offerOutcome: true },
  })

  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 })
  }

  if (deal.offerOutcome === "accepted") {
    return NextResponse.json(
      { error: "Deal has already been accepted — cannot walk away" },
      { status: 409 }
    )
  }

  let body: WalkAwayBody = {}
  try {
    body = (await req.json()) as WalkAwayBody
  } catch {
    // Body is optional
  }

  const updatedDeal = await prisma.deal.update({
    where: { id: params.id },
    data: {
      offerOutcome: "walked_away",
      status: "archived",
    },
    select: {
      id: true,
      offerOutcome: true,
      status: true,
      negotiationStrategy: true,
    },
  })

  void body // reason could be stored in a communication record in future

  return NextResponse.json(updatedDeal)
}
