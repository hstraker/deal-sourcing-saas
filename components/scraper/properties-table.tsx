"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Map,
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
  Star,
} from "lucide-react"
import { toast } from "sonner"
import { PropertyDetailModal } from "./property-detail-modal"
import { PropertyCard } from "./property-card"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"

// ── Signal chip definitions ───────────────────────────────────────────────────
const SIGNAL_CHIPS = [
  { id: "probate",       label: "Probate",       style: "bg-purple-100 text-purple-700 border-purple-200" },
  { id: "auction",       label: "Auction",        style: "bg-rose-100 text-rose-700 border-rose-200" },
  { id: "repossession",  label: "Repossession",   style: "bg-red-100 text-red-700 border-red-200" },
  { id: "reduced",       label: "Price Reduced",  style: "bg-pink-100 text-pink-700 border-pink-200" },
  { id: "cash-only",     label: "Cash Only",      style: "bg-gray-100 text-gray-700 border-gray-200" },
  { id: "chain-free",    label: "Chain Free",     style: "bg-teal-100 text-teal-700 border-teal-200" },
  { id: "new-build",     label: "New Build",      style: "bg-sky-100 text-sky-700 border-sky-200" },
  { id: "welsh",         label: "🏴󠁧󠁢󠁷󠁬󠁳󠁿 Wales",       style: "bg-red-50 text-red-700 border-red-200" },
] as const

// Leaflet requires the browser — load with ssr:false
const PropertyMap = dynamic(
  () => import("./property-map").then((m) => m.PropertyMap),
  { ssr: false, loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-50 rounded-xl">
      <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
    </div>
  )},
)

const LIMIT = 20

