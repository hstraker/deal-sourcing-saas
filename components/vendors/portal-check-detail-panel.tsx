"use client"
import { toast } from "sonner"

/**
 * PortalCheckDetailPanel — full detail view of the latest VendorPropertyCheck.
 * Shows flags, active listing, LR/PPD data, a "Re-run" button, and check history.
 *
 * Used inside the "Portal Check" tab of the vendor lead detail modal.
 */

import { useState, useEffect, useCallback } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw, Loader2, ExternalLink, ShieldCheck, ShieldAlert,
  AlertTriangle, Building2, Clock, TrendingDown, FlaskConical, Calendar,
  Search, Phone, Wifi, WifiOff, CheckCircle2, XCircle, MinusCircle,
  Droplets, Mountain, Sparkles, Map,
} from "lucide-react"
import { PortalCheckBadge } from "./portal-check-badge"
import { formatDistanceToNow, format } from "date-fns"

// Leaflet map — must be dynamically imported (requires browser APIs)
const FloodMap = dynamic(
  () => import("./flood-map").then((m) => m.FloodMap),
  {
    ssr: false,
    loading: () => (
      <div className="h-[300px] rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center text-xs text-gray-400">
        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading map…
      </div>
    ),
  }
)

// ---------------------------------------------------------------------------
// Types (mirrors API response shapes)
// ---------------------------------------------------------------------------

interface PortalFlag {
  code: string
  severity: "clear" | "caution" | "red_flag"
  label: string
  detail: string
}

interface ActiveListing {
  address: string
  price: number
  originalPrice?: number
  daysListed?: number
  dateListed?: string
  source: string
  url: string
  agent?: { name?: string; phone?: string; branch?: string }
  priceReductions?: number
}

interface ScrapedPortalListing {
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  listingUrl: string | null
  price: number
  status: "FOR_SALE" | "SOLD_STC" | "UNDER_OFFER"
  daysOnMarket: number
  hasReduction: boolean
  reductionPct: number | null
  originalPrice: number | null
  agent: { name?: string; branch?: string; phone?: string }
  scrapedAt: string
  propertyType: string
  bedrooms: number
}

interface LivePortalListing {
  listingUrl: string | null
  price: number
  address: string
  isSoldSTC: boolean
  bedrooms: number | null
  propertyType: string | null
  agent: { name?: string; phone?: string } | null
}

interface LivePortalResult {
  source: "RIGHTMOVE" | "ZOOPLA" | "ONTHEMARKET" | "PRIMELOCATION"
  status: "success" | "no_listings" | "blocked" | "error"
  listings: LivePortalListing[]
  matchedListings: LivePortalListing[]
  errorMessage?: string
}

interface FreeholdsTitle {
  titleNumber: string
  titleClass: string
  leaseholds: number
  distance: string
  lat: number
  lng: number
  polygonId: number
}

interface CheckRecord {
  id: string
  triggeredBy: string
  triggeredAt: string
  completedAt: string | null
  checkStatus: string
  overallRisk: string
  riskScore: number
  isMockData: boolean
  mockScenarioId: string | null
  durationMs: number | null
  summaryFlags?: PortalFlag[]
  portalCheckRaw?: {
    activeListing?: ActiveListing | null
    activeListingCount?: number
    recentlyDelisted?: boolean
    raw?: { forSale?: { listings?: ActiveListing[] } }
    scrapedMatches?: ScrapedPortalListing[]
    liveResults?: LivePortalResult[]
    blockedPortals?: string[]
  }
  ownershipCheckRaw?: {
    isCorporateOwned?: boolean
    isOverseasOwned?: boolean
    isPortfolioOwner?: boolean
    companyName?: string | null
    lastSalePrice?: number | null
    lastSaleDate?: string | null
    tenure?: string | null
    equityEstimate?: number | null
    freeholds?: {
      inferredTenure: 'freehold' | 'leasehold' | 'unknown'
      resultCount: number
      nearestTitle: FreeholdsTitle | null
      nearestTitleDetail?: {
        ownershipType: string
        ownerName?: string
        plotSizeAcres: string | null
        leaseholdTitleNumbers: string[]
        uprns: number[]
      } | null
      allTitles: FreeholdsTitle[]
    }
  }
  recommendedAction?: string
  errorMessage?: string
}

