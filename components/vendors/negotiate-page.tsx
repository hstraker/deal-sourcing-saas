"use client"

import { useState, useEffect, useCallback } from "react"
import { Brain, TrendingUp, AlertTriangle, RefreshCw, Loader2, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { OfferAnalysisModal } from "./offer-analysis-modal"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

function gbp(n: number | string | null | undefined): string {
  const num = n == null ? null : typeof n === "number" ? n : parseFloat(String(n))
  if (!num || isNaN(num)) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(num)
}

const STAGE_LABELS: Record<string, string> = {
  AI_CONVERSATION:  "In Conversation",
  OFFER_MADE:       "Offer Made",
  OFFER_REJECTED:   "Offer Rejected",
  RETRY_1:          "Retry 1",
  RETRY_2:          "Retry 2",
  RETRY_3:          "Retry 3",
}

const STAGE_COLOUR: Record<string, string> = {
  AI_CONVERSATION:  "bg-blue-100 text-blue-700",
  OFFER_MADE:       "bg-amber-100 text-amber-700",
  OFFER_REJECTED:   "bg-red-100 text-red-700",
  RETRY_1:          "bg-purple-100 text-purple-700",
  RETRY_2:          "bg-purple-100 text-purple-700",
  RETRY_3:          "bg-purple-100 text-purple-700",
}

const NEGOTIATION_STAGES = [
  "AI_CONVERSATION",
  "OFFER_MADE",
  "OFFER_REJECTED",
  "RETRY_1",
  "RETRY_2",
  "RETRY_3",
]

// ─── component ───────────────────────────────────────────────────────────────

export function NegotiatePage() {
  const [leads, setLeads] = useState<VendorLead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<VendorLead | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Fetch leads across all negotiation stages
      const results = await Promise.all(
        NEGOTIATION_STAGES.map((stage) =>
          fetch(`/api/vendor-pipeline/leads?stage=${stage}&limit=100`)
            .then((r) => (r.ok ? r.json() : { leads: [] }))
            .then((d) => d.leads ?? [])
        )
      )
      const all: VendorLead[] = results.flat()
      // Sort: highest motivation first, then by most recent
      all.sort((a, b) => {
        const mA = a.motivationScore ?? 0
        const mB = b.motivationScore ?? 0
        if (mB !== mA) return mB - mA
        return new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      })
      setLeads(all)
    } catch {
      setError("Failed to load leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadLeads() }, [loadLeads])

  const handleModalClose = () => {
    setSelectedLead(null)
    loadLeads() // refresh in case offer was updated
  }

  // ── Stage filter pills ─────────────────────────────────────────────────────
  const [stageFilter, setStageFilter] = useState<string>("all")

  const displayed = stageFilter === "all"
    ? leads
    : leads.filter((l) => l.pipelineStage === stageFilter)

  const countByStage = NEGOTIATION_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter((l) => l.pipelineStage === s).length
    return acc
  }, {})

  return (
    <>
      {selectedLead && (
        <OfferAnalysisModal lead={selectedLead} onClose={handleModalClose} />
      )}

      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Negotiation Coach</h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            All active deals in negotiation. Open a lead to run the offer engine, then launch the AI
            Coach for scripts, objection handlers, and live copilot.
          </p>
        </div>
        <button
          onClick={loadLeads}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* ── Stage filter pills ── */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          onClick={() => setStageFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            stageFilter === "all"
              ? "bg-gray-900 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          )}
        >
          All stages ({leads.length})
        </button>
        {NEGOTIATION_STAGES.map((s) => (
          countByStage[s] > 0 && (
            <button
              key={s}
              onClick={() => setStageFilter(s)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                stageFilter === s
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {STAGE_LABELS[s]} ({countByStage[s]})
            </button>
          )
        ))}
      </div>

      {/* ── How it works banner ── */}
      <div className="mb-5 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-purple-800">How to use the Negotiation Coach</p>
            <p className="mt-0.5 text-xs text-purple-600 leading-relaxed">
              Click <strong>Analyse &amp; Coach</strong> on any lead → the Offer Engine runs automatically →
              a <strong className="text-purple-700">Negotiation Coach</strong> button appears top-right →
              click it to get your full strategy: playbook, round scripts, objection handlers, and live copilot.
            </p>
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading && (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-20">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-gray-600">{error}</p>
          <button onClick={loadLeads} className="text-sm text-blue-600 hover:underline">Try again</button>
        </div>
      )}

      {!loading && !error && displayed.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-gray-200 py-24">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-50">
            <Brain className="h-7 w-7 text-purple-300" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-gray-700">No active negotiations</p>
            <p className="mt-1 text-xs text-gray-400">
              Leads move here when they reach In Conversation, Offer Made, or Retry stages.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div className="space-y-2">
          {displayed.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onOpen={() => setSelectedLead(lead)}
            />
          ))}
        </div>
      )}
    </>
  )
}