// Source badge classes (keep inline — scraper-specific palette)
const SOURCE_COLORS: Record<string, string> = {
  RIGHTMOVE:     "bg-blue-100 text-blue-800",
  ZOOPLA:        "bg-purple-100 text-purple-800",
  ONTHEMARKET:   "bg-emerald-100 text-emerald-800",
  PRIMELOCATION: "bg-orange-100 text-orange-800",
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE:     "Rightmove",
  ZOOPLA:        "Zoopla",
  ONTHEMARKET:   "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

const STATUS_STYLES: Record<string, string> = {
  PENDING:      "bg-amber-100 text-amber-800",
  AUTO_APPROVED:"bg-blue-100 text-blue-800",
  APPROVED:     "bg-green-100 text-green-800",
  REJECTED:     "bg-red-100 text-red-800",
}

const STATUS_LABELS: Record<string, string> = {
  PENDING:      "Pending",
  AUTO_APPROVED:"Auto",
  APPROVED:     "Approved",
  REJECTED:     "Rejected",
}

type ViewMode = "table" | "grid" | "map"
type SortField = "scrapedAt" | "price" | "daysOnMarket" | "title" | "bedrooms" | "propertyType" | "motivationScore"

interface Filters {
  search: string
  source: string
  reviewStatus: string
  category: string
  favoritesOnly: boolean
  signals: string[]         // active signal chip IDs
  minMotivation: string     // "0" | "20" | "45" | "70"
  jurisdiction: string      // "" | "WALES" | "ENGLAND"
}

interface PaginationInfo {
  page: number
  total: number
  totalPages: number
}

interface PropertiesTableProps {
  refreshKey?: number
  lockedCategory?: string
}

export function PropertiesTable({ refreshKey = 0, lockedCategory }: PropertiesTableProps) {
  const router = useRouter()
  const [listings, setListings] = useState<PropertyListingForClient[]>([])
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, total: 0, totalPages: 1 })
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [mapSelectedId, setMapSelectedId] = useState<string | null>(null)
  const [sortField, setSortField] = useState<SortField>("scrapedAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [filters, setFilters] = useState<Filters>({
    search: "", source: "", reviewStatus: "", category: lockedCategory ?? "",
    favoritesOnly: false, signals: [], minMotivation: "", jurisdiction: "",
  })
  const [newSinceYesterday, setNewSinceYesterday] = useState(0)
  const [debouncedSearch, setDebouncedSearch] = useState("")

  // Sync lockedCategory prop → filters.category whenever the tab changes
  useEffect(() => {
    setFilters(prev => ({ ...prev, category: lockedCategory ?? "" }))
  }, [lockedCategory])
  const [selectedListing, setSelectedListing] = useState<PropertyListingForClient | null>(null)
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set())
  const [isBulkActing, setIsBulkActing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null)
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDebouncedSearch(filters.search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [filters.search])

  const fetchListings = useCallback(async (pageNum = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: String(LIMIT), sortField, sortDirection })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (filters.source) params.set("source", filters.source)
      if (filters.reviewStatus) params.set("reviewStatus", filters.reviewStatus)
      if (filters.category) params.set("category", filters.category)
      if (filters.favoritesOnly) params.set("favoritesOnly", "true")
      if (filters.minMotivation) params.set("minMotivation", filters.minMotivation)
      if (filters.jurisdiction) params.set("jurisdiction", filters.jurisdiction)
      filters.signals.forEach(s => params.append("signal", s))

      const res = await fetch(`/api/properties/listings?${params}`)
      const data = await res.json()
      if (data.success) {
        setListings(data.listings)
        setPagination({ page: pageNum, total: data.pagination.total, totalPages: data.pagination.totalPages })
        setSelectedIds(new Set())
        // Alert banner: how many scraped in last 24 hours
        if (pageNum === 1) {
          const yesterday = new Date(Date.now() - 86_400_000).toISOString()
          const newCount = (data.listings as PropertyListingForClient[]).filter(
            (l: PropertyListingForClient) => l.scrapedAt > yesterday
          ).length
          setNewSinceYesterday(newCount)
        }
      }
    } catch {
      toast.error("Failed to load properties")
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortField, sortDirection, debouncedSearch, filters.source, filters.reviewStatus, filters.category, filters.favoritesOnly, filters.minMotivation, filters.jurisdiction, filters.signals.join(","), refreshKey])

  useEffect(() => { fetchListings(1) }, [fetchListings])

  const setFilter = (key: keyof Filters, value: string) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleSelectAll = () => {
    setSelectedIds(selectedIds.size === listings.length ? new Set() : new Set(listings.map(l => l.id)))
  }

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
    return sortDirection === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
  }

  const handleReview = async (id: string, action: "APPROVED" | "REJECTED", notes?: string) => {
    setSubmittingIds(prev => new Set(prev).add(id))
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
      setSubmittingIds(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  const handleBulkReview = async (action: "APPROVED" | "REJECTED") => {
    const ids = Array.from(selectedIds)
    if (!ids.length) return
    setIsBulkActing(true)
    setSubmittingIds(new Set(ids))
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
      setIsBulkActing(false)
      setSubmittingIds(new Set())
    }
  }

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
    setIsBulkActing(true)
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
      setIsBulkActing(false)
    }
  }

  const toggleFavorite = async (id: string, current: boolean) => {
    const next = !current
    setListings(prev => prev.map(l => l.id === id ? { ...l, isFavorited: next } : l))
    try {
      await fetch(`/api/properties/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorited: next }),
      })
    } catch {
      setListings(prev => prev.map(l => l.id === id ? { ...l, isFavorited: current } : l))
    }
  }

  const activeFilterCount = [filters.source, filters.reviewStatus, filters.category, filters.minMotivation, filters.jurisdiction].filter(Boolean).length
    + (filters.favoritesOnly ? 1 : 0)
    + filters.signals.length

  const toggleSignal = (id: string) =>
    setFilters(prev => ({
      ...prev,
      signals: prev.signals.includes(id)
        ? prev.signals.filter(s => s !== id)
        : [...prev.signals, id],
    }))

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="ds-card p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search address, title, postcode…"
              value={filters.search}
              onChange={e => setFilter("search", e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Source */}
            <Select value={filters.source || "all"} onValueChange={v => setFilter("source", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-36 text-sm">
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

            {/* Status */}
            <Select value={filters.reviewStatus || "all"} onValueChange={v => setFilter("reviewStatus", v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-32 text-sm">
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

            {/* Category — hidden when locked by parent */}
            {!lockedCategory && (
              <Select value={filters.category || "all"} onValueChange={v => setFilter("category", v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 w-36 text-sm">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                  <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                </SelectContent>
              </Select>
            )}

            {/* Favourites */}
            <Button
              variant={filters.favoritesOnly ? "default" : "outline"}
              size="sm"
              className={`h-9 text-sm ${filters.favoritesOnly ? "bg-[#F5A623] hover:bg-[#E09518] border-[#F5A623] text-white" : ""}`}
              onClick={() => setFilters(prev => ({ ...prev, favoritesOnly: !prev.favoritesOnly }))}
            >
              <Star className={`mr-1.5 h-3.5 w-3.5 ${filters.favoritesOnly ? "fill-white" : ""}`} />
              Favourites
            </Button>

            {activeFilterCount > 0 && (
              <button
                type="button"
                className="btn-ghost h-9 text-sm flex items-center gap-1.5"
                onClick={() => setFilters(prev => ({ ...prev, source: "", reviewStatus: "", category: lockedCategory ?? "", favoritesOnly: false, signals: [], minMotivation: "", jurisdiction: "" }))}
              >
                <X className="h-3.5 w-3.5" />
                Clear
                <span className="rounded-full bg-gray-200 px-1.5 py-0 text-xs font-semibold text-gray-600">
                  {activeFilterCount}
                </span>
              </button>
            )}

            {/* Sort */}
            <div className="flex items-center gap-1">
              <ArrowUpDown className="h-3.5 w-3.5 text-gray-400 shrink-0" />
              <Select value={sortField} onValueChange={(v) => { setSortField(v as SortField); setSortDirection("desc") }}>
                <SelectTrigger className="h-9 w-44 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="scrapedAt">Date scraped</SelectItem>
                  <SelectItem value="price">Price</SelectItem>
                  <SelectItem value="motivationScore">Motivation score</SelectItem>
                  <SelectItem value="daysOnMarket">Days on market</SelectItem>
                  <SelectItem value="bedrooms">Bedrooms</SelectItem>
                  <SelectItem value="propertyType">Property type</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2.5 text-sm"
                onClick={() => setSortDirection(d => d === "asc" ? "desc" : "asc")}
              >
                {sortDirection === "asc" ? "Asc" : "Desc"}
              </Button>
            </div>

            {/* View toggle */}
            <div className="flex rounded-lg border border-[var(--ds-border)] overflow-hidden">
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${viewMode === "table" ? "bg-[#1A1A1F] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                onClick={() => setViewMode("table")}
              >
                <Table2 className="h-3.5 w-3.5" /> Table
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-l border-[var(--ds-border)] ${viewMode === "grid" ? "bg-[#1A1A1F] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                onClick={() => setViewMode("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                type="button"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-l border-[var(--ds-border)] ${viewMode === "map" ? "bg-[#1A1A1F] text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
                onClick={() => setViewMode("map")}
              >
                <Map className="h-3.5 w-3.5" /> Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Alert banner — new properties since yesterday ── */}
      {newSinceYesterday > 0 && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-800">
          <span className="text-lg">🆕</span>
          <span>
            <span className="font-semibold">{newSinceYesterday} new {newSinceYesterday === 1 ? "property" : "properties"}</span> scraped in the last 24 hours
          </span>
          <button
            type="button"
            className="ml-auto text-indigo-400 hover:text-indigo-600 transition-colors"
            onClick={() => setNewSinceYesterday(0)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Signal filter chips ── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        <span className="text-xs font-medium text-gray-400 shrink-0">Signals:</span>
        {SIGNAL_CHIPS.map(chip => {
          const active = filters.signals.includes(chip.id)
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => toggleSignal(chip.id)}
              className={`shrink-0 inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                active
                  ? chip.style + " ring-2 ring-offset-1 ring-indigo-400"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
              }`}
            >
              {chip.label}
            </button>
          )
        })}
        {/* Motivation threshold quick filter */}
        <span className="text-xs font-medium text-gray-400 shrink-0 ml-2">Motivation:</span>
        {[
          { value: "",   label: "Any" },
          { value: "20", label: "20+" },
          { value: "45", label: "45+" },
          { value: "70", label: "70+ 🔥" },
        ].map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilters(prev => ({ ...prev, minMotivation: opt.value }))}
            className={`shrink-0 inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
              filters.minMotivation === opt.value
                ? "bg-[#6366f1] text-white border-[#6366f1]"
                : "bg-white text-gray-500 border-gray-200 hover:border-gray-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* ── Bulk Actions Bar ── */}
      {selectedIds.size > 0 && (
        <div className="ds-card flex items-center gap-3 px-4 py-2.5 text-sm">
          <span className="font-semibold text-gray-700">{selectedIds.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" className="h-7 text-green-600 border-green-200 hover:bg-green-50 text-xs"
              onClick={() => handleBulkReview("APPROVED")} disabled={isBulkActing}>
              <CheckCheck className="mr-1 h-3 w-3" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50 text-xs"
              onClick={() => handleBulkReview("REJECTED")} disabled={isBulkActing}>
              <XCircle className="mr-1 h-3 w-3" /> Reject
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-red-600 border-red-200 hover:bg-red-50 text-xs"
              onClick={() => setBulkDeleteConfirm(true)} disabled={isBulkActing}>
              <Trash2 className="mr-1 h-3 w-3" /> Delete
            </Button>
            <button type="button" className="btn-ghost h-7 text-xs px-2"
              onClick={() => setSelectedIds(new Set())}>
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── Results count ── */}
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span suppressHydrationWarning>
          {loading ? "Loading…" : `${pagination.total.toLocaleString()} properties`}
        </span>
        {(pagination.page > 1 || pagination.totalPages > 1) && (
          <span>Page {pagination.page} of {pagination.totalPages}</span>
        )}
      </div>

      {/* ── Table View ── */}
      {viewMode === "table" && (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header w-10">
                    <input
                      type="checkbox"
                      className="rounded"
                      checked={listings.length > 0 && selectedIds.size === listings.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="table-header w-16" />
                  <th className="table-header">
                    <button className="flex items-center gap-1 hover:text-gray-600" onClick={() => handleSort("title")}>
                      Property <SortIcon field="title" />
                    </button>
                  </th>
                  <th className="table-header whitespace-nowrap">Source</th>
                  <th className="table-header">
                    <button className="flex items-center gap-1 hover:text-gray-600" onClick={() => handleSort("price")}>
                      Price <SortIcon field="price" />
                    </button>
                  </th>
                  <th className="table-header whitespace-nowrap">Beds / Size</th>
                  <th className="table-header">BMV</th>
                  <th className="table-header whitespace-nowrap">
                    <button className="flex items-center gap-1 hover:text-gray-600" onClick={() => handleSort("motivationScore")}>
                      Motivation <SortIcon field="motivationScore" />
                    </button>
                  </th>
                  <th className="table-header">Status</th>
                  <th className="table-header">
                    <button className="flex items-center gap-1 hover:text-gray-600 whitespace-nowrap" onClick={() => handleSort("daysOnMarket")}>
                      Days <SortIcon field="daysOnMarket" />
                    </button>
                  </th>
                  <th className="table-header">
                    <button className="flex items-center gap-1 hover:text-gray-600 whitespace-nowrap" onClick={() => handleSort("scrapedAt")}>
                      Scraped <SortIcon field="scrapedAt" />
                    </button>
                  </th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={12} className="table-cell py-16 text-center text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading properties…
                    </td>
                  </tr>
                ) : listings.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="table-cell py-16 text-center text-gray-400">
                      No properties found
                    </td>
                  </tr>
                ) : listings.map(listing => {
                  const bmv = listing.bmvIndicators as BmvIndicatorsData
                  const address = listing.address as any
                  const images = listing.images as string[]
                  return (
                    <tr
                      key={listing.id}
                      className={`table-row ${selectedIds.has(listing.id) ? "bg-[#EFF6FF]" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="table-cell">
                        <input type="checkbox" className="rounded"
                          checked={selectedIds.has(listing.id)}
                          onChange={() => toggleSelect(listing.id)} />
                      </td>

                      {/* Thumbnail */}
                      <td className="table-cell">
                        {images?.[0] ? (
                          <img src={images[0]} alt="" className="h-9 w-14 rounded-md object-cover" />
                        ) : (
                          <div className="h-9 w-14 rounded-md bg-gray-100" />
                        )}
                      </td>

                      {/* Property */}
                      <td className="table-cell max-w-[220px]">
                        <p className="font-medium text-xs text-gray-800 truncate">{listing.title}</p>
                        <p className="text-gray-400 truncate text-xs mt-0.5">
                          {listing.isWelsh && <span className="mr-1">🏴󠁧󠁢󠁷󠁬󠁳󠁿</span>}
                          {address?.displayAddress}
                          {address?.postcode && ` · ${address.postcode}`}
                        </p>
                      </td>

                      {/* Source */}
                      <td className="table-cell">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_COLORS[listing.source] || "bg-gray-100 text-gray-600"}`}>
                          {SOURCE_LABELS[listing.source] || listing.source}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="table-cell font-semibold text-gray-800 whitespace-nowrap" suppressHydrationWarning>
                        £{listing.price.toLocaleString()}
                      </td>

                      {/* Beds / Size */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
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
                          <p suppressHydrationWarning className="text-xs text-gray-400 mt-0.5">
                            {listing.squareFeet.toLocaleString()} sq ft
                          </p>
                        )}
                      </td>

                      {/* BMV Score */}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${bmv?.bmvScore >= 60 ? "bg-green-500" : bmv?.bmvScore >= 30 ? "bg-yellow-500" : "bg-gray-300"}`}
                              style={{ width: `${bmv?.bmvScore ?? 0}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${bmv?.bmvScore >= 60 ? "text-green-600" : bmv?.bmvScore >= 30 ? "text-yellow-600" : "text-gray-400"}`}>
                            {bmv?.bmvScore ?? 0}
                          </span>
                        </div>
                      </td>

                      {/* Motivation Score */}
                      <td className="table-cell">
                        {(() => {
                          const ms = listing.motivationScore ?? 0
                          if (ms === 0) return <span className="text-xs text-gray-300">—</span>
                          const color = ms >= 70 ? "bg-red-500" : ms >= 45 ? "bg-orange-500" : "bg-amber-400"
                          const textColor = ms >= 70 ? "text-red-600" : ms >= 45 ? "text-orange-600" : "text-amber-600"
                          return (
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className={`h-full rounded-full ${color}`} style={{ width: `${ms}%` }} />
                              </div>
                              <span className={`text-xs font-semibold ${textColor}`}>{ms}</span>
                            </div>
                          )
                        })()}
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_STYLES[listing.reviewStatus] || "bg-gray-100 text-gray-600"}`}>
                          {STATUS_LABELS[listing.reviewStatus] || listing.reviewStatus}
                        </span>
                      </td>

                      {/* Days */}
                      <td className="table-cell text-xs text-gray-400 whitespace-nowrap">
                        {listing.daysOnMarket > 0
                          ? `${listing.daysOnMarket}d`
                          : listing.daysOnMarket < 0
                            ? `${Math.abs(listing.daysOnMarket)}d+`
                            : "—"}
                      </td>

                      {/* Scraped */}
                      <td className="table-cell text-xs text-gray-400 whitespace-nowrap" suppressHydrationWarning>
                        {new Date(listing.scrapedAt).toLocaleDateString()}
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost"
                            className={`h-7 w-7 ${listing.isFavorited ? "text-[#F5A623] hover:text-[#E09518]" : "text-gray-400"}`}
                            title={listing.isFavorited ? "Remove favourite" : "Add to favourites"}
                            onClick={() => toggleFavorite(listing.id, listing.isFavorited)}>
                            <Star className={`h-3.5 w-3.5 ${listing.isFavorited ? "fill-[#F5A623]" : ""}`} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400"
                            title="View details"
                            onClick={() => setSelectedListing(listing)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          {listing.reviewStatus !== "APPROVED" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:bg-green-50"
                              title="Approve"
                              onClick={() => handleReview(listing.id, "APPROVED")}
                              disabled={submittingIds.has(listing.id)}>
                              {submittingIds.has(listing.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <Check className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {listing.reviewStatus !== "REJECTED" && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:bg-red-50"
                              title="Reject"
                              onClick={() => handleReview(listing.id, "REJECTED")}
                              disabled={submittingIds.has(listing.id)}>
                              {submittingIds.has(listing.id)
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <X className="h-3.5 w-3.5" />}
                            </Button>
                          )}
                          {listing.listingUrl && (
                            <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" title="View original">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                            </a>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-500 hover:bg-red-50"
                            title="Delete"
                            onClick={() => setDeleteTarget({ id: listing.id, title: listing.title })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Grid View ── */}
      {viewMode === "grid" && (
        loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Loading properties…
          </div>
        ) : listings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <p className="text-sm font-medium text-gray-500">No properties found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {listings.map(listing => (
              <PropertyCard
                key={listing.id}
                listing={listing}
                isSelected={selectedListing?.id === listing.id}
                onSelect={(l) => setSelectedListing(l)}
                onFavorite={toggleFavorite}
                onAddToPipeline={(l) => setSelectedListing(l)}
              />
            ))}
          </div>
        )
      )}

      {/* ── Map View — split pane ── */}
      {viewMode === "map" && (
        <div
          className="flex gap-4 overflow-hidden rounded-xl"
          style={{ height: "calc(100vh - 280px)", minHeight: 500 }}
        >
          {/* Left: scrollable card list */}
          <div className="w-[380px] flex-shrink-0 overflow-y-auto space-y-3 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Loading…
              </div>
            ) : listings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
                <p className="text-sm">No properties found</p>
              </div>
            ) : (
              listings.map((listing) => (
                <PropertyCard
                  key={listing.id}
                  listing={listing}
                  isSelected={mapSelectedId === listing.id}
                  compact
                  onSelect={(l) => {
                    setMapSelectedId(l.id)
                    setSelectedListing(l)
                  }}
                  onFavorite={toggleFavorite}
                  onAddToPipeline={(l) => setSelectedListing(l)}
                />
              ))
            )}

            {/* Load more / pagination for map mode */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3">
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchListings(pagination.page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-500">
                  {pagination.page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline" size="sm"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchListings(pagination.page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Right: Leaflet map */}
          <div className="flex-1 min-w-0">
            <PropertyMap
              listings={listings}
              selectedId={mapSelectedId}
              onSelect={(id) => {
                setMapSelectedId(id)
                const l = listings.find((x) => x.id === id)
                if (l) setSelectedListing(l)
              }}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* ── Pagination (table + grid only) ── */}
      {viewMode !== "map" && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-400" suppressHydrationWarning>
            Showing {((pagination.page - 1) * LIMIT) + 1}–{Math.min(pagination.page * LIMIT, pagination.total)} of {pagination.total.toLocaleString()}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-8 w-8 p-0"
              disabled={pagination.page <= 1}
              onClick={() => fetchListings(pagination.page - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
              const totalP = pagination.totalPages
              const cur = pagination.page
              let start = Math.max(1, cur - 2)
              const end = Math.min(totalP, start + 4)
              start = Math.max(1, end - 4)
              return start + i
            }).filter(p => p <= pagination.totalPages).map(p => (
              <Button key={p}
                variant={p === pagination.page ? "default" : "outline"}
                size="sm" className={`h-8 w-8 p-0 text-xs ${p === pagination.page ? "bg-[#1A1A1F] text-white hover:bg-[#2A2A32]" : ""}`}
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

      {/* ── Modals ── */}
      <PropertyDetailModal
        listing={selectedListing}
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onReview={handleReview}
        isSubmitting={selectedListing ? submittingIds.has(selectedListing.id) : false}
      />

      <Dialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete property?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            <span className="font-medium text-gray-800">{deleteTarget?.title}</span> will be permanently removed.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteTarget && confirmDelete(deleteTarget.id)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete {selectedIds.size} properties?</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500">
            These {selectedIds.size} properties will be permanently removed. This cannot be undone.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setBulkDeleteConfirm(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleBulkDelete}>Delete {selectedIds.size}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
