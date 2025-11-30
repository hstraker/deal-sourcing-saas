"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { LayoutGrid, List, Table as TableIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { DealSearch } from "@/components/deals/deal-search"
import { DealCardSections } from "@/components/deals/deal-card-sections"
import {
  DealFiltersComponent,
  type DealFilters,
} from "@/components/deals/deal-filters"
import { DealPagination } from "@/components/deals/deal-pagination"
import {
  DealSorting,
  type SortConfig,
} from "@/components/deals/deal-sorting"
import type { DealWithRelations } from "@/types/deal"

type ViewMode = "cards" | "list" | "table"

interface DealListProps {
  deals: DealWithRelations[]
  teamMembers?: Array<{
    id: string
    firstName: string | null
    lastName: string | null
  }>
}

const ITEMS_PER_PAGE = 12

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    new: "bg-gray-100 text-gray-800",
    review: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    ready: "bg-purple-100 text-purple-800",
    listed: "bg-green-100 text-green-800",
    reserved: "bg-orange-100 text-orange-800",
    sold: "bg-success/20 text-success",
    archived: "bg-gray-200 text-gray-600",
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}

const formatStatus = (status: string) => {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

const formatCurrency = (amount: number | null | undefined) => {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function DealList({ deals, teamMembers = [] }: DealListProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("cards")
  const [searchQuery, setSearchQuery] = useState("")
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
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    field: "createdAt",
    direction: "desc",
  })
  const [currentPage, setCurrentPage] = useState(1)

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("deal-view-mode") as ViewMode | null
    if (saved && ["cards", "list", "table"].includes(saved)) {
      setViewMode(saved)
    }
  }, [])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchQuery])

  // Apply search
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) {
      return deals
    }

    const query = searchQuery.toLowerCase().trim()
    return deals.filter((deal) => {
      const addressMatch = deal.address.toLowerCase().includes(query)
      const postcodeMatch = deal.postcode?.toLowerCase().includes(query)
      const priceMatch = deal.askingPrice.toString().includes(query)
      return addressMatch || postcodeMatch || priceMatch
    })
  }, [deals, searchQuery])

  // Apply filters
  const filteredDeals = useMemo(() => {
    return searchFiltered.filter((deal) => {
      // Status filter
      if (filters.status && deal.status !== filters.status) {
        return false
      }

      // Property type filter
      if (filters.propertyType && deal.propertyType !== filters.propertyType) {
        return false
      }

      // Assigned to filter
      if (filters.assignedToId) {
        if (filters.assignedToId === "unassigned") {
          if (deal.assignedToId !== null) return false
        } else {
          if (deal.assignedToId !== filters.assignedToId) return false
        }
      }

      // Postcode filter
      if (filters.postcode && deal.postcode !== filters.postcode) {
        return false
      }

      // Deal score range
      if (filters.minScore !== null && (deal.dealScore === null || deal.dealScore < filters.minScore)) {
        return false
      }
      if (filters.maxScore !== null && (deal.dealScore === null || deal.dealScore > filters.maxScore)) {
        return false
      }

      // BMV% range
      if (filters.minBmv !== null && (deal.bmvPercentage === null || Number(deal.bmvPercentage) < filters.minBmv)) {
        return false
      }
      if (filters.maxBmv !== null && (deal.bmvPercentage === null || Number(deal.bmvPercentage) > filters.maxBmv)) {
        return false
      }

      // Yield range
      if (filters.minYield !== null && (deal.grossYield === null || Number(deal.grossYield) < filters.minYield)) {
        return false
      }
      if (filters.maxYield !== null && (deal.grossYield === null || Number(deal.grossYield) > filters.maxYield)) {
        return false
      }

      return true
    })
  }, [searchFiltered, filters])

  // Apply sorting
  const sortedDeals = useMemo(() => {
    const sorted = [...filteredDeals].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortConfig.field) {
        case "createdAt":
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        case "updatedAt":
          aValue = new Date(a.updatedAt).getTime()
          bValue = new Date(b.updatedAt).getTime()
          break
        case "dealScore":
          aValue = a.dealScore ?? 0
          bValue = b.dealScore ?? 0
          break
        case "askingPrice":
          aValue = Number(a.askingPrice)
          bValue = Number(b.askingPrice)
          break
        case "marketValue":
          aValue = a.marketValue ? Number(a.marketValue) : 0
          bValue = b.marketValue ? Number(b.marketValue) : 0
          break
        case "bmvPercentage":
          aValue = a.bmvPercentage ? Number(a.bmvPercentage) : 0
          bValue = b.bmvPercentage ? Number(b.bmvPercentage) : 0
          break
        case "grossYield":
          aValue = a.grossYield ? Number(a.grossYield) : 0
          bValue = b.grossYield ? Number(b.grossYield) : 0
          break
        case "address":
          aValue = a.address.toLowerCase()
          bValue = b.address.toLowerCase()
          break
        case "status":
          aValue = a.status
          bValue = b.status
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sortConfig.direction === "asc" ? -1 : 1
      }
      if (aValue > bValue) {
        return sortConfig.direction === "asc" ? 1 : -1
      }
      return 0
    })

    return sorted
  }, [filteredDeals, sortConfig])

  // Apply pagination
  const totalPages = Math.ceil(sortedDeals.length / ITEMS_PER_PAGE)
  const paginatedDeals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    const endIndex = startIndex + ITEMS_PER_PAGE
    return sortedDeals.slice(startIndex, endIndex)
  }, [sortedDeals, currentPage])

  // Save view preference to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("deal-view-mode", mode)
  }

  // Handle search - we need to extract search query from DealSearch component
  // For now, we'll create a custom search handler
  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  if (deals.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground mb-4">No deals found</p>
          <Link href="/dashboard/deals/new">
            <Button>Create Your First Deal</Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search, Filters, Sorting, and View Toggle */}
      <div className="space-y-4">
        {/* Search Bar and View Toggle */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <DealSearch
              deals={deals}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchChange}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border p-1">
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("cards")}
              className="h-8 w-8 p-0"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("list")}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => handleViewChange("table")}
              className="h-8 w-8 p-0"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters and Sorting */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <DealFiltersComponent
            deals={deals}
            onFiltersChange={setFilters}
            teamMembers={teamMembers}
          />
          <DealSorting sortConfig={sortConfig} onSortChange={setSortConfig} />
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-muted-foreground">
        {sortedDeals.length === filteredDeals.length ? (
          <>
            Showing {sortedDeals.length} of {deals.length} deals
            {sortedDeals.length !== deals.length && (
              <span> (filtered from {deals.length} total)</span>
            )}
          </>
        ) : (
          <>
            Showing {sortedDeals.length} deals
            {filteredDeals.length < deals.length && (
              <span> (filtered from {deals.length} total)</span>
            )}
          </>
        )}
      </div>

      {/* Render based on view mode */}
      {paginatedDeals.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No deals match your search or filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {viewMode === "cards" && <CardView deals={paginatedDeals} />}
          {viewMode === "list" && <ListView deals={paginatedDeals} />}
          {viewMode === "table" && <TableView deals={paginatedDeals} />}

          {/* Pagination */}
          {totalPages > 1 && (
            <DealPagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={sortedDeals.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </>
      )}
    </div>
  )
}

