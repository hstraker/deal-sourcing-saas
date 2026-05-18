"use client"

import { useState } from "react"
import type { ReactNode, ElementType } from "react"
import { ExternalLink, Search, Map, Layers, Camera, Sparkles, X } from "lucide-react"
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

// ─── types ────────────────────────────────────────────────────────────────────

type MapType = "roadmap" | "satellite" | "streetview"

interface StreetViewAnalysis {
  hasStreetViewData: boolean
  kerbAppeal: number | null
  frontageCondition: string | null
  neighbourhoodCharacter: string | null
  concerns: string[]
  greenFlags: string[]
  narrative: string
}

// ─── component ───────────────────────────────────────────────────────────────

export function MapModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const [mapType, setMapType] = useState<MapType>("roadmap")
  const [svAnalysis, setSvAnalysis] = useState<StreetViewAnalysis | null>(null)
  const [svLoading, setSvLoading] = useState(false)
  const [svError, setSvError] = useState<string | null>(null)
  // lat,lng resolved from postcode via postcodes.io — required for streetview embed
  const [svCoords, setSvCoords] = useState<string | null>(null)
  const [svCoordsLoading, setSvCoordsLoading] = useState(false)

  // ── lat/lng resolution ───────────────────────────────────────────────────
  async function resolveCoords() {
    const postcode = (lead.propertyPostcode ?? "").replace(/\s/g, "")
    if (!postcode) return
    setSvCoordsLoading(true)
    try {
      const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`)
      const json = await res.json()
      if (json.result?.latitude && json.result?.longitude) {
        setSvCoords(`${json.result.latitude},${json.result.longitude}`)
      }
    } catch {
      // silently ignore — iframe will show Google's own error
    } finally {
      setSvCoordsLoading(false)
    }
  }

  // ── map type with reset ──────────────────────────────────────────────────
  function setMapTypeAndReset(t: MapType) {
    setMapType(t)
    if (t !== "streetview") {
      setSvAnalysis(null); setSvError(null)
    } else if (!svCoords) {
      resolveCoords()
    }
  }

  // ── Street View AI analysis ──────────────────────────────────────────────
  async function handleStreetViewAnalyse() {
    setSvLoading(true)
    setSvError(null)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}/street-view-analysis`, { method: "POST" })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Analysis failed")
      setSvAnalysis(json.analysis as StreetViewAnalysis)
    } catch (err: unknown) {
      setSvError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setSvLoading(false)
    }
  }

  // ── URL helpers ─────────────────────────────────────────────────────────
  const address  = lead.propertyAddress ?? lead.propertyPostcode ?? ""
  const encoded  = encodeURIComponent(address)
  const apiKey   = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""

  // Embedded map (switches between roadmap, satellite and streetview)
  // Streetview requires lat,lng — resolved async from postcodes.io
  const embedSrc = mapType === "streetview"
    ? svCoords
      ? `https://www.google.com/maps/embed/v1/streetview?key=${apiKey}&location=${svCoords}&heading=235&pitch=0&fov=80`
      : null  // not ready yet — show spinner instead of iframe
    : `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}&zoom=15&maptype=${mapType}`

  // External links (open in new tab)
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encoded}`
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
      {/* Map / Satellite / Street View toggle — floats over the top-right corner of the iframe */}
      <div className="absolute right-3 top-3 z-10 flex overflow-hidden rounded-lg border border-white/20 shadow-lg">
        <button
          onClick={() => setMapTypeAndReset("roadmap")}
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
          onClick={() => setMapTypeAndReset("satellite")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
            mapType === "satellite"
              ? "bg-white text-gray-900"
              : "bg-black/50 text-white hover:bg-black/70"
          )}
        >
          <Layers className="h-3 w-3" /> Satellite
        </button>
        <button
          onClick={() => setMapTypeAndReset("streetview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold transition-colors",
            mapType === "streetview"
              ? "bg-white text-gray-900"
              : "bg-black/50 text-white hover:bg-black/70"
          )}
        >
          <Camera className="h-3 w-3" /> Street View
        </button>
      </div>

      {/* Embedded Google Map — fills the right panel edge-to-edge */}
      {embedSrc ? (
        <iframe
          key={embedSrc}  /* force reload when src changes */
          src={embedSrc}
          width="100%"
          height="100%"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="block h-full min-h-[300px] w-full border-0"
          title={`Map: ${address}`}
        />
      ) : (
        /* Resolving lat/lng from postcode before streetview can load */
        <div className="flex h-full w-full items-center justify-center bg-gray-900">
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            {svCoordsLoading ? "Locating property…" : "No postcode available for street view"}
          </div>
        </div>
      )}

      {/* Street View AI analysis overlay */}
      {mapType === "streetview" && (
        <div className="absolute bottom-0 left-0 right-0 z-10">
          {/* Analyse button (shown when no analysis yet) */}
          {!svAnalysis && !svLoading && (
            <div className="flex justify-end p-3">
              <button
                onClick={handleStreetViewAnalyse}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg hover:bg-indigo-700 transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Analyse Frontage with AI
              </button>
            </div>
          )}
          {/* Loading state */}
          {svLoading && (
            <div className="flex justify-end p-3">
              <div className="flex items-center gap-2 rounded-lg bg-black/70 px-4 py-2 text-xs text-white">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Analysing street view…
              </div>
            </div>
          )}
          {/* Error */}
          {svError && !svLoading && (
            <div className="m-3 rounded-lg bg-red-900/80 px-4 py-2 text-xs text-red-200">
              {svError}
            </div>
          )}
          {/* Analysis results card */}
          {svAnalysis && !svLoading && (
            <div className="m-3 rounded-xl bg-gray-900/95 p-4 shadow-2xl backdrop-blur-sm border border-white/10">
              {!svAnalysis.hasStreetViewData ? (
                <p className="text-xs text-slate-400">{svAnalysis.narrative}</p>
              ) : (
                <>
                  {/* Header row */}
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      <span className="text-xs font-bold text-slate-100">AI Frontage Analysis</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* Kerb appeal score */}
                      {svAnalysis.kerbAppeal != null && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-400">Kerb appeal</span>
                          <span className={cn(
                            "text-sm font-bold",
                            svAnalysis.kerbAppeal >= 7 ? "text-green-400"
                            : svAnalysis.kerbAppeal >= 5 ? "text-amber-400"
                            : "text-red-400"
                          )}>
                            {svAnalysis.kerbAppeal}/10
                          </span>
                        </div>
                      )}
                      <button
                        onClick={() => setSvAnalysis(null)}
                        className="rounded p-0.5 text-slate-500 hover:text-slate-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Badges row */}
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {svAnalysis.frontageCondition && (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                        svAnalysis.frontageCondition === "excellent" || svAnalysis.frontageCondition === "good"
                          ? "bg-green-500/20 text-green-300"
                          : svAnalysis.frontageCondition === "average"
                          ? "bg-amber-500/20 text-amber-300"
                          : "bg-red-500/20 text-red-300"
                      )}>
                        {svAnalysis.frontageCondition.replace("_"," ")} frontage
                      </span>
                    )}
                    {svAnalysis.neighbourhoodCharacter && (
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-300">
                        {svAnalysis.neighbourhoodCharacter} neighbourhood
                      </span>
                    )}
                  </div>
                  {/* Green flags + concerns */}
                  <div className="mb-3 grid grid-cols-2 gap-3">
                    {svAnalysis.greenFlags.length > 0 && (
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-green-500">Positives</p>
                        <ul className="space-y-0.5">
                          {svAnalysis.greenFlags.map((f, i) => (
                            <li key={i} className="flex items-start gap-1 text-[10px] text-slate-300">
                              <span className="mt-0.5 text-green-500">✓</span> {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {svAnalysis.concerns.length > 0 && (
                      <div>
                        <p className="mb-1 text-[9px] font-bold uppercase tracking-widest text-amber-500">Concerns</p>
                        <ul className="space-y-0.5">
                          {svAnalysis.concerns.map((c, i) => (
                            <li key={i} className="flex items-start gap-1 text-[10px] text-slate-300">
                              <span className="mt-0.5 text-amber-400">!</span> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {/* Narrative */}
                  <p className="border-t border-white/10 pt-2.5 text-[10px] leading-relaxed text-slate-400">
                    {svAnalysis.narrative}
                  </p>
                  {/* Re-analyse button */}
                  <button
                    onClick={handleStreetViewAnalyse}
                    className="mt-2 text-[10px] text-indigo-400 hover:text-indigo-300 underline"
                  >
                    Re-analyse
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </ModalShell>
  )
}
