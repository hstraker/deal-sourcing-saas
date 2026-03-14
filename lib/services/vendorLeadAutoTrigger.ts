/**
 * Auto-trigger service for newly created vendor leads.
 *
 * Runs in the background (fire-and-forget) after a lead is created:
 *   1. Normalise address → extract/persist postcode if missing
 *   2. Run portal check (runVendorCheck) + BMV screening in parallel
 *   3. Update processingStatus + timestamps
 */

import { prisma } from "@/lib/db"
import { ProcessingStatus } from "@prisma/client"
import { normaliseAddress } from "@/lib/vendor-checks/address-normaliser"
import { runVendorCheck } from "@/lib/vendor-checks/vendor-check-orchestrator"
import { runBmvScreening } from "@/lib/engine/bmv/bmvCalculator"

export async function runVendorLeadAutoTriggers(leadId: string): Promise<void> {
  // ── 1. Fetch lead ────────────────────────────────────────────────────────
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
    console.error(`[AutoTrigger] Lead not found: ${leadId}`)
    return
  }

  // ── 2. Normalise address / extract postcode ──────────────────────────────
  let resolvedPostcode = lead.propertyPostcode
  if (!resolvedPostcode && lead.propertyAddress) {
    const normalised = normaliseAddress(lead.propertyAddress)
    if (normalised.postcode) {
      resolvedPostcode = normalised.postcode
      await prisma.vendorLead.update({
        where: { id: leadId },
        data: {
          postcodeOriginal: lead.propertyAddress,
          propertyPostcode: normalised.postcode,
        },
      })
    }
  }

  // ── 3. Mark as RUNNING ───────────────────────────────────────────────────
  await prisma.vendorLead.update({
    where: { id: leadId },
    data: { processingStatus: ProcessingStatus.RUNNING },
  })

  // ── 4. Run portal check + BMV screening in parallel ─────────────────────
  const portalCheckPromise = runVendorCheck(leadId, "auto")

  const bmvPromise: Promise<void> = (async () => {
    if (!lead.askingPrice) return
    const price = Number(lead.askingPrice)
    runBmvScreening({
      askingPrice: price,
      marketValue: price, // best-effort without independent valuation
      monthlyRent: 0,
      refurbCost: 0,
    })
    // BMV screening is synchronous; result used for timestamping only at this stage
  })()

  const [portalResult, bmvResult] = await Promise.allSettled([
    portalCheckPromise,
    bmvPromise,
  ])

  // ── 5. Resolve status + write timestamps ─────────────────────────────────
  const portalOk = portalResult.status === "fulfilled"
  const bmvOk = bmvResult.status === "fulfilled"

  if (!portalOk) {
    console.error(`[AutoTrigger] Portal check failed for ${leadId}:`, (portalResult as PromiseRejectedResult).reason)
  }
  if (!bmvOk) {
    console.error(`[AutoTrigger] BMV screening failed for ${leadId}:`, (bmvResult as PromiseRejectedResult).reason)
  }

  const finalStatus: ProcessingStatus =
    portalOk && bmvOk ? ProcessingStatus.COMPLETE : ProcessingStatus.FAILED

  await prisma.vendorLead.update({
    where: { id: leadId },
    data: {
      processingStatus: finalStatus,
      ...(portalOk ? { portalCheckedAt: new Date() } : {}),
      ...(bmvOk && lead.askingPrice != null ? { bmvValidatedAt: new Date() } : {}),
    },
  })

  console.log(`[AutoTrigger] Lead ${leadId} → ${finalStatus}`)
}
