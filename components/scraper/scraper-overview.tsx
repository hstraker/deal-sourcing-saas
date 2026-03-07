"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Database,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Settings,
} from "lucide-react"
import { toast } from "sonner"
import { ReviewQueue } from "@/components/scraper/review-queue"
import { PropertiesTable } from "@/components/scraper/properties-table"
import { ScraperSourceCard } from "@/components/scraper/scraper-source-card"
import { ScraperLiveProgress } from "@/components/scraper/scraper-live-progress"

interface SourceCount {
  source: string
  count: number
}

interface StatusCount {
  status: string
  count: number
}

interface JobForClient {
  id: string
  source: string
  status: string
  totalFound: number
  processed: number
  successful: number
  failed: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

interface LocationCriteria {
  outcode: string
  displayName: string
  slug?: string
}

interface SearchCriteria {
  category?: string
  locations?: LocationCriteria[]
  minPrice?: number | null
  maxPrice?: number | null
  minBedrooms?: number | null
  maxBedrooms?: number | null
  propertyTypes?: string[] | null
  addedSince?: string | null
  includeSSTC?: boolean
  maxPages?: number | null
}

interface ScraperSettingsForClient {
  enabled: boolean
  scheduleType: string
  rightmoveEnabled: boolean
  zooplaEnabled: boolean
  onthemarketEnabled: boolean
  primelocationEnabled: boolean
  searchCriteria: SearchCriteria | null
}

interface ScheduleInfo {
  lastRun: string | null
  nextRun: string | null
}

interface EnrichmentStats {
  fullPostcode: number
  outcodeOnly: number
  noPostcode: number
  withPropertyData: number
}

interface ScraperOverviewProps {
  stats: {
    totalListings: number
    bySource: SourceCount[]
    byReviewStatus: StatusCount[]
    pendingReview: number
    ambiguousCount: number
  }
  recentJobs: JobForClient[]
  settings: ScraperSettingsForClient | null
  schedule: ScheduleInfo
  reviewListings?: any[]
  enrichmentStats?: EnrichmentStats
}

const SOURCE_COLORS: Record<string, string> = {
  RIGHTMOVE: "bg-blue-100 text-blue-800",
  ZOOPLA: "bg-purple-100 text-purple-800",
  ONTHEMARKET: "bg-emerald-100 text-emerald-800",
  PRIMELOCATION: "bg-orange-100 text-orange-800",
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "bg-gray-100 text-gray-800",
  RUNNING: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  CANCELLED: "bg-yellow-100 text-yellow-800",
}

function formatTime12h(date: Date): string {
  const hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? "PM" : "AM"
  const hour12 = hours % 12 || 12
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${ampm}`
}

function formatCriteriaSummary(criteria: SearchCriteria | null): string {
  if (!criteria) return "No criteria configured"

  const parts: string[] = []

  if (criteria.locations && criteria.locations.length > 0) {
    const names = criteria.locations.map((l) => l.displayName.replace(/ \(.*\)/, ""))
    if (names.length <= 3) {
      parts.push(names.join(", "))
    } else {
      parts.push(`${names.slice(0, 2).join(", ")} +${names.length - 2} more`)
    }
  }

  if (criteria.minPrice || criteria.maxPrice) {
    const min = criteria.minPrice ? `£${(criteria.minPrice / 1000).toFixed(0)}k` : "Any"
    const max = criteria.maxPrice ? `£${(criteria.maxPrice / 1000).toFixed(0)}k` : "Any"
    parts.push(`${min}–${max}`)
  }

  if (criteria.minBedrooms || criteria.maxBedrooms) {
    const min = criteria.minBedrooms ?? "Any"
    const max = criteria.maxBedrooms ?? "Any"
    parts.push(`${min}–${max} beds`)
  }

  if (criteria.addedSince) {
    const labels: Record<string, string> = {
      "24hours": "Last 24h",
      "3days": "Last 3d",
      "7days": "Last 7d",
      "14days": "Last 14d",
    }
    parts.push(labels[criteria.addedSince] ?? criteria.addedSince)
  }

  return parts.length > 0 ? parts.join(" | ") : "All properties (no filters)"
}

interface RunningJob {
  jobId: string
  source: string
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  totalFound: number
  successful: number
  failed: number
}

type SourceKey = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

const SOURCES: { key: SourceKey; label: string; settingsKey: keyof ScraperSettingsForClient }[] = [
  { key: "RIGHTMOVE", label: "Rightmove", settingsKey: "rightmoveEnabled" },
  { key: "ZOOPLA", label: "Zoopla", settingsKey: "zooplaEnabled" },
  { key: "ONTHEMARKET", label: "OnTheMarket", settingsKey: "onthemarketEnabled" },
  { key: "PRIMELOCATION", label: "PrimeLocation", settingsKey: "primelocationEnabled" },
]

export function ScraperOverview({
  stats,
  recentJobs,
  settings,
  schedule,
  reviewListings,
  enrichmentStats,
}: ScraperOverviewProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"review" | "all" | "jobs">("all")
  const [runningJobs, setRunningJobs] = useState<Record<string, RunningJob>>({})
  const [tableRefreshKey, setTableRefreshKey] = useState(0)
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({})

  const getSourceCount = (source: string) =>
    stats.bySource.find((s) => s.source === source)?.count || 0

  const hasCriteria =
    settings?.searchCriteria?.locations &&
    settings.searchCriteria.locations.length > 0

  // Last completed job per source (from recentJobs)
  const lastJobBySource = recentJobs.reduce<Record<string, JobForClient>>((acc, job) => {
    if (!acc[job.source] && (job.status === "COMPLETED" || job.status === "FAILED")) {
      acc[job.source] = job
    }
    return acc
  }, {})

  const pollJobStatus = useCallback((jobId: string, source: string) => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraper/status/${jobId}`)
        if (!res.ok) return

