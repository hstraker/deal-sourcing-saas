/**
 * POST /api/admin/fix-postcodes
 *
 * Scans PropertyListing AND VendorLead records and corrects postcodes that are:
 *  - Wrong area  (e.g. SE1 2LH stored for a Swansea property)
 *  - Outcode-only (e.g. "SA6" with no incode)
 *  - Missing entirely
 *
 * NOTE: This fixes your SCRAPED PROPERTY records and VENDOR LEADS — NOT the
 *       4.4M Land Registry (CompanyOwnership) records which are address reference data.
 *
 * Resolution order per record:
 *  1. Validate stored postcode against outcode in the display address
 *  2. Land Registry companyOwnership lookup (street name + outcode)
 *  3. postcodes.io free API (representative postcode for the outcode)
 *
 * Body: { dryRun?: boolean }
 * Returns: { propertyListings: {processed,corrected,failed}, vendorLeads: {processed,corrected,failed}, corrections[] }
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { resolvePostcodeFromAddress } from "@/lib/land-registry"

const BATCH_SIZE = 50

type Correction = {
  table: "PropertyListing" | "VendorLead"
  id: string
  source: string
  displayAddress: string
  before: string | null
  after: string
  via: string
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const dryRun = body?.dryRun === true

    console.log(`[FixPostcodes] Starting postcode repair (dryRun=${dryRun})`)

    // Shared outcode → full-postcode cache so postcodes.io is called at most once
    // per unique outcode rather than once per property record.
    const outcodeCache = new Map<string, string | null>()

    const corrections: Correction[] = []

    // ── Step 1: PropertyListing records ──────────────────────────────────────
    const plStats = { processed: 0, corrected: 0, failed: 0 }
    type PlRow = { id: string; source: string; address: unknown }
    let cursor: string | undefined = undefined

    for (;;) {
      const batch: PlRow[] = await prisma.propertyListing.findMany({
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        select: { id: true, source: true, address: true },
        orderBy: { id: "asc" },
      })

      if (batch.length === 0) break
      cursor = batch[batch.length - 1].id

      for (const listing of batch) {
        plStats.processed++
        const addr = listing.address as Record<string, unknown> | null
        const displayAddress = typeof addr?.displayAddress === "string" ? addr.displayAddress : null
        const storedPostcode = typeof addr?.postcode === "string" ? addr.postcode : null

        if (!displayAddress) continue

        try {
          const resolved = await resolvePostcodeFromAddress(displayAddress, storedPostcode, outcodeCache)
          if (!resolved || !resolved.corrected) continue

          corrections.push({
            table: "PropertyListing",
            id: listing.id,
            source: listing.source,
            displayAddress,
            before: storedPostcode,
            after: resolved.postcode,
            via: resolved.source,
          })

          if (!dryRun) {
            await prisma.propertyListing.update({
              where: { id: listing.id },
              data: { address: { ...addr, postcode: resolved.postcode } as any },
            })
          }

          plStats.corrected++
        } catch (err: any) {
          plStats.failed++
          console.error(`[FixPostcodes] PropertyListing ${listing.id} failed:`, err.message)
        }
      }

      await new Promise((r) => setTimeout(r, 50)) // avoid hammering the DB
    }

    // ── Step 2: VendorLead records ────────────────────────────────────────────
    const vlStats = { processed: 0, corrected: 0, failed: 0 }
    type VlRow = { id: string; propertyAddress: string | null; propertyPostcode: string | null }
    let vlCursor: string | undefined = undefined

    for (;;) {
      const batch: VlRow[] = await prisma.vendorLead.findMany({
        take: BATCH_SIZE,
        ...(vlCursor ? { skip: 1, cursor: { id: vlCursor } } : {}),
        select: { id: true, propertyAddress: true, propertyPostcode: true },
        orderBy: { id: "asc" },
      })

      if (batch.length === 0) break
      vlCursor = batch[batch.length - 1].id

      for (const lead of batch) {
        vlStats.processed++
        if (!lead.propertyAddress) continue

        try {
          const resolved = await resolvePostcodeFromAddress(lead.propertyAddress, lead.propertyPostcode, outcodeCache)
          if (!resolved || !resolved.corrected) continue

          corrections.push({
            table: "VendorLead",
            id: lead.id,
            source: "vendor_lead",
            displayAddress: lead.propertyAddress,
            before: lead.propertyPostcode,
            after: resolved.postcode,
            via: resolved.source,
          })

          if (!dryRun) {
            await prisma.vendorLead.update({
              where: { id: lead.id },
              data: { propertyPostcode: resolved.postcode },
            })
          }

          vlStats.corrected++
        } catch (err: any) {
          vlStats.failed++
          console.error(`[FixPostcodes] VendorLead ${lead.id} failed:`, err.message)
        }
      }

      await new Promise((r) => setTimeout(r, 50))
    }

    const totalProcessed = plStats.processed + vlStats.processed
    const totalCorrected = plStats.corrected + vlStats.corrected

    console.log(
      `[FixPostcodes] Done. PropertyListings: ${plStats.processed} scanned, ${plStats.corrected} corrected. ` +
      `VendorLeads: ${vlStats.processed} scanned, ${vlStats.corrected} corrected. dryRun=${dryRun}`
    )

    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalProcessed,
        totalCorrected,
        propertyListings: plStats,
        vendorLeads: vlStats,
      },
      // Legacy fields for backwards compat with UI
      processed: totalProcessed,
      corrected: totalCorrected,
      failed: plStats.failed + vlStats.failed,
      corrections: corrections.slice(0, 200),
    })
  } catch (error: any) {
    console.error("[FixPostcodes] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
