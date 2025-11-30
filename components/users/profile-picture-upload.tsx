"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Upload, X, Loader2 } from "lucide-react"
import Image from "next/image"

interface ProfilePictureUploadProps {
  userId: string
  currentS3Key: string | null
  onUploadComplete: (s3Key: string) => void
  onRemove: () => void
}

export function ProfilePictureUpload({
  userId,
  currentS3Key,
  onUploadComplete,
  onRemove,
}: ProfilePictureUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load current profile picture if it exists
  useEffect(() => {
    if (currentS3Key) {
      // Fetch presigned URL from API
      fetch(`/api/users/${userId}/profile-picture/url`)
        .then((res) => res.json())
        .then((data) => {
          if (data.url) {
            setCurrentImageUrl(data.url)
          }
        })
        .catch(console.error)
    } else {
      setCurrentImageUrl(null)
    }
  }, [currentS3Key, userId])

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB")
      return
    }

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload to S3
    setIsUploading(true)
    try {
      // Get presigned upload URL
      const response = await fetch(
        `/api/users/${userId}/profile-picture?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`
      )

      if (!response.ok) {
        throw new Error("Failed to get upload URL")
      }

      const { uploadUrl, s3Key } = await response.json()

      // Upload file to S3
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      })

      if (!uploadResponse.ok) {
        throw new Error("Failed to upload image")
      }

      // Update user's profile picture S3 key
      const updateResponse = await fetch(`/api/users/${userId}/profile-picture`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ s3Key }),
      })

      if (!updateResponse.ok) {
        throw new Error("Failed to update profile picture")
      }

      // Get signed URL for the new image from API
      const urlResponse = await fetch(`/api/users/${userId}/profile-picture/url`)
      if (urlResponse.ok) {
        const urlData = await urlResponse.json()
        if (urlData.url) {
          setCurrentImageUrl(urlData.url)
        }
      }
      setPreviewUrl(null)
      onUploadComplete(s3Key)
    } catch (error) {
      console.error("Error uploading profile picture:", error)
      alert(`Error uploading profile picture: ${error instanceof Error ? error.message : "Unknown error"}`)
      setPreviewUrl(null)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  const handleRemove = async () => {
    if (!confirm("Are you sure you want to remove this profile picture?")) {
      return
    }

    try {
      const response = await fetch(`/api/users/${userId}/profile-picture`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to remove profile picture")
      }

      setCurrentImageUrl(null)
      onRemove()
    } catch (error) {
      console.error("Error removing profile picture:", error)
      alert(`Error removing profile picture: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const displayUrl = previewUrl || currentImageUrl

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative h-32 w-32 overflow-hidden rounded-full border-2 border-border bg-muted">
        {displayUrl ? (
          <Image
            src={displayUrl}
            alt="Profile picture"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
            No photo
          </div>
        )}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="mr-2 h-4 w-4" />
          {currentImageUrl ? "Change" : "Upload"}
        </Button>
        {currentImageUrl && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={isUploading}
          >
            <X className="mr-2 h-4 w-4" />
            Remove
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

