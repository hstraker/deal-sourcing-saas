import { getServerSession } from "next-auth"
import { NextResponse } from "next/server"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorised" }, { status: 401 })

  const body = await req.json()
  const {
    deliveryEmail, deliverySms, deliveryInApp,
    priceIncrease, priceDecrease,
    newPropertyMatch,
    auctionReminder7Days, auctionReminder3Days, auctionReminder1Day,
  } = body

  const data: Record<string, boolean> = {}
  if (deliveryEmail    !== undefined) data.deliveryEmail    = !!deliveryEmail
  if (deliverySms      !== undefined) data.deliverySms      = !!deliverySms
  if (deliveryInApp    !== undefined) data.deliveryInApp    = !!deliveryInApp
  if (priceIncrease    !== undefined) data.priceIncrease    = !!priceIncrease
  if (priceDecrease    !== undefined) data.priceDecrease    = !!priceDecrease
  if (newPropertyMatch !== undefined) data.newPropertyMatch = !!newPropertyMatch
  if (auctionReminder7Days !== undefined) data.auctionReminder7Days = !!auctionReminder7Days
  if (auctionReminder3Days !== undefined) data.auctionReminder3Days = !!auctionReminder3Days
  if (auctionReminder1Day  !== undefined) data.auctionReminder1Day  = !!auctionReminder1Day

  const prefs = await prisma.notificationPreference.upsert({
    where:  { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  })

  return NextResponse.json(prefs)
}
