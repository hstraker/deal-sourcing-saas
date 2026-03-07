"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import {
  Users, TrendingUp, FileText, Activity, PoundSterling,
  Eye, Download, CheckCircle, AlertCircle, Trophy, Shield,
  Lock, Clock, Package, Banknote, FileCheck, ChevronRight, Ban,
} from "lucide-react"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"

// ── Types ──────────────────────────────────────────────────────────────────────

interface InvestorStats {
  overview: {
    totalInvestors: number
    activeInvestors: number
    totalReservations: number
    activeReservations: number
    completedReservations: number
    cancelledReservations: number
    totalPurchases: number
    totalRevenue: number
  }
  reservationStats: {
    feesCollected: number
    feesOutstanding: number
    feesCollectedCount: number
    feesPendingCount: number
    pofVerified: number
    lockOutSigned: number
  }
  byStage: Record<string, number>
  byReservationStatus: Record<string, number>
  packStats: {
    totalPacksSent: number
    packsViewed: number
    packsDownloaded: number
    viewRate: number
    downloadRate: number
  }
  conversionRates: {
    leadToQualified: number
    qualifiedToPurchased: number
    viewingToReserved: number
  }
  recentActivities: Array<{
    id: string
    activityType: string
    description: string | null
    createdAt: Date
    investor: { user: { firstName: string | null; lastName: string | null; email: string } }
  }>
  topInvestors: Array<{
    id: string
    totalSpent: number
    dealsPurchased: number
    user: { firstName: string | null; lastName: string | null; email: string }
  }>
}

// ── Static config ──────────────────────────────────────────────────────────────

