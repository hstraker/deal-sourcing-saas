import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const searchCriteriaSchema = z.object({
  category: z.enum(["RESIDENTIAL", "COMMERCIAL", "BOTH"]).optional(),
  locations: z.array(z.object({
    outcode: z.string().min(1),
    displayName: z.string().min(1),
    slug: z.string().optional(),
  })).optional(),
  minPrice: z.number().positive().optional().nullable(),
  maxPrice: z.number().positive().optional().nullable(),
  minBedrooms: z.number().int().min(0).optional().nullable(),
  maxBedrooms: z.number().int().min(0).optional().nullable(),
  propertyTypes: z.array(z.string()).optional().nullable(),
  addedSince: z.enum(["24hours", "3days", "7days", "14days"]).optional().nullable(),
  includeSSTC: z.boolean().optional(),
  maxPages: z.number().int().min(1).max(42).optional().nullable(),
}).optional().nullable()

const settingsUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  scheduleType: z.string().optional(),
  rightmoveEnabled: z.boolean().optional(),
  zooplaEnabled: z.boolean().optional(),
  onthemarketEnabled: z.boolean().optional(),
  primelocationEnabled: z.boolean().optional(),
  autoAnalysisEnabled: z.boolean().optional(),
  autoAnalysisThreshold: z.number().min(0).max(100).optional().nullable(),
  requireManualReview: z.boolean().optional(),
  requestDelay: z.number().int().min(1000).max(30000).optional(),
  maxConcurrent: z.number().int().min(1).max(10).optional(),
  useProxy: z.boolean().optional(),
  proxyUrl: z.string().url().optional().nullable(),
  searchCriteria: searchCriteriaSchema,
})

/**
 * Compute the next scheduled run time based on schedule type.
 * For TWICE_DAILY: next occurrence of 6:00 or 18:00.
 */
function computeNextRun(scheduleType: string): string | null {
  if (scheduleType !== "TWICE_DAILY") return null

  const now = new Date()
  const today6am = new Date(now)
  today6am.setHours(6, 0, 0, 0)
  const today6pm = new Date(now)
  today6pm.setHours(18, 0, 0, 0)
  const tomorrow6am = new Date(now)
  tomorrow6am.setDate(tomorrow6am.getDate() + 1)
  tomorrow6am.setHours(6, 0, 0, 0)

  if (now < today6am) return today6am.toISOString()
  if (now < today6pm) return today6pm.toISOString()
  return tomorrow6am.toISOString()
}

/**
 * Find the residential settings row: the row whose searchCriteria.category is NOT "COMMERCIAL".
 * Creates one with category "RESIDENTIAL" if none exists.
 */
async function findOrCreateResidentialSettings() {
  const all = await prisma.scraperSettings.findMany()
  // Prefer a row explicitly marked RESIDENTIAL; fall back to any non-COMMERCIAL row
  const found = all.find(s => (s.searchCriteria as any)?.category === "RESIDENTIAL")
    ?? all.find(s => (s.searchCriteria as any)?.category !== "COMMERCIAL")
    ?? null
  if (found) return found
  // No residential row — create one
  return prisma.scraperSettings.create({
    data: { enabled: true, searchCriteria: { category: "RESIDENTIAL" } as any },
  })
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const settings = await findOrCreateResidentialSettings()

    // Get last completed job
    const lastJob = await prisma.scraperJob.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    })

    return NextResponse.json({
      success: true,
      settings: {
        id: settings.id,
        enabled: settings.enabled,
        scheduleType: settings.scheduleType,
        rightmoveEnabled: settings.rightmoveEnabled,
        zooplaEnabled: settings.zooplaEnabled,
        onthemarketEnabled: settings.onthemarketEnabled,
        primelocationEnabled: (settings as any).primelocationEnabled ?? true,
        autoAnalysisEnabled: settings.autoAnalysisEnabled,
        autoAnalysisThreshold: settings.autoAnalysisThreshold
          ? Number(settings.autoAnalysisThreshold)
          : null,
        requireManualReview: settings.requireManualReview,
        requestDelay: settings.requestDelay,
        maxConcurrent: settings.maxConcurrent,
        useProxy: settings.useProxy,
        proxyUrl: settings.proxyUrl,
        searchCriteria: settings.searchCriteria ?? null,
        updatedAt: settings.updatedAt.toISOString(),
      },
      schedule: {
        lastRun: lastJob?.completedAt?.toISOString() ?? null,
        nextRun: settings.enabled ? computeNextRun(settings.scheduleType) : null,
      },
    })
  } catch (error) {
    console.error("[Scraper Settings API] Error fetching settings:", error)
    return NextResponse.json(
      { error: "Failed to fetch scraper settings" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = settingsUpdateSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    const settings = await findOrCreateResidentialSettings()

    // Update settings
    const updated = await prisma.scraperSettings.update({
      where: { id: settings.id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.scheduleType !== undefined && {
          scheduleType: data.scheduleType,
        }),
        ...(data.rightmoveEnabled !== undefined && {
          rightmoveEnabled: data.rightmoveEnabled,
        }),
        ...(data.zooplaEnabled !== undefined && {
          zooplaEnabled: data.zooplaEnabled,
        }),
        ...(data.onthemarketEnabled !== undefined && {
          onthemarketEnabled: data.onthemarketEnabled,
        }),
        ...(data.primelocationEnabled !== undefined && {
          primelocationEnabled: data.primelocationEnabled,
        }),
        ...(data.autoAnalysisEnabled !== undefined && {
          autoAnalysisEnabled: data.autoAnalysisEnabled,
        }),
        ...(data.autoAnalysisThreshold !== undefined && {
          autoAnalysisThreshold: data.autoAnalysisThreshold,
        }),
        ...(data.requireManualReview !== undefined && {
          requireManualReview: data.requireManualReview,
        }),
        ...(data.requestDelay !== undefined && {
          requestDelay: data.requestDelay,
        }),
        ...(data.maxConcurrent !== undefined && {
          maxConcurrent: data.maxConcurrent,
        }),
        ...(data.useProxy !== undefined && { useProxy: data.useProxy }),
        ...(data.proxyUrl !== undefined && { proxyUrl: data.proxyUrl }),
        ...(data.searchCriteria !== undefined && {
          searchCriteria: data.searchCriteria ?? undefined,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      settings: {
        id: updated.id,
        enabled: updated.enabled,
        scheduleType: updated.scheduleType,
        rightmoveEnabled: updated.rightmoveEnabled,
        zooplaEnabled: updated.zooplaEnabled,
        onthemarketEnabled: updated.onthemarketEnabled,
        primelocationEnabled: (updated as any).primelocationEnabled ?? true,
        autoAnalysisEnabled: updated.autoAnalysisEnabled,
        autoAnalysisThreshold: updated.autoAnalysisThreshold
          ? Number(updated.autoAnalysisThreshold)
          : null,
        requireManualReview: updated.requireManualReview,
        requestDelay: updated.requestDelay,
        maxConcurrent: updated.maxConcurrent,
        useProxy: updated.useProxy,
        proxyUrl: updated.proxyUrl,
        searchCriteria: updated.searchCriteria ?? null,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error("[Scraper Settings API] Error updating settings:", error)
    return NextResponse.json(
      { error: "Failed to update scraper settings" },
      { status: 500 }
    )
  }
}
