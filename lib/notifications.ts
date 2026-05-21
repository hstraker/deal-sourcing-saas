/**
 * lib/notifications.ts
 *
 * In-app notification generators. Each generator checks a data source,
 * creates Notification rows for the given user, and uses dedupeKey so
 * the same event is never surfaced twice.
 *
 * Called from POST /api/notifications/generate
 */

import { prisma } from "@/lib/db"

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationInput {
  userId:    string
  type:      string
  category:  string
  title:     string
  body:      string
  link?:     string
  meta?:     Record<string, unknown>
  dedupeKey?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function upsertNotification(input: NotificationInput): Promise<void> {
  const data = {
    userId:    input.userId,
    type:      input.type,
    category:  input.category,
    title:     input.title,
    body:      input.body,
    link:      input.link ?? null,
    meta:      (input.meta ?? {}) as any,
    dedupeKey: input.dedupeKey ?? null,
  }

  if (input.dedupeKey) {
    // Upsert — silently ignore if already present
    await prisma.notification.upsert({
      where: { userId_dedupeKey: { userId: input.userId, dedupeKey: input.dedupeKey } },
      create: data,
      update: {}, // Never overwrite; first write wins
    })
  } else {
    await prisma.notification.create({ data })
  }
}

function stageLabel(stage: string): string {
  const map: Record<string, string> = {
    NEW_LEAD:            "New Lead",
    AI_CONVERSATION:     "AI Chat",
    DEAL_VALIDATION:     "Validation",
    OFFER_MADE:          "Offer Made",
    OFFER_ACCEPTED:      "Accepted",
    OFFER_REJECTED:      "Rejected",
    VIDEO_SENT:          "Video Sent",
    RETRY_1:             "Retry 1",
    RETRY_2:             "Retry 2",
    RETRY_3:             "Retry 3",
    PAPERWORK_SENT:      "Paperwork",
    READY_FOR_INVESTORS: "Ready",
    DEAD_LEAD:           "Dead",
  }
  return map[stage] ?? stage
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * 1. Stuck leads — active leads with no activity for 7+ days.
 */
async function genStuckLeads(userId: string): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const terminalStages = ["DEAD_LEAD", "OFFER_REJECTED", "READY_FOR_INVESTORS", "OFFER_ACCEPTED"]

  const leads = await prisma.vendorLead.findMany({
    where: {
      pipelineStage: { notIn: terminalStages as any },
      updatedAt:     { lt: cutoff },
    },
    select: {
      id:              true,
      vendorName:      true,
      propertyAddress: true,
      pipelineStage:   true,
      updatedAt:       true,
    },
    take:    15,
    orderBy: { updatedAt: "asc" },
  })

  const tasks = leads.map((lead) => {
    const daysStale = Math.floor((Date.now() - lead.updatedAt.getTime()) / (24 * 60 * 60 * 1000))
    const weeksKey  = Math.floor(daysStale / 7)
    return upsertNotification({
      userId,
      type:     "stuck_lead",
      category: "lead",
      title:    `Lead stalled — ${lead.vendorName}`,
      body:     `${lead.propertyAddress ?? "Unknown address"} has had no activity for ${daysStale} days (stage: ${stageLabel(lead.pipelineStage)})`,
      link:     `/vendor-pipeline?lead=${lead.id}`,
      meta:     { leadId: lead.id, stage: lead.pipelineStage, daysStale },
      dedupeKey: `stuck_lead:${lead.id}:w${weeksKey}`,
    })
  })

  await Promise.allSettled(tasks)
}

/**
 * 2. Land Registry staleness — CCOD/OCOD last updated > 30 days ago.
 *    Admin and sourcer roles only.
 */
async function genLrStaleness(userId: string): Promise<void> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

  // One record per datasetType, most recent completed import
  const imports = await prisma.landRegistryImport.findMany({
    where:    { status: "COMPLETED" },
    orderBy:  { completedAt: "desc" },
    take:     10,
  })

  // De-duplicate: keep only the latest per datasetType
  const latestByType = new Map<string, (typeof imports)[0]>()
  for (const imp of imports) {
    if (!latestByType.has(imp.datasetType)) latestByType.set(imp.datasetType, imp)
  }

  const tasks: Promise<void>[] = []

  for (const imp of latestByType.values()) {
    if (!imp.completedAt || imp.completedAt >= thirtyDaysAgo) continue
    const days    = Math.floor((Date.now() - imp.completedAt.getTime()) / (24 * 60 * 60 * 1000))
    const weeksKey = Math.floor(days / 7)
    tasks.push(upsertNotification({
      userId,
      type:     "lr_stale",
      category: "data",
      title:    `${imp.datasetType} data is ${days} days old`,
      body:     `Land Registry ${imp.datasetType} ownership data was last refreshed ${days} days ago. Stale data may miss recent company purchases — consider importing the latest dataset.`,
      link:     "/admin/land-registry",
      meta:     { datasetType: imp.datasetType, lastUpdated: imp.completedAt.toISOString(), days },
      dedupeKey: `lr_stale:${imp.datasetType}:w${weeksKey}`,
    }))
  }

  await Promise.allSettled(tasks)
}

