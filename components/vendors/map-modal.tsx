"use client"

import { useState } from "react"
import type { ReactNode, ElementType } from "react"
import { ExternalLink, Navigation, Search, Map, Layers } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

// ─── component ───────────────────────────────────────────────────────────────

type MapType = "roadmap" | "satellite"

export function MapModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const [mapType, setMapType] = useState<MapType>("roadmap")

  // ── URL helpers ─────────────────────────────────────────────────────────
  const address  = lead.propertyAddress ?? lead.propertyPostcode ?? ""
  const encoded  = encodeURIComponent(address)
  const apiKey   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

  // Embedded map (switches between roadmap and satellite)
  const embedSrc = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}&zoom=15&maptype=${mapType}`

  // External links (open in new tab)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`
  const streetViewUrl = `https://www.google.com/maps?q=${encoded}&layer=c`
  const postcodeSlug  = (lead.propertyPostcode ?? "").replace(/\s/g, "").toUpperCase()
  const rightmoveUrl  = postcodeSlug
    ? `https://www.rightmove.co.uk/property-for-sale/find.html?searchType=SALE&locationIdentifier=POSTCODE%5E${postcodeSlug}`
    : `https://www.rightmove.co.uk/property-for-sale/search.html?searchLocation=${encoded}`
  const zooplaUrl = postcodeSlug
    ? `https://www.zoopla.co.uk/for-sale/property/${postcodeSlug.toLowerCase().replace(/([a-z])(\d)/i, "$1-$2")}/`
    : `https://www.zoopla.co.uk/for-sale/property/${encoded}/`

  // ── derived values ──────────────────────────────────────────────────────
  const bmv         = toNum(lead.bmvScore)
  const marketValue = toNum(lead.estimatedMarketValue)
  const monthlyRent = toNum(lead.estimatedMonthlyRent)
  const askingPrice = toNum(lead.askingPrice)
  const profit      = toNum(lead.profitPotential)

  const bmvColour =
    bmv === null         ? "text-slate-300"
    : bmv >= 15          ? "text-green-400"
    : bmv >= 10          ? "text-amber-400"
    :                      "text-red-400"

  const conditionChipClass =
    lead.condition === "excellent" || lead.condition === "good"
      ? "bg-green-500 text-white"
      : lead.condition === "needs_work" || lead.condition === "needs_modernisation"
      ? "bg-amber-400 text-amber-900"
      : lead.condition === "poor"
      ? "bg-red-500 text-white"
      : "bg-white/10 text-slate-200"

  // ── row helper ──────────────────────────────────────────────────────────
  function InfoRow({ label, value, valueClass }: { label: string; value: ReactNode; valueClass?: string }) {
    return (
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex-shrink-0 text-slate-400">{label}</span>
        <span className={cn("text-right font-semibold text-slate-100 truncate", valueClass)}>{value}</span>
      </div>
    )
  }

  // ── external link button ────────────────────────────────────────────────
  function ExtLink({ href, icon: Icon, label }: { href: string; icon: ElementType; label: string }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-[10px] font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Icon className="h-3 w-3 flex-shrink-0" />
        {label}
      </a>
    )
  }

  // ── left panel ──────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col gap-0 overflow-y-auto p-5">

      {/* Property address + pills */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address provided"}
        </p>
        <p className="mt-0.5 font-mono text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.bathrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bathrooms} bath
            </span>
          )}
          {lead.squareFeet && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.squareFeet.toLocaleString()} ft²
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.tenureType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.tenureType}
            </span>
          )}
          {lead.condition && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize", conditionChipClass)}>
              {lead.condition.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Investment metrics */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Investment Metrics</p>
        <InfoRow label="Asking Price" value={fmtCurrency(askingPrice)} />
        <InfoRow label="Est. Market Value" value={marketValue ? fmtCurrency(marketValue) : "—"} />
        <InfoRow
          label="BMV %"
          value={bmv !== null ? `${bmv.toFixed(1)}%` : "—"}
          valueClass={bmvColour}
        />
        {monthlyRent !== null && (
          <InfoRow label="Est. Monthly Rent" value={`${fmtCurrency(monthlyRent)}/mo`} />
        )}
        {profit !== null && (
          <InfoRow
            label="Profit Potential"
            value={fmtCurrency(profit)}
            valueClass={profit > 0 ? "text-green-400" : "text-red-400"}
          />
        )}
        {lead.comparablesCount != null && (
          <InfoRow
            label="Comparables"
            value={`${lead.comparablesCount} found`}
            valueClass={lead.comparablesCount >= 3 ? "text-green-400" : "text-amber-400"}
          />
        )}
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Vendor */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <InfoRow label="Name" value={lead.vendorName} />
        <InfoRow label="Phone" value={lead.vendorPhone} />
        {lead.motivationScore !== null && (
          <InfoRow
            label="Motivation"
            value={`${lead.motivationScore}/10`}
            valueClass={
              lead.motivationScore >= 8 ? "text-green-400"
              : lead.motivationScore >= 5 ? "text-amber-400"
              : "text-slate-300"
            }
          />
        )}
        {lead.urgencyLevel && (
          <InfoRow
            label="Urgency"
            value={lead.urgencyLevel.charAt(0).toUpperCase() + lead.urgencyLevel.slice(1)}
          />
        )}
        {lead.reasonForSelling && (
          <InfoRow
            label="Reason for Selling"
            value={lead.reasonForSelling.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          />
        )}
        {lead.competingOffers && (
          <InfoRow label="Competing Offers" value="Yes" valueClass="text-amber-400" />
        )}
      </div>

      {/* Quick links + pipeline — pinned to bottom */}
      <div className="mt-auto space-y-2 border-t border-white/10 pt-4">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Quick Links</p>

        <div className="flex gap-1.5">
          <ExtLink href={googleMapsUrl} icon={ExternalLink} label="Google Maps" />
          <ExtLink href={streetViewUrl} icon={Navigation} label="Street View" />
        </div>
        <div className="flex gap-1.5">
          <ExtLink href={rightmoveUrl} icon={Search} label="Rightmove" />
          <ExtLink href={zooplaUrl} icon={Search} label="Zoopla" />
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="3xl" rightPanelClassName="p-0 relative">
      {/* Map / Satellite toggle — floats over the top-right corner of the iframe */}
      <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-lg border border-white/20 shadow-lg">
        <button
          onClick={() => setMapType("roadmap")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
            mapType === "roadmap"
              ? "bg-white text-gray-900"
              : "bg-black/50 text-white hover:bg-black/70"
          )}
        >
          <Map className="h-3 w-3" /> Map
        </button>
        <button
          onClick={() => setMapType("satellite")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
            mapType === "satellite"
              ? "bg-white text-gray-900"
              : "bg-black/50 text-white hover:bg-black/70"
          )}
        >
          <Layers className="h-3 w-3" /> Satellite
        </button>
      </div>

      {/* Embedded Google Map — fills the right panel edge-to-edge */}
      <iframe
        key={mapType}   /* force reload when type changes */
        src={embedSrc}
        width="100%"
        height="100%"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full min-h-[300px] w-full border-0"
        title={`Map: ${address}`}
      />
    </ModalShell>
  )
}
