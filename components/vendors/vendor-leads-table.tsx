"use client"

/**
 * VendorLeadsTable — Lendlord.io-style vendor leads listing.
 *
 * Features:
 *  - KPI bar (Total, In Conversation, Offers Made, Dead Leads)
 *  - Tab bar to control expanded-row panel (Comparables / Portal Check)
 *  - Horizontally scrollable sticky table with sticky action column
 *  - Inline row expansion via PortalCheckDetailPanel / VendorComparablesTab
 *  - Auto-polling for RUNNING processing status
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  ExternalLink,
  Phone,
  MapPin,
  Search,
  Plus,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Shield,
  BarChart2,
  Users,
  TrendingUp,
  Skull,
  SlidersHorizontal,
} from "lucide-react"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProcessingStatus = "PENDING" | "RUNNING" | "COMPLETE" | "FAILED"

type PipelineStage =
  | "NEW_LEAD"
  | "AI_CONVERSATION"
  | "DEAL_VALIDATION"
  | "OFFER_MADE"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "VIDEO_SENT"
  | "RETRY_1"
  | "RETRY_2"
  | "RETRY_3"
  | "PAPERWORK_SENT"
  | "READY_FOR_INVESTORS"
  | "DEAD_LEAD"

interface VendorLead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  bedrooms: number | null
  propertyType: string | null
  pipelineStage: PipelineStage
  processingStatus: ProcessingStatus
  latestCheckRisk: string | null
  latestCheckedAt: string | null
  bmvValidatedAt: string | null
  portalCheckedAt: string | null
  createdAt: string
  isTest: boolean
  leadSource: string
}

type ExpandedTab = "comparables" | "portal-check"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<PipelineStage, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "Conversation",
  DEAL_VALIDATION: "Validation",
  OFFER_MADE: "Offer Made",
  OFFER_ACCEPTED: "Accepted",
  OFFER_REJECTED: "Rejected",
  VIDEO_SENT: "Video Sent",
  RETRY_1: "Retry 1",
  RETRY_2: "Retry 2",
  RETRY_3: "Retry 3",
  PAPERWORK_SENT: "Paperwork",
  READY_FOR_INVESTORS: "Ready",
  DEAD_LEAD: "Dead",
}

const STAGE_CLASS: Record<PipelineStage, string> = {
  NEW_LEAD: "bg-blue-100 text-blue-800 border-blue-200",
  AI_CONVERSATION: "bg-violet-100 text-violet-800 border-violet-200",
  DEAL_VALIDATION: "bg-amber-100 text-amber-800 border-amber-200",
  OFFER_MADE: "bg-emerald-100 text-emerald-800 border-emerald-200",
  OFFER_ACCEPTED: "bg-green-100 text-green-800 border-green-200",
  OFFER_REJECTED: "bg-red-100 text-red-800 border-red-200",
  VIDEO_SENT: "bg-sky-100 text-sky-800 border-sky-200",
  RETRY_1: "bg-orange-100 text-orange-800 border-orange-200",
  RETRY_2: "bg-orange-100 text-orange-800 border-orange-200",
  RETRY_3: "bg-orange-100 text-orange-800 border-orange-200",
  PAPERWORK_SENT: "bg-teal-100 text-teal-800 border-teal-200",
  READY_FOR_INVESTORS: "bg-green-100 text-green-800 border-green-200",
  DEAD_LEAD: "bg-gray-100 text-gray-600 border-gray-200",
}

const RISK_CLASS: Record<string, string> = {
  clear: "bg-green-100 text-green-800 border-green-200",
  caution: "bg-amber-100 text-amber-800 border-amber-200",
  red_flag: "bg-red-100 text-red-800 border-red-200",
}

const RISK_LABEL: Record<string, string> = {
  clear: "Clear",
  caution: "Caution",
  red_flag: "Red Flag",
}

function ProcessingBadge({ status }: { status: ProcessingStatus }) {
  switch (status) {
    case "RUNNING":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
          <Loader2 className="h-3 w-3 animate-spin" />
          Running
        </span>
      )
    case "COMPLETE":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
          <CheckCircle2 className="h-3 w-3" />
          Done
        </span>
      )
    case "FAILED":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
          <XCircle className="h-3 w-3" />
          Failed
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-500">
          <Clock className="h-3 w-3" />
          Pending
        </span>
      )
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────────────────────────────────────

function KpiCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xl font-bold leading-none text-gray-900">{value}</p>
        <p className="mt-0.5 text-xs text-gray-500">{label}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function VendorLeadsTable() {
  const router = useRouter()
  const [leads, setLeads] = useState<VendorLead[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [expandedTab, setExpandedTab] = useState<ExpandedTab>("portal-check")
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch leads ────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/vendor-pipeline/leads?limit=100")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setLeads(data.leads ?? [])
      setTotal(data.total ?? 0)
    } catch {
      toast.error("Failed to load vendor leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // ── Poll processing status for RUNNING leads ───────────────────────────────
  useEffect(() => {
    const runningLeads = leads.filter((l) => l.processingStatus === "RUNNING")

    if (runningLeads.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    if (!pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const updates = await Promise.allSettled(
          runningLeads.map((l) =>
            fetch(`/api/vendors/${l.id}/processing-status`).then((r) => r.json())
          )
        )

        setLeads((prev) => {
          const next = [...prev]
          updates.forEach((result, i) => {
            if (result.status === "fulfilled" && result.value) {
              const idx = next.findIndex((l) => l.id === runningLeads[i].id)
              if (idx !== -1) {
                next[idx] = { ...next[idx], ...result.value }
              }
            }
          })
          return next
        })
      }, 5000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [leads])

  // ── Derived ────────────────────────────────────────────────────────────────
  const filtered = leads.filter((l) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      l.vendorName.toLowerCase().includes(q) ||
      l.vendorPhone.includes(q) ||
      (l.propertyAddress ?? "").toLowerCase().includes(q) ||
      (l.propertyPostcode ?? "").toLowerCase().includes(q)
    )
  })

  const kpi = {
    total: leads.length,
    inConversation: leads.filter((l) =>
      ["AI_CONVERSATION", "DEAL_VALIDATION"].includes(l.pipelineStage)
    ).length,
    offersMade: leads.filter((l) =>
      ["OFFER_MADE", "OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"].includes(
        l.pipelineStage
      )
    ).length,
    dead: leads.filter((l) => l.pipelineStage === "DEAD_LEAD").length,
  }

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  const handleRiskUpdated = (
    leadId: string,
    newRisk: string | null,
    newDate: string | null
  ) => {
    setLeads((prev) =>
      prev.map((l) =>
        l.id === leadId
          ? { ...l, latestCheckRisk: newRisk, latestCheckedAt: newDate }
          : l
      )
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4">
      {/* KPI Bar */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard icon={Users} label="Total Leads" value={kpi.total} color="bg-blue-50 text-blue-600" />
        <KpiCard icon={TrendingUp} label="In Conversation" value={kpi.inConversation} color="bg-violet-50 text-violet-600" />
        <KpiCard icon={BarChart2} label="Offers Made" value={kpi.offersMade} color="bg-emerald-50 text-emerald-600" />
        <KpiCard icon={Skull} label="Dead Leads" value={kpi.dead} color="bg-gray-100 text-gray-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name, phone or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-sm"
          />
        </div>

        {/* Tab bar */}
        <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-xs font-medium">
          {(["portal-check", "comparables"] as ExpandedTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setExpandedTab(tab)}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                expandedTab === tab
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              {tab === "portal-check" ? (
                <span className="flex items-center gap-1.5"><Shield className="h-3 w-3" />Portal Check</span>
              ) : (
                <span className="flex items-center gap-1.5"><BarChart2 className="h-3 w-3" />Comparables</span>
              )}
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={fetchLeads}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>

        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => router.push("/dashboard/vendors/new")}
        >
          <Plus className="h-3.5 w-3.5" />
          Add Lead
        </Button>
      </div>

      {/* Table */}
      <div className="relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/80 text-left">
                <th className="w-8 px-3 py-2.5" />
                <th className="px-3 py-2.5 font-medium text-gray-600">Vendor</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Property</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Stage</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Price</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Processing</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Portal Risk</th>
                <th className="px-3 py-2.5 font-medium text-gray-600">Portal Checked</th>
                {/* Sticky action column */}
                <th className="sticky right-0 bg-gray-50/80 px-3 py-2.5 font-medium text-gray-600 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              )}

              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-gray-400">
                    <AlertCircle className="mx-auto mb-2 h-5 w-5 opacity-40" />
                    <p className="text-sm">No leads found</p>
                  </td>
                </tr>
              )}

              {filtered.map((lead) => {
                const isExpanded = expandedId === lead.id

                return (
                  <>
                    <tr
                      key={lead.id}
                      className={cn(
                        "group border-b border-gray-100 transition-colors hover:bg-gray-50/60 cursor-pointer",
                        isExpanded && "bg-blue-50/40"
                      )}
                      onClick={() => toggleExpand(lead.id)}
                    >
                      {/* Expand toggle */}
                      <td className="px-3 py-2.5 text-gray-400">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </td>

                      {/* Vendor */}
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-gray-900">{lead.vendorName}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                          <Phone className="h-3 w-3" />
                          {lead.vendorPhone}
                        </p>
                      </td>

                      {/* Property */}
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="truncate text-gray-700">
                          {lead.propertyAddress ?? <span className="italic text-gray-400">No address</span>}
                        </p>
                        {lead.propertyPostcode && (
                          <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                            <MapPin className="h-3 w-3" />
                            {lead.propertyPostcode}
                          </p>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="px-3 py-2.5">
                        <span
                          className={cn(
                            "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                            STAGE_CLASS[lead.pipelineStage]
                          )}
                        >
                          {STAGE_LABEL[lead.pipelineStage]}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="px-3 py-2.5 text-gray-700">
                        {lead.askingPrice ? formatCurrency(lead.askingPrice) : "—"}
                      </td>

                      {/* Processing */}
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <ProcessingBadge status={lead.processingStatus} />
                      </td>

                      {/* Portal risk */}
                      <td className="px-3 py-2.5">
                        {lead.latestCheckRisk ? (
                          <span
                            className={cn(
                              "inline-block rounded-full border px-2 py-0.5 text-xs font-medium",
                              RISK_CLASS[lead.latestCheckRisk] ?? "bg-gray-100 text-gray-600"
                            )}
                          >
                            {RISK_LABEL[lead.latestCheckRisk] ?? lead.latestCheckRisk}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      {/* Portal checked date */}
                      <td className="px-3 py-2.5 text-xs text-gray-500">
                        {fmtDate(lead.portalCheckedAt ?? lead.latestCheckedAt)}
                      </td>

                      {/* Actions — sticky right */}
                      <td
                        className="sticky right-0 bg-white px-3 py-2.5 shadow-[-4px_0_8px_-4px_rgba(0,0,0,0.08)] group-hover:bg-gray-50/60"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Open lead"
                            onClick={() => router.push(`/dashboard/vendors/${lead.id}`)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${lead.id}-expanded`} className="bg-blue-50/30">
                        <td colSpan={9} className="px-4 py-4">
                          {expandedTab === "portal-check" ? (
                            <PortalCheckDetailPanel
                              leadId={lead.id}
                              latestCheckRisk={lead.latestCheckRisk}
                              latestCheckedAt={lead.latestCheckedAt}
                              onRiskUpdated={(risk, date) =>
                                handleRiskUpdated(lead.id, risk, date)
                              }
                            />
                          ) : (
                            <VendorComparablesTab
                              vendorLeadId={lead.id}
                              askingPrice={lead.askingPrice ?? undefined}
                              propertyPostcode={lead.propertyPostcode}
                            />
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2 text-xs text-gray-500">
            <span>
              Showing {filtered.length} of {total} leads
            </span>
            {leads.some((l) => l.processingStatus === "RUNNING") && (
              <span className="flex items-center gap-1 text-blue-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                Auto-refreshing…
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
