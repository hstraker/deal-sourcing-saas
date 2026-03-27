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
  BarChart2,
  TrendingUp,
  Users,
  Zap,
  ShieldCheck,
  Calculator,
  GitCompare,
  Kanban,
  Table2,
  Clock,
  Sparkles,
  MessageCircle,
  ScanLine,
  Send,
  Video,
  FileText,
  Rocket,
  Ban,
  Lock,
  ListChecks,
  BadgeCheck,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { VendorPipelineKanbanBoard } from "./vendor-pipeline-kanban-board"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { PropertyDetailsModal } from "./property-details-modal"
import { MapModal } from "./map-modal"
import { PortalCheckModal } from "./portal-check-modal"
import { ValidationModal } from "./validation-modal"
import { ComparableModal } from "./comparable-modal"
import { OfferAnalysisModal } from "./offer-analysis-modal"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { KpiBar, type KpiTile } from "@/components/ui/kpi-bar"
import { StatusBadge } from "@/components/ui/status-badge"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"

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

type UrgencyLevel = "urgent" | "quick" | "moderate" | "flexible"
type ReasonForSale = "relocation" | "financial" | "divorce" | "inheritance" | "downsize" | "other"

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
  ownershipCheckRaw: Record<string, unknown> | null
  checkStatus: string
}

export interface VendorLead {
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
  validationPassed: boolean | null
  validationNotes: string | null
  profitPotential: string | number | null
  estimatedRefurbCost: string | number | null
  dealId: string | null
  epcRating: string | null
  epcScore: number | null
  epcInspectionDate: string | null   // ISO string from API
  latestPortalCheck: LatestPortalCheck | null
  offerRetries: OfferRetry[]
  motivationScore: number | null
  urgencyLevel: UrgencyLevel | null
  reasonForSelling: ReasonForSale | null
  competingOffers: boolean
  timelineDays: number | null
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

type LiveResultItem = {
  source: PortalSource
  status: string
  matchedListings?: unknown[]
}

function getLiveResult(lead: VendorLead, portal: PortalSource): LiveResultItem | null {
  const raw = lead.latestPortalCheck?.portalCheckRaw
  if (!raw) return null
  const liveResults = (raw as any).liveResults as LiveResultItem[] | undefined
  return liveResults?.find((x) => x.source === portal) ?? null
}

/** Parse per-portal status from the portalCheckRaw JSON */
function getPortalStatus(lead: VendorLead, portal: PortalSource): "listed" | "clear" | "blocked" | null {
  const r = getLiveResult(lead, portal)
  if (!r) return null
  if (r.status === "blocked") return "blocked"
  if (r.status === "error") return null
  if (r.status === "no_listings") return "clear"
  if (r.status === "success") {
    return Array.isArray(r.matchedListings) && r.matchedListings.length > 0 ? "listed" : "clear"
  }
  return null
}

function getPortalMatchCount(lead: VendorLead, portal: PortalSource): number {
  const r = getLiveResult(lead, portal)
  return r?.matchedListings?.length ?? 0
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip helper
// ─────────────────────────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-center text-[11px] leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Badge / Pill Components
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<PipelineStage, string> = {
  NEW_LEAD:             "New Lead",
  AI_CONVERSATION:      "In Conversation",
  DEAL_VALIDATION:      "Validating",
  OFFER_MADE:           "Offer Sent",
  OFFER_ACCEPTED:       "Accepted",
  OFFER_REJECTED:       "Rejected",
  VIDEO_SENT:           "Video Sent",
  RETRY_1:              "Retry 1",
  RETRY_2:              "Retry 2",
  RETRY_3:              "Retry 3",
  PAPERWORK_SENT:       "Paperwork",
  READY_FOR_INVESTORS:  "Ready to List",
  DEAD_LEAD:            "Dead Lead",
}

const STAGE_ICON: Record<PipelineStage, LucideIcon> = {
  NEW_LEAD:            Sparkles,
  AI_CONVERSATION:     MessageCircle,
  DEAL_VALIDATION:     ScanLine,
  OFFER_MADE:          Send,
  OFFER_ACCEPTED:      CheckCircle2,
  OFFER_REJECTED:      XCircle,
  VIDEO_SENT:          Video,
  RETRY_1:             RefreshCw,
  RETRY_2:             RefreshCw,
  RETRY_3:             RefreshCw,
  PAPERWORK_SENT:      FileText,
  READY_FOR_INVESTORS: Rocket,
  DEAD_LEAD:           Ban,
}

const STAGE_DESC: Record<PipelineStage, string> = {
  NEW_LEAD:             "Just added — not yet processed",
  AI_CONVERSATION:      "AI is actively engaging the vendor",
  DEAL_VALIDATION:      "Running BMV & market value checks",
  OFFER_MADE:           "Offer calculated and ready to send",
  OFFER_ACCEPTED:       "Vendor accepted the offer",
  OFFER_REJECTED:       "Vendor rejected the offer",
  VIDEO_SENT:           "Educational video sent to vendor",
  RETRY_1:              "First follow-up offer sent",
  RETRY_2:              "Second follow-up offer sent",
  RETRY_3:              "Third follow-up offer sent",
  PAPERWORK_SENT:       "Legal paperwork sent to vendor",
  READY_FOR_INVESTORS:  "Validated deal ready to show investors",
  DEAD_LEAD:            "Lead closed — not proceeding",
}

function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <StatusBadge
      label={STAGE_LABEL[stage]}
      cssKey={getPipelineStageVarKey(stage)}
      tooltip={STAGE_DESC[stage]}
      icon={STAGE_ICON[stage]}
    />
  )
}

const PORTAL_PILL_DESC: Record<"listed" | "clear" | "blocked" | "none", string> = {
  listed:  "Property found on this portal — vendor may be testing the market",
  clear:   "No active listings found — property not currently for sale publicly",
  blocked: "Portal blocked our check — manual verification may be needed",
  none:    "Portal check not yet run for this lead",
}

function PortalPill({ status, matchCount }: { status: "listed" | "clear" | "blocked" | null; matchCount?: number }) {
  const desc = PORTAL_PILL_DESC[status ?? "none"]
  if (status === "listed")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 cursor-default">
          Listed{matchCount && matchCount > 0 ? ` (${matchCount})` : ""}
        </span>
      </Tip>
    )
  if (status === "clear")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Clear</span>
      </Tip>
    )
  if (status === "blocked")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 cursor-default">Blocked</span>
      </Tip>
    )
  return (
    <Tip text={desc}>
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">—</span>
    </Tip>
  )
}

const RISK_DESC: Record<string, string> = {
  clear:     "No portals found this property listed — safe to proceed",
  caution:   "Property found on some portals — review carefully before offering",
  red_flag:  "Property actively listed on portals — vendor may have other agents",
  pending:   "Portal check not yet run for this lead",
}

function RiskBadge({ risk }: { risk: string | null }) {
  const desc = RISK_DESC[risk ?? "pending"] ?? "Unknown status"
  if (risk === "clear")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Not Listed</span>
      </Tip>
    )
  if (risk === "caution")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 cursor-default">Partial</span>
      </Tip>
    )
  if (risk === "red_flag")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 cursor-default">Listed</span>
      </Tip>
    )
  return (
    <Tip text={desc}>
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">Pending</span>
    </Tip>
  )
}

// EPC rating colour map — UK convention: A/B=green, C=lime, D=yellow, E=amber, F/G=red
const EPC_COLOUR: Record<string, string> = {
  A: "bg-green-700 text-white",
  B: "bg-green-500 text-white",
  C: "bg-lime-500 text-white",
  D: "bg-yellow-400 text-gray-900",
  E: "bg-amber-500 text-white",
  F: "bg-orange-600 text-white",
  G: "bg-red-700 text-white",
}

