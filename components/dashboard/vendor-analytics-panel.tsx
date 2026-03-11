// components/dashboard/vendor-analytics-panel.tsx
"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Clock, ArrowRight, Info } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface VendorPipelineData {
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

interface VendorAnalyticsPanelProps {
  from?: string | null
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

const getConversionColor = (pct: number) => {
  if (pct >= 70) return "text-green-600"
  if (pct >= 50) return "text-blue-600"
  if (pct >= 30) return "text-yellow-600"
  return "text-red-600"
}

export function VendorAnalyticsPanel({ from }: VendorAnalyticsPanelProps) {
  const [data, setData] = useState<VendorPipelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const url = from
          ? `/api/analytics/workflow?from=${from}`
          : "/api/analytics/workflow"
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          setData(json.vendorPipeline)
        }
      } catch (err) {
        console.error("Failed to fetch vendor analytics", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [from])

  if (isLoading || !data) {
    return (
      <div className="ds-card flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 pt-4">
        {/* Pipeline Overview */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  Vendor Pipeline Overview
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-help text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">How it&apos;s calculated:</p>
                      <p className="text-xs">
                        Counts vendors grouped by their current status in the workflow.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  Track vendors through each stage of the workflow
                </p>
              </div>
              <Link href="/dashboard/vendors">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {data.byStage.map((stage) => (
                <div
                  key={stage.stage}
                  className="rounded-lg border p-4 text-center transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2 text-2xl font-bold">{stage.count}</div>
                  <Badge className={getStageColor(stage.stage).bg} variant="outline">
                    {stageLabels[stage.stage] || stage.stage}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="ds-card overflow-hidden">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total Vendors</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalVendors}</div>
                </div>
              </div>
              <div className="ds-card overflow-hidden">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total Offers</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalOffers}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <TrendingUp className="h-5 w-5" />
              Conversion Rates
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Track conversion rates between workflow stages
            </p>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {[
                {
                  from: { label: "Contacted", cls: "bg-blue-100 text-blue-800 border-blue-200" },
                  to: { label: "Validated", cls: "bg-green-100 text-green-800 border-green-200" },
                  value: data.conversionRates.contactedToValidated,
                  desc: "Vendors who passed initial validation",
                },
                {
                  from: { label: "Validated", cls: "bg-green-100 text-green-800 border-green-200" },
                  to: { label: "Offer Made", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
                  value: data.conversionRates.validatedToOffer,
                  desc: "Validated vendors who received offers",
                },
                {
                  from: { label: "Offer", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
                  to: { label: "Accepted", cls: "bg-purple-100 text-purple-800 border-purple-200" },
                  value: data.conversionRates.offerToAccepted,
                  desc: "Offers that were accepted by vendors",
                },
                {
                  from: { label: "Accepted", cls: "bg-purple-100 text-purple-800 border-purple-200" },
                  to: { label: "Locked Out", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                  value: data.conversionRates.acceptedToLockedOut,
                  desc: "Accepted offers that reached lock-out",
                },
              ].map((row) => (
                <div
                  key={row.desc}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Badge variant="outline" className={row.from.cls}>{row.from.label}</Badge>
                      <span>→</span>
                      <Badge variant="outline" className={row.to.cls}>{row.to.label}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-400">{row.desc}</div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(row.value)}`}>
                    {formatPercentage(row.value)}
                  </div>
                </div>
              ))}

              {/* Overall */}
              <div className="flex items-center justify-between rounded-lg border-2 border-[#2563EB]/20 bg-[#2563EB]/5 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Contacted</Badge>
                    <span>→</span>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Locked Out</Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-400">End-to-end conversion rate</div>
                </div>
                <div className={`text-2xl font-bold ${getConversionColor(data.conversionRates.overallContactedToLockedOut)}`}>
                  {formatPercentage(data.conversionRates.overallContactedToLockedOut)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time in Stages */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-5 w-5" />
              Time in Stages
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Average time vendors spend in each stage
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(data.avgStageTimes).map(([stage, days]) => (
                <div
                  key={stage}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2">
                    <Badge className={getStageColor(stage).bg} variant="outline">
                      {stageLabels[stage] || stage}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{formatDays(days)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
                <div className="mb-2 text-sm text-gray-400">Avg Offers per Deal</div>
                <div className="text-2xl font-bold">{data.avgOffersPerDeal.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
                <div className="mb-2 text-sm text-gray-400">Avg Negotiation Time</div>
                <div className="text-2xl font-bold">{formatDays(data.avgNegotiationTime)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