        const data = await res.json()
        const job = data.job

        setRunningJobs((prev) => ({
          ...prev,
          [source]: {
            jobId,
            source,
            status: job.status,
            totalFound: job.progress.totalFound,
            successful: job.progress.successful,
            failed: job.progress.failed,
          },
        }))

        if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
          clearInterval(interval)
          delete pollIntervals.current[source]

          if (job.status === "COMPLETED") {
            toast.success(`${source} scrape completed`, {
              description: `Found ${job.progress.totalFound} properties, saved ${job.progress.successful}`,
            })
          } else if (job.status === "FAILED") {
            const errorMsg = job.errors?.[0]?.message || "Unknown error"
            toast.error(`${source} scrape failed`, { description: errorMsg })
          } else {
            toast.warning(`${source} scrape cancelled`)
          }

          router.refresh()
          setTableRefreshKey((k) => k + 1)
        }
      } catch {
        // Ignore poll errors
      }
    }, 3000)

    pollIntervals.current[source] = interval
  }, [])

  // Cleanup all intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(pollIntervals.current).forEach(clearInterval)
    }
  }, [])

  // On mount: resume polling for any jobs that were still active when the page was last left
  useEffect(() => {
    const active = recentJobs.filter((j) => j.status === "QUEUED" || j.status === "RUNNING")
    if (active.length === 0) return

    const initial: Record<string, RunningJob> = {}
    for (const job of active) {
      initial[job.source] = {
        jobId: job.id,
        source: job.source,
        status: job.status as RunningJob["status"],
        totalFound: job.totalFound,
        successful: job.successful,
        failed: job.failed,
      }
    }
    setRunningJobs(initial)

    for (const job of active) {
      if (!pollIntervals.current[job.source]) {
        pollJobStatus(job.id, job.source)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const triggerScrape = async (source: SourceKey) => {
    if (!hasCriteria) {
      toast.error("No search criteria configured", {
        description: "Go to Settings > Scraper to set locations and filters.",
      })
      return
    }

    setRunningJobs((prev) => ({
      ...prev,
      [source]: { jobId: "", source, status: "QUEUED", totalFound: 0, successful: 0, failed: 0 },
    }))

    try {
      const criteria = settings!.searchCriteria!
      const res = await fetch("/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          criteria: {
            category: criteria.category ?? "RESIDENTIAL",
            locations: criteria.locations,
            ...(criteria.minPrice != null && criteria.minPrice > 0 && { minPrice: criteria.minPrice }),
            ...(criteria.maxPrice != null && criteria.maxPrice > 0 && { maxPrice: criteria.maxPrice }),
            ...(criteria.minBedrooms != null && criteria.minBedrooms > 0 && { minBedrooms: criteria.minBedrooms }),
            ...(criteria.maxBedrooms != null && criteria.maxBedrooms > 0 && { maxBedrooms: criteria.maxBedrooms }),
            ...(criteria.propertyTypes && criteria.propertyTypes.length > 0 && { propertyTypes: criteria.propertyTypes }),
            ...(criteria.addedSince && { addedSince: criteria.addedSince }),
            ...(criteria.includeSSTC != null && { includeSSTC: criteria.includeSSTC }),
            ...(criteria.maxPages != null && criteria.maxPages > 0 && { maxPages: criteria.maxPages }),
          },
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to trigger scrape")
      }

      const data = await res.json()
      const jobId = data.jobIds[0]

      setRunningJobs((prev) => ({
        ...prev,
        [source]: { jobId, source, status: "QUEUED", totalFound: 0, successful: 0, failed: 0 },
      }))

      toast.success(`${source} scrape triggered`, { description: "Monitoring progress…" })
      pollJobStatus(jobId, source)
    } catch (error: any) {
      toast.error(error.message)
      setRunningJobs((prev) => {
        const next = { ...prev }
        delete next[source]
        return next
      })
    }
  }

  const triggerAll = async () => {
    const enabledSources = SOURCES.filter((s) => settings?.[s.settingsKey] && !runningJobs[s.key])
    for (const s of enabledSources) {
      await triggerScrape(s.key)
    }
  }

  const isSourceRunning = (source: string) => {
    const job = runningJobs[source]
    return job && (job.status === "QUEUED" || job.status === "RUNNING")
  }

  const activeJobs = Object.values(runningJobs).filter(
    (j) => j.status === "QUEUED" || j.status === "RUNNING"
  )

  return (
    <div className="space-y-5">

      {/* ── 1. Source Cards + Stats ── */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4 lg:grid-cols-6">
        {SOURCES.map((s) => {
          const lastJob = lastJobBySource[s.key]
          const isEnabled = !!(settings?.[s.settingsKey])
          return (
            <div key={s.key} className="lg:col-span-1 col-span-1">
              <ScraperSourceCard
                source={s.key}
                label={s.label}
                enabled={isEnabled}
                lastJobAt={lastJob?.completedAt ?? null}
                lastJobCount={lastJob?.totalFound ?? null}
                isRunning={!!isSourceRunning(s.key)}
                progress={runningJobs[s.key]}
                onTrigger={() => triggerScrape(s.key)}
                hasCriteria={!!hasCriteria}
              />
            </div>
          )
        })}

        {/* Stats summary card (spans 2 cols on lg) */}
        <div className="col-span-2 sm:col-span-4 lg:col-span-2">
          <div className="ds-card overflow-hidden h-full">            <div className="p-5 p-4 space-y-3">              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Overview</span>
                <div className="flex gap-2">
                  <Link href="/dashboard/settings/scraper">
                    <Button variant="ghost" size="sm" className="h-7 px-2">
                      <Settings className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={!hasCriteria || activeJobs.length > 0}
                    onClick={triggerAll}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Run All
                  </Button>
                </div>
              </div>

              {/* Counts grid */}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <div className="text-lg font-bold text-blue-700">
                    {stats.totalListings}
                  </div>
                  <div className="text-[11px] text-gray-400">Total</div>
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <div className="text-lg font-bold text-amber-700">
                    {stats.pendingReview}
                  </div>
                  <div className="text-[11px] text-gray-400">Pending</div>
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <div className="text-lg font-bold text-green-700">
                    {stats.byReviewStatus.find((s) => s.status === "APPROVED")?.count || 0}
                  </div>
                  <div className="text-[11px] text-gray-400">Approved</div>
                </div>
                <div className="rounded-md bg-gray-50 px-3 py-2">
                  <div className="text-lg font-bold text-red-700">
                    {stats.ambiguousCount}
                  </div>
                  <div className="text-[11px] text-gray-400">Ambiguous</div>
                </div>
              </div>

              {/* Source breakdown */}
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-blue-600 font-medium">{getSourceCount("RIGHTMOVE")} RM</span>
                <span className="text-gray-400">·</span>
                <span className="text-purple-600 font-medium">{getSourceCount("ZOOPLA")} Z</span>
                <span className="text-gray-400">·</span>
                <span className="text-emerald-600 font-medium">{getSourceCount("ONTHEMARKET")} OTM</span>
                <span className="text-gray-400">·</span>
                <span className="text-orange-600 font-medium">{getSourceCount("PRIMELOCATION")} PL</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. Criteria banner ── */}
      {!hasCriteria ? (
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <p>
            No search criteria configured. Go to{" "}
            <Link href="/dashboard/settings/scraper" className="font-medium underline">
              Scraper Settings
            </Link>{" "}
            to set locations and filters before running a scrape.
          </p>
        </div>
      ) : (
        <div className="text-sm text-gray-400 bg-gray-100 rounded-md px-3 py-2 flex items-center gap-2">
          <span className="font-medium text-gray-900">Criteria:</span>
          <span>{formatCriteriaSummary(settings?.searchCriteria ?? null)}</span>
          <Link href="/dashboard/settings/scraper" className="ml-auto text-xs text-[#2563EB] hover:underline flex-shrink-0">
            Edit
          </Link>
        </div>
      )}

      {/* ── 3. Live progress banners ── */}
      {activeJobs.length > 0 && (
        <div className="space-y-2">
          {activeJobs.map((job) => (
            <ScraperLiveProgress key={job.source} job={job} />
          ))}
        </div>
      )}

      {/* ── 4. Completed / failed job summaries (briefly shown after finish) ── */}
      {Object.values(runningJobs).some(
        (j) => j.status === "COMPLETED" || j.status === "FAILED" || j.status === "CANCELLED"
      ) && (
        <div className="space-y-1.5">
          {Object.values(runningJobs)
            .filter((j) => j.status === "COMPLETED" || j.status === "FAILED" || j.status === "CANCELLED")
            .map((job) => (
              <div
                key={job.source}
                className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 ${
                  job.status === "COMPLETED"
                    ? "bg-green-50 text-green-800"
                    : "bg-red-50 text-red-800"
                }`}
              >
                {job.status === "COMPLETED" ? (
                  <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                )}
                <Badge className={SOURCE_COLORS[job.source] || ""}>{job.source}</Badge>
                <span>
                  {job.status === "COMPLETED" &&
                    `Done — found ${job.totalFound}, saved ${job.successful}`}
                  {job.status === "FAILED" && "Scrape failed"}
                  {job.status === "CANCELLED" && "Cancelled"}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ── 5. Tabs: All Properties | Review Queue | Job History ── */}
      <div className="space-y-4">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "all"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <Database className="inline mr-2 h-4 w-4" />
            All Properties
            <Badge variant="secondary" className="ml-2">
              {stats.totalListings}
            </Badge>
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "review"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <ClipboardCheck className="inline mr-2 h-4 w-4" />
            Review Queue
            {stats.pendingReview > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pendingReview}
              </Badge>
            )}
          </button>
          <button
            onClick={() => setActiveTab("jobs")}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "jobs"
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-gray-400 hover:text-gray-900"
            }`}
          >
            <TrendingUp className="inline mr-2 h-4 w-4" />
            Job History
          </button>
        </div>

        {/* Review Queue tab */}
        {activeTab === "review" && reviewListings ? (
          <ReviewQueue listings={reviewListings} />
        ) : activeTab === "review" ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-lg font-medium text-gray-400">No properties to review</p>
            <p className="text-sm text-gray-400 mt-1">
              Run a scraper job to populate the review queue
            </p>
          </div>
        ) : null}

        {/* All Properties tab */}
        {activeTab === "all" && <PropertiesTable refreshKey={tableRefreshKey} />}

        {/* Job History tab */}
        {activeTab === "jobs" && (
          <div className="ds-card overflow-hidden">
            <div className="px-6 pt-4 pb-2">
              <h3 className="text-lg font-semibold">Recent Scraper Jobs</h3>
            </div>
            <div className="p-5">
              {recentJobs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No scraper jobs have been run yet
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 font-medium text-gray-400">Source</th>
                        <th className="pb-2 font-medium text-gray-400">Status</th>
                        <th className="pb-2 font-medium text-gray-400">Found</th>
                        <th className="pb-2 font-medium text-gray-400">Saved</th>
                        <th className="pb-2 font-medium text-gray-400">Failed</th>
                        <th className="pb-2 font-medium text-gray-400">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentJobs.map((job) => (
                        <tr key={job.id} className="border-b last:border-0">
                          <td className="py-2">
                            <Badge className={SOURCE_COLORS[job.source] || ""}>{job.source}</Badge>
                          </td>
                          <td className="py-2">
                            <Badge className={STATUS_COLORS[job.status] || ""}>{job.status}</Badge>
                          </td>
                          <td className="py-2">{job.totalFound}</td>
                          <td className="py-2 text-green-600">{job.successful}</td>
                          <td className="py-2 text-red-600">{job.failed}</td>
                          <td className="py-2 text-gray-400" suppressHydrationWarning>
                            {new Date(job.createdAt).toLocaleDateString()}{" "}
                            {formatTime12h(new Date(job.createdAt))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
