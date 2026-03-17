// components/ui/kpi-bar.tsx
"use client"

import type React from "react"
import { cn } from "@/lib/utils"

export interface KpiTile {
  label: string
  value: string            // pre-formatted display string e.g. "£240,000" or "18.4%"
  icon: React.ReactNode
  iconBgClass: string      // e.g. "bg-blue-50"
  valueColorClass?: string // e.g. "text-green-600" — defaults to "text-gray-900"
  tooltip?: string         // optional tooltip on the value
}

interface KpiBarProps {
  tiles: KpiTile[]
}

export function KpiBar({ tiles }: KpiBarProps) {
  return (
    <div className="flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {tiles.map((tile, i) => (
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
      ))}
    </div>
  )
}
