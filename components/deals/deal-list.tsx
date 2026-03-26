"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
  Archive,
  Sparkles,
  CheckCircle2,
  ListChecks,
  Lock,
  BadgeCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
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
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
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

const DEAL_STATUS_ICON: Record<string, LucideIcon> = {
  new:         Sparkles,
  review:      Eye,
  in_progress: Zap,
  ready:       CheckCircle2,
  listed:      ListChecks,
  reserved:    Lock,
  sold:        BadgeCheck,
  archived:    Archive,
}

const DEAL_STATUS_LABEL: Record<string, string> = {
  new:         "New",
  review:      "Review",
  in_progress: "In Progress",
  ready:       "Ready",
  listed:      "Listed",
  reserved:    "Reserved",
  sold:        "Sold",
  archived:    "Archived",
}

// ── Tooltip helper ─────────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-center text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
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
      tooltip: "Deals that are not archived or sold. Includes new, review, in progress, ready, listed, and reserved statuses.",
    },
    {
      label: "Avg BMV %",
      value: kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      iconBgClass: "bg-green-50",
      valueColorClass: "text-green-600",
      tooltip: "Average discount from market value. Green ≥15% = excellent, Amber ≥5% = acceptable, Red <5% = weak.",
    },
    {
      label: "Avg Gross Yield",
      value: kpis.avgGrossYield !== null ? `${kpis.avgGrossYield.toFixed(1)}%` : "—",
      icon: <BarChart2 className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-blue-600",
      tooltip: "Average rental yield before expenses. Green ≥6% = strong BTL, Amber ≥4% = acceptable, Red <4% = poor cashflow.",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(kpis.totalPipelineValue),
      icon: <DollarSign className="h-4 w-4 text-purple-600" />,
      iconBgClass: "bg-purple-50",
      valueColorClass: "text-purple-600",
      tooltip: "Total combined market values of active deals. Larger pipeline = more investor choice.",
    },
    {
      label: "Avg Deal Score",
      value: kpis.avgDealScore !== null ? `${kpis.avgDealScore.toFixed(0)}/100` : "—",
      icon: <Star className="h-4 w-4 text-amber-600" />,
      iconBgClass: "bg-amber-50",
      valueColorClass: "text-amber-600",
      tooltip: "Average deal quality score (0-100). 80+ = excellent, 60-79 = good, 40-59 = fair, <40 = poor.",
    },
  ]

  return <KpiBar tiles={tiles} />
}

// ── Main DealList ──────────────────────────────────────────────────────────────

