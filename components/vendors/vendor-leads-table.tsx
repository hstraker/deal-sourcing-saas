"use client"

/**
 * VendorLeadsTable — Lendlord.io-style vendor leads listing.
 *
 * Design reference: Clean Light (Lendlord.io)
 *  - White content area, #f9fafb table headers
 *  - Blue underline active tab (#2563eb)
 *  - Pill badges for status indicators
 *  - Monospace numerics
 *  - Row hover #f3f4f6, action buttons fade in on hover
 *
 * Tabs: Map View | Property Details | Portal Check | Validation | Comparable | Offer Analysis
 */

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  MapPin,
  Eye,
  Pencil,
  Archive,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
  RefreshCw,
  Plus,
  X,
  BarChart2,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type ProcessingStatus = "PENDING" | "RUNNING" | "COMPLETE" | "FAILED"

type PipelineStage =
  | "NEW_LEAD"
  | "AI_CONVERSATION"
  | "DEAL_VALIDATION"
  | "OFFER_MADE"
  | "OFFER_ACCEPTED"
  | "OFFER_REJECTED"
  | "VIDEO_SENT"
  | "RETRY_1"
  | "RETRY_2"
  | "RETRY_3"
  | "PAPERWORK_SENT"
  | "READY_FOR_INVESTORS"
  | "DEAD_LEAD"

interface OfferRetry {
  retryNumber: number
  originalOfferAmount: string | number | null
  adjustedOfferAmount: string | number | null
  sentAt: string | null
}

interface LatestPortalCheck {
  overallRisk: string
  summaryFlags: unknown[]
  portalCheckRaw: Record<string, unknown> | null
  checkStatus: string
}

interface VendorLead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyPostcodeFixed: boolean
  propertyPostcodeSource: string | null
  askingPrice: string | number | null
  propertyType: string | null
  tenureType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  condition: string | null
  estimatedMonthlyRent: string | number | null
  estimatedAnnualRent: string | number | null
  localAverageRent: string | number | null
  estimatedMarketValue: string | number | null
  bmvScore: string | number | null
  comparablesCount: number | null
  avgComparablePrice: string | number | null
  offerAmount: string | number | null
  offerPercentage: string | number | null
  offerSentAt: string | null
  retryCount: number
  pipelineStage: PipelineStage
  processingStatus: ProcessingStatus
  latestCheckRisk: string | null
  latestCheckedAt: string | null
  bmvValidatedAt: string | null
  portalCheckedAt: string | null
  archivedAt: string | null
  createdAt: string
  isTest: boolean
  lockoutAgreementSent: boolean
  latestPortalCheck: LatestPortalCheck | null
  offerRetries: OfferRetry[]
}

type TabId = "map-view" | "property-details" | "portal-check" | "validation" | "comparable" | "offer-analysis"

type PortalSource = "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

function fmtPercent(v: string | number | null | undefined, decimals = 1): string {
  const n = toNum(v)
  if (n === null) return "—"
  return `${n.toFixed(decimals)}%`
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })
}

/** Parse per-portal status from the portalCheckRaw JSON */
function getPortalStatus(lead: VendorLead, portal: PortalSource): "listed" | "clear" | "blocked" | null {
  const raw = lead.latestPortalCheck?.portalCheckRaw
  if (!raw) return null
  const liveResults = (raw as any).livePortalResults as Array<{
    source: PortalSource
    status: string
    matchedListings?: unknown[]
  }> | undefined
  if (!liveResults) return null
  const r = liveResults.find((x) => x.source === portal)
  if (!r) return null
  if (r.status === "success" && Array.isArray(r.matchedListings) && r.matchedListings.length > 0) return "listed"
  if (r.status === "no_listings") return "clear"
  if (r.status === "blocked") return "blocked"
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge / Pill Components
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<PipelineStage, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "Conversation",
  DEAL_VALIDATION: "Validation",
  OFFER_MADE: "Offer Made",
  OFFER_ACCEPTED: "Accepted",
  OFFER_REJECTED: "Rejected",
  VIDEO_SENT: "Video Sent",
  RETRY_1: "Retry 1",
  RETRY_2: "Retry 2",
  RETRY_3: "Retry 3",
  PAPERWORK_SENT: "Paperwork",
  READY_FOR_INVESTORS: "Ready",
  DEAD_LEAD: "Dead",
}

