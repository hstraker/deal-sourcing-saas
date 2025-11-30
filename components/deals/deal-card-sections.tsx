"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"

interface DealCardSectionsProps {
  dealId: string
  children: {
    metrics?: React.ReactNode
    map?: React.ReactNode | null
  }
}

export function DealCardSections({ dealId, children }: DealCardSectionsProps) {
  const [metricsVisible, setMetricsVisible] = useState(true)
  const [mapVisible, setMapVisible] = useState(true)

  // Load preferences from localStorage for this specific deal
  useEffect(() => {
    const savedMetrics = localStorage.getItem(`deal-card-${dealId}-metrics-visible`)
    const savedMap = localStorage.getItem(`deal-card-${dealId}-map-visible`)
    
    if (savedMetrics !== null) {
      setMetricsVisible(savedMetrics === "true")
    }
    if (savedMap !== null) {
      setMapVisible(savedMap === "true")
    }
  }, [dealId])

  const handleMetricsToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !metricsVisible
    setMetricsVisible(newValue)
    localStorage.setItem(`deal-card-${dealId}-metrics-visible`, String(newValue))
  }

  const handleMapToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !mapVisible
    setMapVisible(newValue)
    localStorage.setItem(`deal-card-${dealId}-map-visible`, String(newValue))
  }

  return (
    <>
      {/* Toggle Buttons */}
      <div className="flex items-center gap-1 pt-2 border-t" onClick={(e) => e.stopPropagation()}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleMetricsToggle}
          className="h-6 px-2 text-[10px] gap-1"
        >
          {metricsVisible ? (
            <>
              <EyeOff className="h-3 w-3" />
              Hide Metrics
            </>
          ) : (
            <>
              <Eye className="h-3 w-3" />
              Show Metrics
            </>
          )}
        </Button>
        {children.map && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMapToggle}
            className="h-6 px-2 text-[10px] gap-1"
          >
            {mapVisible ? (
              <>
                <EyeOff className="h-3 w-3" />
                Hide Map
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" />
                Show Map
              </>
            )}
          </Button>
        )}
      </div>

      {/* Investment Metrics */}
      {metricsVisible && children.metrics}

      {/* Map */}
      {mapVisible && children.map}
    </>
  )
}

