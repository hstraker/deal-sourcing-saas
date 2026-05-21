"use client"

import { useState, useEffect, useRef } from "react"
import {
  TrendingUp, TrendingDown, Minus, Clock, Tag, RefreshCw,
  AlertTriangle, CheckCircle, Zap, Building2, Leaf,
  ChevronDown, ChevronUp, BarChart3, Home, Loader2, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SoldTransaction {
  address:      string
  salePrice:    number
  saleDate:     string
  bedrooms:     number
  propertyType: string
}

interface FlipRecord {
  buyPrice:  number
  sellPrice: number
  buyDate:   string
  sellDate:  string
  gainPct:   number
}

interface ListingEntry {
  address:         string
  listedPrice:     number
  finalPrice:      number | null
  daysListed:      number | null
  dateListed:      string | null
  dateRemoved:     string | null
  source:          string
  url:             string | null
  priceReductions: number
  agent:           { name: string; phone: string | null; branch: string | null } | null
}

interface EpcRecord {
  lodgementDate:    string | null
  currentRating:    string | null
  currentScore:     number | null
  potentialRating:  string | null
  potentialScore:   number | null
  propertyType:     string | null
  heatingType:      string | null
  address:          string
}

interface HistoryData {
  address:  string
  postcode: string
  fetchedAt: string
  soldHistory: {
    transactions:     SoldTransaction[]
    transactionCount: number
    firstSalePrice:   number | null
    firstSaleDate:    string | null
    lastSalePrice:    number | null
    lastSaleDate:     string | null
    gainPct:          number | null
    flips:            FlipRecord[]
    areaAvgPrice:     number | null
    soldBelowAreaAvg: boolean
  }
  listingHistory: {
    listings:             ListingEntry[]
    count:                number
    totalReductions:      number
    totalReductionAmount: number
    maxDaysOnMarket:      number
    hasFailedSale:        boolean
    originalListingPrice: number | null
  }
  epc: {
    records:         EpcRecord[]
    latestRating:    string | null
    latestScore:     number | null
    potentialRating: string | null
    potentialScore:  number | null
    improvementGap:  number | null
    ratingHistory:   { date: string | null; rating: string | null; score: number | null }[]
  }
  ownership: {
    records:     any[]
    isCorporate: boolean
    isOverseas:  boolean
    companyName: string | null
    companyRegNo:string | null
  }
  distress: {
    score:   number
    label:   "High" | "Moderate" | "Low"
    signals: string[]
  }
}

interface AiAnalysis {
  narrative:       string
  offerStrategy:   string
  keyFlags:        string[]
  pricingVerdict:  "overpriced" | "fair" | "underpriced" | "unknown"
  motivationRead:  string
  negotiationTip:  string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null) return "—"
  return `£${n.toLocaleString("en-GB")}`
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return "—"
  try {
    return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return s
  }
}

function epcColour(rating: string | null): string {
  const map: Record<string, string> = {
    A: "bg-green-600", B: "bg-green-500", C: "bg-lime-500",
    D: "bg-yellow-400 text-gray-900", E: "bg-orange-400", F: "bg-red-500", G: "bg-red-700",
  }
  return rating ? (map[rating.toUpperCase()] ?? "bg-gray-400") : "bg-gray-300"
}

function distressColour(label: string) {
  if (label === "High")     return { bg: "bg-red-50 border-red-200",    text: "text-red-700",    dot: "bg-red-500" }
  if (label === "Moderate") return { bg: "bg-amber-50 border-amber-200", text: "text-amber-700",  dot: "bg-amber-500" }
  return                           { bg: "bg-green-50 border-green-200", text: "text-green-700",  dot: "bg-green-500" }
}

function pricingBadge(v: string | undefined) {
  if (v === "overpriced")  return { label: "Overpriced",   cls: "bg-red-100 text-red-700" }
  if (v === "underpriced") return { label: "Underpriced",  cls: "bg-green-100 text-green-700" }
  if (v === "fair")        return { label: "Fair Value",   cls: "bg-blue-100 text-blue-700" }
  return                          { label: "Unknown",      cls: "bg-gray-100 text-gray-600" }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, defaultOpen = true }:
  { title: string; icon: any; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800">{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="border-t border-gray-100 px-4 py-3">{children}</div>}
    </div>
  )
}

