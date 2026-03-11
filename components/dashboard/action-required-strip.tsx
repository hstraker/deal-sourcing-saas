// components/dashboard/action-required-strip.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface ActionItem {
  type: "deal" | "vendor"
  id: string
  label: string
  href: string
  action: string
}

interface ActionCounts {
  dealsCount: number
  vendorsCount: number
  items: ActionItem[]
}

export function ActionRequiredStrip() {
  const [data, setData] = useState<ActionCounts | null>(null)

  useEffect(() => {
    fetch("/api/action-counts")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        /* silently ignore */
      })
  }, [])

  if (!data || data.items.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        {data.items.length} action{data.items.length !== 1 ? "s" : ""} required
      </p>
      <div className="space-y-1.5">
        {data.items.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className="flex items-center justify-between gap-4 border-t border-amber-200 pt-1.5"
          >
            <p className="truncate text-sm text-amber-900">{item.label}</p>
            <Link
              href={item.href}
              className="shrink-0 rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
            >
              {item.action} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
