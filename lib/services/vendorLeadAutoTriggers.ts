/**
 * Auto-trigger service for newly created vendor leads.
 *
 * Runs fire-and-forget after lead creation in three phases:
 *
 *   Phase 1 — Normalise address / extract postcode (if missing)
 *
 *   Phase 2 — Run in PARALLEL (both are independent of each other):
 *     • Portal check   — live listing, ownership, scraped listings, freeholds
 *     • Fetch comps    — comparable sold prices + area rental data via PropertyData
 *
 *   Phase 3 — Full BMV / validation calculation
 *     • Runs AFTER comparables are stored so the BMV engine can use them as
 *       its Priority 1 data source (stored comp average) instead of falling
 *       back to the PropertyData /sold-prices API.
 *
 *   Phase 4 — Update processingStatus + notify sourcers if validation passed
 *
 * Correct data dependency chain:
 *   Comparables → BMV calculation (market value, rent, BMV%, offer, validation)
 */

import { prisma } from "@/lib/db"
import { ProcessingStatus } from "@prisma/client"
import { normaliseAddress } from "@/lib/vendor-checks/address-normaliser"
import { runVendorCheck } from "@/lib/vendor-checks/vendor-check-orchestrator"
import { fetchComparablesForLead } from "@/lib/services/fetchComparablesForLead"
import { sendSourcerValidationPassedEmail } from "@/lib/email"

const LOG = "[AutoTriggers]"

/**
 * Call the calculate-bmv API route internally, bypassing session auth.
 * Uses INTERNAL_SERVICE_SECRET from env; if not set the call is skipped and
 * a warning is logged — the sourcer can run the calculation manually.
 */
async function runFullBmvCalculation(leadId: string): Promise<void> {
  const secret = process.env.INTERNAL_SERVICE_SECRET
  if (!secret) {
    console.warn(
      `${LOG} INTERNAL_SERVICE_SECRET not set — skipping auto BMV calculation for ${leadId}. ` +
      `Set this env var to enable automatic validation on lead creation.`
    )
    return
  }

  // Build the base URL: prefer NEXTAUTH_URL (set in all envs), fall back to localhost
  const baseUrl =
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    `http://localhost:${process.env.PORT ?? 3000}`

  const url = `${baseUrl}/api/vendor-leads/${leadId}/calculate-bmv`

  console.log(`${LOG} Triggering full BMV calculation for ${leadId} via ${url}`)

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-token": secret,
    },
    body: JSON.stringify({}),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => "(no body)")
    throw new Error(`BMV calculation returned ${res.status}: ${body}`)
  }

  console.log(`${LOG} BMV calculation completed for ${leadId}`)
}

