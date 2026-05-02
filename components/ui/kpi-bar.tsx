// components/ui/kpi-bar.tsx
"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export interface KpiTile {
  label: string
  value: string            // pre-formatted display string e.g. "£240,000" or "18.4%"
  icon: React.ReactNode
  iconBgClass: string      // e.g. "bg-blue-50"
  valueColorClass?: string // e.g. "text-green-600" — defaults to "text-gray-900"
  tooltip?: string
}

interface KpiBarProps {
  tiles: KpiTile[]
}

export function KpiBar({ tiles }: KpiBarProps) {
  return (
    <div className="flex flex-col sm:flex-row items-stretch divide-y sm:divide-y-0 sm:divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {tiles.map((tile, i) => {
        const tileEl = (
          <div key={i} className="flex flex-1 items-center gap-3 px-5 py-4">
            <div
              className={cn(
                "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
                tile.iconBgClass
              )}
            >
              {tile.icon}
            </div>
            <div>
              <p
                className={cn(
                  "font-mono text-xl font-bold",
                  tile.valueColorClass ?? "text-gray-900"
                )}
              >
                {tile.value}
              </p>
              <p className="text-xs text-gray-500">{tile.label}</p>
            </div>
          </div>
        )

        return tile.tooltip ? (
          <TooltipProvider key={i}>
            <Tooltip>
              <TooltipTrigger asChild>{tileEl}</TooltipTrigger>
              <TooltipContent className="max-w-[220px] text-center">{tile.tooltip}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : tileEl
      })}
    </div>
  )
}
