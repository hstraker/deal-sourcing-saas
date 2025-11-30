"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  Info,
  RefreshCw,
  MapPin,
  Home,
  PoundSterling,
  Calendar,
} from "lucide-react"

interface PropertyAnalysisPanelProps {
  dealId: string
  address: string
  postcode?: string | null
  askingPrice: number
}

interface PropertyDataResponse {
  success: boolean
  data?: {
    bedrooms?: number
    bathrooms?: number
    squareFeet?: number
    propertyType?: string
    estimatedValue?: number
    valueRange?: {
      min: number
      max: number
    }
    estimatedMonthlyRent?: number
    estimatedRentalYield?: number
    comparables?: Array<{
      address: string
      salePrice: number
      saleDate: string
      bedrooms: number
      bathrooms?: number
      squareFeet?: number
      distance: number
      propertyType: string
    }>
    areaStats?: {
      averagePrice: number
      pricePerSquareFoot: number
      growthLastYear: number
      growthLast5Years: number
      rentalYield: number
    }
    recentSales?: Array<{
      salePrice: number
      saleDate: string
      saleType: string
    }>
  }
  analysis?: {
    insights: string[]
    recommendations: string[]
    riskFactors: string[]
  }
  error?: string
  cached?: boolean
  fetchedAt?: string
}

export function PropertyAnalysisPanel({
  dealId,
  address,
  postcode,
  askingPrice,
}: PropertyAnalysisPanelProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [propertyData, setPropertyData] = useState<PropertyDataResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async (forceRefresh = false) => {
    setIsLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        address: address.trim(),
        ...(postcode && { postcode: postcode.trim() }),
        ...(forceRefresh && { refresh: "true" }),
      })

      const response = await fetch(`/api/propertydata?${params.toString()}`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to fetch property data")
      }

      const data: PropertyDataResponse = await response.json()
      setPropertyData(data)
    } catch (err) {
      console.error("Error fetching property data:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch property data")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    // Auto-fetch on mount
    fetchData()
  }, [address, postcode])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const calculateBMV = () => {
    if (!propertyData?.data?.estimatedValue) return null
    const bmv = ((propertyData.data.estimatedValue - askingPrice) / propertyData.data.estimatedValue) * 100
    return bmv
  }

  const bmv = calculateBMV()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Property Analysis</CardTitle>
            <CardDescription>
              Comprehensive market data and investment insights
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && !propertyData && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {propertyData && propertyData.data && (
          <>
            {/* BMV Analysis */}
            {propertyData.data.estimatedValue && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <PoundSterling className="h-4 w-4" />
                  Valuation Analysis
                </h4>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <div className="text-xs text-muted-foreground">Estimated Market Value</div>
                    <div className="text-lg font-bold">
                      {formatCurrency(propertyData.data.estimatedValue)}
                    </div>
                    {propertyData.data.valueRange && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Range: {formatCurrency(propertyData.data.valueRange.min)} - {formatCurrency(propertyData.data.valueRange.max)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Asking Price</div>
                    <div className="text-lg font-bold">{formatCurrency(askingPrice)}</div>
                    {bmv !== null && (
                      <div className={`text-xs font-semibold mt-1 ${bmv > 0 ? "text-green-600" : "text-red-600"}`}>
                        {bmv > 0 ? "Below" : "Above"} Market Value: {Math.abs(bmv).toFixed(1)}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Analysis Insights */}
            {propertyData.analysis && (
              <div className="space-y-3">
                {propertyData.analysis.insights.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      Key Insights
                    </h4>
                    <div className="space-y-1">
                      {propertyData.analysis.insights.map((insight, idx) => (
                        <div key={idx} className="text-sm flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/20 rounded">
                          <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {propertyData.analysis.recommendations.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Info className="h-4 w-4 text-blue-600" />
                      Recommendations
                    </h4>
                    <div className="space-y-1">
                      {propertyData.analysis.recommendations.map((rec, idx) => (
                        <div key={idx} className="text-sm flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
                          <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <span>{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {propertyData.analysis.riskFactors.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-orange-600" />
                      Risk Factors
                    </h4>
                    <div className="space-y-1">
                      {propertyData.analysis.riskFactors.map((risk, idx) => (
                        <div key={idx} className="text-sm flex items-start gap-2 p-2 bg-orange-50 dark:bg-orange-950/20 rounded">
                          <AlertCircle className="h-4 w-4 text-orange-600 mt-0.5 flex-shrink-0" />
                          <span>{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Area Statistics */}
            {propertyData.data.areaStats && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Area Market Statistics
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Average Price</div>
                    <div className="text-lg font-bold">
                      {formatCurrency(propertyData.data.areaStats.averagePrice)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Price per sq ft</div>
                    <div className="text-lg font-bold">
                      {formatCurrency(propertyData.data.areaStats.pricePerSquareFoot)}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">1 Year Growth</div>
                    <div className={`text-lg font-bold ${propertyData.data.areaStats.growthLastYear > 0 ? "text-green-600" : "text-red-600"}`}>
                      {propertyData.data.areaStats.growthLastYear > 0 ? "+" : ""}
                      {propertyData.data.areaStats.growthLastYear.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">5 Year Growth</div>
                    <div className={`text-lg font-bold ${propertyData.data.areaStats.growthLast5Years > 0 ? "text-green-600" : "text-red-600"}`}>
                      {propertyData.data.areaStats.growthLast5Years > 0 ? "+" : ""}
                      {propertyData.data.areaStats.growthLast5Years.toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs text-muted-foreground">Area Rental Yield</div>
                    <div className="text-lg font-bold">
                      {propertyData.data.areaStats.rentalYield.toFixed(1)}%
                    </div>
                  </div>
                  {propertyData.data.estimatedRentalYield && (
                    <div className="p-3 bg-muted rounded-lg">
                      <div className="text-xs text-muted-foreground">Property Yield</div>
                      <div className="text-lg font-bold">
                        {propertyData.data.estimatedRentalYield.toFixed(1)}%
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Comparable Sales */}
            {propertyData.data.comparables && propertyData.data.comparables.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Home className="h-4 w-4" />
                  Comparable Sales ({propertyData.data.comparables.length})
                </h4>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Price</TableHead>
                        <TableHead>Bedrooms</TableHead>
                        <TableHead>Distance</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {propertyData.data.comparables.slice(0, 10).map((comp, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="text-sm">{comp.address}</TableCell>
                          <TableCell className="font-medium">
                            {formatCurrency(comp.salePrice)}
                          </TableCell>
                          <TableCell>{comp.bedrooms}</TableCell>
                          <TableCell>{comp.distance.toFixed(1)} mi</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(comp.saleDate)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* Historical Sales */}
            {propertyData.data.recentSales && propertyData.data.recentSales.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Historical Sales
                </h4>
                <div className="space-y-2">
                  {propertyData.data.recentSales.map((sale, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-muted rounded text-sm">
                      <div>
                        <div className="font-medium">{formatCurrency(sale.salePrice)}</div>
                        <div className="text-xs text-muted-foreground">{sale.saleType}</div>
                      </div>
                      <div className="text-muted-foreground">{formatDate(sale.saleDate)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {propertyData.cached && propertyData.fetchedAt && (
              <div className="text-xs text-muted-foreground text-center pt-2 border-t">
                Cached data • Last fetched: {new Date(propertyData.fetchedAt).toLocaleString()}
              </div>
            )}
          </>
        )}

        {!isLoading && !propertyData && !error && (
          <div className="text-center py-8 text-muted-foreground">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Click refresh to fetch property analysis data</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

