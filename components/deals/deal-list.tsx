"use client"

import { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  BookmarkPlus,
  Eye,
  Pencil,
  Trash2,
  Users,
  Loader2,
  Zap,
  TrendingUp,
  BarChart2,
  Target,
  DollarSign,
  Star,
} from "lucide-react"
import type { ActionItem } from "@/app/api/action-counts/route"
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
import { KpiBar, type KpiTile } from "@/components/ui/kpi-bar"
import { StatusBadge } from "@/components/ui/status-badge"
import { getDealStatusVarKey } from "@/lib/theme/status-colors"
import { DealSearch } from "@/components/deals/deal-search"
import {
  DealFiltersComponent,
  type DealFilters,
} from "@/components/deals/deal-filters"
import { DealPagination } from "@/components/deals/deal-pagination"
import {
  DealSorting,
  type SortConfig,
} from "@/components/deals/deal-sorting"
import { DealDetailModal } from "@/components/deals/deal-detail-modal"
import type { DealWithRelations } from "@/types/deal"
import { formatCurrency } from "@/lib/format"
import {
  matchInvestors,
  type InvestorCriteria,
  type MatchResult,
} from "@/lib/deals/investor-matcher"

interface DealListProps {
  deals: DealWithRelations[]
  teamMembers?: Array<{
    id: string
    firstName: string | null
    lastName: string | null
  }>
}

const ITEMS_PER_PAGE = 12

