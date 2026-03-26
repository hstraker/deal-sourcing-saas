"use client"
import { toast } from "sonner"

/**
 * PortalCheckDetailPanel — full detail view of the latest VendorPropertyCheck.
 * Shows flags, active listing, LR/PPD data, a "Re-run" button, and check history.
 *
 * Used inside the "Portal Check" tab of the vendor lead detail modal.
 */

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  RefreshCw, Loader2, ExternalLink, ShieldCheck, ShieldAlert,
  AlertTriangle, Building2, Clock, TrendingDown, FlaskConical, Calendar,
  Search, Phone, Wifi, WifiOff, CheckCircle2, XCircle, MinusCircle
} from "lucide-react"
import { PortalCheckBadge } from "./portal-check-badge"
import { formatDistanceToNow, format } from "date-fns"

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
  }
  recommendedAction?: string
  errorMessage?: string
}

interface PortalCheckDetailPanelProps {
  leadId: string
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
                <div key={h.id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    <PortalCheckBadge risk={h.overallRisk as any} isMockData={h.isMockData} />
                    <span className="text-gray-400">
                      {format(new Date(h.triggeredAt), "d MMM HH:mm")} · {h.triggeredBy}
                    </span>
                    {h.isMockData && <span className="text-purple-500">🧪</span>}
                  </div>
                  <span className="text-gray-400">{h.checkStatus}</span>
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

function OwnershipSection({ data }: { data: CheckRecord["ownershipCheckRaw"] }) {
  if (!data) return null
  const hasInfo = data.isCorporateOwned || data.lastSalePrice || data.tenure || data.lastSaleDate

  if (!hasInfo) {
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

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-400 flex items-center gap-1">
        <Building2 className="h-3.5 w-3.5" />
        Ownership
      </h4>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {data.tenure && (
          <>
            <span className="text-gray-400">Tenure</span>
            <span className="font-medium">{data.tenure}</span>
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
    </div>
  )
}
