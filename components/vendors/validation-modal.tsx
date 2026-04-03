"use client"

import { useState } from "react"
import { X, TrendingUp, Loader2, Calculator, CheckCircle, XCircle, Home } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ──────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

/** Opening offer — 88% of the ceiling, rounded to nearest £50 */
function calcOpening(ceiling: number): number {
  return Math.round((ceiling * 0.88) / 50) * 50
}

/** Pull strategy from AI-generated notes text */
function parseStrategy(notes: string | null): string | null {
  if (!notes) return null
  const m = notes.match(/Strategy:\s*([A-Z\/]+)/i)
  return m ? m[1].toUpperCase() : null
}

// ─── validation notes renderer ────────────────────────────────────────────────

function ValidationNotesRenderer({ notes }: { notes: string }) {
  const lines = notes.split("\n")

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        const trimmed = line.trim()

        // Skip blank lines — add spacing via space-y instead
        if (!trimmed) return <div key={i} className="h-2" />

        // Separator lines (===)
        if (/^={3,}/.test(trimmed) || /^-{3,}/.test(trimmed)) {
          return <hr key={i} className="border-gray-200 my-2" />
        }

        // Section headers — lines with an emoji or ALL CAPS header-like text
        if (/^[✅❌📊🏠💡⚠️🔑]/.test(trimmed)) {
          return (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 mt-3">
              <span className="text-base leading-snug">{trimmed.slice(0, 2)}</span>
              <p className="text-xs font-bold text-gray-800 uppercase tracking-wide leading-5">
                {trimmed.slice(2).trim()}
              </p>
            </div>
          )
        }

        // Numbered steps — "1. Something"
        const numMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
        if (numMatch) {
          return (
            <div key={i} className="flex items-start gap-3 py-1">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[10px] font-bold text-blue-700">
                {numMatch[1]}
              </span>
              <p className="text-sm text-gray-700 leading-snug">{numMatch[2]}</p>
            </div>
          )
        }

        // Indented rationale lines
        if (/^\s{4,}/.test(line) || trimmed.toLowerCase().startsWith("rationale:")) {
          return (
            <p key={i} className="ml-8 text-xs text-gray-500 italic leading-snug">
              {trimmed}
            </p>
          )
        }

        // Key-value lines — "Strategy: BTL", "Market Value: £xxx"
        const kvMatch = trimmed.match(/^([A-Za-z\s]+):\s+(.+)/)
        if (kvMatch && !trimmed.includes("—") && trimmed.length < 80) {
          return (
            <div key={i} className="flex items-baseline justify-between gap-2 text-xs py-0.5">
              <span className="text-gray-500 shrink-0">{kvMatch[1]}</span>
              <span className="font-semibold text-gray-800 text-right">{kvMatch[2]}</span>
            </div>
          )
        }

        // Default — regular paragraph text
        return (
          <p key={i} className="text-sm text-gray-700 leading-relaxed">
            {trimmed}
          </p>
        )
      })}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export function ValidationModal({
  lead,
  onClose,
  onCheck,
}: {
  lead: VendorLead
  onClose: () => void
  onCheck?: () => Promise<void>
}) {
  const [checking, setChecking] = useState(false)

  const bmv      = toNum(lead.bmvScore)
  const profit   = toNum(lead.profitPotential)
  const offer    = toNum(lead.offerAmount)
  const refurb   = toNum(lead.estimatedRefurbCost)
  const opening  = offer ? calcOpening(offer) : null
  const strategy = parseStrategy(lead.validationNotes)
  const passed   = lead.validationPassed

  // ── Left panel ───────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col overflow-y-auto p-5 gap-0">

      {/* Property */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? lead.vendorName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {lead.propertyPostcode ?? ""}
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.tenureType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.tenureType}
            </span>
          )}
        </div>
      </div>

      {/* Verdict */}
      <div className="mb-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
          Validation Result
        </p>
        {passed === true && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-center">
            <CheckCircle className="h-7 w-7 text-green-400 mx-auto mb-1.5" />
            <p className="text-xl font-extrabold text-green-400 leading-none">PASSED</p>
            <p className="mt-1 text-[10px] text-green-300">Deal meets investment criteria</p>
          </div>
        )}
        {passed === false && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center">
            <XCircle className="h-7 w-7 text-red-400 mx-auto mb-1.5" />
            <p className="text-xl font-extrabold text-red-400 leading-none">FAILED</p>
            <p className="mt-1 text-[10px] text-red-300">Does not meet criteria</p>
          </div>
        )}
        {passed === null && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
            <Calculator className="h-7 w-7 text-slate-500 mx-auto mb-1.5" />
            <p className="text-lg font-extrabold text-slate-400 leading-none">NOT RUN</p>
            <p className="mt-1 text-[10px] text-slate-500">Calculate BMV to validate</p>
          </div>
        )}
      </div>

      {/* Recommended offer — only if we have numbers */}
      {offer && (
        <>
          <div className="mb-4">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">
              Recommended Offer
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5 text-center">
                <p className="text-[9px] text-slate-500 mb-0.5">Opening</p>
                <p className="text-sm font-bold text-slate-100">{fmtCurrency(opening)}</p>
              </div>
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2.5 text-center">
                <p className="text-[9px] text-blue-400 mb-0.5">Max Ceiling</p>
                <p className="text-sm font-bold text-blue-300">{fmtCurrency(offer)}</p>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="mb-4 h-px bg-white/10" />

      {/* Deal metrics */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Deal Metrics</p>

        {strategy && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Strategy</span>
            <span className="rounded-full bg-purple-500/20 border border-purple-500/30 px-2 py-0.5 text-[10px] font-bold text-purple-300">
              {strategy}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-semibold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400">Market Value</span>
          <span className="font-semibold text-slate-100">{fmtCurrency(lead.estimatedMarketValue)}</span>
        </div>

        {bmv !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">BMV Discount</span>
            <span className={cn(
              "font-bold",
              bmv >= 20 ? "text-green-400" : bmv >= 10 ? "text-amber-400" : "text-red-400"
            )}>
              {bmv.toFixed(1)}%
              {bmv < 20 && <span className="ml-1 text-[10px] font-normal text-slate-500">(below 20% target)</span>}
            </span>
          </div>
        )}

        {profit !== null && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Profit Potential</span>
            <span className={cn("font-bold", profit > 0 ? "text-green-400" : "text-red-400")}>
              {fmtCurrency(profit)}
            </span>
          </div>
        )}

        {refurb !== null && refurb > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Refurb Cost</span>
            <span className="font-semibold text-amber-400">{fmtCurrency(refurb)}</span>
          </div>
        )}

        {lead.estimatedMonthlyRent && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">Est. Monthly Rent</span>
            <span className="font-semibold text-slate-100">{fmtCurrency(lead.estimatedMonthlyRent)}/mo</span>
          </div>
        )}
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  // ── Right panel ───────────────────────────────────────────────────────────

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="4xl">
      {/* Header + close */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3 shrink-0">
        <div>
          <p className="text-sm font-bold text-gray-900">Validation Notes</p>
          <p className="text-xs text-gray-400">
            {lead.validationNotes
              ? lead.bmvValidatedAt
                ? `Calculated ${new Date(lead.bmvValidatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                : "Validation complete"
              : "No validation run yet"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        {lead.validationNotes ? (
          <ValidationNotesRenderer notes={lead.validationNotes} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="rounded-full bg-gray-100 p-4 mb-4">
              <Home className="h-8 w-8 text-gray-300" />
            </div>
            <p className="text-sm font-semibold text-gray-600 mb-1">No Validation Run Yet</p>
            <p className="text-xs text-gray-400 mb-6">
              Calculate BMV to analyse this deal and get a full validation report
            </p>
            {onCheck && (
              <button
                onClick={async () => {
                  setChecking(true)
                  try {
                    await onCheck()
                  } finally {
                    setChecking(false)
                  }
                }}
                disabled={checking}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {checking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4" />
                )}
                {checking ? "Calculating…" : "Calculate BMV"}
              </button>
            )}
          </div>
        )}
      </div>
    </ModalShell>
  )
}
