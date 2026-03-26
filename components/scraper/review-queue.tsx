"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, CheckCheck, XCircle, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ReviewQueueFilters, type ReviewFilters } from "./review-queue-filters"
import { ReviewQueuePagination } from "./review-queue-pagination"
import { PropertyReviewCard } from "./property-review-card"
import { PropertyDetailModal } from "./property-detail-modal"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

const ITEMS_PER_PAGE = 12

type SortField = "scrapedAt" | "price" | "bmvScore" | "daysOnMarket" | "bedrooms" | "propertyType"

// Numeric order for property type sort (smallest unit → largest)
const PROPERTY_TYPE_ORDER: Record<string, number> = {
  "studio": 0,
  "studio flat": 1,
  "flat": 2,
  "maisonette": 3,
  "terraced house": 4,
  "end of terrace house": 5,
  "semi-detached house": 6,
  "detached house": 7,
  "bungalow": 8,
  "semi-detached bungalow": 9,
  "detached bungalow": 10,
  "cottage": 11,
  "villa": 12,
  "land": 13,
  "commercial property": 14,
}

// Listings grouped by postcode (duplicates share a single card)
type ListingGroup = {
  primary: PropertyListingForClient
  duplicates: PropertyListingForClient[]
}

const FULL_POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/

/**
 * Normalise a display address into a "street|area" key for fuzzy deduplication.
 * E.g. "Lon Camlad, Morriston, Swansea, ..." → "lon camlad|morriston"
 * Used as a fallback when one listing has no postcode.
 */
function addressKey(displayAddress: string): string {
  const parts = displayAddress.split(",").map((p) => p.trim().toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim())
  const street = parts[0] ?? ""
  const area   = parts[1] ?? ""
  // Require at least 5 chars for the street to avoid matching "flat" or "1" etc.
  if (street.length < 5) return ""
  return area ? `${street}|${area}` : street
}

interface ReviewQueueProps {
  listings: PropertyListingForClient[]
}

