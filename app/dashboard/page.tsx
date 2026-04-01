// app/dashboard/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ActionRequiredStrip } from "@/components/dashboard/action-required-strip"
import { DashboardKpiStrip } from "@/components/dashboard/dashboard-kpi-strip"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import {
  Plus,
  Clock,
  ArrowRight,
  TrendingUp,
  Home,
  Users,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

// ── Stage display config ────────────────────────────────────────────────────

// Funnel buckets group raw PipelineStage values into 5 meaningful business steps
const FUNNEL_BUCKETS = [
  {
    label: "New Leads",
    stages: ["NEW_LEAD", "AI_CONVERSATION"],
    color: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
  },
  {
    label: "Validating",
    stages: ["DEAL_VALIDATION"],
    color: "bg-yellow-100 text-yellow-800 border-yellow-200",
    dot: "bg-yellow-500",
  },
  {
    label: "Offer Sent",
    stages: ["OFFER_MADE", "VIDEO_SENT", "RETRY_1", "RETRY_2", "RETRY_3"],
    color: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
  },
  {
    label: "Accepted",
    stages: ["OFFER_ACCEPTED", "PAPERWORK_SENT"],
    color: "bg-purple-100 text-purple-800 border-purple-200",
    dot: "bg-purple-500",
  },
  {
    label: "Ready for Investors",
    stages: ["READY_FOR_INVESTORS"],
    color: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
  },
]

const DEAD_STAGES = ["DEAD_LEAD", "OFFER_REJECTED"]

// ── Deal status display config ──────────────────────────────────────────────

const DEAL_STATUS_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  new:         { label: "New",         color: "text-gray-500" },
  review:      { label: "Review",      color: "text-yellow-600" },
  in_progress: { label: "In Progress", color: "text-blue-600" },
  ready:       { label: "Ready",       color: "text-indigo-600" },
  listed:      { label: "Listed",      color: "text-green-600" },
  reserved:    { label: "Reserved",    color: "text-purple-600" },
  sold:        { label: "Sold",        color: "text-emerald-600" },
}

// ── Activity helpers ────────────────────────────────────────────────────────

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

