"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Clock, Building2, Users, ArrowRight } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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

const formatPercentage = (value: number) => `${value.toFixed(1)}%`
const formatDays = (value: number) => `${value.toFixed(1)} days`

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

const getStageColor = (stage: string) => {
  const colors: Record<string, { bg: string }> = {
    contacted: { bg: "bg-blue-100 text-blue-800 border-blue-200" },
    validated: { bg: "bg-green-100 text-green-800 border-green-200" },
    offer_made: { bg: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    negotiating: { bg: "bg-orange-100 text-orange-800 border-orange-200" },
    offer_accepted: { bg: "bg-purple-100 text-purple-800 border-purple-200" },
    offer_rejected: { bg: "bg-red-100 text-red-800 border-red-200" },
    locked_out: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    withdrawn: { bg: "bg-gray-100 text-gray-800 border-gray-200" },
  }
  return colors[stage] || { bg: "bg-gray-100 text-gray-800 border-gray-200" }
}

const getConversionColor = (percentage: number) => {
  if (percentage >= 70) return "text-green-600"
  if (percentage >= 50) return "text-blue-600"
  if (percentage >= 30) return "text-yellow-600"
  return "text-red-600"
}

export function DashboardAnalytics() {
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

  if (isLoading || !analytics) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Tabs defaultValue="vendor" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="vendor" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Vendor Pipeline
            </TabsTrigger>
            <TabsTrigger value="investor" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Investor Pipeline
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendor" className="space-y-6">
            {/* Vendor Pipeline Overview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Vendor Pipeline Overview
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">How it's calculated:</p>
                          <p className="text-xs">
                            Counts vendors grouped by their current status in the workflow. Each vendor moves through stages: Contacted → Validated → Offer Made → Accepted → Locked Out.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription>
                      Track vendors through each stage of the workflow
                    </CardDescription>
                  </div>
                  <Link href="/dashboard/vendors">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  {analytics.vendorPipeline.byStage.map((stage) => {
                    const stageColor = getStageColor(stage.stage)
                    return (
                      <div key={stage.stage} className="text-center p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="text-2xl font-bold mb-2">{stage.count}</div>
                        <Badge className={stageColor.bg} variant="outline">
                          {stageLabels[stage.stage] || stage.stage}
                        </Badge>
                      </div>
                    )
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Vendors</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Total Vendors</p>
                            <p className="text-xs">
                              Count of all vendors in the system, regardless of status. Includes vendors from all sources (Facebook ads, manual entry, etc.).
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold">{analytics.vendorPipeline.totalVendors}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Total Offers</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Total Offers Made</p>
                            <p className="text-xs">
                              Sum of all offers made across all vendors. This includes pending, accepted, rejected, and withdrawn offers. Calculated from the VendorOffer table.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <div className="text-2xl font-bold">{analytics.vendorPipeline.totalOffers}</div>
                    </CardContent>
                  </Card>
                </div>
              </CardContent>
            </Card>

            {/* Conversion Rates */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Conversion Rates
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Conversion Rate Calculation</p>
                      <p className="text-xs">
                        Conversion rates are calculated as: (Next Stage Count / Previous Stage Count) × 100. For example, "Contacted → Validated" = (Validated Vendors / Contacted Vendors) × 100.
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Contacted → Validated</p>
                            <p className="text-xs">
                              Calculated as: (Validated Vendors / Contacted Vendors) × 100. Shows the percentage of contacted vendors who passed AI validation and qualification checks.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Validated → Offer Made</p>
                            <p className="text-xs">
                              Calculated as: (Vendors with Offers / Validated Vendors) × 100. Includes vendors in "offer_made" or "negotiating" status.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Offer → Accepted</p>
                            <p className="text-xs">
                              Calculated as: (Accepted Offers / Total Offers Made) × 100. Based on VendorOffer records where vendorDecision = "accepted".
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Accepted → Locked Out</p>
                            <p className="text-xs">
                              Calculated as: (Locked Out Vendors / Accepted Vendors) × 100. Shows vendors who reached the lock-out agreement stage after accepting an offer.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Overall Conversion Rate</p>
                            <p className="text-xs">
                              Calculated as: (Locked Out Vendors / Contacted Vendors) × 100. This is the end-to-end conversion rate showing the percentage of contacted vendors who completed the entire workflow to lock-out.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Time Calculation</p>
                      <p className="text-xs">
                        Average time is calculated by measuring the duration between stage transitions. For example, time in "Contacted" = average of (qualifiedAt - createdAt) for all validated vendors.
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={stageColor.bg} variant="outline">
                            {stageLabels[stage] || stage}
                          </Badge>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm">
                              <p className="text-sm font-medium mb-1">Average Time in {stageLabels[stage]}</p>
                              <p className="text-xs">
                                Calculated by averaging the time difference between when vendors entered this stage and when they moved to the next stage. Based on timestamps from vendor status changes.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <div className="text-2xl font-bold">{formatDays(days)}</div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">Avg Offers per Deal</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Average Offers per Deal</p>
                          <p className="text-xs">
                            Calculated as: Total Offers / Number of Deals with Offers. This shows how many offers are typically made per deal before acceptance or rejection.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <div className="text-2xl font-bold">
                      {analytics.vendorPipeline.avgOffersPerDeal.toFixed(1)}
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-muted-foreground">Avg Negotiation Time</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Average Negotiation Time</p>
                          <p className="text-xs">
                            Calculated by averaging the time from the first offer date to the acceptance date for all accepted offers. Formula: Average of (vendorDecisionDate - firstOfferDate) for accepted offers.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      Investor Pipeline Overview
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">How it's calculated:</p>
                          <p className="text-xs">
                            Counts investor reservations grouped by their current status. Reservations flow through: Pending → Proof of Funds → Locked Out → Completed.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                    <CardDescription>
                      Track investor reservations through the workflow
                    </CardDescription>
                  </div>
                  <Link href="/dashboard/investors">
                    <Button variant="ghost" size="sm">
                      View All
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="text-2xl font-bold">{analytics.investorPipeline.totalReservations}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Total Reservations</p>
                          <p className="text-xs">
                            Count of all investor reservations in the system. This includes reservations in all statuses: pending, fee_pending, proof_of_funds_pending, verified, locked_out, completed, and cancelled. Calculated from the InvestorReservation table.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                      Total Reservations
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="text-2xl font-bold">{analytics.investorPipeline.reservationsWithProof}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Proof Verified</p>
                          <p className="text-xs">
                            Count of reservations where proofOfFundsVerified = true. This means the investor has provided proof of funds documentation and it has been verified by the team. This is a key milestone in the reservation process.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                      Proof Verified
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="text-2xl font-bold">{analytics.investorPipeline.reservationsLockedOut}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Locked Out</p>
                          <p className="text-xs">
                            Count of reservations where status = "locked_out". This means the lock-out agreement has been signed by the investor, securing their reservation. Calculated from InvestorReservation where status = 'locked_out'.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-200">
                      Locked Out
                    </Badge>
                  </div>
                  <div className="p-4 border rounded-lg text-center hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="text-2xl font-bold">{analytics.investorPipeline.reservationsCompleted}</div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                          <p className="text-sm font-medium mb-1">Completed</p>
                          <p className="text-xs">
                            Count of reservations where status = "completed". These reservations are ready for completion - all requirements met, lock-out signed, and ready to proceed to final completion. Calculated from InvestorReservation where status = 'completed'.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
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
                  <TrendingUp className="h-5 w-5" />
                  Reservation Conversion Rates
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">Conversion Rate Calculation</p>
                      <p className="text-xs">
                        Conversion rates show the percentage of reservations that progress from one stage to the next. Calculated as: (Next Stage Count / Previous Stage Count) × 100.
                      </p>
                    </TooltipContent>
                  </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Reservation → Proof of Funds</p>
                            <p className="text-xs">
                              Calculated as: (Reservations with Verified Proof / Total Reservations) × 100. Shows the percentage of reservations where investors provided and had their proof of funds verified.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Proof → Locked Out</p>
                            <p className="text-xs">
                              Calculated as: (Locked Out Reservations / Reservations with Verified Proof) × 100. Shows how many verified reservations progress to signing the lock-out agreement.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Locked Out → Completed</p>
                            <p className="text-xs">
                              Calculated as: (Completed Reservations / Locked Out Reservations) × 100. Shows the percentage of locked-out reservations that reach completion status.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3 w-3 text-muted-foreground cursor-help ml-2" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <p className="text-sm font-medium mb-1">Overall Conversion Rate</p>
                            <p className="text-xs">
                              Calculated as: (Completed Reservations / Total Reservations) × 100. This is the end-to-end conversion rate showing the percentage of all reservations that complete the entire workflow from initial reservation to completion.
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
    </TooltipProvider>
  )
}


