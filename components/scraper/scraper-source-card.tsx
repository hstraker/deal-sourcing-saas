"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Play, Loader2, Clock, CheckCircle2, XCircle } from "lucide-react"

type Source = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

interface RunningProgress {
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED"
  totalFound: number
  successful: number
  failed: number
}

interface ScraperSourceCardProps {
  source: Source
  label: string
  enabled: boolean
  lastJobAt: string | null
  lastJobCount: number | null
  isRunning: boolean
  progress?: RunningProgress
  onTrigger: () => void
  hasCriteria: boolean
}

const SOURCE_CONFIG: Record<
  Source,
  { border: string; dotIdle: string; dotRunning: string; button: string; countColor: string }
> = {
  RIGHTMOVE: {
    border: "border-blue-200 dark:border-blue-800",
    dotIdle: "bg-green-500",
    dotRunning: "bg-amber-400",
    button: "text-blue-600 border-blue-200 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30",
    countColor: "text-blue-700 dark:text-blue-400",
  },
  ZOOPLA: {
    border: "border-purple-200 dark:border-purple-800",
    dotIdle: "bg-green-500",
    dotRunning: "bg-amber-400",
    button: "text-purple-600 border-purple-200 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/30",
    countColor: "text-purple-700 dark:text-purple-400",
  },
  ONTHEMARKET: {
    border: "border-emerald-200 dark:border-emerald-800",
    dotIdle: "bg-green-500",
    dotRunning: "bg-amber-400",
    button: "text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:text-emerald-400 dark:border-emerald-800 dark:hover:bg-emerald-950/30",
    countColor: "text-emerald-700 dark:text-emerald-400",
  },
  PRIMELOCATION: {
    border: "border-orange-200 dark:border-orange-800",
    dotIdle: "bg-green-500",
    dotRunning: "bg-amber-400",
    button: "text-orange-600 border-orange-200 hover:bg-orange-50 dark:text-orange-400 dark:border-orange-800 dark:hover:bg-orange-950/30",
    countColor: "text-orange-700 dark:text-orange-400",
  },
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return "Never"
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return "Just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function ScraperSourceCard({
  source,
  label,
  enabled,
  lastJobAt,
  lastJobCount,
  isRunning,
  progress,
  onTrigger,
  hasCriteria,
}: ScraperSourceCardProps) {
  const cfg = SOURCE_CONFIG[source]

  // Compute relative time client-side only to avoid SSR hydration mismatch
  const [timeDisplay, setTimeDisplay] = useState<string>("")
  useEffect(() => {
    setTimeDisplay(relativeTime(lastJobAt))
    const id = setInterval(() => setTimeDisplay(relativeTime(lastJobAt)), 30_000)
    return () => clearInterval(id)
  }, [lastJobAt])

  const statusDot = (() => {
    if (!enabled) return "bg-gray-300 dark:bg-gray-600"
    if (progress?.status === "FAILED" || progress?.status === "CANCELLED") return "bg-red-500"
    if (isRunning) return cfg.dotRunning + " animate-pulse"
    return cfg.dotIdle
  })()

  const statusLabel = (() => {
    if (!enabled) return "Disabled"
    if (progress?.status === "QUEUED") return "Queued…"
    if (progress?.status === "RUNNING") return "Running"
    if (progress?.status === "FAILED") return "Failed"
    if (progress?.status === "CANCELLED") return "Cancelled"
    if (progress?.status === "COMPLETED") return "Done"
    return "Idle"
  })()

  const isDisabled = !enabled || isRunning || !hasCriteria

  return (
    <Card className={`border ${cfg.border} hover:shadow-sm transition-shadow`}>
      <CardContent className="p-4 space-y-3">
        {/* Header: name + status dot */}
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm">{label}</span>
          <div className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${statusDot}`} />
            <span className="text-[10px] text-gray-400">{statusLabel}</span>
          </div>
        </div>

        {/* Running progress */}
        {isRunning && progress && (
          <div className="text-xs text-gray-400 space-y-1">
            <div className="flex justify-between">
              <span>{progress.totalFound} found</span>
              <span className="text-green-600">{progress.successful} saved</span>
              {progress.failed > 0 && (
                <span className="text-red-500">{progress.failed} failed</span>
              )}
            </div>
          </div>
        )}

        {/* Completed summary */}
        {!isRunning && progress?.status === "COMPLETED" && (
          <div className="flex items-center gap-1 text-xs text-green-600">
            <CheckCircle2 className="h-3 w-3" />
            <span>{progress.totalFound} found · {progress.successful} saved</span>
          </div>
        )}

        {/* Failed/Cancelled */}
        {!isRunning && (progress?.status === "FAILED" || progress?.status === "CANCELLED") && (
          <div className="flex items-center gap-1 text-xs text-red-500">
            <XCircle className="h-3 w-3" />
            <span>{progress.status === "FAILED" ? "Scrape failed" : "Cancelled"}</span>
          </div>
        )}

        {/* Last job info (when not running and no active progress) */}
        {!progress && (
          <div className="flex items-center justify-between text-[11px] text-gray-400">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{timeDisplay}</span>
            </span>
            {lastJobCount !== null && lastJobCount > 0 && (
              <span className={`font-medium ${cfg.countColor}`}>
                {lastJobCount} found
              </span>
            )}
          </div>
        )}

        {/* Scrape Now button */}
        <Button
          variant="outline"
          size="sm"
          className={`w-full text-xs ${cfg.button}`}
          disabled={isDisabled}
          onClick={onTrigger}
        >
          {isRunning ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Play className="mr-1.5 h-3 w-3" />
          )}
          {isRunning ? "Scraping…" : "Scrape Now"}
        </Button>
      </CardContent>
    </Card>
  )
}
