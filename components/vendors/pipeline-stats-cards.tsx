"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, TrendingUp, MessageSquare, DollarSign } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"

interface PipelineStats {
  totalLeads: number
  byStage: Record<string, number>
  conversionRates: {
    leadToOffer: number
    offerToAcceptance: number
    overall: number
  }
  avgTimes: {
    conversationDurationHours: number
    timeToOfferHours: number
    timeToCloseDays: number
  }
  financial: {
    totalOffersMade: number
    totalAcceptedValue: number
    avgBmvPercentage: number
  }
}

interface PipelineStatsCardsProps {
  stats: PipelineStats | null
  refreshing?: boolean
  onRefresh?: () => void
}

export function PipelineStatsCards({ stats, refreshing, onRefresh }: PipelineStatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="text-muted-foreground">Loading...</div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const activeConversations = stats.byStage["AI_CONVERSATION"] || 0
  const offersMade = stats.byStage["OFFER_MADE"] || 0
  const offersAccepted = stats.byStage["OFFER_ACCEPTED"] || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendor Pipeline</h2>
          <p className="text-muted-foreground">
            Track leads through the acquisition workflow
          </p>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold mt-1">{stats.totalLeads}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.byStage["NEW_LEAD"] || 0} new
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Conversations</p>
                <p className="text-2xl font-bold mt-1">{activeConversations}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI handling
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Conversion Rate</p>
                <p className="text-2xl font-bold mt-1">
                  {stats.conversionRates.overall.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {offersAccepted} accepted / {stats.totalLeads} total
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Accepted Value</p>
                <p className="text-2xl font-bold mt-1">
                  {formatCurrency(stats.financial.totalAcceptedValue)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {offersAccepted} deals
                </p>
              </div>
              <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

