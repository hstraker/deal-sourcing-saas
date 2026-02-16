import cron from "node-cron"
import { prisma } from "../db"
import { runScraperJob } from "./scraper-runner"
import { LOCATION_SLUGS, RIGHTMOVE_OUTCODES } from "./constants"
import type { ScraperCriteria, LocationCriteria } from "./types"

const LOG_PREFIX = "[Scheduler]"

let schedulerInitialized = false

/**
 * Start the scraper scheduler.
 * Runs at 6 AM and 6 PM daily.
 */
export function startScheduler() {
  if (schedulerInitialized) return
  schedulerInitialized = true

  console.log(`${LOG_PREFIX} Initializing scraper scheduler...`)

  // Run at 6:00 AM and 6:00 PM daily
  cron.schedule("0 6,18 * * *", async () => {
    console.log(`${LOG_PREFIX} Scheduled scraper run triggered at ${new Date().toISOString()}`)
    await runScheduledScrape()
  })

  console.log(`${LOG_PREFIX} Scheduler started - runs at 6:00 and 18:00 daily`)
}

async function runScheduledScrape() {
  try {
    // Load settings
    const settings = await prisma.scraperSettings.findFirst()
    if (!settings?.enabled) {
      console.log(`${LOG_PREFIX} Scraper disabled in settings, skipping`)
      return
    }

    // Determine which sources to run
    const sources: string[] = []
    if (settings.rightmoveEnabled) sources.push("RIGHTMOVE")
    if (settings.zooplaEnabled) sources.push("ZOOPLA")
    if (settings.onthemarketEnabled) sources.push("ONTHEMARKET")
    if ((settings as any).primelocationEnabled) sources.push("PRIMELOCATION")

    if (sources.length === 0) {
      console.log(`${LOG_PREFIX} No sources enabled, skipping`)
      return
    }

    // Use saved search criteria, or fall back to defaults
    let criteria: ScraperCriteria

    const savedCriteria = settings.searchCriteria as any
    if (savedCriteria?.locations?.length > 0) {
      criteria = {
        category: savedCriteria.category ?? "RESIDENTIAL",
        locations: savedCriteria.locations,
        ...(savedCriteria.minPrice && { minPrice: savedCriteria.minPrice }),
        ...(savedCriteria.maxPrice && { maxPrice: savedCriteria.maxPrice }),
        ...(savedCriteria.minBedrooms && { minBedrooms: savedCriteria.minBedrooms }),
        ...(savedCriteria.maxBedrooms && { maxBedrooms: savedCriteria.maxBedrooms }),
        ...(savedCriteria.propertyTypes?.length && { propertyTypes: savedCriteria.propertyTypes }),
        ...(savedCriteria.addedSince && { addedSince: savedCriteria.addedSince }),
        ...(savedCriteria.includeSSTC !== undefined && { includeSSTC: savedCriteria.includeSSTC }),
        ...(savedCriteria.maxPages && { maxPages: savedCriteria.maxPages }),
      }
      console.log(
        `${LOG_PREFIX} Using saved criteria: ${criteria.locations.map((l) => l.displayName).join(", ")}`
      )
    } else {
      // Fallback: default Birmingham criteria
      const defaultLocations: LocationCriteria[] = [
        {
          outcode: RIGHTMOVE_OUTCODES["Birmingham (B)"] || "2245",
          displayName: "Birmingham (B)",
          slug: LOCATION_SLUGS["Birmingham (B)"],
        },
      ]

      criteria = {
        category: "RESIDENTIAL",
        locations: defaultLocations,
        addedSince: "24hours",
      }
      console.log(`${LOG_PREFIX} No saved criteria, using default (Birmingham, last 24h)`)
    }

    // Run each source sequentially
    for (const source of sources) {
      console.log(`${LOG_PREFIX} Starting ${source} scrape...`)

      try {
        const job = await prisma.scraperJob.create({
          data: {
            source: source as any,
            category:
              criteria.category === "BOTH"
                ? null
                : (criteria.category as any),
            criteria: criteria as any,
            status: "QUEUED",
            propertiesFound: [],
          },
        })

        await runScraperJob(job.id, source, criteria)
        console.log(`${LOG_PREFIX} ${source} scrape completed`)
      } catch (error: any) {
        console.error(
          `${LOG_PREFIX} ${source} scrape failed:`,
          error.message
        )
      }
    }

    console.log(`${LOG_PREFIX} Scheduled scrape complete`)
  } catch (error: any) {
    console.error(`${LOG_PREFIX} Scheduled scrape error:`, error.message)
  }
}

export function stopScheduler() {
  schedulerInitialized = false
}
