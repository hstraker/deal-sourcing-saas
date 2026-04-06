"use client"

import { useState } from "react"
import {
  X, Phone, Mail, Building2, AlertTriangle, Shield, CheckCircle, Clock,
  ExternalLink, Loader2, Save, Calculator, Key,
} from "lucide-react"
import { format, formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import type { VendorLead } from "./vendor-leads-table"

// ─── types ────────────────────────────────────────────────────────────────────

type RiskLevel = "clear" | "caution" | "red_flag"
type Tab = "portal" | "ownership" | "history" | "leasehold"

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

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

// ─── leasehold helpers ────────────────────────────────────────────────────────

interface LeaseholdData {
  yearsRemaining: number | null
  groundRent: number | null
  groundRentReviewYears: number | null
  serviceCharge: number | null
  freeholderName: string | null
  managingAgent: string | null
  isGroundRentDoubling: boolean
  isSection20Pending: boolean
  hasMaintenanceArrears: boolean
  extensionQuoteReceived: boolean
  extensionQuoteAmount: number | null
  notes: string | null
}

type LeaseUrgency = "ok" | "low" | "caution" | "urgent" | "critical"

function calcExtension(years: number, propValue: number): {
  low: number; high: number; urgency: LeaseUrgency; tier: string
} {
  if (years >= 90) return { low: Math.round(propValue * 0.005), high: Math.round(propValue * 0.015), urgency: "ok",      tier: "Not urgent — standard 90-year statutory extension" }
  if (years >= 85) return { low: Math.round(propValue * 0.01),  high: Math.round(propValue * 0.025), urgency: "low",     tier: "Low priority — budget time to extend before resale" }
  if (years >= 80) return { low: Math.round(propValue * 0.025), high: Math.round(propValue * 0.05),  urgency: "caution", tier: "Approaching 80yr marriage value threshold" }
  if (years >= 70) return { low: Math.round(propValue * 0.05),  high: Math.round(propValue * 0.12),  urgency: "urgent",  tier: "Marriage value applies — extension cost rises steeply below 80yr" }
  if (years >= 60) return { low: Math.round(propValue * 0.10),  high: Math.round(propValue * 0.20),  urgency: "critical", tier: "High premium — specialist surveyor valuation essential" }
  return           { low: Math.round(propValue * 0.20),         high: Math.round(propValue * 0.35),  urgency: "critical", tier: "Very expensive — most lenders refuse below 60yr" }
}

// ─── leasehold tab ────────────────────────────────────────────────────────────

function LeaseholdTab({ lead, onSaved }: {
  lead: VendorLead
  onSaved?: () => void
}) {
  const saved = (lead.leaseholdData ?? {}) as Partial<LeaseholdData>
  const tenureRaw = lead.tenureType ?? ((lead.latestPortalCheck?.ownershipCheckRaw as any)?.tenure as string | null)
  const tenure = tenureRaw?.toLowerCase() ?? null
  const isFreehold  = !!(tenure?.includes("freehold") && !tenure?.includes("leasehold"))
  const isLeasehold = !!(tenure?.includes("leasehold"))

  // Pre-seed freeholder name from PropertyData /title if not already saved
  const fhDetail = (lead.latestPortalCheck?.ownershipCheckRaw as any)?.freeholds?.nearestTitleDetail
  const inferredFreeholder = fhDetail?.ownerName ?? (
    fhDetail?.ownershipType?.toLowerCase().includes('corporate') ? fhDetail.ownershipType : ""
  )

  const [years,           setYears]           = useState(saved.yearsRemaining?.toString() ?? "")
  const [groundRent,      setGroundRent]      = useState(saved.groundRent?.toString() ?? "")
  const [grReview,        setGrReview]        = useState(saved.groundRentReviewYears?.toString() ?? "")
  const [serviceCharge,   setServiceCharge]   = useState(saved.serviceCharge?.toString() ?? "")
  const [freeholder,      setFreeholder]      = useState(saved.freeholderName || inferredFreeholder || "")
  const [managingAgent,   setManagingAgent]   = useState(saved.managingAgent ?? "")
  const [doubling,        setDoubling]        = useState(saved.isGroundRentDoubling ?? false)
  const [section20,       setSection20]       = useState(saved.isSection20Pending ?? false)
  const [arrears,         setArrears]         = useState(saved.hasMaintenanceArrears ?? false)
  const [quoteReceived,   setQuoteReceived]   = useState(saved.extensionQuoteReceived ?? false)
  const [quoteAmount,     setQuoteAmount]     = useState(saved.extensionQuoteAmount?.toString() ?? "")
  const [notes,           setNotes]           = useState(saved.notes ?? "")
  const [isSaving,        setIsSaving]        = useState(false)

  const yearsNum       = years       ? parseInt(years)          : null
  const groundRentNum  = groundRent  ? parseFloat(groundRent)   : null
  const serviceChargeNum = serviceCharge ? parseFloat(serviceCharge) : null
  const flagCount = [doubling, section20, arrears].filter(Boolean).length

  const leaseUrgency: LeaseUrgency | null = !yearsNum ? null :
    yearsNum < 70 ? "critical" :
    yearsNum < 80 ? "urgent"   :
    yearsNum < 85 ? "caution"  :
    yearsNum < 90 ? "low"      : "ok"

  const propValue = toNum(lead.estimatedMarketValue ?? lead.askingPrice)
  const extension = (yearsNum && propValue) ? calcExtension(yearsNum, propValue) : null

  const hmlrUrl = `https://search-property-information.service.gov.uk/${lead.propertyPostcode ? `?postcode=${encodeURIComponent(lead.propertyPostcode)}` : ""}`

  const urgencyColors: Record<LeaseUrgency, { border: string; bg: string; text: string; badge: string }> = {
    ok:       { border: "border-green-200",  bg: "bg-green-50",   text: "text-green-700",  badge: "bg-green-100 text-green-700"  },
    low:      { border: "border-blue-200",   bg: "bg-blue-50",    text: "text-blue-700",   badge: "bg-blue-100 text-blue-700"    },
    caution:  { border: "border-amber-200",  bg: "bg-amber-50",   text: "text-amber-700",  badge: "bg-amber-100 text-amber-700"  },
    urgent:   { border: "border-orange-200", bg: "bg-orange-50",  text: "text-orange-700", badge: "bg-orange-100 text-orange-700"},
    critical: { border: "border-red-200",    bg: "bg-red-50",     text: "text-red-700",    badge: "bg-red-100 text-red-700"      },
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leaseholdData: {
            yearsRemaining:        yearsNum,
            groundRent:            groundRentNum,
            groundRentReviewYears: grReview ? parseInt(grReview) : null,
            serviceCharge:         serviceChargeNum,
            freeholderName:        freeholder || null,
            managingAgent:         managingAgent || null,
            isGroundRentDoubling:  doubling,
            isSection20Pending:    section20,
            hasMaintenanceArrears: arrears,
            extensionQuoteReceived: quoteReceived,
            extensionQuoteAmount:  quoteAmount ? parseFloat(quoteAmount) : null,
            notes:                 notes || null,
          },
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      toast.success("Leasehold data saved")
      onSaved?.()
    } catch {
      toast.error("Failed to save leasehold data")
    } finally {
      setIsSaving(false)
    }
  }

  // ── Freehold state ──────────────────────────────────────────────────────────
  if (isFreehold && !saved.yearsRemaining) {
    return (
      <div className="p-6 space-y-4">
        <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
          <p className="text-xl font-extrabold text-green-700">FREEHOLD</p>
          <p className="text-sm text-green-600 mt-1">No leasehold risk</p>
        </div>
        <p className="text-xs text-gray-500 text-center leading-relaxed">
          Property recorded as freehold — you own the land outright. No lease term, ground rent, service charge, or extension costs to consider.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href={hmlrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-blue-200 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Verify on HMLR Title Register
          </a>
        </div>
      </div>
    )
  }

  // ── Leasehold / unknown tenure form ────────────────────────────────────────
  return (
    <div className="p-5 space-y-4 overflow-y-auto">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 mb-0.5">Leasehold Details</h3>
          <p className="text-xs text-gray-500">
            {isLeasehold ? "Property recorded as leasehold — enter details below" : "Tenure not confirmed — enter details manually or run a portal check"}
          </p>
        </div>
        <a
          href={hmlrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors shrink-0"
        >
          <ExternalLink className="h-3 w-3" />
          HMLR Title
        </a>
      </div>

      {/* ── Lease years hero card ── */}
      <div className={cn(
        "rounded-xl border p-4",
        leaseUrgency ? urgencyColors[leaseUrgency].border + " " + urgencyColors[leaseUrgency].bg : "border-gray-200 bg-gray-50"
      )}>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
              Lease Years Remaining
            </label>
            <input
              type="number"
              value={years}
              onChange={e => setYears(e.target.value)}
              placeholder="e.g. 85"
              min="0"
              max="999"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
            />
          </div>
          {leaseUrgency && (
            <div className="text-right shrink-0 pb-0.5">
              <span className={cn("text-2xl font-extrabold", urgencyColors[leaseUrgency].text)}>
                {yearsNum}yr
              </span>
              <span className={cn(
                "ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold",
                urgencyColors[leaseUrgency].badge
              )}>
                {leaseUrgency === "critical" ? "⛔ Critical" :
                 leaseUrgency === "urgent"   ? "🔴 Urgent"   :
                 leaseUrgency === "caution"  ? "⚠ Caution"  :
                 leaseUrgency === "low"      ? "ℹ Low"      : "✓ OK"}
              </span>
            </div>
          )}
        </div>
        {yearsNum && (
          <p className={cn("mt-2 text-xs font-medium", leaseUrgency ? urgencyColors[leaseUrgency].text : "text-gray-600")}>
            {yearsNum < 70 ? "⛔ Most mortgage lenders refuse below 70yr — extension essential before purchase." :
             yearsNum < 80 ? "🔴 Marriage value applies below 80yr — extension cost increases significantly." :
             yearsNum < 85 ? "⚠ Extension strongly advised — affects resale and remortgage ability." :
             yearsNum < 90 ? "ℹ No immediate risk but monitor — budget time to extend before dropping below 85yr." :
                              "✓ Acceptable for purchase and mortgage purposes."}
          </p>
        )}
      </div>

      {/* ── 2-col grid: ground rent / service charge / freeholder ── */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
            Ground Rent (£/yr)
          </label>
          <input
            type="number"
            value={groundRent}
            onChange={e => setGroundRent(e.target.value)}
            placeholder="e.g. 250"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
          {groundRentNum !== null && groundRentNum > 1000 && (
            <p className="mt-1 text-[10px] text-red-600">⛔ High ground rent — likely mortgage difficulty</p>
          )}
          {groundRentNum !== null && groundRentNum > 250 && groundRentNum <= 1000 && (
            <p className="mt-1 text-[10px] text-amber-600">⚠ Review ground rent terms carefully</p>
          )}
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
            GR Review Frequency (yrs)
          </label>
          <input
            type="number"
            value={grReview}
            onChange={e => setGrReview(e.target.value)}
            placeholder="e.g. 10"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
            Service Charge (£/yr)
          </label>
          <input
            type="number"
            value={serviceCharge}
            onChange={e => setServiceCharge(e.target.value)}
            placeholder="e.g. 1,200"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
            Freeholder Name
          </label>
          <input
            type="text"
            value={freeholder}
            onChange={e => setFreeholder(e.target.value)}
            placeholder="e.g. XYZ Estates Ltd"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
          />
          {!saved.freeholderName && inferredFreeholder && (
            <p className="text-[10px] text-blue-500 mt-1">↑ Auto-filled from HMLR title data — verify and save</p>
          )}
        </div>
      </div>

      {/* Managing agent */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
          Managing Agent
        </label>
        <input
          type="text"
          value={managingAgent}
          onChange={e => setManagingAgent(e.target.value)}
          placeholder="e.g. Rendall &amp; Rittner"
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
      </div>

      {/* ── Risk flags ── */}
      <div className={cn(
        "rounded-xl border p-4 space-y-3",
        flagCount >= 2 ? "border-red-200 bg-red-50" :
        flagCount === 1 ? "border-amber-200 bg-amber-50" :
        "border-gray-200 bg-gray-50"
      )}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn(
            "h-4 w-4 shrink-0",
            flagCount >= 2 ? "text-red-500" : flagCount === 1 ? "text-amber-500" : "text-gray-400"
          )} />
          <p className="text-xs font-bold uppercase tracking-wide text-gray-700">Risk Flags</p>
          {flagCount > 0 && (
            <span className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold",
              flagCount >= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
            )}>
              {flagCount} flag{flagCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        {[
          {
            val: doubling, set: setDoubling,
            label: "Ground rent doubles (escalating clause)",
            sub: "Post-2022 Act — doubling clauses cause mortgage refusals and affect resale",
          },
          {
            val: section20, set: setSection20,
            label: "Section 20 notice pending",
            sub: "Major works liability — buyer inherits cost obligation on completion",
          },
          {
            val: arrears, set: setArrears,
            label: "Maintenance / service charge arrears",
            sub: "Seller liable — can delay or block completion if unresolved",
          },
        ].map(({ val, set, label, sub }) => (
          <label key={label} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={val}
              onChange={e => set(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-blue-600"
            />
            <div>
              <p className="text-xs font-semibold text-gray-800">{label}</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">{sub}</p>
            </div>
          </label>
        ))}
      </div>

      {/* ── Extension cost estimator ── */}
      {(yearsNum !== null) && (
        <div className={cn(
          "rounded-xl border p-4",
          extension
            ? urgencyColors[extension.urgency].border + " " + urgencyColors[extension.urgency].bg
            : "border-gray-200 bg-gray-50"
        )}>
          <div className="flex items-start gap-2 mb-3">
            <Calculator className="h-4 w-4 mt-0.5 text-gray-500 shrink-0" />
            <div>
              <p className="text-xs font-bold text-gray-800">Lease Extension Cost Estimator</p>
              {extension && (
                <p className="text-[10px] text-gray-500 mt-0.5">{extension.tier}</p>
              )}
            </div>
          </div>

          {quoteReceived && quoteAmount ? (
            <p className="text-base font-bold text-gray-900">
              Actual quote: {fmtCurrency(parseFloat(quoteAmount))}
            </p>
          ) : extension ? (
            <p className="text-base font-bold text-gray-900">
              {fmtCurrency(extension.low)} – {fmtCurrency(extension.high)}
              <span className="ml-2 text-[10px] font-normal text-gray-400">estimated range</span>
            </p>
          ) : (
            <p className="text-xs text-gray-500 italic">
              Enter property value and lease years to calculate estimate
            </p>
          )}

          {extension && (
            <p className="text-[10px] text-gray-400 mt-1">
              Based on {propValue ? fmtCurrency(propValue) : "estimated"} property value · rule-of-thumb only — get a formal valuation from a RICS chartered surveyor
            </p>
          )}

          <div className="mt-3 pt-3 border-t border-white/60 flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={quoteReceived}
                onChange={e => setQuoteReceived(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-gray-300 accent-blue-600"
              />
              Formal quote received
            </label>
            {quoteReceived && (
              <input
                type="number"
                value={quoteAmount}
                onChange={e => setQuoteAmount(e.target.value)}
                placeholder="Quote amount £"
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide text-gray-500 mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Any additional leasehold notes, title issues, or solicitor observations..."
          rows={2}
          className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
        />
      </div>

      {/* ── Action buttons ── */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
        <button
          onClick={save}
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {isSaving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />
          }
          {isSaving ? "Saving…" : "Save Leasehold Data"}
        </button>
        <a
          href={hmlrUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Check HMLR Title Register
        </a>
        {flagCount > 0 && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full bg-red-100 border border-red-200 px-2.5 py-1 text-[11px] font-bold text-red-700">
            <AlertTriangle className="h-3 w-3" />
            {flagCount} active risk flag{flagCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
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
    freeholds?: {
      inferredTenure: 'freehold' | 'leasehold' | 'unknown'
      resultCount: number
      nearestTitle: { titleNumber: string; titleClass: string; leaseholds: number; distance: string } | null
      nearestTitleDetail?: { ownershipType: string; ownerName?: string; plotSizeAcres: string | null; leaseholdTitleNumbers: string[]; uprns: number[] } | null
      allTitles: Array<{ titleNumber: string; titleClass: string; leaseholds: number; distance: string; polygonId: number }>
    }
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
  const fh             = ownership.freeholds

  const yearsOwned = lastSaleDate
    ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
    : null

  // Effective tenure: Land Registry data takes priority, fallback to PropertyData inferred tenure
  const effectiveTenure = ownership.tenure ?? (
    fh?.inferredTenure === 'freehold' ? 'Freehold (inferred)'
    : fh?.inferredTenure === 'leasehold' ? 'Leasehold (inferred)'
    : null
  )

  const hmlrTitleUrl = (tn: string) =>
    `https://eservices.land-registry.gov.uk/eservices/FindAProperty/view/QuickEnquiryInit.do?title_no=${tn}`

  return (
    <div className="p-5 space-y-4 overflow-y-auto">
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-0.5">Ownership Intelligence</h3>
        <p className="text-xs text-gray-500">Land Registry, Companies House &amp; PropertyData /freeholds</p>
      </div>

      {/* Key ownership stats */}
      <div className="grid grid-cols-2 gap-3">
        {effectiveTenure && (
          <div className={cn(
            "rounded-xl border p-3",
            effectiveTenure.toLowerCase().includes('leasehold') ? "border-amber-200 bg-amber-50" : "border-green-200 bg-green-50"
          )}>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1">Tenure</p>
            <p className={cn(
              "text-sm font-bold capitalize",
              effectiveTenure.toLowerCase().includes('leasehold') ? "text-amber-800" : "text-green-800"
            )}>{effectiveTenure}</p>
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

      {/* Freehold Titles section */}
      {fh && fh.allTitles.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
              Freehold Titles at Postcode
            </p>
            <span className="text-[10px] text-gray-400">
              {fh.resultCount} found · showing {fh.allTitles.length}
            </span>
          </div>

          {/* Tenure inference */}
          {fh.inferredTenure !== 'unknown' && (
            <div className={cn(
              "rounded-lg border px-3 py-2 text-xs flex items-center gap-2",
              fh.inferredTenure === 'leasehold'
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-green-200 bg-green-50 text-green-800"
            )}>
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <span className="font-semibold capitalize">{fh.inferredTenure}</span>
                {fh.inferredTenure === 'leasehold'
                  ? ` — ${fh.nearestTitle?.leaseholds} leasehold unit${(fh.nearestTitle?.leaseholds ?? 0) !== 1 ? 's' : ''} under nearest freehold`
                  : ' — nearest freehold has no sub-leases'}
              </span>
            </div>
          )}

          {/* Nearest title card */}
          {fh.nearestTitle && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-blue-800">{fh.nearestTitle.titleNumber}</span>
                  <span className="ml-2 text-blue-600">{fh.nearestTitle.titleClass.replace('Absolute ', '')}</span>
                </div>
                <a
                  href={hmlrTitleUrl(fh.nearestTitle.titleNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline flex items-center gap-1 font-medium"
                >
                  <ExternalLink className="h-3 w-3" />HMLR
                </a>
              </div>
              <p className="text-blue-600">
                {fh.nearestTitle.leaseholds > 0
                  ? `${fh.nearestTitle.leaseholds} leaseholds registered`
                  : 'No sub-leases'}
                {' · '}{fh.nearestTitle.distance === '0.00' ? 'At postcode' : `${fh.nearestTitle.distance}km`}
              </p>
              {/* /title enrichment data */}
              {fh.nearestTitleDetail && (
                <div className="border-t border-blue-200 pt-2 space-y-1.5">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span className="text-blue-500">Freeholder</span>
                    <span className="font-medium text-blue-800">
                      {fh.nearestTitleDetail.ownershipType}
                      {fh.nearestTitleDetail.ownerName && ` — ${fh.nearestTitleDetail.ownerName}`}
                    </span>
                    {fh.nearestTitleDetail.plotSizeAcres && (
                      <>
                        <span className="text-blue-500">Plot</span>
                        <span className="font-medium text-blue-800">{fh.nearestTitleDetail.plotSizeAcres} acres</span>
                      </>
                    )}
                  </div>
                  {fh.nearestTitleDetail.leaseholdTitleNumbers.length > 0 && (
                    <div>
                      <p className="text-blue-500 mb-1">Leasehold titles in building ({fh.nearestTitleDetail.leaseholdTitleNumbers.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {fh.nearestTitleDetail.leaseholdTitleNumbers.slice(0, 10).map((tn) => (
                          <a
                            key={tn}
                            href={hmlrTitleUrl(tn)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 px-1.5 py-0.5 rounded"
                          >
                            {tn}
                          </a>
                        ))}
                        {fh.nearestTitleDetail.leaseholdTitleNumbers.length > 10 && (
                          <span className="text-[10px] text-blue-500 self-center">
                            +{fh.nearestTitleDetail.leaseholdTitleNumbers.length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Other nearby titles */}
          {fh.allTitles.length > 1 && (
            <div className="divide-y divide-gray-100">
              {fh.allTitles.slice(1, 8).map((t) => (
                <div key={t.polygonId} className="flex items-center justify-between py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <a
                      href={hmlrTitleUrl(t.titleNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {t.titleNumber}
                    </a>
                    <span className="text-gray-400">{t.titleClass.replace('Absolute ', '').replace(' title', '')}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400">
                    {t.leaseholds > 0 && <span className="text-amber-600">{t.leaseholds} LH</span>}
                    <span>{t.distance === '0.00' ? '~0km' : `${t.distance}km`}</span>
                  </div>
                </div>
              ))}
              {fh.allTitles.length > 8 && (
                <p className="text-[10px] text-gray-400 pt-2">+{fh.allTitles.length - 8} more titles</p>
              )}
            </div>
          )}
        </div>
      )}
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
    freeholds?: {
      inferredTenure: 'freehold' | 'leasehold' | 'unknown'
      resultCount: number
      nearestTitle: {
        titleNumber: string
        titleClass: string
        leaseholds: number
        distance: string
      } | null
      nearestTitleDetail?: {
        ownershipType: string
        ownerName?: string
        plotSizeAcres: string | null
        leaseholdTitleNumbers: string[]
        uprns: number[]
      } | null
      allTitles: Array<{
        titleNumber: string
        titleClass: string
        leaseholds: number
        distance: string
        polygonId: number
      }>
    }
  } | null | undefined

  // ── Portal listing status ─────────────────────────────────────────────────
  const portalRaw    = lead.latestPortalCheck?.portalCheckRaw as any
  const isListed     = !!(portalRaw?.activeListing)
  const allFlags     = (lead.latestPortalCheck?.summaryFlags as Array<{ severity: string }>) ?? []
  const riskFlags    = allFlags.filter(f => f.severity === "caution" || f.severity === "red_flag")
  const infoFlags    = allFlags.filter(f => f.severity === "clear")
  const flagCount    = allFlags.length
  const riskFlagCount = riskFlags.length
  const hasFlags     = riskFlagCount > 0   // amber only for actual risk flags

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
            <p className={config.subClass}>
              {risk === "clear"
                ? riskFlagCount > 0
                  ? `${riskFlagCount} risk flag${riskFlagCount > 1 ? "s" : ""}`
                  : infoFlags.length > 0
                    ? `${infoFlags.length} info flag${infoFlags.length > 1 ? "s" : ""}`
                    : "No flags found"
                : config.subtitle}
            </p>
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
            {lead.latestPortalCheck
              ? hasFlags
                ? `${riskFlagCount} risk flag${riskFlagCount > 1 ? "s" : ""}`
                : infoFlags.length > 0
                  ? `${infoFlags.length} info ✓`
                  : "None ✓"
              : "—"}
          </span>
        </div>

        {/* Last checked */}
        <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
          <span className="text-[10px] text-slate-400">Last checked</span>
          <span className="text-[11px] font-bold text-slate-300">{lastChecked}</span>
        </div>

        {/* Tenure / Leasehold */}
        {(() => {
          const t = (lead.tenureType ?? (lead.latestPortalCheck?.ownershipCheckRaw as any)?.tenure as string | null ?? null)?.toLowerCase()
          const ld = lead.leaseholdData as any
          const yr = ld?.yearsRemaining as number | null
          const isFH = t?.includes("freehold") && !t?.includes("leasehold")
          const isLH = t?.includes("leasehold")
          const lhColor =
            !isLH           ? null :
            !yr             ? "bg-green-500/10 border-green-500/20 text-green-400" :  // confirmed leasehold, years TBC
            yr < 70         ? "bg-red-500/10 border-red-500/20 text-red-400" :
            yr < 85         ? "bg-amber-500/10 border-amber-500/20 text-amber-400" :
                              "bg-green-500/10 border-green-500/20 text-green-400"
          const lhLabel =
            isFH            ? "Freehold ✓" :
            isLH && yr      ? `Leasehold ${yr}yr${yr < 70 ? " ⛔" : yr < 85 ? " ⚠" : " ✓"}` :
            isLH            ? "Leasehold (enter terms)" :
                              "Tenure unknown"
          return (
            <div
              className={cn(
                "flex items-center justify-between rounded-lg border px-3 py-2 cursor-pointer",
                isFH ? "bg-green-500/10 border-green-500/20" :
                lhColor || "bg-white/5 border-white/10"
              )}
              onClick={() => {}}
              title="Click Leasehold tab for full details"
            >
              <span className="text-[10px] text-slate-400">Tenure</span>
              <span className={cn(
                "text-[11px] font-bold",
                isFH ? "text-green-400" :
                lhColor?.includes("red") ? "text-red-400" :
                lhColor?.includes("amber") ? "text-amber-400" :
                lhColor?.includes("green") ? "text-green-400" :
                "text-slate-400"
              )}>
                {t ? lhLabel : "—"}
              </span>
            </div>
          )
        })()}
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
  // Leasehold tab badge — show warning dot when leasehold with short lease or flags
  const ld = lead.leaseholdData as any
  const lhYears = ld?.yearsRemaining as number | null
  const lhFlagCount = [ld?.isGroundRentDoubling, ld?.isSection20Pending, ld?.hasMaintenanceArrears].filter(Boolean).length
  const tenureLower = (lead.tenureType ?? (lead.latestPortalCheck?.ownershipCheckRaw as any)?.tenure as string | null ?? "").toLowerCase()
  const showLeaseholdWarning = tenureLower.includes("leasehold") && (!lhYears || lhYears < 85 || lhFlagCount > 0)

  const tabs: { id: Tab; label: string; dot?: string }[] = [
    { id: "portal",    label: "Portal" },
    { id: "ownership", label: "Ownership" },
    { id: "history",   label: "History" },
    { id: "leasehold", label: "Leasehold", dot: showLeaseholdWarning ? (lhYears && lhYears < 70 ? "bg-red-500" : "bg-amber-400") : undefined },
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
                "relative px-4 pb-3 text-sm font-semibold transition-colors border-b-2 -mb-px flex items-center gap-1.5",
                activeTab === tab.id
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              {tab.label}
              {tab.dot && (
                <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", tab.dot)} />
              )}
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
        {activeTab === "leasehold" && (
          <LeaseholdTab lead={lead} onSaved={onRiskUpdated ? () => onRiskUpdated(lead.latestCheckRisk, lead.latestCheckedAt ?? null) : undefined} />
        )}
      </div>
    </ModalShell>
  )
}
