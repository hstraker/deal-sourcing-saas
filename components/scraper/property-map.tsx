"use client"

/**
 * PropertyMap — Leaflet map for the scraper split-pane view.
 *
 * Must be consumed via dynamic import with { ssr: false }:
 *   const PropertyMap = dynamic(() => import("./property-map").then(m => m.PropertyMap), { ssr: false })
 *
 * Features:
 *  - Circle markers coloured by BMV score (green → amber → blue)
 *  - Hover/click popup with photo, price, price/m², address, badges
 *  - Programmatic pan + popup open when selectedId changes
 *  - Auto-fits bounds to all plotted markers on load
 *  - "X properties have no coordinates" notice
 */

import { useEffect, useRef, useState } from "react"
import "leaflet/dist/leaflet.css"
import type { PropertyListingForClient } from "@/types/property-listing"

// ── Score → fill colour ───────────────────────────────────────────────────────
function markerColor(score: number): string {
  if (score >= 70) return "#22c55e"   // green  — strong BMV signal
  if (score >= 45) return "#f59e0b"   // amber  — moderate
  if (score >= 20) return "#f97316"   // orange — mild
  return "#3b82f6"                    // blue   — standard listing
}

function markerLabel(score: number): string {
  if (score >= 70) return "High BMV"
  if (score >= 45) return "Moderate"
  if (score >= 20) return "Mild BMV"
  return "Standard"
}

// ── Relative time helper ──────────────────────────────────────────────────────
function daysAgo(iso: string | null): string {
  if (!iso) return ""
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return "Added today"
  if (days === 1) return "1 day ago"
  return `${days} days ago`
}

// ── Popup HTML builder ────────────────────────────────────────────────────────
function buildPopupHtml(listing: PropertyListingForClient): string {
  const addr    = listing.address as any
  const image   = (listing.images as string[])?.[0] ?? ""
  const price   = `£${listing.price.toLocaleString()}`
  const sqm     = listing.squareMeters ?? (listing.squareFeet ? Math.round(listing.squareFeet * 0.0929) : null)
  const ppm2    = sqm && sqm > 0 ? `£${Math.round(listing.price / sqm).toLocaleString()}/m²` : ""
  const beds    = listing.bedrooms > 0 ? `${listing.bedrooms} bed` : ""
  const added   = daysAgo(listing.listedDate)
  const bmv     = listing.bmvIndicators as any
  const score   = bmv?.bmvScore ?? 0
  const color   = markerColor(score)
  const dom     = listing.daysOnMarket > 0 ? `${listing.daysOnMarket}d on market` : ""
  const noChain = listing.isChainFree ? "No Chain" : ""

  const badges = [beds, noChain, added, dom].filter(Boolean)

  return `
    <div style="width:220px;font-family:system-ui,-apple-system,sans-serif;overflow:hidden;border-radius:8px">
      ${image ? `<img src="${image}" alt="" style="width:100%;height:110px;object-fit:cover;display:block" />` : `<div style="width:100%;height:50px;background:#f1f5f9"></div>`}
      <div style="padding:10px 10px 8px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;margin-bottom:2px">
          <span style="font-size:17px;font-weight:700;color:#0f172a">${price}</span>
          ${ppm2 ? `<span style="font-size:11px;font-weight:600;color:#6366f1">${ppm2}</span>` : ""}
        </div>
        ${sqm ? `<div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${sqm} m²</div>` : ""}
        <div style="font-size:11px;color:#64748b;line-height:1.35;margin-bottom:8px">${addr?.displayAddress ?? ""}${addr?.postcode ? " · " + addr.postcode : ""}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px">
          <span style="background:${color}18;color:${color};font-size:10px;font-weight:700;padding:2px 7px;border-radius:9999px;border:1px solid ${color}40">BMV ${score} · ${markerLabel(score)}</span>
          ${badges.map(b => `<span style="background:#f8fafc;color:#64748b;font-size:10px;padding:2px 7px;border-radius:9999px;border:1px solid #e2e8f0">${b}</span>`).join("")}
        </div>
      </div>
    </div>`
}

// ── Component ─────────────────────────────────────────────────────────────────

interface PropertyMapProps {
  listings:   PropertyListingForClient[]
  selectedId: string | null
  onSelect:   (id: string) => void
  className?: string
}