export function ReviewQueue({ listings: initialListings }: ReviewQueueProps) {
  const router = useRouter()
  const [listings, setListings] = useState(initialListings)
  const [searchQuery, setSearchQuery] = useState("")
  const [filters, setFilters] = useState<ReviewFilters>({
    source: null,
    category: null,
    isAmbiguous: null,
    minBmvScore: null,
    favoritesOnly: false,
  })
  const [sortField, setSortField] = useState<SortField>("scrapedAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedListing, setSelectedListing] =
    useState<PropertyListingForClient | null>(null)
  const [selectedDuplicates, setSelectedDuplicates] = useState<PropertyListingForClient[]>([])
  const [submittingIds, setSubmittingIds] = useState<Set<string>>(new Set())
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string;
    variant: "destructive" | "archive" | "warning" | "default";
    confirmLabel: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", variant: "default", confirmLabel: "Confirm", onConfirm: () => {} })

  // Sync listings when server re-renders after router.refresh()
  useEffect(() => {
    setListings(initialListings)
  }, [initialListings])

  // Reset page when filters/search/sort change
  useEffect(() => {
    setCurrentPage(1)
  }, [filters, searchQuery, sortField, sortDirection])

  // Search filtering
  const searchFiltered = useMemo(() => {
    if (!searchQuery.trim()) return listings
    const q = searchQuery.toLowerCase()
    return listings.filter((l) => {
      const addr = (l.address as any)?.displayAddress?.toLowerCase() || ""
      const postcode = (l.address as any)?.postcode?.toLowerCase() || ""
      const title = l.title.toLowerCase()
      return addr.includes(q) || title.includes(q) || postcode.includes(q)
    })
  }, [listings, searchQuery])

  // Apply filters
  const filteredListings = useMemo(() => {
    return searchFiltered.filter((l) => {
      if (filters.source && l.source !== filters.source) return false
      if (filters.category && l.category !== filters.category) return false
      if (filters.isAmbiguous !== null && l.isAmbiguous !== filters.isAmbiguous)
        return false
      const bmvScore = (l.bmvIndicators as BmvIndicatorsData)?.bmvScore ?? 0
      if (filters.minBmvScore !== null && bmvScore < filters.minBmvScore)
        return false
      if (filters.favoritesOnly && !l.isFavorited) return false
      return true
    })
  }, [searchFiltered, filters])

  // Sorting
  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
      // String-based sort for property type
      if (sortField === "propertyType") {
        const aOrder = PROPERTY_TYPE_ORDER[a.propertyType?.toLowerCase() ?? ""] ?? 50
        const bOrder = PROPERTY_TYPE_ORDER[b.propertyType?.toLowerCase() ?? ""] ?? 50
        return sortDirection === "asc" ? aOrder - bOrder : bOrder - aOrder
      }

      let aVal: number
      let bVal: number

      switch (sortField) {
        case "price":
          aVal = a.price
          bVal = b.price
          break
        case "bmvScore":
          aVal = (a.bmvIndicators as BmvIndicatorsData)?.bmvScore ?? 0
          bVal = (b.bmvIndicators as BmvIndicatorsData)?.bmvScore ?? 0
          break
        case "daysOnMarket":
          aVal = a.daysOnMarket
          bVal = b.daysOnMarket
          break
        case "bedrooms":
          aVal = a.bedrooms
          bVal = b.bedrooms
          break
        default: // scrapedAt
          aVal = new Date(a.scrapedAt).getTime()
          bVal = new Date(b.scrapedAt).getTime()
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal
    })
  }, [filteredListings, sortField, sortDirection])

  // Group by postcode (pass 1) then by address key (pass 2 fallback for no-postcode listings)
  const groupedListings = useMemo<ListingGroup[]>(() => {
    const consumed = new Set<string>()
    const groups: ListingGroup[] = []

    // ── Pass 1: group by exact full postcode ──────────────────────────────────
    for (const listing of sortedListings) {
      if (consumed.has(listing.id)) continue

      const pc = ((listing.address as any)?.postcode ?? "").trim().toUpperCase()
      const isFullPostcode = FULL_POSTCODE_RE.test(pc)

      const duplicates: PropertyListingForClient[] = []
      if (isFullPostcode) {
        for (const other of sortedListings) {
          if (other.id === listing.id || consumed.has(other.id)) continue
          const otherPc = ((other.address as any)?.postcode ?? "").trim().toUpperCase()
          if (otherPc === pc) {
            duplicates.push(other)
            consumed.add(other.id)
          }
        }
      }

      consumed.add(listing.id)
      groups.push({ primary: listing, duplicates })
    }

    // ── Pass 2: fold no-postcode listings into an existing group if the
    //            normalised street+area matches (catches OTM/PL address-only duplicates)
    // Build address-key → group index map for groups that have a full postcode
    const addrKeyToGroup = new Map<string, number>()
    groups.forEach((g, idx) => {
      const pc = ((g.primary.address as any)?.postcode ?? "").trim().toUpperCase()
      if (!FULL_POSTCODE_RE.test(pc)) return
      const key = addressKey((g.primary.address as any)?.displayAddress ?? "")
      if (key) addrKeyToGroup.set(key, idx)
    })

    // Walk groups that have NO full postcode and try to fold them
    const toRemove = new Set<number>()
    groups.forEach((g, idx) => {
      const pc = ((g.primary.address as any)?.postcode ?? "").trim().toUpperCase()
      if (FULL_POSTCODE_RE.test(pc)) return  // already has a postcode — skip
      const key = addressKey((g.primary.address as any)?.displayAddress ?? "")
      if (!key) return
      const targetIdx = addrKeyToGroup.get(key)
      if (targetIdx === undefined || targetIdx === idx) return

      // Merge this group into the target group as duplicates
      groups[targetIdx].duplicates.push(g.primary, ...g.duplicates)
      toRemove.add(idx)
    })

    return toRemove.size > 0 ? groups.filter((_, i) => !toRemove.has(i)) : groups
  }, [sortedListings])

  // Pagination (over groups, not raw listings)
  const totalPages = Math.ceil(groupedListings.length / ITEMS_PER_PAGE)
  const paginatedGroups = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return groupedListings.slice(start, start + ITEMS_PER_PAGE)
  }, [groupedListings, currentPage])

  // Review handler — handles single listing OR a postcode group
  const handleReview = async (
    id: string,
    action: "APPROVED" | "REJECTED",
    notes?: string,
    extraIds?: string[]
  ) => {
    const allIds = extraIds?.length ? [id, ...extraIds] : [id]
    setSubmittingIds((prev) => {
      const next = new Set(prev)
      allIds.forEach((i) => next.add(i))
      return next
    })

    try {
      let dealId: string | null = null

      if (allIds.length === 1) {
        // Single review
        const res = await fetch(`/api/review-queue/${id}/review`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, notes }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to review property")
        }
        const data = await res.json()
        dealId = data.dealId || null
      } else {
        // Grouped review — use bulk endpoint
        const res = await fetch("/api/review-queue/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, ids: allIds }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || "Failed to review properties")
        }
        const data = await res.json()
        dealId = data.dealIds?.[0] || null
      }

      // Remove all reviewed listings from local state
      setListings((prev) => prev.filter((l) => !allIds.includes(l.id)))
      setSelectedListing(null)
      setSelectedDuplicates([])

      if (action === "APPROVED" && dealId) {
        toast.success(
          allIds.length > 1
            ? `${allIds.length} listings approved — added to Vendor pipeline`
            : "Approved — added to Vendor pipeline",
          {
            action: {
              label: "View Vendors",
              onClick: () => router.push("/dashboard/vendors"),
            },
          }
        )
      } else {
        toast.success(
          allIds.length > 1
            ? `${allIds.length} listings ${action === "APPROVED" ? "approved" : "rejected"}`
            : `Property ${action === "APPROVED" ? "approved" : "rejected"}`
        )
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSubmittingIds((prev) => {
        const next = new Set(prev)
        allIds.forEach((i) => next.delete(i))
        return next
      })
    }
  }

  // Bulk review handler (applies to all currently filtered listings)
  const handleBulkReview = (action: "APPROVED" | "REJECTED") => {
    const ids = sortedListings.map((l) => l.id)
    if (ids.length === 0) return

    setConfirmDialog({
      open: true,
      title: `${action === "APPROVED" ? "Approve" : "Reject"} ${ids.length} ${ids.length !== 1 ? "properties" : "property"}?`,
      description: action === "APPROVED"
        ? "The selected properties will be approved and moved to your deals pipeline."
        : "The selected properties will be rejected and removed from the review queue.",
      variant: action === "APPROVED" ? "default" : "destructive",
      confirmLabel: action === "APPROVED" ? "Approve" : "Reject",
      onConfirm: async () => {
        setIsBulkSubmitting(true)
        try {
          const res = await fetch("/api/review-queue/bulk", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, ids }),
          })

          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error || "Failed to bulk review")
          }

          const data = await res.json()
          setListings((prev) => prev.filter((l) => !ids.includes(l.id)))

          if (action === "APPROVED" && data.dealIds?.length) {
            toast.success(`${data.updatedCount} added to Vendor pipeline`, {
              action: {
                label: "View Vendors",
                onClick: () => router.push("/dashboard/vendors"),
              },
            })
          } else {
            toast.success(`${data.updatedCount} properties ${action.toLowerCase()}`)
          }
        } catch (error: any) {
          toast.error(error.message)
        } finally {
          setIsBulkSubmitting(false)
        }
      },
    })
  }

  // How many postcode duplicates exist in the current filtered view
  const dupGroupCount = groupedListings.filter((g) => g.duplicates.length > 0).length

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by address, title, or postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-gray-400" />
          <Select
            value={sortField}
            onValueChange={(v) => setSortField(v as SortField)}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scrapedAt">Date scraped</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="bmvScore">BMV Score</SelectItem>
              <SelectItem value="daysOnMarket">Days on market</SelectItem>
              <SelectItem value="bedrooms">Bedrooms</SelectItem>
              <SelectItem value="propertyType">Property type</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setSortDirection((d) => (d === "asc" ? "desc" : "asc"))
            }
          >
            {sortDirection === "asc" ? "Asc" : "Desc"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <ReviewQueueFilters filters={filters} onFiltersChange={setFilters} />

      {/* Results count + bulk actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {sortedListings.length} properties
          {dupGroupCount > 0 && (
            <span className="ml-1 text-gray-400/60">
              · {dupGroupCount} postcode {dupGroupCount === 1 ? "group" : "groups"}
            </span>
          )}
          {sortedListings.length !== listings.length &&
            ` (filtered from ${listings.length})`}
        </p>
        {sortedListings.length > 0 && (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-600 border-green-200 hover:bg-green-50"
              onClick={() => handleBulkReview("APPROVED")}
              disabled={isBulkSubmitting}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Approve all ({sortedListings.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleBulkReview("REJECTED")}
              disabled={isBulkSubmitting}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Reject all
            </Button>
          </div>
        )}
      </div>

      {/* Card Grid */}
      {paginatedGroups.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedGroups.map((group) => (
            <PropertyReviewCard
              key={group.primary.id}
              listing={group.primary}
              duplicates={group.duplicates}
              onApprove={(id) =>
                handleReview(id, "APPROVED", undefined, group.duplicates.map((d) => d.id))
              }
              onReject={(id) =>
                handleReview(id, "REJECTED", undefined, group.duplicates.map((d) => d.id))
              }
              onViewDetails={() => {
                setSelectedListing(group.primary)
                setSelectedDuplicates(group.duplicates)
              }}
              isSubmitting={
                submittingIds.has(group.primary.id) ||
                group.duplicates.some((d) => submittingIds.has(d.id)) ||
                isBulkSubmitting
              }
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-gray-400">
            No properties to review
          </p>
          <p className="text-sm text-gray-400 mt-1">
            {listings.length === 0
              ? "Run a scraper job to populate the review queue"
              : "Try adjusting your filters or search query"}
          </p>
        </div>
      )}

      {/* Pagination */}
      <ReviewQueuePagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={groupedListings.length}
        itemsPerPage={ITEMS_PER_PAGE}
      />

      {/* Detail Modal */}
      <PropertyDetailModal
        listing={selectedListing}
        duplicates={selectedDuplicates}
        open={!!selectedListing}
        onClose={() => {
          setSelectedListing(null)
          setSelectedDuplicates([])
        }}
        onReview={(id, action, notes) =>
          handleReview(id, action, notes, selectedDuplicates.map((d) => d.id))
        }
        isSubmitting={selectedListing ? submittingIds.has(selectedListing.id) : false}
      />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}
