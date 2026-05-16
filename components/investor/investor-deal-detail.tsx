"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  Building2, MapPin, BedDouble, Bath, Maximize2, TrendingUp,
  Percent, PoundSterling, Heart, Loader2, ChevronLeft, Check,
  AlertTriangle, Star, Zap, Home, Calendar, ArrowLeft,
  CheckCircle2, Clock, Phone, Mail,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface DealDetail {
  id: string
  address: string
  postcode: string
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  askingPrice: number | null
  marketValue: number | null
  estimatedRefurbCost: number | null
  estimatedMonthlyRent: number | null
  bmvPercentage: number | null
  grossYield: number | null
  netYield: number | null
  dealScore: number | null
  status: string
  description: string | null
  highlights: string[] | null
  listedAt: string | null
  packTier: string | null
  photos: Array<{ id: string; url: string | null; s3Key: string | null; isCover: boolean; caption: string | null }>
}

interface Reservation {
  id: string
  status: string
  createdAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

function pct(n: number | null | undefined) {
  if (n == null) return "—"
  return `${Number(n).toFixed(1)}%`
}

function MetricCard({ label, value, sub, colour }: { label: string; value: string; sub?: string; colour?: string }) {
  return (
    <div className={cn("rounded-xl p-4 text-center", colour ?? "bg-gray-50")}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ── Reservation panel ─────────────────────────────────────────────────────────

function ReservationPanel({
  deal,
  reservation,
  onReserved,
}: {
  deal: DealDetail
  reservation: Reservation | null
  onReserved: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState("")
  const [showNotes, setShowNotes] = useState(false)

  const isReserved = deal.status === "reserved"

  if (reservation) {
    return (
      <div className="rounded-xl border-2 border-green-200 bg-green-50 p-5 text-center">
        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto mb-2" />
        <p className="text-sm font-semibold text-green-800">Interest Registered</p>
        <p className="text-xs text-green-600 mt-1">
          We've recorded your interest. Our team will contact you within 1 business day to discuss next steps.
        </p>
        <Badge className="mt-3 bg-green-100 text-green-700 border-green-200 capitalize">
          {reservation.status}
        </Badge>
      </div>
    )
  }

  if (isReserved) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50 p-5 text-center">
        <Clock className="h-8 w-8 text-orange-400 mx-auto mb-2" />
        <p className="text-sm font-semibold text-orange-700">Currently Reserved</p>
        <p className="text-xs text-orange-600 mt-1">
          This deal has been reserved. Contact us to join the waiting list in case it becomes available again.
        </p>
      </div>
    )
  }

  const handleRegisterInterest = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/investor/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dealId: deal.id, notes: notes || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to register interest")
      toast.success("Interest registered! Our team will be in touch shortly.")
      onReserved()
    } catch (err: any) {
      toast.error(err.message || "Failed to register interest")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border-2 border-[#2563EB]/20 bg-blue-50/50 p-5 space-y-4">
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900">Register Your Interest</p>
        <p className="text-xs text-gray-500 mt-1">
          No payment required. Our sourcing team will contact you to discuss terms and next steps.
        </p>
      </div>

      <div className="space-y-2.5 text-xs text-gray-600">
        {[
          "No obligation — just an expression of interest",
          "Our team contacts you within 1 business day",
          "We'll share the full investor pack and arrange viewings",
          "Reservation fee collected separately once terms agreed",
        ].map((item) => (
          <div key={item} className="flex items-start gap-2">
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0 mt-0.5" />
            <span>{item}</span>
          </div>
        ))}
      </div>

      {showNotes ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Any questions or notes for our team? (optional)"
            className="w-full text-xs rounded-lg border border-gray-200 p-2.5 resize-none h-20 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
          />
        </div>
      ) : (
        <button
          className="text-xs text-[#2563EB] hover:underline"
          onClick={() => setShowNotes(true)}
        >
          + Add a note for our team
        </button>
      )}

      <Button
        className="w-full gap-2"
        onClick={handleRegisterInterest}
        disabled={loading}
      >
        {loading
          ? <><Loader2 className="h-4 w-4 animate-spin" /> Registering…</>
          : <><Zap className="h-4 w-4" /> Register Interest</>
        }
      </Button>

      <p className="text-[10px] text-center text-gray-400">
        By registering interest you agree to be contacted by our sourcing team.
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestorDealDetail({ dealId }: { dealId: string }) {
  const router = useRouter()
  const [deal, setDeal] = useState<DealDetail | null>(null)
  const [isFavorited, setIsFavorited] = useState(false)
  const [reservation, setReservation] = useState<Reservation | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePhoto, setActivePhoto] = useState(0)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    fetch(`/api/investor/deals/${dealId}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { router.push("/investor/marketplace"); return }
        setDeal(data.deal)
        setIsFavorited(data.isFavorited)
        setReservation(data.reservation)
      })
      .catch(() => router.push("/investor/marketplace"))
      .finally(() => setLoading(false))
  }, [dealId, router])

  const toggleFav = async () => {
    if (!deal || toggling) return
    setToggling(true)
    try {
      const action = isFavorited ? "unfavorite" : "favorite"
      const res = await fetch(`/api/investor/deals/${deal.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) throw new Error("Failed")
      setIsFavorited(v => !v)
    } catch {
      toast.error("Failed to update favourite")
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading deal…</span>
      </div>
    )
  }

  if (!deal) return null

  const photos = deal.photos ?? []
  const coverPhoto = photos[activePhoto]?.url ?? null
  const isReservedByMe = !!reservation

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Back link ──────────────────────────────────────────────────────── */}
      <Link href="/investor/marketplace" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Back to Marketplace
      </Link>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: photos + details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Photo gallery */}
          <div className="rounded-xl overflow-hidden bg-gray-100">
            <div className="relative h-72 sm:h-96 bg-gradient-to-br from-blue-50 to-indigo-100">
              {coverPhoto ? (
                <img src={coverPhoto} alt={deal.address} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <Building2 className="h-16 w-16 text-blue-200" />
                </div>
              )}

              {/* Favourite */}
              <button
                onClick={toggleFav}
                disabled={toggling}
                className={cn(
                  "absolute top-3 right-3 h-9 w-9 flex items-center justify-center rounded-full border-2 shadow-sm transition-all",
                  isFavorited
                    ? "bg-red-500 border-red-500 text-white"
                    : "bg-white border-white text-gray-500 hover:text-red-500"
                )}
              >
                {toggling
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Heart className={cn("h-4 w-4", isFavorited && "fill-current")} />
                }
              </button>

              {/* Status badge */}
              <div className="absolute top-3 left-3">
                {deal.status === "reserved" ? (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-orange-500 text-white">Reserved</span>
                ) : (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-green-500 text-white">Available</span>
                )}
              </div>
            </div>

            {/* Thumbnails */}
            {photos.length > 1 && (
              <div className="flex gap-1.5 p-2 overflow-x-auto bg-gray-50">
                {photos.slice(0, 8).map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setActivePhoto(i)}
                    className={cn(
                      "shrink-0 h-14 w-20 rounded overflow-hidden border-2 transition-all",
                      i === activePhoto ? "border-[#2563EB]" : "border-transparent opacity-60 hover:opacity-100"
                    )}
                  >
                    {p.url
                      ? <img src={p.url} className="w-full h-full object-cover" alt="" />
                      : <div className="w-full h-full bg-gray-200" />
                    }
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Address + specs */}
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-start gap-2">
              <MapPin className="h-5 w-5 text-[#2563EB] shrink-0 mt-0.5" />
              {deal.address}
            </h1>
            <p className="text-sm text-gray-400 ml-7">{deal.postcode}</p>

            <div className="flex flex-wrap gap-3 mt-3 ml-7">
              {deal.bedrooms && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  <BedDouble className="h-4 w-4" /> {deal.bedrooms} bedrooms
                </span>
              )}
              {deal.bathrooms && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  <Bath className="h-4 w-4" /> {deal.bathrooms} bathrooms
                </span>
              )}
              {deal.squareFeet && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                  <Maximize2 className="h-4 w-4" /> {deal.squareFeet.toLocaleString()} sq ft
                </span>
              )}
              {deal.propertyType && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full capitalize">
                  <Home className="h-4 w-4" /> {deal.propertyType.replace(/_/g, " ")}
                </span>
              )}
            </div>
          </div>

          {/* Key metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Asking Price"   value={fmt(deal.askingPrice)}                     colour="bg-gray-50" />
            <MetricCard label="Market Value"   value={fmt(deal.marketValue)}                     colour="bg-indigo-50" />
            <MetricCard label="Below Market"   value={pct(deal.bmvPercentage)}                   colour="bg-emerald-50" sub="discount to market" />
            <MetricCard label="Gross Yield"    value={pct(deal.grossYield)}                      colour="bg-blue-50" sub={deal.estimatedMonthlyRent ? `${fmt(deal.estimatedMonthlyRent)}/mo` : undefined} />
          </div>

          {deal.estimatedRefurbCost && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Refurbishment Required</p>
                <p className="text-xs text-amber-600">
                  Estimated cost: <span className="font-bold">{fmt(deal.estimatedRefurbCost)}</span> — full breakdown available on request
                </p>
              </div>
            </div>
          )}

          {/* Highlights */}
          {deal.highlights && deal.highlights.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">Deal Highlights</h2>
              <div className="space-y-1.5">
                {deal.highlights.map((h, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    {h}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {deal.description && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-gray-700">About This Deal</h2>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">{deal.description}</p>
            </div>
          )}

          {/* What happens next */}
          <div className="rounded-xl bg-[#1a1a2e] text-white p-5 space-y-4">
            <h2 className="text-sm font-semibold">What Happens Next?</h2>
            <div className="space-y-3">
              {[
                ["Register Interest", "Click the button — no payment required at this stage."],
                ["Our Team Contacts You", "We'll be in touch within 1 business day to discuss the deal and your requirements."],
                ["Arrange Viewing", "We'll organise a viewing at a time that suits you."],
                ["Reserve & Complete", "Once happy, we'll agree terms and proceed to reservation and completion."],
              ].map(([title, desc], i) => (
                <div key={title} className="flex gap-3">
                  <span className="h-6 w-6 rounded-full bg-[#2563EB] text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-white">{title}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: reservation panel */}
        <div className="space-y-4">
          <ReservationPanel
            deal={deal}
            reservation={reservation}
            onReserved={() => {
              setReservation({ id: "new", status: "pending", createdAt: new Date().toISOString() })
            }}
          />

          {/* Contact box */}
          <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2 text-xs text-gray-600">
            <p className="font-semibold text-gray-800 text-sm">Questions?</p>
            <p className="text-gray-500">Our sourcing team is here to help.</p>
            <div className="flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-gray-400" />
              <a href="mailto:deals@dealstack.co.uk" className="text-[#2563EB] hover:underline">
                deals@dealstack.co.uk
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-3.5 w-3.5 text-gray-400" />
              <span>Mon–Fri 9am–6pm</span>
            </div>
          </div>

          {/* Net yield */}
          {deal.netYield && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-xs text-emerald-600 mb-1">Net Yield (after costs)</p>
              <p className="text-2xl font-bold text-emerald-700">{pct(deal.netYield)}</p>
              <p className="text-[10px] text-emerald-500 mt-0.5">After management, voids & maintenance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
