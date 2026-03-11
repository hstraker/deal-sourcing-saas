// components/ui/metrics-date-filter.tsx
"use client"

import { useState, useEffect } from "react"
import { Calendar, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "ds_metrics_from_date"

interface MetricsDateFilterProps {
  onChange: (from: string | null) => void
}

export function MetricsDateFilter({ onChange }: MetricsDateFilterProps) {
  const [from, setFrom] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setFrom(stored)
    setMounted(true)
    onChange(stored)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (date: string) => {
    if (!date) { handleClear(); return }
    localStorage.setItem(STORAGE_KEY, date)
    setFrom(date)
    onChange(date)
  }

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setFrom(null)
    onChange(null)
  }

  if (!mounted) {
    return <div className="h-7 w-48 animate-pulse rounded-md bg-gray-100" />
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Metrics from:</span>
      <div className="relative flex items-center">
        <Calendar className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="h-7 rounded-md border border-[var(--ds-border)] bg-white pl-7 pr-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
        />
      </div>
      {from ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-7 px-2 text-xs text-gray-400 hover:text-gray-700"
        >
          <X className="mr-1 h-3 w-3" />
          All time
        </Button>
      ) : (
        <span className="text-xs text-gray-400 italic">All time</span>
      )}
    </div>
  )
}
