/**
 * GET/PUT /api/scraper/settings/commercial
 *
 * Manages the ScraperSettings row dedicated to commercial scanning.
 * Identified by searchCriteria.category === "COMMERCIAL".
 * On first GET the row is created automatically with commercial defaults.
 */

import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"

const searchCriteriaSchema = z.object({
  category: z.literal("COMMERCIAL"),
  locations: z.array(z.object({
    outcode: z.string().min(1),
    displayName: z.string().min(1),
    slug: z.string().optional(),
  })).optional(),
  minPrice: z.number().positive().optional().nullable(),
  maxPrice: z.number().positive().optional().nullable(),
  propertyTypes: z.array(z.string()).optional().nullable(),
  addedSince: z.enum(["24hours", "3days", "7days", "14days"]).optional().nullable(),
  includeSSTC: z.boolean().optional(),
  maxPages: z.number().int().min(1).max(42).optional().nullable(),
})

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
  searchCriteria: searchCriteriaSchema.optional(),
})

// Find the commercial-specific settings row
async function findOrCreateCommercialSettings() {
  const existing = await prisma.scraperSettings.findFirst({
    where: {
      searchCriteria: {
        path: ["category"],
        equals: "COMMERCIAL",
      },
    },
  })
  if (existing) return existing

  // Create a fresh commercial row
  return prisma.scraperSettings.create({
    data: {
      enabled: false,
      scheduleType: "TWICE_DAILY",
      rightmoveEnabled: true,
      zooplaEnabled: true,
      onthemarketEnabled: true,
      searchCriteria: {
        category: "COMMERCIAL",
        locations: [],
        minPrice: null,
        maxPrice: null,
        propertyTypes: null,
        addedSince: "24hours",
        includeSSTC: false,
        maxPages: 5,
      },
    } as any,
  })
}

function formatSettings(s: any) {
  return {
    id: s.id,
    enabled: s.enabled,
    scheduleType: s.scheduleType,
    rightmoveEnabled: s.rightmoveEnabled,
    zooplaEnabled: s.zooplaEnabled,
    onthemarketEnabled: s.onthemarketEnabled,
    primelocationEnabled: s.primelocationEnabled ?? true,
    autoAnalysisEnabled: s.autoAnalysisEnabled,
    autoAnalysisThreshold: s.autoAnalysisThreshold ? Number(s.autoAnalysisThreshold) : null,
    requireManualReview: s.requireManualReview,
    requestDelay: s.requestDelay,
    maxConcurrent: s.maxConcurrent,
    useProxy: s.useProxy,
    proxyUrl: s.proxyUrl,
    searchCriteria: s.searchCriteria ?? null,
    updatedAt: s.updatedAt.toISOString(),
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const settings = await findOrCreateCommercialSettings()
    return NextResponse.json({ success: true, settings: formatSettings(settings) })
  } catch (error) {
    console.error("[Commercial Settings API] GET error:", error)
    return NextResponse.json({ error: "Failed to fetch commercial settings" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    if (session.user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const body = await request.json()
    const parsed = settingsUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.errors }, { status: 400 })
    }

    const data = parsed.data
    const existing = await findOrCreateCommercialSettings()

    // Always enforce category = COMMERCIAL; strip bedroom fields (not applicable to commercial)
    const criteriaToSave = data.searchCriteria
      ? {
          ...data.searchCriteria,
          category: "COMMERCIAL",
          minBedrooms: undefined,
          maxBedrooms: undefined,
        }
      : undefined

    const updated = await prisma.scraperSettings.update({
      where: { id: existing.id },
      data: {
        ...(data.enabled !== undefined && { enabled: data.enabled }),
        ...(data.scheduleType !== undefined && { scheduleType: data.scheduleType }),
        ...(data.rightmoveEnabled !== undefined && { rightmoveEnabled: data.rightmoveEnabled }),
        ...(data.zooplaEnabled !== undefined && { zooplaEnabled: data.zooplaEnabled }),
        ...(data.onthemarketEnabled !== undefined && { onthemarketEnabled: data.onthemarketEnabled }),
        ...(data.primelocationEnabled !== undefined && { primelocationEnabled: data.primelocationEnabled }),
        ...(data.autoAnalysisEnabled !== undefined && { autoAnalysisEnabled: data.autoAnalysisEnabled }),
        ...(data.autoAnalysisThreshold !== undefined && { autoAnalysisThreshold: data.autoAnalysisThreshold }),
        ...(data.requireManualReview !== undefined && { requireManualReview: data.requireManualReview }),
        ...(data.requestDelay !== undefined && { requestDelay: data.requestDelay }),
        ...(data.maxConcurrent !== undefined && { maxConcurrent: data.maxConcurrent }),
        ...(data.useProxy !== undefined && { useProxy: data.useProxy }),
        ...(data.proxyUrl !== undefined && { proxyUrl: data.proxyUrl }),
        ...(criteriaToSave !== undefined && { searchCriteria: criteriaToSave }),
      },
    })

    return NextResponse.json({ success: true, settings: formatSettings(updated) })
  } catch (error) {
    console.error("[Commercial Settings API] PUT error:", error)
    return NextResponse.json({ error: "Failed to update commercial settings" }, { status: 500 })
  }
}
