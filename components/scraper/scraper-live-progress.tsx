"use client"

import { Loader2 } from "lucide-react"

type Source = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

interface LiveProgressJob {
  jobId: string
  source: string
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  totalFound: number
  successful: number
  failed: number
}

interface ScraperLiveProgressProps {
  job: LiveProgressJob
}

const SOURCE_ACCENT: Record<string, string> = {
  RIGHTMOVE: "bg-blue-500",
  ZOOPLA: "bg-purple-500",
  ONTHEMARKET: "bg-emerald-500",
  PRIMELOCATION: "bg-orange-500",
}

const SOURCE_BANNER: Record<string, string> = {
  RIGHTMOVE: "bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200",
  ZOOPLA: "bg-purple-50 border-purple-200 text-purple-900 dark:bg-purple-950/30 dark:border-purple-800 dark:text-purple-200",
  ONTHEMARKET: "bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200",
  PRIMELOCATION: "bg-orange-50 border-orange-200 text-orange-900 dark:bg-orange-950/30 dark:border-orange-800 dark:text-orange-200",
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

export function ScraperLiveProgress({ job }: ScraperLiveProgressProps) {
  const progressPct =
    job.totalFound > 0 ? Math.min(100, Math.round((job.successful / job.totalFound) * 100)) : 0
  const accentColor = SOURCE_ACCENT[job.source] || "bg-gray-500"
  const bannerClass = SOURCE_BANNER[job.source] || "bg-gray-50 border-gray-200 text-gray-900"
  const sourceLabel = SOURCE_LABELS[job.source] || job.source
  const isQueued = job.status === "QUEUED"

  return (
    <div className={`rounded-lg border px-4 py-3 ${bannerClass}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Left: spinner + label */}
        <div className="flex items-center gap-2 min-w-0">
          <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
          <span className="font-medium text-sm truncate">
            {isQueued ? `${sourceLabel} — queued…` : `${sourceLabel} — running`}
          </span>
        </div>

        {/* Right: counts */}
        {!isQueued && (
          <div className="flex items-center gap-4 text-xs flex-shrink-0">
            <span>
              <span className="font-semibold">{job.totalFound}</span> found
            </span>
            <span className="text-green-700 dark:text-green-400">
              <span className="font-semibold">{job.successful}</span> saved
            </span>
            {job.failed > 0 && (
              <span className="text-red-600 dark:text-red-400">
                <span className="font-semibold">{job.failed}</span> failed
              </span>
            )}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {!isQueued && job.totalFound > 0 && (
        <div className="mt-2 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${accentColor}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}
    </div>
  )
}