const formatStatus = (status: string) => {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

// ── KPI Bar ────────────────────────────────────────────────────────────────────

interface DealKpis {
  activeDeals: number
  avgBmv: number | null
  avgGrossYield: number | null
  totalPipelineValue: number
  avgDealScore: number | null
}

function computeKpis(deals: DealWithRelations[]): DealKpis {
  const activeDeals = deals.filter(
    (d) => d.status !== "archived" && d.status !== "sold"
  ).length

  const bmvValues = deals
    .map((d) => ((d as any).bmvPercentage != null ? Number((d as any).bmvPercentage) : null))
    .filter((v): v is number => v !== null)
  const avgBmv = bmvValues.length > 0
    ? bmvValues.reduce((a, b) => a + b, 0) / bmvValues.length
    : null

  const yieldValues = deals
    .map((d) => ((d as any).grossYield != null ? Number((d as any).grossYield) : null))
    .filter((v): v is number => v !== null)
  const avgGrossYield = yieldValues.length > 0
    ? yieldValues.reduce((a, b) => a + b, 0) / yieldValues.length
    : null

  const totalPipelineValue = deals
    .reduce((sum, d) => {
      const mv = (d as any).marketValue != null ? Number((d as any).marketValue) : 0
      return sum + mv
    }, 0)

  const scoreValues = deals
    .map((d) => d.dealScore)
    .filter((v): v is number => v !== null)
  const avgDealScore = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : null

  return { activeDeals, avgBmv, avgGrossYield, totalPipelineValue, avgDealScore }
}

function DealKpiBar({ deals }: { deals: DealWithRelations[] }) {
  const kpis = useMemo(() => computeKpis(deals), [deals])

  const tiles: KpiTile[] = [
    {
      label: "Active Deals",
      value: String(kpis.activeDeals),
      icon: <Target className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-gray-900",
    },
    {
      label: "Avg BMV %",
      value: kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      iconBgClass: "bg-green-50",
      valueColorClass: "text-green-600",
    },
    {
      label: "Avg Gross Yield",
      value: kpis.avgGrossYield !== null ? `${kpis.avgGrossYield.toFixed(1)}%` : "—",
      icon: <BarChart2 className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-blue-600",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(kpis.totalPipelineValue),
      icon: <DollarSign className="h-4 w-4 text-purple-600" />,
      iconBgClass: "bg-purple-50",
      valueColorClass: "text-purple-600",
    },
    {
      label: "Avg Deal Score",
      value: kpis.avgDealScore !== null ? `${kpis.avgDealScore.toFixed(0)}/100` : "—",
      icon: <Star className="h-4 w-4 text-amber-600" />,
      iconBgClass: "bg-amber-50",
      valueColorClass: "text-amber-600",
    },
  ]

  return <KpiBar tiles={tiles} />
}

// ── Main DealList ──────────────────────────────────────────────────────────────

export function DealList({ deals, teamMembers = [] }: DealListProps) {
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
  const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null)

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

  // Fetch action-counts to know which deals need attention
  const [actionDealIds, setActionDealIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    fetch("/api/action-counts")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.json()
      })
      .then((data: { items: ActionItem[] }) => {
        setActionDealIds(
          new Set(data.items.filter((i) => i.type === "deal").map((i) => i.id))
        )
      })
      .catch((err) => {
        console.error("Failed to fetch action counts:", err)
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
      {/* KPI Bar + Search, Filters, Sorting */}
      <div className="space-y-4">
        <DealKpiBar deals={deals} />
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <DealSearch
              deals={deals}
              searchQuery={searchQuery}
              onSearchQueryChange={handleSearchChange}
            />
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

      {/* Table or empty state */}
      {paginatedDeals.length === 0 ? (
        <div className="ds-card py-12 text-center">
          <p className="text-gray-400">No deals match your search or filters</p>
        </div>
      ) : (
        <>
          <TableView
            deals={paginatedDeals}
            matchesByDealId={matchesByDealId}
            actionDealIds={actionDealIds}
            onViewDeal={setSelectedDeal}
          />
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

      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </div>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({
  deals,
  matchesByDealId,
  actionDealIds,
  onViewDeal,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
  actionDealIds: Set<string>
  onViewDeal: (deal: DealWithRelations) => void
}) {
  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header">Address</th>
              <th className="table-header">Status</th>
              <th className="table-header">Type</th>
              <th className="table-header text-right">Asking Price</th>
              <th className="table-header text-right">Market Value</th>
              <th className="table-header text-center">BMV %</th>
              <th className="table-header text-center">Gross Yield</th>
              <th className="table-header text-center">Score</th>
              <th className="table-header">Assigned</th>
              <th className="table-header text-center">Investors</th>
              <th className="table-header text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className="table-row">
                {/* Address */}
                <td className="table-cell">
                  <div className="flex items-center gap-1.5">
                    <div>
                      <div className="font-medium">{deal.address}</div>
                      {deal.postcode && (
                        <div className="text-xs text-gray-400">{deal.postcode}</div>
                      )}
                    </div>
                    {actionDealIds.has(deal.id) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent>Needs investor reservation</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </td>

                {/* Status */}
                <td className="table-cell">
                  <StatusBadge
                    label={formatStatus(deal.status)}
                    cssKey={getDealStatusVarKey(deal.status)}
                  />
                </td>

                {/* Type */}
                <td className="table-cell">
                  {deal.propertyType ? (
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
                      {deal.propertyType}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Asking Price */}
                <td className="table-cell text-right font-medium">
                  {formatCurrency(Number(deal.askingPrice))}
                </td>

                {/* Market Value */}
                <td className="table-cell text-right">
                  {(deal as any).marketValue != null
                    ? formatCurrency(Number((deal as any).marketValue))
                    : <span className="text-gray-400">—</span>
                  }
                </td>

                {/* BMV % */}
                <td className="table-cell text-center">
                  {(deal as any).bmvPercentage != null ? (() => {
                    const v = Number((deal as any).bmvPercentage)
                    const cls = v >= 15 ? "text-green-500" : v >= 5 ? "text-amber-500" : "text-red-500"
                    return <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Gross Yield */}
                <td className="table-cell text-center">
                  {(deal as any).grossYield != null ? (() => {
                    const v = Number((deal as any).grossYield)
                    const cls = v >= 6 ? "text-green-500" : v >= 4 ? "text-amber-500" : "text-red-500"
                    return <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Deal Score */}
                <td className="table-cell text-center">
                  {deal.dealScore != null ? (() => {
                    const s = deal.dealScore
                    const cls =
                      s >= 80 ? "text-green-500" :
                      s >= 60 ? "text-blue-400" :
                      s >= 40 ? "text-amber-500" : "text-red-500"
                    return <span className={`font-bold ${cls}`}>{s}/100</span>
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Assigned */}
                <td className="table-cell text-sm">
                  {deal.assignedTo
                    ? `${deal.assignedTo.firstName ?? ""} ${(deal.assignedTo.lastName ?? "").charAt(0)}.`.trim()
                    : <span className="text-gray-400">—</span>
                  }
                </td>

                {/* Investors */}
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

                {/* Actions */}
                <td
                  className="table-cell text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DealActions
                    dealId={deal.id}
                    dealAddress={deal.address}
                    onView={() => onViewDeal(deal)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
  onView,
}: {
  dealId: string
  dealAddress: string
  onView?: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          {onView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView()
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          )}
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
