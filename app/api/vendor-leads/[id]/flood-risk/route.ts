/**
 * POST /api/vendor-leads/[id]/flood-risk
 *
 * Checks flood risk for the lead's postcode using:
 *   1. postcodes.io — resolve postcode → lat/lng
 *   2. EA Flood Monitoring API — find nearby flood alert areas within 2km
 *
 * Returns flood zone classification (zone1/zone2/zone3/unknown) and nearby areas.
 * Both external APIs are free and require no API key.
 *
 * Sourcer / Admin only.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

interface PostcodesIoResult {
  latitude: number
  longitude: number
}

interface EaFloodArea {
  label?: string
  riverOrSea?: string
  floodType?: string
  description?: string
}

interface EaFloodResponse {
  items: EaFloodArea[]
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session) return new NextResponse("Unauthorized", { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return new NextResponse("Forbidden", { status: 403 })
  }

  // ── Fetch lead ────────────────────────────────────────────────────────────
  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: { id: true, propertyPostcode: true },
  })
  if (!lead) return new NextResponse("Lead not found", { status: 404 })

  const postcode = lead.propertyPostcode?.trim()
  if (!postcode) {
    return NextResponse.json({ error: "No postcode on this lead" }, { status: 400 })
  }

  // ── Resolve postcode → lat/lng ────────────────────────────────────────────
  let lat: number
  let lng: number
  try {
    const pcRes = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!pcRes.ok) {
      const errBody = await pcRes.json().catch(() => ({}))
      const msg = (errBody as { error?: string }).error ?? `postcodes.io returned ${pcRes.status}`
      return NextResponse.json(
        { zone: "unknown", error: `Postcode lookup failed: ${msg}`, postcode },
        { status: 200 }
      )
    }
    const pcData = await pcRes.json() as { result: PostcodesIoResult }
    lat = pcData.result.latitude
    lng = pcData.result.longitude
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { zone: "unknown", error: `Postcode lookup error: ${msg}`, postcode },
      { status: 200 }
    )
  }

  // ── Query EA Flood Monitoring API ─────────────────────────────────────────
  let floodAreas: EaFloodArea[] = []
  try {
    const eaRes = await fetch(
      `https://environment.data.gov.uk/flood-monitoring/id/floodAreas?lat=${lat}&long=${lng}&dist=2`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!eaRes.ok) {
      return NextResponse.json(
        { zone: "unknown", error: `EA API returned ${eaRes.status}`, postcode, lat, lng },
        { status: 200 }
      )
    }
    const eaData = await eaRes.json() as EaFloodResponse
    floodAreas = Array.isArray(eaData.items) ? eaData.items : []
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { zone: "unknown", error: `EA flood API error: ${msg}`, postcode, lat, lng },
      { status: 200 }
    )
  }

  // ── Determine flood zone ──────────────────────────────────────────────────
  // Zone 3 = >1% annual chance (high risk)
  // Zone 2 = 0.1–1% annual chance (medium risk)
  // Zone 1 = <0.1% annual chance (low risk) — no EA alert areas within 2km
  const hasZone3 = floodAreas.some((area) => {
    const label = (area.label ?? "").toLowerCase()
    const floodType = (area.floodType ?? "").toLowerCase()
    const description = (area.description ?? "").toLowerCase()
    return (
      label.includes("zone 3") ||
      floodType.includes("zone 3") ||
      description.includes("zone 3")
    )
  })

  let zone: "zone1" | "zone2" | "zone3" | "unknown"
  if (floodAreas.length === 0) {
    zone = "zone1"
  } else if (hasZone3) {
    zone = "zone3"
  } else {
    zone = "zone2"
  }

  // ── Build nearby areas list (up to 10, deduplicated) ──────────────────────
  const nearbyAreas = floodAreas
    .filter((a) => a.label || a.riverOrSea)
    .slice(0, 10)
    .map((a) => ({
      label: a.label ?? "",
      riverOrSea: a.riverOrSea ?? "",
    }))

  return NextResponse.json({
    zone,
    nearbyAreas,
    postcode,
    lat,
    lng,
    checkedAt: new Date().toISOString(),
  })
}
