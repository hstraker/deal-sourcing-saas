"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Search,
  LayoutGrid,
  Table2,
  Check,
  X,
  Trash2,
  Eye,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCheck,
  XCircle,
  Bed,
  Bath,
} from "lucide-react"
import { toast } from "sonner"
import { PropertyDetailModal } from "./property-detail-modal"
import { PropertyReviewCard } from "./property-review-card"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"

const LIMIT = 20

const SOURCE_COLORS: Record<string, string> = {
  RIGHTMOVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ZOOPLA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ONTHEMARKET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  PRIMELOCATION: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  AUTO_APPROVED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  AUTO_APPROVED: "Auto",
  APPROVED: "Approved",
  REJECTED: "Rejected",
}

type ViewMode = "table" | "grid"
type SortField = "scrapedAt" | "price" | "daysOnMarket" | "title"

interface Filters {
  search: string
  source: string
  reviewStatus: string
  category: string
}

interface PaginationInfo {
  page: number
  total: number
  totalPages: number
}

interface PropertiesTableProps {
  refreshKey?: number
}

export function PropertiesTable({ refreshKey = 0 }: PropertiesTableProps) {
  const router = useRouter()
  const [listings, setListings] = useState<PropertyListingForClient[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField>("scrapedAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [filters, setFilters] = useState<Filters>({ search: "", source: "", reviewStatus: "", category: "" })
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedListing, setSelectedListing] = useState<PropertyListingForClient | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  // Debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(filters.search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [filters.search])

  const fetchListings = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        limit: String(LIMIT),
        sortField,
        sortDirection,
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (filters.source) params.set("source", filters.source)
      if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus)
      if (filters.category) params.set("category", filters.category)

      const res = await fetch(`/api/properties/listings?${params}`)
      const data = await res.json()
      if (data.success) {
        setListings(data.listings)
        setPagination({ page: pageNum, total: data.pagination.total, totalPages: data.pagination.totalPages })
        setSelectedIds(new Set())
      }
    } catch {
      toast.error("Failed to load properties")
    } finally {
      setLoading(false)
    }
  // refreshKey is intentionally included so a completed scrape triggers a re-fetch
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection, debouncedSearch, filters.source, filters.reviewStatus, filters.category, refreshKey])

  // Reset to page 1 when filters/sort change
  useEffect(() => { fetchListings(1) }, [fetchListings])

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  // ── Selection ──
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === listings.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(listings.map(l => l.id)))
    }
  }

  // ── Sort ──
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDirection("desc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-40" />
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3" />
      : <ArrowDown className="h-3 w-3" />
  }

  // ── Review ──
  const handleReview = async (id: string, action: "APPROVED" | "REJECTED", notes?: string) => {
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/review-queue/${id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, notes }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")

      setListings(prev => prev.map(l => l.id === id ? { ...l, reviewStatus: action } : l))
      setSelectedListing(null)
      toast.success(`Property ${action === "APPROVED" ? "approved" : "rejected"}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Bulk Review ──
  const handleBulkReview = async (action: "APPROVED" | "REJECTED") => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    setIsSubmitting(true)
    try {
      const res = await fetch("/api/review-queue/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      const data = await res.json()
      setListings(prev => prev.map(l => selectedIds.has(l.id) ? { ...l, reviewStatus: action } : l))
      setSelectedIds(new Set())
      toast.success(`${data.updatedCount} properties ${action.toLowerCase()}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete ──
  const confirmDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/properties/listings/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      setListings(prev => prev.filter(l => l.id !== id))
      setPagination(prev => ({ ...prev, total: prev.total - 1 }))
      setDeleteTarget(null)
      toast.success("Property deleted")
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds)
    setBulkDeleteConfirm(false)
    setIsSubmitting(true)
    try {
      await Promise.all(ids.map(id => fetch(`/api/properties/listings/${id}`, { method: "DELETE" })))
      setListings(prev => prev.filter(l => !selectedIds.has(l.id)))
      setPagination(prev => ({ ...prev, total: prev.total - ids.length }))
      setSelectedIds(new Set())
      toast.success(`${ids.length} properties deleted`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const activeFilterCount = [filters.source, filters.reviewStatus, filters.category].filter(Boolean).length

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search address, title, postcode..."
            value={filters.search}
            onChange={e => setFilter("search", e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Source filter */}
          <Select value={filters.source || "all"} onValueChange={v => setFilter("source", v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 h-9">
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

          {/* Status filter */}
          <Select value={filters.reviewStatus || "all"} onValueChange={v => setFilter("reviewStatus", v === "all" ? "" : v)}>
            <SelectTrigger className="w-32 h-9">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="AUTO_APPROVED">Auto-approved</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>

          {/* Category filter */}
          <Select value={filters.category || "all"} onValueChange={v => setFilter("category", v === "all" ? "" : v)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              <SelectItem value="RESIDENTIAL">Residential</SelectItem>
              <SelectItem value="COMMERCIAL">Commercial</SelectItem>
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-muted-foreground"
              onClick={() => setFilters(prev => ({ ...prev, source: "", reviewStatus: "", category: "" }))}
            >
              Clear filters
              <Badge variant="secondary" className="ml-1.5 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
                {activeFilterCount}
              </Badge>
            </Button>
          )}

          {/* View toggle */}
          <div className="flex rounded-md border overflow-hidden">
            <button
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors ${viewMode === "table" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-3.5 w-3.5" />
              Table
            </button>
            <button
              className={`px-2.5 py-1.5 flex items-center gap-1 text-xs transition-colors border-l ${viewMode === "grid" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Grid
            </button>
          </div>
        </div>
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-muted/80 border px-3 py-2 text-sm">
          <span className="font-medium">{selectedIds.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => handleBulkReview("APPROVED")} disabled={isSubmitting}>
              <CheckCheck className="mr-1 h-3 w-3" />
              Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleBulkReview("REJECTED")} disabled={isSubmitting}>
              <XCircle className="mr-1 h-3 w-3" />
              Reject
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => setBulkDeleteConfirm(true)} disabled={isSubmitting}>
              <Trash2 className="mr-1 h-3 w-3" />
              Delete
            </Button>
            <Button size="sm" variant="ghost" className="h-7"
              onClick={() => setSelectedIds(new Set())}>
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span suppressHydrationWarning>
          {loading ? "Loading…" : `${pagination.total.toLocaleString()} properties`}
        </span>
        <span>{pagination.page > 1 || pagination.totalPages > 1 ? `Page ${pagination.page} of ${pagination.totalPages}` : ""}</span>
      </div>

      {/* ── Table View ── */}
      {viewMode === "table" && (
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="w-10 px-3 py-3 text-left">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={listings.length > 0 && selectedIds.size === listings.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="w-10 px-2 py-3" />
                  <th className="px-3 py-3 text-left font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("title")}>
                      Property <SortIcon field="title" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Source</th>
                  <th className="px-3 py-3 text-left font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground" onClick={() => handleSort("price")}>
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">Beds / Size</th>
                  <th className="px-3 py-3 text-left font-medium whitespace-nowrap">BMV</th>
                  <th className="px-3 py-3 text-left font-medium">Status</th>
                  <th className="px-3 py-3 text-left font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground whitespace-nowrap" onClick={() => handleSort("daysOnMarket")}>
                      Days <SortIcon field="daysOnMarket" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-left font-medium">
                    <button className="flex items-center gap-1 hover:text-foreground whitespace-nowrap" onClick={() => handleSort("scrapedAt")}>
                      Scraped <SortIcon field="scrapedAt" />
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading properties…
                    </td>
                  </tr>
                ) : listings.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center text-muted-foreground">
                      No properties found
                    </td>
                  </tr>
                ) : (
                  listings.map(listing => {
                    const bmv = listing.bmvIndicators as BmvIndicatorsData
                    const address = listing.address as any
                    const images = listing.images as string[]
                    return (
                      <tr
                        key={listing.id}
                        className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${selectedIds.has(listing.id) ? "bg-muted/50" : ""}`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            className="rounded"
                            checked={selectedIds.has(listing.id)}
                            onChange={() => toggleSelect(listing.id)}
                          />
                        </td>

                        {/* Thumbnail */}
                        <td className="px-2 py-2.5">
                          {images?.[0] ? (
                            <img
                              src={images[0]}
                              alt=""
                              className="h-9 w-14 rounded object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-14 rounded bg-muted flex-shrink-0" />
                          )}
                        </td>

                        {/* Property */}
                        <td className="px-3 py-2.5 max-w-[220px]">
                          <p className="font-medium truncate text-xs">{listing.title}</p>
                          <p className="text-muted-foreground truncate text-[11px]">
                            {address?.displayAddress}
                            {address?.postcode && ` · ${address.postcode}`}
                          </p>
                        </td>

                        {/* Source */}
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[10px] px-1.5 py-0 ${SOURCE_COLORS[listing.source] || ""}`}>
                            {SOURCE_LABELS[listing.source] || listing.source}
                          </Badge>
                        </td>

                        {/* Price */}
                        <td className="px-3 py-2.5 font-semibold whitespace-nowrap" suppressHydrationWarning>
                          £{listing.price.toLocaleString()}
                        </td>

                        {/* Beds / Size */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {listing.bedrooms > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Bed className="h-3 w-3" />{listing.bedrooms}
                              </span>
                            )}
                            {listing.bathrooms > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Bath className="h-3 w-3" />{listing.bathrooms}
                              </span>
                            )}
                          </div>
                          {listing.squareFeet && (
                            <div suppressHydrationWarning className="text-[11px] text-muted-foreground mt-0.5">
                              {listing.squareFeet.toLocaleString()} sq ft
                            </div>
                          )}
                        </td>

                        {/* BMV Score */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${bmv?.bmvScore >= 60 ? "bg-green-500" : bmv?.bmvScore >= 30 ? "bg-yellow-500" : "bg-gray-300"}`}
                                style={{ width: `${bmv?.bmvScore ?? 0}%` }}
                              />
                            </div>
                            <span className={`text-xs font-medium ${bmv?.bmvScore >= 60 ? "text-green-600" : bmv?.bmvScore >= 30 ? "text-yellow-600" : "text-muted-foreground"}`}>
                              {bmv?.bmvScore ?? 0}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-3 py-2.5">
                          <Badge className={`text-[10px] px-1.5 py-0 ${STATUS_STYLES[listing.reviewStatus] || ""}`}>
                            {STATUS_LABELS[listing.reviewStatus] || listing.reviewStatus}
                          </Badge>
                        </td>

                        {/* Days on market */}
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {listing.daysOnMarket > 0
                            ? `${listing.daysOnMarket}d`
                            : listing.daysOnMarket < 0
                              ? `${Math.abs(listing.daysOnMarket)}d+`
                              : "—"}
                        </td>

                        {/* Scraped */}
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap" suppressHydrationWarning>
                          {new Date(listing.scrapedAt).toLocaleDateString()}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7"
                              title="View details"
                              onClick={() => setSelectedListing(listing)}>
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            {listing.reviewStatus !== "APPROVED" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                                title="Approve"
                                onClick={() => handleReview(listing.id, "APPROVED")}
                                disabled={isSubmitting}>
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {listing.reviewStatus !== "REJECTED" && (
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Reject"
                                onClick={() => handleReview(listing.id, "REJECTED")}
                                disabled={isSubmitting}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {listing.listingUrl && (
                              <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="View original">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                              title="Delete"
                              onClick={() => setDeleteTarget({ id: listing.id, title: listing.title })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grid View ── */}
      {viewMode === "grid" && (
        loading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading properties…
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
            <p className="text-lg font-medium">No properties found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => (
              <PropertyReviewCard
                key={listing.id}
                listing={listing}
                onApprove={id => handleReview(id, "APPROVED")}
                onReject={id => handleReview(id, "REJECTED")}
                onViewDetails={setSelectedListing}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>
        )
      )}

      {/* ── Pagination ── */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground" suppressHydrationWarning>
            Showing {((pagination.page - 1) * LIMIT) + 1}–{Math.min(pagination.page * LIMIT, pagination.total)} of {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={pagination.page <= 1}
              onClick={() => fetchListings(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              // Show pages around current page
              const totalP = pagination.totalPages
              const cur = pagination.page
              let start = Math.max(1, cur - 2)
              const end = Math.min(totalP, start + 4)
              start = Math.max(1, end - 4)
              return start + i
            }).filter(p => p <= pagination.totalPages).map(p => (
              <Button key={p} variant={p === pagination.page ? "default" : "outline"}
                size="sm" className="h-8 w-8 p-0 text-xs"
                onClick={() => fetchListings(p)}>
                {p}
              </Button>
            ))}
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => fetchListings(pagination.page + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Detail / Review Modal ── */}
      <PropertyDetailModal
        listing={selectedListing}
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onReview={handleReview}
        isSubmitting={isSubmitting}
      />

      {/* ── Single Delete Confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete property?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{deleteTarget?.title}</span> will be permanently removed from the database.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && confirmDelete(deleteTarget.id)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Delete Confirm ── */}
      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} properties?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            These {selectedIds.size} properties will be permanently removed from the database. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete {selectedIds.size}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
