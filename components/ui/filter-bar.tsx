"use client"

import * as React from "react"
import { useState, useRef, useEffect } from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface FilterOption {
  label: string
  options: string[]
}

interface FilterBarProps {
  filters: FilterOption[]
  onReset: () => void
  className?: string
}

function FilterDropdown({
  filter,
  onSelect,
}: {
  filter: FilterOption
  onSelect: (option: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleSelect = (option: string) => {
    const next = selected === option ? null : option
    setSelected(next)
    onSelect(next)
    setOpen(false)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
          selected
            ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB] font-medium"
            : "border-[var(--ds-border,#E5E7EB)] bg-white text-gray-600 hover:bg-gray-50"
        )}
      >
        <span>{selected ?? filter.label}</span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-[var(--ds-border,#E5E7EB)] bg-white shadow-dropdown">
          {filter.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => handleSelect(opt)}
              className={cn(
                "flex w-full items-center px-3 py-2 text-sm text-left transition-colors hover:bg-gray-50",
                selected === opt && "font-medium text-[#2563EB]"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function FilterBar({ filters, onReset, className }: FilterBarProps) {
  const [selections, setSelections] = useState<Record<string, string | null>>(
    () => Object.fromEntries(filters.map((f) => [f.label, null]))
  )

  const hasAnySelection = Object.values(selections).some(Boolean)

  const handleSelect = (label: string, value: string | null) => {
    setSelections((prev) => ({ ...prev, [label]: value }))
  }

  const handleReset = () => {
    setSelections(Object.fromEntries(filters.map((f) => [f.label, null])))
    onReset()
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {filters.map((filter) => (
        <FilterDropdown
          key={filter.label}
          filter={filter}
          onSelect={(val) => handleSelect(filter.label, val)}
        />
      ))}
      {hasAnySelection && (
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <X className="h-3.5 w-3.5" />
          Reset Filters
        </button>
      )}
    </div>
  )
}

export default FilterBar
