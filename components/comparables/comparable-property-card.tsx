"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Home,
  Bed,
  Bath,
  MapPin,
  Calendar,
  TrendingUp,
  ExternalLink,
  PoundSterling,
  Ruler,
  CheckCircle2
} from "lucide-react"
import { format } from "date-fns"
import { formatCurrency } from "@/lib/format"

export interface ComparableProperty {
  id: string
  address: string
  postcode?: string
  salePrice: number
  saleDate: string
  bedrooms?: number
  bathrooms?: number
  propertyType?: string
  squareFeet?: number
  distance?: number
  daysOnMarket?: number
  priceReductions?: number

  // Rental data
  monthlyRent?: number
  weeklyRent?: number
  rentalYield?: number
  rentalYieldMin?: number
  rentalYieldMax?: number
  areaAverageRent?: number

  // Source information
  listingSource?: string
  listingUrl?: string
  listingUrlSecondary?: string
  confidence?: number

  // Calculated fields
  pricePerSqft?: number
  notes?: string
}

interface ComparablePropertyCardProps {
  property: ComparableProperty
  showRentalData?: boolean
  compact?: boolean
  avgMarketValue?: number
  highlightIfAverage?: boolean
}

/**
 * Get yield color based on value
 * Green: 6%+, Yellow: 4-6%, Red: <4%
 */
function getYieldColor(yield_: number | undefined): string {
  if (!yield_) return "text-muted-foreground"
  if (yield_ >= 6) return "text-green-600"
  if (yield_ >= 4) return "text-yellow-600"
  return "text-red-600"
}

/**
 * Get yield badge variant
 */
function getYieldBadgeVariant(yield_: number | undefined): "default" | "secondary" | "destructive" {
  if (!yield_) return "secondary"
  if (yield_ >= 6) return "default"
  if (yield_ >= 4) return "secondary"
  return "destructive"
}

/**
 * Get confidence badge color
 */
function getConfidenceBadge(confidence?: number): { label: string; variant: "default" | "secondary" | "outline" } {
  if (!confidence) return { label: "UNKNOWN", variant: "outline" }
  if (confidence >= 0.8) return { label: "HIGH", variant: "default" }
  if (confidence >= 0.6) return { label: "MEDIUM", variant: "secondary" }
  return { label: "LOW", variant: "outline" }
}

/**
 * ComparablePropertyCard Component
 * Displays a single comparable property with all details
 */
