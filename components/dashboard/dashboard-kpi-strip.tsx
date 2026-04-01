// components/dashboard/dashboard-kpi-strip.tsx
"use client"

import { useState } from "react"
import { Loader2, Info } from "lucide-react"
import { KpiCard } from "@/components/ui/kpi-card"
import { MetricsDateFilter } from "@/components/ui/metrics-date-filter"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format, parseISO } from "date-fns"

interface KpiData {
  activeLeads: number
  leadsThisMonth: number
  dealsReady: number
  activeReservations: number
  totalLeads: number
  acceptedLeads: number
  conversionRate: string
}

export function DashboardKpiStrip() {
  const [data, setData] = useState<KpiData | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchKpis = async (fromDate: string | null) => {
    setLoading(true)
    try {
      const url = fromDate ? `/api/analytics/kpis?from=${fromDate}` : "/api/analytics/kpis"
      const res = await fetch(url)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch KPIs", err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFrom: string | null) => {
    setFrom(newFrom)
    fetchKpis(newFrom)
  }

  const newLeadsLabel = from
    ? `+${data?.leadsThisMonth ?? 0} since ${format(parseISO(from), "d MMM")}`
    : `+${data?.leadsThisMonth ?? 0} this month`

  return (
    <TooltipProvider>
      <div className="ds-card overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Overview
          </span>
          <MetricsDateFilter onChange={handleFilterChange} />
        </div>

        {loading || !data ? (
          <div className="flex min-h-[100px] items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-[var(--ds-border)] md:grid-cols-4">
            {/* Active Leads */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Active Leads"
                  value={String(data.activeLeads)}
                  subLabel={newLeadsLabel}
                  valueType="highlight"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Vendor leads currently in the pipeline, excluding dead leads and rejected
                    offers.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Deals for Investors */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Deals for Investors"
                  value={String(data.dealsReady)}
                  subLabel="ready &amp; listed"
                  valueType={data.dealsReady > 0 ? "positive" : "neutral"}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Deals with status &ldquo;Ready&rdquo; or &ldquo;Listed&rdquo; — available for
                    investor reservations right now.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Active Reservations */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Reservations"
                  value={String(data.activeReservations)}
                  subLabel="active (not cancelled)"
                  valueType="neutral"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    All investor reservations that have not been cancelled, across all stages.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* Lead Conversion Rate */}
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Lead → Offer Accepted"
                  value={`${data.conversionRate}%`}
                  subLabel={`${data.acceptedLeads} accepted`}
                  valueType={Number(data.conversionRate) > 0 ? "positive" : "neutral"}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    (Leads with accepted offer / Total leads) × 100. Shows the percentage of vendor
                    leads that result in an accepted offer.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
