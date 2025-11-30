"use client"

import { useState, useCallback, useEffect } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Camera } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface Photo {
  id: string
  s3Url: string
  caption?: string | null
  isCover?: boolean
}

interface PipelinePhotoViewerProps {
  photos: Photo[]
  className?: string
  onPhotoClick?: () => void
}

export function PipelinePhotoViewer({
  photos,
  className,
  onPhotoClick,
}: PipelinePhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    const coverIndex = photos.findIndex((p) => p.isCover)
    return coverIndex >= 0 ? coverIndex : 0
  })

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1))
  }, [photos.length])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1))
  }, [photos.length])

  // Keyboard navigation (only when card is focused)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        goToPrevious()
      } else if (e.key === "ArrowRight") {
        goToNext()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [goToPrevious, goToNext])

  // Touch/swipe support
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    if (isLeftSwipe) goToNext()
    if (isRightSwipe) goToPrevious()
  }

  const currentPhoto = photos[currentIndex]
  // Get next photos for the side grid
  const nextPhoto1 = photos.length > 1 ? photos[(currentIndex + 1) % photos.length] : null
  const nextPhoto2 = photos.length > 2 ? photos[(currentIndex + 2) % photos.length] : null

  // No photos - use full width with same height as multi-photo layout (height = 2/3 width)
  if (photos.length === 0) {
    return (
      <div className={cn("group relative overflow-hidden rounded", className)}>
        <div className="relative w-full aspect-[3/2]">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded border border-dashed border-muted-foreground/30 bg-gradient-to-br from-muted/60 to-muted/30">
            <Camera className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-xs font-medium text-muted-foreground">No photos</p>
          </div>
        </div>
      </div>
    )
  }

  // If only 1 photo, use full width with same height as multi-photo layout (height = 2/3 width)
  if (photos.length === 1) {
    return (
      <div className={cn("group relative overflow-hidden rounded", className)}>
        <div
          className={cn(
            "relative w-full aspect-[3/2]",
            onPhotoClick && "cursor-pointer"
          )}
          onClick={onPhotoClick}
        >
          <Image
            src={currentPhoto.s3Url}
            alt={currentPhoto.caption || "Photo 1"}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        </div>
      </div>
    )
  }

  // If 2 photos, show main + 1 side
  if (photos.length === 2) {
    return (
      <div className={cn("group relative overflow-hidden rounded", className)}>
        <div className="grid grid-cols-3 gap-1">
          {/* Main photo - takes 2 columns */}
          <div
            className={cn(
              "relative col-span-2 aspect-square",
              onPhotoClick && "cursor-pointer"
            )}
            onClick={onPhotoClick}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <Image
              src={currentPhoto.s3Url}
              alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
              fill
              className="object-cover transition-all duration-300"
              key={currentIndex}
            />

            {/* Navigation buttons */}
            <Button
              variant="ghost"
              size="icon"
              className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToPrevious()
              }}
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
              onClick={(e) => {
                e.stopPropagation()
                goToNext()
              }}
            >
              <ChevronRight className="h-3 w-3" />
            </Button>

            {/* Photo counter */}
            <div className="absolute top-1 left-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm z-10">
              <span className="text-xs font-medium text-white">
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
          </div>

          {/* Single side photo */}
          <div className="col-span-1">
            {nextPhoto1 && (
              <div
                className="relative aspect-square cursor-pointer overflow-hidden rounded transition-transform hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex((currentIndex + 1) % photos.length)
                }}
              >
                <Image
                  src={nextPhoto1.s3Url}
                  alt={nextPhoto1.caption || `Photo ${((currentIndex + 1) % photos.length) + 1}`}
                  fill
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10" />
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 3+ photos - show full layout
  return (
    <div className={cn("group relative overflow-hidden rounded", className)}>
      <div className="grid grid-cols-3 gap-1">
        {/* Main photo - takes 2 columns */}
        <div
          className={cn(
            "relative col-span-2 aspect-square",
            onPhotoClick && "cursor-pointer"
          )}
          onClick={onPhotoClick}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Image
            src={currentPhoto.s3Url}
            alt={currentPhoto.caption || `Photo ${currentIndex + 1}`}
            fill
            className="object-cover transition-all duration-300"
            key={currentIndex}
          />

          {/* Navigation buttons */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>

          {/* Photo counter overlay */}
          <div className="absolute top-1 left-1 rounded-full bg-black/60 px-2 py-0.5 backdrop-blur-sm z-10">
            <span className="text-xs font-medium text-white">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>
        </div>

        {/* Side photos grid - 2 smaller photos */}
        <div className="col-span-1 flex flex-col gap-1">
          {nextPhoto1 && (
            <div
              className="relative aspect-square cursor-pointer overflow-hidden rounded transition-transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex((currentIndex + 1) % photos.length)
              }}
            >
              <Image
                src={nextPhoto1.s3Url}
                alt={nextPhoto1.caption || `Photo ${((currentIndex + 1) % photos.length) + 1}`}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10" />
            </div>
          )}
          {nextPhoto2 && (
            <div
              className="relative aspect-square cursor-pointer overflow-hidden rounded transition-transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex((currentIndex + 2) % photos.length)
              }}
            >
              <Image
                src={nextPhoto2.s3Url}
                alt={nextPhoto2.caption || `Photo ${((currentIndex + 2) % photos.length) + 1}`}
                fill
                className="object-cover"
              />
              <div className="absolute inset-0 bg-black/0 transition-colors hover:bg-black/10" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

