"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Crown,
} from "lucide-react"

export interface Photo {
  id: string
  s3Url: string
  caption?: string | null
  isCover?: boolean
}

interface PhotoGalleryProps {
  photos: Photo[]
  className?: string
  showCoverBadge?: boolean
  thumbnailSize?: "sm" | "md" | "lg"
  initialIndex?: number | null
  hideThumbnails?: boolean
  onClose?: () => void
}

export function PhotoGallery({
  photos,
  className,
  showCoverBadge = false,
  thumbnailSize = "md",
  initialIndex = null,
  hideThumbnails = false,
  onClose,
}: PhotoGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialIndex)
  const [zoom, setZoom] = useState(1)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const openLightbox = (index: number) => {
    setSelectedIndex(index)
    setZoom(1)
    setIsFullscreen(false)
  }

  const closeLightbox = () => {
    setSelectedIndex(null)
    setZoom(1)
    setIsFullscreen(false)
    onClose?.()
  }

  // Update selectedIndex when initialIndex changes
  useEffect(() => {
    if (initialIndex !== null && initialIndex !== selectedIndex) {
      setSelectedIndex(initialIndex)
    }
  }, [initialIndex])

  const goToPrevious = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((prev) => (prev === 0 ? photos.length - 1 : (prev ?? 0) - 1))
      setZoom(1)
    }
  }, [selectedIndex, photos.length])

  const goToNext = useCallback(() => {
    if (selectedIndex !== null) {
      setSelectedIndex((prev) => ((prev ?? 0) + 1) % photos.length)
      setZoom(1)
    }
  }, [selectedIndex, photos.length])

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(prev + 0.25, 3))
  }

  const handleZoomOut = () => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (selectedIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          closeLightbox()
          break
        case "ArrowLeft":
          goToPrevious()
          break
        case "ArrowRight":
          goToNext()
          break
        case "+":
        case "=":
          handleZoomIn()
          break
        case "-":
          handleZoomOut()
          break
        case "f":
        case "F":
          toggleFullscreen()
          break
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [selectedIndex, goToPrevious, goToNext])

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

  if (photos.length === 0) {
    return null
  }

  const thumbnailClasses = {
    sm: "h-20",
    md: "h-32",
    lg: "h-48",
  }

  const currentPhoto = selectedIndex !== null ? photos[selectedIndex] : null

  return (
    <>
      {!hideThumbnails && (
        <div className={cn("grid gap-2 sm:grid-cols-2 lg:grid-cols-3", className)}>
          {photos.map((photo, index) => (
          <Card
            key={photo.id}
            className="group relative cursor-pointer overflow-hidden border transition-all hover:shadow-lg"
            onClick={() => openLightbox(index)}
          >
            <div className={cn("relative w-full", thumbnailClasses[thumbnailSize])}>
              <Image
                src={photo.s3Url}
                alt={photo.caption || `Photo ${index + 1}`}
                fill
                className="object-cover transition-transform group-hover:scale-105"
              />
              {showCoverBadge && photo.isCover && (
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-xs font-semibold text-primary-foreground">
                  <Crown className="h-3 w-3" />
                  Cover
                </span>
              )}
              <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </div>
            {photo.caption && (
              <div className="px-2 py-1 text-xs text-muted-foreground line-clamp-1">
                {photo.caption}
              </div>
            )}
          </Card>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {selectedIndex !== null && currentPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={closeLightbox}
        >
          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 z-10 text-white hover:bg-white/20"
            onClick={closeLightbox}
          >
            <X className="h-6 w-6" />
          </Button>

          {/* Navigation buttons */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-4 z-10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  goToPrevious()
                }}
              >
                <ChevronLeft className="h-8 w-8" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-4 z-10 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  goToNext()
                }}
              >
                <ChevronRight className="h-8 w-8" />
              </Button>
            </>
          )}

          {/* Image container */}
          <div
            className="relative h-full w-full"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <div className="flex h-full items-center justify-center p-4">
              <div
                className="relative max-h-full max-w-full"
                style={{
                  transform: `scale(${zoom})`,
                  transition: "transform 0.2s",
                }}
              >
                <Image
                  src={currentPhoto.s3Url}
                  alt={currentPhoto.caption || `Photo ${selectedIndex + 1}`}
                  width={1920}
                  height={1080}
                  className="max-h-[90vh] max-w-full object-contain"
                  priority
                />
              </div>
            </div>

            {/* Controls */}
            <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/50 px-4 py-2 backdrop-blur-sm">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleZoomOut()
                }}
                disabled={zoom <= 0.5}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center text-sm text-white">
                {Math.round(zoom * 100)}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  handleZoomIn()
                }}
                disabled={zoom >= 3}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <div className="mx-2 h-4 w-px bg-white/30" />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation()
                  toggleFullscreen()
                }}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Photo info */}
            <div className="absolute bottom-4 left-4 z-10 rounded-lg bg-black/50 px-4 py-2 backdrop-blur-sm">
              <div className="text-sm text-white">
                {selectedIndex + 1} / {photos.length}
              </div>
              {currentPhoto.caption && (
                <div className="mt-1 text-xs text-white/80">{currentPhoto.caption}</div>
              )}
            </div>

            {/* Thumbnail strip */}
            {photos.length > 1 && (
              <div className="absolute bottom-24 left-1/2 z-10 flex max-w-[90vw] -translate-x-1/2 gap-2 overflow-x-auto px-4 pb-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedIndex(index)
                      setZoom(1)
                    }}
                    className={cn(
                      "relative h-16 w-16 flex-shrink-0 overflow-hidden rounded border-2 transition-all",
                      index === selectedIndex
                        ? "border-white scale-110 shadow-lg"
                        : "border-white/30 opacity-60 hover:opacity-100 hover:scale-105"
                    )}
                  >
                    <Image
                      src={photo.s3Url}
                      alt={`Thumbnail ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

