"use client"

import { useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react"

export interface Photo {
  id: string
  s3Url: string
  caption?: string | null
  isCover?: boolean
}

interface CoverPhotoViewerProps {
  photos: Photo[]
  className?: string
  onPhotoClick?: () => void
  onIndexChange?: (index: number) => void
}

export function CoverPhotoViewer({
  photos,
  className,
  onPhotoClick,
  onIndexChange,
}: CoverPhotoViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(() => {
    // Start with cover photo if available, otherwise first photo
    const coverIndex = photos.findIndex((p) => p.isCover)
    return coverIndex >= 0 ? coverIndex : 0
  })

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = prev === 0 ? photos.length - 1 : prev - 1
      onIndexChange?.(newIndex)
      return newIndex
    })
  }, [photos.length, onIndexChange])

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const newIndex = prev === photos.length - 1 ? 0 : prev + 1
      onIndexChange?.(newIndex)
      return newIndex
    })
  }, [photos.length, onIndexChange])

  // Notify parent of index changes
  useEffect(() => {
    onIndexChange?.(currentIndex)
  }, [currentIndex, onIndexChange])

  // Keyboard navigation
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

  if (photos.length === 0) {
    return null
  }

  const currentPhoto = photos[currentIndex]
  // Get next photos for the side grid
  const nextPhoto1 = photos.length > 1 ? photos[(currentIndex + 1) % photos.length] : null
  const nextPhoto2 = photos.length > 2 ? photos[(currentIndex + 2) % photos.length] : null

  // If only 1 photo, show it full width
  if (photos.length === 1) {
    return (
      <Card className={cn("group relative overflow-hidden", className)}>
        <div className="relative aspect-square w-full">
          <Image
            src={currentPhoto.s3Url}
            alt={currentPhoto.caption || "Photo 1"}
            fill
            className="object-cover"
            priority
          />
        </div>
        {currentPhoto.caption && (
          <div className="px-4 py-2 text-sm text-muted-foreground">{currentPhoto.caption}</div>
        )}
      </Card>
    )
  }

  // If 2 photos, show main + 1 side
  if (photos.length === 2) {
    return (
      <Card className={cn("group relative overflow-hidden", className)}>
        <div className="grid grid-cols-3 gap-2">
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
            priority
            key={currentIndex}
          />

          {/* Navigation buttons on main photo */}
          {photos.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white transition-opacity hover:bg-black/60 z-10",
                  onPhotoClick ? "opacity-0 group-hover:opacity-100" : "opacity-80"
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  goToPrevious()
                }}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white transition-opacity hover:bg-black/60 z-10",
                  onPhotoClick ? "opacity-0 group-hover:opacity-100" : "opacity-80"
                )}
                onClick={(e) => {
                  e.stopPropagation()
                  goToNext()
                }}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}

          {/* Photo counter overlay */}
          {photos.length > 1 && (
            <div className="absolute top-4 left-4 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm z-10">
              <span className="text-sm font-medium text-white">
                {currentIndex + 1} / {photos.length}
              </span>
            </div>
          )}

          {/* Fullscreen button - only show if onPhotoClick is provided */}
          {onPhotoClick && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
              onClick={(e) => {
                e.stopPropagation()
                onPhotoClick()
              }}
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          )}
        </div>

          {/* Single side photo */}
          <div className="col-span-1">
            {nextPhoto1 && (
              <div
                className="relative aspect-square cursor-pointer overflow-hidden rounded transition-transform hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentIndex((currentIndex + 1) % photos.length)
                  onIndexChange?.((currentIndex + 1) % photos.length)
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
        {currentPhoto.caption && (
          <div className="px-4 py-2 text-sm text-muted-foreground">{currentPhoto.caption}</div>
        )}
      </Card>
    )
  }

  // 3+ photos - show full layout
  return (
    <Card className={cn("group relative overflow-hidden", className)}>
      <div className="grid grid-cols-3 gap-2">
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
            priority
            key={currentIndex}
          />

          {/* Navigation buttons on main photo */}
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 text-white transition-opacity hover:bg-black/60 z-10",
              onPhotoClick ? "opacity-0 group-hover:opacity-100" : "opacity-80"
            )}
            onClick={(e) => {
              e.stopPropagation()
              goToPrevious()
            }}
          >
            <ChevronLeft className="h-6 w-6" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 text-white transition-opacity hover:bg-black/60 z-10",
              onPhotoClick ? "opacity-0 group-hover:opacity-100" : "opacity-80"
            )}
            onClick={(e) => {
              e.stopPropagation()
              goToNext()
            }}
          >
            <ChevronRight className="h-6 w-6" />
          </Button>

          {/* Photo counter overlay */}
          <div className="absolute top-4 left-4 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur-sm z-10">
            <span className="text-sm font-medium text-white">
              {currentIndex + 1} / {photos.length}
            </span>
          </div>

          {/* Fullscreen button - only show if onPhotoClick is provided */}
          {onPhotoClick && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-4 top-4 bg-black/40 text-white opacity-0 transition-opacity hover:bg-black/60 group-hover:opacity-100 z-10"
              onClick={(e) => {
                e.stopPropagation()
                onPhotoClick()
              }}
            >
              <Maximize2 className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* Side photos grid - 2 smaller photos */}
        <div className="col-span-1 flex flex-col gap-2">
          {nextPhoto1 && (
            <div
              className="relative aspect-square cursor-pointer overflow-hidden rounded transition-transform hover:scale-105"
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex((currentIndex + 1) % photos.length)
                onIndexChange?.((currentIndex + 1) % photos.length)
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
                onIndexChange?.((currentIndex + 2) % photos.length)
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

      {/* Caption */}
      {currentPhoto.caption && (
        <div className="px-4 py-2 text-sm text-muted-foreground">{currentPhoto.caption}</div>
      )}
    </Card>
  )
}

