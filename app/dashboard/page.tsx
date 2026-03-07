import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { RateLimitMonitor } from "@/components/vendor-pipeline/rate-limit-monitor"
import { VendorPipelineCard } from "@/components/dashboard/vendor-pipeline-card"
import { TimeInStagesCard } from "@/components/dashboard/time-in-stages-card"
import { DashboardAnalytics } from "@/components/dashboard/dashboard-analytics"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { KpiCard } from "@/components/ui/kpi-card"
import { PageHeader } from "@/components/ui/page-header"
import { FileText, Building2, Users, TrendingUp, Plus } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const [
    totalDeals,
    dealsThisMonth,
    dealsListed,
    dealsSold,
    totalVendors,
    vendorsWithOffers,
    vendorsAccepted,
    totalReservations,
    reservationsWithProof,
  ] = await Promise.all([
    prisma.deal.count(),
    prisma.deal.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } }),
    prisma.deal.count({ where: { status: "listed" } }),
    prisma.deal.count({ where: { status: "sold" } }),
    prisma.vendor.count(),
    prisma.vendor.count({ where: { status: { in: ["offer_made", "negotiating"] } } }),
    prisma.vendor.count({ where: { status: "offer_accepted" } }),
    prisma.investorReservation.count(),
    prisma.investorReservation.count({ where: { proofOfFundsVerified: true } }),
  ])

  const vendorConversionRate = totalVendors > 0
    ? ((vendorsAccepted / totalVendors) * 100).toFixed(1)
    : "0"

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title={`Welcome back, ${session?.user?.name || session?.user?.email || "there"}`}
          subtitle="Here's your pipeline at a glance"
          actions={
            <Link href="/dashboard/deals/new">
              <Button className="btn-primary h-9">
                <Plus className="mr-2 h-4 w-4" />
                New Deal
              </Button>
            </Link>
          }
        />

        {/* KPI strip */}
        <div className="ds-card grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--ds-border)]">
          <div className="p-6">
            <div className="flex items-start justify-between gap-2">
              <KpiCard
                label="Total Deals"
                value={String(totalDeals)}
                subLabel={`+${dealsThisMonth} this month`}
                valueType="highlight"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-300 mt-1 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  All deals across all stages: new, review, in-progress, ready, listed, reserved, sold, archived.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-2">
              <KpiCard
                label="Active Vendors"
                value={String(totalVendors)}
                subLabel={`${vendorsWithOffers} with offers`}
                valueType="neutral"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-300 mt-1 cursor-help shrink-0" />
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
                value={String(totalReservations)}
                subLabel={`${reservationsWithProof} verified`}
                valueType="neutral"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-300 mt-1 cursor-help shrink-0" />
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
                value={`${vendorConversionRate}%`}
                subLabel={`${vendorsAccepted} accepted`}
                valueType={Number(vendorConversionRate) > 0 ? "positive" : "neutral"}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-gray-300 mt-1 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  (Accepted Offers / Total Vendors) × 100. Shows % of vendors who accepted offers.
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* AI Rate Limits */}
        <RateLimitMonitor />

        {/* Pipeline Overview */}
        <div className="grid gap-4 md:grid-cols-2">
          <VendorPipelineCard />
          <TimeInStagesCard />
        </div>

        {/* Detailed Analytics */}
        <DashboardAnalytics />
      </div>
    </TooltipProvider>
  )
}
