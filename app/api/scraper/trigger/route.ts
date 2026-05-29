import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { z } from "zod"
import { runScraperJob } from "@/lib/scrapers/scraper-runner"

const triggerSchema = z.object({
  source: z.enum(["RIGHTMOVE", "ZOOPLA", "ONTHEMARKET", "PRIMELOCATION", "ALL"]),
  criteria: z.object({
    category: z.enum(["RESIDENTIAL", "COMMERCIAL", "BOTH"]),
    locations: z
      .array(
        z.object({
          outcode: z.string().min(1),
          displayName: z.string().min(1),
          slug: z.string().optional(),
        })
      )
      .min(1),
    minPrice: z.number().positive().optional(),
    maxPrice: z.number().positive().optional(),
    minBedrooms: z.number().int().min(0).optional(),
    maxBedrooms: z.number().int().min(0).optional(),
    propertyTypes: z.array(z.string()).optional(),
    maxDaysOnMarket: z.number().int().positive().optional(),
    includeSSTC: z.boolean().optional(),
    addedSince: z
      .enum(["24hours", "3days", "7days", "14days"])
      .optional(),
    maxPages: z.number().int().min(1).max(42).optional(),
  }),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    if (session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const validationResult = triggerSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validationResult.error.errors },
        { status: 400 }
      )
    }

    const data = validationResult.data

    // Determine which sources to run
    const sources: string[] =
      data.source === "ALL"
        ? ["RIGHTMOVE", "ZOOPLA", "ONTHEMARKET", "PRIMELOCATION"]
        : [data.source]

    // Auto-clean stale jobs: any job still QUEUED or RUNNING after 2 hours is stuck
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
    const staleCount = await prisma.scraperJob.updateMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        createdAt: { lt: twoHoursAgo },
      },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errors: [{ message: "Job timed out — auto-cancelled after 2 hours", timestamp: new Date().toISOString() }] as any,
      },
    })
    if (staleCount.count > 0) {
      console.log(`[Scraper Trigger] Auto-cancelled ${staleCount.count} stale job(s)`)
    }

    // Check for already running jobs for any of the requested sources
    const existingRunning = await prisma.scraperJob.findFirst({
      where: { source: { in: sources as any }, status: { in: ["RUNNING", "QUEUED"] } },
    })
    if (existingRunning) {
      return NextResponse.json(
        {
          error: "A scraper job is already running for this source",
          jobId: existingRunning.id,
        },
        { status: 409 }
      )
    }

    // Create a job per source and fire-and-forget each
    const jobIds: string[] = []
    for (const source of sources) {
      const job = await prisma.scraperJob.create({
        data: {
          source: source as any,
          category:
            data.criteria.category === "BOTH"
              ? null
              : (data.criteria.category as any),
          criteria: data.criteria as any,
          status: "QUEUED",
          propertiesFound: [],
        },
      })
      jobIds.push(job.id)

      // Fire-and-forget: start scraper in background
      runScraperJob(job.id, source, data.criteria).catch((err) => {
        console.error(
          `[Scraper API] Background job ${job.id} failed:`,
          err.message
        )
      })
    }

    return NextResponse.json(
      {
        success: true,
        jobIds,
        status: "QUEUED",
      },
      { status: 201 }
    )
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors },
        { status: 400 }
      )
    }
    console.error("[Scraper Trigger API] Error:", error)
    return NextResponse.json(
      { error: "Failed to trigger scraper" },
      { status: 500 }
    )
  }
}
