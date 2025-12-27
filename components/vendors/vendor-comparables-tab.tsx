"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2, RefreshCw, Home, Settings, TrendingUp } from "lucide-react"
import {
  ComparablesGrid,
  ComparablesAnalysis,
  ComparablesSettings,
  type ComparableProperty,
} from "@/components/comparables"
import { toast } from "sonner"

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
  const [data, setData] = useState<ComparablesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    fetchComparables()
  }, [vendorLeadId])

  const fetchComparables = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/vendor-leads/${vendorLeadId}/comparables`)
      if (response.ok) {
        const result = await response.json()
        setData(result.data)
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Comparable Properties</h3>
          {data && data.lastFetchedAt && (
            <p className="text-sm text-muted-foreground mt-1">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString("en-GB")}
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
            variant={data && data.comparables.length > 0 ? "outline" : "default"}
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
                {data && data.comparables.length > 0 ? "Refresh" : "Fetch Comparables"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No postcode warning */}
      {!propertyPostcode && (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <Home className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Property postcode required</p>
              <p className="text-sm text-muted-foreground">
                Add a property postcode to fetch comparable properties in the area.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No comparables yet */}
      {propertyPostcode && (!data || data.comparables.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>No Comparables Yet</CardTitle>
            <CardDescription>
              Click &quot;Fetch Comparables&quot; to find similar properties that have sold in the area
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Comparables help you:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Estimate accurate market value</li>
                <li>Calculate BMV (Below Market Value) percentage</li>
                <li>Assess rental yield potential</li>
                <li>Make data-driven offers</li>
              </ul>
            </div>
          </CardContent>
        </Card>
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
                <Card className="bg-yellow-50 border-yellow-200">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-yellow-900">Rental Data Not Available</p>
                        <p className="text-sm text-yellow-800 mt-1">
                          These comparables were fetched before rental yield analysis was added. Click &quot;Refresh&quot; to fetch updated data with rental information for buy-to-let investment analysis.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            } else if (rentalDataCount < data.comparables.length) {
              return (
                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="py-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="h-5 w-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">Partial Rental Data</p>
                        <p className="text-sm text-blue-800 mt-1">
                          {rentalDataCount} of {data.comparables.length} properties have rental data. Some postcodes may not have rental information available.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
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
