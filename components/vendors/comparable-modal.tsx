"use client"

import { X } from "lucide-react"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import type { VendorLead } from "./vendor-leads-table"

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

export function ComparableModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv = toNum(lead.bmvScore)

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address — property-focused (vendorName intentionally omitted for comparable context) */}
      <div>
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
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Subject property */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Subject Property
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Postcode</span>
          <span className="font-bold text-slate-100">{lead.propertyPostcode ?? "—"}</span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Comparables summary */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Comparables
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Found</span>
          <span className="font-bold text-slate-100">{lead.comparablesCount ?? "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Avg Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.avgComparablePrice)}</span>
        </div>
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
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="4xl">
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
