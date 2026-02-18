import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"
import { ScraperOverview } from "@/components/scraper/scraper-overview"
import { toPropertyListingForClient } from "@/types/property-listing"

export const dynamic = "force-dynamic"

/**
 * Compute the next scheduled run time based on schedule type.
 */
function computeNextRun(scheduleType: string, enabled: boolean): string | null {
  if (!enabled || scheduleType !== "TWICE_DAILY") return null

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

export default async function ScraperDashboardPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <div>Unauthorized</div>
  }

  const [
    totalListings,
    bySource,
    byReviewStatus,
    pendingReview,
    ambiguousCount,
    recentJobs,
    scraperSettings,
    lastCompletedJob,
    reviewListings,
    withPropertyData,
  ] = await Promise.all([
    prisma.propertyListing.count(),
    prisma.propertyListing.groupBy({
      by: ["source"],
      _count: true,
    }),
    prisma.propertyListing.groupBy({
      by: ["reviewStatus"],
      _count: true,
    }),
    prisma.propertyListing.count({
      where: { reviewStatus: "PENDING" },
    }),
    prisma.propertyListing.count({
      where: {
        isAmbiguous: true,
        reviewStatus: { in: ["PENDING", "AUTO_APPROVED"] },
      },
    }),
    prisma.scraperJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.scraperSettings.findFirst(),
    prisma.scraperJob.findFirst({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      select: { completedAt: true },
    }),
    // Fetch review queue listings
    prisma.propertyListing.findMany({
      where: {
        OR: [
          { reviewStatus: "PENDING" },
          { reviewStatus: "AUTO_APPROVED", isAmbiguous: true },
        ],
      },
      orderBy: { scrapedAt: "desc" },
    }),
    // Count properties with PropertyData analysis
    prisma.propertyListing.count({
      where: { NOT: { propertyDataAnalysis: { equals: Prisma.DbNull } } },
    }),
  ])

  // Count postcode quality from review listings (cheap — already fetched)
  // For full dataset we use a lightweight raw query
  const postcodeStats = await prisma.$queryRaw<
    Array<{ has_full: bigint; has_outcode: bigint; has_none: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE address->>'postcode' ~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s[0-9][A-Z]{2}$') AS has_full,
      COUNT(*) FILTER (WHERE address->>'postcode' ~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?$'
                         AND address->>'postcode' !~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s[0-9][A-Z]{2}$') AS has_outcode,
      COUNT(*) FILTER (WHERE address->>'postcode' IS NULL OR address->>'postcode' = '') AS has_none
    FROM "property_listings"
  `

  const stats = {
    totalListings,
    bySource: bySource.map((s) => ({ source: s.source, count: s._count })),
    byReviewStatus: byReviewStatus.map((s) => ({
      status: s.reviewStatus,
      count: s._count,
    })),
    pendingReview,
    ambiguousCount,
  }

  const jobsForClient = recentJobs.map((j) => ({
    ...j,
    startedAt: j.startedAt?.toISOString() || null,
    completedAt: j.completedAt?.toISOString() || null,
    createdAt: j.createdAt.toISOString(),
  }))

  const settingsForClient = scraperSettings
    ? {
        enabled: scraperSettings.enabled,
        scheduleType: scraperSettings.scheduleType,
        rightmoveEnabled: scraperSettings.rightmoveEnabled,
        zooplaEnabled: scraperSettings.zooplaEnabled,
        onthemarketEnabled: scraperSettings.onthemarketEnabled,
        primelocationEnabled: (scraperSettings as any).primelocationEnabled ?? true,
        searchCriteria: scraperSettings.searchCriteria as any,
      }
    : null

  const schedule = {
    lastRun: lastCompletedJob?.completedAt?.toISOString() ?? null,
    nextRun: scraperSettings
      ? computeNextRun(scraperSettings.scheduleType, scraperSettings.enabled)
      : null,
  }

  const reviewListingsForClient = reviewListings.map(toPropertyListingForClient)

  const enrichmentStats = {
    fullPostcode: Number(postcodeStats[0]?.has_full ?? 0),
    outcodeOnly: Number(postcodeStats[0]?.has_outcode ?? 0),
    noPostcode: Number(postcodeStats[0]?.has_none ?? 0),
    withPropertyData,
  }

  return (
    <div>
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Property Scraper</h1>
          <p className="text-muted-foreground">
            Scrape, review, and approve properties
          </p>
        </div>
        <Link href="/dashboard/settings/scraper">
          <Button variant="outline" className="flex-shrink-0">
            <Settings className="mr-2 h-4 w-4" />
            Scraper Settings
          </Button>
        </Link>
      </div>

      <ScraperOverview
        stats={stats}
        recentJobs={jobsForClient as any}
        settings={settingsForClient}
        schedule={schedule}
        reviewListings={reviewListingsForClient as any}
        enrichmentStats={enrichmentStats}
      />
    </div>
  )
}
