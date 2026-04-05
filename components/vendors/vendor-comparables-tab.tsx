"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  RefreshCw,
  Home,
  Settings,
  TrendingUp,
  Clock,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import {
  ComparablesAnalysis,
  ComparablesSettings,
  type ComparableProperty,
} from "@/components/comparables"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import { format } from "date-fns"
import { toast } from "sonner"

// ─── module-level cache ───────────────────────────────────────────────────────
// Survives component unmount/remount (e.g. modal close/reopen).
// Data is shown instantly on re-open without a loading spinner.
const _comparablesCache = new Map<string, ComparablesData>()

/** Call this after a table-level fetch so the modal re-loads fresh data on next open */
export function invalidateComparablesCache(vendorLeadId: string) {
  _comparablesCache.delete(vendorLeadId)
}

// ─── types ────────────────────────────────────────────────────────────────────

interface VendorComparablesTabProps {
  vendorLeadId: string
  askingPrice?: number
  propertyPostcode?: string | null
}

interface ComparablesData {
  comparables: ComparableProperty[]
  count: number
  avgPrice: number | null
  avgRentalYield: number | null
  priceRange: { min: number; max: number } | null
  rentalYieldRange: { min: number; max: number } | null
  confidence: string | null
  searchRadius: number | null
  lastFetchedAt: string | null
}

// ─── accordion helpers ────────────────────────────────────────────────────────

function getYieldColour(y: number | undefined | null): string {
  if (y == null) return "text-gray-400"
  if (y >= 6) return "text-green-600"
  if (y >= 4) return "text-amber-500"
  return "text-red-500"
}

function getConfidenceInfo(c: number | undefined): { label: string; colour: string } {
  if (c == null) return { label: "Unknown", colour: "text-gray-400" }
  if (c >= 0.8)  return { label: "High",    colour: "text-green-600" }
  if (c >= 0.6)  return { label: "Medium",  colour: "text-amber-500" }
  return              { label: "Low",       colour: "text-red-500"   }
}

function AccRow({
  label,
  value,
  valueClass,
}: {
  label: string
  value: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="shrink-0 text-[10px] text-gray-400">{label}</span>
      <span className={cn("text-right text-[10px] font-semibold text-gray-800", valueClass)}>
        {value}
      </span>
    </div>
  )
}

// ─── helpers ──────────────────────────────────────────────────────────────────

/** How many whole months ago a sale date was */
function monthsAgo(dateStr: string): number | null {
  try {
    const sold = new Date(dateStr)
    const now  = new Date()
    return Math.floor((now.getTime() - sold.getTime()) / (1000 * 60 * 60 * 24 * 30.44))
  } catch { return null }
}

/** Colour + label for sale recency */
function getSoldStyle(months: number | null): { label: string; className: string } {
  if (months == null) return { label: "—", className: "text-gray-400" }
  if (months <= 6)    return { label: `${months}mo`,  className: "text-green-600 font-semibold" }
  if (months <= 18)   return { label: `${months}mo`,  className: "text-amber-500 font-semibold" }
  return                     { label: `${months}mo`,  className: "text-red-500 font-semibold" }
}

/** Colour + sign for vs-asking-price delta */
function getVsAskStyle(pct: number): { label: string; className: string } {
  if (pct >= 5)   return { label: `+${pct.toFixed(1)}%`, className: "text-green-600 font-semibold" }
  if (pct >= 0)   return { label: `+${pct.toFixed(1)}%`, className: "text-green-500" }
  if (pct >= -10) return { label: `${pct.toFixed(1)}%`,  className: "text-amber-500 font-semibold" }
  return                 { label: `${pct.toFixed(1)}%`,  className: "text-red-500 font-semibold" }
}

/** Short property type label */
function shortType(type: string | undefined): string {
  if (!type) return ""
  const t = type.toLowerCase()
  if (t.includes("detach")) return t.includes("semi") ? "Semi" : "Det"
  if (t.includes("terrace") || t.includes("terraced")) return "Terr"
  if (t.includes("flat") || t.includes("apartment")) return "Flat"
  if (t.includes("bungalow")) return "Bung"
  if (t.includes("end"))  return "EOT"
  return type.slice(0, 4)
}

