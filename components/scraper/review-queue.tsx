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
import { Badge } from "@/components/ui/badge"
import { Search, CheckCheck, XCircle, ArrowUpDown } from "lucide-react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { ReviewQueueFilters, type ReviewFilters } from "./review-queue-filters"
import { ReviewQueuePagination } from "./review-queue-pagination"
import { PropertyReviewCard } from "./property-review-card"
import { PropertyDetailModal } from "./property-detail-modal"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"

const ITEMS_PER_PAGE = 12

type SortField = "scrapedAt" | "price" | "bmvScore" | "daysOnMarket"

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
  })
  const [sortField, setSortField] = useState<SortField>("scrapedAt")
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedListing, setSelectedListing] =
    useState<PropertyListingForClient | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Sync listings when server re-renders after router.refresh()
  useEffect(() => {
    setListings(initialListings)
  }, [initialListings])

  // Reset page when filters/search change
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
      return true
    })
  }, [searchFiltered, filters])

  // Sorting
  const sortedListings = useMemo(() => {
    return [...filteredListings].sort((a, b) => {
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
        default:
          aVal = new Date(a.scrapedAt).getTime()
          bVal = new Date(b.scrapedAt).getTime()
      }

      return sortDirection === "asc" ? aVal - bVal : bVal - aVal
    })
  }, [filteredListings, sortField, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedListings.length / ITEMS_PER_PAGE)
  const paginatedListings = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE
    return sortedListings.slice(start, start + ITEMS_PER_PAGE)
  }, [sortedListings, currentPage])

  // Review handler
  const handleReview = async (
    id: string,
    action: "APPROVED" | "REJECTED",
    notes?: string
  ) => {
    setIsSubmitting(true)
    try {
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

      // Remove from local state
      setListings((prev) => prev.filter((l) => l.id !== id))
      setSelectedListing(null)

      if (action === "APPROVED" && data.dealId) {
        toast.success("Approved — added to Vendor pipeline", {
          action: {
            label: "View Vendors",
            onClick: () => router.push("/dashboard/vendors"),
          },
        })
      } else {
        toast.success(
          `Property ${action === "APPROVED" ? "approved" : "rejected"}`
        )
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Bulk review handler
  const handleBulkReview = async (action: "APPROVED" | "REJECTED") => {
    const ids = sortedListings.map((l) => l.id)
    if (ids.length === 0) return

    const confirmed = window.confirm(
      `Are you sure you want to ${action.toLowerCase()} ${ids.length} properties?`
    )
    if (!confirmed) return

    setIsSubmitting(true)
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
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Search + Sort */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, title, or postcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          <Select
            value={sortField}
            onValueChange={(v) => setSortField(v as SortField)}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scrapedAt">Date scraped</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="bmvScore">BMV Score</SelectItem>
              <SelectItem value="daysOnMarket">Days on market</SelectItem>
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
        <p className="text-sm text-muted-foreground">
          {sortedListings.length} properties
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
              disabled={isSubmitting}
            >
              <CheckCheck className="mr-1 h-3 w-3" />
              Approve all ({sortedListings.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600 border-red-200 hover:bg-red-50"
              onClick={() => handleBulkReview("REJECTED")}
              disabled={isSubmitting}
            >
              <XCircle className="mr-1 h-3 w-3" />
              Reject all
            </Button>
          </div>
        )}
      </div>

      {/* Card Grid */}
      {paginatedListings.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {paginatedListings.map((listing) => (
            <PropertyReviewCard
              key={listing.id}
              listing={listing}
              onApprove={(id) => handleReview(id, "APPROVED")}
              onReject={(id) => handleReview(id, "REJECTED")}
              onViewDetails={setSelectedListing}
              isSubmitting={isSubmitting}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No properties to review
          </p>
          <p className="text-sm text-muted-foreground mt-1">
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
        totalItems={sortedListings.length}
        itemsPerPage={ITEMS_PER_PAGE}
      />

      {/* Detail Modal */}
      <PropertyDetailModal
        listing={selectedListing}
        open={!!selectedListing}
        onClose={() => setSelectedListing(null)}
        onReview={handleReview}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}
