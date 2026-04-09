"use client"

import { useState, useEffect, useCallback } from "react"
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
} from "lucide-react"
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

export function PhotoAnalysisTab({ leadId }: { leadId: string }) {
  const [photos, setPhotos] = useState<PropertyPhoto[]>([])
  const [leadData, setLeadData] = useState<LeadPhotoData | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysing, setAnalysing] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [selectedPhoto, setSelectedPhoto] = useState<PropertyPhoto | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [photosRes, leadRes] = await Promise.all([
        fetch(`/api/vendor-leads/${leadId}/photos`),
        fetch(`/api/vendor-leads/${leadId}`),
      ])
      const photosData = await photosRes.json()
      const leadFull = await leadRes.json()
      setPhotos(photosData.photos ?? [])
      setLeadData({
        photoConditionScore: leadFull.photoConditionScore ?? null,
        photoConditionOverride: leadFull.photoConditionOverride ?? null,
        photoAnalysisStatus: leadFull.photoAnalysisStatus ?? "pending",
        photoAnalysisCompletedAt: leadFull.photoAnalysisCompletedAt ?? null,
        photoUploadToken: leadFull.photoUploadToken ?? null,
        photoUploadExpiresAt: leadFull.photoUploadExpiresAt ?? null,
      })
    } catch (err) {
      toast.error("Failed to load photos")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  useEffect(() => { fetchData() }, [fetchData])

  // Poll while analysis is running
  useEffect(() => {
    if (leadData?.photoAnalysisStatus !== "running") return
    const interval = setInterval(fetchData, 5000)
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
      setTimeout(fetchData, 3000)
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

  async function updateConditionOverride(value: string) {
    const override = value === "none" ? null : value
    await fetch(`/api/vendor-leads/${leadId}/photos/condition-override`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ override }),
    })
    setLeadData((prev) => prev ? { ...prev, photoConditionOverride: override } : prev)
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

  return (
    <div className="space-y-4">
      {/* ── Condition Summary ───────────────────────────────────────────── */}
      <div className="rounded-lg border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
            <Shield className="h-4 w-4 text-gray-400" />
            Property Condition
          </h3>
          {leadData?.photoConditionScore != null && (
            <span className="text-xs text-gray-500">
              AI score: <strong>{leadData.photoConditionScore}/100</strong>
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Badge className={cn("text-xs border", CONDITION_COLOURS[effectiveCondition] ?? "bg-gray-100 text-gray-600")}>
            {CONDITION_LABELS[effectiveCondition] ?? "Unknown"}
          </Badge>
          {leadData?.photoConditionOverride && (
            <span className="text-[11px] text-amber-600 font-medium">Manual override</span>
          )}
        </div>

        <div>
          <label className="text-[11px] text-gray-500 block mb-1">Override condition</label>
          <Select
            value={leadData?.photoConditionOverride ?? "none"}
            onValueChange={updateConditionOverride}
          >
            <SelectTrigger className="h-8 text-xs w-48">
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
        </div>
      </div>

      {/* ── Upload Link ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border bg-white p-4 space-y-2">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <Camera className="h-4 w-4 text-gray-400" />
          Vendor Upload Link
        </h3>
        <p className="text-xs text-gray-500">
          Share this link with the vendor so they can upload photos from their phone.
        </p>
        {uploadLinkUrl && !linkExpired ? (
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded bg-gray-100 px-2 py-1.5 text-[11px] text-gray-700">
              {uploadLinkUrl}
            </code>
            <Button size="sm" variant="outline" onClick={copyUploadLink} className="shrink-0 h-7 text-xs">
              {linkCopied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <a href={uploadLinkUrl} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="outline" className="shrink-0 h-7 text-xs">
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={generateUploadLink}
            disabled={generatingLink}
            className="text-xs"
          >
            {generatingLink ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1.5 h-3.5 w-3.5" />}
            {uploadLinkUrl && linkExpired ? "Refresh Link" : "Generate Upload Link"}
          </Button>
        )}
      </div>

      {/* ── Analyse Button ──────────────────────────────────────────────── */}
      {photos.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border bg-white px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-800">
              {photos.length} photo{photos.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-500">
              {isRunning
                ? "Analysing…"
                : hasUnanalysed
                ? `${photos.filter((p) => !p.aiAnalysedAt).length} not yet analysed`
                : "All analysed"}
            </p>
          </div>
          <Button
            size="sm"
            onClick={triggerAnalysis}
            disabled={analysing || isRunning || !hasUnanalysed}
            className="text-xs"
          >
            {isRunning ? (
              <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Analysing…</>
            ) : (
              <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Analyse Photos</>
            )}
          </Button>
        </div>
      )}

      {/* ── Photo Grid ──────────────────────────────────────────────────── */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-gray-400 space-y-2">
          <ImageIcon className="h-10 w-10" />
          <p className="text-sm font-medium">No photos yet</p>
          <p className="text-xs">Generate an upload link to collect photos from the vendor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className={cn(
                "relative group rounded-lg overflow-hidden border cursor-pointer",
                selectedPhoto?.id === photo.id ? "ring-2 ring-blue-500" : ""
              )}
              onClick={() => setSelectedPhoto(selectedPhoto?.id === photo.id ? null : photo)}
            >
              <img
                src={photo.url}
                alt={photo.aiRoomType ?? "property photo"}
                className="w-full aspect-square object-cover"
              />
              {/* Overlay */}
              {photo.aiCondition && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/90 capitalize">
                      {photo.aiRoomType?.replace("_", " ") ?? ""}
                    </span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded font-medium",
                      CONDITION_COLOURS[photo.aiCondition] ?? "bg-gray-100 text-gray-700"
                    )}>
                      {photo.aiConditionScore}
                    </span>
                  </div>
                </div>
              )}
              {!photo.aiAnalysedAt && (
                <div className="absolute top-1 right-1 bg-amber-400 rounded-full p-0.5">
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
          ))}
        </div>
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
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Not yet analysed — click "Analyse Photos" to run AI analysis
            </p>
          )}
        </div>
      )}
    </div>
  )
}
