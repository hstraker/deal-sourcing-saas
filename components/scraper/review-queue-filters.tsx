"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, X, Star } from "lucide-react"
import { useState } from "react"

export interface ReviewFilters {
  source: string | null
  category: string | null
  isAmbiguous: boolean | null
  minBmvScore: number | null
  favoritesOnly: boolean
}

interface ReviewQueueFiltersProps {
  filters: ReviewFilters
  onFiltersChange: (filters: ReviewFilters) => void
}

const defaultFilters: ReviewFilters = {
  source: null,
  category: null,
  isAmbiguous: null,
  minBmvScore: null,
  favoritesOnly: false,
}

export function ReviewQueueFilters({
  filters,
  onFiltersChange,
}: ReviewQueueFiltersProps) {
  const [showFilters, setShowFilters] = useState(false)

  const activeFilterCount = [
    filters.source,
    filters.category,
    filters.isAmbiguous,
    filters.minBmvScore,
    filters.favoritesOnly || null,
  ].filter((v) => v !== null && v !== false).length

  const handleClear = () => {
    onFiltersChange(defaultFilters)
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* Favourites quick-toggle — always visible */}
        <Button
          variant={filters.favoritesOnly ? "default" : "outline"}
          size="sm"
          onClick={() => onFiltersChange({ ...filters, favoritesOnly: !filters.favoritesOnly })}
          className={filters.favoritesOnly ? "bg-amber-500 hover:bg-amber-600 border-amber-500 text-white" : ""}
        >
          <Star className={`mr-1.5 h-3.5 w-3.5 ${filters.favoritesOnly ? "fill-white" : ""}`} />
          Favourites
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-2">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="mt-3 flex flex-wrap gap-3 rounded-lg border p-4">
          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Source
            </label>
            <Select
              value={filters.source || "all"}
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  source: v === "all" ? null : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                <SelectItem value="RIGHTMOVE">Rightmove</SelectItem>
                <SelectItem value="ZOOPLA">Zoopla</SelectItem>
                <SelectItem value="ONTHEMARKET">OnTheMarket</SelectItem>
                <SelectItem value="PRIMELOCATION">PrimeLocation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Category
            </label>
            <Select
              value={filters.category || "all"}
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  category: v === "all" ? null : v,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-40">
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Ambiguous
            </label>
            <Select
              value={
                filters.isAmbiguous === null
                  ? "all"
                  : filters.isAmbiguous
                    ? "yes"
                    : "no"
              }
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  isAmbiguous:
                    v === "all" ? null : v === "yes",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="yes">Ambiguous only</SelectItem>
                <SelectItem value="no">Non-ambiguous</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="w-32">
            <label className="mb-1 block text-xs font-medium text-gray-400">
              Min BMV Score
            </label>
            <Input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={filters.minBmvScore ?? ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  minBmvScore: e.target.value
                    ? parseInt(e.target.value)
                    : null,
                })
              }
            />
          </div>
        </div>
      )}
    </div>
  )
}
