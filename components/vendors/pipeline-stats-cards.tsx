"use client"

import { KpiCard } from "@/components/ui/kpi-card"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
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
      <div className="ds-card grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--ds-border)]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-6 animate-pulse">
            <div className="h-3 w-20 bg-gray-200 rounded mb-3" />
            <div className="h-7 w-16 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    )
  }

  const activeConversations = stats.byStage["AI_CONVERSATION"] || 0
  const offersAccepted = stats.byStage["OFFER_ACCEPTED"] || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold font-display text-gray-900 leading-tight">
            Vendor Pipeline
          </h2>
          <p className="mt-0.5 text-sm text-gray-400">
            Track leads through the acquisition workflow
          </p>
        </div>
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
            Refresh
          </Button>
        )}
      </div>

      <div className="ds-card grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--ds-border)]">
        <div className="p-6">
          <KpiCard
            label="Total Leads"
            value={String(stats.totalLeads)}
            subLabel={`${stats.byStage["NEW_LEAD"] || 0} new this batch`}
          />
        </div>
        <div className="p-6">
          <KpiCard
            label="Active Conversations"
            value={String(activeConversations)}
            subLabel="AI handling"
            valueType="highlight"
          />
        </div>
        <div className="p-6">
          <KpiCard
            label="Conversion Rate"
            value={`${stats.conversionRates.overall.toFixed(1)}%`}
            subLabel={`${offersAccepted} accepted / ${stats.totalLeads} total`}
            valueType={stats.conversionRates.overall > 0 ? "positive" : "neutral"}
          />
        </div>
        <div className="p-6">
          <KpiCard
            label="Accepted Value"
            value={formatCurrency(stats.financial.totalAcceptedValue)}
            subLabel={`${offersAccepted} deals`}
            valueType={stats.financial.totalAcceptedValue > 0 ? "positive" : "neutral"}
          />
        </div>
      </div>
    </div>
  )
}
