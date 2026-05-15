/**
 * PATCH /api/vendor-leads/[id]/comparables/[compId]
 *
 * Update a comparable property's excluded flag or manual price override.
 * After updating, recomputes and saves avgComparablePrice on the parent VendorLead
 * using only non-excluded comps (and manualPriceOverride where set).
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; compId: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 })

  // Verify the comparable belongs to this lead
  const comp = await prisma.comparableProperty.findUnique({
    where: { id: params.compId },
    select: { id: true, vendorLeadId: true },
  })
  if (!comp || comp.vendorLeadId !== params.id) {
    return NextResponse.json({ error: "Comparable not found" }, { status: 404 })
  }

  // Build update payload — only touch fields that were sent
  const updateData: Record<string, unknown> = {}
  if (typeof body.excluded === "boolean") {
    updateData.excluded = body.excluded
  }
  if ("manualPriceOverride" in body) {
    // null clears the override; a number sets it
    updateData.manualPriceOverride = body.manualPriceOverride != null
      ? parseFloat(String(body.manualPriceOverride))
      : null
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 })
  }

  // Update the comparable
  const updated = await prisma.comparableProperty.update({
    where: { id: params.compId },
    data: updateData,
    select: {
      id: true,
      excluded: true,
      manualPriceOverride: true,
      salePrice: true,
    },
  })

  // ── Recompute avgComparablePrice on the VendorLead ──────────────────────────
  // Use manualPriceOverride when set, otherwise salePrice; exclude flagged comps.
  const allComps = await prisma.comparableProperty.findMany({
    where: { vendorLeadId: params.id },
    select: { salePrice: true, manualPriceOverride: true, excluded: true },
  })

  const activePrices = allComps
    .filter((c) => !c.excluded)
    .map((c) =>
      c.manualPriceOverride != null
        ? c.manualPriceOverride.toNumber()
        : c.salePrice.toNumber()
    )

  const newAvg = activePrices.length > 0
    ? Math.round(activePrices.reduce((s, p) => s + p, 0) / activePrices.length)
    : null

  // Only update the avg price — comparablesCount stays as the total fetched count
  // so the table column always shows total, and the modal shows "X of N active"
  await prisma.vendorLead.update({
    where: { id: params.id },
    data: { avgComparablePrice: newAvg },
  })

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      excluded: updated.excluded,
      manualPriceOverride: updated.manualPriceOverride?.toNumber() ?? null,
    },
    avgComparablePrice: newAvg,
  })
}
