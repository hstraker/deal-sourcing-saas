"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import {
  Database, ClipboardCheck, TrendingUp,
  Play, Loader2, CheckCircle2, XCircle,
  Settings, Clock, Home, Building2, Layers,
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

function criteriaSummary(s: ScraperSettingsForClient | null) {
  const c = s?.searchCriteria
  if (!c) return "No criteria configured"
  const parts: string[] = []
  if (c.locations?.length) {
    const names = c.locations.map(l => l.displayName.replace(/ \(.*\)/, ""))
    parts.push(names.length <= 2 ? names.join(", ") : `${names.slice(0, 2).join(", ")} +${names.length - 2} more`)
  }
  if (c.minPrice || c.maxPrice) {
    const lo = c.minPrice ? `£${(c.minPrice / 1000).toFixed(0)}k` : "Any"
    const hi = c.maxPrice ? `£${(c.maxPrice / 1000).toFixed(0)}k` : "Any"
    parts.push(`${lo}–${hi}`)
  }
  if (c.category !== "COMMERCIAL" && (c.minBedrooms || c.maxBedrooms)) {
    parts.push(`${c.minBedrooms ?? "Any"}–${c.maxBedrooms ?? "Any"} beds`)
  }
  if (c.addedSince) {
    const map: Record<string, string> = { "24hours": "24h", "3days": "3d", "7days": "7d", "14days": "14d" }
    parts.push(`Last ${map[c.addedSince] ?? c.addedSince}`)
  }
  return parts.join(" · ") || "All properties"
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

// ─── Sub-component: criteria banner ──────────────────────────────────────────

function CriteriaBanner({ settings, label }: { settings: ScraperSettingsForClient | null; label: string }) {
  const isComm = settings?.searchCriteria?.category === "COMMERCIAL"
  const Icon = isComm ? Building2 : Home

  if (!settings?.enabled) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          {label} scraper is disabled.{" "}
          <Link href="/dashboard/settings/finder" className="font-medium underline">Finder Settings →</Link>
        </span>
      </div>
    )
  }
  if (!settings?.searchCriteria?.locations?.length) {
    return (
      <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
        <Icon className="h-3.5 w-3.5 flex-shrink-0" />
        <span>
          No {label.toLowerCase()} locations added.{" "}
          <Link href="/dashboard/settings/finder" className="font-medium underline">Configure in Finder Settings →</Link>
        </span>
      </div>
    )
  }
  return (
    <div className="flex items-center gap-2 text-sm bg-gray-50 border border-gray-100 rounded-md px-3 py-2">
      <Icon className="h-3.5 w-3.5 flex-shrink-0 text-gray-400" />
      <span className="font-medium text-gray-700">{label}:</span>
      <span className="text-gray-400">{criteriaSummary(settings)}</span>
    </div>
  )
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
  const [contentTab, setContentTab]     = useState<"all" | "review" | "jobs">("all")
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">

      {/* ── 1. Category switcher ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {([
            { id: "all",        label: "All Properties",  Icon: Layers,    count: null },
            { id: "resi",       label: "Residential",     Icon: Home,      count: resiStats.totalListings },
            { id: "commercial", label: "Commercial",       Icon: Building2, count: commercialStats.totalListings },
          ] as const).map(({ id, label, Icon, count }) => (
            <button
              key={id}
              onClick={() => setCategoryView(id as CategoryView)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                categoryView === id
                  ? "bg-white shadow-sm text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {count !== null && (
                <span className={`text-xs tabular-nums ${categoryView === id ? "text-gray-500" : "text-gray-400"}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Settings gear */}
        <Link href="/dashboard/settings/finder">
          <button className="flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors">
            <Settings className="h-3.5 w-3.5" />
            Finder Settings
          </button>
        </Link>
      </div>

      {/* ── 2. Portal status + run bar ── */}
      <div className="ds-card overflow-hidden">
        <div className="flex items-center gap-0 divide-x divide-gray-100">

          {/* Portal chips */}
          <div className="flex items-center gap-0 divide-x divide-gray-100 flex-1 min-w-0">
            {SOURCES.map(s => {
              const lastJob   = lastJobBySource[s.key]
              const cfg       = CHIP_CFG[s.key]
              const resiJob   = runningJobs[`RESIDENTIAL_${s.key}`]
              const commJob   = runningJobs[`COMMERCIAL_${s.key}`]
              const resiRun   = resiJob?.status === "QUEUED" || resiJob?.status === "RUNNING"
              const commRun   = commJob?.status === "QUEUED" || commJob?.status === "RUNNING"
              const anyRun    = resiRun || commRun
              const isEnabled = !!(resiSettings as any)?.[s.settingsKey] || !!(commercialSettings as any)?.[s.settingsKey]
              const dotCls    = !isEnabled ? "bg-gray-300" : anyRun ? `${cfg.dot} animate-pulse` : "bg-green-500"

              const showResi = categoryView !== "commercial"
              const showComm = categoryView !== "resi"

              return (
                <div key={s.key} className="flex flex-col gap-1 px-3 py-2.5 flex-1 min-w-0">
                  {/* Name + run buttons */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dotCls}`} />
                      <span className={`text-xs font-semibold truncate ${cfg.text}`}>{s.label}</span>
                    </div>
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      {showResi && (
                        <button
                          onClick={() => triggerScrape("RESIDENTIAL", s.key)}
                          disabled={!resiReady || resiRun}
                          title="Run Residential"
                          className={`rounded border px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 ${cfg.btn}`}
                        >
                          {resiRun ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Home className="h-2.5 w-2.5" />}
                        </button>
                      )}
                      {showComm && (
                        <button
                          onClick={() => triggerScrape("COMMERCIAL", s.key)}
                          disabled={!commReady || commRun}
                          title="Run Commercial"
                          className={`rounded border px-1.5 py-0.5 text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-0.5 ${cfg.btn}`}
                        >
                          {commRun ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Building2 className="h-2.5 w-2.5" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Last run */}
                  <div className="text-xs text-gray-400 flex items-center gap-1 h-3.5">
                    {anyRun ? (
                      <span className="text-emerald-600">
                        {(resiJob?.totalFound ?? 0) + (commJob?.totalFound ?? 0)} found
                        {" · "}{(resiJob?.successful ?? 0) + (commJob?.successful ?? 0)} saved
                      </span>
                    ) : (
                      <>
                        <Clock className="h-2.5 w-2.5" />
                        <LastRun at={lastJob?.completedAt ?? null} />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Stats + run-all area */}
          <div className="flex items-center gap-3 px-3 py-2.5 flex-shrink-0">
            {/* Stat pills */}
            <div className="flex items-center gap-3 text-xs">
              {[
                { label: "Total",     val: activeStats.totalListings,  cls: "text-blue-700" },
                { label: "Pending",   val: activeStats.pendingReview,  cls: "text-amber-600" },
                { label: "Approved",  val: activeStats.approvedCount,  cls: "text-green-600" },
                { label: "Ambiguous", val: activeStats.ambiguousCount, cls: "text-red-600" },
              ].map(({ label, val, cls }) => (
                <div key={label} className="text-center">
                  <div className={`font-bold leading-none ${cls}`}>{val}</div>
                  <div className="text-gray-400 mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            <div className="h-8 w-px bg-gray-100" />

            {/* Run buttons */}
            {categoryView === "all" ? (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => triggerAll("RESIDENTIAL")}
                  disabled={!resiReady || activeJobs.some(j => j.category === "RESIDENTIAL")}
                  className="flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Home className="h-3 w-3" />
                  Resi
                </button>
                <button
                  onClick={() => triggerAll("COMMERCIAL")}
                  disabled={!commReady || activeJobs.some(j => j.category === "COMMERCIAL")}
                  className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Building2 className="h-3 w-3" />
                  Comm
                </button>
                <button
                  onClick={triggerBoth}
                  disabled={(!resiReady && !commReady) || activeJobs.length > 0}
                  className="flex items-center gap-1.5 rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {activeJobs.length > 0
                    ? <Loader2 className="h-3 w-3 animate-spin" />
                    : <Play className="h-3 w-3" />
                  }
                  Both
                </button>
              </div>
            ) : (
              <button
                onClick={() => triggerAll(categoryView === "commercial" ? "COMMERCIAL" : "RESIDENTIAL")}
                disabled={categoryView === "commercial" ? !commReady : !resiReady}
                className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {activeJobs.length > 0
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <Play className="h-3 w-3" />
                }
                Run All
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 3. Criteria banners ── */}
      <div className="space-y-2">
        {categoryView !== "commercial" && (
          <CriteriaBanner settings={resiSettings} label="Residential" />
        )}
        {categoryView !== "resi" && (
          <CriteriaBanner settings={commercialSettings} label="Commercial" />
        )}
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
              <span className="text-blue-700">
                {job.status === "QUEUED"
                  ? "Queued…"
                  : `Running — ${job.totalFound} found, ${job.successful} saved`
                }
              </span>
            </div>
          ))}
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

      {/* ── 6. Content tabs ── */}
      <div className="space-y-4">
        <div className="flex border-b">
          {[
            { id: "all",    label: "All Properties", Icon: Database,      count: activeStats.totalListings },
            { id: "review", label: "Review Queue",   Icon: ClipboardCheck, count: activeStats.pendingReview },
            { id: "jobs",   label: "Job History",    Icon: TrendingUp,     count: null },
          ].map(({ id, label, Icon, count }) => (
            <button
              key={id}
              onClick={() => setContentTab(id as any)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                contentTab === id
                  ? "border-[#2563EB] text-[#2563EB]"
                  : "border-transparent text-gray-400 hover:text-gray-900"
              }`}
            >
              <Icon className="inline mr-1.5 h-4 w-4" />
              {label}
              {count != null && count > 0 && (
                <Badge variant="secondary" className="ml-2">{count}</Badge>
              )}
            </button>
          ))}
        </div>

        {/* Review Queue */}
        {contentTab === "review" && (
          activeReviewListings.length > 0
            ? <ReviewQueue listings={activeReviewListings} />
            : <div className="py-16 text-center text-sm text-gray-400">No properties pending review</div>
        )}

        {/* All Properties table */}
        {contentTab === "all" && (
          <PropertiesTable refreshKey={tableRefreshKey} lockedCategory={tableLockedCategory} />
        )}

        {/* Job History */}
        {contentTab === "jobs" && (
          <div className="ds-card overflow-hidden">
            <div className="px-6 pt-4 pb-2">
              <h3 className="text-sm font-semibold text-gray-700">Recent Scraper Jobs</h3>
            </div>
            <div className="p-5">
              {recentJobs.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No scraper jobs yet</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="table-header">Source</th>
                        <th className="table-header">Category</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Found</th>
                        <th className="table-header">Saved</th>
                        <th className="table-header">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentJobs
                        .filter(job =>
                          categoryView === "all" ||
                          (categoryView === "resi"       && job.category !== "COMMERCIAL") ||
                          (categoryView === "commercial" && job.category === "COMMERCIAL")
                        )
                        .map(job => (
                          <tr key={job.id} className="table-row border-b last:border-0">
                            <td className="table-cell">
                              <Badge className={SRC_COLORS[job.source] || ""}>{job.source}</Badge>
                            </td>
                            <td className="table-cell">
                              <span className="flex items-center gap-1 text-xs text-gray-500">
                                {job.category === "COMMERCIAL"
                                  ? <><Building2 className="h-3 w-3" /> Commercial</>
                                  : <><Home className="h-3 w-3" /> Residential</>
                                }
                              </span>
                            </td>
                            <td className="table-cell">
                              <Badge className={STATUS_COLORS[job.status] || ""}>{job.status}</Badge>
                            </td>
                            <td className="table-cell">{job.totalFound}</td>
                            <td className="table-cell text-green-600">{job.successful}</td>
                            <td className="table-cell text-gray-400" suppressHydrationWarning>
                              {new Date(job.createdAt).toLocaleDateString()} {fmt12h(new Date(job.createdAt))}
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
