"use client"

/**
 * Reusable photo strip components for use in modal left/right panels.
 *
 * LeadPhotoStrip       — light-bg horizontal scrollable strip (right panels)
 * LeftPanelPhotoThumbs — dark-bg 3-thumbnail strip (dark left panels)
 * PhotoConditionChip   — standalone condition badge with score
 */

import { useState, useEffect, useRef, useCallback } from "react"
import {
  Camera, ChevronLeft, ChevronRight, X,
  ZoomIn, ZoomOut, ScanSearch, Sun, SlidersHorizontal,
  RotateCcw, Download, Keyboard,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Photo {
  id: string
  url?: string | null
  s3Key?: string | null
  aiRoomType?: string | null
  aiCondition?: string | null
  aiConditionScore?: number | null
  aiAnalysedAt?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ─────────────────────────────────────────────────────────────────────────────

export const CONDITION_COLOURS: Record<string, string> = {
  excellent:            "bg-green-500 text-white",
  good:                 "bg-emerald-400 text-white",
  needs_work:           "bg-amber-400 text-amber-900",
  needs_modernisation:  "bg-orange-400 text-white",
  poor:                 "bg-red-500 text-white",
}

export const CONDITION_LABELS: Record<string, string> = {
  excellent:            "Excellent",
  good:                 "Good",
  needs_work:           "Needs Work",
  needs_modernisation:  "Needs Mod.",
  poor:                 "Poor",
}

/** Rough refurb cost estimate from condition score */
export function estimateRefurbFromScore(score: number | null | undefined): string | null {
  if (score == null) return null
  if (score >= 80) return "Light cosmetic (£0–£5k)"
  if (score >= 60) return "Moderate (£5k–£15k)"
  if (score >= 40) return "Significant (£15k–£35k)"
  if (score >= 20) return "Heavy (£35k–£70k)"
  return "Full gut-out (£70k+)"
}

// ─────────────────────────────────────────────────────────────────────────────
// Pro Viewer — shared toolbar button
// ─────────────────────────────────────────────────────────────────────────────

function LbBtn({
  title,
  onClick,
  children,
  disabled,
  active,
}: {
  title: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
  active?: boolean
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      disabled={disabled}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-md text-white/70 transition-colors",
        "hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed",
        active && "bg-white/15 text-white ring-1 ring-white/20",
      )}
    >
      {children}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pro Viewer Lightbox
// Options implemented:
//   A  Scroll-zoom + drag-pan  (1×–5×, scroll wheel / +−keys / drag)
//   B  Floating magnifier loupe (toggle M, crosshair, edge-aware)
//   C  Brightness + Contrast sliders, filmstrip, download, shortcuts panel
// ─────────────────────────────────────────────────────────────────────────────

const LOUPE_SIZE   = 190          // px — diameter of the circular loupe
const LOUPE_RADIUS = LOUPE_SIZE / 2
const LOUPE_MAG    = 3.5          // magnification factor inside loupe

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[]
  startIndex: number
  onClose: () => void
}) {
  // ── Navigation ─────────────────────────────────────────────────────────────
  const [idx, setIdx] = useState(startIndex)

  // ── Zoom + Pan (Option A) ───────────────────────────────────────────────────
  const [zoom, setZoom]         = useState(1)
  const [pan, setPan]           = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragAnchor, setDragAnchor] = useState({ mx: 0, my: 0, px: 0, py: 0 })

  // ── Loupe (Option B) ────────────────────────────────────────────────────────
  const [loupeOn, setLoupeOn]       = useState(false)
  const [loupeMouse, setLoupeMouse] = useState({ x: 0, y: 0 })
  const [imgRect, setImgRect]       = useState<DOMRect | null>(null)

  // ── Image adjustments (Option C) ───────────────────────────────────────────
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast]     = useState(100)

  // ── UI extras ──────────────────────────────────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false)

  const imgRef       = useRef<HTMLImageElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const photo = photos[idx]

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resetView = useCallback(() => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
    setBrightness(100)
    setContrast(100)
  }, [])

  const goTo = useCallback((i: number) => {
    setIdx(i)
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }, [])

  const prev = useCallback(
    () => goTo(idx > 0 ? idx - 1 : photos.length - 1),
    [idx, photos.length, goTo],
  )
  const next = useCallback(
    () => goTo(idx < photos.length - 1 ? idx + 1 : 0),
    [idx, photos.length, goTo],
  )

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft")              prev()
      if (e.key === "ArrowRight")             next()
      if (e.key === "Escape")                 onClose()
      if (e.key === "+" || e.key === "=")     setZoom((z) => Math.min(5, z + 0.5))
      if (e.key === "-")                      setZoom((z) => Math.max(1, z - 0.5))
      if (e.key === "0")                      resetView()
      if (e.key === "m" || e.key === "M")     setLoupeOn((l) => !l)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [prev, next, onClose, resetView])

  // ── Scroll-to-zoom (non-passive so we can preventDefault) ───────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      setZoom((z) => Math.min(5, Math.max(1, z - e.deltaY * 0.003)))
    }
    el.addEventListener("wheel", handler, { passive: false })
    return () => el.removeEventListener("wheel", handler)
  }, [])

  // When zoom snaps back to 1 reset pan
  useEffect(() => { if (zoom <= 1) setPan({ x: 0, y: 0 }) }, [zoom])

  // ── Drag-to-pan ─────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return
    e.preventDefault()
    setDragging(true)
    setDragAnchor({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      // translate is applied before scale, so 1 CSS px moves (1/zoom) screen px
      setPan({
        x: dragAnchor.px + (e.clientX - dragAnchor.mx) / zoom,
        y: dragAnchor.py + (e.clientY - dragAnchor.my) / zoom,
      })
    }
    // Update loupe tracking
    if (loupeOn && imgRef.current) {
      setImgRect(imgRef.current.getBoundingClientRect())
      setLoupeMouse({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseUp = () => setDragging(false)

  if (!photo?.url) return null

  // ── Loupe geometry ──────────────────────────────────────────────────────────
  // imgRect comes from getBoundingClientRect() which already accounts for CSS
  // scale+translate, so the math works at any zoom level.
  const cxRel    = imgRect ? loupeMouse.x - imgRect.left : 0
  const cyRel    = imgRect ? loupeMouse.y - imgRect.top  : 0
  const inBounds = !!imgRect
    && cxRel >= 0 && cxRel <= imgRect.width
    && cyRel >= 0 && cyRel <= imgRect.height

  const loupeImgW = (imgRect?.width  ?? 0) * LOUPE_MAG
  const loupeImgH = (imgRect?.height ?? 0) * LOUPE_MAG
  // Position the loupe image so the cursor point is centred in the loupe circle
  const loupeImgL = -(cxRel * LOUPE_MAG - LOUPE_RADIUS)
  const loupeImgT = -(cyRel * LOUPE_MAG - LOUPE_RADIUS)

  // Keep the loupe circle on-screen (flip left/up near edges)
  const vw = typeof window !== "undefined" ? window.innerWidth  : 1920
  const vh = typeof window !== "undefined" ? window.innerHeight : 1080
  const loupePosLeft = loupeMouse.x + 24 + LOUPE_SIZE > vw
    ? loupeMouse.x - LOUPE_SIZE - 24
    : loupeMouse.x + 24
  const loupePosTop = Math.max(10, Math.min(vh - LOUPE_SIZE - 10, loupeMouse.y - LOUPE_RADIUS))

  // ── Image style ─────────────────────────────────────────────────────────────
  const imageStyle: React.CSSProperties = {
    maxHeight: "70vh",
    maxWidth:  "80vw",
    display:   "block",
    borderRadius: "0.75rem",
    objectFit: "contain",
    userSelect: "none",
    filter:    `brightness(${brightness}%) contrast(${contrast}%)`,
    transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
    transformOrigin: "center center",
    transition: dragging ? "none" : "transform 0.08s ease",
    cursor: zoom > 1
      ? (dragging ? "grabbing" : "grab")
      : loupeOn
        ? "crosshair"
        : "default",
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-black/95 select-none"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >

      {/* ── Top toolbar ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-black/70 border-b border-white/10 shrink-0">

        {/* Left — room type + condition badge */}
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {photo.aiRoomType && (
            <span className="text-xs text-white/60 capitalize truncate">
              {photo.aiRoomType.replace(/_/g, " ")}
            </span>
          )}
          {photo.aiConditionScore != null && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                CONDITION_COLOURS[photo.aiCondition ?? ""] ?? "bg-slate-700 text-white",
              )}
            >
              {photo.aiCondition
                ? (CONDITION_LABELS[photo.aiCondition] ?? photo.aiCondition)
                : "—"}{" "}
              · {photo.aiConditionScore}/100
            </span>
          )}
        </div>

        {/* Centre — enhancement toolbar */}
        <div className="flex items-center gap-1 shrink-0">

          {/* Zoom out */}
          <LbBtn title="Zoom out (−)" onClick={() => setZoom((z) => Math.max(1, z - 0.5))} disabled={zoom <= 1}>
            <ZoomOut className="h-4 w-4" />
          </LbBtn>

          {/* Zoom level */}
          <span className="w-10 text-center text-[11px] font-mono text-white/50 tabular-nums">
            {Math.round(zoom * 100)}%
          </span>

          {/* Zoom in */}
          <LbBtn title="Zoom in (+)" onClick={() => setZoom((z) => Math.min(5, z + 0.5))} disabled={zoom >= 5}>
            <ZoomIn className="h-4 w-4" />
          </LbBtn>

          <div className="w-px h-5 bg-white/15 mx-1" />

          {/* Magnifier loupe toggle */}
          <LbBtn title="Magnifier loupe (M)" onClick={() => setLoupeOn((l) => !l)} active={loupeOn}>
            <ScanSearch className="h-4 w-4" />
          </LbBtn>

          <div className="w-px h-5 bg-white/15 mx-1" />

          {/* Brightness slider */}
          <div className="flex items-center gap-1.5" title={`Brightness: ${brightness}%`}>
            <Sun className="h-3.5 w-3.5 text-white/40 shrink-0" />
            <input
              type="range"
              min={50} max={200}
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-20 h-1 cursor-pointer accent-yellow-400"
            />
            <span className="text-[10px] font-mono text-white/35 w-8 tabular-nums">{brightness}%</span>
          </div>

          {/* Contrast slider */}
          <div className="flex items-center gap-1.5" title={`Contrast: ${contrast}%`}>
            <SlidersHorizontal className="h-3.5 w-3.5 text-white/40 shrink-0" />
            <input
              type="range"
              min={50} max={200}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-20 h-1 cursor-pointer accent-blue-400"
            />
            <span className="text-[10px] font-mono text-white/35 w-8 tabular-nums">{contrast}%</span>
          </div>

          <div className="w-px h-5 bg-white/15 mx-1" />

          {/* Reset all */}
          <LbBtn title="Reset view & adjustments (0)" onClick={resetView}>
            <RotateCcw className="h-4 w-4" />
          </LbBtn>

          {/* Download */}
          <a
            href={photo.url}
            download
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            <LbBtn title="Download original" onClick={() => {}}>
              <Download className="h-4 w-4" />
            </LbBtn>
          </a>
        </div>

        {/* Right — counter + shortcuts + close */}
        <div className="flex items-center gap-1.5 flex-1 justify-end shrink-0">
          <span className="text-[11px] text-white/40 tabular-nums font-mono">
            {idx + 1} / {photos.length}
          </span>
          <LbBtn title="Keyboard shortcuts" onClick={() => setShowShortcuts((s) => !s)} active={showShortcuts}>
            <Keyboard className="h-4 w-4" />
          </LbBtn>
          <LbBtn title="Close (Esc)" onClick={onClose}>
            <X className="h-4 w-4" />
          </LbBtn>
        </div>
      </div>

      {/* ── Main image area ──────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex flex-1 items-center justify-center overflow-hidden"
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imgRef}
          src={photo.url}
          alt={photo.aiRoomType ?? "Property photo"}
          style={imageStyle}
          draggable={false}
        />
      </div>

      {/* ── Prev / Next arrows ───────────────────────────────────────────────── */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); prev() }}
            className="absolute left-3 top-1/2 -translate-y-1/2 mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); next() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 mt-5 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/25 transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {/* ── Keyboard shortcuts panel ─────────────────────────────────────────── */}
      {showShortcuts && (
        <div className="absolute top-12 right-4 z-10 w-56 rounded-xl border border-white/10 bg-black/85 p-4 text-[11px] text-white/70 shadow-2xl">
          <p className="mb-2.5 text-xs font-semibold text-white/90">Keyboard Shortcuts</p>
          <div className="space-y-1.5">
            {([
              ["← →",  "Previous / Next photo"],
              ["+  −",  "Zoom in / out"],
              ["Scroll", "Zoom (mouse wheel)"],
              ["Drag",   "Pan when zoomed in"],
              ["M",      "Toggle magnifier loupe"],
              ["0",      "Reset view + adjustments"],
              ["Esc",    "Close viewer"],
            ] as [string, string][]).map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between gap-2">
                <kbd className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 font-mono text-white/80">
                  {key}
                </kbd>
                <span className="text-right text-white/60">{desc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Magnifier loupe ──────────────────────────────────────────────────── */}
      {loupeOn && inBounds && imgRect && (
        <div
          className="pointer-events-none fixed z-[300]"
          style={{
            left:   loupePosLeft,
            top:    loupePosTop,
            width:  LOUPE_SIZE,
            height: LOUPE_SIZE,
            borderRadius: "50%",
            overflow: "hidden",
            border: "3px solid rgba(255,255,255,0.88)",
            boxShadow: "0 0 0 1px rgba(0,0,0,0.4), 0 8px 32px rgba(0,0,0,0.7)",
          }}
        >
          {/* The magnified image — sized LOUPE_MAG × the currently rendered rect */}
          <img
            src={photo.url}
            alt="loupe"
            style={{
              position:   "absolute",
              width:      loupeImgW,
              height:     loupeImgH,
              left:       loupeImgL,
              top:        loupeImgT,
              maxWidth:   "none",
              filter:     `brightness(${brightness}%) contrast(${contrast}%)`,
              pointerEvents: "none",
            }}
          />
          {/* Crosshair */}
          <div
            className="pointer-events-none absolute"
            style={{ left: LOUPE_RADIUS - 0.5, top: LOUPE_RADIUS - 14, width: 1, height: 28, background: "rgba(255,255,255,0.55)" }}
          />
          <div
            className="pointer-events-none absolute"
            style={{ top: LOUPE_RADIUS - 0.5, left: LOUPE_RADIUS - 14, height: 1, width: 28, background: "rgba(255,255,255,0.55)" }}
          />
          {/* Magnification label */}
          <div className="absolute bottom-3 left-0 right-0 text-center pointer-events-none">
            <span className="rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-bold text-white/80">
              {LOUPE_MAG}×
            </span>
          </div>
        </div>
      )}

      {/* ── Bottom filmstrip ─────────────────────────────────────────────────── */}
      {photos.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto border-t border-white/10 bg-black/70 px-4 py-2 shrink-0">
          {photos.map((p, i) => (
            <button
              key={p.id}
              onClick={(e) => { e.stopPropagation(); goTo(i) }}
              title={p.aiRoomType ? p.aiRoomType.replace(/_/g, " ") : `Photo ${i + 1}`}
              className={cn(
                "relative shrink-0 overflow-hidden rounded transition-all duration-150",
                i === idx
                  ? "h-14 w-20 border-2 border-blue-400 opacity-100 ring-1 ring-blue-400/50 scale-105"
                  : "h-12 w-[68px] border border-white/20 opacity-50 hover:opacity-80 hover:border-white/40",
              )}
            >
              {p.url && (
                <img src={p.url} alt="" className="h-full w-full object-cover" draggable={false} />
              )}
              {/* Active indicator dot */}
              {i === idx && (
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-blue-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LeadPhotoStrip — light-bg horizontal scrollable strip (right panels)
// ─────────────────────────────────────────────────────────────────────────────

interface LeadPhotoStripProps {
  leadId: string
  className?: string
  /** Height of each thumbnail in px (default 100) */
  thumbHeight?: number
}

export function LeadPhotoStrip({
  leadId,
  className,
  thumbHeight = 100,
}: LeadPhotoStripProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/vendor-leads/${leadId}/photos`)
      .then((r) => r.json())
      .then((data) => { if (data.photos) setPhotos(data.photos) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leadId])

  if (loading) {
    return (
      <div className={cn("flex items-center gap-1.5 text-xs text-gray-400 py-1", className)}>
        <Camera className="h-3.5 w-3.5 animate-pulse shrink-0" />
        Loading photos…
      </div>
    )
  }

  if (photos.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2.5", className)}>
        <Camera className="h-4 w-4 shrink-0 text-gray-300" />
        <div>
          <p className="text-xs font-medium text-gray-400">No photos uploaded yet</p>
          <p className="text-[10px] text-gray-300">Open the Photos tab to upload property photos</p>
        </div>
      </div>
    )
  }

  const thumbWidth = Math.round(thumbHeight * (4 / 3))

  return (
    <>
      <div className={cn("space-y-1.5", className)}>
        {/* header row */}
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Property Photos
          </p>
          <span className="text-[10px] text-gray-400">
            {photos.length} photo{photos.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* scroll strip */}
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {photos.map((photo, idx) => {
            if (!photo.url) return null
            return (
              <button
                key={photo.id}
                onClick={() => setLightbox(idx)}
                className="group relative shrink-0 overflow-hidden rounded-lg border border-gray-200 hover:border-blue-400 transition-colors focus:outline-none"
                style={{ width: thumbWidth, height: thumbHeight }}
              >
                <img
                  src={photo.url}
                  alt={photo.aiRoomType ?? "Property photo"}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* condition score badge */}
                {photo.aiConditionScore != null && (
                  <span
                    className={cn(
                      "absolute top-1 right-1 rounded px-1 py-px text-[9px] font-bold leading-tight",
                      CONDITION_COLOURS[photo.aiCondition ?? ""] ?? "bg-slate-700 text-white"
                    )}
                  >
                    {photo.aiConditionScore}
                  </span>
                )}

                {/* room type label */}
                {photo.aiRoomType && (
                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-px text-[9px] capitalize text-white/90 truncate text-center">
                    {photo.aiRoomType.replace(/_/g, " ")}
                  </span>
                )}

                {/* zoom overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <ZoomIn className="h-5 w-5 text-white drop-shadow" />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {lightbox !== null && (
        <Lightbox
          photos={photos.filter((p) => !!p.url)}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LeftPanelPhotoThumbs — dark-bg 3-thumbnail strip (left panels)
// ─────────────────────────────────────────────────────────────────────────────

interface LeftPanelPhotoThumbsProps {
  leadId: string
  /** Show at most this many thumbnails (default 3) */
  maxPhotos?: number
  /** Lead-level summary data already available without an extra fetch */
  conditionScore?: number | null
  conditionOverride?: string | null
  analysisStatus?: string | null
}

export function LeftPanelPhotoThumbs({
  leadId,
  maxPhotos = 3,
  conditionScore,
  conditionOverride,
  analysisStatus,
}: LeftPanelPhotoThumbsProps) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [lightbox, setLightbox] = useState<number | null>(null)

  useEffect(() => {
    fetch(`/api/vendor-leads/${leadId}/photos`)
      .then((r) => r.json())
      .then((data) => { if (data.photos) setPhotos(data.photos) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [leadId])

  // Effective condition key (override wins)
  const effectiveCondition = conditionOverride ?? null
  const displayScore = conditionScore ?? null
  const refurbEst = estimateRefurbFromScore(displayScore)

  if (loading) {
    return (
      <div className="space-y-1.5">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
          <Camera className="h-3 w-3" />
          Photos
        </p>
        <p className="text-[10px] text-slate-600 animate-pulse">Loading…</p>
      </div>
    )
  }

  const withUrl = photos.filter((p) => !!p.url)
  const shown = withUrl.slice(0, maxPhotos)
  const remaining = withUrl.length - shown.length

  return (
    <>
      <div className="space-y-2">
        {/* header */}
        <div className="flex items-center justify-between">
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Photos
          </p>
          {photos.length > 0 && (
            <span className="text-[9px] text-slate-600">
              {photos.length} total
            </span>
          )}
        </div>

        {/* Condition + score row */}
        {(displayScore != null || effectiveCondition) && (
          <div className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 space-y-1">
            <div className="flex items-center justify-between gap-2">
              {(effectiveCondition || analysisStatus === "complete") && (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold capitalize",
                    effectiveCondition
                      ? CONDITION_COLOURS[effectiveCondition] ?? "bg-slate-600 text-white"
                      : "bg-slate-600 text-white"
                  )}
                >
                  {effectiveCondition
                    ? CONDITION_LABELS[effectiveCondition] ?? effectiveCondition.replace(/_/g, " ")
                    : "Analysed"}
                </span>
              )}
              {displayScore != null && (
                <span className="text-xs font-extrabold text-slate-200">
                  {displayScore}/100
                </span>
              )}
            </div>
            {refurbEst && (
              <p className="text-[9px] text-slate-400 leading-snug">
                Est. refurb: {refurbEst}
              </p>
            )}
            {conditionOverride && (
              <p className="text-[9px] text-amber-400">★ Condition overridden</p>
            )}
          </div>
        )}

        {/* Thumbnails */}
        {shown.length > 0 && (
          <div className="flex gap-1.5">
            {shown.map((photo, idx) => (
              <button
                key={photo.id}
                onClick={() => setLightbox(idx)}
                className="group relative overflow-hidden rounded-md border border-white/10 hover:border-white/30 transition-colors focus:outline-none"
                style={{ width: 60, height: 45 }}
              >
                <img
                  src={photo.url!}
                  alt={photo.aiRoomType ?? "photo"}
                  className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                {photo.aiConditionScore != null && (
                  <span
                    className={cn(
                      "absolute top-0.5 right-0.5 rounded px-1 py-px text-[8px] font-bold leading-none",
                      CONDITION_COLOURS[photo.aiCondition ?? ""] ?? "bg-slate-700 text-white"
                    )}
                  >
                    {photo.aiConditionScore}
                  </span>
                )}
              </button>
            ))}

            {/* +N overflow chip */}
            {remaining > 0 && (
              <div
                className="flex items-center justify-center rounded-md border border-white/10 bg-white/5 text-[10px] font-semibold text-slate-400"
                style={{ width: 60, height: 45 }}
              >
                +{remaining}
              </div>
            )}
          </div>
        )}

        {photos.length === 0 && (
          <div className="rounded-md border border-dashed border-white/10 bg-white/5 px-2.5 py-2">
            <p className="text-[10px] text-slate-500">No photos uploaded yet</p>
            <p className="text-[9px] text-slate-600 mt-0.5">Open the Photos tab to add</p>
          </div>
        )}
      </div>

      {lightbox !== null && (
        <Lightbox
          photos={withUrl}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// PhotoConditionCard — right-panel card for Validation / Offer Analysis
// ─────────────────────────────────────────────────────────────────────────────

interface PhotoConditionCardProps {
  conditionScore: number | null | undefined
  conditionOverride: string | null | undefined
  analysisStatus: string | null | undefined
  photoCount: number
  /** Top issues from analysed photos — pass [] if not available */
  topIssues?: string[]
  className?: string
}

export function PhotoConditionCard({
  conditionScore,
  conditionOverride,
  analysisStatus,
  photoCount,
  topIssues = [],
  className,
}: PhotoConditionCardProps) {
  const effectiveCondition = conditionOverride ?? null
  const score = conditionScore ?? null
  const refurbEst = estimateRefurbFromScore(score)

  if (analysisStatus !== "complete" && !effectiveCondition) {
    // No analysis yet — show a helpful prompt
    return (
      <div className={cn("rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3", className)}>
        <div className="flex items-center gap-2 mb-1">
          <Camera className="h-4 w-4 text-gray-300 shrink-0" />
          <p className="text-xs font-semibold text-gray-400">No photo analysis yet</p>
        </div>
        {photoCount > 0 ? (
          <p className="text-[11px] text-gray-400">
            {photoCount} photo{photoCount !== 1 ? "s" : ""} uploaded — open the Photos tab and click <strong>Analyse</strong> to get a condition score.
          </p>
        ) : (
          <p className="text-[11px] text-gray-400">
            Upload photos via the <strong>Photos tab</strong> then run AI analysis to see condition scores here.
          </p>
        )}
      </div>
    )
  }

  const conditionKey = effectiveCondition ?? null
  const colourClass = conditionKey
    ? CONDITION_COLOURS[conditionKey] ?? "bg-slate-200 text-slate-700"
    : "bg-slate-200 text-slate-700"

  const isPoor = conditionKey === "poor" || conditionKey === "needs_modernisation"
  const isGood = conditionKey === "excellent" || conditionKey === "good"

  return (
    <div
      className={cn(
        "rounded-lg border p-3 space-y-2.5",
        isPoor ? "border-red-200 bg-red-50"
          : isGood ? "border-green-200 bg-green-50"
          : "border-amber-200 bg-amber-50",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Camera
            className={cn(
              "h-4 w-4 shrink-0",
              isPoor ? "text-red-500" : isGood ? "text-green-600" : "text-amber-600"
            )}
          />
          <p
            className={cn(
              "text-xs font-bold uppercase tracking-wide",
              isPoor ? "text-red-700" : isGood ? "text-green-700" : "text-amber-700"
            )}
          >
            Photo Condition
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {conditionKey && (
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold capitalize", colourClass)}>
              {CONDITION_LABELS[conditionKey] ?? conditionKey.replace(/_/g, " ")}
            </span>
          )}
          {score != null && (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-[11px] font-extrabold",
                isPoor ? "text-red-700" : isGood ? "text-green-700" : "text-amber-700"
              )}
            >
              {score}/100
            </span>
          )}
        </div>
      </div>

      {/* Score bar */}
      {score != null && (
        <div className="h-1.5 w-full rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              score >= 70 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"
            )}
            style={{ width: `${score}%` }}
          />
        </div>
      )}

      {/* Refurb estimate */}
      {refurbEst && (
        <div className="flex items-center justify-between text-xs">
          <span className={isPoor ? "text-red-600" : isGood ? "text-green-600" : "text-amber-600"}>
            Est. refurb cost
          </span>
          <span className="font-semibold text-gray-800">{refurbEst}</span>
        </div>
      )}

      {/* Top issues */}
      {topIssues.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Common Issues</p>
          <div className="flex flex-wrap gap-1">
            {topIssues.slice(0, 6).map((issue, i) => (
              <span
                key={i}
                className="rounded-md border border-gray-200 bg-white px-1.5 py-px text-[10px] text-gray-600 capitalize"
              >
                {issue.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Override note */}
      {conditionOverride && (
        <p className="text-[10px] text-amber-600">★ Condition manually overridden by sourcer</p>
      )}

      {/* Photo count */}
      <p
        className={cn(
          "text-[10px]",
          isPoor ? "text-red-400" : isGood ? "text-green-500" : "text-amber-500"
        )}
      >
        Based on {photoCount} photo{photoCount !== 1 ? "s" : ""}
      </p>
    </div>
  )
}
