"use client"

import { useState, useRef, useCallback } from "react"
import {
  X,
  Camera,
  Upload,
  Loader2,
  CheckCircle2,
  Shield,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { PhotoAnalysisTab } from "./photo-analysis-tab"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

function InfoRow({ label, value, valueClass }: { label: string; value: React.ReactNode; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex-shrink-0 text-slate-400">{label}</span>
      <span className={cn("text-right font-semibold text-slate-100 truncate", valueClass)}>{value}</span>
    </div>
  )
}

const CONDITION_COLOURS: Record<string, string> = {
  excellent:           "text-green-400",
  good:                "text-blue-400",
  needs_work:          "text-amber-400",
  needs_modernisation: "text-orange-400",
  poor:                "text-red-400",
}
const CONDITION_LABELS: Record<string, string> = {
  excellent:           "Excellent",
  good:                "Good",
  needs_work:          "Needs Work",
  needs_modernisation: "Needs Modernisation",
  poor:                "Poor",
  unknown:             "Not assessed",
}

function conditionFromScore(score: number | null): string {
  if (score === null) return "unknown"
  if (score >= 80) return "excellent"
  if (score >= 65) return "good"
  if (score >= 50) return "needs_work"
  if (score >= 30) return "needs_modernisation"
  return "poor"
}

const STATUS_LABELS: Record<string, string> = {
  pending:   "Not started",
  running:   "Analysing…",
  completed: "Complete",
  failed:    "Failed",
}
const STATUS_COLOURS: Record<string, string> = {
  pending:   "text-slate-400",
  running:   "text-amber-400",
  completed: "text-green-400",
  failed:    "text-red-400",
}

// ─── component ───────────────────────────────────────────────────────────────

export function PhotoAnalysisModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const [refreshKey, setRefreshKey]   = useState(0)
  const [uploading, setUploading]     = useState(false)
  const [uploadCount, setUploadCount] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const status       = lead.photoAnalysisStatus ?? "pending"
  const conditionKey = lead.photoConditionOverride
    ?? conditionFromScore(lead.photoConditionScore ?? null)
  const analysedAt   = lead.photoAnalysisCompletedAt
    ? (() => {
        const days = Math.floor((Date.now() - new Date(lead.photoAnalysisCompletedAt!).getTime()) / 86400000)
        return days === 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`
      })()
    : null

  // Presign → PUT to S3 → confirm for each file
  const handleFiles = useCallback(async (files: FileList) => {
    if (!files.length) return
    setUploading(true)
    let succeeded = 0

    for (const file of Array.from(files)) {
      try {
        // 1. Get presigned URL
        const presignRes = await fetch(`/api/vendor-leads/${lead.id}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "presign",
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          }),
        })
        if (!presignRes.ok) throw new Error("Failed to get upload URL")
        const { uploadUrl, s3Key, publicUrl } = await presignRes.json()

        // 2. Upload directly to S3
        const putRes = await fetch(uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        })
        if (!putRes.ok) throw new Error("Failed to upload to storage")

        // 3. Confirm record creation
        const confirmRes = await fetch(`/api/vendor-leads/${lead.id}/photos`, {
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
        if (!confirmRes.ok) throw new Error("Failed to save photo record")
        succeeded++
      } catch (err: any) {
        toast.error(`Failed to upload ${file.name}: ${err.message}`)
      }
    }

    setUploading(false)
    if (succeeded > 0) {
      toast.success(`${succeeded} photo${succeeded !== 1 ? "s" : ""} uploaded`)
      setUploadCount((c) => c + succeeded)
      setRefreshKey((k) => k + 1) // remount PhotoAnalysisTab to re-fetch
    }
  }, [lead.id])

  // ── left panel ──────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex flex-col gap-0 p-5 h-full overflow-y-auto">

      {/* Address + pills */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
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
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Photo Analysis Status */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Photo Analysis
        </p>
        <InfoRow
          label="Status"
          value={STATUS_LABELS[status] ?? status}
          valueClass={STATUS_COLOURS[status]}
        />
        <InfoRow
          label="Last Analysed"
          value={analysedAt ?? "—"}
        />
        {lead.photoConditionScore != null && (
          <InfoRow
            label="AI Score"
            value={`${lead.photoConditionScore}/100`}
            valueClass={CONDITION_COLOURS[conditionFromScore(lead.photoConditionScore)] ?? "text-slate-300"}
          />
        )}
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Condition */}
      <div className="mb-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-slate-500" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
            Condition
          </p>
        </div>
        <div className="flex items-center justify-between">
          <span className={cn("text-sm font-bold", CONDITION_COLOURS[conditionKey] ?? "text-slate-400")}>
            {CONDITION_LABELS[conditionKey] ?? "Unknown"}
          </span>
          {lead.photoConditionOverride && (
            <span className="text-[10px] text-amber-400">Override</span>
          )}
        </div>
        {status === "completed" && (
          <div className="flex items-center gap-1 text-[10px] text-slate-500">
            <Sparkles className="h-3 w-3" />
            AI assessed from photos
          </div>
        )}
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
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
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="5xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Camera className="h-4 w-4 text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900">Photo Analysis</h2>
          <span className="text-xs text-gray-400">{lead.vendorName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Direct upload button */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {uploading
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading…</>
              : <><Upload className="h-3.5 w-3.5" />Upload from Device</>
            }
          </button>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Right panel body — PhotoAnalysisTab handles everything else */}
      <div className="flex-1 overflow-y-auto p-4">
        <PhotoAnalysisTab key={refreshKey} leadId={lead.id} />
      </div>

    </ModalShell>
  )
}
