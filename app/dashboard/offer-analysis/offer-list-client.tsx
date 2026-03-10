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
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import { Search, BarChart3, CheckCircle2, XCircle } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  vendorName: string
  vendorEmail: string | null
  vendorPhone: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  estimatedMonthlyRent: number | null
  estimatedRefurbCost: number | null
  bmvScore: number | null
  offerAmount: number | null
  offerPercentage: number | null
  offerSentAt: string | null
  offerAcceptedAt: string | null
  offerRejectedAt: string | null
  dealId: string | null
  validationNotes: string | null
  pipelineStage: string
}

// ── Offer status badge ────────────────────────────────────────────────────────

function OfferStatusBadge({ lead }: { lead: Lead }) {
  if (lead.offerAcceptedAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200">
        Accepted
      </span>
    )
  }
  if (lead.offerRejectedAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border-red-200">
        Rejected
      </span>
    )
  }
  if (lead.offerSentAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 border-amber-200">
        Awaiting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
      No Offer
    </span>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const STATUS_CHIPS = ["All", "No Offer", "Sent", "Accepted", "Rejected"] as const
type StatusChip = typeof STATUS_CHIPS[number]

// ── Missing inputs hint ───────────────────────────────────────────────────────

function getMissingInputsHint(lead: Lead): string | undefined {
  if (!lead.estimatedMarketValue || !lead.estimatedRefurbCost) {
    return "Complete validation first to get market value and refurb cost."
  }
  return undefined
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfferListClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusChip>("All")
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [popupLead, setPopupLead] = useState<Lead | null>(null)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      if (q) {
        const match =
          l.vendorName.toLowerCase().includes(q) ||
          (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
          (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      switch (statusFilter) {
        case "No Offer":  return !l.offerSentAt && !l.offerAcceptedAt && !l.offerRejectedAt
        case "Sent":      return !!l.offerSentAt && !l.offerAcceptedAt && !l.offerRejectedAt
        case "Accepted":  return !!l.offerAcceptedAt
        case "Rejected":  return !!l.offerRejectedAt
        default:          return true
      }
    })
  }, [leads, search, statusFilter])

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const handleDecision = async (lead: Lead, decision: "accept" | "reject") => {
    setDecidingId(lead.id)
    const field = decision === "accept" ? "offerAcceptedAt" : "offerRejectedAt"
    const value = new Date().toISOString()
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("Failed to update offer status")
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, [field]: value } : l))
      )
      toast.success(decision === "accept" ? "Offer accepted" : "Offer rejected")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDecidingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Offer Analysis</h1>
        <p className="text-sm text-gray-400 mt-1">
          Analyse and manage property offers across all vendor leads
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
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asking Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">BMV</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer Sent</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const awaitingDecision =
                    !!lead.offerSentAt && !lead.offerAcceptedAt && !lead.offerRejectedAt
                  return (
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
                        <p className="text-sm text-gray-700 line-clamp-1">
                          {lead.propertyAddress
                            ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                            : <span className="text-gray-400">—</span>}
                        </p>
                      </td>

                      {/* Asking Price */}
                      <td className="table-cell">
                        <span className="text-sm font-medium text-gray-900">
                          {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Offer Amount */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-700">
                          {lead.offerAmount ? formatCurrency(lead.offerAmount) : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* BMV */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-700">
                          {lead.bmvScore != null ? `${lead.bmvScore}%` : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <OfferStatusBadge lead={lead} />
                      </td>

                      {/* Offer Sent */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-500">
                          {lead.offerSentAt
                            ? formatDistanceToNow(new Date(lead.offerSentAt), { addSuffix: true })
                            : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPopupLead(lead)}
                            disabled={decidingId === lead.id}
                            className="gap-1.5"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Offer Analysis
                          </Button>

                          {awaitingDecision && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecision(lead, "accept")}
                                disabled={decidingId === lead.id}
                                className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecision(lead, "reject")}
                                disabled={decidingId === lead.id}
                                className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
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

      {/* Offer Analysis popup */}
      <Dialog open={!!popupLead} onOpenChange={(open) => { if (!open) setPopupLead(null) }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Offer Analysis — {popupLead?.propertyAddress ?? popupLead?.vendorName}
            </DialogTitle>
          </DialogHeader>
          {popupLead && (
            <OfferAnalysisPanel
              vendorLeadId={popupLead.id}
              dealId={popupLead.dealId ?? undefined}
              askingPrice={popupLead.askingPrice ?? 0}
              gdv={popupLead.estimatedMarketValue ?? 0}
              estimatedRent={popupLead.estimatedMonthlyRent ?? undefined}
              totalRefurbishment={popupLead.estimatedRefurbCost ?? undefined}
              missingInputsHint={getMissingInputsHint(popupLead)}
              vendorName={popupLead.vendorName}
              vendorEmail={popupLead.vendorEmail ?? undefined}
              vendorPhone={popupLead.vendorPhone ?? undefined}
              onOfferSent={(offerPrice, _strategy, _round) => {
                setLeads((prev) =>
                  prev.map((l) =>
                    l.id === popupLead.id
                      ? { ...l, offerSentAt: new Date().toISOString(), offerAmount: offerPrice }
                      : l
                  )
                )
              }}
              onReject={() => {
                setLeads((prev) =>
                  prev.map((l) =>
                    l.id === popupLead.id
                      ? { ...l, offerRejectedAt: new Date().toISOString() }
                      : l
                  )
                )
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
