"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Clock, Target, BarChart3 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface WorkflowAnalytics {
  vendorPipeline: {
    byStage: Array<{ stage: string; count: number }>
    conversionRates: {
      contactedToValidated: number
      validatedToOffer: number
      offerToAccepted: number
      acceptedToLockedOut: number
      overallContactedToLockedOut: number
    }
    avgStageTimes: Record<string, number>
    avgOffersPerDeal: number
    avgNegotiationTime: number
    totalVendors: number
    totalOffers: number
  }
  investorPipeline: {
    conversionRates: {
      reservationToProof: number
      proofToLockedOut: number
      lockedOutToCompleted: number
      overallReservationToCompleted: number
    }
    totalReservations: number
    reservationsWithProof: number
    reservationsLockedOut: number
    reservationsCompleted: number
  }
}

export function WorkflowAnalytics() {
  const [analytics, setAnalytics] = useState<WorkflowAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const fetchAnalytics = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/analytics/workflow")
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      }
    } catch (error) {
      console.error("Error fetching analytics:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>No analytics data available</p>
        </CardContent>
      </Card>
    )
  }

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`
  }

  const formatDays = (value: number) => {
    return `${value.toFixed(1)} days`
  }

  const getStageColor = (stage: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      contacted: { bg: "bg-blue-100 text-blue-800 border-blue-200", text: "text-blue-800" },
      validated: { bg: "bg-green-100 text-green-800 border-green-200", text: "text-green-800" },
      offer_made: { bg: "bg-yellow-100 text-yellow-800 border-yellow-200", text: "text-yellow-800" },
      negotiating: { bg: "bg-orange-100 text-orange-800 border-orange-200", text: "text-orange-800" },
      offer_accepted: { bg: "bg-purple-100 text-purple-800 border-purple-200", text: "text-purple-800" },
      offer_rejected: { bg: "bg-red-100 text-red-800 border-red-200", text: "text-red-800" },
      locked_out: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200", text: "text-emerald-800" },
      withdrawn: { bg: "bg-gray-100 text-gray-800 border-gray-200", text: "text-gray-800" },
    }
    return colors[stage] || { bg: "bg-gray-100 text-gray-800 border-gray-200", text: "text-gray-800" }
  }

  const getConversionColor = (percentage: number) => {
    if (percentage >= 70) return "text-green-600"
    if (percentage >= 50) return "text-blue-600"
    if (percentage >= 30) return "text-yellow-600"
    return "text-red-600"
  }

  const stageLabels: Record<string, string> = {
    contacted: "Contacted",
    validated: "Validated",
    offer_made: "Offer Made",
    negotiating: "Negotiating",
    offer_accepted: "Accepted",
    offer_rejected: "Rejected",
    locked_out: "Locked Out",
    withdrawn: "Withdrawn",
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="vendor" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vendor">Vendor Pipeline</TabsTrigger>
          <TabsTrigger value="investor">Investor Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="vendor" className="space-y-6">
          {/* Vendor Pipeline Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Vendor Pipeline Overview
              </CardTitle>
              <CardDescription>
                Track vendors through each stage of the workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {analytics.vendorPipeline.byStage.map((stage) => {
                  const stageColor = getStageColor(stage.stage)
                  return (
                    <div key={stage.stage} className="text-center p-4 border rounded-lg">
                      <div className="text-2xl font-bold mb-2">{stage.count}</div>
                      <Badge className={stageColor.bg} variant="outline">
                        {stageLabels[stage.stage] || stage.stage}
                      </Badge>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Vendors</div>
                  <div className="text-2xl font-bold">{analytics.vendorPipeline.totalVendors}</div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Total Offers</div>
                  <div className="text-2xl font-bold">{analytics.vendorPipeline.totalOffers}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Conversion Rates
              </CardTitle>
              <CardDescription>
                Track conversion rates between workflow stages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Contacted</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Validated</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Vendors who passed initial validation
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.vendorPipeline.conversionRates.contactedToValidated)}`}>
                    {formatPercentage(analytics.vendorPipeline.conversionRates.contactedToValidated)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Validated</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Offer Made</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Validated vendors who received offers
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.vendorPipeline.conversionRates.validatedToOffer)}`}>
                    {formatPercentage(analytics.vendorPipeline.conversionRates.validatedToOffer)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Offer</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">Accepted</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Offers that were accepted by vendors
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.vendorPipeline.conversionRates.offerToAccepted)}`}>
                    {formatPercentage(analytics.vendorPipeline.conversionRates.offerToAccepted)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">Accepted</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Locked Out</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Accepted offers that reached lock-out
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.vendorPipeline.conversionRates.acceptedToLockedOut)}`}>
                    {formatPercentage(analytics.vendorPipeline.conversionRates.acceptedToLockedOut)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-primary/5 border-primary/20">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Contacted</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Locked Out</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      End-to-end conversion rate
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.vendorPipeline.conversionRates.overallContactedToLockedOut)}`}>
                    {formatPercentage(analytics.vendorPipeline.conversionRates.overallContactedToLockedOut)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Time in Stages
              </CardTitle>
              <CardDescription>
                Average time vendors spend in each stage
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries(analytics.vendorPipeline.avgStageTimes).map(([stage, days]) => {
                  const stageColor = getStageColor(stage)
                  return (
                    <div key={stage} className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <Badge className={`${stageColor.bg} mb-2`} variant="outline">
                        {stageLabels[stage] || stage}
                      </Badge>
                      <div className="text-2xl font-bold mt-2">{formatDays(days)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Avg Offers per Deal</div>
                  <div className="text-2xl font-bold">
                    {analytics.vendorPipeline.avgOffersPerDeal.toFixed(1)}
                  </div>
                </div>
                <div className="p-4 border rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Avg Negotiation Time</div>
                  <div className="text-2xl font-bold">
                    {formatDays(analytics.vendorPipeline.avgNegotiationTime)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="investor" className="space-y-6">
          {/* Investor Pipeline Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Investor Pipeline Overview
              </CardTitle>
              <CardDescription>
                Track investor reservations through the workflow
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                  <div className="text-2xl font-bold mb-2">{analytics.investorPipeline.totalReservations}</div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                    Total Reservations
                  </Badge>
                </div>
                <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                  <div className="text-2xl font-bold mb-2">{analytics.investorPipeline.reservationsWithProof}</div>
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                    Proof Verified
                  </Badge>
                </div>
                <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                  <div className="text-2xl font-bold mb-2">{analytics.investorPipeline.reservationsLockedOut}</div>
                  <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                    Locked Out
                  </Badge>
                </div>
                <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                  <div className="text-2xl font-bold mb-2">{analytics.investorPipeline.reservationsCompleted}</div>
                  <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">
                    Completed
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Investor Conversion Rates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Reservation Conversion Rates
              </CardTitle>
              <CardDescription>
                Track conversion rates through the reservation process
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Reservation</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Proof of Funds</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Reservations with verified proof of funds
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.investorPipeline.conversionRates.reservationToProof)}`}>
                    {formatPercentage(analytics.investorPipeline.conversionRates.reservationToProof)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Proof</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">Locked Out</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Verified reservations that reached lock-out
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.investorPipeline.conversionRates.proofToLockedOut)}`}>
                    {formatPercentage(analytics.investorPipeline.conversionRates.proofToLockedOut)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">Locked Out</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Completed</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      Locked out reservations that completed
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.investorPipeline.conversionRates.lockedOutToCompleted)}`}>
                    {formatPercentage(analytics.investorPipeline.conversionRates.lockedOutToCompleted)}
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border-2 rounded-lg bg-primary/5 border-primary/20">
                  <div>
                    <div className="font-medium flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Reservation</Badge>
                      <span>→</span>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Completed</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      End-to-end conversion rate
                    </div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(analytics.investorPipeline.conversionRates.overallReservationToCompleted)}`}>
                    {formatPercentage(analytics.investorPipeline.conversionRates.overallReservationToCompleted)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

