// components/ui/status-badge.tsx
"use client"

import type { LucideIcon } from "lucide-react"
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
  /** Optional Lucide icon to display before the label */
  icon?: LucideIcon
}

export function StatusBadge({ label, cssKey, className, tooltip, icon: Icon }: StatusBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
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
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
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
