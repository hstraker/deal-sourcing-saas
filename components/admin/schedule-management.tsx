"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Play,
  Loader2,
  CalendarDays,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Settings,
  Radio,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScraperSettings {
  id: string
  enabled: boolean
  scheduleType: string
  rightmoveEnabled: boolean
  zooplaEnabled: boolean
  onthemarketEnabled: boolean
  primelocationEnabled: boolean
  searchCriteria: any | null
}

interface Schedule {
  lastRun: string | null
  nextRun: string | null
}

interface ScraperJob {
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

interface ScheduleManagementProps {
  initialSettings: ScraperSettings | null
  initialSchedule: Schedule
  initialJobs: ScraperJob[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SCHEDULE_OPTIONS = [
  { value: "TWICE_DAILY", label: "Twice daily (6 AM & 6 PM)" },
  { value: "DAILY", label: "Daily (6 AM)" },
  { value: "HOURLY", label: "Hourly" },
]

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

const STATUS_CONFIG: Record<string, { label: string; className: string; Icon: React.ElementType }> =
  {
    QUEUED: {
      label: "Queued",
      className: "bg-gray-100 text-gray-600",
      Icon: Clock,
    },
    RUNNING: {
      label: "Running",
      className: "bg-blue-100 text-blue-700",
      Icon: Radio,
    },
    COMPLETED: {
      label: "Completed",
      className: "bg-emerald-100 text-emerald-700",
      Icon: CheckCircle2,
    },
    FAILED: {
      label: "Failed",
      className: "bg-red-100 text-red-700",
      Icon: XCircle,
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-amber-100 text-amber-700",
      Icon: AlertCircle,
    },
  }

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.QUEUED
  const Icon = cfg.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.className}`}
    >
      <Icon className={`h-3 w-3 ${status === "RUNNING" ? "animate-pulse" : ""}`} />
      {cfg.label}
    </span>
  )
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—"
  const start = new Date(startedAt).getTime()
  const end = completedAt ? new Date(completedAt).getTime() : Date.now()
  const secs = Math.round((end - start) / 1000)
  if (secs < 60) return `${secs}s`
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

// ── Schedule card ─────────────────────────────────────────────────────────────

function ScraperScheduleCard({
  settings,
  schedule,
  onSettingsChanged,
  onJobsChanged,
}: {
  settings: ScraperSettings | null
  schedule: Schedule
  onSettingsChanged: (s: ScraperSettings) => void
  onJobsChanged: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)

  const patchSettings = useCallback(
    async (patch: Partial<ScraperSettings>) => {
      setSaving(true)
      try {
        const res = await fetch("/api/scraper/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
        if (!res.ok) throw new Error("Failed to update settings")
        const data = await res.json()
        onSettingsChanged(data.settings)
        toast.success("Settings saved")
      } catch {
        toast.error("Failed to save settings")
      } finally {
        setSaving(false)
      }
    },
    [onSettingsChanged]
  )

  const handleRunNow = async () => {
    if (!settings?.searchCriteria) {
      toast.error("No search criteria configured — set them in Scraper Settings first")
      return
    }
    setTriggering(true)
    try {
      const res = await fetch("/api/scraper/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "ALL", criteria: settings.searchCriteria }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to trigger scraper")
      }
      toast.success("Scraper started for all enabled sources")
      onJobsChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to trigger scraper")
    } finally {
      setTriggering(false)
    }
  }

  return (
    <div className="ds-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-[#F5A623]" />
          <div>
            <h2 className="text-base font-semibold">Property Scraper</h2>
            <p className="text-xs text-gray-400">Automated listing collection</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {saving && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
          <Link href="/dashboard/settings/scraper">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Settings className="mr-1.5 h-3.5 w-3.5" />
              Full Settings
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Left: Schedule controls */}
        <div className="space-y-4">
          {/* Enabled toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Scheduler enabled</p>
              <p className="text-xs text-gray-400">Allow automatic scheduled runs</p>
            </div>
            <Switch
              checked={settings?.enabled ?? false}
              onCheckedChange={(checked) => patchSettings({ enabled: checked })}
              disabled={saving}
            />
          </div>

          {/* Schedule type */}
          <div className="space-y-1.5">
            <Label className="text-sm">Schedule frequency</Label>
            <Select
              value={settings?.scheduleType ?? "TWICE_DAILY"}
              onValueChange={(val) => patchSettings({ scheduleType: val })}
              disabled={saving}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Next run / last run */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Next run</p>
              <p className="font-semibold text-gray-800">
                {settings?.enabled && schedule.nextRun
                  ? formatAbsolute(schedule.nextRun)
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-gray-50 px-3 py-2.5">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Last run</p>
              <p className="font-semibold text-gray-800">
                {schedule.lastRun ? formatRelative(schedule.lastRun) : "Never"}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Source toggles + Run Now */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Sources</p>
          {(
            [
              ["rightmoveEnabled", "RIGHTMOVE"],
              ["zooplaEnabled", "ZOOPLA"],
              ["onthemarketEnabled", "ONTHEMARKET"],
              ["primelocationEnabled", "PRIMELOCATION"],
            ] as const
          ).map(([field, source]) => (
            <div key={source} className="flex items-center justify-between">
              <span className="text-sm text-gray-600">{SOURCE_LABELS[source]}</span>
              <Switch
                checked={settings?.[field] ?? false}
                onCheckedChange={(checked) => patchSettings({ [field]: checked })}
                disabled={saving}
              />
            </div>
          ))}

          <div className="pt-2">
            <Button
              onClick={handleRunNow}
              disabled={triggering || !settings?.searchCriteria}
              className="w-full"
              title={!settings?.searchCriteria ? "Configure search criteria in Scraper Settings first" : undefined}
            >
              {triggering ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Now
                </>
              )}
            </Button>
            {!settings?.searchCriteria && (
              <p className="mt-1.5 text-center text-xs text-amber-600">
                Search criteria required —{" "}
                <Link
                  href="/dashboard/settings/scraper"
                  className="underline hover:text-amber-700"
                >
                  configure in Scraper Settings
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Job history table ─────────────────────────────────────────────────────────

function JobHistoryTable({ jobs }: { jobs: ScraperJob[] }) {
  if (jobs.length === 0) {
    return (
      <div className="ds-card py-12 text-center">
        <CalendarDays className="mx-auto h-8 w-8 text-gray-300 mb-3" />
        <p className="text-gray-400">No scraper jobs have run yet</p>
      </div>
    )
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Recent Jobs</h3>
        <span className="text-xs text-gray-400">{jobs.length} most recent</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Source</th>
              <th className="table-header">Status</th>
              <th className="table-header text-center">Found</th>
              <th className="table-header text-center">Processed</th>
              <th className="table-header text-center">Success</th>
              <th className="table-header text-center">Failed</th>
              <th className="table-header">Started</th>
              <th className="table-header text-right">Duration</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} className="table-row">
                <td className="table-cell font-medium text-sm">
                  {SOURCE_LABELS[job.source] ?? job.source}
                </td>
                <td className="table-cell">
                  <StatusBadge status={job.status} />
                </td>
                <td className="table-cell text-center text-sm">{job.totalFound}</td>
                <td className="table-cell text-center text-sm">{job.processed}</td>
                <td className="table-cell text-center text-sm text-emerald-600 font-medium">
                  {job.successful}
                </td>
                <td className="table-cell text-center text-sm text-red-500 font-medium">
                  {job.failed > 0 ? job.failed : "—"}
                </td>
                <td className="table-cell text-sm text-gray-500">
                  {job.startedAt
                    ? formatRelative(job.startedAt)
                    : formatRelative(job.createdAt)}
                </td>
                <td className="table-cell text-right text-sm text-gray-500">
                  {formatDuration(job.startedAt, job.completedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Placeholder future schedules ──────────────────────────────────────────────

function PlannedSchedulesCard() {
  const items = [
    { label: "Email Digest", description: "Daily summary email to investors", status: "planned" },
    { label: "Sourcing Alert Notifications", description: "Push alerts when new matching deals appear", status: "planned" },
    { label: "Report Generation", description: "Weekly performance reports", status: "planned" },
  ]

  return (
    <div className="ds-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-5 w-5 text-gray-400" />
        <div>
          <h2 className="text-base font-semibold">Planned Schedules</h2>
          <p className="text-xs text-gray-400">Coming soon</p>
        </div>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between rounded-lg border border-dashed border-gray-200 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium text-gray-500">{item.label}</p>
              <p className="text-xs text-gray-400">{item.description}</p>
            </div>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
              Planned
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function ScheduleManagement({
  initialSettings,
  initialSchedule,
  initialJobs,
}: ScheduleManagementProps) {
  const [settings, setSettings] = useState<ScraperSettings | null>(initialSettings)
  const [schedule, setSchedule] = useState<Schedule>(initialSchedule)
  const [jobs, setJobs] = useState<ScraperJob[]>(initialJobs)
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/scraper/settings")
      if (!res.ok) return
      const data = await res.json()
      if (data.schedule) setSchedule(data.schedule)
    } catch {
      // silently ignore
    }

    // Also refresh job list via a lightweight prisma-backed endpoint
    // We re-use the scraper settings endpoint which returns lastRun;
    // for the job list we'll rely on router.refresh or a dedicated fetch.
    // For now, trigger a page-level refresh of the job data via window reload
    // is avoided — instead we just update the schedule timing.
  }, [])

  // Auto-refresh when any job is RUNNING or QUEUED
  const hasActiveJobs = jobs.some(
    (j) => j.status === "RUNNING" || j.status === "QUEUED"
  )

  useEffect(() => {
    if (hasActiveJobs) {
      pollRef.current = setInterval(fetchJobs, 5000)
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [hasActiveJobs, fetchJobs])

  const handleJobsChanged = async () => {
    // Reload the page to get fresh job data from the server
    window.location.reload()
  }

  return (
    <div className="space-y-5">
      <ScraperScheduleCard
        settings={settings}
        schedule={schedule}
        onSettingsChanged={(s) => {
          setSettings(s)
          // Recompute nextRun client-side
          const nextRun = computeNextRunClient(s.scheduleType, s.enabled)
          setSchedule((prev) => ({ ...prev, nextRun }))
        }}
        onJobsChanged={handleJobsChanged}
      />

      <JobHistoryTable jobs={jobs} />

      <PlannedSchedulesCard />
    </div>
  )
}

// Client-side nextRun computation (mirrors server logic)
function computeNextRunClient(scheduleType: string, enabled: boolean): string | null {
  if (!enabled) return null
  const now = new Date()
  if (scheduleType === "TWICE_DAILY") {
    const a = new Date(now); a.setHours(6, 0, 0, 0)
    const b = new Date(now); b.setHours(18, 0, 0, 0)
    const c = new Date(now); c.setDate(c.getDate() + 1); c.setHours(6, 0, 0, 0)
    if (now < a) return a.toISOString()
    if (now < b) return b.toISOString()
    return c.toISOString()
  }
  if (scheduleType === "DAILY") {
    const a = new Date(now); a.setHours(6, 0, 0, 0)
    const b = new Date(now); b.setDate(b.getDate() + 1); b.setHours(6, 0, 0, 0)
    return now < a ? a.toISOString() : b.toISOString()
  }
  if (scheduleType === "HOURLY") {
    const next = new Date(now); next.setMinutes(0, 0, 0); next.setHours(next.getHours() + 1)
    return next.toISOString()
  }
  return null
}
