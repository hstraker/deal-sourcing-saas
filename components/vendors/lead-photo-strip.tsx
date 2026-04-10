"use client"

/**
 * Reusable photo strip components for use in modal left/right panels.
 *
 * LeadPhotoStrip       — light-bg horizontal scrollable strip (right panels)
 * LeftPanelPhotoThumbs — dark-bg 3-thumbnail strip (dark left panels)
 * PhotoConditionChip   — standalone condition badge with score
 */

import { useState, useEffect } from "react"
import { Camera, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react"
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
// Lightbox
// ─────────────────────────────────────────────────────────────────────────────

function Lightbox({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[]
  startIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(startIndex)
  const photo = photos[idx]

  const prev = () => setIdx((i) => (i > 0 ? i - 1 : photos.length - 1))
  const next = () => setIdx((i) => (i < photos.length - 1 ? i + 1 : 0))

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev()
      if (e.key === "ArrowRight") next()
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [idx])

  if (!photo?.url) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Image */}
        <img
          src={photo.url}
          alt={photo.aiRoomType ?? "Property photo"}
          className="max-h-[75vh] max-w-[85vw] rounded-xl object-contain"
        />

        {/* Caption bar */}
        <div className="mt-3 flex items-center gap-3">
          {photo.aiRoomType && (
            <span className="text-xs text-white/70 capitalize">
              {photo.aiRoomType.replace(/_/g, " ")}
            </span>
          )}
          {photo.aiConditionScore != null && (
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                CONDITION_COLOURS[photo.aiCondition ?? ""] ?? "bg-slate-700 text-white"
              )}
            >
              {photo.aiCondition
                ? CONDITION_LABELS[photo.aiCondition] ?? photo.aiCondition
                : "—"}{" "}
              · {photo.aiConditionScore}/100
            </span>
          )}
          <span className="text-xs text-white/50">
            {idx + 1} / {photos.length}
          </span>
        </div>

        {/* Prev / Next */}
        {photos.length > 1 && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); prev() }}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); next() }}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
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
