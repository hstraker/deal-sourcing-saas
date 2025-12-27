"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Clock, Loader2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

interface TimeInStagesData {
  avgStageTimes: Record<string, number>
  avgOffersPerDeal: number
  avgNegotiationTime: number
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

const getStageColor = (stage: string) => {
  const colors: Record<string, string> = {
    contacted: "bg-blue-100 text-blue-800 border-blue-300",
    validated: "bg-green-100 text-green-800 border-green-300",
    offer_made: "bg-yellow-100 text-yellow-800 border-yellow-300",
    negotiating: "bg-orange-100 text-orange-800 border-orange-300",
    offer_accepted: "bg-purple-100 text-purple-800 border-purple-300",
    offer_rejected: "bg-red-100 text-red-800 border-red-300",
    locked_out: "bg-emerald-100 text-emerald-800 border-emerald-300",
    withdrawn: "bg-gray-100 text-gray-800 border-gray-300",
  }
  return colors[stage] || "bg-gray-100 text-gray-800 border-gray-300"
}

const formatDays = (value: number) => {
  if (value === 0) return "< 1 day"
  if (value < 1) return `${(value * 24).toFixed(0)}h`
  return `${value.toFixed(1)} days`
}

export function TimeInStagesCard() {
  const [data, setData] = useState<TimeInStagesData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/analytics/workflow")
      if (response.ok) {
        const analytics = await response.json()
        setData({
          avgStageTimes: analytics.vendorPipeline.avgStageTimes,
          avgOffersPerDeal: analytics.vendorPipeline.avgOffersPerDeal,
          avgNegotiationTime: analytics.vendorPipeline.avgNegotiationTime,
        })
      }
    } catch (error) {
      console.error("Error fetching time in stages:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (!data) return null

  return (
    <TooltipProvider>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            Time in Stages
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-sm">
                <p className="text-sm font-medium mb-1">Time Calculation</p>
                <p className="text-xs">
                  Average time calculated by measuring duration between stage transitions. Helps identify bottlenecks in your workflow.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardTitle>
          <CardDescription className="text-xs">
            Average time vendors spend in each stage
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 mb-4">
            {Object.entries(data.avgStageTimes).map(([stage, days]) => {
              const stageColor = getStageColor(stage)
              return (
                <div
                  key={stage}
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors bg-gradient-to-br from-background to-muted/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={stageColor} variant="outline">
                      {stageLabels[stage] || stage}
                    </Badge>
                  </div>
                  <div className="text-xl font-bold text-teal-700">{formatDays(days)}</div>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg bg-gradient-to-br from-cyan-50/50 to-teal-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Offers/Deal</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Average number of offers made per deal before acceptance or rejection.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl font-bold text-cyan-700">
                {data.avgOffersPerDeal.toFixed(1)}
              </div>
            </div>
            <div className="p-3 border rounded-lg bg-gradient-to-br from-emerald-50/50 to-green-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Avg Negotiation</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Average time from first offer to acceptance for all accepted offers.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl font-bold text-emerald-700">
                {formatDays(data.avgNegotiationTime)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
