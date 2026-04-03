"use client"

import { useState } from "react"
import { X, Phone, Mail, Building2, AlertTriangle, Shield, CheckCircle, Clock } from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import type { VendorLead } from "./vendor-leads-table"

// ─── types ────────────────────────────────────────────────────────────────────

type RiskLevel = "clear" | "caution" | "red_flag"
type Tab = "portal" | "ownership" | "history"

// ─── risk config ──────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<
  RiskLevel,
  {
    boxClass: string
    textClass: string
    subClass: string
    label: string
    subtitle: string
    iconClass: string
    kpiClass: string
  }
> = {
  clear: {
    boxClass:  "rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-green-400 leading-none",
    subClass:  "mt-1 text-[10px] text-green-300",
    label:     "CLEAR",
    subtitle:  "No flags found",
    iconClass: "text-green-400",
    kpiClass:  "bg-green-500/10 border-green-500/20 text-green-400",
  },
  caution: {
    boxClass:  "rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-amber-400 leading-none",
    subClass:  "mt-1 text-[10px] text-amber-300",
    label:     "CAUTION",
    subtitle:  "Review flags below",
    iconClass: "text-amber-400",
    kpiClass:  "bg-amber-500/10 border-amber-500/20 text-amber-400",
  },
  red_flag: {
    boxClass:  "rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-red-400 leading-none",
    subClass:  "mt-1 text-[10px] text-red-300",
    label:     "RED FLAG",
    subtitle:  "Action required",
    iconClass: "text-red-400",
    kpiClass:  "bg-red-500/10 border-red-500/20 text-red-400",
  },
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

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

// ─── ownership tab ────────────────────────────────────────────────────────────

function OwnershipTab({ ownership, lead }: {
  ownership: {
    tenure?: string | null
    lastSalePrice?: number | null
    lastSaleDate?: string | null
    equityEstimate?: number | null
    isCorporateOwned?: boolean
    isOverseasOwned?: boolean
    isPortfolioOwner?: boolean
    companyName?: string | null
  } | null | undefined
  lead: VendorLead
}) {
  if (!ownership) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8">
        <Building2 className="h-10 w-10 text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-600">No Ownership Data</p>
        <p className="mt-1 text-xs text-gray-400">Run a portal check to populate ownership intelligence</p>
      </div>
    )
  }

  const lastSaleDate   = ownership.lastSaleDate
  const lastSalePrice  = ownership.lastSalePrice
  const equityEstimate = ownership.equityEstimate
  const isCorporate    = ownership.isCorporateOwned
  const isOverseas     = ownership.isOverseasOwned
  const isPortfolio    = ownership.isPortfolioOwner
  const companyName    = ownership.companyName

  const yearsOwned = lastSaleDate
    ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-0.5">Ownership Intelligence</h3>
        <p className="text-xs text-gray-500">Data sourced from Land Registry &amp; Companies House</p>
      </div>

      {/* Key ownership stats */}
      <div className="grid grid-cols-2 gap-3">
        {ownership.tenure && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tenure</p>
            <p className="text-sm font-bold text-gray-900 capitalize">{ownership.tenure}</p>
          </div>
        )}
        {yearsOwned !== null && (
          <div className={cn(
            "rounded-xl border p-3",
            yearsOwned >= 10 ? "border-green-200 bg-green-50" :
            yearsOwned >= 5  ? "border-amber-200 bg-amber-50" :
                               "border-gray-200 bg-gray-50"
          )}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Years Owned</p>
            <p className={cn(
              "text-sm font-bold",
              yearsOwned >= 10 ? "text-green-700" :
              yearsOwned >= 5  ? "text-amber-700" :
                                 "text-gray-900"
            )}>
              ~{yearsOwned} yr{yearsOwned !== 1 ? "s" : ""}
              {yearsOwned >= 10 && <span className="ml-1 text-green-600">✓</span>}
            </p>
          </div>
        )}
        {lastSalePrice && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Last Sold</p>
            <p className="text-sm font-bold text-gray-900">{fmtCurrency(lastSalePrice)}</p>
            {lastSaleDate && (
              <p className="text-[10px] text-gray-500 mt-0.5">{format(new Date(lastSaleDate), "MMM yyyy")}</p>
            )}
          </div>
        )}
        {equityEstimate != null && (
          <div className={cn(
            "rounded-xl border p-3",
            equityEstimate >= 50_000 ? "border-green-200 bg-green-50" :
            equityEstimate >= 20_000 ? "border-amber-200 bg-amber-50" :
                                       "border-red-200 bg-red-50"
          )}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Est. Equity</p>
            <p className={cn(
              "text-sm font-bold",
              equityEstimate >= 50_000 ? "text-green-700" :
              equityEstimate >= 20_000 ? "text-amber-700" :
                                         "text-red-700"
            )}>
              {fmtCurrency(equityEstimate)}
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              {equityEstimate >= 50_000 ? "Strong equity position" :
               equityEstimate >= 20_000 ? "Moderate equity" :
                                          "Low equity — caution"}
            </p>
          </div>
        )}
      </div>

      {/* Ownership type flags */}
      {(isCorporate || isOverseas || isPortfolio) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-800 mb-1">Ownership Flags</p>
              <div className="space-y-0.5">
                {isCorporate && (
                  <p className="text-xs text-amber-700">
                    Corporate owned{companyName ? ` — ${companyName}` : ""}
                  </p>
                )}
                {isOverseas && (
                  <p className="text-xs text-amber-700">Overseas owner — may complicate purchase</p>
                )}
                {isPortfolio && (
                  <p className="text-xs text-amber-700">Portfolio owner — may have multiple properties</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seller motivation signals */}
      <div className="rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-3">Seller Motivation Signals</p>
        <div className="space-y-2">
          <InfoRow
            label="Motivation score"
            value={lead.motivationScore != null ? `${lead.motivationScore}/10` : "Not set"}
            valueClass={
              lead.motivationScore != null
                ? lead.motivationScore >= 8 ? "text-green-600"
                  : lead.motivationScore >= 5 ? "text-amber-600"
                  : "text-gray-700"
                : "text-gray-400"
            }
          />
          <InfoRow
            label="Urgency"
            value={lead.urgencyLevel
              ? lead.urgencyLevel.charAt(0).toUpperCase() + lead.urgencyLevel.slice(1)
              : "Not set"
            }
            valueClass={
              lead.urgencyLevel === "high"   ? "text-red-600"
              : lead.urgencyLevel === "medium" ? "text-amber-600"
              : "text-gray-700"
            }
          />
          {yearsOwned !== null && (
            <InfoRow
              label="Long-term owner signal"
              value={yearsOwned >= 10 ? "Strong — likely high equity" : yearsOwned >= 5 ? "Moderate" : "Short ownership"}
              valueClass={yearsOwned >= 10 ? "text-green-600" : yearsOwned >= 5 ? "text-amber-600" : "text-gray-700"}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── history tab ──────────────────────────────────────────────────────────────

function HistoryTab({ lead }: { lead: VendorLead }) {
  const hasCheck = !!lead.latestPortalCheck
  const flagCount = (lead.latestPortalCheck?.summaryFlags as unknown[])?.length ?? 0
  const risk = lead.latestCheckRisk as RiskLevel | null
  const config = risk ? RISK_CONFIG[risk] : null

  return (
    <div className="p-5 space-y-4">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-0.5">Check History</h3>
        <p className="text-xs text-gray-500">Portal checks run on this property</p>
      </div>

      {hasCheck ? (
        <div className="space-y-3">
          {/* Latest check entry */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-blue-500" />
                <p className="text-xs font-bold text-gray-800">Latest Check</p>
              </div>
              {config && (
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  risk === "clear"    ? "bg-green-100 text-green-700 border border-green-200" :
                  risk === "caution"  ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                       "bg-red-100 text-red-700 border border-red-200"
                )}>
                  {config.label}
                </span>
              )}
            </div>
            <div className="space-y-1.5 text-xs">
              {lead.latestCheckedAt && (
                <div className="flex items-center gap-1.5 text-gray-500">
                  <Clock className="h-3 w-3" />
                  <span>{format(new Date(lead.latestCheckedAt), "d MMM yyyy, HH:mm")}</span>
                  <span className="text-gray-400">
                    ({formatDistanceToNow(new Date(lead.latestCheckedAt), { addSuffix: true })})
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-gray-500">
                <Shield className="h-3 w-3" />
                <span>{flagCount} flag{flagCount !== 1 ? "s" : ""} found</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-center">
            <Clock className="h-5 w-5 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-500">Full check history coming soon</p>
            <p className="text-[10px] text-gray-400 mt-0.5">Previous checks will be stored and shown here</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Clock className="h-10 w-10 text-gray-300 mb-3" />
          <p className="text-sm font-semibold text-gray-600">No Checks Run Yet</p>
          <p className="mt-1 text-xs text-gray-400">Run a portal check from the Portal tab</p>
        </div>
      )}
    </div>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export function PortalCheckModal({
  lead,
  onClose,
  onRiskUpdated,
}: {
  lead: VendorLead
  onClose: () => void
  onRiskUpdated?: (newRisk: string | null, newDate: string | null) => void
}) {
  const [activeTab, setActiveTab] = useState<Tab>("portal")

  const risk   = lead.latestCheckRisk as RiskLevel | null
  const config = risk ? RISK_CONFIG[risk] : null

  const lastChecked = lead.latestCheckedAt
    ? formatDistanceToNow(new Date(lead.latestCheckedAt), { addSuffix: true })
    : "Never"

  // ── Ownership data ────────────────────────────────────────────────────────
  const ownership = lead.latestPortalCheck?.ownershipCheckRaw as {
    tenure?: string | null
    lastSalePrice?: number | null
    lastSaleDate?: string | null
    equityEstimate?: number | null
    isCorporateOwned?: boolean
    isOverseasOwned?: boolean
    isPortfolioOwner?: boolean
    companyName?: string | null
  } | null | undefined

  // ── Portal listing status ─────────────────────────────────────────────────
  const portalRaw = lead.latestPortalCheck?.portalCheckRaw as any
  const isListed  = !!(portalRaw?.activeListing)
  const flagCount = (lead.latestPortalCheck?.summaryFlags as unknown[])?.length ?? 0
  const hasFlags  = flagCount > 0

  // ── Left panel ────────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col overflow-y-auto p-5">

      {/* Property address — compact at top */}
      <div className="mb-4">
        <p className="text-xs font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? lead.vendorName}
        </p>
        <p className="mt-0.5 font-mono text-[10px] text-slate-500">
          {lead.propertyPostcode ?? ""}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-300">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-300">
              {lead.propertyType}
            </span>
          )}
        </div>
      </div>

      {/* ── BIG Risk verdict ── */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 mb-2">
          <Shield className="h-3 w-3 text-slate-500" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Risk Verdict</p>
        </div>

        {config ? (
          <div className={config.boxClass}>
            {risk === "clear" && (
              <CheckCircle className={cn("h-7 w-7 mx-auto mb-1.5", config.iconClass)} />
            )}
            {risk === "caution" && (
              <AlertTriangle className={cn("h-7 w-7 mx-auto mb-1.5", config.iconClass)} />
            )}
            {risk === "red_flag" && (
              <AlertTriangle className={cn("h-7 w-7 mx-auto mb-1.5", config.iconClass)} />
            )}
            <p className={config.textClass}>{config.label}</p>
            <p className={config.subClass}>{config.subtitle}</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
            <Shield className="h-7 w-7 mx-auto mb-1.5 text-slate-600" />
            <p className="text-lg font-extrabold text-slate-400 leading-none">NOT RUN</p>
            <p className="mt-1 text-[10px] text-slate-500">Run a portal check</p>
          </div>
        )}
      </div>

      {/* ── 3 KPI pills ── */}
      <div className="mb-4 space-y-2">
        {/* Listed */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border px-3 py-2",
          lead.latestPortalCheck
            ? isListed ? "bg-red-500/10 border-red-500/20" : "bg-green-500/10 border-green-500/20"
            : "bg-white/5 border-white/10"
        )}>
          <span className="text-[10px] text-slate-400">Listed on portals</span>
          <span className={cn(
            "text-[11px] font-bold",
            lead.latestPortalCheck
              ? isListed ? "text-red-400" : "text-green-400"
              : "text-slate-500"
          )}>
            {lead.latestPortalCheck ? (isListed ? "Yes ⚠" : "No ✓") : "—"}
          </span>
        </div>

        {/* Flags */}
        <div className={cn(
          "flex items-center justify-between rounded-lg border px-3 py-2",
          lead.latestPortalCheck
            ? hasFlags ? "bg-amber-500/10 border-amber-500/20" : "bg-green-500/10 border-green-500/20"
            : "bg-white/5 border-white/10"
        )}>
          <span className="text-[10px] text-slate-400">Flags found</span>
          <span className={cn(
            "text-[11px] font-bold",
            lead.latestPortalCheck
              ? hasFlags ? "text-amber-400" : "text-green-400"
              : "text-slate-500"
          )}>
            {lead.latestPortalCheck ? (hasFlags ? `${flagCount} flag${flagCount > 1 ? "s" : ""}` : "None ✓") : "—"}
          </span>
        </div>

        {/* Last checked */}
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-[10px] text-slate-400">Last checked</span>
          <span className="text-[11px] font-bold text-slate-300">{lastChecked}</span>
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* ── Vendor ── */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <p className="text-sm font-bold text-slate-100">{lead.vendorName}</p>

        {/* Big call button */}
        {lead.vendorPhone && (
          <a
            href={`tel:${lead.vendorPhone}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <Phone className="h-4 w-4" />
            {lead.vendorPhone}
          </a>
        )}

        {lead.vendorEmail && (
          <a
            href={`mailto:${lead.vendorEmail}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Mail className="h-3.5 w-3.5 text-blue-400" />
            <span className="truncate">{lead.vendorEmail}</span>
          </a>
        )}

        {/* Motivation + urgency chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {lead.motivationScore != null && (
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold",
              lead.motivationScore >= 8 ? "bg-green-500/20 border-green-500/30 text-green-300" :
              lead.motivationScore >= 5 ? "bg-amber-500/20 border-amber-500/30 text-amber-300" :
                                          "bg-white/10 border-white/20 text-slate-400"
            )}>
              Motivation {lead.motivationScore}/10
            </span>
          )}
          {lead.urgencyLevel && (
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize",
              lead.urgencyLevel === "high"   ? "bg-red-500/20 border-red-500/30 text-red-300" :
              lead.urgencyLevel === "medium" ? "bg-amber-500/20 border-amber-500/30 text-amber-300" :
                                               "bg-white/10 border-white/20 text-slate-400"
            )}>
              {lead.urgencyLevel} urgency
            </span>
          )}
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

  // ── Tab content ────────────────────────────────────────────────────────────
  const tabs: { id: Tab; label: string }[] = [
    { id: "portal",    label: "Portal" },
    { id: "ownership", label: "Ownership" },
    { id: "history",   label: "History" },
  ]

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="5xl">
      {/* Tab bar + close button */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 pt-3 shrink-0">
        <div className="flex gap-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-4 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mb-3 flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "portal" && (
          <div className="p-4 pt-3">
            <PortalCheckDetailPanel
              leadId={lead.id}
              latestCheckRisk={lead.latestCheckRisk}
              latestCheckedAt={lead.latestCheckedAt}
              onRiskUpdated={onRiskUpdated}
            />
          </div>
        )}
        {activeTab === "ownership" && (
          <OwnershipTab ownership={ownership} lead={lead} />
        )}
        {activeTab === "history" && (
          <HistoryTab lead={lead} />
        )}
      </div>
    </ModalShell>
  )
}
