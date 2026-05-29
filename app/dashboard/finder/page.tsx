import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Prisma } from "@prisma/client"
import Link from "next/link"
import { Settings } from "lucide-react"
import { UnifiedFinder } from "@/components/scraper/unified-finder"
import { PageHeader } from "@/components/ui/page-header"
import { toPropertyListingForClient } from "@/types/property-listing"

export const dynamic = "force-dynamic"

function computeNextRun(scheduleType: string, enabled: boolean): string | null {
  if (!enabled || scheduleType !== "TWICE_DAILY") return null
  const now = new Date()
  const today6am = new Date(now); today6am.setHours(6, 0, 0, 0)
  const today6pm = new Date(now); today6pm.setHours(18, 0, 0, 0)
  const tomorrow6am = new Date(now)
  tomorrow6am.setDate(tomorrow6am.getDate() + 1)
  tomorrow6am.setHours(6, 0, 0, 0)
  if (now < today6am) return today6am.toISOString()
  if (now < today6pm) return today6pm.toISOString()
  return tomorrow6am.toISOString()
}

export default async function PropertyFinderPage() {
  const session = await getServerSession(authOptions)
  if (!session) return <div>Unauthorized</div>

  const [
    allCount,
    resiCount,
    commCount,
    pendingAll,
    pendingResi,
    pendingComm,
    approvedAll,
    approvedResi,
    approvedComm,
    ambiguousAll,
    ambiguousResi,
    ambiguousComm,
    allScraperSettings,   // all rows — split in JS (JSONB NOT filter unreliable for missing keys)
    recentJobs,
    lastCompleted,
    reviewListings,
    withPropertyData,
  ] = await Promise.all([
    prisma.propertyListing.count(),
    prisma.propertyListing.count({ where: { category: "RESIDENTIAL" } }),
    prisma.propertyListing.count({ where: { category: "COMMERCIAL" } }),
    prisma.propertyListing.count({ where: { reviewStatus: "PENDING" } }),
    prisma.propertyListing.count({ where: { category: "RESIDENTIAL", reviewStatus: "PENDING" } }),
    prisma.propertyListing.count({ where: { category: "COMMERCIAL",  reviewStatus: "PENDING" } }),
    prisma.propertyListing.count({ where: { reviewStatus: "APPROVED" } }),
    prisma.propertyListing.count({ where: { category: "RESIDENTIAL", reviewStatus: "APPROVED" } }),
    prisma.propertyListing.count({ where: { category: "COMMERCIAL",  reviewStatus: "APPROVED" } }),
    prisma.propertyListing.count({ where: { isAmbiguous: true, reviewStatus: { in: ["PENDING", "AUTO_APPROVED"] } } }),
    prisma.propertyListing.count({ where: { category: "RESIDENTIAL", isAmbiguous: true, reviewStatus: { in: ["PENDING", "AUTO_APPROVED"] } } }),
    prisma.propertyListing.count({ where: { category: "COMMERCIAL",  isAmbiguous: true, reviewStatus: { in: ["PENDING", "AUTO_APPROVED"] } } }),
    // Load all settings rows and split in JS — JSONB NOT filter is unreliable when category key is absent
    prisma.scraperSettings.findMany(),
    prisma.scraperJob.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.scraperJob.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" }, select: { completedAt: true } }),
    prisma.propertyListing.findMany({
      where: { OR: [{ reviewStatus: "PENDING" }, { reviewStatus: "AUTO_APPROVED", isAmbiguous: true }] },
      orderBy: { scrapedAt: "desc" },
      take: 500,
    }),
    prisma.propertyListing.count({ where: { NOT: { propertyDataAnalysis: { equals: Prisma.DbNull } } } }),
  ])

  // Reliably separate residential vs commercial rows using JS comparison
  const resiSettings       = allScraperSettings.find(s => (s.searchCriteria as any)?.category !== "COMMERCIAL") ?? null
  const commercialSettings = allScraperSettings.find(s => (s.searchCriteria as any)?.category === "COMMERCIAL") ?? null

  const postcodeStats = await prisma.$queryRaw<Array<{ has_full: bigint; has_outcode: bigint; has_none: bigint }>>`
    SELECT
      COUNT(*) FILTER (WHERE address->>'postcode' ~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s[0-9][A-Z]{2}$') AS has_full,
      COUNT(*) FILTER (WHERE address->>'postcode' ~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?$'
                         AND address->>'postcode' !~ '^[A-Z]{1,2}[0-9]{1,2}[A-Z]?\\s[0-9][A-Z]{2}$') AS has_outcode,
      COUNT(*) FILTER (WHERE address->>'postcode' IS NULL OR address->>'postcode' = '') AS has_none
    FROM "property_listings"
  `

  const fmt = (s: any) => s ? {
    enabled:              s.enabled,
    scheduleType:         s.scheduleType,
    rightmoveEnabled:     s.rightmoveEnabled,
    zooplaEnabled:        s.zooplaEnabled,
    onthemarketEnabled:   s.onthemarketEnabled,
    primelocationEnabled: (s as any).primelocationEnabled ?? true,
    searchCriteria:       s.searchCriteria as any,
  } : null

  return (
    <div className="space-y-5">
      {/* Page header with settings icon top-right (same visual row as notification bell) */}
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Property Finder"
          subtitle="Scan Rightmove, Zoopla, OnTheMarket and PrimeLocation for residential & commercial properties"
        />
        <Link
          href="/dashboard/settings/finder"
          title="Finder Settings"
          className="mt-1 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 hover:border-gray-300 transition-all flex-shrink-0 shadow-sm"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </Link>
      </div>
      <UnifiedFinder
        resiSettings={fmt(resiSettings)}
        commercialSettings={fmt(commercialSettings)}
        allStats={{ totalListings: allCount, pendingReview: pendingAll, approvedCount: approvedAll, ambiguousCount: ambiguousAll }}
        resiStats={{ totalListings: resiCount, pendingReview: pendingResi, approvedCount: approvedResi, ambiguousCount: ambiguousResi }}
        commercialStats={{ totalListings: commCount, pendingReview: pendingComm, approvedCount: approvedComm, ambiguousCount: ambiguousComm }}
        recentJobs={recentJobs.map(j => ({
          ...j,
          startedAt:   j.startedAt?.toISOString()   || null,
          completedAt: j.completedAt?.toISOString()  || null,
          createdAt:   j.createdAt.toISOString(),
        })) as any}
        schedule={{
          lastRun: lastCompleted?.completedAt?.toISOString() ?? null,
          nextRun: resiSettings ? computeNextRun(resiSettings.scheduleType, resiSettings.enabled) : null,
        }}
        reviewListings={reviewListings.map(toPropertyListingForClient) as any}
        enrichmentStats={{
          fullPostcode: Number(postcodeStats[0]?.has_full   ?? 0),
          outcodeOnly:  Number(postcodeStats[0]?.has_outcode ?? 0),
          noPostcode:   Number(postcodeStats[0]?.has_none    ?? 0),
          withPropertyData,
        }}
      />
    </div>
  )
}
