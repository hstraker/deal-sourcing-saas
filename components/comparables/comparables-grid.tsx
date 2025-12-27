"use client"

import { useState, useMemo } from "react"
import { ComparablePropertyCard, ComparableProperty } from "./comparable-property-card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Search, SlidersHorizontal, X, ArrowUpDown } from "lucide-react"

interface ComparablesGridProps {
  comparables: ComparableProperty[]
  showRentalData?: boolean
  isLoading?: boolean
  emptyMessage?: string
  highlightAverage?: boolean
}

type SortOption = "distance" | "price-asc" | "price-desc" | "yield-desc" | "yield-asc" | "date-desc" | "date-asc"

/**
 * ComparablesGrid Component
 * Displays a grid of comparable properties with sorting, filtering, and search
 */
export function ComparablesGrid({
  comparables,
  showRentalData = true,
  isLoading = false,
  emptyMessage = "No comparable properties found",
  highlightAverage = true,
}: ComparablesGridProps) {
  // Calculate average market value
  const avgMarketValue = useMemo(() => {
    if (comparables.length === 0) return undefined
    const sum = comparables.reduce((acc, comp) => acc + comp.salePrice, 0)
    return Math.round(sum / comparables.length)
  }, [comparables])

  // State
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("distance")
  const [filterPropertyType, setFilterPropertyType] = useState<string>("all")
  const [filterMinYield, setFilterMinYield] = useState<string>("all")
  const [filterMinPrice, setFilterMinPrice] = useState<string>("")
  const [filterMaxPrice, setFilterMaxPrice] = useState<string>("")
  const [showFilters, setShowFilters] = useState(false)

  // Extract unique property types
  const propertyTypes = useMemo(() => {
    const types = new Set<string>()
    comparables.forEach((comp) => {
      if (comp.propertyType) {
        types.add(comp.propertyType)
      }
    })
    return Array.from(types).sort()
  }, [comparables])

  // Filter and sort comparables
  const filteredAndSortedComparables = useMemo(() => {
    let filtered = [...comparables]

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (comp) =>
          comp.address.toLowerCase().includes(query) ||
          comp.postcode?.toLowerCase().includes(query) ||
          comp.propertyType?.toLowerCase().includes(query)
      )
    }

    // Property type filter
    if (filterPropertyType !== "all") {
      filtered = filtered.filter((comp) => comp.propertyType === filterPropertyType)
    }

    // Minimum yield filter
    if (filterMinYield !== "all") {
      const minYield = parseFloat(filterMinYield)
      filtered = filtered.filter((comp) => comp.rentalYield !== undefined && comp.rentalYield >= minYield)
    }

    // Price range filter
    if (filterMinPrice) {
      const minPrice = parseFloat(filterMinPrice)
      filtered = filtered.filter((comp) => comp.salePrice >= minPrice)
    }
    if (filterMaxPrice) {
      const maxPrice = parseFloat(filterMaxPrice)
      filtered = filtered.filter((comp) => comp.salePrice <= maxPrice)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "distance":
          return (a.distance ?? 999) - (b.distance ?? 999)
        case "price-asc":
          return a.salePrice - b.salePrice
        case "price-desc":
          return b.salePrice - a.salePrice
        case "yield-desc":
          return (b.rentalYield ?? 0) - (a.rentalYield ?? 0)
        case "yield-asc":
          return (a.rentalYield ?? 0) - (b.rentalYield ?? 0)
        case "date-desc":
          return new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
        case "date-asc":
          return new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [comparables, searchQuery, sortBy, filterPropertyType, filterMinYield, filterMinPrice, filterMaxPrice])

  // Clear filters
  const clearFilters = () => {
    setSearchQuery("")
    setFilterPropertyType("all")
    setFilterMinYield("all")
    setFilterMinPrice("")
    setFilterMaxPrice("")
  }

  // Active filters count
  const activeFiltersCount = [
    searchQuery,
    filterPropertyType !== "all",
    filterMinYield !== "all",
    filterMinPrice,
    filterMaxPrice,
  ].filter(Boolean).length

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 bg-muted animate-pulse rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by address, postcode, or property type..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[180px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="distance">Distance (near)</SelectItem>
              <SelectItem value="price-asc">Price (low-high)</SelectItem>
              <SelectItem value="price-desc">Price (high-low)</SelectItem>
              <SelectItem value="yield-desc">Yield (high-low)</SelectItem>
              <SelectItem value="yield-asc">Yield (low-high)</SelectItem>
              <SelectItem value="date-desc">Date (newest)</SelectItem>
              <SelectItem value="date-asc">Date (oldest)</SelectItem>
            </SelectContent>
          </Select>

          {/* Filters Toggle */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowFilters(!showFilters)}
            className={activeFiltersCount > 0 ? "border-primary" : ""}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {activeFiltersCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </Button>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Filters</h3>
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-3 w-3 mr-1" />
                  Clear all
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Property Type */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Property Type</label>
                <Select value={filterPropertyType} onValueChange={setFilterPropertyType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {propertyTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Minimum Yield */}
              {showRentalData && (
                <div>
                  <label className="text-xs font-medium mb-1.5 block">Minimum Yield</label>
                  <Select value={filterMinYield} onValueChange={setFilterMinYield}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any Yield</SelectItem>
                      <SelectItem value="4">4%+</SelectItem>
                      <SelectItem value="5">5%+</SelectItem>
                      <SelectItem value="6">6%+</SelectItem>
                      <SelectItem value="7">7%+</SelectItem>
                      <SelectItem value="8">8%+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Min Price */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Min Price (£)</label>
                <Input
                  type="number"
                  placeholder="e.g., 150000"
                  value={filterMinPrice}
                  onChange={(e) => setFilterMinPrice(e.target.value)}
                />
              </div>

              {/* Max Price */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Max Price (£)</label>
                <Input
                  type="number"
                  placeholder="e.g., 300000"
                  value={filterMaxPrice}
                  onChange={(e) => setFilterMaxPrice(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div>
          Showing {filteredAndSortedComparables.length} of {comparables.length} properties
        </div>
        {activeFiltersCount > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">{activeFiltersCount} filter{activeFiltersCount > 1 ? "s" : ""} active</Badge>
          </div>
        )}
      </div>

      {/* Grid */}
      {filteredAndSortedComparables.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground mb-2">{emptyMessage}</div>
          {activeFiltersCount > 0 && (
            <Button variant="outline" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAndSortedComparables.map((comparable) => (
            <ComparablePropertyCard
              key={comparable.id}
              property={comparable}
              showRentalData={showRentalData}
              avgMarketValue={avgMarketValue}
              highlightIfAverage={highlightAverage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
