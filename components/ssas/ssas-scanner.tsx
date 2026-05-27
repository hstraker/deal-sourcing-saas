"use client"

/**
 * SsasScanner — main interactive table + analysis panel for SSAS commercial property scanning.
 *
 * Features:
 *  - Table of COMMERCIAL listings with SSAS-specific columns
 *    (Gross Yield, Net Yield, DSCR, Risk Score, Recommendation, Financing)
 *  - Quick-filter chips: STRONG BUY, BUY, CONSIDER, PASS, AVOID + Unanalysed
 *  - Side panel: full SSAS analysis detail, editable assumptions (rent, lease, condition, LTV)
 *  - "Run analysis" button (single or all)
 *  - "Track" button to move to pipeline (watchlist / viewing / offer)
 */

import { useState, useEffect, useCallback, useRef } from "react"
import { toast } from "sonner"
import {
  Search,
  Loader2,
  RefreshCw,
  ExternalLink,
  Play,
  TrendingUp,
  X,
  AlertTriangle,
  CheckCircle2,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { PropertyListingForClient } from "@/types/property-listing"
import type { SsasAnalysisResult, SsasRecommendation } from "@/lib/ssas-analyzer"
import { RECOMMENDATION_STYLES, FINANCING_LABELS } from "@/lib/ssas-analyzer"

// ── Types ─────────────────────────────────────────────────────────────────────

type RecoFilter = SsasRecommendation | "UNANALYSED" | "ALL"

interface AnalysisForm {
  annualRent:   string
  leaseYears:   string
  condition:    string
  tenantType:   string
  loanRate:     string
  loanTerm:     string
  loanLtv:      string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtGBP(n: number): string {
  if (n >= 1_000_000) return `£${(n / 1_000_000).toFixed(2)}m`
  if (n >= 1_000)     return `£${(n / 1_000).toFixed(0)}k`
  return `£${n}`
}

function riskColor(score: number): string {
  if (score >= 75) return "text-green-600"
  if (score >= 55) return "text-amber-600"
  return "text-red-600"
}

function dscrColor(dscr: number): string {
  if (dscr >= 1.4) return "text-green-600"
  if (dscr >= 1.2) return "text-amber-600"
  return "text-red-600"
}

const RECO_FILTERS: { id: RecoFilter; label: string; style: string }[] = [
  { id: "ALL",         label: "All",          style: "bg-gray-100 text-gray-600 border-gray-200" },
  { id: "STRONG BUY", label: "🟢 Strong Buy",  style: "bg-green-100 text-green-700 border-green-200" },
  { id: "BUY",        label: "✅ Buy",         style: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { id: "CONSIDER",   label: "🟡 Consider",    style: "bg-amber-100 text-amber-700 border-amber-200" },
  { id: "PASS",       label: "🟠 Pass",        style: "bg-orange-100 text-orange-700 border-orange-200" },
  { id: "AVOID",      label: "🔴 Avoid",       style: "bg-red-100 text-red-700 border-red-200" },
  { id: "UNANALYSED", label: "⬜ Unanalysed",  style: "bg-slate-100 text-slate-600 border-slate-200" },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function SsasScanner() {
  const [listings, setListings]       = useState<PropertyListingForClient[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState("")
  const [debouncedSearch, setDS]      = useState("")
  const [recoFilter, setRecoFilter]   = useState<RecoFilter>("ALL")
  const [selected, setSelected]       = useState<PropertyListingForClient | null>(null)
  const [analyzing, setAnalyzing]     = useState<string | null>(null)   // id or "all"
  const [bulkAnalyzing, setBulk]      = useState(false)
  const [page, setPage]               = useState(1)
  const [total, setTotal]             = useState(0)
  const searchTimer                   = useRef<NodeJS.Timeout | null>(null)
  const LIMIT = 50

  // Editable analysis form
  const [form, setForm] = useState<AnalysisForm>({
    annualRent: "", leaseYears: "", condition: "Good",
    tenantType: "", loanRate: "6.5", loanTerm: "15", loanLtv: "75",
  })

  // Debounce search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => setDS(search), 400)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [search])

  // Fetch listings
  const fetchListings = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page:     String(p),
        limit:    String(LIMIT),
        category: "COMMERCIAL",
        sortField: "scrapedAt",
        sortDirection: "desc",
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res  = await fetch(`/api/properties/listings?${params}`)
      const data = await res.json()
      if (data.success) {
        setListings(data.listings)
        setTotal(data.pagination.total)
        setPage(p)
      }
    } catch {
      toast.error("Failed to load commercial listings")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch])

  useEffect(() => { fetchListings(1) }, [fetchListings])

  // Filter by recommendation client-side (already fetched)
  const displayed = listings.filter(l => {
    if (recoFilter === "ALL") return true
    const reco = (l.ssasAnalysis as SsasAnalysisResult | null)?.recommendation
    if (recoFilter === "UNANALYSED") return !reco
    return reco === recoFilter
  })

  // Populate form from selected listing
  useEffect(() => {
    if (!selected) return
    const sa = selected.ssasAnalysis as SsasAnalysisResult | null
    const comm = selected.commercialDetails as any
    setForm({
      annualRent: String(selected.annualRent ?? comm?.currentRent ?? ""),
      leaseYears: String(comm?.leaseYearsRemaining ?? ""),
      condition:  "Good",
      tenantType: comm?.currentUse ?? "",
      loanRate:   String(sa?.assumptions?.loanRatePct ?? "6.5"),
      loanTerm:   String(sa?.assumptions?.loanTermYears ?? "15"),
      loanLtv:    String(sa?.assumptions?.loanLtvPct ?? "75"),
    })
  }, [selected])

  // Run analysis on a single listing with current form values
  async function runAnalysis(id: string) {
    setAnalyzing(id)
    try {
      const body: any = {
        id,
        annualRent: parseFloat(form.annualRent) || undefined,
        leaseYears: parseFloat(form.leaseYears) || undefined,
        condition:  form.condition,
        tenantType: form.tenantType,
        loanRate:   parseFloat(form.loanRate) || undefined,
        loanTerm:   parseFloat(form.loanTerm) || undefined,
        loanLtv:    parseFloat(form.loanLtv)  || undefined,
      }
      const res  = await fetch("/api/properties/ssas-analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        // Update local state
        setListings(prev => prev.map(l =>
          l.id === id ? { ...l, ssasAnalysis: data.result, annualRent: body.annualRent ?? l.annualRent } : l
        ))
        setSelected(prev => prev?.id === id ? { ...prev, ssasAnalysis: data.result, annualRent: body.annualRent ?? prev.annualRent } : prev)
        toast.success("Analysis complete")
      } else {
        toast.error(data.error || "Analysis failed")
      }
    } catch {
      toast.error("Failed to run analysis")
    } finally {
      setAnalyzing(null)
    }
  }

  async function runBulkAnalysis() {
    setBulk(true)
    try {
      const res  = await fetch("/api/properties/ssas-analyze", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ all: true }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Analysed ${data.analyzed} commercial properties`)
        fetchListings(page)
      } else {
        toast.error(data.error || "Bulk analysis failed")
      }
    } catch {
      toast.error("Bulk analysis failed")
    } finally {
      setBulk(false)
    }
  }

  // ── Counts for chip badges ─────────────────────────────────────────────────
  const counts: Partial<Record<RecoFilter, number>> = { ALL: listings.length }
  listings.forEach(l => {
    const reco = (l.ssasAnalysis as SsasAnalysisResult | null)?.recommendation
    if (!reco) {
      counts["UNANALYSED"] = (counts["UNANALYSED"] ?? 0) + 1
    } else {
      counts[reco] = (counts[reco] ?? 0) + 1
    }
  })

  // ── Summary stats (recompute from loaded listings) ────────────────────────
  const analyzedListings = listings.filter(l => l.ssasAnalysis)
  const buyCount     = analyzedListings.filter(l => ["STRONG BUY","BUY"].includes((l.ssasAnalysis as SsasAnalysisResult)?.recommendation)).length
  const avgNetYield  = analyzedListings.length > 0
    ? analyzedListings.reduce((acc, l) => acc + ((l.ssasAnalysis as SsasAnalysisResult)?.netYieldPct ?? 0), 0) / analyzedListings.length
    : 0
  const avgRisk      = analyzedListings.length > 0
    ? analyzedListings.reduce((acc, l) => acc + ((l.ssasAnalysis as SsasAnalysisResult)?.riskScore ?? 0), 0) / analyzedListings.length
    : 0

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-3 overflow-hidden">

      {/* ── Summary strip ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3 flex-shrink-0">
        {[
          { label: "Commercial Listings",  value: String(total),                       sub: "in database" },
          { label: "Analysed",             value: String(analyzedListings.length),      sub: `of ${total}` },
          { label: "BUY / STRONG BUY",     value: String(buyCount),                    sub: "opportunities" },
          { label: "Avg Net Yield",         value: avgNetYield > 0 ? `${avgNetYield.toFixed(1)}%` : "—", sub: "of analysed" },
        ].map(s => (
          <div key={s.label} className="ds-card p-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
            <p className="text-2xl font-bold text-gray-900 mt-0.5">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Main flex area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
      {/* ── Left panel: table ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

        {/* Toolbar */}
        <div className="ds-card p-3 mb-3 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search address, postcode…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>

            <div className="text-xs text-gray-400 ml-1">
              {total} commercial {total === 1 ? "property" : "properties"}
            </div>

            <div className="ml-auto flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-9 text-sm gap-1.5"
                onClick={() => fetchListings(page)}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                className="h-9 text-sm gap-1.5 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                onClick={runBulkAnalysis}
                disabled={bulkAnalyzing}
              >
                {bulkAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run All Analysis
              </Button>
            </div>
          </div>

          {/* Recommendation filter chips */}
          <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
            {RECO_FILTERS.map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setRecoFilter(f.id)}
                className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                  recoFilter === f.id
                    ? f.style + " ring-2 ring-offset-1 ring-[#6366f1]"
                    : "bg-white text-gray-400 border-gray-200 hover:border-gray-400"
                }`}
              >
                {f.label}
                {counts[f.id] !== undefined && (
                  <span className="ml-0.5 rounded-full bg-black/10 px-1.5 text-[10px] font-bold">
                    {counts[f.id]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="ds-card overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 bg-white z-10">
                <tr>
                  <th className="table-header w-14" />
                  <th className="table-header">Property</th>
                  <th className="table-header whitespace-nowrap">Price</th>
                  <th className="table-header whitespace-nowrap">Annual Rent</th>
                  <th className="table-header whitespace-nowrap">Gross Yield</th>
                  <th className="table-header whitespace-nowrap">Net Yield</th>
                  <th className="table-header">DSCR</th>
                  <th className="table-header whitespace-nowrap">Risk</th>
                  <th className="table-header">Recommendation</th>
                  <th className="table-header">Financing</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={11} className="table-cell py-16 text-center text-gray-400">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Loading commercial listings…
                    </td>
                  </tr>
                ) : displayed.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="table-cell py-16 text-center">
                      <Building2 className="h-8 w-8 mx-auto mb-3 text-gray-300" />
                      <p className="text-sm text-gray-400">No commercial properties found</p>
                      <p className="text-xs text-gray-300 mt-1">Set up a Commercial scraper criterion to start pulling listings</p>
                    </td>
                  </tr>
                ) : displayed.map(listing => {
                  const sa      = listing.ssasAnalysis as SsasAnalysisResult | null
                  const address = listing.address as any
                  const images  = listing.images as string[]
                  const recoStyle = sa?.recommendation
                    ? RECOMMENDATION_STYLES[sa.recommendation]
                    : null

                  return (
                    <tr
                      key={listing.id}
                      className={`table-row cursor-pointer ${selected?.id === listing.id ? "bg-indigo-50 border-l-2 border-l-[#6366f1]" : ""}`}
                      onClick={() => setSelected(listing)}
                    >
                      {/* Thumbnail */}
                      <td className="table-cell">
                        {images?.[0] ? (
                          <img src={images[0]} alt="" className="h-9 w-14 rounded-md object-cover" />
                        ) : (
                          <div className="h-9 w-14 rounded-md bg-gray-100 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-gray-300" />
                          </div>
                        )}
                      </td>

                      {/* Property */}
                      <td className="table-cell max-w-[200px]">
                        <p className="font-medium text-xs text-gray-800 truncate">{listing.title}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">
                          {address?.displayAddress}
                          {address?.postcode && ` · ${address.postcode}`}
                        </p>
                        <p className="text-[10px] text-gray-300 capitalize">{listing.propertyType?.toLowerCase().replace(/_/g," ")}</p>
                      </td>

                      {/* Price */}
                      <td className="table-cell font-semibold text-gray-800 whitespace-nowrap text-sm">
                        {fmtGBP(listing.price)}
                      </td>

                      {/* Annual rent */}
                      <td className="table-cell text-sm text-gray-600 whitespace-nowrap">
                        {sa && sa.netAnnualIncome > 0
                          ? fmtGBP(Math.round(sa.netAnnualIncome / 0.78))   // back-calc gross rent
                          : listing.annualRent
                            ? fmtGBP(listing.annualRent)
                            : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>

                      {/* Gross yield */}
                      <td className="table-cell">
                        {sa ? (
                          <span className="text-sm font-semibold text-gray-800">{sa.grossYieldPct.toFixed(1)}%</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Net yield */}
                      <td className="table-cell">
                        {sa ? (
                          <span className={`text-sm font-semibold ${sa.netYieldPct >= 5 ? "text-green-600" : sa.netYieldPct >= 3.5 ? "text-amber-600" : "text-red-600"}`}>
                            {sa.netYieldPct.toFixed(1)}%
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* DSCR */}
                      <td className="table-cell">
                        {sa && sa.dscr > 0 ? (
                          <span className={`text-sm font-semibold ${dscrColor(sa.dscr)}`}>
                            {sa.dscr.toFixed(2)}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Risk score */}
                      <td className="table-cell">
                        {sa ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${sa.riskScore >= 75 ? "bg-green-500" : sa.riskScore >= 55 ? "bg-amber-400" : "bg-red-400"}`}
                                style={{ width: `${sa.riskScore}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${riskColor(sa.riskScore)}`}>{sa.riskScore}</span>
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>

                      {/* Recommendation */}
                      <td className="table-cell">
                        {sa && recoStyle ? (
                          <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${recoStyle.bg} ${recoStyle.text} ${recoStyle.border}`}>
                            {sa.recommendation}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">
                            Unanalysed
                          </span>
                        )}
                      </td>

                      {/* Financing */}
                      <td className="table-cell text-xs text-gray-500">
                        {sa ? FINANCING_LABELS[sa.financingStrategy] : "—"}
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={e => { e.stopPropagation(); runAnalysis(listing.id) }}
                            disabled={analyzing === listing.id}
                          >
                            {analyzing === listing.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <TrendingUp className="h-3 w-3" />
                            }
                            Analyse
                          </Button>
                          {listing.listingUrl && (
                            <a
                              href={listing.listingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="inline-flex items-center h-7 w-7 justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-400"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > LIMIT && (
            <div className="border-t border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-400 flex-shrink-0">
              <span>{total} total</span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={page === 1} onClick={() => fetchListings(page - 1)}>Prev</Button>
                <span className="flex items-center px-1">Page {page}</span>
                <Button size="sm" variant="outline" className="h-7 text-xs px-2" disabled={displayed.length < LIMIT} onClick={() => fetchListings(page + 1)}>Next</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right panel: SSAS analysis detail ────────────────────────────── */}
      {selected && (
        <div className="w-[380px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
          {(() => {
            const sa      = selected.ssasAnalysis as SsasAnalysisResult | null
            const address = selected.address as any
            const recoStyle = sa?.recommendation ? RECOMMENDATION_STYLES[sa.recommendation] : null

            return (
              <>
                {/* Header */}
                <div className="ds-card p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-900 leading-tight line-clamp-2">{selected.title}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {address?.displayAddress}
                        {address?.postcode && ` · ${address.postcode}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelected(null)}
                      className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xl font-bold text-gray-900">{fmtGBP(selected.price)}</span>
                    {sa && recoStyle && (
                      <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border ${recoStyle.bg} ${recoStyle.text} ${recoStyle.border}`}>
                        {sa.recommendation}
                      </span>
                    )}
                    {!sa && (
                      <span className="text-[10px] text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">Unanalysed</span>
                    )}
                  </div>

                  {sa?.recommendationReason && (
                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">{sa.recommendationReason}</p>
                  )}
                </div>

                {/* Key metrics */}
                {sa && (
                  <div className="ds-card p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Key Metrics</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Gross Yield",   value: `${sa.grossYieldPct.toFixed(1)}%`, highlight: sa.grossYieldPct >= 5 },
                        { label: "Net Yield",     value: `${sa.netYieldPct.toFixed(1)}%`,   highlight: sa.netYieldPct >= 3.5 },
                        { label: "DSCR",          value: sa.dscr > 0 ? sa.dscr.toFixed(2) : "N/A", highlight: sa.dscrViable },
                        { label: "Risk Score",    value: `${sa.riskScore}/100`,             highlight: sa.riskScore >= 65 },
                        { label: "Net Income",    value: fmtGBP(sa.netAnnualIncome),        highlight: false },
                        { label: "Loan Amount",   value: fmtGBP(sa.loanAmount),             highlight: false },
                        { label: "Loan Repay/yr", value: fmtGBP(sa.annualLoanRepayment),    highlight: false },
                        { label: "Financing",     value: FINANCING_LABELS[sa.financingStrategy], highlight: sa.financingStrategy !== "NOT_VIABLE" },
                      ].map(m => (
                        <div key={m.label} className="bg-gray-50 rounded-lg p-2.5">
                          <p className="text-[10px] text-gray-400 font-medium">{m.label}</p>
                          <p className={`text-sm font-bold mt-0.5 ${m.highlight ? "text-indigo-700" : "text-gray-800"}`}>{m.value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Risk breakdown */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Risk Breakdown</p>
                      {[
                        { label: "Location",  val: sa.riskBreakdown.location,  max: 10  },
                        { label: "Tenant",    val: sa.riskBreakdown.tenant,    max: 15  },
                        { label: "Condition", val: sa.riskBreakdown.condition,  max: 15  },
                        { label: "Financing", val: sa.riskBreakdown.financing,  max: 25  },
                        { label: "Lease",     val: sa.riskBreakdown.lease,     max: 20  },
                        { label: "Market",    val: sa.riskBreakdown.market,    max: 15  },
                      ].map(r => (
                        <div key={r.label} className="flex items-center gap-2 mb-1.5">
                          <span className="text-[10px] text-gray-400 w-16 shrink-0">{r.label}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${(r.val / r.max) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-500 w-8 text-right">{r.val}/{r.max}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Green / Red flags */}
                {sa && (sa.greenFlags.length > 0 || sa.redFlags.length > 0) && (
                  <div className="ds-card p-4 space-y-2">
                    {sa.greenFlags.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                    {sa.redFlags.map(f => (
                      <div key={f} className="flex items-start gap-2 text-xs text-red-700">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>
                )}

                {/* Re-analyze form */}
                <div className="ds-card p-4">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {sa ? "Adjust Assumptions & Re-Run" : "Enter Details & Analyse"}
                  </p>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">Annual Rent (£)</label>
                        <Input
                          value={form.annualRent}
                          onChange={e => setForm(p => ({ ...p, annualRent: e.target.value }))}
                          placeholder="e.g. 12000"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">Lease Years</label>
                        <Input
                          value={form.leaseYears}
                          onChange={e => setForm(p => ({ ...p, leaseYears: e.target.value }))}
                          placeholder="e.g. 5"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-medium block mb-1">Tenant</label>
                      <Input
                        value={form.tenantType}
                        onChange={e => setForm(p => ({ ...p, tenantType: e.target.value }))}
                        placeholder="e.g. National chain, Local business…"
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400 font-medium block mb-1">Condition</label>
                      <select
                        value={form.condition}
                        onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}
                        className="w-full h-8 text-sm rounded-md border border-input bg-background px-3"
                      >
                        {["Excellent","Good","Fair","Poor"].map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider pt-1">Loan-Back Assumptions</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">Rate %</label>
                        <Input value={form.loanRate} onChange={e => setForm(p => ({ ...p, loanRate: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">Term (yrs)</label>
                        <Input value={form.loanTerm} onChange={e => setForm(p => ({ ...p, loanTerm: e.target.value }))} className="h-8 text-sm" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 font-medium block mb-1">LTV %</label>
                        <Input value={form.loanLtv} onChange={e => setForm(p => ({ ...p, loanLtv: e.target.value }))} className="h-8 text-sm" />
                      </div>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-9 bg-[#6366f1] hover:bg-[#4f46e5] text-white gap-1.5 text-sm"
                      onClick={() => runAnalysis(selected.id)}
                      disabled={analyzing === selected.id}
                    >
                      {analyzing === selected.id
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Analysing…</>
                        : <><TrendingUp className="h-3.5 w-3.5" /> Run SSAS Analysis</>
                      }
                    </Button>
                  </div>
                </div>

                {/* Quick links */}
                <div className="ds-card p-4 flex gap-2 flex-wrap">
                  {selected.listingUrl && (
                    <a
                      href={selected.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <ExternalLink className="h-3 w-3" /> View Listing
                    </a>
                  )}
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selected.address as any)?.displayAddress ?? "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
                  >
                    📍 Street View
                  </a>
                </div>

                {/* Assumptions note */}
                {sa && (
                  <div className="px-1 pb-2">
                    <p className="text-[10px] text-gray-300 leading-relaxed">
                      Analysis assumes {sa.assumptions.expenseRatio * 100}% expense ratio, {sa.assumptions.loanLtvPct}% LTV loan-back at {sa.assumptions.loanRatePct}% over {sa.assumptions.loanTermYears}y.
                      DSCR must exceed 1.2 for loan-back viability. Adjust assumptions above and re-run.
                    </p>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}
      </div>{/* end main flex area */}
    </div>
  )
}
