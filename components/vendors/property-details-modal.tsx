"use client"

import React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import type { VendorLead } from "./vendor-leads-table"

// ── Helpers (local — no external dependency) ──────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusRow({
  colour,
  label,
}: {
  colour: "green" | "amber" | "red" | "grey"
  label: string
}) {
  const dotClass =
    colour === "green"
      ? "bg-green-400"
      : colour === "amber"
      ? "bg-amber-400"
      : colour === "red"
      ? "bg-red-400"
      : "bg-slate-600"
  const icon =
    colour === "green" ? "✓" : colour === "amber" ? "!" : colour === "red" ? "✕" : "–"
  const iconText =
    colour === "green"
      ? "text-green-900"
      : colour === "amber"
      ? "text-amber-900"
      : colour === "red"
      ? "text-white"
      : "text-slate-500"
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          dotClass,
          iconText
        )}
      >
        {icon}
      </span>
      <span className={colour === "grey" ? "text-slate-500" : "text-slate-200"}>{label}</span>
    </div>
  )
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700",
        className
      )}
    >
      {children}
    </span>
  )
}

function MetricCell({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={cn("text-sm font-bold", className)}>{value}</p>
    </div>
  )
}

function StrategyCard({
  fit,
  name,
  reason,
}: {
  fit: boolean
  name: string
  reason: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        fit ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
      )}
    >
      <p className={cn("text-[11px] font-bold", fit ? "text-green-700" : "text-gray-500")}>
        {fit ? "✓" : "—"} {name}
      </p>
      <p className={cn("mt-0.5 text-[10px]", fit ? "text-green-600" : "text-gray-400")}>
        {reason}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertyDetailsModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const asking = toNum(lead.askingPrice)
  const marketVal = toNum(lead.estimatedMarketValue)
  const refurb = toNum(lead.estimatedRefurbCost)
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)
  const monthlyRent = toNum(lead.estimatedMonthlyRent)
  const annualRent = toNum(lead.estimatedAnnualRent)
  const motivation = toNum(lead.motivationScore)

  /** Rough net-yield factor: assumes ~20% of gross rent goes to expenses (mgmt, voids, maintenance) */
  const NET_YIELD_FACTOR = 0.8

  const grossYield =
    asking && asking > 0 && annualRent ? (annualRent / asking) * 100 : null
  const netYield = grossYield !== null ? grossYield * NET_YIELD_FACTOR : null

  // Strategy fit
  const btlFit = monthlyRent !== null && grossYield !== null && grossYield >= 5
  const flipFit = bmv !== null && bmv >= 10 && profit !== null && profit > 0
  const brrFit = refurb !== null && bmv !== null && bmv >= 10

  // Condition colour on dark background
  const conditionChipClass =
    lead.condition === "excellent" || lead.condition === "good"
      ? "bg-green-500 text-white"
      : lead.condition === "needs_work" || lead.condition === "needs_modernisation"
      ? "bg-amber-400 text-amber-900"
      : lead.condition === "poor"
      ? "bg-red-500 text-white"
      : "bg-white/10 text-slate-200"

  // Portal check indicator
  const portalColour =
    lead.latestCheckRisk === "clear"
      ? "green"
      : lead.latestCheckRisk === "caution"
      ? "amber"
      : lead.latestCheckRisk === "red_flag"
      ? "red"
      : "grey"
  const portalLabel =
    lead.latestCheckRisk === "clear"
      ? "Portal check clear"
      : lead.latestCheckRisk === "caution"
      ? "Portal caution"
      : lead.latestCheckRisk === "red_flag"
      ? "Portal red flag"
      : "Portal check not run"

  const hasSellerIntel =
    !!lead.urgencyLevel ||
    lead.timelineDays != null ||
    !!lead.reasonForSelling ||
    motivation !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════════════════════════════════════════
            LEFT PANEL — dark, financial summary
        ═══════════════════════════════════════════════ */}
        <div className="flex w-[260px] shrink-0 flex-col gap-5 overflow-y-auto bg-[#1e293b] p-5 text-white">
          {/* Address */}
          <div>
            <p className="text-sm font-bold leading-snug text-slate-100">
              {lead.propertyAddress ?? "No address"}
            </p>
            {lead.propertyPostcode && (
              <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode}</p>
            )}
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
              {lead.condition && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                    conditionChipClass
                  )}
                >
                  {lead.condition.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Financials */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Financials
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Asking Price</span>
              <span className="font-bold text-slate-100">{fmtCurrency(asking)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Market Value</span>
              <span className="font-bold text-slate-100">{fmtCurrency(marketVal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Refurb Est.</span>
              <span className="font-semibold text-slate-100">{fmtCurrency(refurb)}</span>
            </div>
            {(bmv !== null || profit !== null) && (
              <div className="mt-1 space-y-1.5 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-green-300">BMV Discount</span>
                  <span className="text-xl font-extrabold text-green-400">
                    {bmv !== null ? `${bmv.toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-green-300">Profit Potential</span>
                  <span className="font-bold text-green-400">{fmtCurrency(profit)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10" />

          {/* Status indicators */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Status
            </p>
            <StatusRow colour={portalColour} label={portalLabel} />
            <StatusRow
              colour={
                lead.validationPassed === true
                  ? "green"
                  : lead.validationPassed === false
                  ? "red"
                  : "grey"
              }
              label={
                lead.validationPassed === true
                  ? "Validation passed"
                  : lead.validationPassed === false
                  ? "Validation failed"
                  : "Not validated"
              }
            />
            <StatusRow
              colour={lead.urgencyLevel === "urgent" ? "amber" : "grey"}
              label={
                lead.urgencyLevel === "urgent" && lead.timelineDays
                  ? `Urgent — ${lead.timelineDays} days`
                  : lead.urgencyLevel === "urgent"
                  ? "Urgent"
                  : "No urgency flag"
              }
            />
            <StatusRow
              colour={lead.competingOffers ? "red" : "grey"}
              label={lead.competingOffers ? "Competing offers" : "No competing offers"}
            />
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

        {/* ═══════════════════════════════════════════════
            RIGHT PANEL — light, property details
        ═══════════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Close button */}
          <div className="-mr-1 -mt-1 flex justify-end">
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Property Specs */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Property Specs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.bedrooms != null && (
                <Chip>
                  🛏 {lead.bedrooms} Bedroom{lead.bedrooms !== 1 ? "s" : ""}
                </Chip>
              )}
              {lead.bathrooms != null && (
                <Chip>
                  🚿 {lead.bathrooms} Bathroom{lead.bathrooms !== 1 ? "s" : ""}
                </Chip>
              )}
              {lead.squareFeet && (
                <Chip>📐 {lead.squareFeet.toLocaleString()} sq ft</Chip>
              )}
              {lead.propertyType && (
                <Chip className="capitalize">🏠 {lead.propertyType}</Chip>
              )}
              {lead.epcRating && (
                <Chip>
                  ⚡ EPC: {lead.epcRating}
                  {lead.epcScore ? ` (${lead.epcScore})` : ""}
                </Chip>
              )}
              {lead.tenureType && (
                <Chip className="capitalize">🔑 {lead.tenureType}</Chip>
              )}
            </div>
          </div>

          {/* Rental Income */}
          {monthlyRent !== null && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-700">
                Rental Income
              </p>
              <div className="grid grid-cols-2 gap-3">
                <MetricCell
                  label="Monthly Rent"
                  value={fmtCurrency(monthlyRent)}
                  className="text-gray-900"
                />
                <MetricCell
                  label="Annual Rent"
                  value={fmtCurrency(annualRent)}
                  className="text-gray-900"
                />
                <MetricCell
                  label="Gross Yield"
                  value={grossYield !== null ? `${grossYield.toFixed(1)}%` : "—"}
                  className="text-green-700"
                />
                <MetricCell
                  label="Net Yield ~"
                  value={netYield !== null ? `${netYield.toFixed(1)}%` : "—"}
                  className="text-green-700"
                />
              </div>
            </div>
          )}

          {/* Strategy Fit */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Strategy Fit
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StrategyCard
                fit={btlFit}
                name="BTL"
                reason={
                  btlFit && grossYield !== null
                    ? `${grossYield.toFixed(1)}% yield · good cashflow`
                    : "Insufficient yield data"
                }
              />
              <StrategyCard
                fit={flipFit}
                name="Flip"
                reason={
                  flipFit && bmv !== null
                    ? `${bmv.toFixed(1)}% BMV · ${fmtCurrency(profit)} profit`
                    : "Insufficient BMV/profit data"
                }
              />
              <StrategyCard
                fit={brrFit}
                name="BRR"
                reason={brrFit ? "Refurb + refi potential" : "Insufficient refurb/BMV data"}
              />
              <StrategyCard fit={false} name="SA" reason="Not assessed" />
            </div>
          </div>

          {/* Seller Intelligence */}
          {hasSellerIntel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                Seller Intelligence
              </p>
              <div className="grid grid-cols-2 gap-3">
                {lead.urgencyLevel && (
                  <MetricCell
                    label="Urgency"
                    value={lead.urgencyLevel.toUpperCase()}
                    className={
                      lead.urgencyLevel === "urgent" ? "text-red-600" : "text-gray-700"
                    }
                  />
                )}
                {lead.timelineDays != null && (
                  <MetricCell
                    label="Timeline"
                    value={`${lead.timelineDays} days`}
                    className="text-gray-900"
                  />
                )}
                {lead.reasonForSelling && (
                  <MetricCell
                    label="Reason"
                    value={lead.reasonForSelling}
                    className="text-gray-700"
                  />
                )}
                {motivation !== null && (
                  <MetricCell
                    label="Motivation"
                    value={`${motivation} / 10${motivation >= 8 ? " 🔥" : ""}`}
                    className="text-gray-900"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
