"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Camera, Upload, X, CheckCircle2, Loader2, ImageIcon, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface LeadInfo {
  id: string
  vendorName: string
  propertyAddress: string | null
  photos: UploadedPhoto[]
}

interface UploadedPhoto {
  id: string
  url: string
  aiRoomType: string | null
  aiCondition: string | null
  uploadedAt: string
}

interface PendingPhoto {
  id: string
  file: File
  previewUrl: string
  status: "pending" | "uploading" | "done" | "error"
  errorMsg?: string
}

export default function PublicUploadPage() {
  const { token } = useParams<{ token: string }>()
  const [lead, setLead] = useState<LeadInfo | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingPhoto[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/upload/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setLoadError(data.error)
        else setLead(data)
      })
      .catch(() => setLoadError("Failed to load page"))
  }, [token])

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return
    const newPhotos: PendingPhoto[] = Array.from(files).map((file) => ({
      id: Math.random().toString(36).slice(2),
      file,
      previewUrl: URL.createObjectURL(file),
      status: "pending",
    }))
    setPending((prev) => [...prev, ...newPhotos])
  }, [])

  async function uploadPhoto(photo: PendingPhoto) {
    setPending((prev) => prev.map((p) => p.id === photo.id ? { ...p, status: "uploading" } : p))
    try {
      // 1. Presign
      const presignRes = await fetch(`/api/upload/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "presign",
          filename: photo.file.name,
          contentType: photo.file.type,
          sizeBytes: photo.file.size,
        }),
      })
      const { uploadUrl, s3Key, publicUrl } = await presignRes.json()

      // 2. Upload to S3 directly
      await fetch(uploadUrl, {
        method: "PUT",
        body: photo.file,
        headers: { "Content-Type": photo.file.type },
      })

      // 3. Confirm
      await fetch(`/api/upload/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          s3Key,
          filename: photo.file.name,
          contentType: photo.file.type,
          sizeBytes: photo.file.size,
        }),
      })

      setPending((prev) => prev.map((p) => p.id === photo.id ? { ...p, status: "done" } : p))
    } catch (err) {
      setPending((prev) =>
        prev.map((p) =>
          p.id === photo.id
            ? { ...p, status: "error", errorMsg: err instanceof Error ? err.message : "Upload failed" }
            : p
        )
      )
    }
  }

  async function uploadAll() {
    const toUpload = pending.filter((p) => p.status === "pending")
    for (const photo of toUpload) {
      await uploadPhoto(photo)
    }
    toast.success("Photos uploaded! Your agent will review them shortly.")
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h1 className="text-lg font-semibold text-gray-800">{loadError}</h1>
          <p className="text-sm text-gray-500">Please contact your agent for a new link.</p>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  const pendingCount = pending.filter((p) => p.status === "pending").length
  const doneCount = pending.filter((p) => p.status === "done").length
  const existingCount = lead.photos.length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4">
        <h1 className="text-base font-semibold text-gray-900">Upload Property Photos</h1>
        <p className="text-sm text-gray-500">{lead.propertyAddress ?? lead.vendorName}</p>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* Already uploaded */}
        {existingCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-green-700 font-medium">
              {existingCount} photo{existingCount !== 1 ? "s" : ""} already uploaded
            </p>
          </div>
        )}

        {/* Add photos buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*"
                fileInputRef.current.capture = "environment"
                fileInputRef.current.click()
              }
            }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-blue-700 hover:bg-blue-100 active:bg-blue-200 transition-colors"
          >
            <Camera className="h-8 w-8" />
            <span className="text-sm font-medium">Take Photo</span>
          </button>
          <button
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.accept = "image/*"
                fileInputRef.current.removeAttribute("capture")
                fileInputRef.current.click()
              }
            }}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-gray-300 bg-white p-6 text-gray-600 hover:bg-gray-50 active:bg-gray-100 transition-colors"
          >
            <ImageIcon className="h-8 w-8" />
            <span className="text-sm font-medium">From Gallery</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => addFiles(e.target.files)}
        />

        {/* Pending photos grid */}
        {pending.length > 0 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {pending.map((photo) => (
                <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img src={photo.previewUrl} alt="" className="w-full h-full object-cover" />
                  <div className={cn(
                    "absolute inset-0 flex items-center justify-center",
                    photo.status === "uploading" && "bg-black/40",
                    photo.status === "done" && "bg-green-500/30",
                    photo.status === "error" && "bg-red-500/30",
                  )}>
                    {photo.status === "uploading" && <Loader2 className="h-6 w-6 text-white animate-spin" />}
                    {photo.status === "done" && <CheckCircle2 className="h-6 w-6 text-white" />}
                    {photo.status === "error" && <X className="h-6 w-6 text-white" />}
                  </div>
                  {photo.status === "pending" && (
                    <button
                      onClick={() => setPending((prev) => prev.filter((p) => p.id !== photo.id))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 flex items-center justify-center"
                    >
                      <X className="h-3 w-3 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pendingCount > 0 && (
              <Button onClick={uploadAll} className="w-full" size="lg">
                <Upload className="mr-2 h-4 w-4" />
                Upload {pendingCount} Photo{pendingCount !== 1 ? "s" : ""}
              </Button>
            )}

            {doneCount > 0 && pendingCount === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-2" />
                <p className="text-sm font-semibold text-green-800">All photos uploaded!</p>
                <p className="text-xs text-green-600 mt-1">Your agent will review them shortly.</p>
              </div>
            )}
          </div>
        )}

        {/* Tips */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">📸 Photo tips</p>
          <ul className="space-y-0.5 list-disc list-inside">
            <li>Take photos of every room</li>
            <li>Include the exterior and front of the property</li>
            <li>Show any areas needing repair or renovation</li>
            <li>Good lighting makes a big difference</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
