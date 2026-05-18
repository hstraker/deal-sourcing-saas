"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  Camera,
  Loader2,
  RefreshCw,
  ExternalLink,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Sparkles,
  ImageIcon,
  Shield,
  ArrowUpDown,
  ZoomIn,
  LayoutDashboard,
  Upload,
  X,
  FileImage,
  Home,
  BedDouble,
  Bath,
  Sofa,
  Layers,
} from "lucide-react"
import { ProPhotoViewer } from "./lead-photo-strip"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

interface PropertyPhoto {
  id: string
  url: string
  source: string
  filename: string | null
  aiRoomType: string | null
  aiCondition: string | null
  aiConditionScore: number | null
  aiIssues: string[]
  aiDescription: string | null
  aiAnalysedAt: string | null
  uploadedAt: string
}

interface LeadPhotoData {
  photoConditionScore: number | null
  photoConditionOverride: string | null
  photoAnalysisStatus: string
  photoAnalysisCompletedAt: string | null
  photoUploadToken: string | null
  photoUploadExpiresAt: string | null
}

interface FloorplanAnalysis {
  totalSqFt: number | null
  totalSqM: number | null
  bedrooms: number | null
  bathrooms: number | null
  receptions: number | null
  layoutType: "open_plan" | "traditional" | "mixed" | null
  hasGarage: boolean
  hasGarden: boolean
  hasExtensionPotential: boolean
  hasLoftPotential: boolean
  storeys: number | null
  notes: string | null
}

const CONDITION_COLOURS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  good: "bg-blue-100 text-blue-800 border-blue-200",
  needs_work: "bg-amber-100 text-amber-800 border-amber-200",
  needs_modernisation: "bg-orange-100 text-orange-800 border-orange-200",
  poor: "bg-red-100 text-red-800 border-red-200",
}

const CONDITION_LABELS: Record<string, string> = {
  excellent: "Excellent",
  good: "Good",
  needs_work: "Needs Work",
  needs_modernisation: "Needs Modernisation",
  poor: "Poor",
}

function conditionFromScore(score: number | null): string {
  if (score === null) return "unknown"
  if (score >= 80) return "excellent"
  if (score >= 65) return "good"
  if (score >= 50) return "needs_work"
  if (score >= 30) return "needs_modernisation"
  return "poor"
}

