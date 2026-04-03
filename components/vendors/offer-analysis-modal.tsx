"use client"

import { useState, useCallback } from "react"
import { X, Phone, Mail, TrendingUp, Home, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
import type { OfferCalculationResult } from "@/lib/offer-engine/property-offer-calculator"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

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

function fmtPct(n: number, decimals = 1): string {
  return `${(n * 100).toFixed(decimals)}%`
}

// Opening offer = 88% of ceiling, rounded to nearest £50
function calcOpening(ceiling: number): number {
  return Math.round((ceiling * 0.88) / 50) * 50
}

// ─── left-panel row ───────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
  valueClass,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="shrink-0 text-slate-400">{label}</span>
      <span className={cn("text-right font-semibold text-slate-100 truncate", valueClass)}>
        {value}
      </span>
    </div>
  )
}

// ─── viability dots ───────────────────────────────────────────────────────────

function ViabilityBar({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5)
  const colour =
    score >= 70 ? "bg-green-400"
    : score >= 40 ? "bg-amber-400"
    :               "bg-red-400"
  return (
    <span className="inline-flex gap-1">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block h-2 w-2 rounded-full",
            i < filled ? colour : "bg-white/10"
          )}
        />
      ))}
    </span>
  )
}

// ─── component ───────────────────────────────────────────────────────────────

