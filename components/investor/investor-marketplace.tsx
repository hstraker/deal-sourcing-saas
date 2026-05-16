"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import {
  Building2, Search, Heart, TrendingUp, BedDouble, Percent,
  PoundSterling, MapPin, Filter, X, Loader2, Sparkles, Star,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Deal {
  id: string
  address: string
  postcode: string
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  askingPrice: number | null
  marketValue: number | null
  estimatedMonthlyRent: number | null
  bmvPercentage: number | null
  grossYield: number | null
  dealScore: number | null
  status: string
  packTier: string | null
  description: string | null
  highlights: string[] | null
  listedAt: string | null
  isFavorited: boolean
  isReserved: boolean
  coverPhoto: { url: string | null; s3Key: string | null } | null
  _count: { photos: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

function scoreColor(score: number | null) {
  if (!score) return "bg-gray-100 text-gray-500"
  if (score >= 75) return "bg-green-100 text-green-700"
  if (score >= 55) return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

function DealCard({ deal, onToggleFavorite }: { deal: Deal; onToggleFavorite: (id: string, favorited: boolean) => void }) {
  const [toggling, setToggling] = useState(false)

  const handleFav = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (toggling) return
    setToggling(true)
    try {
      const action = deal.isFavorited ? "unfavorite" : "favorite"
      const res = await fetch(`/api/investor/deals/${deal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed")
      onToggleFavorite(deal.id, !deal.isFavorited)
    } catch {
      toast.error("Failed to update favorite")
    } finally {
      setToggling(false)
    }
  }

  const coverSrc = deal.coverPhoto?.url

  return (
    <Link href={`/investor/deals/${deal.id}`} className="group block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md hover:border-[#2563EB]/30 transition-all duration-200">

        {/* Photo */}
        <div className="relative h-44 bg-gradient-to-br from-blue-50 to-indigo-100 overflow-hidden">
          {coverSrc ? (
            <img src={coverSrc} alt={deal.address} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <Building2 className="h-12 w-12 text-blue-200" />
            </div>
          )}

          {/* Status badge */}
          <div className="absolute top-2 left-2 flex gap-1.5">
            {deal.isReserved ? (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-500 text-white">Reserved</span>
            ) : (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-500 text-white">Available</span>
            )}
            {deal.packTier && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-600 text-white capitalize">{deal.packTier}</span>
            )}
          </div>

          {/* Deal score */}
          {deal.dealScore != null && (
            <div className="absolute top-2 right-10">
              <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", scoreColor(deal.dealScore))}>
                {deal.dealScore}/100
              </span>
            </div>
          )}

          {/* Favourite button */}
          <button
            onClick={handleFav}
            disabled={toggling}
            className={cn(
              "absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-full border transition-all",
              deal.isFavorited
                ? "bg-red-500 border-red-500 text-white"
                : "bg-white/80 border-white/60 text-gray-500 hover:text-red-500"
            )}
          >
            {toggling
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Heart className={cn("h-3.5 w-3.5", deal.isFavorited && "fill-current")} />
            }
          </button>

          {/* Photo count */}
          {deal._count.photos > 0 && (
            <span className="absolute bottom-2 right-2 text-[10px] bg-black/40 text-white px-1.5 py-0.5 rounded">
              {deal._count.photos} photos
            </span>
          )}
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start gap-1 mb-0.5">
            <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{deal.address}</p>
          </div>
          <p className="text-xs text-gray-400 mb-3">{deal.postcode}</p>

          {/* Specs row */}
          <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
            {deal.bedrooms && (
              <span className="flex items-center gap-1">
                <BedDouble className="h-3.5 w-3.5" /> {deal.bedrooms} bed
              </span>
            )}
            {deal.propertyType && (
              <span className="capitalize">{deal.propertyType.replace(/_/g, " ")}</span>
            )}
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-gray-50 p-2 text-center">
              <p className="text-[10px] text-gray-400 mb-0.5">Price</p>
              <p className="text-xs font-bold text-gray-900">{fmt(deal.askingPrice)}</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-2 text-center">
              <p className="text-[10px] text-emerald-600 mb-0.5">BMV</p>
              <p className="text-xs font-bold text-emerald-700">
                {deal.bmvPercentage ? `${Number(deal.bmvPercentage).toFixed(1)}%` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-blue-50 p-2 text-center">
              <p className="text-[10px] text-blue-600 mb-0.5">Yield</p>
              <p className="text-xs font-bold text-blue-700">
                {deal.grossYield ? `${Number(deal.grossYield).toFixed(1)}%` : "—"}
              </p>
            </div>
          </div>

          {/* Monthly rent */}
          {deal.estimatedMonthlyRent && (
            <p className="text-xs text-gray-500 mt-2 text-center">
              Est. rent: <span className="font-semibold text-gray-700">{fmt(deal.estimatedMonthlyRent)}/mo</span>
            </p>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestorMarketplace() {
  const [deals, setDeals]       = useState<Deal[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [minBedrooms, setMinBedrooms] = useState("")
  const [maxPrice, setMaxPrice]       = useState("")

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (minBedrooms)     params.set("minBedrooms", minBedrooms)
      if (maxPrice)        params.set("maxPrice", maxPrice)
      const res = await fetch(`/api/investor/deals?${params}`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setDeals(data.deals)
    } catch {
      toast.error("Failed to load deals")
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, minBedrooms, maxPrice])

  useEffect(() => { load() }, [load])

  const toggleFavorite = (id: string, favorited: boolean) => {
    setDeals(prev => prev.map(d => d.id === id ? { ...d, isFavorited: favorited } : d))
  }

  const available = deals.filter(d => !d.isReserved)
  const reserved  = deals.filter(d =>  d.isReserved)

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#2563EB]" />
            Deal Marketplace
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Below-market-value investment properties — verified, sourced, and ready.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {available.length > 0 && (
            <span className="text-xs font-semibold bg-green-100 text-green-700 px-3 py-1 rounded-full">
              {available.length} available
            </span>
          )}
        </div>
      </div>

      {/* ── Search + filters ─────────────────────────────────────────────────── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by address, postcode…"
            className="pl-9 h-10"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="sm"
          className="h-10 gap-1.5 px-4"
          onClick={() => setShowFilters(v => !v)}
        >
          <Filter className="h-4 w-4" />
          Filters
          {(minBedrooms || maxPrice) && (
            <span className="ml-1 h-4 w-4 rounded-full bg-white text-[#2563EB] text-[10px] font-bold flex items-center justify-center">
              {[minBedrooms, maxPrice].filter(Boolean).length}
            </span>
          )}
        </Button>
      </div>

      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex gap-4 flex-wrap items-end shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Min bedrooms</label>
            <Input value={minBedrooms} onChange={e => setMinBedrooms(e.target.value)} placeholder="Any" className="h-8 w-28 text-sm" type="number" min={1} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Max price (£)</label>
            <Input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="No limit" className="h-8 w-36 text-sm" type="number" />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-gray-400 gap-1"
            onClick={() => { setMinBedrooms(""); setMaxPrice("") }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center py-24 gap-3 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading deals…</span>
        </div>
      ) : deals.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-200" />
          <p className="text-sm font-medium">No deals available right now</p>
          <p className="text-xs mt-1">Check back soon — new properties are added regularly.</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* Available deals */}
          {available.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                Available Now
                <span className="text-gray-400 font-normal">({available.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {available.map(deal => (
                  <DealCard key={deal.id} deal={deal} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            </section>
          )}

          {/* Reserved deals */}
          {reserved.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-orange-400 inline-block" />
                Recently Reserved
                <span className="text-gray-400 font-normal">({reserved.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 opacity-70">
                {reserved.map(deal => (
                  <DealCard key={deal.id} deal={deal} onToggleFavorite={toggleFavorite} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