export function PropertyMap({ listings, selectedId, onSelect, className = "" }: PropertyMapProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<any>(null)
  const markersRef    = useRef<Record<string, any>>({})
  const [noCoords,    setNoCoords] = useState(0)
  const [plotted,     setPlotted]  = useState(0)

  // ── Initialise map once ───────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false

    // Clear stale _leaflet_id left by a previous mount/unmount cycle
    const container = containerRef.current as any
    if (container._leaflet_id) {
      delete container._leaflet_id
    }

    import("leaflet").then((L) => {
      // Cleanup may have run while the async import was in-flight
      if (cancelled || !containerRef.current) return

      // Clear again in case another mount wrote _leaflet_id during the import
      const c = containerRef.current as any
      if (c._leaflet_id) delete c._leaflet_id
      // Fix webpack icon resolution
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      const withCoords = listings.filter(l => {
        const a = l.address as any
        return a?.latitude && a?.longitude
      })
      const missing = listings.length - withCoords.length

      const defaultCenter: [number, number] =
        withCoords.length > 0
          ? [(withCoords[0].address as any).latitude, (withCoords[0].address as any).longitude]
          : [52.5, -1.5] // UK centre

      const map = (L as any).map(containerRef.current, {
        center:      defaultCenter,
        zoom:        13,
        zoomControl: true,
      })
      mapRef.current = map

      // OSM tiles
      ;(L as any).tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map)

      // Plot markers
      const latLngs: [number, number][] = []
      const newMarkers: Record<string, any> = {}

      for (const listing of withCoords) {
        const addr  = listing.address as any
        const lat   = addr.latitude  as number
        const lng   = addr.longitude as number
        const score = (listing.bmvIndicators as any)?.bmvScore ?? 0
        const color = markerColor(score)
        const isSelected = listing.id === selectedId

        const marker = (L as any).circleMarker([lat, lng], {
          radius:      isSelected ? 11 : 8,
          fillColor:   color,
          color:       isSelected ? "#1e293b" : "#ffffff",
          weight:      isSelected ? 3 : 2,
          opacity:     1,
          fillOpacity: 0.9,
        })

        marker.bindPopup(buildPopupHtml(listing), {
          maxWidth:  240,
          className: "property-map-popup",
        })

        marker.on("click", () => { onSelect(listing.id) })
        marker.addTo(map)

        newMarkers[listing.id] = marker
        latLngs.push([lat, lng])
      }

      markersRef.current = newMarkers
      setNoCoords(missing)
      setPlotted(withCoords.length)

      // Fit all markers into view
      if (latLngs.length > 1) {
        map.fitBounds(latLngs, { padding: [40, 40], maxZoom: 15 })
      }
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        try { mapRef.current.remove() } catch { /* ignore */ }
        mapRef.current    = null
        markersRef.current = {}
      }
      // Clear stale ID so the next mount sees a clean container
      if (containerRef.current) {
        delete (containerRef.current as any)._leaflet_id
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // only on mount

  // ── Pan + highlight when selected listing changes ─────────────────────────
  useEffect(() => {
    if (!mapRef.current) return

    // Reset all markers to normal size/border
    import("leaflet").then((L) => {
      Object.entries(markersRef.current).forEach(([id, marker]) => {
        const score = (listings.find(l => l.id === id)?.bmvIndicators as any)?.bmvScore ?? 0
        const isSelected = id === selectedId
        marker.setStyle({
          radius:      isSelected ? 12 : 8,
          color:       isSelected ? "#1e293b" : "#ffffff",
          weight:      isSelected ? 3 : 2,
          fillOpacity: isSelected ? 1 : 0.85,
        })
      })

      if (selectedId) {
        const marker = markersRef.current[selectedId]
        if (marker) {
          mapRef.current.panTo(marker.getLatLng(), { animate: true, duration: 0.5 })
          marker.openPopup()
        }
      }
    })
  }, [selectedId, listings])

  return (
    <div className={`relative ${className}`}>
      {/* Map container */}
      <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden shadow-sm" />

      {/* Legend */}
      <div className="absolute top-3 right-3 z-[1000] bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md text-[11px] space-y-1.5">
        {[
          { color: "#22c55e", label: "High BMV (70+)" },
          { color: "#f59e0b", label: "Moderate (45–69)" },
          { color: "#f97316", label: "Mild (20–44)" },
          { color: "#3b82f6", label: "Standard (<20)" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-gray-600">{label}</span>
          </div>
        ))}
      </div>

      {/* Stats badge */}
      <div className="absolute bottom-3 left-3 z-[1000] flex gap-2">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-gray-600 shadow-sm">
          <span className="font-semibold text-gray-900">{plotted}</span> plotted
          {noCoords > 0 && (
            <span className="ml-1 text-gray-400">· {noCoords} no coords</span>
          )}
        </div>
      </div>

      {/* Inline popup styles */}
      <style>{`
        .property-map-popup .leaflet-popup-content-wrapper {
          padding: 0;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          border: 1px solid #e2e8f0;
        }
        .property-map-popup .leaflet-popup-content {
          margin: 0;
          width: 220px !important;
        }
        .property-map-popup .leaflet-popup-tip {
          background: white;
        }
      `}</style>
    </div>
  )
}
