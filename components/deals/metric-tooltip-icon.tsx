"use client"

import { Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { OFFER_TOOLTIPS, type MetricTooltip } from "@/lib/offer-engine/offer-tooltips"

interface MetricTooltipIconProps {
  tooltipKey: string
  /** Override tooltip data instead of looking up from OFFER_TOOLTIPS */
  override?: Partial<MetricTooltip>
  className?: string
}

export function MetricTooltipIcon({ tooltipKey, override, className }: MetricTooltipIconProps) {
  const base = OFFER_TOOLTIPS[tooltipKey]
  if (!base && !override) return null

  const tooltip: MetricTooltip = {
    term: override?.term ?? base?.term ?? tooltipKey,
    definition: override?.definition ?? base?.definition ?? "",
    calculation: override?.calculation ?? base?.calculation ?? "",
    whyItMatters: override?.whyItMatters ?? base?.whyItMatters ?? "",
    example: override?.example ?? base?.example,
    goodRange: override?.goodRange ?? base?.goodRange,
    negotiationTip: override?.negotiationTip ?? base?.negotiationTip,
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={`ml-1 cursor-help text-muted-foreground hover:text-foreground inline-flex items-center ${className ?? ""}`}
        >
          <Info className="h-3.5 w-3.5" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 space-y-1.5 z-50" side="top">
        <p className="font-semibold text-sm">{tooltip.term}</p>
        <p className="text-xs text-muted-foreground">{tooltip.definition}</p>
        {tooltip.calculation && (
          <div className="border-t pt-1.5">
            <p className="text-xs font-medium">How it&apos;s calculated:</p>
            <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap leading-relaxed">
              {tooltip.calculation}
            </p>
          </div>
        )}
        {tooltip.whyItMatters && (
          <div className="border-t pt-1.5">
            <p className="text-xs font-medium">Why it matters:</p>
            <p className="text-xs text-muted-foreground">{tooltip.whyItMatters}</p>
          </div>
        )}
        {tooltip.goodRange && (
          <div className="border-t pt-1.5">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Good range: {tooltip.goodRange}
            </p>
          </div>
        )}
        {tooltip.example && (
          <div className="border-t pt-1.5">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Example: {tooltip.example}
            </p>
          </div>
        )}
        {tooltip.negotiationTip && (
          <div className="border-t pt-1.5">
            <p className="text-xs font-medium">Negotiation tip:</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 italic">
              {tooltip.negotiationTip}
            </p>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
