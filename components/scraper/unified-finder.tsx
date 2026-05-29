"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  ClipboardCheck,
  Play, Loader2, CheckCircle2, XCircle,
  Clock, Home, Building2, Layers, Ban,
} from "lucide-react"
import { toast } from "sonner"
import { ReviewQueue } from "@/components/scraper/review-queue"
import { PropertiesTable } from "@/components/scraper/properties-table"

// ─── Types ───────────────────────────────────────────────────────────────────

interface StatsData {
  totalListings: number
  pendingReview: number
  approvedCount: number
  ambiguousCount: number
}

interface SearchCriteria {
  category?: string
  locations?: { outcode: string; displayName: string; slug?: string }[]
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
  category?: string
}

interface EnrichmentStats {
  fullPostcode: number
  outcodeOnly: number
  noPostcode: number
  withPropertyData: number
}

interface UnifiedFinderProps {
  resiSettings: ScraperSettingsForClient | null
  commercialSettings: ScraperSettingsForClient | null
  allStats: StatsData
  resiStats: StatsData
  commercialStats: StatsData
  recentJobs: JobForClient[]
  schedule: { lastRun: string | null; nextRun: string | null }
  reviewListings: any[]
  enrichmentStats: EnrichmentStats
}

interface RunningJob {
  jobId: string
  jobKey: string
  source: string
  category: "RESIDENTIAL" | "COMMERCIAL"
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  totalFound: number
  successful: number
  failed: number
}

type CategoryView = "all" | "resi" | "commercial"
type SourceKey = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

// ─── Constants ───────────────────────────────────────────────────────────────

const SOURCES: { key: SourceKey; label: string; settingsKey: keyof ScraperSettingsForClient }[] = [
  { key: "RIGHTMOVE",     label: "Rightmove",     settingsKey: "rightmoveEnabled" },
  { key: "ZOOPLA",        label: "Zoopla",        settingsKey: "zooplaEnabled" },
  { key: "ONTHEMARKET",   label: "OnTheMarket",   settingsKey: "onthemarketEnabled" },
  { key: "PRIMELOCATION", label: "PrimeLocation", settingsKey: "primelocationEnabled" },
]

const CHIP_CFG: Record<string, { text: string; dot: string; btn: string }> = {
  RIGHTMOVE:    { text: "text-blue-700",    dot: "bg-blue-400",    btn: "border-blue-200 text-blue-600 hover:bg-blue-50" },
  ZOOPLA:       { text: "text-purple-700",  dot: "bg-purple-400",  btn: "border-purple-200 text-purple-600 hover:bg-purple-50" },
  ONTHEMARKET:  { text: "text-emerald-700", dot: "bg-emerald-400", btn: "border-emerald-200 text-emerald-600 hover:bg-emerald-50" },
  PRIMELOCATION:{ text: "text-orange-700",  dot: "bg-orange-400",  btn: "border-orange-200 text-orange-600 hover:bg-orange-50" },
}