// ─── accordion component ──────────────────────────────────────────────────────

function ComparablesAccordion({
  comparables,
  askingPrice,
}: {
  comparables: ComparableProperty[]
  askingPrice?: number
}) {
  const [openId, setOpenId] = useState<string | null>(null)

  const sorted = useMemo(
    () => [...comparables].sort((a, b) => (a.distance ?? 999) - (b.distance ?? 999)),
    [comparables]
  )

  // Column template:  #  address  beds  sale-price  £/bed  vs-ask  sold  dist  yield  rent/mo  chevron
  const cols = "1.5rem 1fr 2.5rem 7rem 5rem 5rem 4rem 4.5rem 4.5rem 6rem 1.5rem"

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 text-sm">

      {/* Header */}
      <div
        className="grid items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400"
        style={{ gridTemplateColumns: cols }}
      >
        <span>#</span>
        <span>Address</span>
        <span className="text-center">Beds</span>
        <span className="text-right">Sale Price</span>
        <span className="text-right">£/Bed</span>
        <span className="text-right">vs Ask</span>
        <span className="text-right">Sold</span>
        <span className="text-right">Dist</span>
        <span className="text-right">Yield</span>
        <span className="text-right">Rent/mo</span>
        <span />
      </div>

      {/* Rows */}
      <div className="divide-y divide-gray-100">
        {sorted.map((comp, i) => {
          const isOpen     = openId === comp.id
          const yieldClass = getYieldColour(comp.rentalYield)
          const conf       = getConfidenceInfo(comp.confidence)

          const saleDateFmt = (() => {
            try { return format(new Date(comp.saleDate), "d MMM yyyy") }
            catch { return comp.saleDate }
          })()

          // Beds
          const beds = comp.bedrooms != null && comp.bedrooms > 0 ? comp.bedrooms : null

          // £ per bedroom
          const pricePerBed = beds ? Math.round(comp.salePrice / beds) : null
          const pricePerBedFmt = pricePerBed
            ? `£${(pricePerBed / 1000).toFixed(0)}k`
            : "—"

          // vs Asking Price
          const vsAsk = askingPrice && askingPrice > 0
            ? ((comp.salePrice - askingPrice) / askingPrice) * 100
            : null
          const vsAskStyle = vsAsk != null ? getVsAskStyle(vsAsk) : null

          // Sold recency
          const mo       = monthsAgo(comp.saleDate)
          const soldStyle = getSoldStyle(mo)

          return (
            <div key={comp.id}>

              {/* ── Collapsed row ── */}
              <button
                type="button"
                className={cn(
                  "grid w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-gray-50 focus:outline-none",
                  isOpen && "bg-blue-50/60"
                )}
                style={{ gridTemplateColumns: cols }}
                onClick={() => setOpenId(isOpen ? null : comp.id)}
              >
                {/* # */}
                <span className="text-xs font-medium text-gray-400">{i + 1}</span>

                {/* Address + type tag */}
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold leading-tight text-gray-900">
                    {comp.address}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    {comp.postcode && (
                      <span className="font-mono text-[10px] leading-tight text-gray-400">
                        {comp.postcode}
                      </span>
                    )}
                    {comp.propertyType && (
                      <span className="rounded bg-gray-100 px-1 py-px text-[9px] font-medium text-gray-500">
                        {shortType(comp.propertyType)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Beds */}
                <span className="text-center text-xs font-semibold text-gray-700">
                  {beds ?? "—"}
                </span>

                {/* Sale price */}
                <span className="text-right text-xs font-bold text-gray-900">
                  {formatCurrency(comp.salePrice)}
                </span>

                {/* £/Bed */}
                <span className="text-right text-xs text-gray-600">
                  {pricePerBedFmt}
                </span>

                {/* vs Ask */}
                <span className={cn("text-right text-xs", vsAskStyle?.className ?? "text-gray-400")}>
                  {vsAskStyle?.label ?? "—"}
                </span>

                {/* Sold */}
                <span className={cn("text-right text-xs", soldStyle.className)}>
                  {soldStyle.label}
                </span>

                {/* Distance */}
                <span className="text-right text-xs text-gray-500">
                  {comp.distance != null ? `${comp.distance.toFixed(2)} mi` : "—"}
                </span>

                {/* Yield */}
                <span className={cn("text-right text-xs font-semibold", yieldClass)}>
                  {comp.rentalYield != null ? `${comp.rentalYield.toFixed(1)}%` : "—"}
                </span>

                {/* Rent/mo */}
                <span className="text-right text-xs text-gray-700">
                  {comp.monthlyRent
                    ? `£${Math.round(comp.monthlyRent).toLocaleString("en-GB")}/mo`
                    : "—"}
                </span>

                {/* Chevron */}
                <ChevronRight
                  className={cn(
                    "h-3.5 w-3.5 text-gray-300 transition-transform duration-200",
                    isOpen && "rotate-90"
                  )}
                />
              </button>

              {/* ── Expanded panel ── */}
              {isOpen && (
                <div className="grid grid-cols-2 gap-4 border-t border-gray-100 bg-gray-50/80 px-4 py-4">

                  {/* Property column */}
                  <div className="space-y-1.5">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Property
                    </p>
                    <AccRow label="Sold" value={saleDateFmt} />
                    <AccRow
                      label="Freshness"
                      value={soldStyle.label}
                      valueClass={soldStyle.className}
                    />
                    {comp.propertyType && (
                      <AccRow label="Type" value={comp.propertyType} />
                    )}
                    {beds != null && (
                      <AccRow label="Bedrooms" value={beds} />
                    )}
                    {comp.bathrooms != null && comp.bathrooms > 0 && (
                      <AccRow label="Bathrooms" value={comp.bathrooms} />
                    )}
                    {comp.squareFeet ? (
                      <AccRow
                        label="Sq Ft"
                        value={`${comp.squareFeet.toLocaleString()} ft²`}
                      />
                    ) : null}
                    {comp.pricePerSqft ? (
                      <AccRow label="£/sqft" value={`£${comp.pricePerSqft}`} />
                    ) : null}
                    {pricePerBed && (
                      <AccRow label="£/Bedroom" value={`£${pricePerBed.toLocaleString("en-GB")}`} />
                    )}
                    {vsAskStyle && (
                      <AccRow
                        label="vs Asking Price"
                        value={vsAskStyle.label}
                        valueClass={vsAskStyle.className}
                      />
                    )}
                    {comp.daysOnMarket != null && (
                      <AccRow label="Days Listed" value={comp.daysOnMarket} />
                    )}
                    {comp.priceReductions != null && comp.priceReductions > 0 && (
                      <AccRow
                        label="Price Cuts"
                        value={comp.priceReductions}
                        valueClass="text-amber-500"
                      />
                    )}
                    <AccRow
                      label="Confidence"
                      value={conf.label}
                      valueClass={conf.colour}
                    />
                  </div>

                  {/* Rental column */}
                  <div className="space-y-1.5">
                    <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-gray-400">
                      Rental
                    </p>

                    {comp.monthlyRent ? (
                      <>
                        <AccRow
                          label="Monthly Rent"
                          value={`£${Math.round(comp.monthlyRent).toLocaleString("en-GB")}/mo`}
                        />
                        <AccRow
                          label="Annual Rent"
                          value={formatCurrency(comp.monthlyRent * 12)}
                        />
                        {comp.weeklyRent ? (
                          <AccRow
                            label="Weekly Rent"
                            value={`£${Math.round(comp.weeklyRent)}/wk`}
                          />
                        ) : null}
                      </>
                    ) : (
                      <p className="text-[10px] italic text-gray-400">
                        No rental data for this postcode
                      </p>
                    )}

                    {comp.rentalYield != null && (
                      <AccRow
                        label="Gross Yield"
                        value={`${comp.rentalYield.toFixed(2)}%`}
                        valueClass={yieldClass}
                      />
                    )}
                    {comp.rentalYieldMin != null && comp.rentalYieldMax != null && (
                      <AccRow
                        label="Yield Range"
                        value={`${comp.rentalYieldMin.toFixed(1)}%–${comp.rentalYieldMax.toFixed(1)}%`}
                        valueClass="text-gray-500"
                      />
                    )}
                    {comp.areaAverageRent ? (
                      <AccRow
                        label="Area Avg Rent"
                        value={`£${Math.round(comp.areaAverageRent).toLocaleString("en-GB")}/mo`}
                      />
                    ) : null}

                    {/* Portal links */}
                    {(comp.listingUrl || comp.listingUrlSecondary) && (
                      <div className="mt-1 flex gap-3 border-t border-gray-200 pt-2.5">
                        {comp.listingUrl && (
                          <a
                            href={comp.listingUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800"
                          >
                            Rightmove
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                        {comp.listingUrlSecondary && (
                          <a
                            href={comp.listingUrlSecondary}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[10px] font-medium text-blue-600 hover:text-blue-800"
                          >
                            Zoopla
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── main tab component ───────────────────────────────────────────────────────

/**
 * VendorComparablesTab Component
 * Displays comparables for a specific vendor lead
 */
export function VendorComparablesTab({
  vendorLeadId,
  askingPrice,
  propertyPostcode,
}: VendorComparablesTabProps) {
  // Seed state from module cache so re-opens are instant (no spinner, no re-fetch)
  const [data, setData] = useState<ComparablesData | null>(
    () => _comparablesCache.get(vendorLeadId) ?? null
  )
  const [isLoading, setIsLoading] = useState(() => !_comparablesCache.has(vendorLeadId))
  const [isFetching, setIsFetching] = useState(false)

  useEffect(() => {
    // If we already have cached data for this lead, skip the network round-trip
    if (_comparablesCache.has(vendorLeadId)) return
    fetchComparables()
  }, [vendorLeadId])

  const fetchComparables = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/vendor-leads/${vendorLeadId}/comparables`)
      if (response.ok) {
        const result = await response.json()
        if (result.data) {
          setData(result.data)
          _comparablesCache.set(vendorLeadId, result.data)
        }
      }
    } catch (error) {
      console.error("Error fetching comparables:", error)
      toast.error("Failed to load comparables")
    } finally {
      setIsLoading(false)
    }
  }

  const handleFetchNew = async (forceRefresh: boolean = false) => {
    if (!propertyPostcode) {
      toast.error("Property postcode is required to fetch comparables")
      return
    }

    setIsFetching(true)
    try {
      const response = await fetch(
        `/api/vendor-leads/${vendorLeadId}/fetch-comparables`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ forceRefresh }),
        }
      )

      const result = await response.json()

      if (response.ok) {
        setData(result.data)
        _comparablesCache.set(vendorLeadId, result.data)
        toast.success(
          result.cached
            ? "Using cached comparables"
            : `Fetched ${result.data.count} comparables (${result.data.creditsUsed} credits used)`
        )
      } else {
        throw new Error(result.error || "Failed to fetch comparables")
      }
    } catch (error: any) {
      console.error("Error fetching comparables:", error)
      toast.error(error.message || "Failed to fetch comparables")
    } finally {
      setIsFetching(false)
    }
  }

  const isStale = (lastFetchedAt: string | null): boolean => {
    if (!lastFetchedAt) return true
    const daysSince =
      (Date.now() - new Date(lastFetchedAt).getTime()) / (1000 * 60 * 60 * 24)
    return daysSince > 7
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const dataIsStale = data ? isStale(data.lastFetchedAt) : false

  return (
    <div className="space-y-6">

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Comparable Properties</h3>
          {data?.lastFetchedAt && (
            <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
              Last updated: {new Date(data.lastFetchedAt).toLocaleString("en-GB")}
              {dataIsStale && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                  <Clock className="h-3 w-3" />
                  Stale — over 7 days old
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <ComparablesSettings
            trigger={
              <Button variant="outline" size="sm">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Button>
            }
            onConfigChange={() => {
              toast.info("Settings updated. Fetch comparables to apply changes.")
            }}
          />
          <Button
            variant={
              dataIsStale || !(data && data.comparables.length > 0)
                ? "default"
                : "outline"
            }
            size="sm"
            onClick={() =>
              handleFetchNew(!!(data && data.comparables.length > 0))
            }
            disabled={isFetching || !propertyPostcode}
          >
            {isFetching ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Fetching...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                {data && data.comparables.length > 0
                  ? dataIsStale
                    ? "Refresh (Stale)"
                    : "Refresh"
                  : "Fetch Comparables"}
              </>
            )}
          </Button>
        </div>
      </div>

      {/* No postcode warning */}
      {!propertyPostcode && (
        <div className="ds-card overflow-hidden">
          <div className="flex items-center gap-3 p-5 py-6">
            <Home className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium">Property postcode required</p>
              <p className="text-sm text-gray-400">
                Add a property postcode to fetch comparable properties in the area.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* No comparables yet */}
      {propertyPostcode && (!data || data.comparables.length === 0) && (
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <h3 className="text-sm font-semibold text-gray-900">
              {data?.lastFetchedAt ? "No Comparables Found" : "No Comparables Yet"}
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              {data?.lastFetchedAt
                ? `Searched on ${new Date(data.lastFetchedAt).toLocaleString("en-GB")} — no sold prices found in this area`
                : `Click "Fetch Comparables" to find similar properties that have sold in the area`}
            </p>
          </div>
          <div className="p-5">
            {data?.lastFetchedAt ? (
              <div className="space-y-2 text-sm text-gray-400">
                <p>This can happen when:</p>
                <ul className="ml-2 list-inside list-disc space-y-1">
                  <li>The postcode is in a low-transaction area</li>
                  <li>The search radius is too small (try Settings → increase radius)</li>
                  <li>The property type or bedroom filter is too strict</li>
                </ul>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-400">
                <p>Comparables help you:</p>
                <ul className="ml-2 list-inside list-disc space-y-1">
                  <li>Estimate accurate market value</li>
                  <li>Calculate BMV (Below Market Value) percentage</li>
                  <li>Assess rental yield potential</li>
                  <li>Make data-driven offers</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comparables data */}
      {data && data.comparables.length > 0 && (
        <>
          {/* Rental data status banners */}
          {(() => {
            const hasRentalData   = data.comparables.some((c) => c.monthlyRent)
            const rentalDataCount = data.comparables.filter((c) => c.monthlyRent).length

            if (!hasRentalData) {
              return (
                <div className="ds-card overflow-hidden border-yellow-200 bg-yellow-50">
                  <div className="p-5 py-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="mt-0.5 h-5 w-5 text-yellow-600" />
                      <div>
                        <p className="font-semibold text-yellow-900">Rental Data Not Available</p>
                        <p className="mt-1 text-sm text-yellow-800">
                          These comparables were fetched before rental yield analysis was
                          added. Click &quot;Refresh&quot; to fetch updated data with rental
                          information for buy-to-let investment analysis.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            } else if (rentalDataCount < data.comparables.length) {
              return (
                <div className="ds-card overflow-hidden border-blue-200 bg-blue-50">
                  <div className="p-5 py-4">
                    <div className="flex items-start gap-3">
                      <TrendingUp className="mt-0.5 h-5 w-5 text-blue-600" />
                      <div>
                        <p className="font-semibold text-blue-900">Partial Rental Data</p>
                        <p className="mt-1 text-sm text-blue-800">
                          {rentalDataCount} of {data.comparables.length} properties have
                          rental data. Some postcodes may not have rental information
                          available.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            }
            return null
          })()}

          {/* Analysis summary (includes bar chart) */}
          <ComparablesAnalysis
            comparables={data.comparables}
            askingPrice={askingPrice}
            showRentalData={true}
          />

          {/* Accordion list */}
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-700">
              {data.comparables.length} Comparable{data.comparables.length !== 1 ? "s" : ""} Found
              <span className="ml-2 text-xs font-normal text-gray-400">
                — sorted by distance, click a row to expand
              </span>
            </h4>
            <ComparablesAccordion comparables={data.comparables} askingPrice={askingPrice} />
          </div>
        </>
      )}
    </div>
  )
}
