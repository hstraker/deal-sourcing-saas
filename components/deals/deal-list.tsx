"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutGrid,
  List,
  Table as TableIcon,
  BookmarkPlus,
  Eye,
  Pencil,
  Trash2,
  Users,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
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
import { formatCurrency } from "@/lib/format"
import {
  matchInvestors,
  type InvestorCriteria,
  type MatchResult,
} from "@/lib/deals/investor-matcher"

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
  const [investorCriteria, setInvestorCriteria] = useState<InvestorCriteria[]>([])

  // Load view preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("deal-view-mode") as ViewMode | null
    if (saved && ["cards", "list", "table"].includes(saved)) {
      setViewMode(saved)
    }
  }, [])

  // Fetch investor criteria once for match badges
  useEffect(() => {
    fetch("/api/investors/criteria")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.json()
      })
      .then(setInvestorCriteria)
      .catch((err) => {
        console.error("Failed to fetch investor criteria:", err)
      })
  }, [])

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchQuery])

  // Compute investor matches for all deals (pure, fast, no network)
  const matchesByDealId = useMemo(() => {
    const map = new Map<string, MatchResult[]>()
    if (!investorCriteria.length) return map
    for (const deal of deals) {
      map.set(
        deal.id,
        matchInvestors(investorCriteria, {
          postcode: deal.postcode ?? null,
          askingPrice: Number(deal.askingPrice),
          bmvPercentage: deal.bmvPercentage ? Number(deal.bmvPercentage) : null,
          grossYield: deal.grossYield ? Number(deal.grossYield) : null,
          recommendedStrategy: (deal as any).recommendedStrategy ?? null,
        })
      )
    }
    return map
  }, [deals, investorCriteria])

  // Apply search
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return deals
    const query = searchQuery.toLowerCase().trim()
    return deals.filter((deal) => {
      return (
        deal.address.toLowerCase().includes(query) ||
        deal.postcode?.toLowerCase().includes(query) ||
        deal.askingPrice.toString().includes(query)
      )
    })
  }, [deals, searchQuery])

  // Apply filters
  const filteredDeals = useMemo(() => {
    return searchFiltered.filter((deal) => {
      if (filters.status && deal.status !== filters.status) return false
      if (filters.propertyType && deal.propertyType !== filters.propertyType) return false
      if (filters.assignedToId) {
        if (filters.assignedToId === "unassigned") {
          if (deal.assignedToId !== null) return false
        } else {
          if (deal.assignedToId !== filters.assignedToId) return false
        }
      }
      if (filters.postcode && deal.postcode !== filters.postcode) return false
      if (filters.minScore !== null && (deal.dealScore === null || deal.dealScore < filters.minScore)) return false
      if (filters.maxScore !== null && (deal.dealScore === null || deal.dealScore > filters.maxScore)) return false
      if (filters.minBmv !== null && (deal.bmvPercentage === null || Number(deal.bmvPercentage) < filters.minBmv)) return false
      if (filters.maxBmv !== null && (deal.bmvPercentage === null || Number(deal.bmvPercentage) > filters.maxBmv)) return false
      if (filters.minYield !== null && (deal.grossYield === null || Number(deal.grossYield) < filters.minYield)) return false
      if (filters.maxYield !== null && (deal.grossYield === null || Number(deal.grossYield) > filters.maxYield)) return false
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
        case "investorMatches":
          aValue = matchesByDealId.get(a.id)?.length ?? 0
          bValue = matchesByDealId.get(b.id)?.length ?? 0
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1
      return 0
    })
    return sorted
  }, [filteredDeals, sortConfig, matchesByDealId])

  // Apply pagination
  const totalPages = Math.ceil(sortedDeals.length / ITEMS_PER_PAGE)
  const paginatedDeals = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedDeals.slice(startIndex, startIndex + ITEMS_PER_PAGE)
  }, [sortedDeals, currentPage])

  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem("deal-view-mode", mode)
  }

  const handleSearchChange = (query: string) => {
    setSearchQuery(query)
  }

  if (deals.length === 0) {
    return (
      <div className="ds-card py-12 text-center">
        <p className="text-gray-400 mb-4">No deals found</p>
        <Link href="/dashboard/deals/new">
          <Button className="btn-primary">Create Your First Deal</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Search, Filters, Sorting, and View Toggle */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <DealSearch
              deals={deals}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchChange}
            />
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-[var(--ds-border)] p-1">
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
      <div className="text-sm text-gray-400">
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
        <div className="ds-card py-12 text-center">
          <p className="text-gray-400">No deals match your search or filters</p>
        </div>
      ) : (
        <>
          {viewMode === "cards" && (
            <CardView deals={paginatedDeals} matchesByDealId={matchesByDealId} />
          )}
          {viewMode === "list" && (
            <ListView deals={paginatedDeals} matchesByDealId={matchesByDealId} />
          )}
          {viewMode === "table" && (
            <TableView deals={paginatedDeals} matchesByDealId={matchesByDealId} />
          )}

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

// ── Card View ─────────────────────────────────────────────────────────────────

function CardView({
  deals,
  matchesByDealId,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {deals.map((deal) => (
        <DealCard
          key={deal.id}
          deal={deal}
          matches={
            deal.status === "archived" || deal.status === "sold"
              ? []
              : (matchesByDealId.get(deal.id) ?? [])
          }
        />
      ))}
    </div>
  )
}

// ── List View ─────────────────────────────────────────────────────────────────

function ListView({
  deals,
  matchesByDealId,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
}) {
  return (
    <div className="space-y-2">
      {deals.map((deal) => (
        <ListItem
          key={deal.id}
          deal={deal}
          matches={
            deal.status === "archived" || deal.status === "sold"
              ? []
              : (matchesByDealId.get(deal.id) ?? [])
          }
        />
      ))}
    </div>
  )
}

function ListItem({
  deal,
  matches,
}: {
  deal: DealWithRelations
  matches: MatchResult[]
}) {
  const router = useRouter()
  return (
    <div
      className="ds-card ds-card-hover cursor-pointer overflow-hidden"
      onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
    >
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Left: Address & Status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{deal.address}</h3>
              {deal.postcode && (
                <span className="text-sm text-gray-400">{deal.postcode}</span>
              )}
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${getStatusColor(deal.status)}`}
              >
                {formatStatus(deal.status)}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-400">
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
            <div className="font-bold">{formatCurrency(Number(deal.askingPrice))}</div>
            {deal.marketValue && (
              <div className="text-sm text-gray-400">
                MV: {formatCurrency(Number(deal.marketValue))}
              </div>
            )}
          </div>

          {/* Right: Key Metrics */}
          <div className="flex items-center gap-6 min-w-[200px]">
            {deal.dealScore !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400">Score</div>
                <div
                  className={`font-bold ${deal.dealScore >= 70 ? "text-success" : "text-gray-400"}`}
                >
                  {deal.dealScore}/100
                </div>
              </div>
            )}
            {deal.bmvPercentage !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400">BMV</div>
                <div className="font-bold text-success">
                  {Number(deal.bmvPercentage).toFixed(1)}%
                </div>
              </div>
            )}
            {deal.grossYield !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400">Yield</div>
                <div className="font-bold">
                  {Number(deal.grossYield).toFixed(1)}%
                </div>
              </div>
            )}
            {deal.roi !== null && (
              <div className="text-center">
                <div className="text-xs text-gray-400">ROI</div>
                <div className="font-bold text-[#2563EB]">
                  {Number(deal.roi).toFixed(1)}%
                </div>
              </div>
            )}
          </div>

          {/* Investor badge + Actions — stopPropagation so card click doesn't fire */}
          <div
            className="flex items-center gap-2 shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            <InvestorMatchBadge matches={matches} />
            <DealActions dealId={deal.id} dealAddress={deal.address} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({
  deals,
  matchesByDealId,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
}) {
  const router = useRouter()
  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Address</th>
              <th className="table-header">Status</th>
              <th className="table-header text-right">Asking Price</th>
              <th className="table-header text-right">Market Value</th>
              <th className="table-header text-center">Score</th>
              <th className="table-header text-center">BMV%</th>
              <th className="table-header text-center">Yield</th>
              <th className="table-header text-center">ROI</th>
              <th className="table-header">Assigned To</th>
              <th className="table-header">Created</th>
              <th className="table-header text-center">Investors</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr
                key={deal.id}
                className="table-row cursor-pointer"
                onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
              >
                <td className="table-cell">
                  <div className="font-medium">{deal.address}</div>
                  {deal.postcode && (
                    <div className="text-sm text-gray-400">{deal.postcode}</div>
                  )}
                </td>
                <td className="table-cell">
                  <span
                    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(deal.status)}`}
                  >
                    {formatStatus(deal.status)}
                  </span>
                </td>
                <td className="table-cell text-right font-medium">
                  {formatCurrency(Number(deal.askingPrice))}
                </td>
                <td className="table-cell text-right">
                  {formatCurrency(Number(deal.marketValue))}
                </td>
                <td className="table-cell text-center">
                  {deal.dealScore !== null ? (
                    <span
                      className={`font-bold ${deal.dealScore >= 70 ? "text-success" : "text-gray-400"}`}
                    >
                      {deal.dealScore}/100
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="table-cell text-center">
                  {deal.bmvPercentage !== null ? (
                    <span className="font-bold text-success">
                      {Number(deal.bmvPercentage).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="table-cell text-center">
                  {deal.grossYield !== null ? (
                    <span className="font-medium">
                      {Number(deal.grossYield).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="table-cell text-center">
                  {deal.roi !== null ? (
                    <span className="font-medium text-[#2563EB]">
                      {Number(deal.roi).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="table-cell text-sm">
                  {deal.assignedTo
                    ? `${deal.assignedTo.firstName} ${deal.assignedTo.lastName}`
                    : "—"}
                </td>
                <td className="table-cell text-sm text-gray-400">
                  {new Date(deal.createdAt).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
                <td
                  className="table-cell text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InvestorMatchBadge
                    matches={
                      deal.status === "archived" || deal.status === "sold"
                        ? []
                        : (matchesByDealId.get(deal.id) ?? [])
                    }
                  />
                </td>
                <td
                  className="table-cell text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DealActions dealId={deal.id} dealAddress={deal.address} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Deal Card ─────────────────────────────────────────────────────────────────

function DealCard({
  deal,
  matches,
}: {
  deal: DealWithRelations
  matches: MatchResult[]
}) {
  const router = useRouter()
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
    <div
      className="ds-card ds-card-hover cursor-pointer overflow-hidden flex flex-col"
      onClick={() => router.push(`/dashboard/deals/${deal.id}`)}
    >
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">{deal.address}</h3>
            {deal.postcode && (
              <p className="text-sm text-gray-400">{deal.postcode}</p>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <InvestorMatchBadge matches={matches} />
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${getStatusColor(deal.status)}`}
            >
              {formatStatus(deal.status)}
            </span>
          </div>
        </div>
      </div>

      <div className="px-5 pb-4 pt-0 flex-1">
        <div className="space-y-3">
          <div className="space-y-2">
            {/* Pricing Information */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] text-gray-400">Asking Price</span>
                <span className="font-bold text-base">
                  {formatCurrency(Number(deal.askingPrice))}
                </span>
              </div>
              {deal.marketValue && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">Market Value</span>
                  <span className="font-semibold text-sm">
                    {formatCurrency(Number(deal.marketValue))}
                  </span>
                </div>
              )}
              {deal.estimatedMonthlyRent && (
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-gray-400">Monthly Rent</span>
                  <span className="font-semibold text-sm">
                    {formatCurrency(Number(deal.estimatedMonthlyRent))}
                  </span>
                </div>
              )}
            </div>

            {/* Property Details */}
            <div className="pt-2 border-t">
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
                {deal.bedrooms && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Beds:</span>
                    <span className="font-medium">{deal.bedrooms}</span>
                  </div>
                )}
                {deal.bathrooms && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Baths:</span>
                    <span className="font-medium">{deal.bathrooms}</span>
                  </div>
                )}
                {deal.propertyType && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Type:</span>
                    <span className="font-medium capitalize">
                      {deal.propertyType}
                    </span>
                  </div>
                )}
                {deal.squareFeet && (
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400">Sqft:</span>
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
              sections={{
                metrics: (
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Investment Metrics
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Score</p>
                        <p
                          className={`text-sm font-bold ${
                            deal.dealScore && deal.dealScore >= 70
                              ? "text-success"
                              : "text-gray-400"
                          }`}
                        >
                          {deal.dealScore ? `${deal.dealScore}/100` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">BMV</p>
                        <p
                          className={`text-sm font-bold ${
                            deal.bmvPercentage ? "text-success" : "text-gray-400"
                          }`}
                        >
                          {deal.bmvPercentage
                            ? `${Number(deal.bmvPercentage).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">
                          Gross Yield
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            deal.grossYield ? "" : "text-gray-400"
                          }`}
                        >
                          {deal.grossYield
                            ? `${Number(deal.grossYield).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Net Yield</p>
                        <p
                          className={`text-sm font-bold ${
                            deal.netYield ? "" : "text-gray-400"
                          }`}
                        >
                          {deal.netYield
                            ? `${Number(deal.netYield).toFixed(1)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">ROI</p>
                        <p
                          className={`text-sm font-bold ${
                            deal.roi ? "text-[#2563EB]" : "text-gray-400"
                          }`}
                        >
                          {deal.roi ? `${Number(deal.roi).toFixed(1)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">ROCE</p>
                        <p
                          className={`text-sm font-bold ${
                            deal.roce ? "text-[#2563EB]" : "text-gray-400"
                          }`}
                        >
                          {deal.roce ? `${Number(deal.roce).toFixed(1)}%` : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">Cap Rate</p>
                        <p
                          className={`text-sm font-bold ${
                            calculatedMetrics.capRate ? "" : "text-gray-400"
                          }`}
                        >
                          {calculatedMetrics.capRate
                            ? `${calculatedMetrics.capRate.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-gray-400 mb-0.5">GRM</p>
                        <p
                          className={`text-sm font-bold ${
                            calculatedMetrics.grm ? "" : "text-gray-400"
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
                  <span className="text-gray-400">Assigned:</span>
                  <span className="truncate ml-2 font-medium">
                    {deal.assignedTo.firstName} {deal.assignedTo.lastName}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span className="text-gray-400">Created:</span>
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
      </div>

      {/* Actions footer — isolated from card click */}
      <div
        className="border-t border-[var(--ds-border)] flex items-center justify-end px-4 py-2"
        onClick={(e) => e.stopPropagation()}
      >
        <DealActions dealId={deal.id} dealAddress={deal.address} />
      </div>
    </div>
  )
}

// ── Investor match badge ───────────────────────────────────────────────────────

function InvestorMatchBadge({ matches }: { matches: MatchResult[] }) {
  if (matches.length === 0) return null
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex cursor-default items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <Users className="h-3 w-3" />
            {matches.length}
          </div>
        </TooltipTrigger>
        <TooltipContent className="w-48 p-3">
          <p className="mb-1.5 text-xs font-semibold text-gray-900">
            Matching investors
          </p>
          <div className="space-y-1">
            {matches.slice(0, 3).map((m) => {
              const pct = Math.round(m.score * 100)
              return (
                <div
                  key={m.investorId}
                  className="flex items-center justify-between gap-2"
                >
                  <span className="truncate text-xs">{m.name}</span>
                  <span
                    className={`shrink-0 text-xs font-bold ${
                      pct >= 80
                        ? "text-green-600"
                        : pct >= 50
                        ? "text-amber-500"
                        : "text-gray-400"
                    }`}
                  >
                    {pct}%
                  </span>
                </div>
              )
            })}
            {matches.length > 3 && (
              <p className="text-[10px] text-gray-400">
                +{matches.length - 3} more
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ── Deal action buttons ────────────────────────────────────────────────────────

function DealActions({
  dealId,
  dealAddress,
}: {
  dealId: string
  dealAddress: string
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/deals/${dealId}`}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <Eye className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>View</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/deals/${dealId}/edit`}
                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/dashboard/reservations?dealId=${dealId}`}
                className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600"
                onClick={(e) => e.stopPropagation()}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent>Reserve</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Delete</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      <DeleteConfirmDialog
        dealId={dealId}
        dealAddress={dealAddress}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
      />
    </>
  )
}

function DeleteConfirmDialog({
  dealId,
  dealAddress,
  open,
  onOpenChange,
}: {
  dealId: string
  dealAddress: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete deal")
      }
      router.refresh()
    } catch (err) {
      console.error("Error deleting deal:", err)
      alert(err instanceof Error ? err.message : "Failed to delete deal")
      setIsDeleting(false)
      onOpenChange(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete deal?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete <strong>{dealAddress}</strong> and all
            associated data including photos and history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-red-500 text-white hover:bg-red-600"
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
