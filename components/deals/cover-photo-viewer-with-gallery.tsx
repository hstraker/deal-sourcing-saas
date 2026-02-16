"use client"

import { useState } from "react"
import { CoverPhotoViewer } from "./cover-photo-viewer"
import { PhotoGallery } from "./photo-gallery"
import type { Photo } from "./cover-photo-viewer"

interface CoverPhotoViewerWithGalleryProps {
  photos: Photo[]
}

export function CoverPhotoViewerWithGallery({ photos }: CoverPhotoViewerWithGalleryProps) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)

  if (photos.length === 0) return null

  return (
    <>
      <CoverPhotoViewer
        photos={photos}
        onPhotoClick={() => setGalleryOpen(true)}
        onIndexChange={(index) => setCurrentIndex(index)}
      />
      {galleryOpen && (
        <PhotoGallery
          photos={photos}
          initialIndex={currentIndex}
          hideThumbnails={true}
          onClose={() => setGalleryOpen(false)}
        />
      )}
    </>
  )
}
