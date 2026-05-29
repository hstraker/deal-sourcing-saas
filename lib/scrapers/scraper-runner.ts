import { prisma } from "../db"
import { BaseScraper } from "./base-scraper"
import { RightmoveScraper } from "./rightmove-scraper"
import { ZooplaScraper } from "./zoopla-scraper"
import { OnTheMarketScraper } from "./onthemarket-scraper"
import { PrimeLocationScraper } from "./primelocation-scraper"
import { batchEnrichNewListings } from "./batch-enricher"
import type {
  ScraperCriteria,
  ScraperProgress,
  ScraperSettingsData,
} from "./types"

const LOG_PREFIX = "[Scraper]"

/**
 * Run a scraping job end-to-end.
 * Called by both the API route (fire-and-forget) and the CLI script.
 */
export async function runScraperJob(
  jobId: string,
  source: string,
  criteria: ScraperCriteria
): Promise<ScraperProgress> {
  console.log(
    `${LOG_PREFIX} Starting job ${jobId} for source ${source}`
  )

  // Load settings for the matching category, falling back to the first row
  const isCommercialJob = criteria.category === "COMMERCIAL"
  let settings = isCommercialJob
    ? await prisma.scraperSettings.findFirst({
        where: { searchCriteria: { path: ["category"], equals: "COMMERCIAL" } },
      })
    : await prisma.scraperSettings.findFirst({
        where: { NOT: { searchCriteria: { path: ["category"], equals: "COMMERCIAL" } } },
      })
  if (!settings) {
    settings = await prisma.scraperSettings.findFirst()
  }
  if (!settings) {
    settings = await prisma.scraperSettings.create({
      data: { enabled: true },
    })
    console.log(`${LOG_PREFIX} Created default scraper settings`)
  }

  const settingsData: ScraperSettingsData = {
    enabled: settings.enabled,
    scheduleType: settings.scheduleType,
    rightmoveEnabled: settings.rightmoveEnabled,
    zooplaEnabled: settings.zooplaEnabled,
    onthemarketEnabled: settings.onthemarketEnabled,
    primelocationEnabled: (settings as any).primelocationEnabled ?? true,
    autoAnalysisEnabled: settings.autoAnalysisEnabled,
    autoAnalysisThreshold: settings.autoAnalysisThreshold
      ? Number(settings.autoAnalysisThreshold)
      : undefined,
    requireManualReview: settings.requireManualReview,
    requestDelay: settings.requestDelay,
    maxConcurrent: settings.maxConcurrent,
    useProxy: settings.useProxy,
    proxyUrl: settings.proxyUrl || undefined,
    headful: process.env.SCRAPER_HEADFUL === "1",
  }

  // Validate scraper is enabled
  if (!settingsData.enabled) {
    await prisma.scraperJob.update({
      where: { id: jobId },
      data: {
        status: "CANCELLED",
        completedAt: new Date(),
        errors: [
          {
            message: "Scraper is disabled in settings",
            timestamp: new Date().toISOString(),
          },
        ] as any,
      },
    })
    throw new Error("Scraper is disabled in settings")
  }

  // Instantiate the appropriate scraper
  let scraper: BaseScraper
  switch (source) {
    case "RIGHTMOVE":
      if (!settingsData.rightmoveEnabled) {
        await markJobCancelled(jobId, "Rightmove scraper is disabled")
        throw new Error("Rightmove scraper is disabled")
      }
      scraper = new RightmoveScraper(settingsData, jobId)
      break
    case "ZOOPLA":
      if (!settingsData.zooplaEnabled) {
        await markJobCancelled(jobId, "Zoopla scraper is disabled")
        throw new Error("Zoopla scraper is disabled")
      }
      scraper = new ZooplaScraper(settingsData, jobId)
      break
    case "ONTHEMARKET":
      if (!settingsData.onthemarketEnabled) {
        await markJobCancelled(jobId, "OnTheMarket scraper is disabled")
        throw new Error("OnTheMarket scraper is disabled")
      }
      scraper = new OnTheMarketScraper(settingsData, jobId)
      break
    case "PRIMELOCATION":
      if (!settingsData.primelocationEnabled) {
        await markJobCancelled(jobId, "PrimeLocation scraper is disabled")
        throw new Error("PrimeLocation scraper is disabled")
      }
      scraper = new PrimeLocationScraper(settingsData, jobId)
      break
    default:
      await markJobCancelled(jobId, `Unknown source: ${source}`)
      throw new Error(`Unknown source: ${source}`)
  }

  // Run the scraper
  try {
    const progress = await scraper.run(criteria)
    console.log(
      `${LOG_PREFIX} Job ${jobId} completed: ${progress.successful} properties saved`
    )

    // Fire-and-forget: enrich new listings with PropertyData (EPC, sold comparables, BMV%)
    if (progress.propertiesFound.length > 0) {
      batchEnrichNewListings(progress.propertiesFound).catch((err) =>
        console.warn(`${LOG_PREFIX} PropertyData enrichment error: ${err.message}`)
      )
    }

    // Fire-and-forget: run alert matching engine after each scrape
    if (progress.successful > 0 && process.env.INTERNAL_API_SECRET) {
      const appUrl = process.env.APP_URL || "http://localhost:3000"
      fetch(`${appUrl}/api/sourcing-alerts/match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-internal-secret": process.env.INTERNAL_API_SECRET,
        },
        body: JSON.stringify({ since: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() }),
      })
        .then((r) => r.json())
        .then((data) => console.log(`${LOG_PREFIX} Alert matching: ${data.matched} matched, ${data.notified} notified`))
        .catch((err) => console.warn(`${LOG_PREFIX} Alert matching failed:`, err.message))
    }

    return progress
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Job ${jobId} failed:`, error.message)

    // Update job to FAILED if it is still QUEUED or RUNNING (e.g. browser launch failed before RUNNING was set)
    try {
      const job = await prisma.scraperJob.findUnique({
        where: { id: jobId },
        select: { status: true },
      })
      if (job && (job.status === "QUEUED" || job.status === "RUNNING")) {
        await prisma.scraperJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errors: [
              {
                message: error.message,
                timestamp: new Date().toISOString(),
              },
            ] as any,
          },
        })
      }
    } catch {
      // Best-effort error update
    }

    throw error
  }
}

async function markJobCancelled(jobId: string, reason: string): Promise<void> {
  await prisma.scraperJob.update({
    where: { id: jobId },
    data: {
      status: "CANCELLED",
      completedAt: new Date(),
      errors: [
        { message: reason, timestamp: new Date().toISOString() },
      ] as any,
    },
  })
}
