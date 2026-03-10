"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VendorComparablesTab } from "@/components/vendors/vendor-comparables-tab"
import { Search, BarChart3, RefreshCw } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyType: string | null
  bedrooms: number | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  estimatedMonthlyRent: number | null
  pipelineStage: string
  comparablesCount: number | null
  comparablesFetchedAt: string | null
  comparablesConfidence: string | null
  avgComparablePrice: number | null
}

// ── Confidence badge ──────────────────────────────────────────────────────────

const CONFIDENCE_CONFIG: Record<string, { label: string; cls: string }> = {
  HIGH:   { label: "High",       cls: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  MEDIUM: { label: "Medium",     cls: "bg-amber-100   text-amber-700   border-amber-200"   },
  LOW:    { label: "Low",        cls: "bg-red-100     text-red-700     border-red-200"     },
}

function ConfidenceBadge({ confidence }: { confidence: string | null }) {
  const cfg = confidence ? CONFIDENCE_CONFIG[confidence] : null
  if (!cfg) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
        Not Fetched
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const STATUS_CHIPS = ["All", "Not Fetched", "High", "Medium", "Low"] as const
type StatusChip = typeof STATUS_CHIPS[number]

// ── Component ─────────────────────────────────────────────────────────────────

export function ComparablesListClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusChip>("All")
  const [recheckingId, setRecheckingId] = useState<string | null>(null)
  const [popupLead, setPopupLead] = useState<Lead | null>(null)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      // Search
      if (q) {
        const match =
          l.vendorName.toLowerCase().includes(q) ||
          (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
          (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      // Status chip
      switch (statusFilter) {
        case "Not Fetched": return !l.comparablesFetchedAt
        case "High":        return l.comparablesConfidence === "HIGH"
        case "Medium":      return l.comparablesConfidence === "MEDIUM"
        case "Low":         return l.comparablesConfidence === "LOW"
        default:            return true
      }
    })
  }, [leads, search, statusFilter])

  // ── Recheck ────────────────────────────────────────────────────────────────
  const handleRecheck = async (lead: Lead) => {
    setRecheckingId(lead.id)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}/fetch-comparables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRefresh: true }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? "Failed to fetch comparables")
      }
      // Update this lead's summary stats in local state
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                comparablesCount:      data.data.count,
                comparablesConfidence: data.data.confidence,
                avgComparablePrice:    data.data.avgPrice,
                comparablesFetchedAt:  new Date().toISOString(),
              }
            : l
        )
      )
      toast.success(`Comparables refreshed — ${data.data.count} found`)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setRecheckingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comparables</h1>
        <p className="text-sm text-gray-400 mt-1">
          View and manage comparable property data for all vendor leads
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setStatusFilter(chip)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              statusFilter === chip
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} leads</span>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No leads match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asking Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Avg Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"># Comps</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Checked</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="table-row group">
                    {/* Vendor */}
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                          {lead.vendorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                      </div>
                    </td>

                    {/* Property */}
                    <td className="table-cell">
                      <div className="space-y-0.5">
                        <p className="text-sm text-gray-700 line-clamp-1">
                          {lead.propertyAddress
                            ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                            : <span className="text-gray-400">—</span>}
                        </p>
                        {(lead.propertyType || lead.bedrooms) && (
                          <p className="text-xs text-gray-400">
                            {[lead.propertyType, lead.bedrooms ? `${lead.bedrooms} bed` : null]
                              .filter(Boolean).join(" · ")}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Asking Price */}
                    <td className="table-cell">
                      <span className="text-sm font-medium text-gray-900">
                        {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <ConfidenceBadge confidence={lead.comparablesConfidence} />
                    </td>

                    {/* Avg Price */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-700">
                        {lead.avgComparablePrice ? formatCurrency(lead.avgComparablePrice) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* # Comps */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-700">
                        {lead.comparablesCount != null ? lead.comparablesCount : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Last Checked */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-500">
                        {lead.comparablesFetchedAt
                          ? formatDistanceToNow(new Date(lead.comparablesFetchedAt), { addSuffix: true })
                          : <span className="text-gray-400">Never</span>}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPopupLead(lead)}
                          className="gap-1.5"
                        >
                          <BarChart3 className="h-3.5 w-3.5" />
                          Comparable
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecheck(lead)}
                          disabled={recheckingId === lead.id || !lead.propertyPostcode}
                          title={!lead.propertyPostcode ? "No postcode — cannot fetch comparables" : "Fetch fresh comparables"}
                          className="gap-1.5"
                        >
                          <RefreshCw className={cn("h-3.5 w-3.5", recheckingId === lead.id && "animate-spin")} />
                          Recheck
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Comparable popup */}
      <Dialog open={!!popupLead} onOpenChange={(open) => { if (!open) setPopupLead(null) }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Comparables — {popupLead?.propertyAddress ?? popupLead?.vendorName}
            </DialogTitle>
          </DialogHeader>
          {popupLead && (
            <VendorComparablesTab
              vendorLeadId={popupLead.id}
              askingPrice={popupLead.askingPrice ?? undefined}
              propertyPostcode={popupLead.propertyPostcode ?? undefined}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
