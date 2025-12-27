"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, TrendingUp, Home, MapPin, ArrowRight, Award } from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/format"

interface TopYieldComparable {
  id: string
  address: string
  postcode: string
  salePrice: number
  saleDate: string
  bedrooms?: number
  propertyType?: string
  distance?: number
  rentalYield: number
  monthlyRent?: number
  vendorLeadId: string
}

/**
 * Get yield badge variant
 */
function getYieldBadge(yield_: number): {
  label: string
  variant: "default" | "secondary" | "destructive"
  color: string
} {
  if (yield_ >= 7) {
    return { label: "Excellent", variant: "default", color: "text-green-600" }
  }
  if (yield_ >= 6) {
    return { label: "Very Good", variant: "default", color: "text-green-600" }
  }
  if (yield_ >= 5) {
    return { label: "Good", variant: "secondary", color: "text-yellow-600" }
  }
  return { label: "Fair", variant: "secondary", color: "text-yellow-600" }
}

/**
 * TopYieldsCard Component
 * Dashboard widget showing properties with highest rental yields
 */
export function TopYieldsCard({ limit = 10 }: { limit?: number }) {
  const [comparables, setComparables] = useState<TopYieldComparable[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchTopYields()
  }, [])

  const fetchTopYields = async () => {
    setIsLoading(true)
    try {
      // Fetch top yielding properties
      const response = await fetch(`/api/comparables/top-yields?limit=${limit}`)
      if (response.ok) {
        const data = await response.json()
        setComparables(data.comparables || [])
      }
    } catch (error) {
      console.error("Error fetching top yields:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top Rental Yields
          </CardTitle>
          <CardDescription>Properties with highest investment potential</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Top Rental Yields
            </CardTitle>
            <CardDescription>
              {comparables.length === 0
                ? "No rental data available yet"
                : `${comparables.length} highest-yielding properties`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/vendors">
              View All
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {comparables.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No rental yield data available yet.</p>
            <p className="text-sm mt-1">Fetch comparables with rental data to see investment opportunities.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comparables.map((comp, index) => {
              const yieldBadge = getYieldBadge(comp.rentalYield)
              return (
                <Link
                  key={comp.id}
                  href={`/dashboard/vendors/${comp.vendorLeadId}`}
                  className="block"
                >
                  <div className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    {/* Rank Badge */}
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 shrink-0">
                      {index === 0 && <Award className="h-4 w-4 text-yellow-600" />}
                      {index !== 0 && <span className="text-sm font-bold text-muted-foreground">#{index + 1}</span>}
                    </div>

                    {/* Property Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-sm truncate">{comp.address}</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">{comp.postcode}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`text-lg font-bold ${yieldBadge.color}`}>
                            {comp.rentalYield.toFixed(2)}%
                          </div>
                          <Badge variant={yieldBadge.variant} className="text-xs">
                            {yieldBadge.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        {comp.propertyType && (
                          <span className="flex items-center gap-1">
                            <Home className="h-3 w-3" />
                            {comp.propertyType}
                          </span>
                        )}
                        {comp.bedrooms && <span>{comp.bedrooms} bed</span>}
                        {comp.distance !== undefined && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {comp.distance.toFixed(1)} mi
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <div className="text-xs">
                          <span className="text-muted-foreground">Sale: </span>
                          <span className="font-medium">{formatCurrency(comp.salePrice)}</span>
                        </div>
                        {comp.monthlyRent && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">Rent: </span>
                            <span className="font-medium">{formatCurrency(comp.monthlyRent)}/mo</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
