"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import {
  LayoutDashboard, Heart, Building2, Clock, CheckCircle2,
  TrendingUp, Loader2, MapPin, BedDouble, ArrowRight,
  Star, ShoppingBag,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReservationDeal {
  id: string
  address: string
  postcode: string
  propertyType: string | null
  bedrooms: number | null
  askingPrice: number | null
  bmvPercentage: number | null
  grossYield: number | null
  status: string
  coverPhoto: { url: string | null } | null
}

interface Reservation {
  id: string
  status: string
  createdAt: string
  deal: ReservationDeal
}

interface InvestorProfile {
  firstName: string | null
  lastName: string | null
  email: string
  investor: {
    pipelineStage: string
    dealsPurchased: number
    dealsViewed: number
    _count: { favorites: number; reservations: number }
  } | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

const RESERVATION_STATUS_LABEL: Record<string, { label: string; colour: string }> = {
  pending:               { label: "Interest Registered",  colour: "bg-blue-100 text-blue-700 border-blue-200" },
  pack_sent:             { label: "Pack Sent",            colour: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  fee_pending:           { label: "Fee Pending",          colour: "bg-amber-100 text-amber-700 border-amber-200" },
  fee_paid:              { label: "Fee Paid",             colour: "bg-green-100 text-green-700 border-green-200" },
  proof_of_funds_pending:{ label: "PoF Required",         colour: "bg-orange-100 text-orange-700 border-orange-200" },
  pof_received:          { label: "PoF Received",         colour: "bg-lime-100 text-lime-700 border-lime-200" },
  verified:              { label: "Verified",             colour: "bg-teal-100 text-teal-700 border-teal-200" },
  lock_out_sent:         { label: "Lock-out Sent",        colour: "bg-purple-100 text-purple-700 border-purple-200" },
  locked_out:            { label: "Locked Out",           colour: "bg-violet-100 text-violet-700 border-violet-200" },
  completed:             { label: "Completed ✓",          colour: "bg-green-100 text-green-800 border-green-300" },
  cancelled:             { label: "Cancelled",            colour: "bg-gray-100 text-gray-500 border-gray-200" },
}

// ── Reservation card ──────────────────────────────────────────────────────────

function ReservationCard({ r }: { r: Reservation }) {
  const status = RESERVATION_STATUS_LABEL[r.status] ?? { label: r.status, colour: "bg-gray-100 text-gray-600" }
  const coverSrc = r.deal.coverPhoto?.url

  return (
    <Link href={`/investor/deals/${r.deal.id}`} className="group block">
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex gap-0 hover:shadow-md hover:border-[#2563EB]/30 transition-all">
        {/* Photo */}
        <div className="h-24 w-24 shrink-0 bg-gradient-to-br from-blue-50 to-indigo-100">
          {coverSrc
            ? <img src={coverSrc} className="w-full h-full object-cover" alt="" />
            : <div className="flex items-center justify-center h-full"><Building2 className="h-6 w-6 text-blue-200" /></div>
          }
        </div>

        <div className="flex-1 min-w-0 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{r.deal.address}</p>
              <p className="text-xs text-gray-400">{r.deal.postcode}</p>
            </div>
            <Badge className={cn("text-[10px] font-semibold shrink-0 border", status.colour)}>
              {status.label}
            </Badge>
          </div>

          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
            {r.deal.bedrooms && (
              <span className="flex items-center gap-1"><BedDouble className="h-3 w-3" /> {r.deal.bedrooms} bed</span>
            )}
            {r.deal.askingPrice && (
              <span className="font-semibold text-gray-800">{fmt(r.deal.askingPrice)}</span>
            )}
            {r.deal.bmvPercentage && (
              <span className="text-emerald-600 font-semibold">
                {Number(r.deal.bmvPercentage).toFixed(1)}% BMV
              </span>
            )}
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            Registered {new Date(r.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>

        <div className="flex items-center px-3 text-gray-300 group-hover:text-[#2563EB] transition-colors">
          <ArrowRight className="h-4 w-4" />
        </div>
      </div>
    </Link>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestorDashboard() {
  const [profile, setProfile] = useState<InvestorProfile | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch("/api/investor/profile").then(r => r.json()),
      fetch("/api/investor/reservations").then(r => r.json()),
    ])
      .then(([profileData, resData]) => {
        setProfile(profileData.user)
        setReservations(resData.reservations ?? [])
      })
      .catch(() => toast.error("Failed to load dashboard"))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="text-sm">Loading your dashboard…</span>
      </div>
    )
  }

  const firstName = profile?.firstName ?? "Investor"
  const inv = profile?.investor

  const activeReservations   = reservations.filter(r => !["cancelled", "completed"].includes(r.status))
  const completedReservations = reservations.filter(r => r.status === "completed")

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* ── Welcome ─────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {firstName} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Here's an overview of your deal activity on DealStack.
        </p>
      </div>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Deals Viewed",    value: inv?.dealsViewed ?? 0,            icon: Building2,    colour: "text-blue-600 bg-blue-50" },
          { label: "Interests",       value: reservations.length,              icon: Star,         colour: "text-amber-600 bg-amber-50" },
          { label: "Active",          value: activeReservations.length,        icon: Clock,        colour: "text-purple-600 bg-purple-50" },
          { label: "Completed",       value: completedReservations.length,     icon: CheckCircle2, colour: "text-green-600 bg-green-50" },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center mb-2", colour)}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Active reservations ──────────────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-purple-500" />
            Active Interests ({activeReservations.length})
          </h2>
          <Link href="/investor/marketplace">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Browse More Deals
            </Button>
          </Link>
        </div>

        {activeReservations.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-xl border border-gray-200">
            <Star className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-500 font-medium">No active interests</p>
            <p className="text-xs text-gray-400 mt-1 mb-4">Browse the marketplace and register interest in deals you like.</p>
            <Link href="/investor/marketplace">
              <Button size="sm" className="text-xs gap-1.5">
                <Building2 className="h-3.5 w-3.5" /> View Marketplace
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeReservations.map(r => (
              <ReservationCard key={r.id} r={r} />
            ))}
          </div>
        )}
      </section>

      {/* ── Completed deals ──────────────────────────────────────────────────── */}
      {completedReservations.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Completed Deals ({completedReservations.length})
          </h2>
          <div className="space-y-3 opacity-80">
            {completedReservations.map(r => (
              <ReservationCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      {/* ── Investor criteria summary ─────────────────────────────────────────── */}
      {inv && (
        <section className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[#2563EB]" />
            Your Investment Preferences
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            {inv.strategy?.length > 0 && (
              <div>
                <p className="text-gray-400 mb-1">Strategy</p>
                <div className="flex flex-wrap gap-1">
                  {inv.strategy.map((s: string) => (
                    <span key={s} className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {(inv as any).minBudget && (
              <div>
                <p className="text-gray-400 mb-1">Budget</p>
                <p className="font-semibold text-gray-800">
                  {fmt((inv as any).minBudget)} – {fmt((inv as any).maxBudget)}
                </p>
              </div>
            )}
            {(inv as any).minYield && (
              <div>
                <p className="text-gray-400 mb-1">Min Yield</p>
                <p className="font-semibold text-gray-800">{(inv as any).minYield}%</p>
              </div>
            )}
            {(inv as any).minBmv && (
              <div>
                <p className="text-gray-400 mb-1">Min BMV</p>
                <p className="font-semibold text-gray-800">{(inv as any).minBmv}%</p>
              </div>
            )}
            {(inv as any).preferredAreas?.length > 0 && (
              <div className="col-span-2">
                <p className="text-gray-400 mb-1">Preferred Areas</p>
                <p className="font-medium text-gray-700">{(inv as any).preferredAreas.join(", ")}</p>
              </div>
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-4">
            Contact our team to update your preferences and get matched to deals that fit your criteria.
          </p>
        </section>
      )}
    </div>
  )
}