interface PortalCheckDetailPanelProps {
  leadId: string
  postcode?: string | null
  latestCheckRisk: string | null
  latestCheckedAt: string | null
  onRiskUpdated?: (newRisk: string | null, newDate: string | null) => void
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

const FLAG_SEVERITY_STYLE: Record<string, string> = {
  clear:    "border-green-200 bg-green-50 text-green-800",
  caution:  "border-amber-200 bg-amber-50 text-amber-800",
  red_flag: "border-red-200 bg-red-50 text-red-800",
}

const FLAG_ICON: Record<string, React.ReactNode> = {
  clear:    <ShieldCheck className="h-4 w-4 text-green-600" />,
  caution:  <AlertTriangle className="h-4 w-4 text-amber-600" />,
  red_flag: <ShieldAlert className="h-4 w-4 text-red-600" />,
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PortalCheckDetailPanel({
  leadId,
  postcode,
  latestCheckRisk,
  latestCheckedAt,
  onRiskUpdated,
}: PortalCheckDetailPanelProps) {
  const [check, setCheck] = useState<CheckRecord | null>(null)
  const [history, setHistory] = useState<CheckRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  const fetchResults = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/check-results`)
      if (!res.ok) throw new Error("Failed to load check results")
      const data = await res.json()
      setCheck(data.latestCheck ?? null)
      setHistory(data.history ?? [])
    } catch (err: any) {
      toast.error("Failed to load check results", { description: err.message })
    } finally {
      setLoading(false)
    }
  }, [leadId, toast])

  useEffect(() => { fetchResults() }, [fetchResults])

  const runCheck = async () => {
    setIsRunning(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/run-check`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Check failed")
      toast.success("Check complete", {
        description: `Risk level: ${data.overallRisk?.replace("_", " ")} • ${data.flagCount} flag(s)`,
      })
      onRiskUpdated?.(data.overallRisk, new Date().toISOString())
      await fetchResults()
    } catch (err: any) {
      toast.error("Check failed", { description: err.message })
    } finally {
      setIsRunning(false)
    }
  }

