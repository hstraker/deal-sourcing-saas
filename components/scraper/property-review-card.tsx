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
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import type { PropertyListingForClient, BmvIndicatorsData, PriceHistoryEntry } from "@/types/property-listing"

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
  onApprove: (id: string) => void
  onReject: (id: string) => void
  onViewDetails: (listing: PropertyListingForClient) => void
  isSubmitting: boolean
}

export function PropertyReviewCard({
  listing,
  onApprove,
  onReject,
  onViewDetails,
  isSubmitting,
}: PropertyReviewCardProps) {
  const [descExpanded, setDescExpanded] = useState(false)
  const bmv = listing.bmvIndicators as BmvIndicatorsData
  const address = listing.address as any
  const images = listing.images as string[]
  const firstImage = images?.[0]

  const bmvScoreColor =
    bmv.bmvScore >= 60
      ? "text-green-600"
      : bmv.bmvScore >= 30
        ? "text-yellow-600"
        : "text-muted-foreground"

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
      <div className="relative h-40 bg-muted">
        {firstImage ? (
          <img
            src={firstImage}
            alt={listing.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
        <div className="absolute top-2 left-2">
          <Badge className={SOURCE_COLORS[listing.source]}>
            {SOURCE_LABELS[listing.source]}
          </Badge>
        </div>
        {listing.category === "COMMERCIAL" && (
          <div className="absolute top-2 right-2">
            <Badge variant="outline" className="bg-background/80">
              Commercial
            </Badge>
          </div>
        )}
      </div>

      <CardContent className="p-4 space-y-3">
        {/* Title & Address */}
        <div className="space-y-1">
          <h3 className="font-semibold text-sm line-clamp-1">{listing.title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {address?.displayAddress}
          </p>
          {/* Postcode badge */}
          {(() => {
            const pc: string | null | undefined = address?.postcode
            const isFullPostcode = pc && /^[A-Z]{1,2}\d{1,2}[A-Z]?\s?\d[A-Z]{2}$/i.test(pc.trim())
            const isOutcodeOnly = pc && !isFullPostcode && /^[A-Z]{1,2}\d{1,2}[A-Z]?$/i.test(pc.trim())
            if (isFullPostcode) {
              return (
                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px] font-medium px-2 py-0.5">
                  {pc!.trim().toUpperCase()}
                </span>
              )
            }
            if (isOutcodeOnly) {
              return (
                <span className="inline-flex items-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 text-[10px] font-medium px-2 py-0.5">
                  {pc!.trim().toUpperCase()} (outcode only)
                </span>
              )
            }
            return (
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 text-[10px] font-medium px-2 py-0.5">
                No postcode
              </span>
            )
          })()}
        </div>

        {/* Price & Details */}
        <div className="flex items-center justify-between">
          <span suppressHydrationWarning className="text-lg font-bold">
            £{listing.price.toLocaleString()}
          </span>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

        {/* BMV Score */}
        {bmv.bmvScore > 0 && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground flex items-center gap-1 cursor-help">
                      BMV Score
                      <HelpCircle className="h-3 w-3" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-xs">
                    <p className="font-semibold mb-1">BMV Indicator Score (0–100)</p>
                    <p className="mb-1">Signals detected in this listing suggesting below-market-value potential:</p>
                    <ul className="space-y-0.5 list-disc list-inside">
                      <li>Price reduction history</li>
                      <li>"Needs work", "probate", "motivated seller" keywords</li>
                      <li>Auction / repossession / cash only</li>
                      <li>Long time on market</li>
                    </ul>
                    <p className="mt-1.5">
                      <span className="text-green-500 font-medium">60+</span> Strong ·{" "}
                      <span className="text-yellow-500 font-medium">30–59</span> Moderate ·{" "}
                      <span className="text-muted-foreground">0–29</span> Weak
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <span className={`font-semibold ${bmvScoreColor}`}>
                {bmv.bmvScore}/100
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  bmv.bmvScore >= 60
                    ? "bg-green-500"
                    : bmv.bmvScore >= 30
                      ? "bg-yellow-500"
                      : "bg-gray-400"
                }`}
                style={{ width: `${bmv.bmvScore}%` }}
              />
            </div>
          </div>
        )}

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
          <div className="text-xs text-muted-foreground">
            <p>
              {descExpanded || !isLong
                ? cleanDesc
                : cleanDesc.slice(0, DESC_LIMIT) + "…"}
            </p>
            {isLong && (
              <button
                onClick={() => setDescExpanded((v) => !v)}
                className="mt-0.5 flex items-center gap-0.5 text-[10px] text-primary hover:underline"
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
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
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
            <span className="text-orange-500 font-medium">
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
            onClick={() => onViewDetails(listing)}
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