export function OfferAnalysisModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const [offerResult, setOfferResult] = useState<OfferCalculationResult | null>(null)

  // Stable callback — won't trigger useCallback re-runs in the panel
  const handleResult = useCallback((r: OfferCalculationResult) => {
    setOfferResult(r)
  }, [])

  // Raw inputs for the panel
  const askingPrice = toNum(lead.askingPrice) ?? 0
  const gdv         = toNum(lead.estimatedMarketValue)
  const estimatedRent = toNum(lead.estimatedMonthlyRent) ?? toNum(lead.localAverageRent)
  const totalRefurb = toNum(lead.estimatedRefurbCost)

  // ── Derive offer numbers from result ──────────────────────────────────────

  const rec         = offerResult?.recommendedStrategy ?? null
  const isPass      = rec === "pass"
  const isFlipPrim  = rec === "flip" || rec === "both"
  const isHoldPrim  = rec === "hold"

  // Primary strategy for display (flip preferred when "both")
  const stratData   = offerResult
    ? (isHoldPrim ? offerResult.hold : offerResult.flip)
    : null
  const ceiling     = stratData && stratData.maxPurchasePrice > 0 ? stratData.maxPurchasePrice : null
  const opening     = ceiling ? calcOpening(ceiling) : null
  const discountRaw = stratData && ceiling ? stratData.discountPercent : null  // 0–1
  const isSteep     = discountRaw !== null ? discountRaw > 0.20 : false
  const criteriaMet = stratData?.viewingCriteriaMet ?? false

  // Profit / return line
  const flipProfit   = offerResult?.flip.profit ?? null
  const flipPoc      = offerResult?.flip.profitOnCost ?? null
  const holdCf       = offerResult?.cashflow.netMonthlyCashflow ?? null
  const holdYield    = offerResult?.hold.grossYield ?? null

  // Viability
  const vScore      = offerResult?.viabilityScore ?? null
  const vLabel      =
    offerResult?.dealViability === "strong"  ? "Strong"
    : offerResult?.dealViability === "marginal" ? "Marginal"
    : offerResult?.dealViability === "pass"     ? "No Deal"
    : null
  const vColour =
    offerResult?.dealViability === "strong"  ? "text-green-400"
    : offerResult?.dealViability === "marginal" ? "text-amber-400"
    :                                            "text-red-400"

  // Strategy display label
  const stratLabel =
    rec === null     ? null
    : rec === "pass" ? "No viable strategy"
    : rec === "both" ? "Flip or BTL/BRRR"
    : rec === "flip"
    ? (criteriaMet ? "Flip ✓" : "Flip — steep discount")
    : (offerResult?.hold.moneyLeftIn != null && offerResult.hold.moneyLeftIn <= 0
      ? "BRRR ✓"
      : criteriaMet ? "BTL ✓" : "BTL — steep discount")

  const stratColour =
    rec === "pass"                    ? "text-red-400"
    : (criteriaMet && rec !== "pass") ? "text-green-400"
    :                                   "text-amber-400"

  const discountColour =
    discountRaw === null ? "text-slate-400"
    : discountRaw <= 0.20 ? "text-green-400"
    : discountRaw <= 0.35 ? "text-amber-400"
    :                       "text-red-400"

  // ── left panel ──────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col gap-0 overflow-y-auto p-5">

      {/* Property */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? lead.vendorName}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
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
          {lead.condition && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.condition.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* ── Recommended offer ── */}
      <div className="mb-4">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Recommended Offer
        </p>

        {offerResult === null ? (
          /* Not yet calculated */
          <div className="space-y-2">
            <div className="text-[10px] italic text-slate-500">Calculating…</div>
            <InfoRow label="Asking Price" value={fmtCurrency(lead.askingPrice)} />
            <InfoRow label="Market Value (GDV)" value={fmtCurrency(lead.estimatedMarketValue)} />
          </div>
        ) : isPass ? (
          /* No viable strategy */
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
              <span className="text-sm font-semibold text-red-300">No Viable Strategy</span>
            </div>
            <p className="mt-1 text-[10px] text-red-400 leading-relaxed">
              Neither Flip nor BTL/BRRR returns meet minimum thresholds at this asking price.
            </p>
          </div>
        ) : (
          <>
            {/* Strategy badge */}
            <p className={cn("mb-2 text-xs font-bold", stratColour)}>{stratLabel}</p>

            {/* Opening / ceiling two-column */}
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Open with
                </p>
                <p className="text-base font-extrabold text-blue-400 leading-tight">
                  {opening !== null ? fmtCurrency(opening) : "—"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">First offer</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1">
                  Max (ceiling)
                </p>
                <p className="text-base font-extrabold text-slate-100 leading-tight">
                  {ceiling !== null ? fmtCurrency(ceiling) : "—"}
                </p>
                <p className="text-[9px] text-slate-500 mt-0.5">Do not exceed</p>
              </div>
            </div>

            {/* Discount badge */}
            {discountRaw !== null && (
              <div className={cn(
                "flex items-center justify-between rounded-md px-2.5 py-1.5 text-xs",
                isSteep
                  ? "border border-amber-500/30 bg-amber-500/10"
                  : "border border-green-500/30 bg-green-500/10"
              )}>
                <span className={isSteep ? "text-amber-300" : "text-green-300"}>
                  {isSteep ? "⚠ Steep discount needed" : "✓ Discount achievable"}
                </span>
                <span className={cn("font-bold", discountColour)}>
                  {fmtPct(discountRaw)}
                </span>
              </div>
            )}

            {/* Return headline */}
            <div className="mt-2 space-y-1">
              {isFlipPrim && flipProfit !== null && (
                <InfoRow
                  label="Gross Profit"
                  value={fmtCurrency(flipProfit)}
                  valueClass={flipProfit > 0 ? "text-green-400" : "text-red-400"}
                />
              )}
              {isFlipPrim && flipPoc !== null && (
                <InfoRow
                  label="Profit on Cost"
                  value={fmtPct(flipPoc)}
                  valueClass={flipPoc >= 0.20 ? "text-green-400" : "text-amber-400"}
                />
              )}
              {isHoldPrim && holdCf !== null && (
                <InfoRow
                  label="Net Cashflow"
                  value={`${fmtCurrency(holdCf)}/mo`}
                  valueClass={holdCf >= 0 ? "text-green-400" : "text-red-400"}
                />
              )}
              {isHoldPrim && holdYield !== null && (
                <InfoRow label="Gross Yield" value={fmtPct(holdYield)} />
              )}
            </div>
          </>
        )}
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* ── Deal health ── */}
      {vScore !== null && (
        <>
          <div className="mb-4 space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Deal Health
            </p>
            <div className="flex items-center justify-between">
              <ViabilityBar score={vScore} />
              <div className="flex items-center gap-1.5">
                <span className={cn("text-sm font-bold", vColour)}>{vLabel}</span>
                <span className="text-[10px] text-slate-500">{vScore}/100</span>
              </div>
            </div>
            <InfoRow label="Asking Price" value={fmtCurrency(lead.askingPrice)} />
            <InfoRow label="Market Value" value={fmtCurrency(lead.estimatedMarketValue)} />
            {lead.bmvScore != null && (
              <InfoRow
                label="BMV %"
                value={`${Number(lead.bmvScore).toFixed(1)}%`}
                valueClass={
                  Number(lead.bmvScore) >= 15 ? "text-green-400"
                  : Number(lead.bmvScore) >= 10 ? "text-amber-400"
                  :                               "text-red-400"
                }
              />
            )}
          </div>
          <div className="mb-4 h-px bg-white/10" />
        </>
      )}

      {/* ── Vendor ── */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <p className="text-sm font-semibold text-slate-100">{lead.vendorName}</p>

        {lead.vendorPhone && (
          <a
            href={`tel:${lead.vendorPhone}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Phone className="h-3 w-3 shrink-0 text-blue-400" />
            {lead.vendorPhone}
          </a>
        )}

        {lead.vendorEmail && (
          <a
            href={`mailto:${lead.vendorEmail}`}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-white/10 hover:text-white truncate"
          >
            <Mail className="h-3 w-3 shrink-0 text-blue-400" />
            <span className="truncate">{lead.vendorEmail}</span>
          </a>
        )}

        {lead.motivationScore !== null && (
          <InfoRow
            label="Motivation"
            value={`${lead.motivationScore}/10`}
            valueClass={
              lead.motivationScore >= 8 ? "text-green-400"
              : lead.motivationScore >= 5 ? "text-amber-400"
              :                             "text-slate-300"
            }
          />
        )}

        {lead.urgencyLevel && (
          <InfoRow
            label="Urgency"
            value={lead.urgencyLevel.charAt(0).toUpperCase() + lead.urgencyLevel.slice(1)}
            valueClass={
              lead.urgencyLevel === "high" ? "text-red-400"
              : lead.urgencyLevel === "medium" ? "text-amber-400"
              :                                   "text-slate-300"
            }
          />
        )}

        {lead.competingOffers && (
          <InfoRow label="Competing Offers" value="Yes ⚠" valueClass="text-amber-400" />
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

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="5xl">
      {/* Close button */}
      <div className="-mr-1 -mt-1 flex justify-end p-4 pb-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-2">
        <OfferAnalysisPanel
          vendorLeadId={lead.id}
          dealId={lead.dealId}
          askingPrice={askingPrice}
          gdv={gdv}
          estimatedRent={estimatedRent}
          totalRefurbishment={totalRefurb}
          vendorName={lead.vendorName}
          vendorEmail={lead.vendorEmail}
          vendorPhone={lead.vendorPhone}
          missingInputsHint={!gdv ? "Run BMV calculation first to populate Market Value." : undefined}
          onResult={handleResult}
        />
      </div>
    </ModalShell>
  )
}