const SRC_COLORS: Record<string, string> = {
  RIGHTMOVE:    "bg-blue-100 text-blue-800",
  ZOOPLA:       "bg-purple-100 text-purple-800",
  ONTHEMARKET:  "bg-emerald-100 text-emerald-800",
  PRIMELOCATION:"bg-orange-100 text-orange-800",
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED:    "bg-gray-100 text-gray-800",
  RUNNING:   "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  FAILED:    "bg-red-100 text-red-800",
  CANCELLED: "bg-yellow-100 text-yellow-800",
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt12h(d: Date) {
  const h = d.getHours(), m = d.getMinutes()
  return `${h % 12 || 12}:${m.toString().padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`
}

function LastRun({ at }: { at: string | null }) {
  const [txt, setTxt] = useState("")
  useEffect(() => {
    function calc() {
      if (!at) return "Never"
      const m = Math.floor((Date.now() - new Date(at).getTime()) / 60000)
      if (m < 1) return "Just now"
      if (m < 60) return `${m}m ago`
      const h = Math.floor(m / 60)
      return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`
    }
    setTxt(calc())
    const id = setInterval(() => setTxt(calc()), 30_000)
    return () => clearInterval(id)
  }, [at])
  return <span suppressHydrationWarning>{txt}</span>
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function UnifiedFinder({
  resiSettings,
  commercialSettings,
  allStats,
  resiStats,
  commercialStats,
  recentJobs,
  reviewListings,
}: UnifiedFinderProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Initialise from ?tab= query param (so old redirects land on the right tab)
  const initTab = (): CategoryView => {
    const t = searchParams?.get("tab")
    if (t === "commercial") return "commercial"
    if (t === "residential") return "resi"
    return "all"
  }

  const [categoryView, setCategoryView] = useState<CategoryView>(initTab)
  const [viewMode, setViewMode]         = useState<"properties" | "review">("properties")
  const [runningJobs, setRunningJobs]   = useState<Record<string, RunningJob>>({})
  const [tableRefreshKey, setTableRefreshKey] = useState(0)
  const pollIntervals = useRef<Record<string, NodeJS.Timeout>>({})

  // ── Derived ───────────────────────────────────────────────────────────────

  const activeStats = categoryView === "all" ? allStats : categoryView === "resi" ? resiStats : commercialStats

  const resiReady = !!(resiSettings?.enabled && (resiSettings?.searchCriteria?.locations?.length ?? 0) > 0)
  const commReady = !!(commercialSettings?.enabled && (commercialSettings?.searchCriteria?.locations?.length ?? 0) > 0)

  const lastJobBySource = recentJobs.reduce<Record<string, JobForClient>>((acc, job) => {
    if (!acc[job.source] && (job.status === "COMPLETED" || job.status === "FAILED")) acc[job.source] = job
    return acc
  }, {})

  const activeJobs = Object.values(runningJobs).filter(j => j.status === "QUEUED" || j.status === "RUNNING")

  const tableLockedCategory =
    categoryView === "resi" ? "RESIDENTIAL" :
    categoryView === "commercial" ? "COMMERCIAL" :
    undefined

  const activeReviewListings =
    categoryView === "all" ? reviewListings :
    reviewListings.filter((l: any) => l.category === (categoryView === "resi" ? "RESIDENTIAL" : "COMMERCIAL"))

  // ── Polling ───────────────────────────────────────────────────────────────

  const pollJobStatus = useCallback((jobId: string, jobKey: string) => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/scraper/status/${jobId}`)
        if (!res.ok) return
        const { job } = await res.json()

        setRunningJobs(prev => ({
          ...prev,
          [jobKey]: { ...prev[jobKey], status: job.status, totalFound: job.progress.totalFound, successful: job.progress.successful, failed: job.progress.failed },
        }))

        if (["COMPLETED", "FAILED", "CANCELLED"].includes(job.status)) {
          clearInterval(iv)
          delete pollIntervals.current[jobKey]
          if (job.status === "COMPLETED") {
            toast.success("Scrape completed", { description: `Found ${job.progress.totalFound}, saved ${job.progress.successful}` })
          } else if (job.status === "FAILED") {
            toast.error("Scrape failed", { description: job.errors?.[0]?.message || "Unknown error" })
          }
          router.refresh()
          setTableRefreshKey(k => k + 1)
        }
      } catch { /* ignore network errors */ }
    }, 3000)
    pollIntervals.current[jobKey] = iv
  }, [router])

  // Cleanup on unmount
  useEffect(() => () => { Object.values(pollIntervals.current).forEach(clearInterval) }, [])

  // Resume polling for any jobs still running when page loads
  useEffect(() => {
    const active = recentJobs.filter(j => j.status === "QUEUED" || j.status === "RUNNING")
    if (!active.length) return
    const init: Record<string, RunningJob> = {}
    for (const job of active) {
      const cat = (job.category === "COMMERCIAL") ? "COMMERCIAL" : "RESIDENTIAL"
      const jobKey = `${cat}_${job.source}`
      init[jobKey] = { jobId: job.id, jobKey, source: job.source, category: cat, status: job.status as any, totalFound: job.totalFound, successful: job.successful, failed: job.failed }
    }
    setRunningJobs(init)
    for (const job of active) {
      const cat = (job.category === "COMMERCIAL") ? "COMMERCIAL" : "RESIDENTIAL"
      const jobKey = `${cat}_${job.source}`
      if (!pollIntervals.current[jobKey]) pollJobStatus(job.id, jobKey)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Trigger ───────────────────────────────────────────────────────────────

  const triggerScrape = async (category: "RESIDENTIAL" | "COMMERCIAL", source: SourceKey) => {
    const settings  = category === "COMMERCIAL" ? commercialSettings : resiSettings
    const isReady   = category === "COMMERCIAL" ? commReady : resiReady
    const jobKey    = `${category}_${source}`

    if (!isReady) {
      toast.error(`${category === "COMMERCIAL" ? "Commercial" : "Residential"} scraper not ready`, {
        description: "Enable it and add locations in Finder Settings.",
      })
      return
    }
    if (runningJobs[jobKey]?.status === "QUEUED" || runningJobs[jobKey]?.status === "RUNNING") return

    setRunningJobs(prev => ({
      ...prev,
      [jobKey]: { jobId: "", jobKey, source, category, status: "QUEUED", totalFound: 0, successful: 0, failed: 0 },
    }))

    try {
      const c = settings!.searchCriteria!
      const isComm = category === "COMMERCIAL"
      const res = await fetch("/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source,
          criteria: {
            category,
            locations: c.locations,
            ...(c.minPrice  && c.minPrice  > 0 && { minPrice:  c.minPrice }),
            ...(c.maxPrice  && c.maxPrice  > 0 && { maxPrice:  c.maxPrice }),
            ...(!isComm && c.minBedrooms && c.minBedrooms > 0 && { minBedrooms: c.minBedrooms }),
            ...(!isComm && c.maxBedrooms && c.maxBedrooms > 0 && { maxBedrooms: c.maxBedrooms }),
            ...(c.addedSince && { addedSince: c.addedSince }),
            ...(c.maxPages   && c.maxPages   > 0 && { maxPages:   c.maxPages }),
            ...(c.includeSSTC != null && { includeSSTC: c.includeSSTC }),
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to trigger")

      const jobId = data.jobIds[0]
      setRunningJobs(prev => ({ ...prev, [jobKey]: { ...prev[jobKey], jobId, status: "QUEUED" } }))
      toast.success(`${source} (${isComm ? "Commercial" : "Residential"}) started`)
      pollJobStatus(jobId, jobKey)
    } catch (err: any) {
      toast.error(err.message)
      setRunningJobs(prev => { const n = { ...prev }; delete n[jobKey]; return n })
    }
  }

  const triggerAll = async (category: "RESIDENTIAL" | "COMMERCIAL") => {
    const settings = category === "COMMERCIAL" ? commercialSettings : resiSettings
    if (!settings) return
    const enabled = SOURCES.filter(s => !!(settings as any)[s.settingsKey])
    for (const s of enabled) {
      const jobKey = `${category}_${s.key}`
      if (runningJobs[jobKey]?.status !== "QUEUED" && runningJobs[jobKey]?.status !== "RUNNING") {
        await triggerScrape(category, s.key)
      }
    }
  }

  const triggerBoth = async () => {
    await triggerAll("RESIDENTIAL")
    await triggerAll("COMMERCIAL")
  }

  const cancelStuckJobs = async () => {
    try {
      const res = await fetch("/api/scraper/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) })
      const data = await res.json()
      if (res.ok) {
        toast.success(`Cancelled ${data.cancelled} stuck job(s)`)
        setRunningJobs({})
        router.refresh()
      } else {
        toast.error(data.error || "Failed to cancel jobs")
      }
    } catch {
      toast.error("Failed to cancel jobs")
    }
  }

  // Detect stale jobs: QUEUED/RUNNING jobs created more than 30 min ago (stuck after a server restart)
  const thirtyMinAgo = Date.now() - 30 * 60 * 1000
  const staleServerJobs = recentJobs.filter(j =>
    (j.status === "QUEUED" || j.status === "RUNNING") &&
    new Date(j.createdAt).getTime() < thirtyMinAgo
  )

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-3">

      {/* ══ Single toolbar: filters · stats · run · settings (one row, no wrap) ══ */}
      <div className="flex items-center gap-2 min-w-0">

        {/* Pill group: category tabs + review toggle */}
        <div className="flex items-center gap-0.5 p-0.5 bg-gray-100 rounded-lg flex-shrink-0">
          {([
            { id: "all",        label: "All",   Icon: Layers,    count: allStats.totalListings },
            { id: "resi",       label: "Resi",  Icon: Home,      count: resiStats.totalListings },
            { id: "commercial", label: "Comm",  Icon: Building2, count: commercialStats.totalListings },
          ] as const).map(({ id, label, Icon, count }) => (
            <button
              key={id}
              onClick={() => { setCategoryView(id as CategoryView); setViewMode("properties") }}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                categoryView === id && viewMode === "properties"
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
              <span className={`tabular-nums text-[11px] ${categoryView === id && viewMode === "properties" ? "text-gray-500" : "text-gray-400"}`}>
                {count}
              </span>
            </button>
          ))}

          <span className="w-px h-4 bg-gray-300 mx-0.5" />

          <button
            onClick={() => setViewMode(v => v === "review" ? "properties" : "review")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
              viewMode === "review"
                ? "bg-white shadow-sm text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <ClipboardCheck className="h-3 w-3" />
            Review
            {activeStats.pendingReview > 0 && (
              <span className={`tabular-nums text-[11px] font-semibold ${viewMode === "review" ? "text-amber-500" : "text-amber-400"}`}>
                {activeStats.pendingReview}
              </span>
            )}
          </button>
        </div>

        {/* Flexible gap */}
        <div className="flex-1" />

        {/* Compact stat badges — ✓ approved · ⚠ ambiguous (total is already in tabs) */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {activeStats.approvedCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums text-[11px] font-medium text-green-700 bg-green-50 border border-green-100 rounded px-1.5 py-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {activeStats.approvedCount}
            </span>
          )}
          {activeStats.ambiguousCount > 0 && (
            <span className="flex items-center gap-1 tabular-nums text-[11px] font-medium text-red-600 bg-red-50 border border-red-100 rounded px-1.5 py-0.5">
              <XCircle className="h-2.5 w-2.5" />
              {activeStats.ambiguousCount}
            </span>
          )}
        </div>

      </div>

      {/* ══ ROW 2: Portal strip + run buttons (single row) ══ */}
      <div className="flex items-center gap-1.5">
        {/* Portal cards */}
        {SOURCES.map(s => {
          const lastJob   = lastJobBySource[s.key]
          const cfg       = CHIP_CFG[s.key]
          const resiJob   = runningJobs[`RESIDENTIAL_${s.key}`]
          const commJob   = runningJobs[`COMMERCIAL_${s.key}`]
          const resiRun   = resiJob?.status === "QUEUED" || resiJob?.status === "RUNNING"
          const commRun   = commJob?.status === "QUEUED" || commJob?.status === "RUNNING"
          const anyRun    = resiRun || commRun
          const isEnabled = !!(resiSettings as any)?.[s.settingsKey] || !!(commercialSettings as any)?.[s.settingsKey]
          const dotCls    = !isEnabled ? "bg-gray-300" : anyRun ? `${cfg.dot} animate-pulse` : "bg-green-400"
          const showResi  = categoryView !== "commercial"
          const showComm  = categoryView !== "resi"

          return (
            <div key={s.key} className="flex-1 flex items-center gap-1.5 bg-white border border-gray-100 rounded-lg px-2.5 py-1 min-w-0">
              <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotCls}`} />
              <span className={`text-xs font-semibold flex-shrink-0 ${cfg.text}`}>{s.label}</span>
              <span className="text-[10px] text-gray-400 flex items-center gap-0.5 flex-1 min-w-0 truncate">
                {anyRun ? (
                  <span className="text-emerald-600">
                    {(resiJob?.totalFound ?? 0) + (commJob?.totalFound ?? 0)} found · {(resiJob?.successful ?? 0) + (commJob?.successful ?? 0)} saved
                  </span>
                ) : (
                  <><Clock className="h-2 w-2 flex-shrink-0" /><LastRun at={lastJob?.completedAt ?? null} /></>
                )}
              </span>
              <div className="flex items-center gap-0.5 flex-shrink-0">
                {showResi && (
                  <button onClick={() => triggerScrape("RESIDENTIAL", s.key)} disabled={!resiReady || resiRun} title="Run Residential"
                    className={`rounded border px-1 py-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center ${cfg.btn}`}>
                    {resiRun ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Home className="h-2.5 w-2.5" />}
                  </button>
                )}
                {showComm && (
                  <button onClick={() => triggerScrape("COMMERCIAL", s.key)} disabled={!commReady || commRun} title="Run Commercial"
                    className={`rounded border px-1 py-0.5 transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center ${cfg.btn}`}>
                    {commRun ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Building2 className="h-2.5 w-2.5" />}
                  </button>
                )}
              </div>
            </div>
          )
        })}

        {/* Divider */}
        <div className="h-6 w-px bg-gray-200 flex-shrink-0" />

        {/* Run all buttons — same row as portals */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {categoryView === "all" ? (
            <>
              <button
                onClick={() => triggerAll("RESIDENTIAL")}
                disabled={!resiReady || activeJobs.some(j => j.category === "RESIDENTIAL")}
                className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeJobs.some(j => j.category === "RESIDENTIAL") ? <Loader2 className="h-3 w-3 animate-spin" /> : <Home className="h-3 w-3" />}
                Resi
              </button>
              <button
                onClick={() => triggerAll("COMMERCIAL")}
                disabled={!commReady || activeJobs.some(j => j.category === "COMMERCIAL")}
                className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeJobs.some(j => j.category === "COMMERCIAL") ? <Loader2 className="h-3 w-3 animate-spin" /> : <Building2 className="h-3 w-3" />}
                Comm
              </button>
              <button
                onClick={triggerBoth}
                disabled={(!resiReady && !commReady) || activeJobs.length > 0}
                className="flex items-center gap-1 rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeJobs.length > 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                Both
              </button>
            </>
          ) : (
            <button
              onClick={() => triggerAll(categoryView === "commercial" ? "COMMERCIAL" : "RESIDENTIAL")}
              disabled={categoryView === "commercial" ? !commReady : !resiReady}
              className="flex items-center gap-1 rounded-md bg-gray-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {activeJobs.some(j => j.category === (categoryView === "commercial" ? "COMMERCIAL" : "RESIDENTIAL"))
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <Play className="h-3 w-3" />}
              Run All
            </button>
          )}
        </div>
      </div>

      {/* ── 4. Live progress ── */}
      {activeJobs.length > 0 && (
        <div className="space-y-1.5">
          {activeJobs.map(job => (
            <div key={job.jobKey} className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-md px-3 py-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 flex-shrink-0" />
              <Badge className={SRC_COLORS[job.source] || ""}>{job.source}</Badge>
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                {job.category === "COMMERCIAL" ? <Building2 className="h-3 w-3" /> : <Home className="h-3 w-3" />}
                {job.category === "COMMERCIAL" ? "Commercial" : "Residential"}
              </Badge>
              <span className="text-blue-700 flex-1">
                {job.status === "QUEUED"
                  ? "Queued…"
                  : `Running — ${job.totalFound} found, ${job.successful} saved`
                }
              </span>
              <button
                onClick={() => cancelStuckJobs()}
                title="Cancel this job"
                className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800 border border-red-200 rounded px-2 py-0.5 hover:bg-red-50 transition-colors"
              >
                <Ban className="h-3 w-3" /> Cancel
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Stale job warning (server-side, always visible) ── */}
      {staleServerJobs.length > 0 && activeJobs.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <Clock className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {staleServerJobs.length} job{staleServerJobs.length > 1 ? "s are" : " is"} stuck in &ldquo;Running&rdquo; status (30+ min — likely caused by a server restart).{" "}
            <button onClick={cancelStuckJobs} className="font-semibold underline hover:no-underline">
              Cancel stuck jobs
            </button>{" "}to clear them.
          </span>
        </div>
      )}

      {/* ── 5. Completed / failed summaries ── */}
      {Object.values(runningJobs).some(j => ["COMPLETED","FAILED","CANCELLED"].includes(j.status)) && (
        <div className="space-y-1.5">
          {Object.values(runningJobs)
            .filter(j => ["COMPLETED","FAILED","CANCELLED"].includes(j.status))
            .map(job => (
              <div key={job.jobKey} className={`flex items-center gap-3 text-sm rounded-md px-3 py-2 ${job.status === "COMPLETED" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                {job.status === "COMPLETED"
                  ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                  : <XCircle className="h-4 w-4 flex-shrink-0" />
                }
                <Badge className={SRC_COLORS[job.source] || ""}>{job.source}</Badge>
                <Badge variant="outline" className="text-xs">
                  {job.category === "COMMERCIAL" ? "Commercial" : "Residential"}
                </Badge>
                <span>
                  {job.status === "COMPLETED" && `Done — found ${job.totalFound}, saved ${job.successful}`}
                  {job.status === "FAILED"    && "Scrape failed"}
                  {job.status === "CANCELLED" && "Cancelled"}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* ══ Content: Review Queue or Properties Table (no tab bar) ══ */}
      {viewMode === "review" ? (
        activeReviewListings.length > 0
          ? <ReviewQueue listings={activeReviewListings} />
          : (
            <div className="py-16 text-center text-sm text-gray-400">
              <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-30" />
              No properties pending review
            </div>
          )
      ) : (
        <PropertiesTable refreshKey={tableRefreshKey} lockedCategory={tableLockedCategory} />
      )}
    </div>
  )
}
