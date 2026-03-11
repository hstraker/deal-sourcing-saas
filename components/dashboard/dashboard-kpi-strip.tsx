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
  totalDeals: number
  dealsRecent: number
  totalVendors: number
  vendorsWithOffers: number
  vendorsAccepted: number
  totalReservations: number
  reservationsWithProof: number
  vendorConversionRate: string
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

  const subLabelDeals = from
    ? `+${data?.dealsRecent ?? 0} since ${format(parseISO(from), "d MMM")}`
    : `+${data?.dealsRecent ?? 0} this month`

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

        {/* Loading / data */}
        {loading || !data ? (
          <div className="flex min-h-[100px] items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-[var(--ds-border)] md:grid-cols-4">
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Total Deals"
                  value={String(data.totalDeals)}
                  subLabel={subLabelDeals}
                  valueType="highlight"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    All deals across all stages: new, review, in-progress, ready, listed,
                    reserved, sold, archived.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Active Vendors"
                  value={String(data.totalVendors)}
                  subLabel={`${data.vendorsWithOffers} with offers`}
                  valueType="neutral"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Total vendors from all sources. Each represents a potential property seller.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Reservations"
                  value={String(data.totalReservations)}
                  subLabel={`${data.reservationsWithProof} verified`}
                  valueType="neutral"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    All investor reservations across all deals and statuses.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Conversion Rate"
                  value={`${data.vendorConversionRate}%`}
                  subLabel={`${data.vendorsAccepted} accepted`}
                  valueType={Number(data.vendorConversionRate) > 0 ? "positive" : "neutral"}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    (Accepted Offers / Total Vendors) × 100. Shows % of vendors who accepted
                    offers.
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
