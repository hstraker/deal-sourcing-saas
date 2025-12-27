"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Building2, ArrowRight, Loader2 } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface VendorPipelineData {
  byStage: Array<{ stage: string; count: number }>
  totalVendors: number
  totalOffers: number
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

export function VendorPipelineCard() {
  const [data, setData] = useState<VendorPipelineData | null>(null)
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
        setData(analytics.vendorPipeline)
      }
    } catch (error) {
      console.error("Error fetching vendor pipeline:", error)
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
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5 text-indigo-600" />
                Vendor Pipeline Overview
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-sm font-medium mb-1">Vendor Pipeline Stages</p>
                    <p className="text-xs">
                      Vendors progress through: Contacted → Validated → Offer Made → Negotiating → Accepted → Locked Out. Each stage represents a key milestone in the acquisition workflow.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription className="text-xs">
                Track vendors through acquisition stages
              </CardDescription>
            </div>
            <Link href="/dashboard/vendors">
              <Button variant="ghost" size="sm" className="text-xs h-8">
                View All
                <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {data.byStage.map((stage) => {
              const stageColor = getStageColor(stage.stage)
              return (
                <div
                  key={stage.stage}
                  className="text-center p-3 border rounded-lg hover:bg-muted/50 transition-colors bg-gradient-to-br from-background to-muted/20"
                >
                  <div className="text-2xl font-bold mb-2">{stage.count}</div>
                  <Badge className={stageColor} variant="outline">
                    {stageLabels[stage.stage] || stage.stage}
                  </Badge>
                </div>
              )
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border rounded-lg bg-gradient-to-br from-blue-50/50 to-indigo-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total Vendors</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Count of all vendors in the system, regardless of status. Includes all sources (Facebook ads, manual entry).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl font-bold text-indigo-700">{data.totalVendors}</div>
            </div>
            <div className="p-3 border rounded-lg bg-gradient-to-br from-purple-50/50 to-pink-50/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Total Offers</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm">
                    <p className="text-xs">
                      Sum of all offers made across all vendors. Includes pending, accepted, rejected, and withdrawn offers.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <div className="text-xl font-bold text-purple-700">{data.totalOffers}</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