// Card View (existing grid layout)
function CardView({ deals }: DealListProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} />
      ))}
    </div>
  )
}

// List View (horizontal compact cards)
function ListView({ deals }: DealListProps) {
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <Link key={deal.id} href={`/dashboard/deals/${deal.id}`}>
          <Card className="cursor-pointer transition-shadow hover:shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {/* Left: Address & Status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold truncate">{deal.address}</h3>
                    {deal.postcode && (
                      <span className="text-sm text-muted-foreground">
                        {deal.postcode}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(deal.status)}`}
                    >
                      {formatStatus(deal.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {deal.bedrooms && <span>{deal.bedrooms} beds</span>}
                    {deal.bathrooms && <span>{deal.bathrooms} baths</span>}
                    {deal.propertyType && (
                      <span className="capitalize">{deal.propertyType}</span>
                    )}
                    {deal.assignedTo && (
                      <span>
                        {deal.assignedTo.firstName} {deal.assignedTo.lastName}
                      </span>
                    )}
                  </div>
                </div>

                {/* Center: Pricing */}
                <div className="text-right min-w-[140px]">
                  <div className="font-bold">{formatCurrency(deal.askingPrice)}</div>
                  {deal.marketValue && (
                    <div className="text-sm text-muted-foreground">
                      MV: {formatCurrency(deal.marketValue)}
                    </div>
                  )}
                </div>

                {/* Right: Key Metrics */}
                <div className="flex items-center gap-6 min-w-[200px]">
                  {deal.dealScore !== null && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Score</div>
                      <div
                        className={`font-bold ${deal.dealScore >= 70 ? "text-success" : "text-muted-foreground"}`}
                      >
                        {deal.dealScore}/100
                      </div>
                    </div>
                  )}
                  {deal.bmvPercentage !== null && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">BMV</div>
                      <div className="font-bold text-success">
                        {Number(deal.bmvPercentage).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {deal.grossYield !== null && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">Yield</div>
                      <div className="font-bold">
                        {Number(deal.grossYield).toFixed(1)}%
                      </div>
                    </div>
                  )}
                  {deal.roi !== null && (
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground">ROI</div>
                      <div className="font-bold text-primary">
                        {Number(deal.roi).toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}

// Table View (traditional table)
function TableView({ deals }: DealListProps) {
  return (
    <div className="rounded-md border">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Address
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Status
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                Asking Price
              </th>
              <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">
                Market Value
              </th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                Score
              </th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                BMV%
              </th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                Yield
              </th>
              <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">
                ROI
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Assigned To
              </th>
              <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">
                Created
              </th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
              >
                <td className="p-4 align-middle">
                  <Link
                    href={`/dashboard/deals/${deal.id}`}
                    className="font-medium hover:underline"
                  >
                    {deal.address}
                  </Link>
                  {deal.postcode && (
                    <div className="text-sm text-muted-foreground">
                      {deal.postcode}
                    </div>
                  )}
                </td>
                <td className="p-4 align-middle">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(deal.status)}`}
                  >
                    {formatStatus(deal.status)}
                  </span>
                </td>
                <td className="p-4 align-middle text-right font-medium">
                  {formatCurrency(deal.askingPrice)}
                </td>
                <td className="p-4 align-middle text-right">
                  {formatCurrency(deal.marketValue)}
                </td>
                <td className="p-4 align-middle text-center">
                  {deal.dealScore !== null ? (
                    <span
                      className={`font-bold ${deal.dealScore >= 70 ? "text-success" : "text-muted-foreground"}`}
                    >
                      {deal.dealScore}/100
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 align-middle text-center">
                  {deal.bmvPercentage !== null ? (
                    <span className="font-bold text-success">
                      {Number(deal.bmvPercentage).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 align-middle text-center">
                  {deal.grossYield !== null ? (
                    <span className="font-medium">
                      {Number(deal.grossYield).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 align-middle text-center">
                  {deal.roi !== null ? (
                    <span className="font-medium text-primary">
                      {Number(deal.roi).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-4 align-middle text-sm">
                  {deal.assignedTo
                    ? `${deal.assignedTo.firstName} ${deal.assignedTo.lastName}`
                    : "—"}
                </td>
                <td className="p-4 align-middle text-sm text-muted-foreground">
                  {new Date(deal.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Reusable Deal Card Component (for Card View)
function DealCard({ deal }: { deal: DealWithRelations }) {
  const calculatedMetrics = calculateAllMetrics({
    askingPrice: Number(deal.askingPrice),
    marketValue: deal.marketValue ? Number(deal.marketValue) : null,
    estimatedRefurbCost: deal.estimatedRefurbCost
      ? Number(deal.estimatedRefurbCost)
      : null,
    afterRefurbValue: deal.afterRefurbValue
      ? Number(deal.afterRefurbValue)
      : null,
    estimatedMonthlyRent: deal.estimatedMonthlyRent
      ? Number(deal.estimatedMonthlyRent)
      : null,
    bedrooms: deal.bedrooms,
    propertyType: deal.propertyType,
    postcode: deal.postcode || undefined,
  })

  // Build map URL
  let mapUrl = ""
  if (deal.latitude && deal.longitude) {
    mapUrl = `https://www.google.com/maps?q=${Number(deal.latitude)},${Number(deal.longitude)}&output=embed`
  } else {
    const addressQuery = encodeURIComponent(
      `${deal.address}${deal.postcode ? `, ${deal.postcode}` : ""}, UK`
    )
    mapUrl = `https://www.google.com/maps?q=${addressQuery}&output=embed`
  }

  return (
    <Link href={`/dashboard/deals/${deal.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{deal.address}</CardTitle>
              {deal.postcode && (
                <p className="text-sm text-muted-foreground">{deal.postcode}</p>
              )}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${getStatusColor(deal.status)}`}
            >
              {formatStatus(deal.status)}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-3">
            {/* Data Section */}
            <div className="space-y-2">
              {/* Pricing Information */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-muted-foreground">
                    Asking Price
                  </span>
                  <span className="font-bold text-base">
                    {formatCurrency(deal.askingPrice)}
                  </span>
                </div>
                {deal.marketValue && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">
                      Market Value
                    </span>
                    <span className="font-semibold text-sm">
                      {formatCurrency(deal.marketValue)}
                    </span>
                  </div>
                )}
                {deal.estimatedMonthlyRent && (
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-muted-foreground">
                      Monthly Rent
                    </span>
                    <span className="font-semibold text-sm">
                      {formatCurrency(deal.estimatedMonthlyRent)}
                    </span>
                  </div>
                )}
              </div>

              {/* Property Details */}
              <div className="pt-2 border-t">
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                  {deal.bedrooms && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Beds:</span>
                      <span className="font-medium">{deal.bedrooms}</span>
                    </div>
                  )}
                  {deal.bathrooms && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Baths:</span>
                      <span className="font-medium">{deal.bathrooms}</span>
                    </div>
                  )}
                  {deal.propertyType && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Type:</span>
                      <span className="font-medium capitalize">
                        {deal.propertyType}
                      </span>
                    </div>
                  )}
                  {deal.squareFeet && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Sqft:</span>
                      <span className="font-medium">
                        {deal.squareFeet.toLocaleString("en-GB")}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggle Section */}
              <DealCardSections
                dealId={deal.id}
                children={{
                  metrics: (
                    <div className="pt-2 border-t space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Investment Metrics
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Score
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.dealScore && deal.dealScore >= 70
                          ? "text-success"
                          : "text-muted-foreground"
                      }`}
                    >
                      {deal.dealScore ? `${deal.dealScore}/100` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      BMV
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.bmvPercentage ? "text-success" : "text-muted-foreground"
                      }`}
                    >
                      {deal.bmvPercentage
                        ? `${Number(deal.bmvPercentage).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Gross Yield
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.grossYield ? "" : "text-muted-foreground"
                      }`}
                    >
                      {deal.grossYield
                        ? `${Number(deal.grossYield).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Net Yield
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.netYield ? "" : "text-muted-foreground"
                      }`}
                    >
                      {deal.netYield
                        ? `${Number(deal.netYield).toFixed(1)}%`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      ROI
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.roi ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {deal.roi ? `${Number(deal.roi).toFixed(1)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      ROCE
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        deal.roce ? "text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {deal.roce ? `${Number(deal.roce).toFixed(1)}%` : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      Cap Rate
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        calculatedMetrics.capRate
                          ? ""
                          : "text-muted-foreground"
                      }`}
                    >
                      {calculatedMetrics.capRate
                        ? `${calculatedMetrics.capRate.toFixed(2)}%`
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-0.5">
                      GRM
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        calculatedMetrics.grm ? "" : "text-muted-foreground"
                      }`}
                    >
                      {calculatedMetrics.grm
                        ? calculatedMetrics.grm.toFixed(2)
                        : "—"}
                    </p>
                  </div>
                </div>
                    </div>
                  ),
                  map: (
                    <div className="pt-2 border-t">
                      <div className="w-full h-[200px] rounded-lg overflow-hidden border">
                        <iframe
                          src={mapUrl}
                          width="100%"
                          height="100%"
                          style={{ border: 0 }}
                          allowFullScreen
                          loading="lazy"
                          referrerPolicy="no-referrer-when-downgrade"
                          className="w-full h-full"
                        />
                      </div>
                    </div>
                  ),
                }}
              />

              {/* Team & Metadata */}
              <div className="pt-2 border-t space-y-1">
                {deal.assignedTo && (
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground">Assigned:</span>
                    <span className="truncate ml-2 font-medium">
                      {deal.assignedTo.firstName} {deal.assignedTo.lastName}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-[10px]">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">
                    {new Date(deal.createdAt).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

