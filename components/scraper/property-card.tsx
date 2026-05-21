"use client"

/**
 * PropertyCard — PropertyEngine-inspired rich listing card.
 *
 * Used in the map split-pane left panel and the grid view.
 * Shows: large photo, price, price/m², address, condition badges,
 * bed/bath/size, BMV signal badges, days on market, agent, quick actions.
 */

import { useState } from "react"
import {
  Bed,
  Bath,
  Ruler,
  Star,
  ExternalLink,
  Plus,
  ChevronLeft,
  ChevronRight,
  Link2,
} from "lucide-react"
import type { PropertyListingForClient, BmvIndicatorsData } from "@/types/property-listing"

// ── Helpers ───────────────────────────────────────────────────────────────────

const SOURCE_DOTS: Record<string, string> = {
  RIGHTMOVE:     "bg-blue-500",
  ZOOPLA:        "bg-purple-500",
  ONTHEMARKET:   "bg-emerald-500",
  PRIMELOCATION: "bg-orange-500",
}
const SOURCE_LABELS: Record<string, string> = {
  RIGHTMOVE:     "Rightmove",
  ZOOPLA:        "Zoopla",
  ONTHEMARKET:   "OnTheMarket",
  PRIMELOCATION: "PrimeLocation",
}

function daysAgoLabel(iso: string | null): { text: string; isToday: boolean } {
  if (!iso) return { text: "", isToday: false }
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return { text: "Added today", isToday: true }
  if (days === 1) return { text: "Added yesterday", isToday: false }
  return { text: `Added ${days}d ago`, isToday: false }
}

function bmvColorClass(score: number): string {
  if (score >= 70) return "bg-green-100 text-green-700 border-green-200"
  if (score >= 45) return "bg-amber-100 text-amber-700 border-amber-200"
  if (score >= 20) return "bg-orange-100 text-orange-700 border-orange-200"
  return "bg-blue-50 text-blue-600 border-blue-100"
}

function pricePerSqm(listing: PropertyListingForClient): number | null {
  const sqm = listing.squareMeters ?? (listing.squareFeet ? Math.round(listing.squareFeet * 0.0929) : null)
  if (!sqm || sqm <= 0) return null
  return Math.round(listing.price / sqm)
}

function sqmLabel(listing: PropertyListingForClient): string | null {
  if (listing.squareMeters) return `${Math.round(listing.squareMeters)} m²`
  if (listing.squareFeet)   return `${listing.squareFeet.toLocaleString()} ft²`
  return null
}

// ── Condition / BMV signal badges ─────────────────────────────────────────────

