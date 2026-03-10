/**
 * POST /api/sourcing-alerts/match
 *
 * Matches newly scraped PropertyListings against active SourcingAlerts.
 * Protected by INTERNAL_API_SECRET so only the scraper post-hook can call it.
 *
 * Body: { since?: ISO date string }  (defaults to last 2 hours)
 *
 * Location matching: PropertyListing has no lat/lon, so we do a case-insensitive
 * text search — the listing's serialised address is checked for any word in the
 * alert's address (postcode, town, city, etc.).
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import { sendAlertMatchEmail } from "@/lib/notifications/sendAlertEmail"
import { sendAlertMatchSms } from "@/lib/notifications/sendAlertSms"

/** Tokenise an address into searchable words (min 3 chars, no numbers-only) */
function addressTokens(addr: string): string[] {
  return addr
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length >= 3 && !/^\d+$/.test(t))
}

/** Check if any token from the alert address appears in the serialised listing address */
function addressMatches(alertAddress: string, listingAddressJson: unknown): boolean {
  const serialised =
    typeof listingAddressJson === "string"
      ? listingAddressJson.toLowerCase()
      : JSON.stringify(listingAddressJson).toLowerCase()

  const tokens = addressTokens(alertAddress)
  // At least one meaningful token must appear (e.g. city name or postcode sector)
  return tokens.some((t) => serialised.includes(t))
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-internal-secret")
  if (secret !== process.env.INTERNAL_API_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const since = body.since ? new Date(body.since) : new Date(Date.now() - 2 * 60 * 60 * 1000)

  // Fetch all new listings since the cutoff
  const newListings = await prisma.propertyListing.findMany({
    where: { scrapedAt: { gte: since } },
    select: {
      id: true,
      address: true,
      price: true,
      bedrooms: true,
      propertyType: true,
      listingUrl: true,
    },
  })

  if (newListings.length === 0) {
    return NextResponse.json({ matched: 0, notified: 0 })
  }

  // Fetch all active alerts
  const alerts = await prisma.sourcingAlert.findMany({
    where: { isActive: true },
    include: {
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

  let matchCount = 0
  let notifyCount = 0

  for (const alert of alerts) {
    const prefs = alert.user.notificationPrefs

    for (const listing of newListings) {
      // Location filter — address text match
      if (!addressMatches(alert.address, listing.address)) continue

      // Price filter
      const price = listing.price ? Number(listing.price) : null
      if (price === null) continue
      if (alert.minPrice && price < alert.minPrice) continue
      if (alert.maxPrice && price > alert.maxPrice) continue

      // Bedrooms filter
      if (alert.minBedrooms && listing.bedrooms < alert.minBedrooms) continue
      if (alert.maxBedrooms && listing.bedrooms > alert.maxBedrooms) continue

      // Property type filter
      if (alert.propertyTypes.length > 0 && listing.propertyType) {
        const normalised = listing.propertyType.toLowerCase()
        const matches = alert.propertyTypes.some((t) => normalised.includes(t.toLowerCase()))
        if (!matches) continue
      }

      // Deduplicate
      const existing = await prisma.alertMatch.findUnique({
        where: { alertId_scrapedPropertyId: { alertId: alert.id, scrapedPropertyId: listing.id } },
      })
      if (existing) continue

      let notifiedEmail = false
      let notifiedSms = false

      const addressStr =
        typeof listing.address === "object"
          ? Object.values(listing.address as Record<string, string>).filter(Boolean).join(", ")
          : String(listing.address ?? "")

      // Email notification
      const shouldNotify = !prefs || prefs.newPropertyMatch
      const deliverEmail = !prefs || prefs.deliveryEmail
      if (shouldNotify && deliverEmail && alert.user.email) {
        const result = await sendAlertMatchEmail({
          toEmail: alert.user.email,
          alertName: alert.name || alert.address,
          address: addressStr,
          price,
          bedrooms: listing.bedrooms,
          propertyType: listing.propertyType,
          listingUrl: listing.listingUrl,
        })
        if (result.success) notifiedEmail = true
      }

      // SMS notification
      const deliverSms = prefs?.deliverySms ?? false
      if (shouldNotify && deliverSms && alert.user.phone) {
        const result = await sendAlertMatchSms({
          toPhone: alert.user.phone,
          alertName: alert.name || alert.address,
          address: addressStr,
          price,
        })
        if (result.success) notifiedSms = true
      }

      await prisma.alertMatch.create({
        data: {
          alertId: alert.id,
          scrapedPropertyId: listing.id,
          notifiedEmail,
          notifiedSms,
          notifiedInApp: true,
        },
      })

      matchCount++
      if (notifiedEmail || notifiedSms) notifyCount++
    }
  }

  return NextResponse.json({ matched: matchCount, notified: notifyCount })
}
