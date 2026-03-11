// app/dashboard/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { RateLimitMonitor } from "@/components/vendor-pipeline/rate-limit-monitor"
import { VendorPipelineCard } from "@/components/dashboard/vendor-pipeline-card"
import { TimeInStagesCard } from "@/components/dashboard/time-in-stages-card"
import { ActionRequiredStrip } from "@/components/dashboard/action-required-strip"
import { DashboardKpiStrip } from "@/components/dashboard/dashboard-kpi-strip"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Plus, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Email Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
}

function dotColor(eventType: string): string {
  if (eventType === "offer_accepted" || eventType === "deal_validated") return "bg-green-500"
  if (eventType === "offer_rejected" || eventType === "deal_rejected") return "bg-red-500"
  if (eventType === "vendor_offer_sent") return "bg-yellow-500"
  return "bg-blue-500"
}

function eventTitle(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = STAGE_LABELS[details.toStage as string] ?? details.toStage ?? "—"
    return `Stage → ${to}`
  }
  if (eventType === "vendor_offer_sent") {
    const price = details.offerPrice ? ` £${Number(details.offerPrice).toLocaleString()}` : ""
    return `Offer sent${price}`
  }
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const recentEvents = await prisma.pipelineEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      eventType: true,
      details: true,
      createdAt: true,
      vendorLead: {
        select: { vendorName: true },
      },
    },
  })

  return (
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

      {/* Pipeline action alerts — amber strip showing deals/vendors needing attention */}
      <ActionRequiredStrip />

      {/* KPI strip — client component, fetches /api/analytics/kpis with date filter */}
      <DashboardKpiStrip />

      {/* AI Rate Limits */}
      <RateLimitMonitor />

      {/* Pipeline Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <VendorPipelineCard />
        <TimeInStagesCard />
      </div>

      {/* Recent Activity mini-feed */}
      <div className="ds-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-[#2563EB]" />
            Recent Activity
          </h3>
          <Link
            href="/dashboard/vendors/activity"
            className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-5">
          {recentEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No activity recorded yet</p>
          ) : (
            <ol className="relative ml-3 space-y-4 border-l border-[var(--ds-border)]">
              {recentEvents.map((ev) => {
                const details = (ev.details ?? {}) as Record<string, unknown>
                const color = dotColor(ev.eventType)
                const title = eventTitle(ev.eventType, details)
                return (
                  <li key={ev.id} className="ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <p className="text-sm font-medium leading-tight">{title}</p>
                    {ev.vendorLead && (
                      <p className="text-xs text-gray-500">{ev.vendorLead.vendorName}</p>
                    )}
                    <time
                      suppressHydrationWarning
                      className="mt-0.5 block text-xs text-gray-400/70"
                    >
                      {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                    </time>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
