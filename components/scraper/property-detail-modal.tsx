"use client"

import { useState, useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Check,
  X,
  ExternalLink,
  Bed,
  Bath,
  Ruler,
  MapPin,
  Phone,
  Calendar,
  TrendingDown,
  AlertTriangle,
  HelpCircle,
  Key,
  Zap,
  Home,
  CheckCircle2,
  Star,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  TrendingUp,
  Building2,
  BarChart2,
  Loader2,
  History,
  Users,
  Landmark,
} from "lucide-react"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"
import { buildBmvBreakdown, bmvGrade } from "@/lib/scrapers/bmv-score-breakdown"

/** Strip HTML tags and decode common HTML entities from a raw HTML string. */
function stripHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, "\n")   // <br> → newline
    .replace(/<\/p>/gi, "\n")         // </p> → newline
    .replace(/<\/li>/gi, "\n")        // </li> → newline
    .replace(/<[^>]+>/g, "")          // strip all remaining tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")       // collapse 3+ newlines to 2
    .trim()
}

const SOURCE_COLORS: Record<string, string> = {
  RIGHTMOVE: "bg-blue-100 text-blue-800",
  ZOOPLA: "bg-purple-100 text-purple-800",
  ONTHEMARKET: "bg-emerald-100 text-emerald-800",
  PRIMELOCATION: "bg-orange-100 text-orange-800",
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

// ─── Portal data types (mirrors API response) ─────────────────────────────────

interface PortalAgent { name: string; phone: string | null; branch: string | null }

interface ListingHistoryEntry {
  address: string
  listedPrice: number
  finalPrice: number | null
  daysListed: number | null
  dateListed: string | null
  dateRemoved: string | null
  source: string
  url: string | null
  agent: PortalAgent | null
  priceReductions: number
}

interface ActiveListing {
  address: string
  price: number
  originalPrice: number | null
  daysListed: number
  dateListed: string | null
  source: string
  url: string | null
  agent: PortalAgent | null
  priceReductions: number
}

interface SoldEntry {
  address: string
  salePrice: number
  saleDate: string
  bedrooms: number
  propertyType: string
}

interface PortalData {
  fetchedAt: string
  listingHistory: ListingHistoryEntry[]
  activeListings: ActiveListing[]
  soldHistory: SoldEntry[]
}

// ─────────────────────────────────────────────────────────────────────────────

interface PropertyDetailModalProps {
  listing: PropertyListingForClient | null
  duplicates?: PropertyListingForClient[]
  open: boolean
  onClose: () => void
  onReview: (id: string, action: "APPROVED" | "REJECTED", notes?: string) => void
  isSubmitting: boolean
}

export function PropertyDetailModal({
  listing,
  duplicates = [],
  open,
  onClose,
  onReview,
  isSubmitting,
}: PropertyDetailModalProps) {
  const [notes, setNotes] = useState("")
  const [lightbox, setLightbox] = useState<{ images: string[]; index: number } | null>(null)
  const [zoom, setZoom] = useState(1)

  // Portal data — listing history, active agents, sold price matches
  const [portalData, setPortalData]     = useState<PortalData | null>(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError]   = useState<string | null>(null)

  const closeLightbox = useCallback(() => {
    setLightbox(null)
    setZoom(1)
  }, [])

  const lightboxPrev = useCallback(() => {
    setLightbox((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.images.length) % prev.images.length } : null)
    setZoom(1)
  }, [])

  const lightboxNext = useCallback(() => {
    setLightbox((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.images.length } : null)
    setZoom(1)
  }, [])

  const openLightbox = useCallback((imgs: string[], index: number) => {
    setLightbox({ images: imgs, index })
    setZoom(1)
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeLightbox()
      if (e.key === "ArrowLeft") lightboxPrev()
      if (e.key === "ArrowRight") lightboxNext()
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 3))
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.5))
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [lightbox, closeLightbox, lightboxPrev, lightboxNext])

  // Reset lightbox whenever the dialog closes or the listing changes — prevents stale images
  useEffect(() => {
    if (!open) {
      setLightbox(null)
      setZoom(1)
    }
  }, [open])

  useEffect(() => {
    setLightbox(null)
    setZoom(1)
  }, [listing?.id])

  // Auto-fetch portal data (listing history, active agents, sold prices) when modal opens
  useEffect(() => {
    if (!open || !listing?.id) {
      setPortalData(null)
      setPortalError(null)
      return
    }

    // Use cached data from propertyDataAnalysis if already fetched
    const pda = listing.propertyDataAnalysis as any
    if (pda?.portalData?.fetchedAt) {
      const hoursSince = (Date.now() - new Date(pda.portalData.fetchedAt).getTime()) / 3_600_000
      if (hoursSince < 24) {
        setPortalData(pda.portalData as PortalData)
        return
      }
    }

    setPortalLoading(true)
    setPortalError(null)

    fetch(`/api/properties/listings/${listing.id}/portal-data`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? "Failed to load portal data")
        setPortalData(data as PortalData)
      })
      .catch((err) => setPortalError(err.message))
      .finally(() => setPortalLoading(false))
  }, [open, listing?.id])

  if (!listing) return null

  const bmv = listing.bmvIndicators as BmvIndicatorsData
  const address = listing.address as any
  const agent = listing.agent as any
  const priceHistory = listing.priceHistory as any[]

  // Merge images from all sources in this postcode group, deduplicated by URL
  const allImageUrls = new Set<string>()
  const primaryImgs = listing.images as string[]
  primaryImgs.forEach((u) => allImageUrls.add(u))
  duplicates.forEach((d) => (d.images as string[]).forEach((u) => allImageUrls.add(u)))
  const images = Array.from(allImageUrls)

  // Merge floor plans similarly
  const allFloorPlanUrls = new Set<string>()
  ;(listing.floorPlans as string[]).forEach((u) => allFloorPlanUrls.add(u))
  duplicates.forEach((d) => (d.floorPlans as string[]).forEach((u) => allFloorPlanUrls.add(u)))
  const floorPlans = Array.from(allFloorPlanUrls)

  const handleReview = (action: "APPROVED" | "REJECTED") => {
    onReview(listing.id, action, notes || undefined)
    setNotes("")
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onPointerDownOutside={(e) => { if (lightbox) e.preventDefault() }}
        onFocusOutside={(e) => { if (lightbox) e.preventDefault() }}
        onInteractOutside={(e) => { if (lightbox) e.preventDefault() }}
      >
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={SOURCE_COLORS[listing.source]}>
              {SOURCE_LABELS[listing.source]}
            </Badge>
            {duplicates.map((d) => (
              <Badge key={d.id} className={SOURCE_COLORS[d.source]}>
                {SOURCE_LABELS[d.source]}
              </Badge>
            ))}
            {listing.category === "COMMERCIAL" && (
              <Badge variant="outline">Commercial</Badge>
            )}
            {listing.isAmbiguous && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Ambiguous
              </Badge>
            )}
          </div>
          <DialogTitle className="text-xl">{listing.title}</DialogTitle>
          <p className="text-sm text-gray-400 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {address?.displayAddress}
            {address?.postcode && ` - ${address.postcode}`}
          </p>
        </DialogHeader>

        {/* Images */}
        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {images.slice(0, 6).map((img, i) => (
              <div key={i} className="group relative flex-shrink-0">
                <img
                  src={img}
                  alt={`Property image ${i + 1}`}
                  className="h-40 w-auto rounded-md object-cover cursor-pointer transition-opacity hover:opacity-90"
                  onClick={() => openLightbox(images, i)}
                />
                <div
                  className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                >
                  <Maximize2 className="h-6 w-6 text-white drop-shadow-lg" />
                </div>
              </div>
            ))}
            {images.length > 6 && (
              <div
                className="flex h-40 w-24 items-center justify-center rounded-md bg-gray-100 text-sm text-gray-400 flex-shrink-0 cursor-pointer hover:bg-gray-50/80 transition-colors"
                onClick={() => openLightbox(images, 6)}
              >
                +{images.length - 6} more
              </div>
            )}
          </div>
        )}

        {/* Key Details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-gray-400">Price</span>
            <p suppressHydrationWarning className="text-lg font-bold">£{listing.price.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs text-gray-400">Type</span>
            <p className="font-medium capitalize">{listing.propertyType}</p>
          </div>
          {listing.bedrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bed className="h-4 w-4 text-gray-400" />
              <div>
                <span className="text-xs text-gray-400">Beds</span>
                <p className="font-medium">{listing.bedrooms}</p>
              </div>
            </div>
          )}
          {listing.bathrooms > 0 && (
            <div className="flex items-center gap-1">
              <Bath className="h-4 w-4 text-gray-400" />
              <div>
                <span className="text-xs text-gray-400">Baths</span>
                <p className="font-medium">{listing.bathrooms}</p>
              </div>
            </div>
          )}
        </div>

        {(listing.squareFeet || listing.pricePerSqFt) && (
          <div className="flex gap-4 text-sm">
            {listing.squareFeet && (
              <span suppressHydrationWarning className="flex items-center gap-1">
                <Ruler className="h-3 w-3" />
                {listing.squareFeet.toLocaleString()} sq ft
              </span>
            )}
            {listing.pricePerSqFt && (
              <span suppressHydrationWarning>£{listing.pricePerSqFt.toLocaleString()}/sq ft</span>
            )}
          </div>
        )}

        {/* Property Features */}
        {(listing.epcRating || listing.tenure || listing.isChainFree || listing.isNewBuild ||
          listing.isRetirement || listing.leaseYearsRemaining || listing.groundRent ||
          listing.serviceCharge || (listing.keyFeatures?.length > 0)) && (
          <>
            <div className="border-t border-[var(--ds-border)]" />
            <div>
              <h4 className="font-semibold text-sm mb-2">Property Details</h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {listing.epcRating && (
                  <Badge variant="outline" className="gap-1">
                    <Zap className="h-3 w-3 text-yellow-500" />
                    EPC: {listing.epcRating}
                  </Badge>
                )}
                {listing.tenure && (
                  <Badge variant="outline" className="gap-1">
                    <Home className="h-3 w-3" />
                    {listing.tenure === "FREEHOLD" ? "Freehold"
                      : listing.tenure === "LEASEHOLD" ? "Leasehold"
                      : listing.tenure === "SHARE_OF_FREEHOLD" ? "Share of Freehold"
                      : listing.tenure === "COMMONHOLD" ? "Commonhold"
                      : listing.tenure}
                  </Badge>
                )}
                {listing.isChainFree && (
                  <Badge className="bg-green-100 text-green-800 gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    Chain Free
                  </Badge>
                )}
                {listing.isNewBuild && (
                  <Badge className="bg-blue-100 text-blue-800 gap-1">
                    <Star className="h-3 w-3" />
                    New Build
                  </Badge>
                )}
                {listing.isRetirement && (
                  <Badge variant="outline" className="gap-1">
                    Retirement Property
                  </Badge>
                )}
              </div>
              {(listing.leaseYearsRemaining || listing.groundRent || listing.serviceCharge) && (
                <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                  {listing.leaseYearsRemaining && (
                    <div>
                      <span className="text-gray-400 block">Lease Remaining</span>
                      <span className="font-medium">{listing.leaseYearsRemaining} yrs</span>
                    </div>
                  )}
                  {listing.groundRent && (
                    <div>
                      <span className="text-gray-400 block">Ground Rent</span>
                      <span suppressHydrationWarning className="font-medium">£{listing.groundRent.toLocaleString()}/yr</span>
                    </div>
                  )}
                  {listing.serviceCharge && (
                    <div>
                      <span className="text-gray-400 block">Service Charge</span>
                      <span suppressHydrationWarning className="font-medium">£{listing.serviceCharge.toLocaleString()}/yr</span>
                    </div>
                  )}
                </div>
              )}
              {listing.keyFeatures?.length > 0 && (
                <div>
                  <span className="text-xs text-gray-400 mb-1 flex items-center gap-1">
                    <Key className="h-3 w-3" />
                    Key Features
                  </span>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-0.5 mt-1">
                    {listing.keyFeatures.slice(0, 12).map((f, i) => (
                      <li key={i} className="text-xs text-gray-400 flex items-start gap-1">
                        <span className="mt-0.5 shrink-0">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </>
        )}

        <div className="border-t border-[var(--ds-border)]" />

        {/* ── Market Data (PropertyData enrichment) ──────────────────────────── */}
        {(() => {
          const pda = listing.propertyDataAnalysis as any
          if (!pda) return null

          const bmvPct: number | undefined       = pda.bmvPercent
          const avgComp: number | undefined      = pda.avgComparablePrice
          const compCount: number | undefined    = pda.comparablesCount
          const confidence: string | undefined   = pda.comparablesConfidence
          const monthlyRent: number | undefined  = pda.monthlyRentEstimate
          const grossYield: number | undefined   = pda.grossYieldEstimate
          const epcSource: string | undefined    = pda.epcSource
          const isCommercial = listing.category === "COMMERCIAL"

          const hasBmv   = bmvPct !== undefined && avgComp !== undefined
          const hasRent  = monthlyRent !== undefined

          if (!hasBmv && !hasRent) return null

          const bmvPositive = (bmvPct ?? 0) > 0
          const bmvBig      = (bmvPct ?? 0) >= 15
          const bmvBadge    = bmvPositive
            ? bmvBig
              ? "bg-green-50 text-green-700 border-green-300"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-red-50 text-red-600 border-red-200"

          return (
            <>
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-violet-500" />
                    Market Data
                    <span className="text-[11px] font-normal text-gray-400">(PropertyData)</span>
                  </h4>
                  {hasBmv && (
                    <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-sm font-bold ${bmvBadge}`}>
                      {bmvPositive ? "▼" : "▲"} {Math.abs(bmvPct!).toFixed(1)}% {bmvPositive ? "below" : "above"} market
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  {hasBmv && (
                    <>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Avg Comparable Sale</span>
                        <span className="font-semibold text-gray-800">£{avgComp!.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Comparables</span>
                        <span className="font-semibold text-gray-800">
                          {compCount ?? "—"}
                          {confidence && (
                            <span className={`ml-1 text-[10px] ${
                              confidence === "HIGH" ? "text-green-600" :
                              confidence === "MEDIUM" ? "text-amber-600" : "text-gray-400"
                            }`}>
                              ({confidence})
                            </span>
                          )}
                        </span>
                      </div>
                    </>
                  )}
                  {hasRent && (
                    <>
                      <div>
                        <span className="text-gray-400 block mb-0.5">Est. Monthly Rent</span>
                        <span className="font-semibold text-gray-800">£{monthlyRent!.toLocaleString()}</span>
                      </div>
                      {grossYield !== undefined && (
                        <div>
                          <span className="text-gray-400 block mb-0.5">Gross Yield</span>
                          <span className={`font-semibold ${grossYield >= 7 ? "text-green-700" : grossYield >= 5 ? "text-amber-700" : "text-gray-800"}`}>
                            {grossYield.toFixed(1)}%
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Commercial warning — PropertyData sold prices are residential */}
                {isCommercial && hasBmv && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-[11px] text-amber-700">
                    <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                    <span>
                      <strong>Commercial caveat:</strong> PropertyData sold price comparables are drawn from residential transactions in this postcode.
                      The {bmvPct?.toFixed(1)}% figure reflects residential market prices, not comparable commercial sales — treat with caution.
                      True commercial BMV requires specialist valuation.
                    </span>
                  </div>
                )}

                {epcSource === "propertydata" && (
                  <p className="mt-2 text-[11px] text-gray-400">
                    EPC rating sourced from PropertyData energy efficiency register (not scraped from portal).
                  </p>
                )}
              </div>
              <div className="border-t border-[var(--ds-border)]" />
            </>
          )
        })()}

        {/* ── BMV Signal Score (keyword-based) ───────────────────────────────── */}
        <div>
          {(() => {
            const breakdown = buildBmvBreakdown(bmv)
            const activeItems = breakdown.filter((i) => i.active)
            const computedPts = activeItems.reduce((s, i) => s + i.points, 0)
            const grade = bmvGrade(computedPts)
            return (
              <>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <h4 className="font-semibold text-sm flex items-center gap-1.5">
                    <BarChart2 className="h-3.5 w-3.5 text-gray-400" />
                    BMV Signal Score
                    <span className="text-[11px] font-normal text-gray-400">(keyword signals)</span>
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full text-xs font-semibold px-2.5 py-0.5 ring-1 ${grade.bgColor} ${grade.textColor} ${grade.ringColor}`}>
                      {grade.grade}
                    </span>
                    <span className={`font-bold text-base ${grade.textColor}`}>{computedPts}/100</span>
                  </div>
                </div>

                <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
                  <div
                    className={`h-full rounded-full transition-all ${
                      computedPts >= 80 ? "bg-blue-500" :
                      computedPts >= 60 ? "bg-green-500" :
                      computedPts >= 30 ? "bg-amber-500" : "bg-gray-400"
                    }`}
                    style={{ width: `${computedPts}%` }}
                  />
                </div>

                <div className="flex gap-3 text-[11px] text-gray-400 mb-3">
                  <span><span className="text-blue-500 font-semibold">Exceptional</span> 80+</span>
                  <span>·</span>
                  <span><span className="text-green-600 font-semibold">Strong</span> 60–79</span>
                  <span>·</span>
                  <span><span className="text-amber-600 font-semibold">Moderate</span> 30–59</span>
                  <span>·</span>
                  <span><span className="text-gray-500 font-semibold">Weak</span> 0–29</span>
                </div>

                <div className="rounded-md border overflow-hidden text-xs">
                  <div className="bg-gray-100 px-3 py-1.5 font-medium text-gray-400 flex justify-between">
                    <span>Signal</span>
                    <span>Points</span>
                  </div>
                  {activeItems.length === 0 && (
                    <div className="px-3 py-3 text-center text-xs text-gray-400/70">
                      No BMV signals detected in listing text
                    </div>
                  )}
                  {activeItems.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-2 px-3 py-1.5 border-t">
                      <span>
                        <span className="font-medium text-gray-900">{item.label}</span>
                        {item.detail && <span className="text-gray-400 ml-1.5">— {item.detail}</span>}
                      </span>
                      <span className="font-semibold text-green-600 tabular-nums flex-shrink-0">+{item.points}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-3 py-1.5 border-t bg-gray-100 font-semibold">
                    <span>Total</span>
                    <span className={grade.textColor}>{computedPts} / 100</span>
                  </div>
                </div>
                {computedPts !== bmv.bmvScore && (
                  <p className="mt-1.5 text-[11px] text-gray-400/70 leading-tight">
                    Originally scored {bmv.bmvScore} — re-scraping will refresh signals
                  </p>
                )}
              </>
            )
          })()}

          {/* Motivation Score */}
          {(() => {
            const ms = listing.motivationScore ?? 0
            const signals = (listing.motivationSignals ?? []) as Array<{ name: string; points: number }>
            if (ms === 0 && signals.length === 0) return null
            const msColor = ms >= 70 ? "text-red-600" : ms >= 45 ? "text-orange-600" : ms >= 20 ? "text-amber-600" : "text-gray-400"
            const msBar   = ms >= 70 ? "bg-red-500" : ms >= 45 ? "bg-orange-500" : ms >= 20 ? "bg-amber-400" : "bg-gray-300"
            const msLabel = ms >= 70 ? "High" : ms >= 45 ? "Moderate" : ms >= 20 ? "Some" : "Low"
            return (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold text-gray-700">Motivation Score</span>
                  <span className={`text-xs font-bold ${msColor}`}>{msLabel} — {ms}/100</span>
                </div>
                <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${msBar}`} style={{ width: `${ms}%` }} />
                </div>
                {signals.length > 0 && (
                  <div className="space-y-0.5">
                    {signals.map((s, i) => (
                      <div key={i} className="flex justify-between text-[11px]">
                        <span className="text-gray-500">{s.name}</span>
                        <span className="font-semibold text-amber-600 tabular-nums">+{s.points}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}

          <p className="mt-3 text-[11px] text-gray-400 leading-relaxed">
            Signal score uses listing text, price history and days on market.
            {listing.propertyDataAnalysis
              ? " Real market BMV% shown above from PropertyData comparable sold prices."
              : " Click Enrich on the finder toolbar to fetch real market BMV% from comparable sold prices."}
          </p>
        </div>

        {/* Ambiguity Reasons */}
        {listing.isAmbiguous && listing.ambiguityReasons?.length > 0 && (
          <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
            <h4 className="font-semibold text-sm text-amber-700 flex items-center gap-1 mb-1">
              <AlertTriangle className="h-4 w-4" />
              Flagged for Review
            </h4>
            <ul className="text-xs text-amber-600 space-y-1">
              {listing.ambiguityReasons.map((reason, i) => (
                <li key={i}>- {reason}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Price History */}
        {priceHistory?.length > 0 && (
          <>
            <div className="border-t border-[var(--ds-border)]" />
            <div>
              <h4 className="font-semibold text-sm mb-2">Price History</h4>
              <div className="space-y-1">
                {priceHistory.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400" suppressHydrationWarning>
                      {new Date(entry.date).toLocaleDateString()}
                    </span>
                    <span suppressHydrationWarning className="font-medium">
                      £{entry.price.toLocaleString()}
                      {entry.changePercent && (
                        <span
                          className={
                            entry.changePercent < 0
                              ? "text-red-600 ml-1"
                              : "text-green-600 ml-1"
                          }
                        >
                          ({entry.changePercent > 0 ? "+" : ""}
                          {entry.changePercent}%)
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Portal Data: Listing History · Other Agents · Sold Prices ───── */}
        <div className="border-t border-[var(--ds-border)]" />
        <div>
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-sm flex items-center gap-1.5">
              <History className="h-3.5 w-3.5 text-gray-400" />
              Portal History &amp; Sold Prices
            </h4>
            {portalLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-gray-400" />}
          </div>

          {portalError && (
            <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {portalError === "No full postcode available for this listing"
                ? "No full postcode — portal history unavailable."
                : portalError === "PropertyData API key not configured"
                ? "PropertyData API key not configured."
                : `Could not load portal data: ${portalError}`}
            </p>
          )}

          {!portalLoading && !portalError && portalData && (() => {
            const { listingHistory, activeListings, soldHistory } = portalData
            const hasHistory = listingHistory.length > 0
            const hasActive  = activeListings.length > 0
            const hasSold    = soldHistory.length > 0

            if (!hasHistory && !hasActive && !hasSold) {
              return (
                <p className="text-[11px] text-gray-400">
                  No listing history or sold price records found for this postcode.
                </p>
              )
            }

            return (
              <div className="space-y-4">

                {/* ── Active agents ─────────────────────────────────────────── */}
                {hasActive && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Users className="h-3 w-3 text-blue-500" />
                      <span className="text-xs font-semibold text-gray-700">
                        Currently Listed{activeListings.length > 1
                          ? ` — ${activeListings.length} agents / portals`
                          : " — 1 agent"}
                      </span>
                      {activeListings.length > 1 && (
                        <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded px-1.5 py-0.5 font-semibold">
                          Multi-agent
                        </span>
                      )}
                    </div>
                    <div className="rounded-md border overflow-hidden text-xs">
                      <div className="bg-gray-50 px-3 py-1.5 grid grid-cols-[1fr_80px_80px_100px] gap-2 font-medium text-gray-400">
                        <span>Agent / Portal</span>
                        <span>Price</span>
                        <span>Listed</span>
                        <span>Reductions</span>
                      </div>
                      {activeListings.map((l, i) => (
                        <div key={i} className="px-3 py-1.5 border-t grid grid-cols-[1fr_80px_80px_100px] gap-2 items-start">
                          <div>
                            <span className="font-medium text-gray-800 capitalize">{l.source}</span>
                            {l.agent?.name && (
                              <span className="text-gray-400 ml-1.5">— {l.agent.name}</span>
                            )}
                            {l.url && (
                              <a href={l.url} target="_blank" rel="noopener noreferrer"
                                className="ml-1.5 text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5">
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          <span className="font-semibold tabular-nums" suppressHydrationWarning>
                            £{l.price.toLocaleString()}
                            {l.originalPrice && l.originalPrice !== l.price && (
                              <span className="text-gray-400 line-through ml-1 text-[10px]">
                                £{l.originalPrice.toLocaleString()}
                              </span>
                            )}
                          </span>
                          <span className="text-gray-400" suppressHydrationWarning>
                            {l.dateListed ? new Date(l.dateListed).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" }) : `${l.daysListed}d`}
                          </span>
                          <span className="text-gray-400">
                            {l.priceReductions > 0
                              ? <span className="text-pink-600 font-medium">{l.priceReductions} reduction{l.priceReductions !== 1 ? "s" : ""}</span>
                              : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Listing history ───────────────────────────────────────── */}
                {hasHistory && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <History className="h-3 w-3 text-gray-400" />
                      <span className="text-xs font-semibold text-gray-700">Previous Listings</span>
                    </div>
                    <div className="rounded-md border overflow-hidden text-xs">
                      <div className="bg-gray-50 px-3 py-1.5 grid grid-cols-[1fr_80px_80px_80px] gap-2 font-medium text-gray-400">
                        <span>Portal / Agent</span>
                        <span>Listed at</span>
                        <span>Sold / Removed</span>
                        <span>Days</span>
                      </div>
                      {listingHistory.slice(0, 8).map((h, i) => (
                        <div key={i} className="px-3 py-1.5 border-t grid grid-cols-[1fr_80px_80px_80px] gap-2 items-start">
                          <div>
                            <span className="font-medium text-gray-800 capitalize">{h.source}</span>
                            {h.agent?.name && (
                              <span className="text-gray-400 ml-1.5">— {h.agent.name}</span>
                            )}
                            {h.url && (
                              <a href={h.url} target="_blank" rel="noopener noreferrer"
                                className="ml-1.5 text-blue-500 hover:text-blue-700 inline-flex items-center gap-0.5">
                                <ExternalLink className="h-2.5 w-2.5" />
                              </a>
                            )}
                          </div>
                          <div suppressHydrationWarning>
                            <span className="font-semibold tabular-nums">£{h.listedPrice.toLocaleString()}</span>
                            {h.finalPrice && h.finalPrice !== h.listedPrice && (
                              <span className={`ml-1 text-[10px] ${h.finalPrice < h.listedPrice ? "text-red-500" : "text-green-600"}`}>
                                → £{h.finalPrice.toLocaleString()}
                              </span>
                            )}
                            {h.priceReductions > 0 && (
                              <span className="text-[10px] text-pink-500 ml-1">({h.priceReductions} cut{h.priceReductions !== 1 ? "s" : ""})</span>
                            )}
                          </div>
                          <span className="text-gray-400" suppressHydrationWarning>
                            {h.dateRemoved
                              ? new Date(h.dateRemoved).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" })
                              : "—"}
                          </span>
                          <span className="text-gray-400 tabular-nums">
                            {h.daysListed != null ? `${h.daysListed}d` : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                    {listingHistory.length > 8 && (
                      <p className="text-[11px] text-gray-400 mt-1">+{listingHistory.length - 8} older entries</p>
                    )}
                  </div>
                )}

                {/* ── Sold price history ────────────────────────────────────── */}
                {hasSold && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Landmark className="h-3 w-3 text-emerald-500" />
                      <span className="text-xs font-semibold text-gray-700">Matched Sold Prices</span>
                      <span className="text-[10px] text-gray-400">(Land Registry via PropertyData)</span>
                    </div>
                    <div className="rounded-md border overflow-hidden text-xs">
                      <div className="bg-gray-50 px-3 py-1.5 grid grid-cols-[1fr_100px_80px] gap-2 font-medium text-gray-400">
                        <span>Address</span>
                        <span>Sale Price</span>
                        <span>Date</span>
                      </div>
                      {soldHistory.map((s, i) => {
                        const gain = listing ? ((s.salePrice - Number(listing.price)) / Number(listing.price)) * 100 : null
                        return (
                          <div key={i} className="px-3 py-1.5 border-t grid grid-cols-[1fr_100px_80px] gap-2 items-center">
                            <span className="text-gray-600 truncate">{s.address}</span>
                            <div>
                              <span className="font-semibold tabular-nums" suppressHydrationWarning>
                                £{s.salePrice.toLocaleString()}
                              </span>
                              {gain !== null && Math.abs(gain) > 1 && (
                                <span className={`ml-1.5 text-[10px] font-medium ${gain > 0 ? "text-green-600" : "text-red-500"}`}>
                                  {gain > 0 ? "+" : ""}{gain.toFixed(0)}% vs ask
                                </span>
                              )}
                            </div>
                            <span className="text-gray-400 tabular-nums" suppressHydrationWarning>
                              {new Date(s.saleDate).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Address-matched from PropertyData sold price dataset. Verify on Rightmove/Zoopla house prices.
                    </p>
                  </div>
                )}
              </div>
            )
          })()}

          {!portalLoading && !portalError && !portalData && (
            <p className="text-[11px] text-gray-400">Loading portal history…</p>
          )}
        </div>

        {/* Description */}
        <div className="border-t border-[var(--ds-border)]" />
        <div>
          <h4 className="font-semibold text-sm mb-2">Description</h4>
          <p className="text-sm text-gray-400 whitespace-pre-line line-clamp-10">
            {listing.description ? stripHtml(listing.description) : "No description available"}
          </p>
        </div>

        {/* Agent Info */}
        {agent?.name && (
          <>
            <div className="border-t border-[var(--ds-border)]" />
            <div>
              <h4 className="font-semibold text-sm mb-1">Agent</h4>
              <p className="text-sm">{agent.name}</p>
              {agent.branch && (
                <p className="text-xs text-gray-400">{agent.branch}</p>
              )}
              {agent.phone && (
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {agent.phone}
                </p>
              )}
            </div>
          </>
        )}

        {/* Floor Plans */}
        {floorPlans?.length > 0 && (
          <>
            <div className="border-t border-[var(--ds-border)]" />
            <div>
              <h4 className="font-semibold text-sm mb-2">Floor Plans</h4>
              <div className="flex gap-2 overflow-x-auto">
                {floorPlans.map((fp, i) => (
                  <div key={i} className="group relative flex-shrink-0">
                    <img
                      src={fp}
                      alt={`Floor plan ${i + 1}`}
                      className="h-32 w-auto rounded border cursor-pointer transition-opacity hover:opacity-90"
                      onClick={() => openLightbox(floorPlans, i)}
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <Maximize2 className="h-5 w-5 text-white drop-shadow-lg" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {listing.daysOnMarket > 0
              ? `${listing.daysOnMarket} days on market`
              : listing.daysOnMarket < 0
                ? `${Math.abs(listing.daysOnMarket)}+ days on market`
                : "— days on market"}
          </span>
          <span suppressHydrationWarning>Scraped {new Date(listing.scrapedAt).toLocaleDateString()}</span>
          {listing.listingUrl && (
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[#2563EB] hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {SOURCE_LABELS[listing.source]}
            </a>
          )}
          {duplicates.map((d) =>
            d.listingUrl ? (
              <a
                key={d.id}
                href={d.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#2563EB] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                {SOURCE_LABELS[d.source]}
              </a>
            ) : null
          )}
        </div>

        <div className="border-t border-[var(--ds-border)]" />

        {/* Review Actions */}
        <div className="space-y-3">
          <Textarea
            placeholder="Add review notes (optional)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-green-600 hover:bg-green-700"
              onClick={() => handleReview("APPROVED")}
              disabled={isSubmitting}
            >
              <Check className="mr-2 h-4 w-4" />
              Approve
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => handleReview("REJECTED")}
              disabled={isSubmitting}
            >
              <X className="mr-2 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Lightbox — sibling of <Dialog> in the React tree so it is completely outside
        Radix's focus trap. createPortal renders it to document.body for full-screen
        coverage (escaping the dialog's translate transform). */}
    {lightbox && createPortal(
      <div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-black/95 backdrop-blur-sm"
        onClick={closeLightbox}
      >
        {/* Main image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={lightbox.images[lightbox.index]}
          alt={`Image ${lightbox.index + 1}`}
          onClick={(e) => e.stopPropagation()}
          style={{
            maxHeight: `${Math.min(zoom * 82, 92)}vh`,
            maxWidth: `${Math.min(zoom * 82, 92)}vw`,
            objectFit: "contain",
            borderRadius: "0.375rem",
            transition: "max-height 0.2s, max-width 0.2s",
          }}
        />

        {/* Close */}
        <button
          type="button"
          className="absolute right-4 top-4 rounded-md p-2 text-white bg-black/50 hover:bg-white/20 transition-colors"
          onClick={(e) => { e.stopPropagation(); closeLightbox() }}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Prev */}
        {lightbox.images.length > 1 && (
          <button
            type="button"
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-md p-3 text-white bg-black/50 hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); lightboxPrev() }}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
        )}

        {/* Next */}
        {lightbox.images.length > 1 && (
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md p-3 text-white bg-black/50 hover:bg-white/20 transition-colors"
            onClick={(e) => { e.stopPropagation(); lightboxNext() }}
          >
            <ChevronRight className="h-7 w-7" />
          </button>
        )}

        {/* Zoom controls */}
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-black/60 px-4 py-2"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="p-1 text-white hover:text-white/70 disabled:opacity-40"
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.max(z - 0.25, 0.5)) }}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-sm text-white">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="p-1 text-white hover:text-white/70 disabled:opacity-40"
            onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(z + 0.25, 3)) }}
            disabled={zoom >= 3}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
        </div>

        {/* Counter */}
        <div className="absolute bottom-4 left-4 rounded-lg bg-black/60 px-3 py-2 text-sm text-white">
          {lightbox.index + 1} / {lightbox.images.length}
        </div>

        {/* Thumbnail strip */}
        {lightbox.images.length > 1 && (
          <div
            className="absolute bottom-16 left-1/2 -translate-x-1/2 flex max-w-[90vw] gap-2 overflow-x-auto pb-1"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.images.map((img, i) => (
              <button
                key={i}
                type="button"
                className={`h-14 w-14 flex-shrink-0 overflow-hidden rounded border-2 transition-all ${
                  i === lightbox.index ? "border-white scale-110" : "border-white/30 opacity-60 hover:opacity-100"
                }`}
                onClick={(e) => { e.stopPropagation(); setLightbox((prev) => prev ? { ...prev, index: i } : null); setZoom(1) }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img} alt={`Thumb ${i + 1}`} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>,
      document.body
    )}
    </>
  )
}