  // --------------- Render ---------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PortalCheckBadge risk={(latestCheckRisk ?? check?.overallRisk) as any} isMockData={check?.isMockData} />
          {latestCheckedAt && (
            <span className="text-xs text-gray-400">
              Last checked {formatDistanceToNow(new Date(latestCheckedAt), { addSuffix: true })}
            </span>
          )}
          {check?.isMockData && (
            <span className="inline-flex items-center gap-1 text-xs text-purple-600">
              <FlaskConical className="h-3 w-3" />
              Mock — {check.mockScenarioId?.replace(/_/g, " ")}
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={runCheck}
          disabled={isRunning}
          className="flex items-center gap-1.5"
        >
          {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isRunning ? "Running…" : "Re-run Check"}
        </Button>
      </div>

      {!check ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-gray-400 text-sm">
          No check has been run yet. Click &quot;Re-run Check&quot; to analyse this property.
        </div>
      ) : check.checkStatus === "failed" ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-800">Portal check failed</p>
                {check.errorMessage && (
                  <p className="text-xs text-red-700 mt-1 font-mono bg-red-100 rounded px-2 py-1.5 mt-2 break-all">
                    {check.errorMessage}
                  </p>
                )}
                <p className="text-xs text-red-600 mt-2">
                  This is usually caused by: a Puppeteer/browser issue on the server, a missing API key, or a network timeout. Check server logs with <code className="bg-red-100 px-1 rounded">pm2 logs dealapp --lines 100</code>
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span>{format(new Date(check.triggeredAt), "d MMM yyyy HH:mm")}</span>
            <span>Triggered by: {check.triggeredBy}</span>
            {check.durationMs && <span>{check.durationMs}ms</span>}
          </div>
        </div>
      ) : (
        <>
          {/* Recommended action banner */}
          {check.recommendedAction && (
            <div className={`rounded-lg border p-3 text-sm ${
              check.overallRisk === "red_flag"
                ? "bg-red-50 border-red-200 text-red-800"
                : check.overallRisk === "caution"
                ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-green-50 border-green-200 text-green-800"
            }`}>
              <p className="font-medium">{check.recommendedAction}</p>
            </div>
          )}

          {/* Flags */}
          {(check.summaryFlags?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Flags</h4>
              <div className="space-y-2">
                {check.summaryFlags!.map((flag) => (
                  <div
                    key={flag.code}
                    className={`flex gap-3 rounded-lg border p-3 text-sm ${FLAG_SEVERITY_STYLE[flag.severity]}`}
                  >
                    <div className="flex-shrink-0 mt-0.5">{FLAG_ICON[flag.severity]}</div>
                    <div>
                      <p className="font-semibold">{flag.label}</p>
                      <p className="text-xs opacity-80 mt-0.5">{flag.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active listing (PropertyData API) */}
          {check.portalCheckRaw?.activeListing && (
            <>
              <div className="border-t border-[var(--ds-border)]" />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Active Listing (PropertyData)</h4>
                <ActiveListingCard listing={check.portalCheckRaw.activeListing} />
              </div>
            </>
          )}

          {/* Live portal check results */}
          {(check.portalCheckRaw?.liveResults?.length ?? 0) > 0 && (
            <>
              <div className="border-t border-[var(--ds-border)]" />
              <LivePortalSection
                results={check.portalCheckRaw!.liveResults!}
                blockedPortals={check.portalCheckRaw?.blockedPortals ?? []}
              />
            </>
          )}

          {/* Scraped portal database matches */}
          {(check.portalCheckRaw?.scrapedMatches?.length ?? 0) > 0 && (
            <>
              <div className="border-t border-[var(--ds-border)]" />
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
                  <Search className="h-3.5 w-3.5" />
                  Portal Database Matches (Our Scraped Data)
                </h4>
                <div className="space-y-2">
                  {check.portalCheckRaw!.scrapedMatches!.map((listing, i) => (
                    <ScrapedListingCard key={i} listing={listing} />
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Ownership data */}
          {check.ownershipCheckRaw && (
            <>
              <div className="border-t border-[var(--ds-border)]" />
              <OwnershipSection data={check.ownershipCheckRaw} />
            </>
          )}

          {/* Error */}
          {check.checkStatus === "failed" && check.errorMessage && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <p className="font-semibold">Check failed</p>
              <p className="text-xs mt-1 opacity-80">{check.errorMessage}</p>
            </div>
          )}

          {/* Check metadata */}
          <div className="flex flex-wrap gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(check.triggeredAt), "d MMM yyyy HH:mm")}
            </span>
            {check.durationMs && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {check.durationMs}ms
              </span>
            )}
            <span>Triggered by: {check.triggeredBy}</span>
            <span>Risk score: {check.riskScore}/100</span>
          </div>
        </>
      )}

      {/* History */}
      {history.length > 1 && (
        <>
          <div className="border-t border-[var(--ds-border)]" />
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Check History</h4>
            <div className="space-y-1">
              {history.map((h) => (
                <div key={h.id} className="py-1 space-y-0.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <PortalCheckBadge risk={h.overallRisk as any} isMockData={h.isMockData} />
                      <span className="text-gray-400">
                        {format(new Date(h.triggeredAt), "d MMM HH:mm")} · {h.triggeredBy}
                      </span>
                      {h.isMockData && <span className="text-purple-500">🧪</span>}
                    </div>
                    <span className={h.checkStatus === "failed" ? "text-red-500 font-medium" : "text-gray-400"}>
                      {h.checkStatus}
                    </span>
                  </div>
                  {h.checkStatus === "failed" && (h as any).errorMessage && (
                    <p className="text-[10px] text-red-500 pl-1 truncate max-w-[400px]">
                      ↳ {(h as any).errorMessage}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ActiveListingCard({ listing }: { listing: ActiveListing }) {
  const priceReduced = listing.originalPrice && listing.originalPrice > listing.price
  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold capitalize">{listing.source}</p>
          {listing.agent?.name && (
            <p className="text-xs text-gray-400">{listing.agent.name}{listing.agent.branch ? ` · ${listing.agent.branch}` : ""}</p>
          )}
        </div>
        <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs">
          <a href={listing.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </a>
        </Button>
      </div>
      <div className="flex flex-wrap gap-4 text-xs">
        <span>
          <span className="font-semibold">£{listing.price.toLocaleString()}</span>
          {priceReduced && (
            <span className="text-gray-400 line-through ml-1">£{listing.originalPrice?.toLocaleString()}</span>
          )}
        </span>
        {listing.daysListed !== undefined && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {listing.daysListed} days listed
          </span>
        )}
        {(listing.priceReductions ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <TrendingDown className="h-3 w-3" />
            {listing.priceReductions} reduction{listing.priceReductions! > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Live portal section
// ---------------------------------------------------------------------------

const PORTAL_LABEL: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

const LIVE_STATUS_CONFIG: Record<string, {
  icon: React.ReactNode
  label: string
  className: string
}> = {
  success:     { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,  label: "Checked",     className: "text-green-700" },
  no_listings: { icon: <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />,  label: "Not listed",  className: "text-green-700" },
  blocked:     { icon: <WifiOff className="h-3.5 w-3.5 text-amber-500" />,        label: "Blocked",     className: "text-amber-600" },
  error:       { icon: <XCircle className="h-3.5 w-3.5 text-red-500" />,          label: "Error",       className: "text-red-600" },
}

function LivePortalSection({
  results,
  blockedPortals,
}: {
  results: LivePortalResult[]
  blockedPortals: string[]
}) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
        <Wifi className="h-3.5 w-3.5" />
        Live Portal Check (Direct Fetch)
      </h4>

      {/* Per-portal status grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {results.map((r) => {
          const cfg = LIVE_STATUS_CONFIG[r.status] ?? LIVE_STATUS_CONFIG.error
          const hasMatch = r.matchedListings.length > 0
          return (
            <div
              key={r.source}
              className={`rounded-lg border p-2 text-xs space-y-1 ${
                hasMatch
                  ? "border-red-200 bg-red-50"
                  : r.status === "blocked" || r.status === "error"
                  ? "border-amber-200 bg-amber-50"
                  : "border-green-200 bg-green-50"
              }`}
            >
              <p className="font-semibold">{PORTAL_LABEL[r.source]}</p>
              <div className={`flex items-center gap-1 ${cfg.className}`}>
                {cfg.icon}
                <span>
                  {hasMatch
                    ? `${r.matchedListings.length} match${r.matchedListings.length > 1 ? "es" : ""}`
                    : r.status === "success"
                    ? "Not listed"
                    : cfg.label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Blocked portals warning */}
      {blockedPortals.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">
              {blockedPortals.map((p) => PORTAL_LABEL[p] ?? p).join(", ")}
            </span>{" "}
            could not be fetched directly (Cloudflare / RSC streaming). Results
            shown for successfully checked portals only. Re-run using the full
            scraper for complete coverage.
          </span>
        </div>
      )}

      {/* Matched listings detail */}
      {results.some((r) => r.matchedListings.length > 0) && (
        <div className="space-y-2">
          {results
            .filter((r) => r.matchedListings.length > 0)
            .flatMap((r) =>
              r.matchedListings.map((l, i) => (
                <div key={`${r.source}-${i}`} className="rounded-lg border border-red-200 bg-white p-3 text-sm space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-red-700">{PORTAL_LABEL[r.source]}</p>
                      {l.agent?.name && (
                        <p className="text-xs text-gray-400">{l.agent.name}</p>
                      )}
                    </div>
                    {l.listingUrl && (
                      <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs flex-shrink-0">
                        <a href={l.listingUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 mr-1" />
                          View
                        </a>
                      </Button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                    <span className="font-semibold text-gray-900">£{l.price.toLocaleString()}</span>
                    {l.isSoldSTC && (
                      <span className="text-amber-600 font-medium">Sold STC</span>
                    )}
                    {l.bedrooms && <span>{l.bedrooms} bed</span>}
                    {l.propertyType && <span>{l.propertyType}</span>}
                    {l.agent?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {l.agent.phone}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
        </div>
      )}
    </div>
  )
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  FOR_SALE:    { label: "For Sale",     className: "text-blue-700 bg-blue-50 border-blue-200" },
  SOLD_STC:    { label: "Sold STC",     className: "text-amber-700 bg-amber-50 border-amber-200" },
  UNDER_OFFER: { label: "Under Offer",  className: "text-amber-700 bg-amber-50 border-amber-200" },
}

function ScrapedListingCard({ listing }: { listing: ScrapedPortalListing }) {
  const priceReduced = listing.hasReduction && listing.originalPrice && listing.originalPrice > listing.price
  const statusMeta = STATUS_LABEL[listing.status] ?? { label: listing.status, className: "" }

  return (
    <div className="rounded-lg border p-3 space-y-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{PORTAL_LABEL[listing.source] ?? listing.source}</p>
            <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-xs font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          </div>
          {listing.agent?.name && (
            <p className="text-xs text-gray-400 mt-0.5">
              {listing.agent.name}
              {listing.agent.branch ? ` · ${listing.agent.branch}` : ""}
            </p>
          )}
        </div>
        {listing.listingUrl && (
          <Button asChild variant="ghost" size="sm" className="h-7 px-2 text-xs flex-shrink-0">
            <a href={listing.listingUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3 w-3 mr-1" />
              View
            </a>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs">
        <span>
          <span className="font-semibold">£{listing.price.toLocaleString()}</span>
          {priceReduced && (
            <span className="text-gray-400 line-through ml-1">
              £{listing.originalPrice?.toLocaleString()}
            </span>
          )}
          {priceReduced && listing.reductionPct && (
            <span className="text-amber-600 ml-1">({listing.reductionPct.toFixed(1)}% off)</span>
          )}
        </span>
        <span className="flex items-center gap-1 text-gray-400">
          <Clock className="h-3 w-3" />
          {listing.daysOnMarket} days on market
        </span>
        {listing.bedrooms > 0 && (
          <span className="text-gray-400">{listing.bedrooms} bed · {listing.propertyType}</span>
        )}
        {listing.agent?.phone && (
          <span className="flex items-center gap-1 text-gray-400">
            <Phone className="h-3 w-3" />
            {listing.agent.phone}
          </span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Flood Risk Card
// ---------------------------------------------------------------------------

interface FloodWarning {
  severity: string
  severityLevel: number
  description: string
  area: string
  riverOrSea: string
  updated: string
}

interface FloodRiskResult {
  zone: "zone1" | "zone2" | "zone3" | "unknown"
  nearbyAreas: { label: string; riverOrSea: string }[]
  activeWarnings: FloodWarning[]
  postcode: string
  lat: number
  lng: number
  checkedAt: string
  error?: string
}

interface FloodAIAnalysis {
  verdict: "proceed" | "caution" | "avoid"
  verdictReason: string
  narrative: string
  mortgageImpact: string
  insuranceImpact: string
  dueDiligence: string[]
}

// Module-level cache so analysis survives modal close/reopen
const _floodCache = new Map<string, {
  result: FloodRiskResult
  aiAnalysis?: FloodAIAnalysis
  aiAnalysedAt?: string
}>()

const FLOOD_ZONE_CONFIG: Record<
  FloodRiskResult["zone"],
  { label: string; badgeClass: string; detail: string; icon: React.ReactNode }
> = {
  zone1: {
    label: "Low Risk (Zone 1)",
    badgeClass: "border-green-200 bg-green-50 text-green-800",
    detail: "Less than 0.1% annual probability of flooding.",
    icon: <Droplets className="h-4 w-4 text-green-600" />,
  },
  zone2: {
    label: "Medium Risk (Zone 2)",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-800",
    detail: "0.1–1% annual probability of flooding. Consider flood-resilient build measures.",
    icon: <Droplets className="h-4 w-4 text-amber-600" />,
  },
  zone3: {
    label: "High Risk (Zone 3)",
    badgeClass: "border-red-200 bg-red-50 text-red-800",
    detail: "Greater than 1% annual probability. May affect mortgage availability and insurance premiums.",
    icon: <Droplets className="h-4 w-4 text-red-600" />,
  },
  unknown: {
    label: "Unknown",
    badgeClass: "border-gray-200 bg-gray-50 text-gray-700",
    detail: "Could not determine flood zone — check manually using the GOV.UK flood map.",
    icon: <Droplets className="h-4 w-4 text-gray-400" />,
  },
}

export function FloodRiskCard({
  leadId,
  postcode,
}: {
  leadId: string
  postcode: string | null
}) {
  const cached = _floodCache.get(leadId)
  const [result, setResult]           = useState<FloodRiskResult | null>(cached?.result ?? null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [aiAnalysis, setAiAnalysis]   = useState<FloodAIAnalysis | null>(cached?.aiAnalysis ?? null)
  const [aiAnalysedAt, setAiAnalysedAt] = useState<string | null>(cached?.aiAnalysedAt ?? null)
  const [aiLoading, setAiLoading]     = useState(false)
  const [aiError, setAiError]         = useState<string | null>(null)
  const [showMap, setShowMap]         = useState(false)

  // ── Run flood zone check ──────────────────────────────────────────────────
  const runCheck = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/flood-risk`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Flood risk check failed")
        return
      }
      const newResult = data as FloodRiskResult
      setResult(newResult)
      _floodCache.set(leadId, { ..._floodCache.get(leadId), result: newResult })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error")
    } finally {
      setLoading(false)
    }
  }

  // ── Run AI analysis ───────────────────────────────────────────────────────
  const runAiAnalysis = async () => {
    if (!result) return
    setAiLoading(true)
    setAiError(null)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/flood-risk-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone:           result.zone,
          nearbyAreas:    result.nearbyAreas,
          activeWarnings: result.activeWarnings ?? [],
          postcode:       result.postcode,
          lat:            result.lat,
          lng:            result.lng,
        }),
      })
      const ct = res.headers.get("content-type") ?? ""
      if (!ct.includes("application/json")) {
        throw new Error(`Server error (${res.status})`)
      }
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Analysis failed")
      const newAnalysis = json.analysis as FloodAIAnalysis
      const at = json.analysedAt as string
      setAiAnalysis(newAnalysis)
      setAiAnalysedAt(at)
      _floodCache.set(leadId, {
        ..._floodCache.get(leadId),
        result,
        aiAnalysis: newAnalysis,
        aiAnalysedAt: at,
      })
    } catch (err: unknown) {
      setAiError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAiLoading(false)
    }
  }

  const zoneCfg = result ? FLOOD_ZONE_CONFIG[result.zone] : null

  // Derived: worst active warning severity
  const worstWarning = result?.activeWarnings?.reduce<FloodWarning | null>((worst, w) => {
    if (!worst || w.severityLevel < worst.severityLevel) return w
    return worst
  }, null)

  const warningStyle =
    !worstWarning                    ? null
    : worstWarning.severityLevel <= 1 ? { badge: "bg-red-100 border-red-300 text-red-800",   dot: "bg-red-500",   icon: "text-red-500" }
    : worstWarning.severityLevel <= 2 ? { badge: "bg-orange-100 border-orange-300 text-orange-800", dot: "bg-orange-500", icon: "text-orange-500" }
    :                                   { badge: "bg-amber-100 border-amber-300 text-amber-800",   dot: "bg-amber-400",  icon: "text-amber-500" }

  const verdictStyle = !aiAnalysis ? null
    : aiAnalysis.verdict === "proceed" ? { chip: "bg-green-100 border-green-300 text-green-800",  icon: "✓" }
    : aiAnalysis.verdict === "caution" ? { chip: "bg-amber-100 border-amber-300 text-amber-800",  icon: "⚠" }
    :                                    { chip: "bg-red-100 border-red-300 text-red-800",         icon: "✕" }

  const govFloodUrl = postcode
    ? `https://check-long-term-flood-risk.service.gov.uk/postcode?postcode=${encodeURIComponent(postcode)}`
    : "https://check-long-term-flood-risk.service.gov.uk"

  return (
    <div className="space-y-4">

      {/* ── Header row ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-500" />
          Flood &amp; Environmental Risk
        </h4>
        <Button
          size="sm"
          variant="outline"
          onClick={runCheck}
          disabled={loading || !postcode}
          className="flex items-center gap-1.5"
          title={!postcode ? "Add a postcode to this lead first" : "Run flood risk check"}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {loading ? "Checking…" : result ? "Re-run Check" : "Run Check"}
        </Button>
      </div>

      {/* ── No postcode warning ──────────────────────────────────────────────── */}
      {!postcode && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
          Add a full postcode to this lead to enable flood risk checking.
        </div>
      )}

      {/* ── API error ────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
          <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Results ─────────────────────────────────────────────────────────── */}
      {result && zoneCfg && (
        <div className="space-y-4">

          {/* Zone badge */}
          <div className={`rounded-xl border p-4 flex items-start gap-3 ${zoneCfg.badgeClass}`}>
            <div className="flex-shrink-0 mt-0.5">{zoneCfg.icon}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">{zoneCfg.label}</p>
              <p className="text-xs opacity-80 mt-0.5">{zoneCfg.detail}</p>
              {result.error && (
                <p className="text-xs opacity-70 mt-1 italic">{result.error}</p>
              )}
              <p className="text-[10px] opacity-60 mt-1.5">
                Checked {format(new Date(result.checkedAt), "d MMM yyyy HH:mm")}
                {result.lat != null && ` · ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`}
              </p>
            </div>
          </div>

          {/* ── Live flood warnings ───────────────────────────────────────── */}
          {result.activeWarnings && result.activeWarnings.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full animate-pulse ${warningStyle?.dot ?? "bg-amber-400"}`} />
                Active Flood Warnings
              </p>
              {result.activeWarnings.map((w, i) => (
                <div
                  key={i}
                  className={`rounded-lg border px-3 py-2.5 text-xs flex items-start gap-2 ${warningStyle?.badge ?? ""}`}
                >
                  <Droplets className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${warningStyle?.icon ?? ""}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold">{w.severity}</p>
                    {w.description && <p className="opacity-80 mt-0.5 truncate">{w.description}</p>}
                    {w.riverOrSea && <p className="opacity-60 text-[10px] mt-0.5">{w.riverOrSea}{w.area ? ` · ${w.area}` : ""}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />
              <span className="font-medium">No active flood warnings within 5km</span>
            </div>
          )}

          {/* ── Interactive map ───────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                <Map className="h-3.5 w-3.5" />
                Flood Zone Map
              </p>
              <button
                onClick={() => setShowMap(!showMap)}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                {showMap ? "Hide map" : "Show map"}
              </button>
            </div>
            {showMap && (
              <FloodMap
                lat={result.lat}
                lng={result.lng}
                address={result.postcode}
                zone={result.zone}
              />
            )}
            {!showMap && (
              <div
                className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400 hover:bg-gray-100 transition-colors"
                onClick={() => setShowMap(true)}
              >
                <Map className="h-4 w-4" />
                Click to show EA flood zone map
              </div>
            )}
          </div>

          {/* ── AI investor analysis ──────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                AI Investor Analysis
              </p>
              {aiAnalysis && (
                <button
                  onClick={runAiAnalysis}
                  disabled={aiLoading}
                  className="text-xs text-indigo-500 hover:text-indigo-700 underline disabled:opacity-50"
                >
                  Re-analyse
                </button>
              )}
            </div>

            {/* Error */}
            {aiError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 flex items-start gap-2">
                <XCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            {/* No analysis yet — CTA button */}
            {!aiAnalysis && !aiLoading && (
              <button
                onClick={runAiAnalysis}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-medium text-indigo-700 hover:bg-indigo-100 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Analyse Flood Risk for Investment
              </button>
            )}

            {/* Loading */}
            {aiLoading && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-4 text-xs text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Analysing flood risk…
              </div>
            )}

            {/* Analysis card */}
            {aiAnalysis && verdictStyle && (
              <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">

                {/* Verdict header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold capitalize ${verdictStyle.chip}`}>
                    {verdictStyle.icon} {aiAnalysis.verdict}
                  </span>
                  <p className="text-xs text-gray-600 flex-1">{aiAnalysis.verdictReason}</p>
                </div>

                {/* Narrative */}
                <div className="px-4 py-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Assessment</p>
                  <p className="text-sm text-gray-700 leading-relaxed">{aiAnalysis.narrative}</p>
                </div>

                {/* Mortgage + Insurance impacts */}
                <div className="grid grid-cols-2 divide-x divide-gray-100 px-0">
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Mortgage Impact</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{aiAnalysis.mortgageImpact}</p>
                  </div>
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1">Insurance Impact</p>
                    <p className="text-xs text-gray-600 leading-relaxed">{aiAnalysis.insuranceImpact}</p>
                  </div>
                </div>

                {/* Due diligence checklist */}
                {aiAnalysis.dueDiligence.length > 0 && (
                  <div className="px-4 py-3">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Due Diligence</p>
                    <ul className="space-y-1.5">
                      {aiAnalysis.dueDiligence.map((item, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400 flex-shrink-0 mt-0.5" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Timestamp */}
                {aiAnalysedAt && (
                  <div className="px-4 py-2">
                    <p className="text-[10px] text-gray-400">
                      AI analysed {format(new Date(aiAnalysedAt), "d MMM yyyy HH:mm")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Nearby flood alert areas ──────────────────────────────────── */}
          {result.nearbyAreas.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                EA Flood Alert Areas within 2km ({result.nearbyAreas.length})
              </p>
              <div className="space-y-1">
                {result.nearbyAreas.slice(0, 5).map((area, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 text-xs text-gray-600 rounded-lg border border-gray-100 bg-gray-50 px-3 py-1.5"
                  >
                    <Droplets className="h-3 w-3 text-blue-400 flex-shrink-0" />
                    <span className="font-medium truncate">{area.label || area.riverOrSea}</span>
                    {area.riverOrSea && area.label && (
                      <span className="text-gray-400 truncate ml-auto">· {area.riverOrSea}</span>
                    )}
                  </div>
                ))}
                {result.nearbyAreas.length > 5 && (
                  <p className="text-[10px] text-gray-400 pl-1">
                    + {result.nearbyAreas.length - 5} more area{result.nearbyAreas.length - 5 > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── External links (always visible) ──────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 pt-1 border-t border-gray-100">
        <a
          href={govFloodUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
        >
          <ExternalLink className="h-3 w-3" />
          GOV.UK Long-term Flood Risk
        </a>
        <a
          href="https://check-flood-risk.service.gov.uk/map"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Flood Map for Planning
        </a>
        <a
          href="https://beta.coalauthority.org.uk/coal-mining-risk-assessment-service/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 hover:underline"
        >
          <Mountain className="h-3 w-3" />
          Coal Mining Risk
        </a>
      </div>
    </div>
  )
}

function OwnershipSection({ data }: { data: CheckRecord["ownershipCheckRaw"] }) {
  if (!data) return null
  const hasOwnershipInfo = data.isCorporateOwned || data.lastSalePrice || data.tenure || data.lastSaleDate
  const fh = data.freeholds
  const hasFreehold = fh && (fh.nearestTitle || fh.resultCount > 0)

  const tenureDisplay = data.tenure
    ? data.tenure
    : fh?.inferredTenure === 'freehold'
    ? 'Freehold (inferred)'
    : fh?.inferredTenure === 'leasehold'
    ? 'Leasehold (inferred)'
    : null

  if (!hasOwnershipInfo && !hasFreehold) {
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
          <Building2 className="h-3.5 w-3.5" />
          Ownership
        </h4>
        <p className="text-xs text-gray-400">No ownership data found in Land Registry or Price Paid Data.</p>
      </div>
    )
  }

  const hmlrTitleUrl = (titleNumber: string) =>
    `https://eservices.land-registry.gov.uk/eservices/FindAProperty/view/QuickEnquiryInit.do?title_no=${titleNumber}`

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
        <Building2 className="h-3.5 w-3.5" />
        Ownership
      </h4>

      {/* Land Registry / PPD data */}
      {hasOwnershipInfo && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {tenureDisplay && (
            <>
              <span className="text-gray-400">Tenure</span>
              <span className={`font-medium ${
                tenureDisplay.toLowerCase().includes('leasehold') ? 'text-amber-700' : 'text-green-700'
              }`}>{tenureDisplay}</span>
            </>
          )}
          {data.isCorporateOwned && (
            <>
              <span className="text-gray-400">Owner type</span>
              <span className="font-medium text-amber-700">Corporate{data.isOverseasOwned ? " (overseas)" : ""}</span>
            </>
          )}
          {data.companyName && (
            <>
              <span className="text-gray-400">Company</span>
              <span className="font-medium">{data.companyName}</span>
            </>
          )}
          {data.lastSalePrice && (
            <>
              <span className="text-gray-400">Last sale</span>
              <span className="font-medium">
                £{data.lastSalePrice.toLocaleString()}
                {data.lastSaleDate ? ` (${format(new Date(data.lastSaleDate), "MMM yyyy")})` : ""}
              </span>
            </>
          )}
          {data.equityEstimate !== undefined && data.equityEstimate !== null && (
            <>
              <span className="text-gray-400">Est. equity</span>
              <span className={`font-medium ${data.equityEstimate >= 0 ? "text-green-700" : "text-red-700"}`}>
                £{data.equityEstimate.toLocaleString()}
              </span>
            </>
          )}
        </div>
      )}

      {/* Freehold titles from PropertyData /freeholds */}
      {hasFreehold && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Freehold Titles at Postcode
            </h5>
            <span className="text-[10px] text-gray-400">
              ({fh!.resultCount} found · showing nearest {fh!.allTitles.length})
            </span>
          </div>

          {/* Tenure inference banner */}
          {fh!.inferredTenure !== 'unknown' && (
            <div className={`rounded-lg border px-3 py-2 text-xs flex items-center gap-2 ${
              fh!.inferredTenure === 'leasehold'
                ? 'border-amber-200 bg-amber-50 text-amber-800'
                : 'border-green-200 bg-green-50 text-green-800'
            }`}>
              <Building2 className="h-3.5 w-3.5 flex-shrink-0" />
              <span>
                <span className="font-semibold capitalize">{fh!.inferredTenure}</span>
                {fh!.inferredTenure === 'leasehold'
                  ? ` — nearest freehold has ${fh!.nearestTitle?.leaseholds} leasehold unit${(fh!.nearestTitle?.leaseholds ?? 0) !== 1 ? 's' : ''}`
                  : ' — nearest freehold has no sub-leases (likely a house)'}
              </span>
            </div>
          )}

          {/* Nearest title highlight */}
          {fh!.nearestTitle && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-blue-800">
                    {fh!.nearestTitle.titleNumber}
                    <span className="ml-2 font-normal text-blue-600">{fh!.nearestTitle.titleClass}</span>
                  </p>
                  <p className="text-blue-600 mt-0.5">
                    {fh!.nearestTitle.leaseholds > 0
                      ? `${fh!.nearestTitle.leaseholds} leasehold${fh!.nearestTitle.leaseholds !== 1 ? 's' : ''} registered`
                      : 'No sub-leases'}
                    {' · '}{fh!.nearestTitle.distance === '0.00' ? 'At postcode centre' : `${fh!.nearestTitle.distance}km away`}
                  </p>
                </div>
                <a
                  href={hmlrTitleUrl(fh!.nearestTitle.titleNumber)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium whitespace-nowrap"
                >
                  <ExternalLink className="h-3 w-3" />
                  HMLR
                </a>
              </div>
              {/* /title enrichment */}
              {fh!.nearestTitleDetail && (
                <div className="space-y-1.5 border-t border-blue-200 pt-2">
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span className="text-blue-500">Freeholder type</span>
                    <span className="font-medium text-blue-800">
                      {fh!.nearestTitleDetail.ownershipType}
                      {fh!.nearestTitleDetail.ownerName && ` — ${fh!.nearestTitleDetail.ownerName}`}
                    </span>
                    {fh!.nearestTitleDetail.plotSizeAcres && (
                      <>
                        <span className="text-blue-500">Plot size</span>
                        <span className="font-medium text-blue-800">{fh!.nearestTitleDetail.plotSizeAcres} acres</span>
                      </>
                    )}
                    {fh!.nearestTitleDetail.uprns.length > 0 && (
                      <>
                        <span className="text-blue-500">UPRNs</span>
                        <span className="font-medium text-blue-800 font-mono text-[10px]">
                          {fh!.nearestTitleDetail.uprns.slice(0, 3).join(', ')}
                          {fh!.nearestTitleDetail.uprns.length > 3 && ` +${fh!.nearestTitleDetail.uprns.length - 3}`}
                        </span>
                      </>
                    )}
                  </div>
                  {/* Leasehold title numbers in this building */}
                  {fh!.nearestTitleDetail.leaseholdTitleNumbers.length > 0 && (
                    <div>
                      <p className="text-blue-500 mb-1">Leasehold titles in building:</p>
                      <div className="flex flex-wrap gap-1">
                        {fh!.nearestTitleDetail.leaseholdTitleNumbers.slice(0, 12).map((tn) => (
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
                        {fh!.nearestTitleDetail.leaseholdTitleNumbers.length > 12 && (
                          <span className="text-[10px] text-blue-500 self-center">
                            +{fh!.nearestTitleDetail.leaseholdTitleNumbers.length - 12} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* All other titles */}
          {fh!.allTitles.length > 1 && (
            <div className="space-y-1">
              {fh!.allTitles.slice(1, 6).map((t) => (
                <div key={t.polygonId} className="flex items-center justify-between text-xs py-1 border-b border-gray-100 last:border-0">
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
                    {t.leaseholds > 0 && (
                      <span className="text-amber-600">{t.leaseholds} LH</span>
                    )}
                    <span>{t.distance === '0.00' ? '~0km' : `${t.distance}km`}</span>
                  </div>
                </div>
              ))}
              {fh!.allTitles.length > 6 && (
                <p className="text-[10px] text-gray-400 pt-1">
                  + {fh!.allTitles.length - 6} more titles at this postcode
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
