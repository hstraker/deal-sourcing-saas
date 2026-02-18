"use client"

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

const SOURCE_STYLE: Record<string, { bar: string; dot: string; border: string; text: string; subtleBg: string }> = {
  RIGHTMOVE: {
    bar: "bg-blue-500",
    dot: "bg-blue-500",
    border: "border-blue-200 dark:border-blue-800",
    text: "text-blue-700 dark:text-blue-400",
    subtleBg: "bg-blue-50 dark:bg-blue-950/20",
  },
  ZOOPLA: {
    bar: "bg-purple-500",
    dot: "bg-purple-500",
    border: "border-purple-200 dark:border-purple-800",
    text: "text-purple-700 dark:text-purple-400",
    subtleBg: "bg-purple-50 dark:bg-purple-950/20",
  },
  ONTHEMARKET: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    border: "border-emerald-200 dark:border-emerald-800",
    text: "text-emerald-700 dark:text-emerald-400",
    subtleBg: "bg-emerald-50 dark:bg-emerald-950/20",
  },
  PRIMELOCATION: {
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    border: "border-orange-200 dark:border-orange-800",
    text: "text-orange-700 dark:text-orange-400",
    subtleBg: "bg-orange-50 dark:bg-orange-950/20",
  },
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

export function ScraperLiveProgress({ job }: ScraperLiveProgressProps) {
  const style = SOURCE_STYLE[job.source] ?? {
    bar: "bg-gray-500",
    dot: "bg-gray-500",
    border: "border-gray-200 dark:border-gray-700",
    text: "text-gray-700 dark:text-gray-400",
    subtleBg: "bg-gray-50 dark:bg-gray-900/20",
  }
  const sourceLabel = SOURCE_LABELS[job.source] ?? job.source
  const isQueued = job.status === "QUEUED"
  const progressPct =
    job.totalFound > 0 ? Math.min(100, Math.round((job.successful / job.totalFound) * 100)) : 0

  return (
    <div className={`rounded-xl border ${style.border} ${style.subtleBg} overflow-hidden`}>
      <div className="px-4 pt-3 pb-2.5">
        {/* Header row */}
        <div className="flex items-center justify-between gap-4">
          {/* Left: pulsing dot + source + status text */}
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-50 ${style.dot}`}
              />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${style.dot}`} />
            </span>
            <div className="min-w-0 flex items-baseline gap-1.5 flex-wrap">
              <span className={`font-semibold text-sm ${style.text}`}>{sourceLabel}</span>
              <span className="text-xs text-muted-foreground">
                {isQueued ? "queued — preparing to scan…" : "scanning properties…"}
              </span>
            </div>
          </div>

          {/* Right: stat chips + percentage */}
          {!isQueued && (
            <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
              <span className="rounded-full bg-background/80 border border-border px-2 py-0.5 font-medium tabular-nums">
                {job.totalFound} found
              </span>
              <span className="rounded-full bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 px-2 py-0.5 font-medium tabular-nums">
                {job.successful} saved
              </span>
              {job.failed > 0 && (
                <span className="rounded-full bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800 px-2 py-0.5 font-medium tabular-nums">
                  {job.failed} failed
                </span>
              )}
              {progressPct > 0 && (
                <span className={`font-bold tabular-nums ml-0.5 ${style.text}`}>
                  {progressPct}%
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          {isQueued || job.totalFound === 0 ? (
            /* Indeterminate pulse for queued / not-yet-found state */
            <div
              className={`h-full w-2/5 rounded-full animate-pulse ${style.bar} opacity-70`}
            />
          ) : (
            /* Determinate fill once we have totals */
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${style.bar}`}
              style={{ width: `${progressPct}%` }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
