"use client"

/**
 * FloodMap — Leaflet map with EA flood zone WMS overlay.
 * Must be dynamically imported with { ssr: false } because Leaflet
 * requires the browser's window/document objects.
 *
 * EA WMS services used:
 *   Zone 3 (high risk): environment.data.gov.uk/.../flood-zone-3/wms
 *   Zone 2 (med risk):  environment.data.gov.uk/.../flood-zone-2/wms
 * Both are public with no API key required.
 */

import { useEffect } from "react"
import { MapContainer, TileLayer, WMSTileLayer, Marker, Popup } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// Fix Leaflet's default icon path resolution issue with webpack/Next.js
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  })
}

// Custom red property pin
const PROPERTY_ICON = L.divIcon({
  className: "",
  html: `<div style="
    width:28px; height:28px; border-radius:50% 50% 50% 0;
    background:#ef4444; border:3px solid white;
    transform:rotate(-45deg);
    box-shadow:0 2px 6px rgba(0,0,0,0.4);
  "></div>`,
  iconSize:   [28, 28],
  iconAnchor: [14, 28],
  popupAnchor:[0, -32],
})

// EA WMS endpoints (public, no key required)
const EA_WMS_ZONE3 =
  "https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-3/wms"
const EA_WMS_ZONE2 =
  "https://environment.data.gov.uk/spatialdata/flood-map-for-planning-rivers-and-sea-flood-zone-2/wms"

interface FloodMapProps {
  lat: number
  lng: number
  address: string
  zone: "zone1" | "zone2" | "zone3" | "unknown"
}

export function FloodMap({ lat, lng, address, zone }: FloodMapProps) {
  useEffect(() => {
    fixLeafletIcons()
  }, [])

  // Zoom in tighter for high-risk zones so the overlay polygons are clearly visible
  const zoom = zone === "zone3" ? 14 : zone === "zone2" ? 13 : 14

  return (
    <div className="relative overflow-hidden rounded-xl border border-gray-200 shadow-sm">
      {/* Legend */}
      <div className="absolute bottom-2 left-2 z-[400] flex flex-col gap-1 rounded-lg bg-white/90 px-2.5 py-2 text-[10px] text-gray-700 shadow backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-blue-400 opacity-60" />
          Zone 2 — Medium
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-red-400 opacity-60" />
          Zone 3 — High
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="h-3 w-3 rounded-full"
            style={{ background: "#ef4444", border: "2px solid white" }}
          />
          Property
        </div>
      </div>

      <MapContainer
        center={[lat, lng]}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: "300px", width: "100%" }}
        zoomControl={true}
      >
        {/* Base — OpenStreetMap */}
        <TileLayer
          attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* EA Flood Zone 2 overlay (blue, lower opacity) */}
        <WMSTileLayer
          url={EA_WMS_ZONE2}
          layers="Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_2"
          format="image/png"
          transparent={true}
          opacity={0.45}
          version="1.3.0"
          attribution="© Environment Agency"
        />

        {/* EA Flood Zone 3 overlay (red, rendered on top) */}
        <WMSTileLayer
          url={EA_WMS_ZONE3}
          layers="Flood_Map_for_Planning_Rivers_and_Sea_Flood_Zone_3"
          format="image/png"
          transparent={true}
          opacity={0.55}
          version="1.3.0"
          attribution="© Environment Agency"
        />

        {/* Property marker */}
        <Marker position={[lat, lng]} icon={PROPERTY_ICON}>
          <Popup>
            <span className="text-xs font-medium">{address}</span>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  )
}
