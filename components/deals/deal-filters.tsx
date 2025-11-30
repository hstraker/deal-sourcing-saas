"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Filter, X } from "lucide-react"
import type { DealWithRelations } from "@/types/deal"

export interface DealFilters {
  status: string | null
  propertyType: string | null
  assignedToId: string | null
  postcode: string | null
  minScore: number | null
  maxScore: number | null
  minBmv: number | null
  maxBmv: number | null
  minYield: number | null
  maxYield: number | null
}

interface DealFiltersProps {
  deals: DealWithRelations[]
  onFiltersChange: (filters: DealFilters) => void
  teamMembers?: Array<{
    id: string
    firstName: string | null
    lastName: string | null
  }>
}

const STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "review", label: "Review" },
  { value: "in_progress", label: "In Progress" },
  { value: "ready", label: "Ready" },
  { value: "listed", label: "Listed" },
  { value: "reserved", label: "Reserved" },
  { value: "sold", label: "Sold" },
  { value: "archived", label: "Archived" },
]

const PROPERTY_TYPE_OPTIONS = [
  { value: "terraced", label: "Terraced" },
  { value: "semi_detached", label: "Semi-Detached" },
  { value: "detached", label: "Detached" },
  { value: "flat", label: "Flat" },
  { value: "bungalow", label: "Bungalow" },
  { value: "other", label: "Other" },
]

export function DealFiltersComponent({
  deals,
  onFiltersChange,
  teamMembers = [],
}: DealFiltersProps) {
  const [filters, setFilters] = useState<DealFilters>({
    status: null,
    propertyType: null,
    assignedToId: null,
    postcode: null,
    minScore: null,
    maxScore: null,
    minBmv: null,
    maxBmv: null,
    minYield: null,
    maxYield: null,
  })

  const [isOpen, setIsOpen] = useState(false)

  // Extract unique postcodes from deals
  const uniquePostcodes = Array.from(
    new Set(
      deals
        .map((deal) => deal.postcode)
        .filter((postcode): postcode is string => !!postcode)
    )
  ).sort()

  const handleFilterChange = <K extends keyof DealFilters>(
    key: K,
    value: DealFilters[K]
  ) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const handleClearFilters = () => {
    const emptyFilters: DealFilters = {
      status: null,
      propertyType: null,
      assignedToId: null,
      postcode: null,
      minScore: null,
      maxScore: null,
      minBmv: null,
      maxBmv: null,
      minYield: null,
      maxYield: null,
    }
    setFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const activeFiltersCount = Object.values(filters).filter(
    (value) => value !== null && value !== ""
  ).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          variant={isOpen ? "default" : "outline"}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <span className="ml-1 rounded-full bg-primary-foreground px-1.5 py-0.5 text-xs text-primary">
              {activeFiltersCount}
            </span>
          )}
        </Button>
        {activeFiltersCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {isOpen && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filter Deals</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={filters.status || undefined}
                  onValueChange={(value) =>
                    handleFilterChange("status", value || null)
                  }
                >
                  <SelectTrigger id="status">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Property Type Filter */}
              <div className="space-y-2">
                <Label htmlFor="propertyType">Property Type</Label>
                <Select
                  value={filters.propertyType || undefined}
                  onValueChange={(value) =>
                    handleFilterChange("propertyType", value || null)
                  }
                >
                  <SelectTrigger id="propertyType">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Assigned To Filter */}
              {teamMembers.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="assignedTo">Assigned To</Label>
                  <Select
                    value={filters.assignedToId || undefined}
                    onValueChange={(value) =>
                      handleFilterChange("assignedToId", value || null)
                    }
                  >
                    <SelectTrigger id="assignedTo">
                      <SelectValue placeholder="All Users" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {teamMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.firstName} {member.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Postcode Filter */}
              {uniquePostcodes.length > 0 && (
                <div className="space-y-2">
                  <Label htmlFor="postcode">Postcode</Label>
                  <Select
                    value={filters.postcode || undefined}
                    onValueChange={(value) =>
                      handleFilterChange("postcode", value || null)
                    }
                  >
                    <SelectTrigger id="postcode">
                      <SelectValue placeholder="All Postcodes" />
                    </SelectTrigger>
                    <SelectContent>
                      {uniquePostcodes.map((postcode) => (
                        <SelectItem key={postcode} value={postcode}>
                          {postcode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Deal Score Range */}
              <div className="space-y-2">
                <Label htmlFor="minScore">Deal Score (Min)</Label>
                <Input
                  id="minScore"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={filters.minScore ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "minScore",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxScore">Deal Score (Max)</Label>
                <Input
                  id="maxScore"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="100"
                  value={filters.maxScore ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "maxScore",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>

              {/* BMV% Range */}
              <div className="space-y-2">
                <Label htmlFor="minBmv">BMV% (Min)</Label>
                <Input
                  id="minBmv"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="0"
                  value={filters.minBmv ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "minBmv",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxBmv">BMV% (Max)</Label>
                <Input
                  id="maxBmv"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  placeholder="100"
                  value={filters.maxBmv ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "maxBmv",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>

              {/* Yield Range */}
              <div className="space-y-2">
                <Label htmlFor="minYield">Gross Yield % (Min)</Label>
                <Input
                  id="minYield"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="0"
                  value={filters.minYield ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "minYield",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxYield">Gross Yield % (Max)</Label>
                <Input
                  id="maxYield"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  placeholder="50"
                  value={filters.maxYield ?? ""}
                  onChange={(e) =>
                    handleFilterChange(
                      "maxYield",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

