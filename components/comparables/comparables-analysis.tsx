"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Cell,
} from "recharts"
import {
  TrendingUp,
  Home,
  PoundSterling,
  Award,
  Info,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from "lucide-react"
import { ComparableProperty } from "./comparable-property-card"
import { formatCurrency } from "@/lib/format"

interface ComparablesAnalysisProps {
  comparables: ComparableProperty[]
  askingPrice?: number
  showRentalData?: boolean
}

/**
 * Get confidence badge
 */
function getConfidenceBadge(count: number, avgConfidence: number): {
  label: string
  variant: "default" | "secondary" | "destructive"
  icon: React.ReactNode
} {
  if (count >= 5 && avgConfidence >= 0.8) {
    return {
      label: "HIGH CONFIDENCE",
      variant: "default",
      icon: <CheckCircle2 className="h-4 w-4" />,
    }
  }
  if (count >= 3 && avgConfidence >= 0.6) {
    return {
      label: "MEDIUM CONFIDENCE",
      variant: "secondary",
      icon: <AlertCircle className="h-4 w-4" />,
    }
  }
  return {
    label: "LOW CONFIDENCE",
    variant: "destructive",
    icon: <XCircle className="h-4 w-4" />,
  }
}

/**
 * Get investment grade
 */
function getInvestmentGrade(avgYield?: number): {
  label: string
  color: string
  description: string
} {
  if (!avgYield) {
    return { label: "N/A", color: "text-muted-foreground", description: "No rental data available" }
  }
  if (avgYield >= 7) {
    return { label: "Excellent", color: "text-green-600", description: "Outstanding rental yield" }
  }
  if (avgYield >= 6) {
    return { label: "Very Good", color: "text-green-600", description: "Strong rental yield" }
  }
  if (avgYield >= 5) {
    return { label: "Good", color: "text-yellow-600", description: "Decent rental yield" }
  }
  if (avgYield >= 4) {
    return { label: "Fair", color: "text-yellow-600", description: "Moderate rental yield" }
  }
  return { label: "Poor", color: "text-red-600", description: "Low rental yield" }
}

/**
 * ComparablesAnalysis Component
 * Displays summary statistics and analysis for comparable properties
 */
export function ComparablesAnalysis({
  comparables,
  askingPrice,
  showRentalData = true,
}: ComparablesAnalysisProps) {
  // Calculate statistics
  const prices = comparables.map((c) => c.salePrice)
  const avgPrice = prices.length > 0 ? Math.round(prices.reduce((sum, p) => sum + p, 0) / prices.length) : 0
  const minPrice = prices.length > 0 ? Math.min(...prices) : 0
  const maxPrice = prices.length > 0 ? Math.max(...prices) : 0

  // Rental yield statistics
  const yields = comparables
    .map((c) => c.rentalYield)
    .filter((y): y is number => y !== undefined && y !== null)
  const avgYield = yields.length > 0 ? Number((yields.reduce((sum, y) => sum + y, 0) / yields.length).toFixed(2)) : undefined
  const minYield = yields.length > 0 ? Math.min(...yields) : undefined
  const maxYield = yields.length > 0 ? Math.max(...yields) : undefined

  // Confidence
  const avgConfidence = comparables.length > 0
    ? comparables.reduce((sum, c) => sum + (c.confidence ?? 1), 0) / comparables.length
    : 0
  const confidenceBadge = getConfidenceBadge(comparables.length, avgConfidence)

  // Investment grade
  const investmentGrade = getInvestmentGrade(avgYield)

  // BMV calculation if asking price provided
  const bmvPercentage = askingPrice && avgPrice > 0
    ? Number((((avgPrice - askingPrice) / avgPrice) * 100).toFixed(1))
    : undefined

  // Yield distribution for chart (group by ranges)
  const yieldDistribution = useMemo(() => {
    if (yields.length === 0) return []

    const ranges = [
      { label: "<4%", min: 0, max: 4, count: 0, color: "#ef4444" },
      { label: "4-5%", min: 4, max: 5, count: 0, color: "#f59e0b" },
      { label: "5-6%", min: 5, max: 6, count: 0, color: "#eab308" },
      { label: "6-7%", min: 6, max: 7, count: 0, color: "#84cc16" },
      { label: "7%+", min: 7, max: 100, count: 0, color: "#22c55e" },
    ]

    yields.forEach((y) => {
      const range = ranges.find((r) => y >= r.min && y < r.max)
      if (range) range.count++
    })

    return ranges.filter((r) => r.count > 0)
  }, [yields])

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Summary Statistics Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Market Analysis</CardTitle>
              <Badge variant={confidenceBadge.variant} className="flex items-center gap-1">
                {confidenceBadge.icon}
                {confidenceBadge.label}
              </Badge>
            </div>
            <CardDescription>
              Based on {comparables.length} comparable propert{comparables.length === 1 ? "y" : "ies"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Average Price */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <PoundSterling className="h-4 w-4" />
                  <span>Average Sale Price</span>
                </div>
                <div className="text-2xl font-bold">{formatCurrency(avgPrice)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Range: {formatCurrency(minPrice)} - {formatCurrency(maxPrice)}
                </div>
              </div>
              {bmvPercentage !== undefined && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground mb-1">BMV</div>
                      <div className={`text-xl font-bold ${bmvPercentage > 0 ? "text-green-600" : "text-red-600"}`}>
                        {bmvPercentage > 0 ? "+" : ""}{bmvPercentage}%
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Below Market Value percentage</p>
                    <p className="text-xs mt-1">
                      Asking: {formatCurrency(askingPrice!)} vs Market: {formatCurrency(avgPrice)}
                    </p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>

            {/* Rental Yield - ALWAYS SHOW */}
            {showRentalData && (
              <div className="border-t pt-4 bg-gradient-to-br from-primary/5 to-primary/10 -mx-6 px-6 py-4 mt-4">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-3 cursor-help">
                      <TrendingUp className="h-5 w-5" />
                      <span>Rental Yield Analysis</span>
                      <Info className="h-4 w-4" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="font-semibold mb-2">📊 Investment Analysis</p>
                    <p className="text-xs mb-2">
                      Rental yield shows the annual return on investment from rental income. Higher yields indicate better buy-to-let potential.
                    </p>
                    <p className="text-xs">
                      <strong>Formula:</strong> (Annual Rent ÷ Property Price) × 100
                    </p>
                  </TooltipContent>
                </Tooltip>

                {avgYield !== undefined ? (
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <PoundSterling className="h-3 w-3" />
                        <span>Average Rental Yield</span>
                      </div>
                      <div className={`text-3xl font-bold ${investmentGrade.color}`}>
                        {avgYield.toFixed(2)}%
                      </div>
                      {minYield !== undefined && maxYield !== undefined && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Range: {minYield.toFixed(2)}% - {maxYield.toFixed(2)}%
                        </div>
                      )}
                      <div className="text-xs font-medium text-primary/70 mt-2">
                        {comparables.length > 0 && comparables[0].monthlyRent && (
                          <>Based on {yields.length} of {comparables.length} properties with rental data</>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Award className="h-3 w-3" />
                        <span>Investment Grade</span>
                      </div>
                      <div className={`text-lg font-bold ${investmentGrade.color} mb-1`}>
                        {investmentGrade.label}
                      </div>
                      <div className="text-xs text-muted-foreground max-w-[120px]">
                        {investmentGrade.description}
                      </div>
                      <Badge className={`mt-2 ${investmentGrade.color === 'text-green-600' ? 'bg-green-100 text-green-800' : investmentGrade.color === 'text-yellow-600' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {avgYield >= 6 ? '🌟 Excellent' : avgYield >= 4 ? '✓ Good' : '⚠ Low'}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <div className="text-muted-foreground mb-2">
                      <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-medium">Rental Data Not Available</p>
                      <p className="text-xs mt-1">
                        These comparables don&apos;t have rental yield data yet. Rental data helps assess buy-to-let investment potential.
                      </p>
                    </div>
                    <Badge variant="outline" className="mt-2">
                      Refresh comparables to fetch rental data
                    </Badge>
                  </div>
                )}
              </div>
            )}

            {/* Property Distribution */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <Home className="h-4 w-4" />
                <span>Property Distribution</span>
              </div>
              <div className="space-y-2">
                {(() => {
                  const typeCount = comparables.reduce((acc, c) => {
                    const type = c.propertyType || "Unknown"
                    acc[type] = (acc[type] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)

                  return Object.entries(typeCount)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <span>{type}</span>
                        <Badge variant="outline">
                          {count} ({Math.round((count / comparables.length) * 100)}%)
                        </Badge>
                      </div>
                    ))
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Yield Distribution Chart */}
        {showRentalData && yieldDistribution.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rental Yield Distribution</CardTitle>
              <CardDescription>
                Distribution of rental yields across {yields.length} properties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={yieldDistribution}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    label={{ value: "Properties", angle: -90, position: "insideLeft", fontSize: 12 }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {yieldDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Legend */}
              <div className="flex flex-wrap gap-3 mt-4 justify-center">
                {yieldDistribution.map((range) => (
                  <div key={range.label} className="flex items-center gap-2 text-sm">
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: range.color }}
                    />
                    <span>{range.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {range.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info Card (if no rental data) */}
        {showRentalData && yields.length === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rental Analysis</CardTitle>
              <CardDescription>Investment potential analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Info className="h-5 w-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground mb-1">No rental data available</p>
                  <p>Rental yield information is not available for these comparables. This data helps assess investment potential for buy-to-let properties.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  )
}

// Add useMemo import
import { useMemo } from "react"
