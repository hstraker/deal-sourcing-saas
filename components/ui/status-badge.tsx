// components/ui/status-badge.tsx
"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StatusBadgeProps {
  label: string
  /** CSS variable key prefix, e.g. "status-deal-new" → reads --status-deal-new-bg + --status-deal-new-text */
  cssKey?: string
  /** Tailwind colour classes — used when cssKey is not provided */
  className?: string
  tooltip?: string
}

export function StatusBadge({ label, cssKey, className, tooltip }: StatusBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        !cssKey && className
      )}
      style={
        cssKey
          ? {
              backgroundColor: `var(--${cssKey}-bg)`,
              color: `var(--${cssKey}-text)`,
            }
          : undefined
      }
    >
      {label}
    </span>
  )

  if (!tooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
