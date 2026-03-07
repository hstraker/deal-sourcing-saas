"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Check,
  X,
  Eye,
  AlertTriangle,
  Bed,
  Bath,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MapPin,
  MapPinOff,
  Shield,
  Globe,
  Star,
} from "lucide-react"
import type { PropertyListingForClient, BmvIndicatorsData, PriceHistoryEntry } from "@/types/property-listing"
import { buildBmvBreakdown, bmvGrade } from "@/lib/scrapers/bmv-score-breakdown"

function stripHtml(html: string): string {
  if (!html) return ""
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/li>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim()
}

const SOURCE_COLORS: Record<string, string> = {
  RIGHTMOVE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  ZOOPLA: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  ONTHEMARKET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  PRIMELOCATION: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE: "Rightmove",
  ZOOPLA: "Zoopla",
  ONTHEMARKET: "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

interface PropertyReviewCardProps {
  listing: PropertyListingForClient
  duplicates?: PropertyListingForClient[]
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onViewDetails: () => void
  isSubmitting: boolean
}

export function PropertyReviewCard({
  listing,
  duplicates = [],
  onApprove,
  onReject,
  onViewDetails,
  isSubmitting,
}: PropertyReviewCardProps) {
  const [descExpanded, setDescExpanded] = useState(false)
  const [breakdownOpen, setBreakdownOpen] = useState(false)
  const [favorited, setFavorited] = useState(listing.isFavorited)
  const [favLoading, setFavLoading] = useState(false)

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.stopPropagation()
    const next = !favorited
    setFavorited(next)
    setFavLoading(true)
    try {
      await fetch(`/api/properties/listings/${listing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorited: next }),
      })
    } catch {
      setFavorited(!next) // revert on error
    } finally {
      setFavLoading(false)
    }
  }
  const bmv = listing.bmvIndicators as BmvIndicatorsData
  const address = listing.address as any
  const images = listing.images as string[]
  const firstImage = images?.[0]

  // Most recent price change date (for "Reduced X days ago" display)
  // priceHistory stores PREVIOUS prices; if current price < most recent history entry → price was reduced
  const priceHistory = listing.priceHistory as PriceHistoryEntry[]
  const lastReduction = (() => {
    if (!priceHistory || priceHistory.length === 0) return null
    const sorted = [...priceHistory].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    // If current price is less than the most recent recorded (old) price → reduction
    if (listing.price < sorted[0].price) {
      return sorted[0].date
    }
    // Also check for reductions within history itself (multiple re-scrapes)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].price < sorted[i + 1].price) {
        return sorted[i].date
      }
    }
    return null
  })()
  const daysSinceReduction = lastReduction
    ? Math.max(0, Math.floor((Date.now() - new Date(lastReduction).getTime()) / 86400000))
    : null

  const bmvIndicatorTags: string[] = []
  if (bmv.hasReduction) bmvIndicatorTags.push(`Reduced ${bmv.reductionPercentage ? `${bmv.reductionPercentage}%` : ""}`)
  if (bmv.isAuction) bmvIndicatorTags.push("Auction")
  if (bmv.isRepossession) bmvIndicatorTags.push("Repossession")
  if (bmv.isProbate) bmvIndicatorTags.push("Probate")
  if (bmv.isCashBuyersOnly) bmvIndicatorTags.push("Cash only")
  if (bmv.longTimeOnMarket) bmvIndicatorTags.push("Long on market")
  if (bmv.needsWorkKeywords?.length > 0) bmvIndicatorTags.push("Needs work")
  if (bmv.motivatedSellerKeywords?.length > 0) bmvIndicatorTags.push("Motivated seller")

  const cleanDesc = listing.description ? stripHtml(listing.description) : ""
  const DESC_LIMIT = 120
  const isLong = cleanDesc.length > DESC_LIMIT

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative h-40 bg-gray-100">
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          <Badge className={SOURCE_COLORS[listing.source]}>
            {SOURCE_LABELS[listing.source]}
          </Badge>
          {duplicates.map((d) => (
            <Badge key={d.id} className={SOURCE_COLORS[d.source]}>
              {SOURCE_LABELS[d.source]}
            </Badge>
          ))}
        </div>
        <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
          {favorited && (
            <span className="inline-flex items-center rounded-full bg-amber-400/90 p-1 shadow">
              <Star className="h-3 w-3 fill-white text-white" />
            </span>
          )}
          {listing.category === "COMMERCIAL" && (
            <Badge variant="outline" className="bg-background/80">
              Commercial
            </Badge>
          )}
        </div>
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title & Address */}
        <div className="space-y-1">
          <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
          <p className="text-xs text-gray-400 line-clamp-1">
            {address?.displayAddress}
          </p>
          {/* Postcode badge */}
          <PostcodeBadge address={address} />
        </div>

        {/* Price & Details */}
        <div className="flex items-center justify-between">
          <span suppressHydrationWarning className="text-lg font-bold">
            £{listing.price.toLocaleString()}
          </span>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            {listing.bedrooms > 0 && (
              <span className="flex items-center gap-1">
                <Bed className="h-3 w-3" />
                {listing.bedrooms}
              </span>
            )}
            {listing.bathrooms > 0 && (
              <span className="flex items-center gap-1">
                <Bath className="h-3 w-3" />
                {listing.bathrooms}
              </span>
            )}
            <span>{listing.propertyType}</span>
            {listing.squareFeet && (
              <span suppressHydrationWarning>{listing.squareFeet.toLocaleString()} sqft</span>
            )}
          </div>
        </div>

        {/* Property Feature Tags */}
        {(listing.epcRating || listing.tenure || listing.isChainFree || listing.isNewBuild) && (
          <div className="flex flex-wrap gap-1">
            {listing.epcRating && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                ⚡ EPC {listing.epcRating}
              </Badge>
            )}
            {listing.tenure && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {listing.tenure === "FREEHOLD" ? "Freehold"
                  : listing.tenure === "LEASEHOLD" ? "Leasehold"
                  : listing.tenure === "SHARE_OF_FREEHOLD" ? "Share Freehold"
                  : listing.tenure === "COMMONHOLD" ? "Commonhold"
                  : listing.tenure}
              </Badge>
            )}
            {listing.isChainFree && (
              <Badge className="bg-green-100 text-green-800 text-[10px] px-1.5 py-0">
                ✓ Chain Free
              </Badge>
            )}
            {listing.isNewBuild && (
              <Badge className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0">
                New Build
              </Badge>
            )}
          </div>
        )}

        {/* BMV Score + Breakdown */}
        {bmv.bmvScore > 0 && (() => {
          const breakdown = buildBmvBreakdown(bmv)
          const activeItems = breakdown.filter((i) => i.active)
          const inactiveItems = breakdown.filter((i) => !i.active)
          const computedPts = activeItems.reduce((s, i) => s + i.points, 0)
          const grade = bmvGrade(computedPts)
          return (
            <div className="space-y-1.5">
              {/* Score header row */}
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span
                        className={`inline-flex items-center rounded-full text-[10px] font-semibold px-2 py-0.5 ring-1 cursor-help ${grade.bgColor} ${grade.textColor} ${grade.ringColor}`}
                      >
                        {grade.grade}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[200px] text-xs">
                      <p className="font-semibold mb-1">BMV Signal Score</p>
                      <p>{grade.description}</p>
                      <p className="mt-1.5 text-gray-400">
                        Exceptional 80+ · Strong 60–79 · Moderate 30–59 · Weak 0–29
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      computedPts >= 80
                        ? "bg-blue-500"
                        : computedPts >= 60
                          ? "bg-green-500"
                          : computedPts >= 30
                            ? "bg-amber-500"
                            : "bg-gray-400"
                    }`}
                    style={{ width: `${computedPts}%` }}
                  />
                </div>

                <span className={`text-xs font-semibold tabular-nums ${grade.textColor}`}>
                  {computedPts}/100
                </span>

                <button
                  onClick={() => setBreakdownOpen((v) => !v)}
                  className="text-[10px] text-[#2563EB] hover:underline flex items-center gap-0.5"
                >
                  why?
                  {breakdownOpen ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                </button>
              </div>

              {/* Expandable breakdown */}
              {breakdownOpen && (
                <div className="rounded-md border bg-gray-50 p-2 space-y-1 text-[10px]">
                  {activeItems.map((item) => (
                    <div key={item.label} className="flex items-start justify-between gap-2">
                      <span className="text-gray-900 font-medium">
                        {item.label}
                        {item.detail && (
                          <span className="font-normal text-gray-400 ml-1">— {item.detail}</span>
                        )}
                      </span>
                      <span className="text-green-600 font-semibold tabular-nums flex-shrink-0">
                        +{item.points}
                      </span>
                    </div>
                  ))}
                  <div className="pt-1 border-t flex justify-between font-semibold">
                    <span>Total</span>
                    <span className={grade.textColor}>{computedPts} / 100</span>
                  </div>
                  {computedPts !== bmv.bmvScore && (
                    <p className="text-[9px] text-gray-400/60 leading-tight">
                      Originally scored {bmv.bmvScore} — re-scraping will refresh signals
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })()}

        {/* BMV Indicator Tags */}
        {bmvIndicatorTags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bmvIndicatorTags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Ambiguity Warning */}
        {listing.isAmbiguous && (
          <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2">
            <div className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Needs review
            </div>
            {listing.ambiguityReasons?.length > 0 && (
              <ul className="mt-1 text-[10px] text-amber-600 dark:text-amber-500 space-y-0.5">
                {listing.ambiguityReasons.map((reason, i) => (
                  <li key={i}>- {reason}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Description */}
        {cleanDesc && (
          <div className="text-xs text-gray-400">
            <p>
              {descExpanded || !isLong
                ? cleanDesc
                : cleanDesc.slice(0, DESC_LIMIT) + "…"}
            </p>
            {isLong && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-0.5 flex items-center gap-0.5 text-[10px] text-[#2563EB] hover:underline"
              >
                {descExpanded ? (
                  <>Less <ChevronUp className="h-3 w-3" /></>
                ) : (
                  <>More <ChevronDown className="h-3 w-3" /></>
                )}
              </button>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="flex items-center justify-between text-[10px] text-gray-400">
          <span>
            {listing.daysOnMarket > 0
              ? `${listing.daysOnMarket} days on market`
              : listing.daysOnMarket < 0
                ? `${Math.abs(listing.daysOnMarket)}+ days on market`
                : listing.listedDate
                  ? "Listed today"
                  : "— days on market"}
          </span>
          {daysSinceReduction !== null ? (
            <span suppressHydrationWarning className="text-orange-500 font-medium">
              Reduced {daysSinceReduction === 0 ? "today" : `${daysSinceReduction}d ago`}
            </span>
          ) : (
            <span suppressHydrationWarning>Scraped {new Date(listing.scrapedAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="default"
            className="flex-1 bg-green-600 hover:bg-green-700"
            onClick={() => onApprove(listing.id)}
            disabled={isSubmitting}
          >
            <Check className="mr-1 h-3 w-3" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="flex-1"
            onClick={() => onReject(listing.id)}
            disabled={isSubmitting}
          >
            <X className="mr-1 h-3 w-3" />
            Reject
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={toggleFavorite}
            disabled={favLoading}
            className={favorited ? "text-amber-500 border-amber-300 hover:bg-amber-50" : ""}
          >
            <Star className={`h-3 w-3 ${favorited ? "fill-amber-400" : ""}`} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onViewDetails()}
          >
            <Eye className="h-3 w-3" />
          </Button>
          {listing.listingUrl && (
            <a
              href={listing.listingUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Postcode badge ────────────────────────────────────────────────────────────

function PostcodeBadge({ address }: { address: Record<string, unknown> | null | undefined }) {
  const pc = typeof address?.postcode === "string" ? address.postcode.trim().toUpperCase() : null
  const source = typeof address?.postcodeSource === "string" ? address.postcodeSource : null
  const fixed = address?.postcodeFixed === true

  const isFullPostcode = pc ? /^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/.test(pc) : false
  const isOutcodeOnly = pc && !isFullPostcode && /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(pc)

  // No postcode at all
  if (!pc || (!isFullPostcode && !isOutcodeOnly)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-[10px] font-medium px-2 py-0.5">
        <MapPinOff className="h-2.5 w-2.5 shrink-0" />
        No postcode
      </span>
    )
  }

  // Outcode only (e.g. "SA6")
  if (isOutcodeOnly) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5">
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        {pc} (outcode only)
      </span>
    )
  }

  // Full postcode — fixed via Land Registry / PPD
  if (fixed && source === "land_registry") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-[10px] font-medium px-2 py-0.5 cursor-default">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {pc}
              <Shield className="h-2.5 w-2.5 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Postcode resolved via Land Registry / Price Paid Data
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full postcode — fixed via postcodes.io
  if (fixed && source === "postcodes_io") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-[10px] font-medium px-2 py-0.5 cursor-default">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {pc}
              <Globe className="h-2.5 w-2.5 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Postcode resolved via postcodes.io (representative for area)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full postcode — copied from another source listing at same address
  if (fixed && source === "cross_source") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200 text-[10px] font-medium px-2 py-0.5 cursor-default">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {pc}
              <span className="text-[9px] font-bold shrink-0">×2</span>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Postcode matched from another source listing at the same address
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Full postcode — scraped correctly, no fix needed
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] font-medium px-2 py-0.5">
      <MapPin className="h-2.5 w-2.5 shrink-0" />
      {pc}
    </span>
  )
}
