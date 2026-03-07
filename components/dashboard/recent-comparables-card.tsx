"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, Home, Calendar, MapPin, ArrowRight, TrendingUp } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/format"

interface RecentComparable {
  id: string
  address: string
  postcode: string
  salePrice: number
  saleDate: string
  bedrooms?: number
  propertyType?: string
  distance?: number
  rentalYield?: number
  vendorLeadId: string
  fetchedAt: string
}

/**
 * Get yield color
 */
function getYieldColor(yield_?: number): string {
  if (!yield_) return "text-gray-400"
  if (yield_ >= 6) return "text-green-600"
  if (yield_ >= 4) return "text-yellow-600"
  return "text-red-600"
}

/**
 * RecentComparablesCard Component
 * Dashboard widget showing recently fetched comparable properties
 */
export function RecentComparablesCard({ limit = 10 }: { limit?: number }) {
  const [comparables, setComparables] = useState<RecentComparable[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchRecentComparables()
  }, [])

  const fetchRecentComparables = async () => {
    setIsLoading(true)
    try {
      // Fetch recent comparables across all vendor leads
      const response = await fetch(`/api/comparables/recent?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setComparables(data.comparables || [])
      }
    } catch (error) {
      console.error("Error fetching recent comparables:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">            <Home className="h-5 w-5" />
            Recent Comparables
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">Latest comparable properties fetched</p>
        </div>
        <div className="p-5 flex items-center justify-center py-8">          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="ds-card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--ds-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">              <Home className="h-5 w-5" />
              Recent Comparables
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {comparables.length === 0
                ? "No comparables fetched yet"
                : `${comparables.length} most recent properties`}
            </p>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/vendors">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
      <div className="p-5">
        {comparables.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <p>No comparable properties have been fetched yet.</p>
            <p className="text-sm mt-1">Start by fetching comparables for vendor leads.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comparables.map((comp) => (
              <Link
                key={comp.id}
                href={`/dashboard/vendors/${comp.vendorLeadId}`}
                className="block"
              >
                <div className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{comp.address}</h4>
                        <p className="text-xs text-gray-400 mt-0.5">{comp.postcode}</p>
                      </div>
                      {comp.rentalYield && (
                        <div className="shrink-0">
                          <div className={`text-sm font-semibold ${getYieldColor(comp.rentalYield)}`}>
                            {comp.rentalYield.toFixed(1)}%
                          </div>
                          <div className="text-xs text-gray-400 text-right">yield</div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      {comp.propertyType && (
                        <span className="flex items-center gap-1">
                          <Home className="h-3 w-3" />
                          {comp.propertyType}
                        </span>
                      )}
                      {comp.bedrooms && (
                        <span>{comp.bedrooms} bed</span>
                      )}
                      {comp.distance !== undefined && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {comp.distance.toFixed(1)} mi
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(comp.saleDate), "MMM yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right ml-3 shrink-0">
                    <div className="font-semibold text-sm">{formatCurrency(comp.salePrice)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {format(new Date(comp.fetchedAt), "MMM d")}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