/**
 * 3. Land Registry import results — completed or failed in the last 24 h.
 */
async function genLrImportEvents(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const imports = await prisma.landRegistryImport.findMany({
    where: {
      status:    { in: ["COMPLETED", "FAILED"] },
      updatedAt: { gte: since },
    },
    orderBy: { updatedAt: "desc" },
    take:    5,
  })

  const tasks = imports.map((imp) => {
    if (imp.status === "COMPLETED") {
      return upsertNotification({
        userId,
        type:     "lr_import",
        category: "data",
        title:    `${imp.datasetType} import complete`,
        body:     `Successfully imported ${imp.recordsImported.toLocaleString()} ownership records.`,
        link:     "/admin/land-registry",
        meta:     { importId: imp.id, records: imp.recordsImported },
        dedupeKey: `lr_import_done:${imp.id}`,
      })
    } else {
      return upsertNotification({
        userId,
        type:     "lr_import",
        category: "data",
        title:    `${imp.datasetType} import failed`,
        body:     imp.errorMessage ?? "Import job failed — check the admin panel for details.",
        link:     "/admin/land-registry",
        meta:     { importId: imp.id },
        dedupeKey: `lr_import_failed:${imp.id}`,
      })
    }
  })

  await Promise.allSettled(tasks)
}

/**
 * 4. Sourcing alert matches — unnotified AlertMatch rows for this user.
 *    Marks notifiedInApp = true after creating notification.
 */
async function genAlertMatches(userId: string): Promise<void> {
  const alerts = await prisma.sourcingAlert.findMany({
    where:  { userId, isActive: true },
    select: { id: true, name: true, address: true },
  })
  if (alerts.length === 0) return

  const matches = await prisma.alertMatch.findMany({
    where: {
      alertId:       { in: alerts.map((a) => a.id) },
      notifiedInApp: false,
    },
    include: {
      alert:           { select: { name: true, address: true } },
      propertyListing: { select: { address: true, price: true, bedrooms: true } },
    },
    orderBy: { matchedAt: "desc" },
    take:    20,
  })

  const tasks = matches.map(async (match) => {
    const listing  = match.propertyListing
    const addrJson = listing.address as any
    const addrStr  =
      typeof addrJson === "string"
        ? addrJson
        : addrJson?.displayAddress ?? addrJson?.fullAddress ?? "Unknown address"
    const priceStr = listing.price
      ? `£${Number(listing.price).toLocaleString()}`
      : ""
    const bedStr   = listing.bedrooms ? `, ${listing.bedrooms} bed` : ""
    const suffix   = [priceStr, bedStr.trim()].filter(Boolean).join("")

    await upsertNotification({
      userId,
      type:     "alert_match",
      category: "ai",
      title:    `Alert match — ${match.alert.name ?? match.alert.address}`,
      body:     `${addrStr}${suffix ? ` · ${suffix}` : ""}`,
      link:     `/scraper?highlight=${match.scrapedPropertyId}`,
      meta:     { matchId: match.id, alertId: match.alertId, propertyId: match.scrapedPropertyId },
      dedupeKey: `alert_match:${match.id}`,
    })

    await prisma.alertMatch.update({
      where: { id: match.id },
      data:  { notifiedInApp: true },
    })
  })

  await Promise.allSettled(tasks)
}

/**
 * 5. Inbound vendor SMS replies in the last 24 h.
 *    Surfaces unanswered replies so sourcers don't miss them.
 */
async function genVendorReplies(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const messages = await prisma.sMSMessage.findMany({
    where: {
      direction: "inbound",
      createdAt: { gte: since },
    },
    include: {
      vendorLead: { select: { id: true, vendorName: true } },
    },
    orderBy: { createdAt: "desc" },
    take:    20,
  })

  const tasks = messages.map((msg) =>
    upsertNotification({
      userId,
      type:     "vendor_reply",
      category: "lead",
      title:    `Reply from ${msg.vendorLead.vendorName}`,
      body:     msg.messageBody.length > 140
        ? msg.messageBody.slice(0, 137) + "…"
        : msg.messageBody,
      link:     `/vendor-pipeline?lead=${msg.vendorLeadId}`,
      meta:     { smsId: msg.id, leadId: msg.vendorLeadId },
      dedupeKey: `vendor_reply:${msg.id}`,
    })
  )

  await Promise.allSettled(tasks)
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateNotificationsForUser(
  userId:   string,
  userRole: string
): Promise<void> {
  const isPrivileged = userRole === "admin" || userRole === "sourcer"

  const jobs: Promise<void>[] = [
    genStuckLeads(userId),
    genAlertMatches(userId),
    genVendorReplies(userId),
  ]

  if (isPrivileged) {
    jobs.push(genLrStaleness(userId), genLrImportEvents(userId))
  }

  // Run all generators in parallel; individual failures don't block others
  const results = await Promise.allSettled(jobs)
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      console.error(`[notifications] generator[${i}] failed:`, r.reason)
    }
  })
}
