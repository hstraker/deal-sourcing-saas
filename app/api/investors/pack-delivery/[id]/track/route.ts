import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

// PATCH /api/investors/pack-delivery/[id]/track - Track view or download
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body // 'view' or 'download'

    if (!action || !["view", "download"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be 'view' or 'download'" },
        { status: 400 }
      )
    }

    const delivery = await prisma.investorPackDelivery.findUnique({
      where: { id: params.id },
      include: {
        investor: true,
      },
    })

    if (!delivery) {
      return NextResponse.json({ error: "Delivery not found" }, { status: 404 })
    }

    // Update delivery record
    const updateData: any = {}
    if (action === "view") {
      updateData.viewedAt = new Date()
      updateData.viewCount = { increment: 1 }
    } else if (action === "download") {
      updateData.downloadedAt = new Date()
      updateData.downloadCount = { increment: 1 }
    }

    const updatedDelivery = await prisma.investorPackDelivery.update({
      where: { id: params.id },
      data: updateData,
    })

    // Log activity
    await prisma.investorActivity.create({
      data: {
        investorId: delivery.investorId,
        activityType: action === "view" ? "PACK_VIEWED" : "PACK_DOWNLOADED",
        description: `Investor pack ${action}ed`,
        dealId: delivery.dealId,
        packDeliveryId: delivery.id,
      },
    })

    // Update investor's last activity
    await prisma.investor.update({
      where: { id: delivery.investorId },
      data: { lastActivityAt: new Date() },
    })

    return NextResponse.json({ delivery: updatedDelivery })
  } catch (error: any) {
    console.error("Error tracking delivery:", error)
    return NextResponse.json(
      { error: "Failed to track delivery" },
      { status: 500 }
    )
  }
}
