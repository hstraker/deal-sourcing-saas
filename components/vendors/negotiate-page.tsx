"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Brain, RefreshCw, Loader2, ChevronRight, AlertTriangle } from "lucide-react"
import { SparklesIcon } from "@heroicons/react/24/outline"
import { cn } from "@/lib/utils"
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

function toNum(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

const REASON_LABELS: Record<string, string> = {
  financial_difficulty:  "💸 Financial difficulty",
  relocation:            "✈️ Relocating",
  divorce:               "⚖️ Divorce / separation",
  probate:               "📋 Probate",
  downsizing:            "📦 Downsizing",
  upsizing:              "🏠 Upsizing",
  investment_exit:       "💼 Investment exit",
  rental_issues:         "🔑 Rental issues",
  health:                "🏥 Health reasons",
  emigrating:            "🌍 Emigrating",
  chain_break:           "🔗 Chain break",
  other:                 "📌 Other",
}

const STAGE_LABELS: Record<string, string> = {
  AI_CONVERSATION: "In Conversation",
  OFFER_MADE:      "Offer Made",
  OFFER_REJECTED:  "Offer Rejected",
  RETRY_1:         "Retry 1",
  RETRY_2:         "Retry 2",
  RETRY_3:         "Retry 3",
}

const STAGE_COLOUR: Record<string, string> = {
  AI_CONVERSATION: "bg-blue-100 text-blue-700",
  OFFER_MADE:      "bg-amber-100 text-amber-700",
  OFFER_REJECTED:  "bg-red-100 text-red-700",
  RETRY_1:         "bg-purple-100 text-purple-700",
  RETRY_2:         "bg-purple-100 text-purple-700",
  RETRY_3:         "bg-purple-100 text-purple-700",
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
  const [stageFilter, setStageFilter] = useState("all")

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const results = await Promise.all(
        NEGOTIATION_STAGES.map(stage =>
          fetch(`/api/vendor-pipeline/leads?stage=${stage}&limit=100`)
            .then(r => (r.ok ? r.json() : { leads: [] }))
            .then(d => d.leads ?? [])
        )
      )
      const all: VendorLead[] = results.flat()
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

  const displayed = stageFilter === "all" ? leads : leads.filter(l => l.pipelineStage === stageFilter)
  const countByStage = NEGOTIATION_STAGES.reduce<Record<string, number>>((acc, s) => {
    acc[s] = leads.filter(l => l.pipelineStage === s).length
    return acc
  }, {})

  return (
    <>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
              <Brain className="h-5 w-5 text-purple-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Negotiation Coach</h1>
          </div>
          <p className="text-sm text-gray-500 ml-12">
            All active deals in negotiation. Click a lead to open the AI Coach — full playbook,
            round scripts, objection handlers, and live copilot.
          </p>
        </div>
        <button onClick={loadLeads} disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Stage filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setStageFilter("all")}
          className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
            stageFilter === "all" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
          All ({leads.length})
        </button>
        {NEGOTIATION_STAGES.filter(s => countByStage[s] > 0).map(s => (
          <button key={s} onClick={() => setStageFilter(s)}
            className={cn("rounded-full px-3 py-1 text-xs font-medium transition-colors",
              stageFilter === s ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
            {STAGE_LABELS[s]} ({countByStage[s]})
          </button>
        ))}
      </div>

      {/* How it works */}
      <div className="mb-5 rounded-xl border border-purple-100 bg-purple-50 px-4 py-3">
        <div className="flex items-start gap-3">
          <Brain className="h-4 w-4 shrink-0 text-purple-500 mt-0.5" />
          <p className="text-xs text-purple-700 leading-relaxed">
            <strong className="font-semibold text-purple-900">How it works:</strong> Click any lead below → the Offer Engine runs automatically
            → your full AI negotiation strategy loads (Voss · Klaff · Dawson frameworks). You get a
            deal-specific playbook, word-for-word scripts per round, objection handlers, and a live
            copilot that analyses vendor replies in real time.
          </p>
        </div>
      </div>

      {/* Content */}
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
              Leads appear here when they reach In Conversation, Offer Made, or Retry stages.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && displayed.length > 0 && (
        <div className="space-y-2">
          {displayed.map(lead => <LeadCard key={lead.id} lead={lead} />)}
        </div>
      )}
    </>
  )
}

// ─── lead card ────────────────────────────────────────────────────────────────

function LeadCard({ lead }: { lead: VendorLead }) {
  const stageLabel  = STAGE_LABELS[lead.pipelineStage] ?? lead.pipelineStage.replace(/_/g, " ")
  const stageColour = STAGE_COLOUR[lead.pipelineStage] ?? "bg-gray-100 text-gray-600"
  const motivation  = lead.motivationScore != null ? Number(lead.motivationScore) : null
  const hasOffer    = lead.offerAmount != null && Number(lead.offerAmount) > 0
  const coach       = lead.negotiationCoach ?? null

  // Discount % from asking price
  const askingNum = toNum(lead.askingPrice)
  const offerNum  = toNum(lead.offerAmount)
  const discountPct = askingNum && offerNum && askingNum > 0
    ? Math.round(((askingNum - offerNum) / askingNum) * 100)
    : null

  // Coach intel: motivation label/emoji + strategy name
  const coachMotivationLabel = coach?.vendorProfile?.motivationLabel
  const coachMotivationEmoji = coach?.vendorProfile?.motivationEmoji
  const UNKNOWN_PATTERNS = [/unknown/i, /diagnostic/i, /unclear/i, /insufficient/i]
  const isUnknownMotivation = !coachMotivationLabel || UNKNOWN_PATTERNS.some(r => r.test(coachMotivationLabel))

  // Fallback intel: reason for selling
  const reasonLabel = lead.reasonForSelling ? REASON_LABELS[lead.reasonForSelling] : null

  return (
    <Link
      href={`/dashboard/negotiate/${lead.id}`}
      className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm hover:border-purple-300 hover:shadow-md transition-all group"
    >
      {/* Left orb: motivation score */}
      <div className={cn(
        "flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-full text-sm font-bold",
        motivation != null && motivation >= 8 ? "bg-green-100 text-green-700"
        : motivation != null && motivation >= 5 ? "bg-amber-100 text-amber-700"
        : "bg-gray-100 text-gray-500"
      )}>
        {motivation ?? "—"}
      </div>

      {/* Lead identity */}
      <div className="min-w-0 w-44 shrink-0">
        <div className="flex items-center gap-2 mb-0.5">
          <p className="text-sm font-semibold text-gray-900 truncate">{lead.vendorName}</p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0", stageColour)}>
            {stageLabel}
          </span>
          {lead.competingOffers && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-medium text-orange-700 shrink-0">
              ⚠ Competing
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 truncate mt-0.5">
          {lead.propertyAddress ?? lead.propertyPostcode ?? "Address not set"}
        </p>
      </div>

      {/* Middle: coach intel or reason for selling */}
      <div className="hidden lg:flex flex-1 min-w-0 flex-col justify-center px-2 border-l border-gray-100 ml-1">
        {coach ? (
          <>
            <div className="flex items-center gap-1.5 mb-0.5">
              <SparklesIcon className="h-3 w-3 text-purple-400 shrink-0" />
              <span className="text-[11px] font-medium text-gray-700 truncate">
                {isUnknownMotivation
                  ? <span className="text-gray-400 italic">Motivation unclear</span>
                  : <>{coachMotivationEmoji} {coachMotivationLabel}</>}
              </span>
            </div>
            {coach.strategyName && (
              <p className="text-[10px] text-gray-400 truncate">{coach.strategyName}</p>
            )}
          </>
        ) : reasonLabel ? (
          <>
            <p className="text-[11px] font-medium text-gray-700 truncate">{reasonLabel}</p>
            <p className="text-[10px] text-gray-400">Reason for selling</p>
          </>
        ) : (
          <p className="text-[10px] text-gray-400 italic">No coach strategy yet</p>
        )}
      </div>

      {/* Right stats */}
      <div className="hidden sm:flex items-center gap-5 text-xs shrink-0">
        {/* Asking */}
        <div className="text-right">
          <p className="text-[10px] text-gray-400 mb-0.5">Asking</p>
          <p className="font-semibold text-gray-700">{gbp(lead.askingPrice)}</p>
        </div>

        {/* Our offer + discount */}
        {hasOffer && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">Our Offer</p>
            <p className="font-semibold text-purple-700">{gbp(lead.offerAmount)}</p>
            {discountPct != null && (
              <p className="text-[9px] text-red-400 font-medium">-{discountPct}% asking</p>
            )}
          </div>
        )}

        {/* BMV score */}
        {lead.bmvScore != null && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">BMV</p>
            <p className={cn("font-semibold",
              Number(lead.bmvScore) >= 20 ? "text-green-600"
              : Number(lead.bmvScore) >= 10 ? "text-amber-500"
              : "text-gray-500")}>
              {Number(lead.bmvScore).toFixed(0)}%
            </p>
          </div>
        )}

        {/* Urgency */}
        <div className="text-right">
          <p className="text-[10px] text-gray-400 mb-0.5">Urgency</p>
          <p className={cn("font-semibold capitalize",
            lead.urgencyLevel === "high" ? "text-red-500"
            : lead.urgencyLevel === "medium" ? "text-amber-500"
            : "text-gray-400")}>
            {lead.urgencyLevel ?? "—"}
          </p>
        </div>

        {/* Property */}
        {lead.bedrooms != null && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400 mb-0.5">Property</p>
            <p className="font-semibold text-gray-700 capitalize">
              {lead.bedrooms}bd {lead.propertyType ?? ""}
            </p>
          </div>
        )}
      </div>

      {/* Coach score badge — shown when coach has run */}
      {coach?.negotiationScore != null && (
        <div className={cn(
          "hidden xl:flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold border-2",
          coach.negotiationScore >= 70 ? "border-green-300 bg-green-50 text-green-700"
          : coach.negotiationScore >= 45 ? "border-amber-300 bg-amber-50 text-amber-700"
          : "border-red-300 bg-red-50 text-red-700"
        )}>
          {coach.negotiationScore}
        </div>
      )}

      {/* Arrow */}
      <ChevronRight className="h-4 w-4 text-gray-400 shrink-0 group-hover:text-purple-500 transition-colors" />
    </Link>
  )
}
