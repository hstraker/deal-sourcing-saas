"use client"

import { X, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { VendorComparablesTab } from "./vendor-comparables-tab"
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

function investGrade(y: number | null): { label: string; colour: string } {
  if (y === null) return { label: "—", colour: "text-slate-400" }
  if (y >= 7)  return { label: "Excellent", colour: "text-green-400" }
  if (y >= 6)  return { label: "Very Good", colour: "text-green-400" }
  if (y >= 5)  return { label: "Good",      colour: "text-amber-400" }
  if (y >= 4)  return { label: "Fair",      colour: "text-amber-400" }
  return              { label: "Poor",       colour: "text-red-400"   }
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
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex-shrink-0 text-slate-400">{label}</span>
      <span className={cn("text-right font-semibold text-slate-100 truncate", valueClass)}>
        {value}
      </span>
    </div>
  )
}

// ─── component ───────────────────────────────────────────────────────────────

export function ComparableModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv        = toNum(lead.bmvScore)
  const askingPrice = toNum(lead.askingPrice)
  const avgPrice   = toNum(lead.avgComparablePrice)
  const profit     = toNum(lead.profitPotential)

  // Rental figures — prefer estimatedMonthlyRent (set by fetch-comparables),
  // fall back to localAverageRent (set by calculate-bmv)
  const monthlyRent = toNum(lead.estimatedMonthlyRent) ?? toNum(lead.localAverageRent)
  const annualRent  = toNum(lead.estimatedAnnualRent)  ?? (monthlyRent ? monthlyRent * 12 : null)

  // Gross yield against avg comparable price (market value) — more meaningful than asking price
  const yieldBase  = avgPrice ?? askingPrice
  const grossYield = annualRent && yieldBase && yieldBase > 0
    ? (annualRent / yieldBase) * 100
    : null

  const grade = investGrade(grossYield)

  const bmvColour =
    bmv === null ? "text-slate-300"
    : bmv >= 15  ? "text-green-400"
    : bmv >= 10  ? "text-amber-400"
    :               "text-red-400"

  // ── left panel ──────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex flex-col gap-0 p-5 h-full overflow-y-auto">

      {/* Address + pills */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address"}
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
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Subject property */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Subject Property
        </p>
        <InfoRow label="Asking Price" value={fmtCurrency(askingPrice)} />
        {avgPrice && (
          <InfoRow label="Avg Comp Price" value={fmtCurrency(avgPrice)} />
        )}
        {bmv !== null && (
          <InfoRow label="BMV %" value={`${bmv.toFixed(1)}%`} valueClass={bmvColour} />
        )}
        {profit !== null && (
          <InfoRow
            label="Profit Potential"
            value={fmtCurrency(profit)}
            valueClass={profit > 0 ? "text-green-400" : "text-red-400"}
          />
        )}
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Comparables summary */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Comparables
        </p>
        <InfoRow
          label="Found"
          value={lead.comparablesCount != null ? `${lead.comparablesCount}` : "—"}
          valueClass={
            lead.comparablesCount == null ? "text-slate-400"
            : lead.comparablesCount >= 5  ? "text-green-400"
            : lead.comparablesCount >= 3  ? "text-amber-400"
            :                               "text-red-400"
          }
        />
        <InfoRow label="Avg Price" value={fmtCurrency(avgPrice)} />
        {bmv !== null && (
          <div className="mt-1 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">Implied BMV</span>
              <span className="text-xl font-extrabold text-green-400">
                {`${bmv.toFixed(1)}%`}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Rental summary */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-slate-500" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Rental Estimate
          </p>
        </div>

        {monthlyRent !== null ? (
          <>
            <InfoRow label="Monthly Rent" value={`${fmtCurrency(monthlyRent)}/mo`} />
            {annualRent !== null && (
              <InfoRow label="Annual Rent" value={fmtCurrency(annualRent)} />
            )}
            {grossYield !== null && (
              <InfoRow
                label="Gross Yield"
                value={`${grossYield.toFixed(2)}%`}
                valueClass={grade.colour}
              />
            )}
            {grossYield !== null && (
              <InfoRow
                label="Invest. Grade"
                value={grade.label}
                valueClass={grade.colour}
              />
            )}
          </>
        ) : (
          <p className="text-[10px] italic text-slate-500">
            Fetch comparables to get rental estimates
          </p>
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
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="6xl">
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

      <div className="flex-1 p-4 pt-2">
        <VendorComparablesTab
          vendorLeadId={lead.id}
          askingPrice={toNum(lead.askingPrice) ?? undefined}
          propertyPostcode={lead.propertyPostcode}
        />
      </div>
    </ModalShell>
  )
}