function StatPill({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-lg border px-3 py-2.5 text-center",
      highlight ? "border-blue-200 bg-blue-50" : "border-gray-200 bg-gray-50"
    )}>
      <span className={cn("text-base font-bold", highlight ? "text-blue-700" : "text-gray-900")}>{value}</span>
      <span className="text-[10px] text-gray-500 mt-0.5">{label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface PropertyHistoryTabProps {
  leadId:     string
  postcode:   string
  address:    string
  cachedData?: any | null
}

export function PropertyHistoryTab({ leadId, postcode, address, cachedData }: PropertyHistoryTabProps) {
  const [loading, setLoading]   = useState(false)
  const [data, setData]         = useState<HistoryData | null>(cachedData ?? null)
  const [error, setError]       = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [ai, setAi]             = useState<AiAnalysis | null>(null)
  const fetchedRef              = useRef(!!cachedData)

  // Auto-fetch on mount if no cached data
  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true
      fetchHistory()
    }
  }, [])

  async function fetchHistory(force = false) {
    setLoading(true)
    setError(null)
    try {
      const url = `/api/vendor-leads/${leadId}/property-history${force ? "?force=true" : ""}`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Failed to load property history")
      setData(json.data as HistoryData)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  async function runAiAnalysis() {
    if (!data) return
    setAiLoading(true)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/property-history/analyse`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ historyData: data }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Analysis failed")
      setAi(json.analysis)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setAiLoading(false)
    }
  }

  // ── Empty / loading state ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Loading property intelligence…</p>
        <p className="text-xs">Checking Land Registry, portals & EPC data</p>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <AlertTriangle className="h-8 w-8 text-amber-500" />
        <p className="text-sm font-semibold text-gray-700">Could not load history</p>
        <p className="text-xs text-gray-500">{error}</p>
        <button
          onClick={() => fetchHistory(false)}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Home className="h-8 w-8 text-gray-300" />
        <p className="text-sm font-semibold text-gray-600">No History Loaded</p>
        <button
          onClick={() => fetchHistory(false)}
          className="mt-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          Load Property History
        </button>
      </div>
    )
  }

  const { soldHistory, listingHistory, epc, ownership, distress } = data
  const dc = distressColour(distress.label)

  return (
    <div className="space-y-4">
      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">
            Last updated {fmtDate(data.fetchedAt)} ·{" "}
            <button onClick={() => fetchHistory(true)} className="text-blue-500 hover:underline">
              Refresh
            </button>
          </p>
        </div>
        <button
          onClick={runAiAnalysis}
          disabled={aiLoading}
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow hover:opacity-90 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {aiLoading ? "Analysing…" : "AI Analysis"}
        </button>
      </div>

      {/* ── Distress score banner ────────────────────────────────────────────── */}
      <div className={cn("rounded-xl border p-4", dc.bg)}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", dc.dot)} />
            <span className={cn("text-sm font-bold", dc.text)}>
              {distress.label} Distress · {distress.score}/100
            </span>
          </div>
          {/* Score bar */}
          <div className="w-24 h-2 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", distress.score >= 60 ? "bg-red-500" : distress.score >= 30 ? "bg-amber-400" : "bg-green-500")}
              style={{ width: `${distress.score}%` }}
            />
          </div>
        </div>
        {distress.signals.length > 0 && (
          <ul className="space-y-1">
            {distress.signals.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" />
                {s}
              </li>
            ))}
          </ul>
        )}
        {distress.signals.length === 0 && (
          <p className="text-xs text-gray-500">No significant distress signals detected</p>
        )}
      </div>

      {/* ── AI Analysis card ─────────────────────────────────────────────────── */}
      {ai && (
        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 to-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span className="text-sm font-bold text-violet-900">AI Property Intelligence</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold", pricingBadge(ai.pricingVerdict).cls)}>
                {pricingBadge(ai.pricingVerdict).label}
              </span>
              <button onClick={runAiAnalysis} disabled={aiLoading} className="text-violet-400 hover:text-violet-600">
                <RefreshCw className="h-3 w-3" />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-700 leading-relaxed">{ai.narrative}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-white/70 border border-violet-100 p-3">
              <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">Offer Strategy</p>
              <p className="text-xs text-gray-700">{ai.offerStrategy}</p>
            </div>
            <div className="rounded-lg bg-white/70 border border-violet-100 p-3">
              <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-1">Motivation Read</p>
              <p className="text-xs text-gray-700">{ai.motivationRead}</p>
            </div>
          </div>

          {ai.keyFlags?.length > 0 && (
            <div className="rounded-lg bg-white/70 border border-violet-100 p-3">
              <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wide mb-2">Key Signals</p>
              <ul className="space-y-1">
                {ai.keyFlags.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-700">
                    <Zap className="h-3 w-3 mt-0.5 flex-shrink-0 text-violet-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Negotiation Tip</p>
            <p className="text-xs text-gray-700">{ai.negotiationTip}</p>
          </div>
        </div>
      )}

      {/* ── Sold price history ───────────────────────────────────────────────── */}
      <SectionCard title="Sold Price History" icon={BarChart3}>
        {soldHistory.transactionCount === 0 ? (
          <p className="text-xs text-gray-400 py-2">No Land Registry transactions found for this address</p>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatPill label="Last Sold" value={fmt(soldHistory.lastSalePrice)} highlight />
              <StatPill label="Area Average" value={fmt(soldHistory.areaAvgPrice)} />
              <StatPill
                label="Gain Since Purchase"
                value={soldHistory.gainPct != null ? `${soldHistory.gainPct > 0 ? "+" : ""}${soldHistory.gainPct}%` : "—"}
              />
            </div>

            {/* Transaction list */}
            <div className="space-y-2">
              {soldHistory.transactions.map((tx, i) => {
                const isLatest = i === soldHistory.transactions.length - 1
                return (
                  <div key={i} className={cn(
                    "flex items-center justify-between rounded-lg border px-3 py-2.5",
                    isLatest ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-gray-50"
                  )}>
                    <div className="flex items-center gap-2.5">
                      <div className={cn("h-2 w-2 rounded-full flex-shrink-0", isLatest ? "bg-blue-500" : "bg-gray-300")} />
                      <div>
                        <p className="text-xs font-semibold text-gray-800">{fmt(tx.salePrice)}</p>
                        <p className="text-[10px] text-gray-400">{fmtDate(tx.saleDate)}</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400 capitalize">
                      {tx.propertyType?.toLowerCase() ?? "—"}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Flip alert */}
            {soldHistory.flips.length > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Investor Flip Detected</span>
                </div>
                {soldHistory.flips.map((f, i) => (
                  <p key={i} className="text-xs text-gray-600">
                    Bought {fmt(f.buyPrice)} ({fmtDate(f.buyDate)}) → Sold {fmt(f.sellPrice)} ({fmtDate(f.sellDate)}) ·{" "}
                    <span className={f.gainPct >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                      {f.gainPct >= 0 ? "+" : ""}{f.gainPct}%
                    </span>
                  </p>
                ))}
              </div>
            )}

            {/* Below area average flag */}
            {soldHistory.soldBelowAreaAvg && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
                <TrendingDown className="h-3.5 w-3.5" />
                Last sold below area average — vendor may accept less again
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Listing history ──────────────────────────────────────────────────── */}
      <SectionCard title="Listing History" icon={Clock}>
        {listingHistory.count === 0 ? (
          <p className="text-xs text-gray-400 py-2">No listing history found for this address</p>
        ) : (
          <>
            {/* Summary pills */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <StatPill label="Times Listed"      value={String(listingHistory.count)} />
              <StatPill label="Max Days on Market" value={listingHistory.maxDaysOnMarket > 0 ? `${listingHistory.maxDaysOnMarket}d` : "—"} />
              <StatPill label="Total Reductions"  value={String(listingHistory.totalReductions)} />
            </div>

            {listingHistory.hasFailedSale && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                <p className="text-xs text-red-700 font-medium">
                  Property was withdrawn without a confirmed sale — likely failed transaction
                </p>
              </div>
            )}

            {listingHistory.totalReductionAmount > 0 && (
              <div className="mb-3 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <Tag className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  Total reduction: {fmt(listingHistory.totalReductionAmount)} from original asking {fmt(listingHistory.originalListingPrice ?? undefined)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {listingHistory.listings.map((l, i) => (
                <div key={i} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-gray-800">{fmt(l.listedPrice)}</span>
                    <span className="text-[10px] text-gray-400 capitalize">{l.source}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {l.dateListed && <span>Listed {fmtDate(l.dateListed)}</span>}
                    {l.daysListed != null && <span>{l.daysListed}d on market</span>}
                    {l.priceReductions > 0 && (
                      <span className="text-amber-600 font-medium">{l.priceReductions} reduction{l.priceReductions > 1 ? "s" : ""}</span>
                    )}
                    {l.finalPrice && l.finalPrice < l.listedPrice && (
                      <span className="text-green-600 font-medium">Sold {fmt(l.finalPrice)}</span>
                    )}
                  </div>
                  {l.agent?.name && (
                    <p className="text-[10px] text-gray-400 mt-1">{l.agent.name}{l.agent.branch ? ` · ${l.agent.branch}` : ""}</p>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── EPC History ──────────────────────────────────────────────────────── */}
      <SectionCard title="EPC Energy History" icon={Leaf}>
        {epc.records.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No EPC certificates found for this address</p>
        ) : (
          <>
            {/* Current + potential */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex flex-col items-center">
                <span className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg font-extrabold", epcColour(epc.latestRating))}>
                  {epc.latestRating ?? "?"}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">Current</span>
              </div>
              <div className="flex-1 h-px bg-gray-200 relative">
                {epc.improvementGap != null && epc.improvementGap > 0 && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] text-gray-400 bg-white px-1">
                    +{epc.improvementGap} pts possible
                  </span>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className={cn("h-10 w-10 rounded-lg flex items-center justify-center text-white text-lg font-extrabold opacity-60", epcColour(epc.potentialRating))}>
                  {epc.potentialRating ?? "?"}
                </span>
                <span className="text-[10px] text-gray-400 mt-1">Potential</span>
              </div>
            </div>

            {/* EPC history timeline */}
            {epc.ratingHistory.length > 1 && (
              <div className="space-y-1.5 mb-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Rating History</p>
                {epc.ratingHistory.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className={cn("h-5 w-5 rounded text-white text-[10px] font-bold flex items-center justify-center", epcColour(r.rating))}>
                      {r.rating ?? "?"}
                    </span>
                    <span>{fmtDate(r.date)}</span>
                    {r.score != null && <span className="text-gray-400">({r.score} pts)</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Additional EPC detail */}
            {epc.records[0] && (
              <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500">
                {epc.records[0].heatingType && <span>Heating: {epc.records[0].heatingType}</span>}
                {epc.records[0].propertyType && <span>Type: {epc.records[0].propertyType}</span>}
              </div>
            )}
          </>
        )}
      </SectionCard>

      {/* ── Ownership ────────────────────────────────────────────────────────── */}
      <SectionCard title="Ownership Intelligence" icon={Building2} defaultOpen={false}>
        {!ownership.isCorporate && !ownership.isOverseas && ownership.records.length === 0 ? (
          <p className="text-xs text-gray-400 py-2">No corporate or overseas ownership records found — likely individual owner</p>
        ) : (
          <div className="space-y-2">
            {ownership.isCorporate && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <Building2 className="h-3.5 w-3.5 text-amber-600" />
                  <span className="text-xs font-bold text-amber-700">Corporate Ownership</span>
                </div>
                <p className="text-xs text-gray-600">{ownership.companyName}</p>
                {ownership.companyRegNo && (
                  <a
                    href={`https://find-and-update.company-information.service.gov.uk/company/${ownership.companyRegNo}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    Companies House: {ownership.companyRegNo} ↗
                  </a>
                )}
              </div>
            )}
            {ownership.isOverseas && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <p className="text-xs font-bold text-red-700">Overseas Registered Company</p>
                <p className="text-xs text-gray-600 mt-0.5">May require additional due diligence</p>
              </div>
            )}
            {!ownership.isCorporate && !ownership.isOverseas && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <CheckCircle className="h-3.5 w-3.5" />
                Individual / private ownership
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}
