"use client"

import { X, TrendingUp } from "lucide-react"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
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

export function ValidationModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">{lead.vendorName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyAddress ?? "No address"}</p>
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
          {lead.validationPassed === true && (
            <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              ✓ Passed
            </span>
          )}
          {lead.validationPassed === false && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              ✗ Failed
            </span>
          )}
          {lead.validationPassed === null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
              Not validated
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Financials */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Financials</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Market Value</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.estimatedMarketValue)}</span>
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
              <span className="text-sm font-bold text-green-400">{fmtCurrency(profit)}</span>
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
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="2xl">
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

      <div className="space-y-4 p-5 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Validation Notes
        </p>
        {lead.validationNotes ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
              {lead.validationNotes}
            </pre>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <TrendingUp className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">
              No validation run yet. Use the Check button to calculate BMV.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
