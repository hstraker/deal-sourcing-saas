"use client"

import { useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { Camera, Crown, Loader2, Trash2, Upload } from "lucide-react"

export interface DealPhoto {
  id: string
  s3Url: string
  caption: string | null
  isCover: boolean
  sortOrder: number
}

interface DealPhotoManagerProps {
  dealId: string
  initialPhotos: DealPhoto[]
}

const MAX_FILE_SIZE_MB = 12
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export function DealPhotoManager({ dealId, initialPhotos }: DealPhotoManagerProps) {
  const [photos, setPhotos] = useState<DealPhoto[]>(initialPhotos)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<{
    currentFile: number
    totalFiles: number
    fileProgress: number
    overallProgress: number
    currentFileName: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const refreshPhotos = async () => {
    const response = await fetch(`/api/deals/${dealId}/photos`)
    if (response.ok) {
      const data = await response.json()
      setPhotos(data)
    }
  }

  const uploadFileWithProgress = (
    url: string,
    file: File,
    fileIndex: number,
    totalFiles: number
  ) => {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("PUT", url)
      xhr.setRequestHeader("Content-Type", file.type)

      // Add timeout (5 minutes for large files)
      xhr.timeout = 5 * 60 * 1000

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return
        const fileProgress = Math.round((event.loaded / event.total) * 100)
        // Calculate overall progress: (completed files + current file progress) / total files
        const completedFiles = fileIndex
        const overallProgress = Math.round(
          ((completedFiles + event.loaded / event.total) / totalFiles) * 100
        )
        setUploadProgress({
          currentFile: fileIndex + 1,
          totalFiles,
          fileProgress,
          overallProgress,
          currentFileName: file.name,
        })
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve()
        } else {
          console.error("Upload failed:", {
            status: xhr.status,
            statusText: xhr.statusText,
            response: xhr.responseText?.substring(0, 200),
          })
          reject(
            new Error(
              `Upload failed: ${xhr.status} ${xhr.statusText}. ${
                xhr.responseText ? `Response: ${xhr.responseText.substring(0, 100)}` : ""
              }`
            )
          )
        }
      }

      xhr.onerror = () => {
        console.error("Network error during upload:", {
          url: url.substring(0, 100) + "...",
          fileSize: file.size,
          fileType: file.type,
        })
        reject(
          new Error(
            "Network error while uploading. Check your internet connection and S3 CORS configuration."
          )
        )
      }

      xhr.ontimeout = () => {
        console.error("Upload timeout:", { fileSize: file.size, fileType: file.type })
        reject(new Error("Upload timed out. The file may be too large or connection is slow."))
      }

      xhr.onabort = () => {
        reject(new Error("Upload was cancelled"))
      }

      try {
        xhr.send(file)
      } catch (err) {
        console.error("Error sending file:", err)
        reject(new Error(`Failed to send file: ${err instanceof Error ? err.message : "Unknown error"}`))
      }
    })
  }

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const validFiles = Array.from(files).filter((file) => {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        setError("Only JPEG, PNG, or WEBP images are supported.")
        return false
      }
      const sizeMb = file.size / (1024 * 1024)
      if (sizeMb > MAX_FILE_SIZE_MB) {
        setError(`"${file.name}" is too large. Max size is ${MAX_FILE_SIZE_MB}MB.`)
        return false
      }
      return true
    })

    if (validFiles.length === 0) {
      return
    }

    setIsUploading(true)
    setUploadProgress({
      currentFile: 0,
      totalFiles: validFiles.length,
      fileProgress: 0,
      overallProgress: 0,
      currentFileName: "",
    })
    setError(null)

    try {
      for (let fileIndex = 0; fileIndex < validFiles.length; fileIndex++) {
        const file = validFiles[fileIndex]
        console.log("Step 1: Requesting presigned URL for", file.name)
        const presignResponse = await fetch(`/api/deals/${dealId}/photos/presign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
          }),
        })

        if (!presignResponse.ok) {
          const errorData = await presignResponse.json().catch(() => ({}))
          console.error("Presign API error:", {
            status: presignResponse.status,
            statusText: presignResponse.statusText,
            error: errorData,
          })
          throw new Error(
            `Failed to get upload URL: ${presignResponse.status} ${presignResponse.statusText}. ${
              errorData.error || ""
            }`
          )
        }

        const presignData = await presignResponse.json()
        const { uploadUrl, key, url } = presignData
        console.log("Step 2: Got presigned URL, uploading to S3", { key, uploadUrlPreview: uploadUrl.substring(0, 50) + "..." })

        if (!uploadUrl) {
          throw new Error("Presigned URL is missing from response")
        }

        await uploadFileWithProgress(uploadUrl, file, fileIndex, validFiles.length)
        console.log("Step 3: Upload to S3 successful, saving photo metadata")

        const saveResponse = await fetch(`/api/deals/${dealId}/photos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            key,
            url,
            fileName: file.name,
          }),
        })

        if (!saveResponse.ok) {
          const errorData = await saveResponse.json().catch(() => ({}))
          console.error("Save photo API error:", {
            status: saveResponse.status,
            statusText: saveResponse.statusText,
            error: errorData,
          })
          throw new Error(
            `Failed to save photo reference: ${saveResponse.status} ${saveResponse.statusText}. ${
              errorData.error || ""
            }`
          )
        }

        // Update progress to show file is complete
        setUploadProgress({
          currentFile: fileIndex + 1,
          totalFiles: validFiles.length,
          fileProgress: 100,
          overallProgress: Math.round(((fileIndex + 1) / validFiles.length) * 100),
          currentFileName: file.name,
        })
        console.log(`Step 4: Photo ${fileIndex + 1}/${validFiles.length} completed`)
      }

      await refreshPhotos()
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
      console.log("All photos uploaded successfully")
    } catch (err) {
      console.error("Upload error:", err)
      const errorMessage =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : "Upload failed. Check the browser console for details."
      setError(errorMessage)
    } finally {
      setIsUploading(false)
      setUploadProgress(null)
    }
  }

  const handleDelete = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo?")) return
    const response = await fetch(`/api/deals/${dealId}/photos/${photoId}`, {
      method: "DELETE",
    })
    if (response.ok) {
      setPhotos((prev) => prev.filter((photo) => photo.id !== photoId))
    }
  }

  const handleSetCover = async (photoId: string) => {
    const response = await fetch(`/api/deals/${dealId}/photos/${photoId}/cover`, {
      method: "PUT",
    })
    if (response.ok) {
      await refreshPhotos()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Deal Photos</h2>
          <p className="text-sm text-muted-foreground">
            Upload up to 15 photos. First photo will be used as the cover image.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
            id="photo-upload-input"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Photos
              </>
            )}
          </Button>
        </div>
      </div>

      {uploadProgress !== null && (
        <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>
                Uploading {uploadProgress.currentFile} of {uploadProgress.totalFiles}
                {uploadProgress.currentFileName && (
                  <span className="ml-2 text-muted-foreground">
                    ({uploadProgress.currentFileName})
                  </span>
                )}
              </span>
            </div>
            <span className="font-medium text-primary">{uploadProgress.overallProgress}%</span>
          </div>
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-primary/20">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress.overallProgress}%` }}
              />
            </div>
            {uploadProgress.totalFiles > 1 && (
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>File: {uploadProgress.fileProgress}%</span>
                <span>Overall: {uploadProgress.overallProgress}%</span>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {photos.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 border-dashed py-10 text-center text-muted-foreground">
          <Camera className="h-10 w-10" />
          <div>
            <p className="font-medium text-foreground">No photos yet</p>
            <p className="text-sm">Upload property photos to help investors visualise the deal.</p>
          </div>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
            <Upload className="h-4 w-4" />
            Upload Photos
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => (
            <Card
              key={photo.id}
              className={cn(
                "overflow-hidden border transition",
                photo.isCover && "border-primary shadow-lg"
              )}
            >
              <div className="relative h-48 w-full">
                <Image
                  src={photo.s3Url}
                  alt="Deal photo"
                  fill
                  className="object-cover"
                />
                {photo.isCover && (
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                    <Crown className="h-3 w-3" />
                    Cover
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between border-t px-3 py-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={() => handleSetCover(photo.id)}
                  disabled={photo.isCover}
                >
                  <Crown className="h-4 w-4" />
                  {photo.isCover ? "Cover" : "Make cover"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDelete(photo.id)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