// ── Page ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const [leadsByStage, dealsByStatus, dealMetrics, recentEvents] = await Promise.all([
    // VendorLead counts per pipeline stage (active leads only)
    prisma.vendorLead.groupBy({
      by: ["pipelineStage"],
      _count: { id: true },
    }),

    // Deal counts per status (exclude archived)
    prisma.deal.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { status: { not: "archived" } },
    }),

    // Avg BMV% and gross yield for deals that are ready or listed
    prisma.deal.aggregate({
      where: {
        status: { in: ["ready", "listed"] },
        bmvPercentage: { not: null },
      },
      _avg: { bmvPercentage: true, grossYield: true },
      _count: { id: true },
    }),

    // Recent activity feed
    prisma.pipelineEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        eventType: true,
        details: true,
        createdAt: true,
        vendorLead: { select: { vendorName: true } },
      },
    }),
  ])

  // Build a lookup map: stage → count
  const stageCountMap = Object.fromEntries(
    leadsByStage.map((r) => [r.pipelineStage, r._count.id])
  )

  // Compute funnel bucket totals
  const funnelData = FUNNEL_BUCKETS.map((bucket) => ({
    ...bucket,
    count: bucket.stages.reduce((sum, s) => sum + (stageCountMap[s] ?? 0), 0),
  }))

  // Dead / lost counts
  const deadCount = DEAD_STAGES.reduce((sum, s) => sum + (stageCountMap[s] ?? 0), 0)

  // Build deal status lookup
  const dealStatusMap = Object.fromEntries(
    dealsByStatus.map((r) => [r.status, r._count.id])
  )

  const avgBmv = dealMetrics._avg.bmvPercentage
  const avgYield = dealMetrics._avg.grossYield
  const liveDealsCount = dealMetrics._count.id

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.name || session?.user?.email || "there"}`}
        subtitle="Your sourcing pipeline at a glance"
        actions={
          <Link href="/dashboard/deals/new">
            <Button className="btn-primary h-9">
              <Plus className="mr-2 h-4 w-4" />
              New Deal
            </Button>
          </Link>
        }
      />

      {/* Urgent items needing attention */}
      <ActionRequiredStrip />

      {/* KPI strip — client component with optional date filter */}
      <DashboardKpiStrip />

      {/* Pipeline + Deals snapshot */}
      <div className="grid gap-4 md:grid-cols-2">

        {/* ── Vendor Lead Pipeline ─────────────────────────────── */}
        <div className="ds-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                Lead Pipeline
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">Active leads by stage</p>
            </div>
            <Link href="/dashboard/vendors">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="p-5">
            {/* Funnel steps */}
            <div className="space-y-2">
              {funnelData.map((bucket, i) => {
                const maxCount = Math.max(...funnelData.map((b) => b.count), 1)
                const pct = Math.round((bucket.count / maxCount) * 100)
                return (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <span className="w-5 text-right text-xs font-semibold text-gray-400">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{bucket.label}</span>
                        <span className="text-sm font-bold text-gray-900">{bucket.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div
                          className={cn("h-2 rounded-full transition-all", bucket.dot)}
                          style={{ width: `${Math.max(pct, bucket.count > 0 ? 4 : 0)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Dead/lost leads count */}
            {deadCount > 0 && (
              <p className="mt-4 text-xs text-gray-400">
                {deadCount} lead{deadCount !== 1 ? "s" : ""} marked as dead or rejected
              </p>
            )}
          </div>
        </div>

        {/* ── Deals Snapshot ───────────────────────────────────── */}
        <div className="ds-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Home className="h-4 w-4 text-indigo-600" />
                Deals
              </h3>
              <p className="mt-0.5 text-xs text-gray-400">Investment opportunities by status</p>
            </div>
            <Link href="/dashboard/deals">
              <Button variant="ghost" size="sm" className="h-8 text-xs">
                View All <ArrowRight className="ml-1 h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="p-5 space-y-5">
            {/* Status counts */}
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(DEAL_STATUS_CONFIG).map(([status, cfg]) => {
                const count = dealStatusMap[status] ?? 0
                return (
                  <div
                    key={status}
                    className="rounded-lg border border-[var(--ds-border)] p-3 text-center"
                  >
                    <div className={cn("text-xl font-bold", cfg.color)}>{count}</div>
                    <div className="mt-0.5 text-[10px] text-gray-400">{cfg.label}</div>
                  </div>
                )
              })}
            </div>

            {/* Live deal quality metrics */}
            {liveDealsCount > 0 ? (
              <div className="rounded-lg border border-[var(--ds-border)] bg-gray-50/50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Ready &amp; Listed — avg metrics ({liveDealsCount} deal{liveDealsCount !== 1 ? "s" : ""})
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-2xl font-bold text-indigo-700">
                      {avgBmv != null ? `${Number(avgBmv).toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-gray-400">Avg BMV below market</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-700">
                      {avgYield != null ? `${Number(avgYield).toFixed(1)}%` : "—"}
                    </div>
                    <div className="text-xs text-gray-400">Avg gross yield</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400">No deals currently ready or listed</p>
                <Link href="/dashboard/deals/new" className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                  Add a deal →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Investor Reservations quick-view ─────────────────────────────────── */}
      <div className="ds-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-purple-600" />
            Investor Reservations
          </h3>
          <Link href="/dashboard/reservations" className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <RecentReservations />
      </div>

      {/* ── Recent Activity ───────────────────────────────────────────────────── */}
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

// ── RecentReservations ──────────────────────────────────────────────────────
// Server component — shows the 5 most recent active reservations inline.

async function RecentReservations() {
  const reservations = await prisma.investorReservation.findMany({
    where: { status: { not: "cancelled" } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      status: true,
      createdAt: true,
      proofOfFundsVerified: true,
      deal: { select: { address: true } },
      investor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
    },
  })

  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    pack_sent: "Pack Sent",
    fee_pending: "Fee Pending",
    fee_paid: "Fee Paid",
    proof_of_funds_pending: "Proof of Funds",
    pof_received: "PoF Received",
    verified: "Verified",
    lock_out_sent: "Lock Out Sent",
    locked_out: "Locked Out",
    completed: "Completed",
  }

  const STATUS_COLORS: Record<string, string> = {
    pending: "text-gray-500",
    pack_sent: "text-blue-600",
    fee_pending: "text-yellow-600",
    fee_paid: "text-yellow-700",
    proof_of_funds_pending: "text-orange-600",
    pof_received: "text-orange-700",
    verified: "text-green-600",
    lock_out_sent: "text-purple-600",
    locked_out: "text-purple-700",
    completed: "text-emerald-700",
  }

  if (reservations.length === 0) {
    return (
      <div className="p-5 text-center text-sm text-gray-400">
        No active reservations yet.{" "}
        <Link href="/dashboard/deals" className="text-blue-600 hover:underline">
          List a deal →
        </Link>
      </div>
    )
  }

  return (
    <div className="divide-y divide-[var(--ds-border)]">
      {reservations.map((r) => {
        const investorName = r.investor?.user
          ? `${r.investor.user.firstName ?? ""} ${r.investor.user.lastName ?? ""}`.trim() || r.investor.user.email
          : "Unknown investor"
        return (
          <div key={r.id} className="flex items-center justify-between px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{investorName}</p>
              <p className="truncate text-xs text-gray-400">{r.deal?.address ?? "—"}</p>
            </div>
            <div className="ml-4 shrink-0 text-right">
              <span className={cn("text-xs font-semibold", STATUS_COLORS[r.status] ?? "text-gray-500")}>
                {STATUS_LABELS[r.status] ?? r.status}
              </span>
              {r.proofOfFundsVerified && (
                <p className="text-[10px] text-green-600">PoF verified</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