export function ComparablePropertyCard({
  property,
  showRentalData = true,
  compact = false,
  avgMarketValue,
  highlightIfAverage = true,
}: ComparablePropertyCardProps) {
  const confidenceBadge = getConfidenceBadge(property.confidence)
  const yieldColor = getYieldColor(property.rentalYield)
  const yieldBadgeVariant = getYieldBadgeVariant(property.rentalYield)

  // Check if this property is near the average market value (within 5%)
  const isNearAverage = avgMarketValue
    ? Math.abs(property.salePrice - avgMarketValue) / avgMarketValue < 0.05
    : false

  return (
    <TooltipProvider>
      <Card className={`hover:shadow-md transition-shadow ${isNearAverage && highlightIfAverage ? "ring-2 ring-primary" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <CardTitle className="text-base font-semibold leading-tight">
                {property.address}
              </CardTitle>
              {property.postcode && (
                <p className="text-sm text-muted-foreground mt-1">{property.postcode}</p>
              )}
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={confidenceBadge.variant} className="shrink-0">
                    {confidenceBadge.label}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Data Confidence: {confidenceBadge.label}</p>
                  <p className="text-xs">
                    Based on recency, distance, similarity, and data completeness.
                    {confidenceBadge.label === "HIGH" && " This is a very reliable comparable."}
                    {confidenceBadge.label === "MEDIUM" && " This comparable is reasonably reliable."}
                    {confidenceBadge.label === "LOW" && " Use this comparable with caution."}
                  </p>
                </TooltipContent>
              </Tooltip>
              {isNearAverage && highlightIfAverage && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="default" className="shrink-0 bg-primary">
                      BMV Reference
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="font-semibold mb-1">Used for BMV Calculation</p>
                    <p className="text-xs">
                      This property&apos;s sale price ({formatCurrency(property.salePrice)}) is within 5% of the average market value ({formatCurrency(avgMarketValue!)}) and is used as a reference for calculating Below Market Value percentage.
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Sale Price & Date */}
          <div className="flex items-center justify-between">
            <div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="text-2xl font-bold cursor-help">{formatCurrency(property.salePrice)}</div>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="font-semibold mb-1">Actual Sale Price</p>
                  <p className="text-xs">
                    This is the confirmed price this property sold for on {format(new Date(property.saleDate), "MMM d, yyyy")}.
                    {avgMarketValue && (
                      <>
                        {" "}The average market value across all comparables is {formatCurrency(avgMarketValue)}.
                      </>
                    )}
                  </p>
                </TooltipContent>
              </Tooltip>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Calendar className="h-3 w-3" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help">Sold {format(new Date(property.saleDate), "MMM d, yyyy")}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs">Date this property completed its sale</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            {property.distance !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground cursor-help">
                    <MapPin className="h-4 w-4" />
                    {property.distance.toFixed(2)} mi
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-semibold mb-1">Distance from Target Property</p>
                  <p className="text-xs">Properties closer to your target are generally more comparable as they reflect the same local market conditions.</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          {/* Property Details */}
          <div className="flex flex-wrap gap-3 text-sm">
            {property.propertyType && (
              <div className="flex items-center gap-1.5">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span>{property.propertyType}</span>
              </div>
            )}
            {property.bedrooms !== undefined && property.bedrooms > 0 && (
              <div className="flex items-center gap-1.5">
                <Bed className="h-4 w-4 text-muted-foreground" />
                <span>{property.bedrooms} bed</span>
              </div>
            )}
            {property.bathrooms !== undefined && property.bathrooms > 0 && (
              <div className="flex items-center gap-1.5">
                <Bath className="h-4 w-4 text-muted-foreground" />
                <span>{property.bathrooms} bath</span>
              </div>
            )}
            {property.squareFeet && (
              <div className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-muted-foreground" />
                <span>{property.squareFeet.toLocaleString()} sqft</span>
              </div>
            )}
          </div>

          {/* Price Per SqFt */}
          {property.pricePerSqft && (
            <div className="text-sm text-muted-foreground">
              £{property.pricePerSqft}/sqft
            </div>
          )}

          {/* Rental Data - ALWAYS SHOW THIS SECTION */}
          {showRentalData && (
            <div className="border-t pt-3 space-y-2 bg-gradient-to-br from-primary/5 to-primary/10 p-3 rounded-lg border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-sm font-semibold cursor-help text-primary">
                        <PoundSterling className="h-4 w-4" />
                        Estimated Monthly Rent
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">💰 Rental Income Estimate</p>
                      <p className="text-xs mb-2">
                        Based on area rental data from PropertyData API. This represents the typical monthly rent for similar properties in this postcode area.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        This data helps calculate potential rental yield for buy-to-let investment analysis.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                  {property.monthlyRent ? (
                    <>
                      <div className="text-2xl font-bold mt-1 text-primary">
                        {formatCurrency(property.monthlyRent)}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </div>
                      {property.weeklyRent && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          £{property.weeklyRent.toFixed(0)}/week
                        </div>
                      )}
                      <div className="text-xs font-medium text-primary/80 mt-1">
                        Annual: {formatCurrency(property.monthlyRent * 12)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1 italic">
                      Rental data not available for this property
                    </div>
                  )}
                </div>

                <div className="text-right flex-shrink-0 ml-3">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1.5 text-sm font-semibold cursor-help text-primary">
                        <TrendingUp className="h-4 w-4" />
                        Rental Yield
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="font-semibold mb-1">📊 Gross Rental Yield</p>
                      <p className="text-xs mb-2">
                        <strong>Formula:</strong> (Annual Rent ÷ Sale Price) × 100
                      </p>
                      {property.monthlyRent && property.rentalYield !== undefined ? (
                        <>
                          <p className="text-xs mb-1 bg-primary/10 p-2 rounded">
                            <strong>This property:</strong><br/>
                            ({formatCurrency(property.monthlyRent * 12)} ÷ {formatCurrency(property.salePrice)}) × 100 = <strong>{property.rentalYield.toFixed(2)}%</strong>
                          </p>
                          {property.rentalYieldMin && property.rentalYieldMax && (
                            <p className="text-xs mt-2 pt-2 border-t">
                              📉 Confidence range: {property.rentalYieldMin.toFixed(2)}% - {property.rentalYieldMax.toFixed(2)}%
                            </p>
                          )}
                          <p className="text-xs mt-2 text-muted-foreground">
                            {property.rentalYield >= 6 && "✅ Excellent yield for buy-to-let"}
                            {property.rentalYield >= 4 && property.rentalYield < 6 && "✅ Good yield potential"}
                            {property.rentalYield < 4 && "⚠️ Low yield - may need lower purchase price"}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Yield calculation requires rental data. This helps assess investment potential for buy-to-let properties.
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                  {property.rentalYield !== undefined ? (
                    <>
                      <div className={`text-2xl font-bold mt-1 ${yieldColor}`}>
                        {property.rentalYield.toFixed(2)}%
                      </div>
                      <Badge variant={yieldBadgeVariant} className="text-xs mt-1">
                        {property.rentalYield >= 6 ? "Excellent" : property.rentalYield >= 4 ? "Good" : "Low"}
                      </Badge>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground mt-1 italic">
                      N/A
                    </div>
                  )}
                </div>
              </div>

              {/* Area Average Comparison */}
              {property.areaAverageRent && property.monthlyRent && property.monthlyRent !== property.areaAverageRent && (
                <div className="text-xs text-muted-foreground">
                  Area average: {formatCurrency(property.areaAverageRent)}/mo
                  {property.monthlyRent > property.areaAverageRent ? (
                    <span className="text-green-600 ml-1">
                      (+{((property.monthlyRent / property.areaAverageRent - 1) * 100).toFixed(1)}%)
                    </span>
                  ) : (
                    <span className="text-red-600 ml-1">
                      ({((property.monthlyRent / property.areaAverageRent - 1) * 100).toFixed(1)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Market Indicators */}
          {!compact && (property.daysOnMarket || property.priceReductions) && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {property.daysOnMarket !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {property.daysOnMarket} days listed
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Time on market before sale</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {property.priceReductions !== undefined && property.priceReductions > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1 text-orange-600">
                      <TrendingUp className="h-3 w-3 rotate-180" />
                      {property.priceReductions} reduction{property.priceReductions > 1 ? "s" : ""}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Number of price reductions</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          )}

          {/* Listing Links - Multiple Portals */}
          {(property.listingUrl || property.listingUrlSecondary) && (
            <div className="flex gap-2">
              {property.listingUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <a
                    href={property.listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5"
                  >
                    <span>Rightmove</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
              {property.listingUrlSecondary && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  asChild
                >
                  <a
                    href={property.listingUrlSecondary}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5"
                  >
                    <span>Zoopla</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
