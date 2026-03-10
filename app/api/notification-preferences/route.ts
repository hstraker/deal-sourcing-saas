import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prefs = await prisma.notificationPreference.findUnique({
    where: { userId: session.user.id },
  })

  if (!prefs) {
    // Return defaults without creating a row yet
    return NextResponse.json({
      priceIncrease: true,
      priceDecrease: true,
      auctionReminder7Days: true,
      auctionReminder3Days: true,
      auctionReminder1Day: true,
      newPropertyMatch: true,
      deliveryEmail: true,
      deliverySms: false,
      deliveryInApp: true,
    })
  }

  return NextResponse.json(prefs)
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  const prefs = await prisma.notificationPreference.upsert({
    where: { userId: session.user.id },
    update: {
      priceIncrease: body.priceIncrease ?? undefined,
      priceDecrease: body.priceDecrease ?? undefined,
      auctionReminder7Days: body.auctionReminder7Days ?? undefined,
      auctionReminder3Days: body.auctionReminder3Days ?? undefined,
      auctionReminder1Day: body.auctionReminder1Day ?? undefined,
      newPropertyMatch: body.newPropertyMatch ?? undefined,
      deliveryEmail: body.deliveryEmail ?? undefined,
      deliverySms: body.deliverySms ?? undefined,
      deliveryInApp: body.deliveryInApp ?? undefined,
    },
    create: {
      userId: session.user.id,
      priceIncrease: body.priceIncrease ?? true,
      priceDecrease: body.priceDecrease ?? true,
      auctionReminder7Days: body.auctionReminder7Days ?? true,
      auctionReminder3Days: body.auctionReminder3Days ?? true,
      auctionReminder1Day: body.auctionReminder1Day ?? true,
      newPropertyMatch: body.newPropertyMatch ?? true,
      deliveryEmail: body.deliveryEmail ?? true,
      deliverySms: body.deliverySms ?? false,
      deliveryInApp: body.deliveryInApp ?? true,
    },
  })

  return NextResponse.json(prefs)
}