// ─── lead card ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen }: { lead: VendorLead; onOpen: () => void }) {
  const stageLabel  = STAGE_LABELS[lead.pipelineStage] ?? lead.pipelineStage.replace(/_/g, " ")
  const stageColour = STAGE_COLOUR[lead.pipelineStage] ?? "bg-gray-100 text-gray-600"

  const motivation = lead.motivationScore != null ? Number(lead.motivationScore) : null
  const motivationColour =
    motivation == null    ? "text-gray-400"
    : motivation >= 8     ? "text-green-600 font-bold"
    : motivation >= 5     ? "text-amber-600 font-semibold"
    :                       "text-gray-500"

  const urgencyColour =
    lead.urgencyLevel === "high"   ? "text-red-500"
    : lead.urgencyLevel === "medium" ? "text-amber-500"
    :                                  "text-gray-400"

  const hasOffer = lead.offerAmount != null && Number(lead.offerAmount) > 0

  return (
    <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-purple-200 hover:shadow-md transition-all">
      {/* Motivation score orb */}
      <div className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold",
        motivation != null && motivation >= 8 ? "bg-green-100 text-green-700"
        : motivation != null && motivation >= 5 ? "bg-amber-100 text-amber-700"
        :                                          "bg-gray-100 text-gray-500"
      )}>
        {motivation ?? "—"}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">
            {lead.vendorName}
          </p>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", stageColour)}>
            {stageLabel}
          </span>
          {lead.competingOffers && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 shrink-0">
              ⚠ Competing
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 truncate">
          {lead.propertyAddress ?? lead.propertyPostcode ?? "Address not set"}
        </p>
      </div>

      {/* Stats */}
      <div className="hidden sm:flex items-center gap-6 text-xs shrink-0">
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Asking</p>
          <p className="font-semibold text-gray-700">{gbp(lead.askingPrice)}</p>
        </div>
        {hasOffer && (
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">Our Offer</p>
            <p className="font-semibold text-purple-700">{gbp(lead.offerAmount)}</p>
          </div>
        )}
        <div>
          <p className="text-[10px] text-gray-400 mb-0.5">Urgency</p>
          <p className={cn("font-semibold capitalize", urgencyColour)}>
            {lead.urgencyLevel ?? "—"}
          </p>
        </div>
        {lead.bedrooms != null && (
          <div>
            <p className="text-[10px] text-gray-400 mb-0.5">Property</p>
            <p className="font-semibold text-gray-700 capitalize">
              {lead.bedrooms}bd {lead.propertyType ?? ""}
            </p>
          </div>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={onOpen}
        className="flex shrink-0 items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-purple-700 transition-colors"
      >
        <Brain className="h-3.5 w-3.5" />
        Analyse &amp; Coach
        <ChevronRight className="h-3 w-3 opacity-70" />
      </button>
    </div>
  )
}