const STAGE_STYLE: Record<PipelineStage, string> = {
  NEW_LEAD: "bg-blue-100 text-blue-700",
  AI_CONVERSATION: "bg-violet-100 text-violet-700",
  DEAL_VALIDATION: "bg-amber-100 text-amber-700",
  OFFER_MADE: "bg-emerald-100 text-emerald-700",
  OFFER_ACCEPTED: "bg-green-100 text-green-700",
  OFFER_REJECTED: "bg-red-100 text-red-700",
  VIDEO_SENT: "bg-sky-100 text-sky-700",
  RETRY_1: "bg-orange-100 text-orange-700",
  RETRY_2: "bg-orange-100 text-orange-700",
  RETRY_3: "bg-orange-100 text-orange-700",
  PAPERWORK_SENT: "bg-teal-100 text-teal-700",
  READY_FOR_INVESTORS: "bg-green-100 text-green-700",
  DEAD_LEAD: "bg-gray-100 text-gray-500",
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", STAGE_STYLE[stage])}>
      {STAGE_LABEL[stage]}
    </span>
  )
}

function PortalPill({ status }: { status: "listed" | "clear" | "blocked" | null }) {
  if (status === "listed")
    return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Listed</span>
  if (status === "clear")
    return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Clear</span>
  if (status === "blocked")
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Blocked</span>
  return <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">—</span>
}

function RiskBadge({ risk }: { risk: string | null }) {
  if (risk === "clear")
    return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Not Listed</span>
  if (risk === "caution")
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Partial</span>
  if (risk === "red_flag")
    return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Listed</span>
  return <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400">Pending</span>
}

function BmvCell({ value }: { value: string | number | null | undefined }) {
  const n = toNum(value)
  if (n === null)
    return <span className="font-mono text-gray-400">—</span>
  const cls =
    n >= 15 ? "text-green-700 font-bold" :
    n >= 10 ? "text-amber-600 font-bold" :
               "text-red-600 font-bold"
  return <span className={cn("font-mono text-xs", cls)}>{n.toFixed(1)}%</span>
}

