"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Download, RefreshCw, ExternalLink, Search,
  Package, Eye, TrendingUp, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow, isAfter, subDays } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackDelivery {
  id: string
  dealId: string
  deliveryMethod: string
  recipientEmail: string | null
  partNumber: number | null
  emailStatus: string | null
  sentAt: string
  viewedAt: string | null
  downloadedAt: string | null
  viewCount: number
  downloadCount: number
  downloadToken: string | null
  investor: {
    user: {
      firstName: string | null
      lastName: string | null
      email: string
    }
  }
  generation: {
    propertyAddress: string
    askingPrice: number | null
    template: { name: string } | null
  } | null
}

interface Props {
  deliveries: PackDelivery[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function investorName(d: PackDelivery): string {
  const { firstName, lastName, email } = d.investor.user
  return [firstName, lastName].filter(Boolean).join(" ") || email
}

function investorInitial(d: PackDelivery): string {
  return investorName(d).charAt(0).toUpperCase()
}

function statusLabel(d: PackDelivery): { label: string; cls: string } {
  if (d.downloadCount > 0)
    return { label: `Downloaded (${d.downloadCount})`, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  if (d.viewCount > 0)
    return { label: `Viewed (${d.viewCount})`, cls: "bg-blue-100 text-blue-700 border-blue-200" }
  if (d.emailStatus === "failed")
    return { label: "Failed", cls: "bg-red-100 text-red-700 border-red-200" }
  if (d.emailStatus === "no_smtp")
    return { label: "No SMTP", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  return { label: "Sent", cls: "bg-gray-100 text-gray-600 border-gray-200" }
}

const STATUS_FILTERS = ["All", "Sent", "Viewed", "Downloaded"] as const
const METHOD_FILTERS = ["All", "Email", "Download", "Manual"] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function InvestorPacksClient({ deliveries }: Props) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("All")
  const [methodFilter, setMethodFilter] = useState<typeof METHOD_FILTERS[number]>("All")
  const [resendingId, setResendingId] = useState<string | null>(null)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = deliveries.length
    const opened = deliveries.filter((d) => d.viewCount > 0).length
    const downloaded = deliveries.filter((d) => d.downloadCount > 0).length
    const thisWeek = deliveries.filter((d) =>
      d.sentAt && isAfter(new Date(d.sentAt), subDays(new Date(), 7))
    ).length
    return { total, opened, downloaded, thisWeek }
  }, [deliveries])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return deliveries.filter((d) => {
      if (q) {
        const name = investorName(d).toLowerCase()
        const email = d.investor.user.email.toLowerCase()
        const address = (d.generation?.propertyAddress ?? "").toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !address.includes(q)) return false
      }
      if (statusFilter === "Sent" && (d.viewCount > 0 || d.downloadCount > 0)) return false
      if (statusFilter === "Viewed" && d.viewCount === 0) return false
      if (statusFilter === "Downloaded" && d.downloadCount === 0) return false
      if (methodFilter !== "All" && d.deliveryMethod.toLowerCase() !== methodFilter.toLowerCase()) return false
      return true
    })
  }, [deliveries, search, statusFilter, methodFilter])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDownload = (d: PackDelivery) => {
    if (!d.downloadToken) {
      toast.error("No download link available for this delivery.")
      return
    }
    window.open(`/api/deals/${d.dealId}/investor-pack?token=${d.downloadToken}`, "_blank")
  }

  const handleResend = async (d: PackDelivery) => {
    setResendingId(d.id)
    try {
      const res = await fetch(`/api/investors/pack-delivery/${d.id}/resend`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to resend")
      if (data.noSmtp) {
        toast.warning("SMTP not configured — pack was not emailed.")
      } else {
        toast.success("Pack re-sent successfully.")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setResendingId(null)
    }
  }

  const handleViewDeal = (d: PackDelivery) => {
    window.location.href = `/dashboard/deals/${d.dealId}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Investor Packs</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Track every investor pack delivery, view engagement, and resend packs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sent",     value: stats.total,      icon: Package,    color: "text-gray-600" },
          { label: "Opened",         value: stats.total > 0 ? `${Math.round((stats.opened / stats.total) * 100)}%` : "—",
            icon: Eye,      color: "text-blue-600" },
          { label: "Downloaded",     value: stats.total > 0 ? `${Math.round((stats.downloaded / stats.total) * 100)}%` : "—",
            icon: TrendingUp, color: "text-emerald-600" },
          { label: "Sent This Week", value: stats.thisWeek,   icon: Calendar,  color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="ds-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search investor or property…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                statusFilter === f
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {METHOD_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setMethodFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                methodFilter === f
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-400 self-center ml-auto">
          {filtered.length} {filtered.length === 1 ? "delivery" : "deliveries"}
        </span>
      </div>

      {/* Table / Empty */}
      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-14 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No packs sent yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Packs are generated from the Vendor Leads page when a deal is ready for investors.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No deliveries match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Investor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Part</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const { label: statusLbl, cls: statusCls } = statusLabel(d)
                  const name = investorName(d)
                  return (
                    <tr key={d.id} className="table-row group">
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-purple-100 flex items-center justify-center text-xs font-semibold text-purple-700">
                            {investorInitial(d)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 leading-tight">{name}</p>
                            <p className="text-xs text-gray-400">{d.investor.user.email}</p>
                          </div>
                        </div>
                      </td>

                      <td className="table-cell">
                        <span className="text-gray-700 line-clamp-1">
                          {d.generation?.propertyAddress ?? <span className="text-gray-300">—</span>}
                        </span>
                      </td>

                      <td className="table-cell">
                        <span className="text-gray-600">
                          {d.generation?.template?.name ?? <span className="text-gray-300">—</span>}
                        </span>
                      </td>

                      <td className="table-cell">
                        <span className="text-gray-600">
                          {d.partNumber ? `Part ${d.partNumber}` : "Full"}
                        </span>
                      </td>

                      <td className="table-cell text-gray-500">
                        {d.sentAt
                          ? formatDistanceToNow(new Date(d.sentAt), { addSuffix: true })
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      <td className="table-cell">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          statusCls
                        )}>
                          {statusLbl}
                        </span>
                      </td>

                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(d)}
                            disabled={!d.downloadToken}
                            title={!d.downloadToken ? "No download link available" : "Download pack PDF"}
                            className="gap-1.5"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(d)}
                            disabled={resendingId === d.id || d.deliveryMethod !== "email"}
                            title={d.deliveryMethod !== "email" ? "Not sent by email" : "Resend pack email"}
                            className="gap-1.5"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", resendingId === d.id && "animate-spin")} />
                            Resend
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDeal(d)}
                            className="gap-1.5"
                            title="View deal"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Deal
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
