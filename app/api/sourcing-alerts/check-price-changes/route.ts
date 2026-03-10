/**
 * POST /api/sourcing-alerts/check-price-changes
 *
 * Compares current prices of watchlisted properties against last known price.
 * Protected by INTERNAL_API_SECRET.
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendPriceChangeEmail } from "@/lib/notifications/sendAlertEmail"
import { sendPriceChangeSms } from "@/lib/notifications/sendAlertSms"

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret")
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const watchlist = await prisma.watchlistProperty.findMany({
    include: {
      propertyListing: {
        select: { id: true, price: true, listingUrl: true, address: true },
      },
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          notificationPrefs: true,
        },
      },
    },
  })

  let changed = 0
  let notified = 0

  for (const entry of watchlist) {
    const listing = entry.propertyListing
    if (!listing.price) continue

    const currentPrice = Math.round(Number(listing.price))
    const lastPrice = entry.lastKnownPrice

    if (currentPrice === lastPrice) continue

    changed++

    const prefs = entry.user.notificationPrefs
    const shouldEmail = !prefs || (currentPrice > lastPrice ? prefs.priceIncrease : prefs.priceDecrease)
    const deliverEmail = !prefs || prefs.deliveryEmail
    const deliverSms = prefs?.deliverySms ?? false

    const addressStr = typeof listing.address === "object"
      ? Object.values(listing.address as Record<string, string>).filter(Boolean).join(", ")
      : String(listing.address ?? "")

    if (shouldEmail && deliverEmail && entry.user.email) {
      await sendPriceChangeEmail({
        toEmail: entry.user.email,
        address: addressStr,
        oldPrice: lastPrice,
        newPrice: currentPrice,
        listingUrl: listing.listingUrl,
      })
    }

    if (shouldEmail && deliverSms && entry.user.phone) {
      await sendPriceChangeSms({
        toPhone: entry.user.phone,
        address: addressStr,
        oldPrice: lastPrice,
        newPrice: currentPrice,
      })
      notified++
    } else if (shouldEmail && deliverEmail && entry.user.email) {
      notified++
    }

    // Update last known price
    await prisma.watchlistProperty.update({
      where: { id: entry.id },
      data: { lastKnownPrice: currentPrice },
    })
  }

  return NextResponse.json({ changed, notified })
}
