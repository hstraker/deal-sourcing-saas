"use client"

import React from "react"
import { X, Clock, AlertTriangle, AlertCircle, Bell, Phone, Mail } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
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

// ── Parse strategy data from validation notes ─────────────────────────────────

interface ValidatedStrategy {
  key: string
  name: string
  emoji: string
  viable: boolean
  maxViable: number | null
  recommendedOffer: number | null
  yieldAtOffer: number | null
  flipProfit: number | null
  brrLeftIn: number | null
  brrProceeds: number | null
}

function extractValidationStrategies(notes: string | null): {
  recommended: string | null
  strategies: ValidatedStrategy[] | null
} {
  if (!notes) return { recommended: null, strategies: null }
  const match = notes.match(/\[STRATEGY_DATA\]([\s\S]*?)\[\/STRATEGY_DATA\]/i)
  if (!match) return { recommended: null, strategies: null }
  try {
    const json = JSON.parse(match[1].trim())
    return {
      recommended: json.recommended ?? null,
      strategies: json.strategies ?? null,
    }
  } catch {
    return { recommended: null, strategies: null }
  }
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
  isRecommended = false,
  noData = false,
}: {
  fit: boolean
  name: string
  reason: string
  isRecommended?: boolean
  noData?: boolean
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2 relative",
        fit && isRecommended
          ? "border-blue-300 bg-blue-50"
          : fit
          ? "border-green-200 bg-green-50"
          : noData
          ? "border-gray-100 bg-gray-50 opacity-50"
          : "border-red-100 bg-red-50/40 opacity-70"
      )}
    >
      {isRecommended && (
        <span className="absolute -top-1.5 -right-1 rounded-full bg-blue-500 px-1.5 py-0.5 text-[8px] font-bold text-white leading-none">
          REC
        </span>
      )}
      <p className={cn(
        "text-[11px] font-bold",
        fit && isRecommended ? "text-blue-700" : fit ? "text-green-700" : "text-gray-500"
      )}>
        {fit ? "✓" : noData ? "—" : "✗"} {name}
      </p>
      <p className={cn(
        "mt-0.5 text-[10px]",
        fit && isRecommended ? "text-blue-600" : fit ? "text-green-600" : "text-gray-400"
      )}>
        {reason}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertyDetailsModal({
  lead,
  onClose,
  alertReason,
  alertUrgency = "low",
}: {
  lead: VendorLead
  onClose: () => void
  alertReason?: string
  alertUrgency?: "high" | "medium" | "low"
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

  // ── Try to use validated strategy data if the lead has been run through BMV calc ──
  const { recommended: validatedRecommended, strategies: validatedStrategies } =
    extractValidationStrategies(lead.validationNotes)

  const vs = (key: string) => validatedStrategies?.find(s => s.key === key) ?? null

  // Strategy fit — use validated data when available, else fall back to local thresholds
  const btlS = vs("BTL")
  const flipS = vs("Flip")
  const brrS = vs("BRR")

  const btlFit = btlS ? btlS.viable : (monthlyRent !== null && grossYield !== null && grossYield >= 5)
  const flipFit = flipS ? flipS.viable : (bmv !== null && bmv >= 10 && profit !== null && profit > 0)
  const brrFit = brrS ? brrS.viable : (refurb !== null && bmv !== null && bmv >= 10)

  // Build human-readable reasons using real numbers where possible
  const fmt = (n: number | null | undefined) =>
    n != null ? `£${Math.round(n).toLocaleString("en-GB")}` : "—"

  const btlReason = btlS
    ? btlS.viable
      ? `${btlS.yieldAtOffer?.toFixed(1) ?? grossYield?.toFixed(1) ?? "?"}% yield · ceiling ${fmt(btlS.maxViable)}`
      : btlS.maxViable != null
        ? `Yield too low — max price ${fmt(btlS.maxViable)} vs offer ${fmt(btlS.recommendedOffer)}`
        : grossYield != null
          ? `${grossYield.toFixed(1)}% yield — below min threshold`
          : "Insufficient rental data"
    : btlFit && grossYield !== null
      ? `${grossYield.toFixed(1)}% yield · good cashflow`
      : grossYield !== null
        ? `${grossYield.toFixed(1)}% yield — below 5% threshold`
        : "No rental data available"

  const flipReason = flipS
    ? flipS.viable
      ? `${fmt(flipS.flipProfit)} profit · ceiling ${fmt(flipS.maxViable)}`
      : flipS.maxViable != null
        ? `Max price ${fmt(flipS.maxViable)} vs offer ${fmt(flipS.recommendedOffer)}`
        : bmv !== null
          ? `${bmv.toFixed(1)}% BMV — below flip threshold`
          : "Insufficient BMV data"
    : flipFit && bmv !== null
      ? `${bmv.toFixed(1)}% BMV · ${fmt(profit)} profit`
      : bmv !== null
        ? `${bmv.toFixed(1)}% BMV — needs ≥10% for flip`
        : "No BMV/profit data"

  const brrReason = brrS
    ? brrS.viable
      ? `${fmt(brrS.brrLeftIn)} left in · refi ${fmt(brrS.brrProceeds)}`
      : brrS.maxViable != null
        ? `Ceiling ${fmt(brrS.maxViable)} vs offer ${fmt(brrS.recommendedOffer)}`
        : "Refurb/BMV insufficient for BRRR"
    : brrFit
      ? "Refurb + refi potential"
      : refurb === null
        ? "No refurb estimate"
        : "BMV too low for BRRR"

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
          {/* Alert banner — only shown when opened from Needs Attention */}
          {alertReason && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={cn(
                    "flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-help",
                    alertUrgency === "high" ? "bg-red-500/20 border border-red-500/40"
                      : alertUrgency === "medium" ? "bg-amber-500/20 border border-amber-500/40"
                      : "bg-orange-500/15 border border-orange-400/30"
                  )}>
                    {alertUrgency === "high"
                      ? <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />
                      : alertUrgency === "medium"
                      ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                      : <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-400" />
                    }
                    <div>
                      <p className={cn("text-[10px] font-bold uppercase tracking-wider",
                        alertUrgency === "high" ? "text-red-400" : alertUrgency === "medium" ? "text-amber-400" : "text-orange-400"
                      )}>
                        {alertUrgency === "high" ? "Action Required" : alertUrgency === "medium" ? "Needs Attention" : "Stale Lead"}
                      </p>
                      <p className="text-[11px] text-slate-300 leading-snug mt-0.5">{alertReason}</p>
                    </div>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px] text-xs">
                  <div className="flex items-start gap-1.5">
                    <Bell className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                    <span>{alertReason}</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

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

          {/* Vendor contact */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Vendor
            </p>
            <p className="text-sm font-bold text-slate-100">{lead.vendorName}</p>
            {lead.vendorPhone && (
              <a
                href={`tel:${lead.vendorPhone}`}
                className="flex items-center gap-2 rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-1.5 hover:bg-green-500/20 transition-colors"
              >
                <Phone className="h-3.5 w-3.5 shrink-0 text-green-400" />
                <span className="text-[12px] font-semibold text-green-300">{lead.vendorPhone}</span>
              </a>
            )}
            {lead.vendorEmail && (
              <a
                href={`mailto:${lead.vendorEmail}`}
                className="flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 hover:bg-blue-500/20 transition-colors"
              >
                <Mail className="h-3.5 w-3.5 shrink-0 text-blue-400" />
                <span className="text-[12px] font-medium text-blue-300 truncate">{lead.vendorEmail}</span>
              </a>
            )}
            {(motivation !== null || lead.urgencyLevel) && (
              <div className="flex items-center justify-between text-xs pt-0.5">
                {motivation !== null && (
                  <span className="text-slate-400">
                    Motivation{" "}
                    <span className={cn(
                      "font-bold",
                      motivation >= 8 ? "text-green-400" : motivation >= 5 ? "text-amber-400" : "text-slate-300"
                    )}>
                      {motivation}/10{motivation >= 8 ? " 🔥" : ""}
                    </span>
                  </span>
                )}
                {lead.urgencyLevel && (
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                    lead.urgencyLevel === "urgent" ? "bg-red-500/20 text-red-300"
                      : lead.urgencyLevel === "moderate" ? "bg-amber-500/20 text-amber-300"
                      : "bg-slate-500/20 text-slate-400"
                  )}>
                    {lead.urgencyLevel}
                  </span>
                )}
              </div>
            )}
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
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                Strategy Fit
              </p>
              {validatedRecommended && (
                <span className="text-[10px] text-blue-600 font-semibold">
                  from validation ✓
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <StrategyCard
                fit={btlFit}
                name="BTL"
                reason={btlReason}
                isRecommended={validatedRecommended === "BTL"}
                noData={!btlS && monthlyRent === null}
              />
              <StrategyCard
                fit={flipFit}
                name="Flip"
                reason={flipReason}
                isRecommended={validatedRecommended === "Flip"}
                noData={!flipS && bmv === null}
              />
              <StrategyCard
                fit={brrFit}
                name="BRRR"
                reason={brrReason}
                isRecommended={validatedRecommended === "BRR"}
                noData={!brrS && refurb === null && bmv === null}
              />
              <StrategyCard fit={false} name="SA" reason="Not assessed" noData />
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