function ProcessingIcon({ status }: { status: ProcessingStatus }) {
  switch (status) {
    case "RUNNING":
      return <Loader2 className="inline h-3.5 w-3.5 animate-spin text-blue-500" />
    case "COMPLETE":
      return <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500" />
    case "FAILED":
      return <XCircle className="inline h-3.5 w-3.5 text-red-500" />
    default:
      return <Minus className="inline h-3.5 w-3.5 text-gray-300" />
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// KPI Bar
// ─────────────────────────────────────────────────────────────────────────────

interface Kpis {
  total: number
  avgBmv: number | null
  portalPassRate: number | null
  processing: number
}

function computeKpis(leads: VendorLead[]): Kpis {
  const active = leads.filter((l) => !l.archivedAt)
  const bmvLeads = active.filter((l) => toNum(l.bmvScore) !== null)
  const avgBmv =
    bmvLeads.length > 0
      ? bmvLeads.reduce((acc, l) => acc + toNum(l.bmvScore)!, 0) / bmvLeads.length
      : null

  const checkedLeads = active.filter((l) => l.latestCheckRisk !== null)
  const clearLeads = checkedLeads.filter((l) => l.latestCheckRisk === "clear")
  const portalPassRate = checkedLeads.length > 0 ? (clearLeads.length / checkedLeads.length) * 100 : null

  return {
    total: active.length,
    avgBmv,
    portalPassRate,
    processing: active.filter((l) => l.processingStatus === "RUNNING").length,
  }
}

function KpiBar({ kpis }: { kpis: Kpis }) {
  return (
    <div className="flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Total Leads */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Users className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-gray-900">{kpis.total}</p>
          <p className="text-xs text-gray-500">Total Leads</p>
        </div>
      </div>

      {/* Avg BMV % */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50">
          <TrendingUp className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#16a34a" }}>
            {kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500">Avg BMV %</p>
        </div>
      </div>

      {/* Portal Pass Rate */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <BarChart2 className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#2563eb" }}>
            {kpis.portalPassRate !== null ? `${kpis.portalPassRate.toFixed(0)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500">Portal Pass Rate</p>
        </div>
      </div>

      {/* Processing */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <Zap className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#d97706" }}>
            {kpis.processing}
          </p>
          <p className="text-xs text-gray-500">Processing</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab Bar
// ─────────────────────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "map-view", label: "Map View" },
  { id: "property-details", label: "Property Details" },
  { id: "portal-check", label: "Portal Check" },
  { id: "validation", label: "Validation" },
  { id: "comparable", label: "Comparable" },
  { id: "offer-analysis", label: "Offer Analysis" },
]

function TabBar({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  return (
    <div className="overflow-x-auto border-b border-gray-200 bg-white">
      <div className="flex min-w-max">
        {TABS.map((tab) => {
          const isActive = tab.id === active
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={cn(
                "whitespace-nowrap px-4 py-3 text-[13px] font-medium transition-colors",
                isActive
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "border-b-2 border-transparent text-gray-400 hover:text-gray-600",
                "-mb-px" // overlap tab bar bottom border
              )}
              style={{ marginBottom: "-1px" }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table header helpers
// ─────────────────────────────────────────────────────────────────────────────

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400",
        className
      )}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("px-4 py-[11px] text-sm text-gray-700", className)}>
      {children}
    </td>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sticky cells
// ─────────────────────────────────────────────────────────────────────────────

/** Sticky-left vendor name cell (with pin icon + processing indicator) */
function VendorNameCell({ lead }: { lead: VendorLead }) {
  return (
    <td className="sticky left-0 z-10 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-900">{lead.vendorName}</span>
            <ProcessingIcon status={lead.processingStatus} />
          </div>
          <p className="truncate text-xs text-gray-400">{lead.vendorPhone}</p>
        </div>
      </div>
    </td>
  )
}

/** Sticky-right actions cell */
function ActionsCell({
  lead,
  onView,
  onArchive,
  onDelete,
}: {
  lead: VendorLead
  onView: () => void
  onArchive: () => void
  onDelete: () => void
}) {
  return (
    <td className="sticky right-0 z-10 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <ActionBtn icon={Eye} title="View" onClick={onView} />
        <ActionBtn icon={Pencil} title="Edit" onClick={() => {}} />
        <ActionBtn icon={Archive} title="Archive" onClick={onArchive} />
        <ActionBtn
          icon={Trash2}
          title="Delete"
          onClick={onDelete}
          danger
        />
      </div>
    </td>
  )
}

function ActionBtn({
  icon: Icon,
  title,
  onClick,
  danger,
}: {
  icon: React.ElementType
  title: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700",
        danger && "hover:border-red-300 hover:bg-red-50 hover:text-red-600"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Map Modal
// ─────────────────────────────────────────────────────────────────────────────

function MapModal({ lead, onClose }: { lead: VendorLead; onClose: () => void }) {
  const address = lead.propertyAddress ?? ""
  const encoded = encodeURIComponent(address)
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "AIzaSyD6MwJAklX9Tva6O_yZsSZxSXEgRUVMaRI"
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative mx-4 w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h3 className="font-semibold text-gray-900">{lead.vendorName}</h3>
            <p className="mt-0.5 text-sm text-gray-500">{lead.propertyAddress ?? "No address"}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Map */}
        <iframe
          src={src}
          width="100%"
          height="400"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block border-0"
          title={`Map: ${address}`}
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tab Row renderers
// ─────────────────────────────────────────────────────────────────────────────

function MapViewRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  return (
    <tr
      className="group cursor-pointer border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]"
      onClick={onRowClick}
    >
      <VendorNameCell lead={lead} />
      <Td className="max-w-[220px]">
        <p className="truncate">{lead.propertyAddress ?? <span className="text-gray-400">—</span>}</p>
      </Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function PropertyDetailsRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
      <Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td>{lead.tenureType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.estimatedMarketValue)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.estimatedMonthlyRent)}/mo</span></Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <Td>
        {lead.bedrooms !== null ? `${lead.bedrooms}` : "—"}
        {lead.bathrooms !== null ? ` / ${lead.bathrooms}` : ""}
      </Td>
      <Td>{lead.condition ?? "—"}</Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function PortalCheckRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  const raw = lead.latestPortalCheck?.portalCheckRaw as any
  const ownership = raw?.ownershipCheckRaw
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
      <Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><PortalPill status={getPortalStatus(lead, "RIGHTMOVE")} /></Td>
      <Td><PortalPill status={getPortalStatus(lead, "ZOOPLA")} /></Td>
      <Td><PortalPill status={getPortalStatus(lead, "ONTHEMARKET")} /></Td>
      <Td><PortalPill status={getPortalStatus(lead, "PRIMELOCATION")} /></Td>
      <Td>
        {ownership?.ownerName
          ? <span className="text-xs text-gray-700">{ownership.ownerName}</span>
          : <span className="text-xs text-gray-400">—</span>}
      </Td>
      <Td>{lead.tenureType ?? "—"}</Td>
      <Td>{ownership?.ownerType ?? "—"}</Td>
      <Td className="max-w-[120px]">
        <p className="truncate text-xs">{ownership?.companyName ?? "—"}</p>
      </Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function ValidationRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  // Gross monthly cashflow ≈ rent - 20% expenses
  const rentNum = toNum(lead.estimatedMonthlyRent)
  const cashflow = rentNum ? rentNum * 0.8 : null

  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
      <Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.localAverageRent)}/mo</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.avgComparablePrice)}</span></Td>
      <Td>
        <span className="font-mono text-xs">
          {lead.estimatedAnnualRent && lead.askingPrice
            ? fmtPercent((toNum(lead.estimatedAnnualRent)! / toNum(lead.askingPrice)!) * 100)
            : "—"}
        </span>
      </Td>
      <Td><span className="font-mono text-xs">{lead.comparablesCount ?? "—"}</span></Td>
      <Td><span className="font-mono text-xs">{cashflow ? fmtCurrency(cashflow) : "—"}</span></Td>
      <Td className="text-xs text-gray-400">—</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.estimatedMonthlyRent)}/mo</span></Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function ComparableRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const yieldPct = annualRent && price ? (annualRent / price) * 100 : null

  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
      <Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{lead.comparablesCount ?? "—"}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.localAverageRent)}/mo</span></Td>
      <Td><span className="font-mono text-xs">{yieldPct ? fmtPercent(yieldPct) : "—"}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.avgComparablePrice)}</span></Td>
      <Td className="text-xs text-gray-400">—</Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function OfferAnalysisRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  // Derive initial / next / final from offerRetries + offerAmount
  const retries = lead.offerRetries ?? []
  const initialOffer = retries.length > 0 ? retries[0].originalOfferAmount : lead.offerAmount
  const nextOffer = retries.length > 1 ? (retries[1].adjustedOfferAmount ?? retries[1].originalOfferAmount) : null
  const finalOffer = retries.length > 0 ? (retries[retries.length - 1].adjustedOfferAmount ?? lead.offerAmount) : lead.offerAmount
  const numOffers = (lead.retryCount ?? 0) + (lead.offerAmount ? 1 : 0)
  const emailSent = lead.offerSentAt !== null || lead.lockoutAgreementSent

  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
      <Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(initialOffer)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(nextOffer)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(finalOffer)}</span></Td>
      <Td><span className="font-mono text-xs">{numOffers || "—"}</span></Td>
      <Td>
        {emailSent
          ? <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Sent</span>
          : <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Pending</span>}
      </Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Table headers per tab
// ─────────────────────────────────────────────────────────────────────────────

interface RowRendererProps {
  lead: VendorLead
  onRowClick: () => void
  onView: () => void
  onArchive: () => void
  onDelete: () => void
}

function TableHeaders({ tab }: { tab: TabId }) {
  const stickyLeft = <Th className="sticky left-0 z-10 bg-[#f9fafb]">Vendor Name</Th>
  const stickyRight = <Th className="sticky right-0 z-10 bg-[#f9fafb]">Actions</Th>

  switch (tab) {
    case "map-view":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Postcode</Th><Th>Type</Th><Th>Status</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "property-details":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Status</Th><Th>Postcode</Th><Th>Type</Th><Th>Tenure</Th>
        <Th>Asking Price</Th><Th>Market Value</Th><Th>Rental</Th><Th>BMV %</Th>
        <Th>Bed/Bath</Th><Th>Finish</Th>
        {stickyRight}
      </tr>

    case "portal-check":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Rightmove</Th><Th>Zoopla</Th><Th>OnTheMarket</Th><Th>Primelocation</Th>
        <Th>Ownership</Th><Th>Tenure</Th><Th>Owner Type</Th><Th>Company</Th>
        {stickyRight}
      </tr>

    case "validation":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>AVG Rental</Th><Th>Asking Price</Th><Th>AVG Sale Price</Th><Th>AVG Yield</Th>
        <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC Due</Th><Th>EST Rental</Th>
        {stickyRight}
      </tr>

    case "comparable":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>No. Comps</Th><Th>AVG Rental</Th><Th>AVG Yield</Th><Th>AVG Sale Price</Th>
        <Th>Range</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "offer-analysis":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        <Th>Address</Th><Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Asking Price</Th><Th>Initial Offer</Th><Th>Next Offer</Th><Th>Final Offer</Th>
        <Th>No. Offers</Th><Th>Email Sent</Th>
        {stickyRight}
      </tr>

    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function VendorLeadsTable() {
  const router = useRouter()
  const [leads, setLeads] = useState<VendorLead[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>("map-view")
  const [mapLead, setMapLead] = useState<VendorLead | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/vendor-pipeline/leads?limit=200")
      if (!res.ok) throw new Error("Failed to fetch leads")
      const data = await res.json()
      setLeads(data.leads ?? [])
    } catch {
      toast.error("Failed to load vendor leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // ── Poll RUNNING leads every 3 seconds ────────────────────────────────────
  useEffect(() => {
    const runningLeads = leads.filter((l) => l.processingStatus === "RUNNING")

    if (runningLeads.length === 0) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      return
    }

    if (!pollingRef.current) {
      pollingRef.current = setInterval(async () => {
        const updates = await Promise.allSettled(
          runningLeads.map((l) =>
            fetch(`/api/vendors/${l.id}/processing-status`).then((r) => r.json())
          )
        )

        setLeads((prev) => {
          const next = [...prev]
          updates.forEach((result, i) => {
            if (result.status === "fulfilled" && result.value) {
              const idx = next.findIndex((l) => l.id === runningLeads[i].id)
              if (idx !== -1) {
                next[idx] = { ...next[idx], ...result.value }
              }
            }
          })
          return next
        })
      }, 3000)
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [leads])

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleArchive = async (leadId: string) => {
    try {
      await fetch(`/api/vendor-pipeline/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archivedAt: new Date().toISOString() }),
      })
      setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, archivedAt: new Date().toISOString() } : l))
      toast.success("Lead archived")
    } catch {
      toast.error("Failed to archive lead")
    }
  }

  const handleDelete = async (leadId: string) => {
    if (!confirm("Permanently delete this lead? This cannot be undone.")) return
    try {
      await fetch(`/api/vendor-pipeline/leads/${leadId}`, { method: "DELETE" })
      setLeads((prev) => prev.filter((l) => l.id !== leadId))
      toast.success("Lead deleted")
    } catch {
      toast.error("Failed to delete lead")
    }
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const kpis = computeKpis(leads)
  const visibleLeads = leads.filter((l) => !l.archivedAt)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-0">
      {/* KPI Bar */}
      <div className="mb-4">
        <KpiBar kpis={kpis} />
      </div>

      {/* Tab bar + table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Toolbar row above tab bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <p className="text-sm text-gray-500">
            {visibleLeads.length} lead{visibleLeads.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLeads}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 hover:text-gray-700"
              title="Refresh"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => router.push("/dashboard/vendors/new")}
              className="flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Lead
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        <TabBar active={activeTab} onChange={setActiveTab} />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse bg-white text-sm">
            <thead>
              <TableHeaders tab={activeTab} />
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={20} className="py-16 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-gray-300" />
                  </td>
                </tr>
              )}

              {!loading && visibleLeads.length === 0 && (
                <tr>
                  <td colSpan={20} className="py-16 text-center text-sm text-gray-400">
                    No vendor leads found
                  </td>
                </tr>
              )}

              {visibleLeads.map((lead) => {
                const rowProps: RowRendererProps = {
                  lead,
                  onRowClick: () => {
                    if (activeTab === "map-view") setMapLead(lead)
                  },
                  onView: () => router.push(`/dashboard/vendors/${lead.id}`),
                  onArchive: () => handleArchive(lead.id),
                  onDelete: () => handleDelete(lead.id),
                }

                switch (activeTab) {
                  case "map-view":         return <MapViewRow key={lead.id} {...rowProps} />
                  case "property-details": return <PropertyDetailsRow key={lead.id} {...rowProps} />
                  case "portal-check":     return <PortalCheckRow key={lead.id} {...rowProps} />
                  case "validation":       return <ValidationRow key={lead.id} {...rowProps} />
                  case "comparable":       return <ComparableRow key={lead.id} {...rowProps} />
                  case "offer-analysis":   return <OfferAnalysisRow key={lead.id} {...rowProps} />
                  default:                 return null
                }
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        {!loading && leads.some((l) => l.processingStatus === "RUNNING") && (
          <div className="flex items-center justify-end border-t border-gray-100 px-4 py-2 text-xs text-blue-600">
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Auto-refreshing…
          </div>
        )}
      </div>

      {/* Map Modal */}
      {mapLead && <MapModal lead={mapLead} onClose={() => setMapLead(null)} />}
    </div>
  )
}