export function PhotoAnalysisTab({
  leadId,
  onDataLoaded,
}: {
  leadId: string
  onDataLoaded?: (photos: PropertyPhoto[], leadData: LeadPhotoData) => void
}) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([])
  const [leadData, setLeadData] = useState<LeadPhotoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<PropertyPhoto | null>(null)
  const [sortWorstFirst, setSortWorstFirst] = useState(true)
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null)

  // ── Floorplan state ────────────────────────────────────────────────────
  const [floorplans, setFloorplans] = useState<PropertyPhoto[]>([])
  const [floorplanAnalysis, setFloorplanAnalysis] = useState<FloorplanAnalysis | null>(null)
  const [uploadingFloorplan, setUploadingFloorplan] = useState(false)
  const [analysingFloorplan, setAnalysingFloorplan] = useState(false)
  const floorplanInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true)
    try {
      const [photosRes, leadRes] = await Promise.all([
        fetch(`/api/vendor-leads/${leadId}/photos`),
        fetch(`/api/vendor-leads/${leadId}`),
      ])

      const photosData = await photosRes.json().catch(() => ({ photos: [] }))
      if (!photosRes.ok) {
        console.error("[PhotoAnalysisTab] photos fetch failed:", photosRes.status, photosData)
      }

      let leadFull: Record<string, any> = {}
      if (leadRes.ok) {
        leadFull = await leadRes.json()
      } else {
        const text = await leadRes.text()
        console.error("[PhotoAnalysisTab] lead fetch failed:", leadRes.status, text)
      }

      const allPhotos: PropertyPhoto[] = photosData.photos ?? []

      // Preserve existing signed URLs to prevent image flicker on polls —
      // only replace the URL when a photo is newly analysed or newly added.
      setPhotos((prev) => {
        const prevMap = Object.fromEntries(prev.map((p) => [p.id, p]))
        return allPhotos
          .filter((p) => p.source !== "floorplan_upload")
          .map((p) => {
            const existing = prevMap[p.id]
            if (existing && existing.aiAnalysedAt === p.aiAnalysedAt && existing.url) {
              return { ...p, url: existing.url }
            }
            return p
          })
      })

      // Separate floorplan photos and parse the analysis from the first analysed one
      const fp = allPhotos.filter((p) => p.source === "floorplan_upload")
      setFloorplans((prev) => {
        const prevMap = Object.fromEntries(prev.map((p) => [p.id, p]))
        return fp.map((p) => {
          const existing = prevMap[p.id]
          if (existing && existing.aiAnalysedAt === p.aiAnalysedAt && existing.url) {
            return { ...p, url: existing.url }
          }
          return p
        })
      })
      const analysedFloorplan = fp.find((p) => p.aiDescription && p.aiAnalysedAt)
      if (analysedFloorplan?.aiDescription) {
        try {
          setFloorplanAnalysis(JSON.parse(analysedFloorplan.aiDescription) as FloorplanAnalysis)
        } catch {
          setFloorplanAnalysis(null)
        }
      } else {
        setFloorplanAnalysis(null)
      }

      const newLeadData: LeadPhotoData = {
        photoConditionScore: leadFull.photoConditionScore ?? null,
        photoConditionOverride: leadFull.photoConditionOverride ?? null,
        photoAnalysisStatus: leadFull.photoAnalysisStatus ?? "pending",
        photoAnalysisCompletedAt: leadFull.photoAnalysisCompletedAt ?? null,
        photoUploadToken: leadFull.photoUploadToken ?? null,
        photoUploadExpiresAt: leadFull.photoUploadExpiresAt ?? null,
      }
      setLeadData(newLeadData)
      if (onDataLoaded) {
        onDataLoaded(allPhotos.filter((p) => p.source !== "floorplan_upload"), newLeadData)
      }
    } catch (err) {
      console.error("[PhotoAnalysisTab] fetchData error:", err)
      if (showLoader) toast.error("Failed to load photos")
    } finally {
      if (showLoader) setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchData(true) }, [fetchData])

  // Poll while analysis is running — no loader, no image flicker
  const prevStatusRef = useRef<string | null>(null)
  useEffect(() => {
    const status = leadData?.photoAnalysisStatus ?? null
    if (prevStatusRef.current === "running" && status === "complete") {
      toast.success("Analysis complete!")
    }
    prevStatusRef.current = status
  }, [leadData?.photoAnalysisStatus])

  useEffect(() => {
    if (leadData?.photoAnalysisStatus !== "running") return
    const interval = setInterval(() => fetchData(false), 3000)
    return () => clearInterval(interval)
  }, [leadData?.photoAnalysisStatus, fetchData])

  async function generateUploadLink() {
    setGeneratingLink(true)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/photos/upload-session`, { method: "POST" })
      const data = await res.json()
      await fetchData()
      await navigator.clipboard.writeText(data.uploadUrl)
      setLinkCopied(true)
      toast.success("Upload link copied to clipboard!")
      setTimeout(() => setLinkCopied(false), 3000)
    } catch {
      toast.error("Failed to generate upload link")
    } finally {
      setGeneratingLink(false)
    }
  }

  async function copyUploadLink() {
    if (!leadData?.photoUploadToken) return
    const url = `${window.location.origin}/upload/${leadData.photoUploadToken}`
    await navigator.clipboard.writeText(url)
    setLinkCopied(true)
    toast.success("Upload link copied!")
    setTimeout(() => setLinkCopied(false), 3000)
  }

  async function triggerAnalysis() {
    setAnalysing(true)
    try {
      await fetch(`/api/vendor-leads/${leadId}/photos/analyse`, { method: "POST" })
      toast.success("Analysis started — this may take a minute")
      setLeadData((prev) => prev ? { ...prev, photoAnalysisStatus: "running" } : prev)
      setTimeout(() => fetchData(false), 3000)
    } catch {
      toast.error("Failed to start analysis")
    } finally {
      setAnalysing(false)
    }
  }

  async function deletePhoto(photoId: string) {
    await fetch(`/api/vendor-leads/${leadId}/photos/${photoId}`, { method: "DELETE" })
    setPhotos((prev) => prev.filter((p) => p.id !== photoId))
    if (selectedPhoto?.id === photoId) setSelectedPhoto(null)
    toast.success("Photo deleted")
  }

  // ── Floorplan handlers ─────────────────────────────────────────────────

  async function uploadFloorplan(file: File) {
    setUploadingFloorplan(true)
    try {
      // 1. Presign
      const presignRes = await fetch(`/api/vendor-leads/${leadId}/floorplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "presign",
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!presignRes.ok) {
        const err = await presignRes.json().catch(() => ({}))
        throw new Error(err.error ?? "Failed to get upload URL")
      }
      const { uploadUrl, s3Key } = await presignRes.json()

      // 2. Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      })
      if (!uploadRes.ok) throw new Error("S3 upload failed")

      // 3. Confirm
      const confirmRes = await fetch(`/api/vendor-leads/${leadId}/floorplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          s3Key,
          filename: file.name,
          contentType: file.type,
          sizeBytes: file.size,
        }),
      })
      if (!confirmRes.ok) throw new Error("Failed to save floorplan record")

      toast.success("Floorplan uploaded")
      await fetchData(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploadingFloorplan(false)
    }
  }

  async function deleteFloorplan(photoId: string) {
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/floorplan?photoId=${photoId}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      setFloorplans((prev) => prev.filter((p) => p.id !== photoId))
      setFloorplanAnalysis(null)
      toast.success("Floorplan deleted")
    } catch {
      toast.error("Failed to delete floorplan")
    }
  }

  async function analyseFloorplan(photoId: string) {
    setAnalysingFloorplan(true)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/floorplan/analyse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Analysis failed")
      setFloorplanAnalysis(data.analysis as FloorplanAnalysis)
      await fetchData(false)
      toast.success("Floorplan analysed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setAnalysingFloorplan(false)
    }
  }

  function handleFloorplanFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) uploadFloorplan(file)
    e.target.value = ""
  }

  async function updateConditionOverride(value: string) {
    const override = value === "none" ? null : value
    await fetch(`/api/vendor-leads/${leadId}/photos/condition-override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override }),
    })
    const updatedLeadData = leadData ? { ...leadData, photoConditionOverride: override } : null
    setLeadData(updatedLeadData)
    if (updatedLeadData && onDataLoaded) {
      onDataLoaded(photos, updatedLeadData)
    }
    toast.success("Condition override saved")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  const uploadLinkUrl = leadData?.photoUploadToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/upload/${leadData.photoUploadToken}`
    : null
  const linkExpired = leadData?.photoUploadExpiresAt
    ? new Date(leadData.photoUploadExpiresAt) < new Date()
    : false

  const aiConditionLabel = conditionFromScore(leadData?.photoConditionScore ?? null)
  const effectiveCondition = leadData?.photoConditionOverride ?? aiConditionLabel
  const hasUnanalysed = photos.some((p) => !p.aiAnalysedAt)
  const isRunning = leadData?.photoAnalysisStatus === "running"
  const isComplete = leadData?.photoAnalysisStatus === "complete"

  // Sort: worst-first (lowest score first), unanalysed at end
  const sortedPhotos = [...photos].sort((a, b) => {
    if (!sortWorstFirst) return 0
    const aScore = a.aiConditionScore ?? 999
    const bScore = b.aiConditionScore ?? 999
    return aScore - bScore
  })

  const lowestScoringId = photos
    .filter((p) => p.aiConditionScore != null)
    .sort((a, b) => (a.aiConditionScore ?? 0) - (b.aiConditionScore ?? 0))[0]?.id

  return (
    <div className="space-y-3">

      {/* ── Compact Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap rounded-lg border bg-white px-3 py-2">
        {/* Condition badge */}
        <Badge className={cn("text-xs border shrink-0", CONDITION_COLOURS[effectiveCondition] ?? "bg-gray-100 text-gray-600")}>
          {CONDITION_LABELS[effectiveCondition] ?? "Not assessed"}
        </Badge>
        {leadData?.photoConditionOverride && (
          <span className="text-[10px] text-amber-600 font-medium shrink-0">Override active</span>
        )}

        {/* Override dropdown */}
        <Select
          value={leadData?.photoConditionOverride ?? "none"}
          onValueChange={updateConditionOverride}
        >
          <SelectTrigger className="h-7 text-[11px] w-36 border-dashed">
            <SelectValue placeholder="Use AI score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Use AI score</SelectItem>
            <SelectItem value="excellent">Excellent</SelectItem>
            <SelectItem value="good">Good</SelectItem>
            <SelectItem value="needs_work">Needs Work</SelectItem>
            <SelectItem value="needs_modernisation">Needs Modernisation</SelectItem>
            <SelectItem value="poor">Poor</SelectItem>
          </SelectContent>
        </Select>

        {leadData?.photoConditionScore != null && (
          <span className="text-[11px] text-gray-400 shrink-0">
            AI: <strong className="text-gray-600">{leadData.photoConditionScore}/100</strong>
          </span>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Photo count + status */}
        {photos.length > 0 && (() => {
          const unanalysedCount = photos.filter((p) => !p.aiAnalysedAt).length
          const analysedCount = photos.filter((p) => p.aiAnalysedAt).length
          return (
            <span className="text-[11px] text-gray-500 shrink-0">
              {photos.length} photo{photos.length !== 1 ? "s" : ""} ·{" "}
              {isRunning
                ? `analysing ${unanalysedCount} new…`
                : hasUnanalysed
                ? <span className="text-amber-600">{unanalysedCount} new, not yet analysed</span>
                : "all analysed"}
            </span>
          )
        })()}

        {/* Sort toggle */}
        <button
          onClick={() => setSortWorstFirst((v) => !v)}
          title={sortWorstFirst ? "Sorted: worst first" : "Sorted: upload order"}
          className={cn(
            "flex items-center gap-1 rounded px-2 py-1 text-[11px] border transition-colors shrink-0",
            sortWorstFirst ? "bg-red-50 border-red-200 text-red-600" : "bg-gray-50 border-gray-200 text-gray-500"
          )}
        >
          <ArrowUpDown className="h-3 w-3" />
          {sortWorstFirst ? "Worst first" : "Upload order"}
        </button>

        {/* Analyse button */}
        {(() => {
          const unanalysedCount = photos.filter((p) => !p.aiAnalysedAt).length
          return (
            <Button
              size="sm"
              onClick={triggerAnalysis}
              disabled={analysing || isRunning || !hasUnanalysed}
              className="text-xs h-7 shrink-0"
              title={unanalysedCount > 0 ? `Will analyse ${unanalysedCount} new photo${unanalysedCount !== 1 ? "s" : ""} only — already-analysed photos are skipped` : "All photos already analysed"}
            >
              {isRunning
                ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" />Analysing…</>
                : <><Sparkles className="mr-1.5 h-3 w-3" />Analyse {unanalysedCount > 0 ? `${unanalysedCount} new` : "Photos"}</>}
            </Button>
          )
        })()}
      </div>

      {/* Progress bar — only while running */}
      {isRunning && (() => {
        // Track progress only for the batch being analysed (photos without a score when run started)
        const total = photos.length
        const done = photos.filter((p) => p.aiAnalysedAt).length
        return (
          <div className="w-full bg-gray-100 rounded-full h-1 overflow-hidden -mt-2">
            <div
              className="bg-blue-500 h-1 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        )
      })()}

      {/* ── Photo Grid ──────────────────────────────────────────────────── */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
          <ImageIcon className="h-10 w-10" />
          <p className="text-sm font-medium">No photos yet</p>
          <p className="text-xs">Generate an upload link to collect photos from the vendor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {sortedPhotos.map((photo, sortedIdx) => {
            const isWorst = photo.id === lowestScoringId && photos.filter(p => p.aiConditionScore != null).length > 1
            return (
              <div
                key={photo.id}
                className={cn(
                  "relative group rounded-lg overflow-hidden border cursor-pointer transition-all",
                  selectedPhoto?.id === photo.id ? "ring-2 ring-blue-500" :
                  isWorst ? "ring-2 ring-red-400" : ""
                )}
                onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
              >
                <img
                  src={photo.url}
                  alt={photo.aiRoomType ?? "property photo"}
                  className="w-full aspect-square object-cover"
                />
                {/* Bottom label: room type + expand icon */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 flex items-end justify-between">
                  {photo.aiRoomType && (
                    <span className="text-[10px] text-white/90 capitalize">
                      {photo.aiRoomType.replace(/_/g, " ")}
                      {isWorst && <span className="ml-1 text-red-300 font-semibold">· worst</span>}
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); setLightboxIdx(sortedIdx) }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Open Pro Viewer"
                  >
                    <ZoomIn className="h-3.5 w-3.5 text-white/80" />
                  </button>
                </div>
                {/* Score badge top-right */}
                {photo.aiConditionScore != null ? (
                  <div
                    title={`${CONDITION_LABELS[photo.aiCondition ?? ""] ?? "Unknown"} — ${photo.aiConditionScore}/100. Scores: 80–100 Excellent, 65–79 Good, 50–64 Needs Work, 30–49 Needs Modernisation, 0–29 Poor.`}
                    className={cn(
                      "absolute top-1 right-1 text-[10px] font-bold px-1.5 py-0.5 rounded shadow cursor-help",
                      CONDITION_COLOURS[photo.aiCondition ?? ""] ?? "bg-gray-100 text-gray-700"
                    )}
                  >
                    {photo.aiConditionScore}
                  </div>
                ) : isComplete ? (
                  <div title="Analysis failed — click Analyse Photos to retry" className="absolute top-1 right-1 bg-red-500 rounded-full p-0.5">
                    <AlertTriangle className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <div title="Not yet analysed" className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5">
                    <AlertTriangle className="h-3 w-3 text-white" />
                  </div>
                )}
                {/* Delete button on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); deletePhoto(photo.id) }}
                  className="absolute top-1 left-1 h-6 w-6 rounded-full bg-black/60 items-center justify-center hidden group-hover:flex"
                >
                  <Trash2 className="h-3 w-3 text-white" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Pro Photo Viewer ─────────────────────────────────────────────── */}
      {lightboxIdx !== null && (
        <ProPhotoViewer
          photos={sortedPhotos}
          startIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      {/* ── Selected Photo Detail ────────────────────────────────────────── */}
      {selectedPhoto && (
        <div className="rounded-lg border bg-white p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800 capitalize">
                {selectedPhoto.aiRoomType?.replace("_", " ") ?? "Photo"}
              </p>
              {selectedPhoto.aiCondition && (
                <Badge className={cn("text-xs border mt-1", CONDITION_COLOURS[selectedPhoto.aiCondition])}>
                  {CONDITION_LABELS[selectedPhoto.aiCondition]} ({selectedPhoto.aiConditionScore}/100)
                </Badge>
              )}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedPhoto(null)} className="h-7 w-7 p-0">
              ✕
            </Button>
          </div>
          {selectedPhoto.aiDescription && (
            <p className="text-xs text-gray-600">{selectedPhoto.aiDescription}</p>
          )}
          {selectedPhoto.aiIssues?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selectedPhoto.aiIssues.map((issue) => (
                <span key={issue} className="text-[11px] bg-red-50 text-red-700 border border-red-200 rounded px-1.5 py-0.5">
                  {issue.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
          {!selectedPhoto.aiAnalysedAt && (
            <p className={cn("text-xs flex items-center gap-1", isComplete ? "text-red-600" : "text-amber-600")}>
              <AlertTriangle className="h-3.5 w-3.5" />
              {isComplete
                ? "Analysis failed for this photo — click \"Analyse Photos\" to retry"
                : "Not yet analysed — click \"Analyse Photos\" to run AI analysis"}
            </p>
          )}
        </div>
      )}

      {/* ── Vendor Upload Link — compact footer ──────────────────────────── */}
      <div className="flex items-center gap-2 rounded-lg border bg-gray-50 px-3 py-2">
        <Camera className="h-3.5 w-3.5 text-gray-400 shrink-0" />
        <span className="text-[11px] text-gray-500 shrink-0">Vendor link:</span>
        {uploadLinkUrl && !linkExpired ? (
          <>
            <code className="flex-1 truncate text-[11px] text-gray-600 min-w-0">{uploadLinkUrl}</code>
            <Button size="sm" variant="ghost" onClick={copyUploadLink} className="h-6 w-6 p-0 shrink-0">
              {linkCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5 text-gray-400" />}
            </Button>
            <a href={uploadLinkUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0">
                <ExternalLink className="h-3.5 w-3.5 text-gray-400" />
              </Button>
            </a>
            {linkExpired && <span className="text-[10px] text-red-500 shrink-0">Expired</span>}
          </>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={generateUploadLink}
            disabled={generatingLink}
            className="text-[11px] h-6 px-2"
          >
            {generatingLink ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Camera className="mr-1 h-3 w-3" />}
            {uploadLinkUrl && linkExpired ? "Refresh" : "Generate link"}
          </Button>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── Floorplan Section ────────────────────────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}

      {/* Hidden file input */}
      <input
        ref={floorplanInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={handleFloorplanFileChange}
      />

      {/* Section header */}
      <div className="flex items-center gap-2 pt-1">
        <div className="h-px flex-1 bg-amber-200" />
        <div className="flex items-center gap-1.5 text-amber-700">
          <LayoutDashboard className="h-3.5 w-3.5" />
          <span className="text-xs font-semibold uppercase tracking-wide">Floorplan</span>
        </div>
        <div className="h-px flex-1 bg-amber-200" />
        <Button
          size="sm"
          variant="outline"
          onClick={() => floorplanInputRef.current?.click()}
          disabled={uploadingFloorplan}
          className="text-[11px] h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-50 shrink-0"
        >
          {uploadingFloorplan
            ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Uploading…</>
            : <><Upload className="mr-1 h-3 w-3" />Upload Floorplan</>}
        </Button>
      </div>

      {/* Floorplan content */}
      {floorplans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400 space-y-2 rounded-lg border border-dashed border-amber-200 bg-amber-50/40">
          <FileImage className="h-8 w-8 text-amber-300" />
          <p className="text-sm font-medium text-amber-700">No floorplan yet</p>
          <p className="text-xs text-amber-600/70">Upload a floorplan to extract room sizes and layout</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Floorplan thumbnail + delete */}
          {floorplans.map((fp) => (
            <div key={fp.id} className="rounded-lg border border-amber-200 bg-amber-50/30 overflow-hidden">
              <div className="flex items-start gap-3 p-3">
                {/* Thumbnail */}
                {fp.mimeType === "application/pdf" ? (
                  <a
                    href={fp.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 flex flex-col items-center justify-center w-24 h-24 rounded border border-amber-200 bg-amber-100 text-amber-600 text-xs gap-1 hover:bg-amber-200 transition-colors"
                  >
                    <FileImage className="h-6 w-6" />
                    <span>PDF</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <a href={fp.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img
                      src={fp.url}
                      alt="Floorplan"
                      className="w-24 h-24 object-cover rounded border border-amber-200 hover:opacity-80 transition-opacity"
                    />
                  </a>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-medium text-gray-700 truncate">{fp.filename ?? "Floorplan"}</p>
                    <button
                      onClick={() => deleteFloorplan(fp.id)}
                      className="flex-shrink-0 h-6 w-6 rounded-full bg-gray-100 hover:bg-red-100 flex items-center justify-center transition-colors"
                      title="Delete floorplan"
                    >
                      <X className="h-3.5 w-3.5 text-gray-500 hover:text-red-600" />
                    </button>
                  </div>
                  {fp.mimeType === "application/pdf" && !fp.aiAnalysedAt && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      PDF floorplans cannot be AI-analysed. Convert to an image to enable analysis.
                    </p>
                  )}
                  {fp.mimeType !== "application/pdf" && !fp.aiAnalysedAt && (
                    <Button
                      size="sm"
                      onClick={() => analyseFloorplan(fp.id)}
                      disabled={analysingFloorplan}
                      className="mt-2 text-[11px] h-7 bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      {analysingFloorplan
                        ? <><Loader2 className="mr-1 h-3 w-3 animate-spin" />Analysing…</>
                        : <><Sparkles className="mr-1 h-3 w-3" />Analyse with AI</>}
                    </Button>
                  )}
                  {fp.aiAnalysedAt && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span className="text-[11px] text-green-600">Analysed</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => analyseFloorplan(fp.id)}
                        disabled={analysingFloorplan}
                        className="text-[11px] h-5 px-1.5 text-gray-400 hover:text-gray-600"
                        title="Re-run analysis"
                      >
                        {analysingFloorplan ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Analysis result card */}
              {floorplanAnalysis && fp.aiAnalysedAt && (
                <div className="border-t border-amber-200 bg-white p-3 space-y-3">
                  {/* Key metrics grid */}
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      {
                        icon: <Home className="h-3.5 w-3.5" />,
                        label: "Area",
                        value: floorplanAnalysis.totalSqFt != null
                          ? `${floorplanAnalysis.totalSqFt} ft²`
                          : floorplanAnalysis.totalSqM != null
                          ? `${floorplanAnalysis.totalSqM} m²`
                          : "—",
                      },
                      {
                        icon: <BedDouble className="h-3.5 w-3.5" />,
                        label: "Beds",
                        value: floorplanAnalysis.bedrooms ?? "—",
                      },
                      {
                        icon: <Bath className="h-3.5 w-3.5" />,
                        label: "Baths",
                        value: floorplanAnalysis.bathrooms ?? "—",
                      },
                      {
                        icon: <Sofa className="h-3.5 w-3.5" />,
                        label: "Recepts",
                        value: floorplanAnalysis.receptions ?? "—",
                      },
                      {
                        icon: <Layers className="h-3.5 w-3.5" />,
                        label: "Storeys",
                        value: floorplanAnalysis.storeys ?? "—",
                      },
                    ].map(({ icon, label, value }) => (
                      <div
                        key={label}
                        className="flex flex-col items-center gap-0.5 rounded-md bg-amber-50 border border-amber-100 py-2 px-1"
                      >
                        <span className="text-amber-500">{icon}</span>
                        <span className="text-sm font-semibold text-gray-800">{String(value)}</span>
                        <span className="text-[10px] text-gray-400">{label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Badges row */}
                  <div className="flex flex-wrap gap-1.5">
                    {floorplanAnalysis.layoutType && (
                      <Badge className="text-[11px] border bg-amber-100 text-amber-800 border-amber-200 capitalize">
                        {floorplanAnalysis.layoutType.replace("_", " ")}
                      </Badge>
                    )}
                    {floorplanAnalysis.hasExtensionPotential && (
                      <Badge className="text-[11px] border bg-green-100 text-green-800 border-green-200">
                        Extension potential
                      </Badge>
                    )}
                    {floorplanAnalysis.hasLoftPotential && (
                      <Badge className="text-[11px] border bg-blue-100 text-blue-800 border-blue-200">
                        Loft potential
                      </Badge>
                    )}
                    {floorplanAnalysis.hasGarage && (
                      <Badge className="text-[11px] border bg-gray-100 text-gray-700 border-gray-200">
                        Garage
                      </Badge>
                    )}
                    {floorplanAnalysis.hasGarden && (
                      <Badge className="text-[11px] border bg-emerald-100 text-emerald-800 border-emerald-200">
                        Garden
                      </Badge>
                    )}
                  </div>

                  {/* Notes */}
                  {floorplanAnalysis.notes && (
                    <p className="text-[11px] text-gray-600 italic leading-relaxed">{floorplanAnalysis.notes}</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