export async function runVendorLeadAutoTriggers(leadId: string): Promise<void> {
  // ── Phase 1: Load lead ────────────────────────────────────────────────────
  const lead = await prisma.vendorLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
    },
  })

  if (!lead) {
    console.error(`${LOG} Lead not found: ${leadId}`)
    return
  }

  try {
    // ── Phase 1a: Normalise address / extract postcode ────────────────────
    if (!lead.propertyPostcode && lead.propertyAddress) {
      const normalised = normaliseAddress(lead.propertyAddress)
      if (normalised.postcode) {
        await prisma.vendorLead.update({
          where: { id: leadId },
          data: {
            postcodeOriginal: lead.propertyAddress,
            propertyPostcode: normalised.postcode,
            propertyPostcodeFixed: true,
            propertyPostcodeSource: "address_normaliser",
          },
        })
        console.log(`${LOG} Extracted postcode ${normalised.postcode} for lead ${leadId}`)
      }
    }

    // ── Phase 1b: Mark as RUNNING ─────────────────────────────────────────
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { processingStatus: ProcessingStatus.RUNNING },
    })

    // ── Phase 2: Portal check + comparables — run in PARALLEL ────────────
    // Portal check and comparables are fully independent so we run them
    // simultaneously to minimise total latency.
    console.log(`${LOG} Phase 2 — portal check + comparables in parallel for ${leadId}`)

    const [portalResult, compsResult] = await Promise.allSettled([
      runVendorCheck(leadId, "auto"),
      fetchComparablesForLead(leadId),
    ])

    const portalOk = portalResult.status === "fulfilled"
    const compsOk  = compsResult.status === "fulfilled"

    if (!portalOk) {
      console.error(`${LOG} Portal check failed for ${leadId}:`, (portalResult as PromiseRejectedResult).reason)
    }
    if (!compsOk) {
      console.error(`${LOG} Comparables fetch failed for ${leadId}:`, (compsResult as PromiseRejectedResult).reason)
    } else {
      const comps = (compsResult as PromiseFulfilledResult<Awaited<ReturnType<typeof fetchComparablesForLead>>>).value
      if (comps.error) {
        console.warn(`${LOG} Comparables fetch returned warning for ${leadId}: ${comps.error}`)
      } else {
        console.log(`${LOG} Comparables: ${comps.count} stored, avg £${comps.avgPrice?.toLocaleString() ?? "n/a"}, confidence ${comps.confidence}`)
      }
    }

    // ── Phase 3: Full BMV calculation (after comparables are stored) ──────
    // The BMV engine uses stored comparables as Priority 1 for market value
    // and rental data — so this MUST run after Phase 2 completes.
    console.log(`${LOG} Phase 3 — full BMV/validation calculation for ${leadId}`)

    const bmvResult = await Promise.allSettled([runFullBmvCalculation(leadId)])
    const bmvOk = bmvResult[0].status === "fulfilled"

    if (!bmvOk) {
      console.error(`${LOG} BMV calculation failed for ${leadId}:`, (bmvResult[0] as PromiseRejectedResult).reason)
    }

    // ── Phase 4: Update final status + timestamps ─────────────────────────
    const allOk = portalOk && compsOk && bmvOk
    const finalStatus: ProcessingStatus = allOk ? ProcessingStatus.COMPLETE : ProcessingStatus.FAILED

    await prisma.vendorLead.update({
      where: { id: leadId },
      data: {
        processingStatus: finalStatus,
        ...(portalOk ? { portalCheckedAt: new Date() } : {}),
        ...(compsOk   ? { comparablesFetchedAt: new Date() } : {}),
        ...(bmvOk && lead.askingPrice != null ? { bmvValidatedAt: new Date() } : {}),
      },
    })

    console.log(`${LOG} Lead ${leadId} → ${finalStatus} (portal:${portalOk ? "✓" : "✗"} comps:${compsOk ? "✓" : "✗"} bmv:${bmvOk ? "✓" : "✗"})`)

    // ── Phase 4b: Notify sourcers if validation passed ────────────────────
    if (finalStatus === ProcessingStatus.COMPLETE) {
      try {
        const updatedLead = await prisma.vendorLead.findUnique({
          where: { id: leadId },
          select: {
            id: true,
            propertyAddress: true,
            validationPassed: true,
            bmvScore: true,
            profitPotential: true,
          },
        })

        if (updatedLead?.validationPassed) {
          const sourcers = await prisma.user.findMany({
            where: { role: { in: ["admin", "sourcer"] }, isActive: true },
            select: { id: true, email: true, firstName: true },
          })

          await Promise.allSettled(
            sourcers.map((u) =>
              sendSourcerValidationPassedEmail({
                to: u.email,
                sourcerName: u.firstName ?? u.email,
                propertyAddress: updatedLead.propertyAddress ?? "Unknown address",
                bmvScore: updatedLead.bmvScore ? Number(updatedLead.bmvScore) : undefined,
                profitPotential: updatedLead.profitPotential
                  ? Number(updatedLead.profitPotential)
                  : undefined,
                leadId: updatedLead.id,
              })
            )
          )

          console.log(`${LOG} Validation-passed emails sent for lead ${leadId} to ${sourcers.length} user(s)`)
        }
      } catch (notifyErr: any) {
        // Don't let notification failure affect the auto-trigger result
        console.error(`${LOG} Failed to send validation-passed notifications for ${leadId}:`, notifyErr?.message)
      }
    }
  } catch (err: any) {
    console.error(`${LOG} Unhandled error for lead ${leadId}:`, err?.message)
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { processingStatus: ProcessingStatus.FAILED },
    }).catch(() => {/* ignore secondary failure */})
    throw err
  }
}
