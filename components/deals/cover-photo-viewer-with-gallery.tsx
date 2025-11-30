"use client"

import { useState } from "react"
import { CoverPhotoViewer } from "./cover-photo-viewer"
import { PhotoGallery } from "./photo-gallery"
import type { Photo } from "./cover-photo-viewer"

interface CoverPhotoViewerWithGalleryProps {
  photos: Photo[]
}

export function CoverPhotoViewerWithGallery({ photos }: CoverPhotoViewerWithGalleryProps) {
  // Just show the cover photo viewer inline - no gallery mode
  return (
    <CoverPhotoViewer
      photos={photos}
      // Don't provide onPhotoClick - this keeps it inline
    />
  )
}

