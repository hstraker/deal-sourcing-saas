"use client"
import { toast } from "sonner"

/**
 * PortalCheckBadge — compact risk badge for Kanban cards and list views.
 * Shows a coloured chip with an emoji + label, plus a 🧪 indicator for mock data.
 */

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Loader2, RefreshCw } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

type Risk = "clear" | "caution" | "red_flag" | "pending" | "running" | null | undefined

interface PortalCheckBadgeProps {
  risk: Risk
  isMockData?: boolean
  leadId?: string
  /** If provided, clicking "Re-run" will call this instead of the default API */
  onRerun?: () => void
  className?: string
  /** Set to true if you want to show a clickable re-run trigger */
  showRerun?: boolean
}

const RISK_CONFIG: Record<NonNullable<Exclude<Risk, null | undefined>>, { label: string; emoji: string; variant: string; tooltip: string }> = {
  clear:    { label: "Clear",    emoji: "✅", variant: "bg-green-100 text-green-800 border-green-200", tooltip: "No portal listing issues found" },
  caution:  { label: "Caution",  emoji: "⚠️", variant: "bg-amber-100 text-amber-800 border-amber-200",  tooltip: "Amber flags detected — review before proceeding" },
  red_flag: { label: "Red Flag", emoji: "🚨", variant: "bg-red-100 text-red-800 border-red-200",             tooltip: "Red flags detected — verify before proceeding" },
  pending:  { label: "Checking", emoji: "⏳", variant: "bg-gray-100 text-gray-600 border-gray-200",            tooltip: "Portal check in progress…" },
  running:  { label: "Checking", emoji: "⏳", variant: "bg-gray-100 text-gray-600 border-gray-200",            tooltip: "Portal check in progress…" },
}

export function PortalCheckBadge({
  risk,
  isMockData,
  leadId,
  onRerun,
  className,
  showRerun = false,
}: PortalCheckBadgeProps) {
  const [isRerunning, setIsRerunning] = useState(false)

  if (!risk) {
    // Never checked — show a neutral "Not checked" badge
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
              "bg-gray-50 text-gray-400 border-gray-200",
              className
            )}>
              — Not checked
            </span>
          </TooltipTrigger>
          <TooltipContent>Portal check has not been run yet</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  const config = RISK_CONFIG[risk]

  const handleRerun = async () => {
    if (onRerun) { onRerun(); return }
    if (!leadId) return
    setIsRerunning(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/run-check`, { method: "POST" })
      const data = await res.json()
      if (res.ok) {
        toast.success("Check complete", { description: `Risk: ${data.overallRisk?.replace("_", " ")}` })
        // Caller should refresh the lead data
      } else {
        toast.error("Check failed", { description: data.error })
      }
    } catch {
      toast.error("Check failed", { description: "Network error" })
    } finally {
      setIsRerunning(false)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium cursor-default",
            config.variant,
            className
          )}>
            <span>{config.emoji}</span>
            <span>{config.label}</span>
            {isMockData && <span title="Mock data">🧪</span>}
            {showRerun && leadId && (
              <button
                onClick={(e) => { e.stopPropagation(); handleRerun() }}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                disabled={isRerunning}
                aria-label="Re-run check"
              >
                {isRerunning
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />
                }
              </button>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent>{config.tooltip}{isMockData ? " (mock data)" : ""}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
