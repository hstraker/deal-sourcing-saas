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
  className?: string  // Tailwind colour classes e.g. "bg-blue-100 text-blue-700"
  tooltip?: string    // Optional tooltip text shown on hover
}

export function StatusBadge({ label, className, tooltip }: StatusBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
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