export function DealList({ deals: initialDeals, teamMembers = [] }: DealListProps) {
  const [deals, setDeals] = useState(initialDeals)
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
  const [archivingId, setArchivingId] = useState<string | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    variant: "destructive" | "archive" | "warning" | "default"
    confirmLabel: string
    onConfirm: () => void
  }>({ open: false, title: "", description: "", variant: "default", confirmLabel: "Confirm", onConfirm: () => {} })

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedDeals.map((d) => d.id)))
    }
  }

  const handleBulkArchive = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || bulkArchiving) return
    setConfirmDialog({
      open: true,
      title: `Archive ${ids.length} deal${ids.length !== 1 ? "s" : ""}?`,
      description: "They will be moved to the Archive page and can be restored at any time.",
      variant: "archive",
      confirmLabel: "Archive",
      onConfirm: async () => {
        setBulkArchiving(true)
        let done = 0; let failed = 0
        for (const id of ids) {
          try {
            const res = await fetch(`/api/deals/${id}/archive`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ archiveLinkedLead: false }),
            })
            if (!res.ok) throw new Error("failed")
            done++
          } catch { failed++ }
        }
        setDeals((prev) => prev.filter((d) => !ids.includes(d.id)))
        setSelectedIds(new Set())
        setBulkArchiving(false)
        failed === 0
          ? toast.success(`${done} deal${done !== 1 ? "s" : ""} archived`)
          : toast.warning(`${done} archived, ${failed} failed`)
      },
    })
  }

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || bulkDeleting) return
    setConfirmDialog({
      open: true,
      title: `Delete ${ids.length} deal${ids.length !== 1 ? "s" : ""} permanently?`,
      description: "This cannot be undone. All deal data will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        setBulkDeleting(true)
        let done = 0; let failed = 0
        for (const id of ids) {
          try {
            const res = await fetch(`/api/deals/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("failed")
            done++
          } catch { failed++ }
        }
        setDeals((prev) => prev.filter((d) => !ids.includes(d.id)))
        setSelectedIds(new Set())
        setBulkDeleting(false)
        failed === 0
          ? toast.success(`${done} deal${done !== 1 ? "s" : ""} permanently deleted`)
          : toast.warning(`${done} deleted, ${failed} failed`)
      },
    })
  }

  const handleArchiveDeal = (dealId: string) => {
    const deal = deals.find(d => d.id === dealId) as any
    const hasLinkedLead = !!deal?.vendorLead
    setConfirmDialog({
      open: true,
      title: "Archive this deal?",
      description: hasLinkedLead
        ? `This deal came from vendor lead "${deal.vendorLead.vendorName}". Both the deal and its linked vendor lead will be archived and can be restored anytime.`
        : "The deal will be moved to the Archive page and can be restored at any time.",
      variant: "archive",
      confirmLabel: "Archive",
      onConfirm: async () => {
        setArchivingId(dealId)
        try {
          const res = await fetch(`/api/deals/${dealId}/archive`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archiveLinkedLead: hasLinkedLead }),
          })
          if (!res.ok) throw new Error("Archive failed")
          setDeals(prev => prev.filter(d => d.id !== dealId))
          toast.success("Deal archived — moved to archive. Restore it anytime from the Archive page.")
        } catch {
          toast.error("Failed to archive deal")
        } finally {
          setArchivingId(null)
        }
      },
    })
  }

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

  // Bulk selection derived state (depends on paginatedDeals)
  const allSelected = paginatedDeals.length > 0 && paginatedDeals.every((d) => selectedIds.has(d.id))
  const someSelected = paginatedDeals.some((d) => selectedIds.has(d.id))

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
            onArchiveDeal={handleArchiveDeal}
            archivingId={archivingId}
            selectedIds={selectedIds}
            allSelected={allSelected}
            someSelected={someSelected}
            onToggleSelect={handleToggleSelect}
            onSelectAll={handleSelectAll}
          />
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <DealBulkActionBar
              selectedCount={selectedIds.size}
              isBulkArchiving={bulkArchiving}
              isBulkDeleting={bulkDeleting}
              onBulkArchive={handleBulkArchive}
              onBulkDelete={handleBulkDelete}
              onClear={() => setSelectedIds(new Set())}
            />
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

      {selectedDeal && (
        <DealDetailModal
          deal={selectedDeal}
          onClose={() => setSelectedDeal(null)}
        />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}

// ── Deal Setup Progress ────────────────────────────────────────────────────────

function DealSetupProgress({ deal }: { deal: DealWithRelations }) {
  const checks = [
    { label: "Photos",      done: (deal._count?.photos ?? 0) > 0 },
    { label: "Pack price",  done: (deal as any).packPrice != null && Number((deal as any).packPrice) > 0 },
    { label: "Assigned",    done: deal.assignedTo != null },
    { label: "Listed",      done: deal.status === "listed" || deal.status === "sold" },
  ]
  const doneCount = checks.filter((c) => c.done).length
  const allDone = doneCount === checks.length

  if (allDone) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700 cursor-default">
              ✓ Complete
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">All setup steps complete</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-default">
            <div className="flex gap-0.5">
              {checks.map((c) => (
                <span
                  key={c.label}
                  className={`h-2 w-2 rounded-full ${c.done ? "bg-green-500" : "bg-gray-200"}`}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-500">{doneCount}/{checks.length}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="text-xs space-y-1">
          <p className="font-semibold mb-1">Deal Setup</p>
          {checks.map((c) => (
            <p key={c.label} className={c.done ? "text-green-600" : "text-gray-400"}>
              {c.done ? "✓" : "○"} {c.label}
            </p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ── Deal Bulk Action Bar ───────────────────────────────────────────────────────

function DealBulkActionBar({
  selectedCount,
  isBulkArchiving,
  isBulkDeleting,
  onBulkArchive,
  onBulkDelete,
  onClear,
}: {
  selectedCount: number
  isBulkArchiving: boolean
  isBulkDeleting: boolean
  onBulkArchive: () => void
  onBulkDelete: () => void
  onClear: () => void
}) {
  const busy = isBulkArchiving || isBulkDeleting
  return (
    <div className="flex items-center justify-between rounded-b-lg bg-[#1e293b] px-4 py-3 -mt-px">
      <span className="text-sm font-medium text-slate-200">
        {selectedCount} deal{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onBulkArchive}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isBulkArchiving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
          {isBulkArchiving ? "Archiving…" : "Archive"}
        </button>
        <button
          onClick={onBulkDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isBulkDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          {isBulkDeleting ? "Deleting…" : "Delete"}
        </button>
        {!busy && (
          <button onClick={onClear} className="ml-2 text-sm text-slate-400 hover:text-slate-200">
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ── Table View ────────────────────────────────────────────────────────────────

function TableView({
  deals,
  matchesByDealId,
  actionDealIds,
  onViewDeal,
  onArchiveDeal,
  archivingId,
  selectedIds,
  allSelected,
  someSelected,
  onToggleSelect,
  onSelectAll,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
  actionDealIds: Set<string>
  onViewDeal: (deal: DealWithRelations) => void
  onArchiveDeal: (dealId: string) => void
  archivingId: string | null
  selectedIds: Set<string>
  allSelected: boolean
  someSelected: boolean
  onToggleSelect: (id: string) => void
  onSelectAll: () => void
}) {
  const selectAllRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])
  return (
    <div className="ds-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="table-header w-10 px-3">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={onSelectAll}
                  className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                />
              </th>
              <th className="table-header w-[220px]"><Tip text="Property address and postcode. Click row to view full details">Address</Tip></th>
              <th className="table-header"><Tip text="Deal status: New (just added), Review (being assessed), In Progress (active), Ready (for investors), Listed (on portal), Reserved (investor reserved), Sold (completed)">Status</Tip></th>
              <th className="table-header"><Tip text="Property type affects valuation, rental demand, and comparable matching. Detached > semi > terrace > flat in most markets">Type</Tip></th>
              <th className="table-header text-right w-28"><Tip text="Your agreed purchase price. What you offered and vendor accepted">Asking Price</Tip></th>
              <th className="table-header text-right w-28"><Tip text="Estimated open market value from comparable sold properties. Used to calculate BMV %">Mkt Value</Tip></th>
              <th className="table-header text-center w-20"><Tip text="Below Market Value %. How much below market you are buying. Green ≥15% = excellent, Amber ≥5% = acceptable, Red <5% = weak. Formula: (Market Value − Asking Price) ÷ Market Value × 100">BMV %</Tip></th>
              <th className="table-header text-center w-20"><Tip text="Gross rental yield. Annual rent ÷ market value. Green ≥6% = strong BTL, Amber ≥4% = acceptable, Red <4% = poor cashflow. Does not include expenses">Yield</Tip></th>
              <th className="table-header text-center w-20"><Tip text="Deal quality score (0-100). 80+ = excellent, 60-79 = good, 40-59 = fair, <40 = poor. Weighted across BMV %, yield, strategy fit, and property type">Score</Tip></th>
              <th className="table-header w-24"><Tip text="Team member managing this deal. Unassigned deals need assignment before investor packs can be sent">Assigned</Tip></th>
              <th className="table-header text-center w-20"><Tip text="Number of investors whose criteria match this deal. Click badge to see matched investor names and match scores">Investors</Tip></th>
              <th className="table-header text-center w-16"><Tip text="Deal setup progress: Photos uploaded, Pack price set, Team member assigned, Listed on portal. All 4 required before presenting to investors">Setup</Tip></th>
              <th className="table-header w-24"><Tip text="Where this deal originated. Vendor Lead = came from your lead pipeline with offer accepted. Manual = added directly">Source</Tip></th>
              <th className="table-header text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {deals.map((deal) => (
              <tr key={deal.id} className={`table-row${selectedIds.has(deal.id) ? " bg-blue-50 hover:bg-blue-100" : ""}`}>
                {/* Checkbox */}
                <td className="table-cell w-10 px-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(deal.id)}
                    onChange={() => onToggleSelect(deal.id)}
                    className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                  />
                </td>
                {/* Address */}
                <td className="table-cell max-w-[220px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{deal.address}</div>
                      {deal.postcode && (
                        <div className="text-xs text-gray-400 mt-0.5">{deal.postcode}</div>
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
                    label={DEAL_STATUS_LABEL[deal.status] ?? formatStatus(deal.status)}
                    cssKey={getDealStatusVarKey(deal.status)}
                    icon={DEAL_STATUS_ICON[deal.status]}
                    tooltip={
                      deal.status === "new" ? "Newly created deal — needs review and team assignment" :
                      deal.status === "review" ? "Under review — team is assessing viability" :
                      deal.status === "in_progress" ? "Actively being worked — photos, pack, or listing in progress" :
                      deal.status === "ready" ? "Ready to present to investors — pack complete" :
                      deal.status === "listed" ? "Listed on investor portal — investors can view and reserve" :
                      deal.status === "reserved" ? "An investor has reserved this deal — awaiting completion" :
                      deal.status === "sold" ? "Transaction complete — deal has been sold to an investor" :
                      undefined
                    }
                  />
                </td>

                {/* Type */}
                <td className="table-cell whitespace-nowrap">
                  {deal.propertyType ? (
                    <span className="inline-block whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 capitalize">
                      {deal.propertyType}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                {/* Asking Price */}
                <td className="table-cell text-right font-semibold whitespace-nowrap">
                  {formatCurrency(Number(deal.askingPrice))}
                </td>

                {/* Market Value */}
                <td className="table-cell text-right whitespace-nowrap">
                  {(deal as any).marketValue != null
                    ? formatCurrency(Number((deal as any).marketValue))
                    : <span className="text-gray-400">—</span>
                  }
                </td>

                {/* BMV % */}
                <td className="table-cell text-center whitespace-nowrap">
                  {(deal as any).bmvPercentage != null ? (() => {
                    const v = Number((deal as any).bmvPercentage)
                    const cls = v >= 15 ? "text-green-600" : v >= 5 ? "text-amber-500" : "text-red-500"
                    return (
                      <Tip text={`Below Market Value. ${v >= 15 ? "Excellent deal ≥15%." : v >= 5 ? "Acceptable deal ≥5%." : "Weak deal <5%."} Formula: (Market Value − Asking Price) ÷ Market Value × 100`}>
                        <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
                      </Tip>
                    )
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Gross Yield */}
                <td className="table-cell text-center whitespace-nowrap">
                  {(deal as any).grossYield != null ? (() => {
                    const v = Number((deal as any).grossYield)
                    const cls = v >= 6 ? "text-green-600" : v >= 4 ? "text-amber-500" : "text-red-500"
                    return (
                      <Tip text={`Gross rental yield. ${v >= 6 ? "Strong BTL ≥6%." : v >= 4 ? "Acceptable ≥4%." : "Poor cashflow <4%."} Formula: (Annual Rent ÷ Market Value) × 100`}>
                        <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
                      </Tip>
                    )
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Deal Score */}
                <td className="table-cell text-center whitespace-nowrap">
                  {deal.dealScore != null ? (() => {
                    const s = deal.dealScore
                    const cls =
                      s >= 80 ? "text-green-600" :
                      s >= 60 ? "text-blue-500" :
                      s >= 40 ? "text-amber-500" : "text-red-500"
                    const grade = s >= 80 ? "Excellent" : s >= 60 ? "Good" : s >= 40 ? "Fair" : "Poor"
                    return (
                      <Tip text={`Deal quality score. ${grade} (${s}/100). 80+ = excellent, 60-79 = good, 40-59 = fair, <40 = poor. Weighted across BMV %, yield, and strategy fit`}>
                        <span className={`font-semibold ${cls}`}>{s}/100</span>
                      </Tip>
                    )
                  })() : <span className="text-gray-400">—</span>}
                </td>

                {/* Assigned */}
                <td className="table-cell whitespace-nowrap">
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

                {/* Setup progress */}
                <td className="table-cell text-center">
                  <DealSetupProgress deal={deal} />
                </td>

                {/* Source: vendor lead link */}
                <td className="table-cell whitespace-nowrap">
                  {(deal as any).vendorLead ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <a
                            href={`/dashboard/vendors?lead=${(deal as any).vendorLead.id}`}
                            className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            <Users className="h-3 w-3" />
                            {(deal as any).vendorLead.vendorName}
                          </a>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs">
                          <p className="font-semibold">From Vendor Lead</p>
                          <p>{(deal as any).vendorLead.vendorPhone}</p>
                          {(deal as any).vendorLead.offerAmount && (
                            <p>Offer: £{Number((deal as any).vendorLead.offerAmount).toLocaleString()}</p>
                          )}
                          {(deal as any).vendorLead.motivationScore && (
                            <p>Motivation: {(deal as any).vendorLead.motivationScore}/10</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <span className="text-xs text-gray-400">Manual</span>
                  )}
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
                    onArchive={() => onArchiveDeal(deal.id)}
                    isArchiving={archivingId === deal.id}
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
  onArchive,
  isArchiving,
}: {
  dealId: string
  dealAddress: string
  onView?: () => void
  onArchive?: () => void
  isArchiving?: boolean
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
          {onArchive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="rounded p-1.5 text-amber-500 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-50"
                  onClick={(e) => {
                    e.stopPropagation()
                    onArchive()
                  }}
                  disabled={isArchiving}
                >
                  {isArchiving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Archive className="h-3.5 w-3.5" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>Archive</TooltipContent>
            </Tooltip>
          )}
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
      toast.error(err instanceof Error ? err.message : "Failed to delete deal")
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
