"use client"

import { useState, useEffect, createContext, useContext } from "react"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"

interface ToggleContextType {
  metricsVisible: boolean
  mapVisible: boolean
  toggleMetrics: () => void
  toggleMap: () => void
}

const ToggleContext = createContext<ToggleContextType | null>(null)

export function useToggleContext() {
  const context = useContext(ToggleContext)
  if (!context) {
    throw new Error("useToggleContext must be used within ToggleProvider")
  }
  return context
}

export function ToggleProvider({ children }: { children: React.ReactNode }) {
  const [metricsVisible, setMetricsVisible] = useState(true)
  const [mapVisible, setMapVisible] = useState(true)

  // Load preferences from localStorage
  useEffect(() => {
    const savedMetrics = localStorage.getItem("deal-metrics-visible")
    const savedMap = localStorage.getItem("deal-map-visible")
    
    if (savedMetrics !== null) {
      setMetricsVisible(savedMetrics === "true")
    }
    if (savedMap !== null) {
      setMapVisible(savedMap === "true")
    }
  }, [])

  const toggleMetrics = () => {
    const newValue = !metricsVisible
    setMetricsVisible(newValue)
    localStorage.setItem("deal-metrics-visible", String(newValue))
  }

  const toggleMap = () => {
    const newValue = !mapVisible
    setMapVisible(newValue)
    localStorage.setItem("deal-map-visible", String(newValue))
  }

  return (
    <ToggleContext.Provider value={{ metricsVisible, mapVisible, toggleMetrics, toggleMap }}>
      {children}
    </ToggleContext.Provider>
  )
}

export function ToggleButtons({ hasMap = true }: { hasMap?: boolean }) {
  const { metricsVisible, mapVisible, toggleMetrics, toggleMap } = useToggleContext()

  return (
    <div className="flex items-center gap-2 mb-4">
      <Button
        variant="outline"
        size="sm"
        onClick={toggleMetrics}
        className="gap-2"
      >
        {metricsVisible ? (
          <>
            <EyeOff className="h-4 w-4" />
            Hide Metrics
          </>
        ) : (
          <>
            <Eye className="h-4 w-4" />
            Show Metrics
          </>
        )}
      </Button>
      {hasMap && (
        <Button
          variant="outline"
          size="sm"
          onClick={toggleMap}
          className="gap-2"
        >
          {mapVisible ? (
            <>
              <EyeOff className="h-4 w-4" />
              Hide Map
            </>
          ) : (
            <>
              <Eye className="h-4 w-4" />
              Show Map
            </>
          )}
        </Button>
      )}
    </div>
  )
}

export function ToggleableMetrics({ children }: { children: React.ReactNode }) {
  const { metricsVisible } = useToggleContext()
  
  if (!metricsVisible) return null
  
  return <>{children}</>
}

export function ToggleableMap({ children }: { children: React.ReactNode }) {
  const { mapVisible } = useToggleContext()
  
  if (!mapVisible) return null
  
  return <>{children}</>
}