function EpcRatingBadge({ rating, score, inspectionDate }: {
  rating: string | null
  score: number | null
  inspectionDate: string | null
}) {
  if (!rating) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">
        —
      </span>
    )
  }

  const colourCls = EPC_COLOUR[rating.toUpperCase()] ?? "bg-gray-200 text-gray-700"
  const expiryDate = inspectionDate
    ? new Date(new Date(inspectionDate).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000)
    : null
  const tooltipText = [
    score !== null ? `Score: ${score}/100` : null,
    inspectionDate ? `Inspected: ${fmtDate(inspectionDate)}` : null,
    expiryDate ? `Expires: ${fmtDate(expiryDate.toISOString())}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const badge = (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-bold cursor-default", colourCls)}>
      {rating.toUpperCase()}
    </span>
  )

  return tooltipText ? <Tip text={tooltipText}>{badge}</Tip> : badge
}

/** Returns the expiry date string (inspection + 10 years) with a tooltip, or "—" */
function EpcDueCell({ rating, score, inspectionDate }: {
  rating: string | null
  score: number | null
  inspectionDate: string | null
}) {
  if (!inspectionDate) {
    return <span className="font-mono text-xs text-gray-400">—</span>
  }

  const expiry = new Date(new Date(inspectionDate).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000)
  const isExpired = expiry < new Date()
  const tooltipText = [
    score !== null ? `Score: ${score}/100` : null,
    rating ? `Rating: ${rating.toUpperCase()}` : null,
    `Inspected: ${fmtDate(inspectionDate)}`,
  ]
    .filter(Boolean)
    .join(" · ")

  const label = (
    <span className={`font-mono text-xs ${isExpired ? "text-red-600 font-semibold" : "text-gray-700"}`}>
      {fmtDate(expiry.toISOString())}
      {isExpired && " ⚠"}
    </span>
  )

  return <Tip text={tooltipText}>{label}</Tip>
}

function OverallRiskBadge({ risk }: { risk: string | null }) {
  if (risk === "clear")
    return (
      <Tip text="No risk flags found — safe to proceed">
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 cursor-default">✓ Clear</span>
      </Tip>
    )
  if (risk === "caution")
    return (
      <Tip text="Some caution flags raised — review before offering">
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 cursor-default">! Caution</span>
      </Tip>
    )
  if (risk === "red_flag")
    return (
      <Tip text="Red flags found — proceed with caution">
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 cursor-default">✕ Red Flag</span>
      </Tip>
    )
  return (
    <Tip text="Portal check not yet run">
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">Pending</span>
    </Tip>
  )
}

function ActiveListingBadge({ lead }: { lead: VendorLead }) {
  const portals: PortalSource[] = ["RIGHTMOVE", "ZOOPLA", "ONTHEMARKET", "PRIMELOCATION"]
  const statuses = portals.map((p) => getPortalStatus(lead, p))
  const hasCheck = statuses.some((s) => s !== null)
  if (!hasCheck)
    return (
      <Tip text="Portal check not yet run">
        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">Pending</span>
      </Tip>
    )
  const anyListed = statuses.some((s) => s === "listed")
  const anyBlocked = statuses.some((s) => s === "blocked")
  if (anyListed)
    return (
      <Tip text="Property found on one or more portals — vendor may be marketing elsewhere">
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 cursor-default">Listed</span>
      </Tip>
    )
  if (anyBlocked)
    return (
      <Tip text="Some portals blocked — partial check only">
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 cursor-default">Partial</span>
      </Tip>
    )
  return (
    <Tip text="Not found on any portal — property not publicly marketed">
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Not Listed</span>
    </Tip>
  )
}

function UrgencyBadge({ level }: { level: string | null }) {
  if (level === "urgent")
    return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Urgent</span>
  if (level === "quick")
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Quick</span>
  if (level === "moderate")
    return <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Moderate</span>
  if (level === "flexible")
    return <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Flexible</span>
  return <span className="text-gray-400 text-xs">—</span>
}

function ValidationResultBadge({ passed }: { passed: boolean | null }) {
  if (passed === true)
    return (
      <Tip text="Deal passed BMV and profit validation criteria">
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 cursor-default">✓ Pass</span>
      </Tip>
    )
  if (passed === false)
    return (
      <Tip text="Deal did not meet minimum BMV or profit thresholds">
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 cursor-default">✕ Fail</span>
      </Tip>
    )
  return (
    <Tip text="Validation not yet run">
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">Pending</span>
    </Tip>
  )
}

function EpcCombinedCell({ rating, score, inspectionDate }: {
  rating: string | null
  score: number | null
  inspectionDate: string | null
}) {
  if (!rating) return <span className="text-gray-400 text-xs">—</span>
  const colourCls = EPC_COLOUR[rating.toUpperCase()] ?? "bg-gray-200 text-gray-700"
  const expiry = inspectionDate
    ? new Date(new Date(inspectionDate).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000)
    : null
  const isExpired = expiry ? expiry < new Date() : false
  const expirySoon = expiry ? (expiry.getTime() - Date.now()) < 365 * 24 * 60 * 60 * 1000 : false
  const expiryStr = expiry ? fmtDate(expiry.toISOString()) : null
  const tooltipParts = [
    score !== null ? `Score: ${score}/100` : null,
    inspectionDate ? `Inspected: ${fmtDate(inspectionDate)}` : null,
    expiryStr ? `Expires: ${expiryStr}` : null,
  ].filter(Boolean).join(" · ")
  const badge = (
    <div className="flex items-center gap-1.5">
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-bold", colourCls)}>
        {rating.toUpperCase()}
      </span>
      {expiryStr && (
        <span className={cn("text-xs whitespace-nowrap", isExpired ? "text-red-600 font-medium" : expirySoon ? "text-amber-600" : "text-gray-400")}>
          {isExpired ? "Expired" : expiryStr}
        </span>
      )}
    </div>
  )
  return tooltipParts ? <Tip text={tooltipParts}>{badge}</Tip> : badge
}

function VendorResponseBadge({ stage }: { stage: PipelineStage }) {
  if (stage === "OFFER_ACCEPTED")
    return <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Accepted</span>
  if (stage === "OFFER_REJECTED")
    return <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Rejected</span>
  if (stage === "RETRY_1" || stage === "RETRY_2" || stage === "RETRY_3")
    return <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Negotiating</span>
  if (stage === "OFFER_MADE")
    return <span className="inline-block rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Awaiting</span>
  return <span className="text-gray-400 text-xs">—</span>
}

function BmvCell({ value }: { value: string | number | null | undefined }) {
  const n = toNum(value)
  if (n === null)
    return <span className="font-mono text-gray-400">—</span>
  const cls =
    n >= 15 ? "text-green-700 font-bold" :
    n >= 10 ? "text-amber-600 font-bold" :
               "text-red-600 font-bold"
  return (
    <Tip text="Below Market Value %. Green ≥15% = excellent, Amber 10-14% = good, Red <10% = weak">
      <span className={cn("font-mono text-xs cursor-default", cls)}>{n.toFixed(1)}%</span>
    </Tip>
  )
}

const PROCESSING_DESC: Record<ProcessingStatus, string> = {
  RUNNING:  "AI checks in progress — table auto-refreshes every 3 s",
  COMPLETE: "All processing steps completed successfully",
  FAILED:   "Processing failed — retry or check manually",
  PENDING:  "Awaiting processing",
}

function ProcessingIcon({ status }: { status: ProcessingStatus }) {
  const icon = (() => {
    switch (status) {
      case "RUNNING":  return <Loader2 className="inline h-3.5 w-3.5 animate-spin text-blue-500" />
      case "COMPLETE": return <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500" />
      case "FAILED":   return <XCircle className="inline h-3.5 w-3.5 text-red-500" />
      default:         return <Minus className="inline h-3.5 w-3.5 text-gray-300" />
    }
  })()
  return <Tip text={PROCESSING_DESC[status]}>{icon}</Tip>
}

// ─────────────────────────────────────────────────────────────────────────────
// Needs-Action Banner
// ─────────────────────────────────────────────────────────────────────────────

interface NeedsActionItem {
  leadId: string
  vendorName: string
  address: string
  reason: string
  action: string
  urgency: "high" | "medium" | "low"
}

function getNeedsActionItems(leads: VendorLead[]): NeedsActionItem[] {
  const now = Date.now()
  const items: NeedsActionItem[] = []
  const fourteenDays = 14 * 24 * 60 * 60 * 1000

  for (const lead of leads) {
    if (lead.archivedAt) continue
    const stage = lead.pipelineStage
    const address = lead.propertyAddress ?? lead.vendorName

    if (stage === "OFFER_ACCEPTED") {
      items.push({ leadId: lead.id, vendorName: lead.vendorName, address, reason: "Offer accepted — complete deal setup now", action: "Complete Setup", urgency: "high" })
    } else if (stage === "OFFER_REJECTED") {
      items.push({ leadId: lead.id, vendorName: lead.vendorName, address, reason: "Offer rejected — retry, nurture, or close this lead", action: "Decide", urgency: "high" })
    } else if (lead.validationPassed === true && !lead.offerAmount && (stage === "DEAL_VALIDATION" || stage === "AI_CONVERSATION")) {
      items.push({ leadId: lead.id, vendorName: lead.vendorName, address, reason: `Validation passed${lead.bmvScore ? ` · ${Number(lead.bmvScore).toFixed(1)}% BMV` : ""} — ready to make an offer`, action: "Make Offer", urgency: "high" })
    } else if (stage === "RETRY_1" || stage === "RETRY_2" || stage === "RETRY_3") {
      items.push({ leadId: lead.id, vendorName: lead.vendorName, address, reason: `${stage.replace("_", " ")} — send revised offer`, action: "Send Offer", urgency: "medium" })
    } else if (
      (stage === "NEW_LEAD" || stage === "AI_CONVERSATION" || stage === "DEAL_VALIDATION" || stage === "OFFER_MADE" || stage === "PAPERWORK_SENT") &&
      now - new Date(lead.createdAt).getTime() > fourteenDays
    ) {
      const days = Math.floor((now - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60 * 24))
      items.push({ leadId: lead.id, vendorName: lead.vendorName, address, reason: `Stale ${days}d — no progression`, action: "Review", urgency: "low" })
    }
  }

  // Sort: high → medium → low
  return items.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 }
    return order[a.urgency] - order[b.urgency]
  })
}

function NeedsActionBanner({ leads, onNavigate }: { leads: VendorLead[]; onNavigate: (tab: TabId) => void }) {
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const items = getNeedsActionItems(leads)
  if (items.length === 0) return null

  const highCount = items.filter((i) => i.urgency === "high").length
  const medCount = items.filter((i) => i.urgency === "medium").length

  return (
    <div className="mb-4 overflow-hidden rounded-xl border border-amber-200 bg-amber-50 shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
            {items.length}
          </span>
          <span className="text-sm font-semibold text-amber-900">
            Needs Your Attention
          </span>
          <div className="flex items-center gap-1.5">
            {highCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700 whitespace-nowrap">
                {highCount} urgent
              </span>
            )}
            {medCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
                {medCount} pending
              </span>
            )}
          </div>
        </div>
        <span className="text-xs text-amber-600">{collapsed ? "Show ▼" : "Hide ▲"}</span>
      </button>

      {/* Items */}
      {!collapsed && (
        <div className="border-t border-amber-200 divide-y divide-amber-100">
          {items.map((item) => (
            <div key={item.leadId} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className={cn(
                    "h-2 w-2 shrink-0 rounded-full",
                    item.urgency === "high" ? "bg-red-500" : item.urgency === "medium" ? "bg-amber-500" : "bg-gray-400"
                  )}
                />
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-gray-900">{item.address}</p>
                  <p className="truncate text-[11px] text-amber-700">{item.reason}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (item.action === "Make Offer" || item.action === "Send Offer") onNavigate("offer-analysis")
                  else if (item.action === "Complete Setup") onNavigate("offer-analysis")
                  else router.push(`/dashboard/vendors/${item.leadId}`)
                }}
                className="shrink-0 rounded-md bg-white border border-amber-300 px-2.5 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
              >
                {item.action} →
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
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

function VendorLeadsKpiBar({ kpis }: { kpis: Kpis }) {
  const tiles: KpiTile[] = [
    {
      label: "Total Leads",
      value: String(kpis.total),
      icon: <Users className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-gray-900",
      tooltip: "Total vendor leads that are not archived. Includes all pipeline stages from New Lead to Ready to List.",
    },
    {
      label: "Avg BMV %",
      value: kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      iconBgClass: "bg-green-50",
      valueColorClass: "text-green-600",
      tooltip: "Average Below Market Value across all leads. Target ≥10%. Calculated: (Market Value − Asking Price) ÷ Market Value × 100",
    },
    {
      label: "Portal Pass Rate",
      value: kpis.portalPassRate !== null ? `${kpis.portalPassRate.toFixed(0)}%` : "—",
      icon: <BarChart2 className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-blue-600",
      tooltip: "Percentage of leads that passed BMV & rental validation. Target >60% indicates strong lead quality.",
    },
    {
      label: "Processing",
      value: String(kpis.processing),
      icon: <Zap className="h-4 w-4 text-amber-600" />,
      iconBgClass: "bg-amber-50",
      valueColorClass: "text-amber-600",
      tooltip: "Leads waiting for your next action — offers to send, negotiations to close, or follow-ups due.",
    },
  ]
  return <KpiBar tiles={tiles} />
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
    <td className="sticky left-[40px] z-10 w-[180px] bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <div className="flex items-center gap-2">
        <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-gray-300" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium text-gray-900">{lead.vendorName}</span>
            <ProcessingIcon status={lead.processingStatus} />
          </div>
          {lead.validationPassed === true && !lead.offerAmount && (lead.pipelineStage === "DEAL_VALIDATION" || lead.pipelineStage === "AI_CONVERSATION") && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" /> Ready to Offer
            </span>
          )}
          {lead.pipelineStage === "OFFER_ACCEPTED" && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-green-200 px-1.5 py-0.5 text-xs font-semibold text-green-800 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" /> Accepted
            </span>
          )}
          {lead.pipelineStage === "OFFER_REJECTED" && (
            <span className="mt-0.5 inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 whitespace-nowrap">
              <XCircle className="h-3 w-3" /> Rejected
            </span>
          )}
          <p className="truncate text-xs text-gray-400">{lead.vendorPhone}</p>
        </div>
      </div>
    </td>
  )
}

/** Sticky second-left address cell */
function AddressCell({ address }: { address: string | null }) {
  return (
    <td className="sticky left-[220px] z-10 max-w-[200px] border-r border-gray-200 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <p className="truncate text-sm text-gray-700">{address ?? <span className="text-gray-400">—</span>}</p>
    </td>
  )
}

interface CheckAction {
  icon: React.ElementType
  title: string
  onClick: () => void
  loading?: boolean
}

/** Sticky-right actions cell */
function ActionsCell({
  lead,
  onView,
  onArchive,
  onDelete,
  checkAction,
}: {
  lead: VendorLead
  onView: () => void
  onArchive: () => void
  onDelete: () => void
  checkAction?: CheckAction
}) {
  return (
    <td className="sticky right-0 z-10 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {checkAction && (
          <ActionBtn
            icon={checkAction.loading ? Loader2 : checkAction.icon}
            title={checkAction.title}
            onClick={checkAction.onClick}
            primary
            spinning={checkAction.loading}
          />
        )}
        <ActionBtn icon={Eye} title="View" onClick={onView} />
        <ActionBtn icon={Pencil} title="Edit" onClick={() => {}} />
        <ActionBtn icon={Archive} title="Mark Dead & Archive" onClick={onArchive} />
        <ActionBtn icon={Trash2} title="Delete" onClick={onDelete} danger />
      </div>
    </td>
  )
}

function ActionBtn({
  icon: Icon,
  title,
  onClick,
  danger,
  primary,
  spinning,
}: {
  icon: React.ElementType
  title: string
  onClick: () => void
  danger?: boolean
  primary?: boolean
  spinning?: boolean
}) {
  return (
    <Tip text={title}>
      <button
        onClick={(e) => { e.stopPropagation(); onClick() }}
        disabled={spinning}
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition-colors hover:border-gray-300 hover:text-gray-700 disabled:cursor-wait disabled:opacity-60",
          danger && "hover:border-red-300 hover:bg-red-50 hover:text-red-600",
          primary && "border-blue-200 bg-blue-50 text-blue-600 hover:border-blue-300 hover:bg-blue-100 hover:text-blue-700"
        )}
      >
        <Icon className={cn("h-3.5 w-3.5", spinning && "animate-spin")} />
      </button>
    </Tip>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tab Row renderers
// ─────────────────────────────────────────────────────────────────────────────

function MapViewRow({ lead, onRowClick, onView, onArchive, onDelete, isSelected, onToggleSelect }: RowRendererProps) {
  const createdAt = new Date(lead.createdAt)
  const leadAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
  return (
    <tr
      className={cn("group cursor-pointer border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}
      onClick={onRowClick}
    >
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td>
        {lead.motivationScore !== null
          ? (
            <Tip text={`Motivation: ${lead.motivationScore}/10 — ${lead.motivationScore >= 8 ? "Highly motivated" : lead.motivationScore >= 5 ? "Moderately motivated" : "Low motivation"}`}>
              <span className={cn("font-mono text-xs font-semibold cursor-default",
                lead.motivationScore >= 8 ? "text-green-700" : lead.motivationScore >= 5 ? "text-amber-700" : "text-gray-500"
              )}>
                {lead.motivationScore}/10
              </span>
            </Tip>
          )
          : <span className="text-gray-400 text-xs">—</span>}
      </Td>
      <Td><UrgencyBadge level={lead.urgencyLevel} /></Td>
      <Td>
        <Tip text={`Lead created ${fmtDate(lead.createdAt)}`}>
          <span className={cn("font-mono text-xs cursor-default",
            leadAgeDays > 30 ? "text-red-600 font-semibold" : leadAgeDays > 14 ? "text-amber-600" : "text-gray-700"
          )}>
            {leadAgeDays}d
          </span>
        </Tip>
      </Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function PropertyDetailsRow({ lead, onRowClick, onView, onArchive, onDelete, isSelected, onToggleSelect }: RowRendererProps) {
  const ownershipTenure = (lead.latestPortalCheck?.ownershipCheckRaw as any)?.tenure ?? null
  const tenure = lead.tenureType ?? ownershipTenure
  const annualRent = toNum(lead.estimatedAnnualRent)
  const askingPrice = toNum(lead.askingPrice)
  const grossYield = annualRent && askingPrice && askingPrice > 0 ? (annualRent / askingPrice) * 100 : null
  const profit = toNum(lead.profitPotential)
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td>{tenure ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{lead.squareFeet ? `${lead.squareFeet.toLocaleString()} ft²` : "—"}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.estimatedMarketValue)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.estimatedMonthlyRent)}{lead.estimatedMonthlyRent ? "/mo" : ""}</span></Td>
      <Td>
        <Tip text="Annual rent ÷ market value. Green ≥6% = strong BTL, Amber ≥4% = acceptable, Red <4% = poor cashflow">
          <span className={cn("font-mono text-xs cursor-default", grossYield !== null && grossYield >= 6 ? "text-green-700 font-semibold" : grossYield !== null && grossYield >= 4 ? "text-amber-700" : "")}>{grossYield !== null ? fmtPercent(grossYield) : "—"}</span>
        </Tip>
      </Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <Td>
        <Tip text="Estimated profit = Market Value − Asking Price − Estimated Refurb Cost">
          <span className={cn("font-mono text-xs cursor-default", profit !== null && profit > 0 ? "text-green-700 font-semibold" : profit !== null && profit <= 0 ? "text-red-600" : "")}>{fmtCurrency(profit)}</span>
        </Tip>
      </Td>
      <Td>
        {lead.bedrooms !== null ? `${lead.bedrooms}` : "—"}
        {lead.bathrooms !== null ? ` / ${lead.bathrooms}` : ""}
      </Td>
      <Td>{lead.condition ? lead.condition.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—"}</Td>
      <ActionsCell lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete} />
    </tr>
  )
}

function PortalCheckRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  const ownership = lead.latestPortalCheck?.ownershipCheckRaw as any
  const ownerType = ownership?.isCorporateOwned
    ? ownership?.isOverseasOwned ? "Overseas Corp" : "Corporate"
    : ownership ? "Private" : null
  const ownerDisplay = ownership?.companyName ?? (ownership ? "Private" : null)
  const lastSalePrice = ownership?.lastSalePrice ?? null
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><OverallRiskBadge risk={lead.latestCheckRisk} /></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><ActiveListingBadge lead={lead} /></Td>
      <Td className="w-28 px-2">{ownerDisplay ?? <span className="text-gray-400">—</span>}</Td>
      <Td className="w-24 px-2">{ownership?.tenure ?? lead.tenureType ?? "—"}</Td>
      <Td className="w-24 px-2">{ownerType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{lastSalePrice ? fmtCurrency(lastSalePrice) : "—"}</span></Td>
      <Td>
        <span className="font-mono text-xs text-gray-500">
          {lead.latestCheckedAt ? fmtDate(lead.latestCheckedAt) : "—"}
        </span>
      </Td>
      <ActionsCell
        lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete}
        checkAction={onCheck ? { icon: ShieldCheck, title: "Run Portal Check", onClick: onCheck, loading: isChecking } : undefined}
      />
    </tr>
  )
}

function ValidationRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  const rentNum = toNum(lead.estimatedMonthlyRent)
  const netCashflow = rentNum ? rentNum * 0.8 : null
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const grossYield = annualRent && price && price > 0 ? (annualRent / price) * 100 : null
  const profit = toNum(lead.profitPotential)
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><ValidationResultBadge passed={lead.validationPassed} /></Td>
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{lead.localAverageRent ? `${fmtCurrency(lead.localAverageRent)}/mo` : "—"}</span></Td>
      <Td><span className="font-mono text-xs">{lead.estimatedMonthlyRent ? `${fmtCurrency(lead.estimatedMonthlyRent)}/mo` : "—"}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.avgComparablePrice)}</span></Td>
      <Td>
        <Tip text="Annual rent ÷ market value. Green ≥6% = strong BTL, Amber ≥4% = acceptable, Red <4% = poor cashflow">
          <span className={cn("font-mono text-xs cursor-default", grossYield !== null && grossYield >= 6 ? "text-green-700 font-semibold" : grossYield !== null && grossYield >= 4 ? "text-amber-700" : "")}>{grossYield !== null ? fmtPercent(grossYield) : "—"}</span>
        </Tip>
      </Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <Td>
        <Tip text="Estimated profit = Market Value − Asking Price − Estimated Refurb Cost">
          <span className={cn("font-mono text-xs cursor-default", profit !== null && profit > 0 ? "text-green-700 font-semibold" : profit !== null && profit <= 0 ? "text-red-600" : "")}>{fmtCurrency(profit)}</span>
        </Tip>
      </Td>
      <Td>
        <Tip text="Monthly rent − mortgage − expenses. Positive = self-sustaining, negative = you fund it monthly">
          <span className={cn("font-mono text-xs cursor-default", netCashflow !== null && netCashflow > 0 ? "text-green-700" : netCashflow !== null && netCashflow <= 0 ? "text-red-600" : "")}>{netCashflow ? `${fmtCurrency(netCashflow)}/mo` : "—"}</span>
        </Tip>
      </Td>
      <Td><EpcCombinedCell rating={lead.epcRating} score={lead.epcScore} inspectionDate={lead.epcInspectionDate} /></Td>
      <ActionsCell
        lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete}
        checkAction={onCheck ? { icon: Calculator, title: "Calculate BMV & Validation", onClick: onCheck, loading: isChecking } : undefined}
      />
    </tr>
  )
}

function ComparableRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const avgPrice = toNum(lead.avgComparablePrice)
  const grossYield = annualRent && price && price > 0 ? (annualRent / price) * 100 : null
  const hasComps = (lead.comparablesCount ?? 0) > 0
  // vs Market: positive = asking below market (good for investor), negative = asking above market (bad)
  const vsMarket = hasComps && avgPrice && price ? ((avgPrice - price) / avgPrice) * 100 : null

  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td><span className="font-mono text-xs">{lead.propertyPostcode ?? "—"}</span></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td>
        <Tip text={hasComps ? `${lead.comparablesCount} comparable properties found` : "No comparables fetched yet — data may be unreliable"}>
          <span className={cn("font-mono text-xs font-semibold cursor-default", hasComps ? "text-gray-900" : "text-amber-600")}>
            {lead.comparablesCount ?? 0}
          </span>
        </Tip>
      </Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.avgComparablePrice)}</span></Td>
      <Td>
        {vsMarket !== null
          ? (
            <Tip text={vsMarket >= 0 ? `Asking price is ${fmtPercent(vsMarket)} below market average — potential deal` : `Asking price is ${fmtPercent(Math.abs(vsMarket))} above market average`}>
              <span className={cn("font-mono text-xs font-semibold cursor-default", vsMarket >= 0 ? "text-green-700" : "text-red-600")}>
                {vsMarket >= 0 ? "+" : ""}{fmtPercent(vsMarket)}
              </span>
            </Tip>
          )
          : <span className="text-gray-400 text-xs">—</span>}
      </Td>
      <Td><BmvCell value={lead.bmvScore} /></Td>
      <Td><span className="font-mono text-xs">{lead.localAverageRent ? `${fmtCurrency(lead.localAverageRent)}/mo` : "—"}</span></Td>
      <Td>
        <Tip text="Annual rent ÷ market value. Green ≥6% = strong BTL, Amber ≥4% = acceptable, Red <4% = poor cashflow">
          <span className={cn("font-mono text-xs cursor-default", grossYield !== null && grossYield >= 6 ? "text-green-700 font-semibold" : grossYield !== null && grossYield >= 4 ? "text-amber-700" : "")}>{grossYield !== null ? fmtPercent(grossYield) : "—"}</span>
        </Tip>
      </Td>
      <Td>
        <span className="font-mono text-xs text-gray-500">
          {lead.bmvValidatedAt ? fmtDate(lead.bmvValidatedAt) : "—"}
        </span>
      </Td>
      <ActionsCell
        lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete}
        checkAction={onCheck ? { icon: GitCompare, title: "Fetch Comparables", onClick: onCheck, loading: isChecking } : undefined}
      />
    </tr>
  )
}

function OfferAnalysisRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  // Build offer chain: initial offer → retries → projected ladder
  const retries = lead.offerRetries ?? []
  // initialOffer: always the first offer sent to the vendor
  const initialOffer = lead.offerAmount
  // nextOffer: actual retry if exists, otherwise project using negotiation ladder algorithm
  // finalOffer: actual last retry if 2+ retries exist, otherwise project from ladder
  const round50 = (n: number) => Math.round(n / 50) * 50
  const initialNum = initialOffer ? Number(initialOffer) : null
  // Reverse-engineer ceiling from opening offer (opening = ceiling × 0.88)
  const projectedCeiling = initialNum ? initialNum / 0.88 : null
  const projectedNext = projectedCeiling && initialNum
    ? round50(initialNum + (projectedCeiling - initialNum) * 0.45)
    : null
  const projectedFinal = projectedCeiling && projectedNext
    ? round50(projectedNext + (projectedCeiling - projectedNext) * 0.40)
    : null

  const nextOffer = retries.length >= 1
    ? (retries[0].adjustedOfferAmount ?? retries[0].originalOfferAmount)
    : projectedNext
  const finalOffer = retries.length >= 2
    ? (retries[retries.length - 1].adjustedOfferAmount ?? retries[retries.length - 1].originalOfferAmount)
    : projectedFinal
  const numOffers = lead.offerAmount
    ? (lead.retryCount ?? 0) + 1
    : 0

  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className={cn("sticky left-0 z-10 w-10 px-3 py-[11px]", isSelected ? "bg-blue-50 group-hover:bg-blue-100" : "bg-white group-hover:bg-[#f3f4f6]")} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
      <AddressCell address={lead.propertyAddress} />
      <Td><StageBadge stage={lead.pipelineStage} /></Td>
      <Td>{lead.propertyType ?? "—"}</Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(lead.askingPrice)}</span></Td>
      <Td>
        <span className={cn("font-mono text-xs", lead.offerPercentage ? "text-gray-900 font-semibold" : "text-gray-400")}>
          {lead.offerPercentage ? fmtPercent(lead.offerPercentage, 0) : "—"}
        </span>
      </Td>
      <Td><span className="font-mono text-xs">{fmtCurrency(initialOffer)}</span></Td>
      <Td>
        <span className={cn("font-mono text-xs", retries.length < 1 && nextOffer ? "text-gray-400 italic" : "")}>
          {fmtCurrency(nextOffer)}
        </span>
      </Td>
      <Td>
        <span className={cn("font-mono text-xs font-semibold", retries.length < 2 && finalOffer ? "text-gray-400 italic" : "")}>
          {fmtCurrency(finalOffer)}
        </span>
      </Td>
      <Td>
        {(() => {
          const offerNum = toNum(finalOffer ?? initialOffer)
          const askNum = toNum(lead.askingPrice)
          const gap = offerNum && askNum ? askNum - offerNum : null
          return gap !== null && gap > 0
            ? <span className="font-mono text-xs text-amber-700">{fmtCurrency(gap)}</span>
            : gap === 0
            ? <span className="font-mono text-xs text-green-700">At asking</span>
            : <span className="text-gray-400 text-xs">—</span>
        })()}
      </Td>
      <Td>
        <span className={cn("font-mono text-xs", numOffers > 0 ? "text-gray-900" : "text-gray-400")}>
          {numOffers > 0 ? `Round ${numOffers}` : "—"}
        </span>
      </Td>
      <Td><VendorResponseBadge stage={lead.pipelineStage} /></Td>
      <Td>
        <Tip text="Estimated profit if vendor accepts final offer = Market Value − Final Offer − Refurb − Costs">
          <span className={cn("font-mono text-xs cursor-default", toNum(lead.profitPotential) !== null && toNum(lead.profitPotential)! > 0 ? "text-green-700 font-semibold" : toNum(lead.profitPotential) !== null ? "text-red-600" : "")}>
            {fmtCurrency(lead.profitPotential)}
          </span>
        </Tip>
      </Td>
      <Td>
        {(() => {
          const lastRetryDate = retries.length > 0 ? retries[retries.length - 1].sentAt : null
          const lastDate = lastRetryDate ?? lead.offerSentAt
          if (!lastDate) return <span className="text-gray-400 text-xs">—</span>
          const daysAgo = Math.floor((Date.now() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))
          return (
            <Tip text={`Last activity: ${fmtDate(lastDate)}`}>
              <span className={cn("font-mono text-xs cursor-default", daysAgo > 7 ? "text-red-600 font-semibold" : daysAgo > 3 ? "text-amber-600" : "text-gray-700")}>
                {daysAgo}d ago
              </span>
            </Tip>
          )
        })()}
      </Td>
      <ActionsCell
        lead={lead} onView={onView} onArchive={onArchive} onDelete={onDelete}
        checkAction={onCheck ? { icon: Calculator, title: "Calculate Offer", onClick: onCheck, loading: isChecking } : undefined}
      />
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
  onCheck?: () => void
  isChecking?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
}

function TableHeaders({ tab, allSelected, someSelected, onSelectAll }: {
  tab: TabId
  allSelected: boolean
  someSelected: boolean
  onSelectAll: () => void
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  const selectAllTh = (
    <th className="sticky left-0 z-10 w-10 bg-[#f9fafb] px-3 py-2.5">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={onSelectAll}
        className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
      />
    </th>
  )
  const stickyLeft = <Th className="sticky left-[40px] z-10 w-[180px] bg-[#f9fafb]">Vendor Name</Th>
  const addressHeader = <Th className="sticky left-[220px] z-10 border-r border-gray-200 bg-[#f9fafb]">Address</Th>
  const stickyRight = <Th className="sticky right-0 z-10 bg-[#f9fafb]">Actions</Th>

  switch (tab) {
    case "map-view":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Postcode</Th><Th>Type</Th><Th>Status</Th>
        <Th><Tip text="Below Market Value %. Green ≥15% = excellent, Amber 10-14% = good, Red <10% = weak">BMV %</Tip></Th>
        <Th><Tip text="Vendor's advertised price — your negotiation starting point">Asking Price</Tip></Th>
        <Th><Tip text="AI-scored vendor motivation (1-10). Higher = more urgency to sell">Motivation</Tip></Th>
        <Th><Tip text="How quickly vendor needs to sell: Urgent (&lt;2 weeks), Quick (1-2 months), Moderate, Flexible">Urgency</Tip></Th>
        <Th><Tip text="How long lead has been in the system. Older leads may need re-engagement">Lead Age</Tip></Th>
        {stickyRight}
      </tr>

    case "property-details":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th><Tip text="Freehold (you own land forever) vs Leasehold (you own for X years). Avoid leases <80 years remaining">Tenure</Tip></Th>
        <Th><Tip text="Property size in sq ft. Used for price-per-sqft comparison">Sq Ft</Tip></Th>
        <Th><Tip text="Vendor's advertised price — your negotiation starting point">Asking Price</Tip></Th>
        <Th><Tip text="Estimated open market value from comparable sales">Est. Market Val.</Tip></Th>
        <Th><Tip text="Estimated monthly rental income from comparable rentals in the area">Est. Rent/mo</Tip></Th>
        <Th><Tip text="Annual rent ÷ market value. Green ≥6%, Amber ≥4%, Red <4%">Gross Yield %</Tip></Th>
        <Th><Tip text="Below Market Value %. Green ≥15% = excellent, Amber 10-14% = good, Red <10% = weak">BMV %</Tip></Th>
        <Th><Tip text="Market Value − Asking Price − Estimated Refurb Cost">Profit Potential</Tip></Th>
        <Th>Bed/Bath</Th>
        <Th><Tip text="Property condition: poor/fair/good/excellent. Affects refurb cost estimate">Condition</Tip></Th>
        {stickyRight}
      </tr>

    case "portal-check":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th><Tip text="Risk level from portal checks: Clear = not listed, Caution = some flags, Red Flag = listed or problematic">Overall Risk</Tip></Th>
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th><Tip text="Whether property is currently listed for sale on portals. Listed = vendor may be testing market">Active Listing</Tip></Th>
        <Th className="w-28"><Tip text="Current registered owner from Land Registry. Different from vendor = may be agent or investor">Owner</Tip></Th>
        <Th className="w-24"><Tip text="Freehold (you own land forever) vs Leasehold (you own for X years). Avoid leases <80 years remaining">Tenure</Tip></Th>
        <Th className="w-24"><Tip text="Individual, UK company, or overseas entity. Corporate/overseas = potential complications">Owner Type</Tip></Th>
        <Th><Tip text="Last recorded sale price from Land Registry">Last Sale Price</Tip></Th>
        <Th><Tip text="When portal check was last run. Refresh if >30 days old — listings change frequently">Last Checked</Tip></Th>
        {stickyRight}
      </tr>

    case "validation":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th><Tip text="Pass = lead meets minimum BMV & yield thresholds. Fail = does not meet criteria">Validation</Tip></Th>
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Asking Price</Th>
        <Th><Tip text="Average monthly rent for similar properties in this postcode from market data">Market Rent</Tip></Th>
        <Th><Tip text="AI-estimated monthly rent based on comparable rentals">Est. Rent</Tip></Th>
        <Th><Tip text="Average sale price of comparable properties (0.5mi radius, last 6 months). = Market Value estimate">AVG Sale Price</Tip></Th>
        <Th><Tip text="Annual rent ÷ market value. Green ≥6%, Amber ≥4%, Red <4%">Gross Yield %</Tip></Th>
        <Th><Tip text="Below Market Value %. Green ≥15% = excellent, Amber 10-14% = good, Red <10% = weak">BMV %</Tip></Th>
        <Th><Tip text="Market Value − Asking Price − Estimated Refurb Cost">Profit Potential</Tip></Th>
        <Th><Tip text="Monthly rent − mortgage − expenses. Positive = self-sustaining, negative = you fund it monthly">Est. Net Cashflow</Tip></Th>
        <Th><Tip text="Energy Performance Certificate. A = most efficient, G = least. Below E = unmortgageable without improvement">EPC</Tip></Th>
        {stickyRight}
      </tr>

    case "comparable":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th><Tip text="Number of comparable sold properties found. <3 = low confidence, 6+ = high confidence"># Comps</Tip></Th>
        <Th>Asking Price</Th>
        <Th><Tip text="Average sale price of comparable properties (0.5mi radius, last 6 months). = Market Value estimate">AVG Sale Price</Tip></Th>
        <Th><Tip text="Asking price vs average comparable price. Negative % = asking above market (bad), Positive % = asking below market (good deal)">vs Market</Tip></Th>
        <Th><Tip text="Below Market Value %. Green ≥15% = excellent, Amber 10-14% = good, Red <10% = weak">BMV %</Tip></Th>
        <Th><Tip text="Average monthly rent for similar properties in this postcode from market data">AVG Rental</Tip></Th>
        <Th><Tip text="Annual rent ÷ market value. Green ≥6%, Amber ≥4%, Red <4%">Gross Yield %</Tip></Th>
        <Th><Tip text="When BMV was last calculated. Refresh if >14 days — comparable prices change">Last Updated</Tip></Th>
        {stickyRight}
      </tr>

    case "offer-analysis":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Type</Th>
        <Th>Asking Price</Th>
        <Th><Tip text="Your offer as % of asking price. Typical opening: 85-88%. Shows room left in negotiation">Offer %</Tip></Th>
        <Th><Tip text="Your opening offer. Deliberate 12-15% below asking to leave room for negotiation">Initial Offer</Tip></Th>
        <Th><Tip text="Second offer if vendor rejects initial. Italic = projected. Bold = already sent. ~45% of gap between initial & ceiling">Next Offer</Tip></Th>
        <Th><Tip text="Best & Final = your absolute ceiling. Italic = projected. Bold = already sent. Above this price the deal fails your criteria">Final Offer</Tip></Th>
        <Th><Tip text="Final offer minus asking price. Positive = below asking, negative = above asking">Offer Gap</Tip></Th>
        <Th><Tip text="Number of offer rounds completed. More rounds = vendor fatigue">Round</Tip></Th>
        <Th><Tip text="Vendor's current response status: awaiting, negotiating, accepted, or rejected">Vendor Response</Tip></Th>
        <Th><Tip text="Estimated profit if vendor accepts final offer = Market Value − Final Offer − Refurb − Costs">Profit @ Offer</Tip></Th>
        <Th>Last Activity</Th>
        {stickyRight}
      </tr>

    default:
      return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bulk Action constants + BulkActionBar
// ─────────────────────────────────────────────────────────────────────────────

const BULK_CHECK_ENDPOINTS: Partial<Record<TabId, {
  endpoint: (id: string) => string
  successMsg: string
}>> = {
  "portal-check":   { endpoint: (id) => `/api/vendor-pipeline/leads/${id}/run-check`,  successMsg: "portal checks started" },
  "validation":     { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,        successMsg: "validations complete" },
  "comparable":     { endpoint: (id) => `/api/vendor-leads/${id}/fetch-comparables`,    successMsg: "comparables fetched" },
  "offer-analysis": { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,        successMsg: "offer analyses complete" },
}

const BULK_ACTION_LABELS: Partial<Record<TabId, string>> = {
  "portal-check":   "Run Portal Check",
  "validation":     "Run Validation",
  "comparable":     "Fetch Comparables",
  "offer-analysis": "Run Offer Analysis",
}

interface BulkActionBarProps {
  selectedCount: number
  activeTab: TabId
  isRunning: boolean
  isBulkArchiving: boolean
  isBulkDeleting: boolean
  progress: { done: number; total: number } | null
  onRun: () => void
  onBulkArchive: () => void
  onBulkDelete: () => void
  onClear: () => void
}

function BulkActionBar({ selectedCount, activeTab, isRunning, isBulkArchiving, isBulkDeleting, progress, onRun, onBulkArchive, onBulkDelete, onClear }: BulkActionBarProps) {
  const actionLabel = BULK_ACTION_LABELS[activeTab]
  const busy = isRunning || isBulkArchiving || isBulkDeleting
  return (
    <div className="flex items-center justify-between bg-[#1e293b] px-4 py-3">
      <span className="text-sm font-medium text-slate-200">
        {selectedCount} lead{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-2">
        {/* Tab-specific bulk action (portal check, validation, etc.) */}
        {actionLabel && (
          <button
            onClick={onRun}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress ? `Running… (${progress.done}/${progress.total})` : "Running…"}
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                {`${actionLabel} on ${selectedCount}`}
              </>
            )}
          </button>
        )}

        {/* Divider when tab action + archive/delete both shown */}
        {actionLabel && <span className="h-4 w-px bg-slate-600" />}

        {/* Bulk Archive */}
        <button
          onClick={onBulkArchive}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isBulkArchiving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Archive className="h-3.5 w-3.5" />
          )}
          {isBulkArchiving ? "Archiving…" : "Archive"}
        </button>

        {/* Bulk Delete */}
        <button
          onClick={onBulkDelete}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isBulkDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" />
          )}
          {isBulkDeleting ? "Deleting…" : "Delete"}
        </button>

        {!busy && (
          <button onClick={onClear} className="ml-2 text-sm text-slate-400 hover:text-slate-200">
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function VendorLeadsTable() {
  const router = useRouter()
  const [leads, setLeads] = useState<VendorLead[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"table" | "board">("table")
  const [activeTab, setActiveTab] = useState<TabId>("map-view")
  const [mapLead, setMapLead] = useState<VendorLead | null>(null)
  const [checkingIds, setCheckingIds] = useState<Set<string>>(new Set())
  const [propertyDetailsModalLead, setPropertyDetailsModalLead] = useState<VendorLead | null>(null)
  const [portalCheckModalLead, setPortalCheckModalLead] = useState<VendorLead | null>(null)
  const [validationModalLead, setValidationModalLead] = useState<VendorLead | null>(null)
  const [comparableModalLead, setComparableModalLead] = useState<VendorLead | null>(null)
  const [offerModalLead, setOfferModalLead] = useState<VendorLead | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
  const [bulkArchiving, setBulkArchiving] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    variant: "destructive" | "archive" | "warning" | "default"
    confirmLabel: string
    onConfirm: () => void
  }>({ open: false, title: "", description: "", variant: "default", confirmLabel: "Confirm", onConfirm: () => {} })

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchLeads = useCallback(async () => {
    try {
      const res = await fetch("/api/vendor-pipeline/leads?limit=200")
      if (!res.ok) throw new Error("Failed to fetch leads")
      const data = await res.json()
      const freshLeads: VendorLead[] = data.leads ?? []
      setLeads(freshLeads)
      // Sync any open modal lead so it reflects fresh data immediately
      setValidationModalLead((prev) =>
        prev ? (freshLeads.find((l) => l.id === prev.id) ?? prev) : null
      )
    } catch {
      toast.error("Failed to load vendor leads")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // ── Tab-specific check action ─────────────────────────────────────────────
  const handleCheck = useCallback(async (leadId: string, endpoint: string, successMsg: string) => {
    setCheckingIds((prev) => new Set(prev).add(leadId))
    try {
      const res = await fetch(endpoint, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Request failed (${res.status})`)
      }
      toast.success(successMsg)
      await fetchLeads()
    } catch (err: any) {
      toast.error(err.message || "Action failed")
    } finally {
      setCheckingIds((prev) => {
        const next = new Set(prev)
        next.delete(leadId)
        return next
      })
    }
  }, [fetchLeads])

  // ── Bulk tab-specific check action ───────────────────────────────────────
  const handleBulkCheck = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const cfg = BULK_CHECK_ENDPOINTS[activeTab]
    if (bulkRunning || !cfg || ids.length === 0) return

    const CONCURRENCY = 3
    let done = 0
    let failed = 0
    setBulkRunning(true)
    setBulkProgress({ done: 0, total: ids.length })

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY)
      await Promise.allSettled(
        batch.map(async (id) => {
          setCheckingIds((prev) => new Set(prev).add(id))
          try {
            const res = await fetch(cfg.endpoint(id), { method: "POST" })
            if (!res.ok) {
              const err = await res.json().catch(() => ({}))
              throw new Error(err.error || `Failed (${res.status})`)
            }
            done++
          } catch (err: any) {
            failed++
            toast.error(`${id.slice(0, 6)}… — ${err.message}`)
          } finally {
            setCheckingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
            setBulkProgress({ done: done + failed, total: ids.length })
          }
        })
      )
    }

    await fetchLeads()
    setBulkRunning(false)
    setBulkProgress(null)
    setSelectedIds(new Set())

    if (failed === 0) {
      toast.success(`${done}/${ids.length} ${cfg.successMsg}`)
    } else {
      toast.warning(`${done}/${ids.length} complete — ${failed} failed`)
    }
  }, [selectedIds, activeTab, fetchLeads, bulkRunning])

  // ── Bulk Archive ──────────────────────────────────────────────────────────
  const handleBulkArchive = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || bulkArchiving) return
    setConfirmDialog({
      open: true,
      title: `Archive ${ids.length} lead${ids.length !== 1 ? "s" : ""}?`,
      description: "They will be moved to the Archive page and can be restored at any time.",
      variant: "archive",
      confirmLabel: "Archive",
      onConfirm: async () => {
        setBulkArchiving(true)
        let done = 0
        let failed = 0
        for (const id of ids) {
          try {
            const res = await fetch(`/api/vendor-pipeline/leads/${id}/archive`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ archiveLinkedDeal: false }),
            })
            if (!res.ok) throw new Error("failed")
            done++
          } catch {
            failed++
          }
        }
        await fetchLeads()
        setBulkArchiving(false)
        setSelectedIds(new Set())
        if (failed === 0) {
          toast.success(`${done} lead${done !== 1 ? "s" : ""} archived`)
        } else {
          toast.warning(`${done} archived, ${failed} failed`)
        }
      },
    })
    return
  }, [selectedIds, bulkArchiving, fetchLeads])

  // ── Bulk Delete ───────────────────────────────────────────────────────────
  const handleBulkDelete = useCallback(async () => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || bulkDeleting) return
    setConfirmDialog({
      open: true,
      title: `Delete ${ids.length} lead${ids.length !== 1 ? "s" : ""} permanently?`,
      description: "This cannot be undone. All lead data and conversation history will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        setBulkDeleting(true)
        let done = 0
        let failed = 0
        for (const id of ids) {
          try {
            const res = await fetch(`/api/vendor-leads/${id}`, { method: "DELETE" })
            if (!res.ok) throw new Error("failed")
            done++
          } catch {
            failed++
          }
        }
        await fetchLeads()
        setBulkDeleting(false)
        setSelectedIds(new Set())
        if (failed === 0) {
          toast.success(`${done} lead${done !== 1 ? "s" : ""} permanently deleted`)
        } else {
          toast.warning(`${done} deleted, ${failed} failed`)
        }
      },
    })
    return
  }, [selectedIds, bulkDeleting, fetchLeads])

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
    const lead = leads.find(l => l.id === leadId)
    setConfirmDialog({
      open: true,
      title: "Archive this lead?",
      description: (lead as any)?.dealId
        ? "This lead has a linked deal. Both the lead and its deal will be archived and can be restored anytime."
        : "The lead will be moved to the Archive page and can be restored at any time.",
      variant: "archive",
      confirmLabel: "Archive",
      onConfirm: async () => {
        const archiveLinkedDeal = !!(lead as any)?.dealId
        try {
          const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/archive`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ archiveLinkedDeal }),
          })
          if (!res.ok) throw new Error("Failed to archive lead")
          setLeads(prev => prev.filter(l => l.id !== leadId))
          toast.success("Lead archived — moved to archive. Restore it anytime from the Archive page.")
        } catch {
          toast.error("Failed to archive lead")
        }
      },
    })
  }

  const handleDelete = async (leadId: string) => {
    setConfirmDialog({
      open: true,
      title: "Delete this lead permanently?",
      description: "This cannot be undone. The vendor contact, conversation history, and all associated data will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        try {
          await fetch(`/api/vendor-pipeline/leads/${leadId}`, { method: "DELETE" })
          setLeads((prev) => prev.filter((l) => l.id !== leadId))
          toast.success("Lead deleted")
        } catch {
          toast.error("Failed to delete lead")
        }
      },
    })
    return
  }

  // ── Derived data ──────────────────────────────────────────────────────────
  const kpis = computeKpis(leads)
  const visibleLeads = leads.filter((l) => !l.archivedAt)
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((l) => selectedIds.has(l.id))
  const someVisibleSelected = visibleLeads.some((l) => selectedIds.has(l.id))
  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleLeads.map((l) => l.id)))
    }
  }
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <TooltipProvider>
      <div className="flex flex-col gap-0">
      {/* Needs-Action Banner */}
      <NeedsActionBanner leads={leads} onNavigate={setActiveTab} />

      {/* KPI Bar */}
      <div className="mb-4">
        <VendorLeadsKpiBar kpis={kpis} />
      </div>

      {/* Tab bar + table card */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {/* Toolbar row above tab bar */}
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
          <p className="text-sm text-gray-500">
            {visibleLeads.length} lead{visibleLeads.length !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            {/* Board / Table toggle */}
            <div className="flex items-center gap-0.5 rounded-md border border-gray-200 bg-gray-50 p-0.5">
              <button
                onClick={() => setViewMode("table")}
                title="Table view"
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
                  viewMode === "table"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Table2 className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setViewMode("board")}
                title="Board view"
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded text-xs transition-colors",
                  viewMode === "board"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Activity */}
            <button
              onClick={() => router.push("/dashboard/vendors/activity")}
              className="flex h-7 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-600 hover:bg-gray-50"
              title="View lead activity log"
            >
              <Clock className="h-3.5 w-3.5" />
              Activity
            </button>
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

        {/* Board view — rendered in place of the tab table when active */}
        {viewMode === "board" && (
          <div className="p-4">
            <VendorPipelineKanbanBoard />
          </div>
        )}

        {/* Tab Bar — only shown in table view */}
        {viewMode === "table" && <TabBar active={activeTab} onChange={setActiveTab} />}

        {/* Table — only shown in table view */}
        {viewMode === "table" && <div className="overflow-x-auto">
          <table className="w-full min-w-max border-collapse bg-white text-sm">
            <thead>
              <TableHeaders
                tab={activeTab}
                allSelected={allVisibleSelected}
                someSelected={someVisibleSelected}
                onSelectAll={handleSelectAll}
              />
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
                // Build the tab-specific check action
                const checkEndpoints: Partial<Record<TabId, { endpoint: string; msg: string }>> = {
                  "portal-check":   { endpoint: `/api/vendor-pipeline/leads/${lead.id}/run-check`,         msg: "Portal check started" },
                  "validation":     { endpoint: `/api/vendor-leads/${lead.id}/calculate-bmv`,              msg: "BMV calculation complete" },
                  "comparable":     { endpoint: `/api/vendor-leads/${lead.id}/fetch-comparables`,          msg: "Comparables fetched" },
                  "offer-analysis": { endpoint: `/api/vendor-leads/${lead.id}/calculate-bmv`, msg: "Offer calculated" },
                }
                const checkCfg = checkEndpoints[activeTab]

                const rowProps: RowRendererProps = {
                  lead,
                  onRowClick: () => {
                    if (activeTab === "map-view") setMapLead(lead)
                  },
                  onView: () => {
                    if (activeTab === "property-details") {
                      setPropertyDetailsModalLead(lead)
                    } else if (activeTab === "portal-check") {
                      setPortalCheckModalLead(lead)
                    } else if (activeTab === "validation") {
                      setValidationModalLead(lead)
                    } else if (activeTab === "comparable") {
                      setComparableModalLead(lead)
                    } else if (activeTab === "offer-analysis") {
                      setOfferModalLead(lead)
                    } else {
                      router.push(`/dashboard/vendors/${lead.id}/contact`)
                    }
                  },
                  onArchive: () => handleArchive(lead.id),
                  onDelete: () => handleDelete(lead.id),
                  onCheck: checkCfg
                    ? () => handleCheck(lead.id, checkCfg.endpoint, checkCfg.msg)
                    : undefined,
                  isChecking: checkingIds.has(lead.id),
                  isSelected: selectedIds.has(lead.id),
                  onToggleSelect: () => handleToggleSelect(lead.id),
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
        </div>}

        {/* Bulk Action Bar — table view only */}
        {viewMode === "table" && selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            activeTab={activeTab}
            isRunning={bulkRunning}
            isBulkArchiving={bulkArchiving}
            isBulkDeleting={bulkDeleting}
            progress={bulkProgress}
            onRun={handleBulkCheck}
            onBulkArchive={handleBulkArchive}
            onBulkDelete={handleBulkDelete}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        {/* Footer */}
        {!loading && leads.some((l) => l.processingStatus === "RUNNING") && (
          <div className="flex items-center justify-end border-t border-gray-100 px-4 py-2 text-xs text-blue-600">
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            Auto-refreshing…
          </div>
        )}
      </div>

      {/* Property Details Modal */}
      {propertyDetailsModalLead && (
        <PropertyDetailsModal
          lead={propertyDetailsModalLead}
          onClose={() => setPropertyDetailsModalLead(null)}
        />
      )}

      {/* Map Modal */}
      {mapLead && <MapModal lead={mapLead} onClose={() => setMapLead(null)} />}

      {/* Portal Check Modal */}
      {portalCheckModalLead && (
        <PortalCheckModal lead={portalCheckModalLead} onClose={() => setPortalCheckModalLead(null)} />
      )}

      {/* Validation Modal */}
      {validationModalLead && (
        <ValidationModal
          lead={validationModalLead}
          onClose={() => setValidationModalLead(null)}
          onCheck={() => handleCheck(
            validationModalLead.id,
            `/api/vendor-leads/${validationModalLead.id}/calculate-bmv`,
            "BMV calculation complete"
          )}
        />
      )}

      {/* Comparable Modal */}
      {comparableModalLead && (
        <ComparableModal lead={comparableModalLead} onClose={() => setComparableModalLead(null)} />
      )}

      {/* Offer Analysis Modal */}
      {offerModalLead && (
        <OfferAnalysisModal lead={offerModalLead} onClose={() => setOfferModalLead(null)} />
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog(prev => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
      />
      </div>
    </TooltipProvider>
  )
}
