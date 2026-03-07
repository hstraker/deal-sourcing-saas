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
    border: "border-blue-200",
    text: "text-blue-700",
    subtleBg: "bg-blue-50",
  },
  ZOOPLA: {
    bar: "bg-purple-500",
    dot: "bg-purple-500",
    border: "border-purple-200",
    text: "text-purple-700",
    subtleBg: "bg-purple-50",
  },
  ONTHEMARKET: {
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
    border: "border-emerald-200",
    text: "text-emerald-700",
    subtleBg: "bg-emerald-50",
  },
  PRIMELOCATION: {
    bar: "bg-orange-500",
    dot: "bg-orange-500",
    border: "border-orange-200",
    text: "text-orange-700",
    subtleBg: "bg-orange-50",
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
    border: "border-gray-200",
    text: "text-gray-700",
    subtleBg: "bg-gray-50",
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
              <span className="text-xs text-gray-400">
                {isQueued ? "queued — preparing to scan…" : "scanning properties…"}
              </span>
            </div>
          </div>

          {/* Right: stat chips + percentage */}
          {!isQueued && (
            <div className="flex items-center gap-1.5 text-xs flex-shrink-0">
              <span className="rounded-full bg-white/80 border border-[var(--ds-border)] px-2 py-0.5 font-medium tabular-nums">
                {job.totalFound} found
              </span>
              <span className="rounded-full bg-green-100 text-green-700 border border-green-200 px-2 py-0.5 font-medium tabular-nums">
                {job.successful} saved
              </span>
              {job.failed > 0 && (
                <span className="rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 font-medium tabular-nums">
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
        <div className="mt-2.5 h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
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
