/**
 * Auto-trigger service for newly created vendor leads.
 *
 * Runs fire-and-forget after lead creation:
 *   1. Normalise address → extract/persist postcode if missing
 *      (sets propertyPostcodeFixed = true when postcode was corrected)
 *   2. Run portal check + BMV screening in parallel
 *   3. Update processingStatus + timestamps
 */

import { prisma } from "@/lib/db"
import { ProcessingStatus } from "@prisma/client"
import { normaliseAddress } from "@/lib/vendor-checks/address-normaliser"
import { runVendorCheck } from "@/lib/vendor-checks/vendor-check-orchestrator"
import { runBmvScreening } from "@/lib/engine/bmv/bmvCalculator"
import { sendSourcerValidationPassedEmail } from "@/lib/email"

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
    console.error(`[AutoTriggers] Lead not found: ${leadId}`)
    return
  }

  try {
    // ── 2. Normalise address / extract postcode ────────────────────────────
    if (!lead.propertyPostcode && lead.propertyAddress) {
      const normalised = normaliseAddress(lead.propertyAddress)
      if (normalised.postcode) {
        await prisma.vendorLead.update({
          where: { id: leadId },
          data: {
            postcodeOriginal: lead.propertyAddress,
            propertyPostcode: normalised.postcode,
            propertyPostcodeFixed: true,           // flag that it was auto-corrected
            propertyPostcodeSource: "address_normaliser",
          },
        })
        console.log(`[AutoTriggers] Extracted postcode ${normalised.postcode} for lead ${leadId}`)
      }
    }

    // ── 3. Mark as RUNNING ─────────────────────────────────────────────────
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { processingStatus: ProcessingStatus.RUNNING },
    })

    // ── 4. Run portal check + BMV screening in parallel ───────────────────
    const portalCheckPromise = runVendorCheck(leadId, "auto")

    const bmvPromise: Promise<void> = (async () => {
      if (!lead.askingPrice) return
      const price = Number(lead.askingPrice)
      runBmvScreening({
        askingPrice: price,
        marketValue: price, // best-effort; no independent valuation at this stage
        monthlyRent: 0,
        refurbCost: 0,
      })
    })()

    const [portalResult, bmvResult] = await Promise.allSettled([
      portalCheckPromise,
      bmvPromise,
    ])

    // ── 5. Resolve final status + write timestamps ─────────────────────────
    const portalOk = portalResult.status === "fulfilled"
    const bmvOk = bmvResult.status === "fulfilled"

    if (!portalOk) {
      console.error(
        `[AutoTriggers] Portal check failed for ${leadId}:`,
        (portalResult as PromiseRejectedResult).reason
      )
    }
    if (!bmvOk) {
      console.error(
        `[AutoTriggers] BMV screening failed for ${leadId}:`,
        (bmvResult as PromiseRejectedResult).reason
      )
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

    console.log(`[AutoTriggers] Lead ${leadId} → ${finalStatus}`)

    // ── 6. Notify sourcers if validation passed ────────────────────────────
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

          console.log(
            `[AutoTriggers] Validation-passed emails sent for lead ${leadId} to ${sourcers.length} user(s)`
          )
        }
      } catch (notifyErr: any) {
        // Don't let notification failure propagate — auto-trigger already succeeded
        console.error(
          `[AutoTriggers] Failed to send validation-passed notifications for ${leadId}:`,
          notifyErr?.message
        )
      }
    }
  } catch (err: any) {
    console.error(`[AutoTriggers] Unhandled error for lead ${leadId}:`, err?.message)
    await prisma.vendorLead.update({
      where: { id: leadId },
      data: { processingStatus: ProcessingStatus.FAILED },
    }).catch(() => {/* ignore secondary failure */})
    throw err
  }
}