const INVESTOR_STAGES = [
  { key: "LEAD",          label: "Lead",          color: "bg-gray-100 text-gray-700 border-gray-200" },
  { key: "CONTACTED",     label: "Contacted",     color: "bg-blue-100 text-blue-700 border-blue-200" },
  { key: "QUALIFIED",     label: "Qualified",     color: "bg-green-100 text-green-700 border-green-200" },
  { key: "VIEWING_DEALS", label: "Viewing Deals", color: "bg-purple-100 text-purple-700 border-purple-200" },
  { key: "RESERVED",      label: "Reserved",      color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
  { key: "PURCHASED",     label: "Purchased",     color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { key: "INACTIVE",      label: "Inactive",      color: "bg-red-100 text-red-700 border-red-200" },
]

const RESERVATION_PIPELINE = [
  { key: "pending",                label: "Pending",         color: "bg-gray-100 text-gray-800 border-gray-200",    icon: <Clock className="h-3 w-3" /> },
  { key: "pack_sent",              label: "Pack Sent",       color: "bg-blue-100 text-blue-800 border-blue-200",    icon: <Package className="h-3 w-3" /> },
  { key: "fee_pending",            label: "Fee Requested",   color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Banknote className="h-3 w-3" /> },
  { key: "fee_paid",               label: "Fee Paid",        color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle className="h-3 w-3" /> },
  { key: "proof_of_funds_pending", label: "POF Requested",   color: "bg-orange-100 text-orange-800 border-orange-200", icon: <FileText className="h-3 w-3" /> },
  { key: "pof_received",           label: "POF Received",    color: "bg-sky-100 text-sky-800 border-sky-200",       icon: <FileCheck className="h-3 w-3" /> },
  { key: "verified",               label: "POF Verified",    color: "bg-green-100 text-green-800 border-green-200", icon: <Shield className="h-3 w-3" /> },
  { key: "lock_out_sent",          label: "Lock-out Sent",   color: "bg-purple-100 text-purple-800 border-purple-200", icon: <FileText className="h-3 w-3" /> },
  { key: "locked_out",             label: "Lock-out Signed", color: "bg-violet-100 text-violet-800 border-violet-200", icon: <Lock className="h-3 w-3" /> },
  { key: "completed",              label: "Completed",       color: "bg-teal-100 text-teal-800 border-teal-200",    icon: <Trophy className="h-3 w-3" /> },
  { key: "cancelled",              label: "Cancelled",       color: "bg-red-100 text-red-800 border-red-200",       icon: <Ban className="h-3 w-3" /> },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function StatCard({
  title, icon, value, sub, valueClass = "",
}: {
  title: string
  icon: React.ReactNode
  value: React.ReactNode
  sub: React.ReactNode
  valueClass?: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-gray-400">{title}</CardTitle>
        <span className="text-gray-400">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
        <p className="text-xs text-gray-400 mt-1">{sub}</p>
      </CardContent>
    </Card>
  )
}

function pct(v: number) { return `${(v * 100).toFixed(1)}%` }

// ── Main component ─────────────────────────────────────────────────────────────

export function InvestorManagementDashboard() {
  const [stats, setStats] = useState<InvestorStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/investors/stats", { cache: "no-store" })
      .then((r) => r.json())
      .then(setStats)
      .catch(() => toast.error("Failed to load statistics"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center p-12 text-gray-400">Loading statistics…</div>
  if (!stats)  return <div className="text-center p-12 text-gray-400">No data available</div>

  const { overview, reservationStats: rs, byStage, byReservationStatus, packStats, conversionRates } = stats

  return (
    <div className="space-y-8">

      {/* ── Section 1: Investor overview ───────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Investors</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Investors"
            icon={<Users className="h-4 w-4" />}
            value={overview.totalInvestors}
            sub={<><span className="text-emerald-600 font-medium">{overview.activeInvestors} active</span> in last 30 days</>}
          />
          <StatCard
            title="Deals Purchased"
            icon={<Trophy className="h-4 w-4" />}
            value={overview.totalPurchases}
            sub={<>across {overview.totalInvestors} investor{overview.totalInvestors !== 1 ? "s" : ""}</>}
          />
          <StatCard
            title="Total Revenue"
            icon={<PoundSterling className="h-4 w-4" />}
            value={<span suppressHydrationWarning>£{overview.totalRevenue.toLocaleString()}</span>}
            sub="total spend by investors"
            valueClass="text-emerald-600"
          />
          <StatCard
            title="Packs Sent"
            icon={<FileText className="h-4 w-4" />}
            value={packStats.totalPacksSent}
            sub={<>{packStats.viewRate.toFixed(1)}% view · {packStats.downloadRate.toFixed(1)}% download rate</>}
          />
        </div>
      </section>

      {/* ── Section 2: Investor pipeline ──────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Investor Pipeline</h3>
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap gap-3">
              {INVESTOR_STAGES.map((s) => {
                const count = byStage[s.key] ?? 0
                return (
                  <div key={s.key} className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 min-w-[110px] ${s.color}`}>
                    <div>
                      <div className="text-xl font-bold leading-none">{count}</div>
                      <div className="text-[11px] font-medium mt-0.5">{s.label}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 3: Reservation overview ───────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reservations</h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Reservations"
            icon={<CheckCircle className="h-4 w-4" />}
            value={overview.totalReservations}
            sub={<><span className="text-emerald-600 font-medium">{overview.activeReservations} active</span> · {overview.completedReservations} completed{overview.cancelledReservations > 0 ? ` · ${overview.cancelledReservations} cancelled` : ""}</>}
          />
          <StatCard
            title="Fees Collected"
            icon={<PoundSterling className="h-4 w-4" />}
            value={<span suppressHydrationWarning>£{rs.feesCollected.toLocaleString()}</span>}
            sub={<>{rs.feesCollectedCount} of {overview.totalReservations} reservations paid</>}
            valueClass="text-emerald-600"
          />
          <StatCard
            title="Outstanding Fees"
            icon={<AlertCircle className="h-4 w-4" />}
            value={<span suppressHydrationWarning>£{rs.feesOutstanding.toLocaleString()}</span>}
            sub={rs.feesPendingCount > 0 ? `${rs.feesPendingCount} active reservation${rs.feesPendingCount !== 1 ? "s" : ""} unpaid` : "All active fees collected"}
            valueClass={rs.feesOutstanding > 0 ? "text-amber-600" : "text-gray-400"}
          />
          <StatCard
            title="Milestones"
            icon={<TrendingUp className="h-4 w-4" />}
            value={rs.lockOutSigned}
            sub={<>lock-out{rs.lockOutSigned !== 1 ? "s" : ""} signed · <span className="text-green-600 font-medium">{rs.pofVerified} POF verified</span></>}
          />
        </div>
      </section>

      {/* ── Section 4: Reservation pipeline ───────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Reservation Pipeline</h3>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              {RESERVATION_PIPELINE.map((w, i) => (
                <div key={w.key} className="flex items-center gap-1 shrink-0">
                  <div className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 min-w-[82px] ${w.color}`}>
                    <div className="text-xl font-bold leading-none">{byReservationStatus[w.key] ?? 0}</div>
                    <div className="flex items-center gap-1 text-[10px] font-medium whitespace-nowrap">
                      {w.icon}{w.label}
                    </div>
                  </div>
                  {i < RESERVATION_PIPELINE.length - 1 && (
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 5: Conversion + Pack performance ──────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Conversion funnel */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Conversion Rates</h3>
          <div className="grid gap-3">
            {[
              { label: "Lead → Qualified",      value: conversionRates.leadToQualified },
              { label: "Qualified → Purchased",  value: conversionRates.qualifiedToPurchased },
              { label: "Viewing → Reserved",     value: conversionRates.viewingToReserved },
            ].map(({ label, value }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <span className="text-sm text-gray-400">{label}</span>
                  <span className="text-xl font-bold">{pct(value)}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Pack performance */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Investor Pack Performance</h3>
          <div className="grid gap-3">
            {[
              { icon: <FileText className="h-5 w-5 text-purple-600" />, label: "Total Sent",  value: packStats.totalPacksSent,    sub: "investor packs" },
              { icon: <Eye className="h-5 w-5 text-blue-600" />,        label: "Viewed",      value: packStats.packsViewed,        sub: `${packStats.viewRate.toFixed(1)}% of sent` },
              { icon: <Download className="h-5 w-5 text-green-600" />,  label: "Downloaded",  value: packStats.packsDownloaded,    sub: `${packStats.downloadRate.toFixed(1)}% of sent` },
            ].map(({ icon, label, value, sub }) => (
              <Card key={label}>
                <CardContent className="pt-4 pb-4 flex items-center gap-4">
                  {icon}
                  <div className="flex-1">
                    <p className="text-xs text-gray-400">{label}</p>
                    <p className="text-xl font-bold leading-tight">{value}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* ── Section 6: Top investors ───────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Top Investors by Spend</h3>
        <Card>
          <CardContent className="pt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                  <TableHead className="text-right">Total Spent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.topInvestors.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-400 py-6">No investors with purchases yet</TableCell>
                  </TableRow>
                ) : stats.topInvestors.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.user.firstName} {inv.user.lastName || ""}
                    </TableCell>
                    <TableCell className="text-gray-400 text-sm">{inv.user.email}</TableCell>
                    <TableCell className="text-right">{inv.dealsPurchased}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(Number(inv.totalSpent))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Section 7: Recent activity ─────────────────────────────────────── */}
      <section className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">Recent Activity</h3>
        <Card>
          <CardContent className="pt-4">
            {stats.recentActivities.length === 0 ? (
              <p className="text-center text-gray-400 py-6">No recent activities</p>
            ) : (
              <div className="divide-y">
                {stats.recentActivities.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {a.investor.user.firstName} {a.investor.user.lastName || ""}
                      </p>
                      <p className="text-sm text-gray-400 truncate">
                        {a.description || a.activityType}
                      </p>
                      <p suppressHydrationWarning className="text-xs text-gray-400 mt-0.5">
                        {new Date(a.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{a.activityType}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

    </div>
  )
}
