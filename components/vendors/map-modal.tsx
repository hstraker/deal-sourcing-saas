"use client"

import { cn } from "@/lib/utils"
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

export function MapModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const address = lead.propertyAddress ?? ""
  const encoded = encodeURIComponent(address)
  // No hardcoded fallback key — use env var only
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}`

  const conditionChipClass =
    lead.condition === "excellent" || lead.condition === "good"
      ? "bg-green-500 text-white"
      : lead.condition === "needs_work" || lead.condition === "needs_modernisation"
      ? "bg-amber-400 text-amber-900"
      : lead.condition === "poor"
      ? "bg-red-500 text-white"
      : "bg-white/10 text-slate-200"

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
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

      {/* Property details */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Property</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Type</span>
          <span className="font-bold capitalize text-slate-100">{lead.propertyType ?? "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Bedrooms</span>
          <span className="font-bold text-slate-100">{lead.bedrooms?.toString() ?? "—"}</span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Vendor contact */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Name</span>
          <span className="font-bold text-slate-100">{lead.vendorName}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Phone</span>
          <span className="font-bold text-slate-100">{lead.vendorPhone}</span>
        </div>
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
    // rightPanelClassName="p-0" removes padding so the map fills edge-to-edge
    // No close button in right panel — backdrop-click closes the modal
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="3xl" rightPanelClassName="p-0">
      <iframe
        src={src}
        width="100%"
        height="100%"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full min-h-[300px] w-full border-0"
        title={`Map: ${address}`}
      />
    </ModalShell>
  )
}
