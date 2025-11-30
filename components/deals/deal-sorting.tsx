"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { ArrowUpDown } from "lucide-react"

export type SortField =
  | "createdAt"
  | "updatedAt"
  | "dealScore"
  | "askingPrice"
  | "marketValue"
  | "bmvPercentage"
  | "grossYield"
  | "address"
  | "status"

export type SortDirection = "asc" | "desc"

export interface SortConfig {
  field: SortField
  direction: SortDirection
}

interface DealSortingProps {
  sortConfig: SortConfig
  onSortChange: (sortConfig: SortConfig) => void
}

const SORT_OPTIONS: Array<{ value: SortField; label: string }> = [
  { value: "createdAt", label: "Date Created" },
  { value: "updatedAt", label: "Last Updated" },
  { value: "dealScore", label: "Deal Score" },
  { value: "askingPrice", label: "Asking Price" },
  { value: "marketValue", label: "Market Value" },
  { value: "bmvPercentage", label: "BMV %" },
  { value: "grossYield", label: "Gross Yield" },
  { value: "address", label: "Address" },
  { value: "status", label: "Status" },
]

export function DealSorting({ sortConfig, onSortChange }: DealSortingProps) {
  const handleFieldChange = (field: SortField) => {
    onSortChange({ ...sortConfig, field })
  }

  const handleDirectionToggle = () => {
    onSortChange({
      ...sortConfig,
      direction: sortConfig.direction === "asc" ? "desc" : "asc",
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort-field" className="text-sm text-muted-foreground">
        Sort by:
      </Label>
      <Select value={sortConfig.field} onValueChange={handleFieldChange}>
        <SelectTrigger id="sort-field" className="w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {SORT_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <button
        onClick={handleDirectionToggle}
        className="rounded-md border border-input bg-background p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        aria-label={`Sort ${sortConfig.direction === "asc" ? "descending" : "ascending"}`}
      >
        <ArrowUpDown
          className={`h-4 w-4 transition-transform ${
            sortConfig.direction === "desc" ? "rotate-180" : ""
          }`}
        />
      </button>
    </div>
  )
}