function getBmvBadges(bmv: BmvIndicatorsData, keyFeatures: string[]): { text: string; style: string }[] {
  const badges: { text: string; style: string }[] = []

  if (bmv.isRepossession)   badges.push({ text: "Repossession", style: "bg-red-100 text-red-700 border-red-200" })
  if (bmv.isProbate)         badges.push({ text: "Probate",      style: "bg-purple-100 text-purple-700 border-purple-200" })
  if (bmv.isAuction)         badges.push({ text: "Auction",      style: "bg-rose-100 text-rose-700 border-rose-200" })
  if (bmv.isCashBuyersOnly)  badges.push({ text: "Cash Only",    style: "bg-gray-100 text-gray-700 border-gray-200" })

  if (bmv.hasReduction && bmv.reductionPercentage) {
    badges.push({
      text:  `Reduced ${bmv.reductionPercentage.toFixed(0)}%`,
      style: "bg-pink-100 text-pink-700 border-pink-200",
    })
  }

  // Derive condition label from key features / keywords
  const featText = keyFeatures.join(" ").toLowerCase()
  const hasModernisation = bmv.needsWorkKeywords.length > 0 || featText.includes("modernisation") || featText.includes("refurb")
  const hasWellMaintained = featText.includes("well maintained") || featText.includes("excellent condition") || featText.includes("immaculate")

  if (hasModernisation)  badges.push({ text: "Requires Modernisation", style: "bg-amber-50 text-amber-700 border-amber-200" })
  if (hasWellMaintained) badges.push({ text: "Well Maintained",        style: "bg-emerald-50 text-emerald-700 border-emerald-200" })

  if (bmv.longTimeOnMarket) badges.push({ text: `${bmv.daysOnMarket}d on market`, style: "bg-slate-100 text-slate-600 border-slate-200" })

  return badges.slice(0, 4)
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PropertyCardProps {
  listing:    PropertyListingForClient
  isSelected?: boolean
  onSelect:   (listing: PropertyListingForClient) => void
  onFavorite: (id: string, current: boolean) => void
  onAddToPipeline?: (listing: PropertyListingForClient) => void
  compact?: boolean // narrower layout for split-pane list
}

export function PropertyCard({
  listing,
  isSelected = false,
  onSelect,
  onFavorite,
  onAddToPipeline,
  compact = false,
}: PropertyCardProps) {
  const [imgIndex, setImgIndex] = useState(0)

  const images    = listing.images as string[]
  const bmv       = listing.bmvIndicators as BmvIndicatorsData
  const address   = listing.address as any
  const ppm2      = pricePerSqm(listing)
  const sqm       = sqmLabel(listing)
  const added     = daysAgoLabel(listing.listedDate)
  const bmvBadges = getBmvBadges(bmv, listing.keyFeatures)
  const score     = bmv?.bmvScore ?? 0

  function prevPhoto(e: React.MouseEvent) {
    e.stopPropagation()
    setImgIndex(i => (i - 1 + images.length) % images.length)
  }
  function nextPhoto(e: React.MouseEvent) {
    e.stopPropagation()
    setImgIndex(i => (i + 1) % images.length)
  }

  return (
    <div
      onClick={() => onSelect(listing)}
      className={`group relative bg-white rounded-xl border transition-all cursor-pointer overflow-hidden ${
        isSelected
          ? "border-[#6366f1] shadow-lg shadow-indigo-100 ring-2 ring-[#6366f1]/20"
          : "border-[#e2e8f0] hover:border-[#94a3b8] hover:shadow-md"
      }`}
    >
      {/* ── Photo ── */}
      <div className={`relative bg-gray-100 overflow-hidden ${compact ? "h-44" : "h-52"}`}>
        {images.length > 0 ? (
          <img
            src={images[imgIndex]}
            alt=""
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <span className="text-gray-300 text-sm">No photo</span>
          </div>
        )}

        {/* Photo navigation */}
        {images.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Photo count */}
            <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] font-semibold rounded-full px-2 py-0.5">
              {imgIndex + 1}/{images.length}
            </div>
          </>
        )}

        {/* Added today badge */}
        {added.isToday && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold rounded-full px-2.5 py-1 shadow-sm">
            ADDED TODAY
          </div>
        )}

        {/* BMV score badge */}
        <div className={`absolute top-2 right-2 text-[10px] font-bold rounded-full px-2.5 py-1 shadow-sm border ${bmvColorClass(score)}`}>
          BMV {score}
        </div>

        {/* Favourite button */}
        <button
          onClick={(e) => { e.stopPropagation(); onFavorite(listing.id, listing.isFavorited) }}
          className="absolute bottom-2 left-2 w-7 h-7 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-sm transition-colors"
        >
          <Star className={`w-3.5 h-3.5 ${listing.isFavorited ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
        </button>

        {/* Source dot */}
        <div className="absolute bottom-2 left-10 flex items-center gap-1.5 bg-white/90 rounded-full px-2 py-1 shadow-sm">
          <span className={`w-1.5 h-1.5 rounded-full ${SOURCE_DOTS[listing.source] || "bg-gray-400"}`} />
          <span className="text-[10px] font-medium text-gray-600">{SOURCE_LABELS[listing.source] || listing.source}</span>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="p-3 space-y-2">

        {/* Price row */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xl font-bold text-[#0f172a]">
            £{listing.price.toLocaleString()}
          </span>
          {ppm2 && (
            <span className="text-xs font-semibold text-[#6366f1]">
              £{ppm2.toLocaleString()}/m²
            </span>
          )}
        </div>

        {/* Address */}
        <div>
          <p className="text-sm font-medium text-[#1e293b] leading-tight truncate">
            {address?.displayAddress || listing.title}
          </p>
          {address?.postcode && (
            <p className="text-xs text-[#94a3b8] mt-0.5">{address.postcode}</p>
          )}
        </div>

        {/* Bed / Bath / Size */}
        <div className="flex items-center gap-3 text-xs text-[#64748b]">
          {listing.bedrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bed className="w-3.5 h-3.5" />{listing.bedrooms}
            </span>
          )}
          {listing.bathrooms > 0 && (
            <span className="flex items-center gap-1">
              <Bath className="w-3.5 h-3.5" />{listing.bathrooms}
            </span>
          )}
          {sqm && (
            <span className="flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5" />{sqm}
            </span>
          )}
          {listing.tenure && (
            <span className="text-[#94a3b8]">{listing.tenure}</span>
          )}
        </div>

        {/* BMV / condition badges */}
        {bmvBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {bmvBadges.map((b) => (
              <span
                key={b.text}
                className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${b.style}`}
              >
                {b.text}
              </span>
            ))}
          </div>
        )}

        {/* No Chain / New Build tags */}
        <div className="flex flex-wrap gap-1">
          {listing.isChainFree && (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
              No Chain
            </span>
          )}
          {listing.isNewBuild && (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
              New Build
            </span>
          )}
          {listing.epcRating && (
            <span className="inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-50 text-gray-600 border border-gray-200">
              EPC {listing.epcRating}
            </span>
          )}
          {listing.propertyType && (
            <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-100 capitalize">
              {listing.propertyType.toLowerCase().replace(/_/g, " ")}
            </span>
          )}
        </div>

        {/* Timing row */}
        <div className="flex items-center justify-between text-[11px] text-[#94a3b8]">
          <span>{!added.isToday && added.text}</span>
          <span>{listing.daysOnMarket > 0 ? `${listing.daysOnMarket}d on market` : ""}</span>
        </div>

        {/* Agent */}
        {(listing.agent as any)?.name && (
          <p className="text-[11px] text-[#94a3b8] truncate">
            {(listing.agent as any).name}
            {(listing.agent as any).branch ? ` · ${(listing.agent as any).branch}` : ""}
          </p>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center gap-1.5 px-3 pb-3 pt-0">
        {listing.listingUrl && (
          <a
            href={listing.listingUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:bg-gray-50 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View listing
          </a>
        )}
        {onAddToPipeline && (
          <button
            onClick={(e) => { e.stopPropagation(); onAddToPipeline(listing) }}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-[#6366f1] hover:bg-[#4f46e5] text-white text-xs font-semibold transition-colors"
          >
            <Plus className="w-3 h-3" />
            Add to Pipeline
          </button>
        )}
        {!listing.listingUrl && !onAddToPipeline && (
          <button
            onClick={(e) => { e.stopPropagation(); onSelect(listing) }}
            className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg border border-[#e2e8f0] text-xs font-medium text-[#64748b] hover:bg-gray-50 transition-colors"
          >
            <Link2 className="w-3 h-3" />
            View details
          </button>
        )}
      </div>
    </div>
  )
}
