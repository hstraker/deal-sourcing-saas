"use client"

import { X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ModalShell } from "./modal-shell"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import type { VendorLead } from "./vendor-leads-table"

type RiskLevel = "clear" | "caution" | "red_flag"

const RISK_CONFIG: Record<
  RiskLevel,
  { boxClass: string; textClass: string; subClass: string; label: string; subtitle: string; chipClass: string; chipLabel: string }
> = {
  clear: {
    boxClass: "rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-green-400",
    subClass: "mt-1 text-xs text-green-300",
    label: "CLEAR",
    subtitle: "No flags found",
    chipClass: "rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white",
    chipLabel: "Clear",
  },
  caution: {
    boxClass: "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-amber-400",
    subClass: "mt-1 text-xs text-amber-300",
    label: "CAUTION",
    subtitle: "Review flags below",
    chipClass: "rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-900",
    chipLabel: "Caution",
  },
  red_flag: {
    boxClass: "rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-red-400",
    subClass: "mt-1 text-xs text-red-300",
    label: "RED FLAG",
    subtitle: "Action required",
    chipClass: "rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white",
    chipLabel: "Red Flag",
  },
}

export function PortalCheckModal({
  lead,
  onClose,
  onRiskUpdated,
}: {
  lead: VendorLead
  onClose: () => void
  onRiskUpdated?: (newRisk: string | null, newDate: string | null) => void
}) {
  const risk = lead.latestCheckRisk as RiskLevel | null
  const config = risk ? RISK_CONFIG[risk] : null

  const lastChecked = lead.latestCheckedAt
    ? formatDistanceToNow(new Date(lead.latestCheckedAt), { addSuffix: true })
    : "Never"

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">{lead.vendorName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyAddress ?? "No address"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {config ? (
            <span className={config.chipClass}>{config.chipLabel}</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
              Not checked
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Overall risk */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Overall Risk
        </p>
        {config ? (
          <div className={config.boxClass}>
            <p className={config.textClass}>{config.label}</p>
            <p className={config.subClass}>{config.subtitle}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-400">NOT RUN</p>
            <p className="mt-1 text-xs text-slate-500">Run a portal check</p>
          </div>
        )}
      </div>

      {/* Last checked — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Last Checked</span>
          <span className="text-[10px] text-slate-400">{lastChecked}</span>
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="3xl">
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
        <PortalCheckDetailPanel
          leadId={lead.id}
          latestCheckRisk={lead.latestCheckRisk}
          latestCheckedAt={lead.latestCheckedAt}
          onRiskUpdated={onRiskUpdated}
        />
      </div>
    </ModalShell>
  )
}
