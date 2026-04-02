"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Home, Settings, TrendingUp, Clock } from "lucide-react"
import {
  ComparablesGrid,
  ComparablesAnalysis,
  ComparablesSettings,
  type ComparableProperty,
} from "@/components/comparables"
import { toast } from "sonner"

// Module-level cache — survives component unmount/remount (e.g. modal close/reopen)
// Keyed by vendorLeadId. Data is shown instantly on re-open without a loading spinner.
const _comparablesCache = new Map<string, ComparablesData>()

/** Call this after a table-level fetch so the modal re-loads fresh data on next open */
export function invalidateComparablesCache(vendorLeadId: string) {
  _comparablesCache.delete(vendorLeadId)
}

interface VendorComparablesTabProps {
  vendorLeadId: string
  askingPrice?: number
  propertyPostcode?: string | null
}

interface ComparablesData {
  comparables: ComparableProperty[]
  count: number
  avgPrice: number | null
  avgRentalYield: number | null
  priceRange: { min: number; max: number } | null
  rentalYieldRange: { min: number; max: number } | null
  confidence: string | null
  searchRadius: number | null
  lastFetchedAt: string | null
}

/**
 * VendorComparablesTab Component
 * Displays comparables for a specific vendor lead
 */
export function VendorComparablesTab({
  vendorLeadId,
  askingPrice,
  propertyPostcode,
}: VendorComparablesTabProps) {
  // Seed state from module cache so re-opens are instant (no spinner, no re-fetch)
  const [data, setData] = useState<ComparablesData | null>(() => _comparablesCache.get(vendorLeadId) ?? null)
  const [isLoading, setIsLoading] = useState(() => !_comparablesCache.has(vendorLeadId))
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    // If we already have cached data for this lead, skip the network round-trip
    if (_comparablesCache.has(vendorLeadId)) return
    fetchComparables()
  }, [vendorLeadId])

  const fetchComparables = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/vendor-leads/${vendorLeadId}/comparables`)
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          setData(result.data)
          _comparablesCache.set(vendorLeadId, result.data)
        }
      }
    } catch (error) {
      console.error("Error fetching comparables:", error)
      toast.error("Failed to load comparables")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFetchNew = async (forceRefresh: boolean = false) => {
    if (!propertyPostcode) {
      toast.error("Property postcode is required to fetch comparables")
      return
    }

    setIsFetching(true)
    try {
      const response = await fetch(
        `/api/vendor-leads/${vendorLeadId}/fetch-comparables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh }),
        }
      )

      const result = await response.json()

      if (response.ok) {
        setData(result.data)
        _comparablesCache.set(vendorLeadId, result.data)
        toast.success(
          result.cached
            ? "Using cached comparables"
            : `Fetched ${result.data.count} comparables (${result.data.creditsUsed} credits used)`
        )
      } else {
        throw new Error(result.error || "Failed to fetch comparables")
      }
    } catch (error: any) {
      console.error("Error fetching comparables:", error)
      toast.error(error.message || "Failed to fetch comparables")
    } finally {
      setIsFetching(false)
    }
  }

  const isStale = (lastFetchedAt: string | null): boolean => {
    if (!lastFetchedAt) return true
    const daysSince = (Date.now() - new Date(lastFetchedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 7
  }

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const dataIsStale = data ? isStale(data.lastFetchedAt) : false

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Comparable Properties</h3>
          {data && data.lastFetchedAt && (
            <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString("en-GB")}
              {dataIsStale && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                  <Clock className="h-3 w-3" />
                  Stale — over 7 days old
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <ComparablesSettings
            trigger={
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            }
            onConfigChange={() => {
              toast.info("Settings updated. Fetch comparables to apply changes.")
            }}
          />
          <Button
            variant={dataIsStale || !(data && data.comparables.length > 0) ? "default" : "outline"}
            size="sm"
            onClick={() => handleFetchNew(!!(data && data.comparables.length > 0))}
            disabled={isFetching || !propertyPostcode}
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {data && data.comparables.length > 0 ? (dataIsStale ? "Refresh (Stale)" : "Refresh") : "Fetch Comparables"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No postcode warning */}
      {!propertyPostcode && (
        <div className="ds-card overflow-hidden">
          <div className="p-5 flex items-center gap-3 py-6">            <Home className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium">Property postcode required</p>
              <p className="text-sm text-gray-400">
                Add a property postcode to fetch comparable properties in the area.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No comparables yet */}
      {propertyPostcode && (!data || data.comparables.length === 0) && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900">No Comparables Yet</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              Click &quot;Fetch Comparables&quot; to find similar properties that have sold in the area
            </p>
          </div>
          <div className="p-5">
            <div className="space-y-2 text-sm text-gray-400">
              <p>Comparables help you:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Estimate accurate market value</li>
                <li>Calculate BMV (Below Market Value) percentage</li>
                <li>Assess rental yield potential</li>
                <li>Make data-driven offers</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Comparables data */}
      {data && data.comparables.length > 0 && (
        <>
          {/* Rental Data Status Info */}
          {(() => {
            const hasRentalData = data.comparables.some(c => c.monthlyRent)
            const rentalDataCount = data.comparables.filter(c => c.monthlyRent).length

            if (!hasRentalData) {
              return (
                <div className="ds-card overflow-hidden bg-yellow-50 border-yellow-200">                  <div className="p-5 py-4">                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">Rental Data Not Available</p>
                        <p className="text-sm text-yellow-800 mt-1">
                          These comparables were fetched before rental yield analysis was added. Click &quot;Refresh&quot; to fetch updated data with rental information for buy-to-let investment analysis.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            } else if (rentalDataCount < data.comparables.length) {
              return (
                <div className="ds-card overflow-hidden bg-blue-50 border-blue-200">                  <div className="p-5 py-4">                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">Partial Rental Data</p>
                        <p className="text-sm text-blue-800 mt-1">
                          {rentalDataCount} of {data.comparables.length} properties have rental data. Some postcodes may not have rental information available.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Analysis Summary */}
          <ComparablesAnalysis
            comparables={data.comparables}
            askingPrice={askingPrice}
            showRentalData={true}
          />

          {/* Comparables Grid */}
          <ComparablesGrid
            comparables={data.comparables}
            showRentalData={true}
            isLoading={false}
            emptyMessage="No comparable properties found"
          />
        </>
      )}
    </div>
  )
}
