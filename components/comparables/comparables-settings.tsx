"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Settings, Loader2, Info, RotateCcw } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

export interface ComparablesConfig {
  searchRadius: number
  maxResults: number
  maxAgeMonths: number
  bedroomTolerance: number
  includePropertyTypes: string[]
  minConfidenceScore: number
}

const DEFAULT_CONFIG: ComparablesConfig = {
  searchRadius: 3,
  maxResults: 5,
  maxAgeMonths: 12,
  bedroomTolerance: 1,
  includePropertyTypes: [],
  minConfidenceScore: 0.7,
}

interface ComparablesSettingsProps {
  trigger?: React.ReactNode
  onConfigChange?: (config: ComparablesConfig) => void
}

/**
 * ComparablesSettings Dialog
 * Allows users to configure comparable search preferences
 */
export function ComparablesSettings({ trigger, onConfigChange }: ComparablesSettingsProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [config, setConfig] = useState<ComparablesConfig>(DEFAULT_CONFIG)
  const [errors, setErrors] = useState<Partial<Record<keyof ComparablesConfig, string>>>({})

  // Fetch current config when dialog opens
  useEffect(() => {
    if (open) {
      fetchConfig()
    }
  }, [open])

  const fetchConfig = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/comparables/config")
      const data = await response.json()

      if (data.success) {
        setConfig(data.config)
      } else {
        throw new Error(data.error || "Failed to fetch config")
      }
    } catch (error: any) {
      toast.error("Failed to load settings", {
        description: error.message,
      })
    } finally {
      setIsLoading(false)
    }
  }

  const validateConfig = (): boolean => {
    const newErrors: Partial<Record<keyof ComparablesConfig, string>> = {}

    if (config.searchRadius < 0.25 || config.searchRadius > 10) {
      newErrors.searchRadius = "Search radius must be between 0.25 and 10 miles"
    }

    if (config.maxResults < 3 || config.maxResults > 20) {
      newErrors.maxResults = "Max results must be between 3 and 20"
    }

    if (config.maxAgeMonths < 6 || config.maxAgeMonths > 24) {
      newErrors.maxAgeMonths = "Max age must be between 6 and 24 months"
    }

    if (config.bedroomTolerance < 0 || config.bedroomTolerance > 2) {
      newErrors.bedroomTolerance = "Bedroom tolerance must be between 0 and 2"
    }

    if (config.minConfidenceScore < 0.5 || config.minConfidenceScore > 1) {
      newErrors.minConfidenceScore = "Min confidence must be between 0.5 and 1.0"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateConfig()) {
      toast.error("Validation Error", {
        description: "Please fix the errors before saving",
      })
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/comparables/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })

      const data = await response.json()

      if (data.success) {
        toast.success("Settings saved", {
          description: "Your comparables settings have been updated",
        })
        onConfigChange?.(data.config)
        setOpen(false)
      } else {
        throw new Error(data.error || "Failed to save settings")
      }
    } catch (error: any) {
      toast.error("Failed to save settings", {
        description: error.message,
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG)
    setErrors({})
    toast.info("Reset to defaults", {
      description: "Settings have been reset to default values",
    })
  }

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Comparables Search Settings</DialogTitle>
            <DialogDescription>
              Configure how comparable properties are searched and filtered
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-4">
              {/* Search Radius */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="searchRadius">Search Radius (miles)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Maximum distance from the property to search for comparables. Smaller radius = more accurate local data, but fewer results. Larger radius = more results, but less location-specific.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={config.searchRadius.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, searchRadius: parseFloat(value) })
                  }
                >
                  <SelectTrigger id="searchRadius">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.25">0.25 miles (Quarter mile)</SelectItem>
                    <SelectItem value="0.5">0.5 miles (Half mile)</SelectItem>
                    <SelectItem value="1">1 mile</SelectItem>
                    <SelectItem value="2">2 miles</SelectItem>
                    <SelectItem value="3">3 miles (Recommended)</SelectItem>
                    <SelectItem value="4">4 miles</SelectItem>
                    <SelectItem value="5">5 miles</SelectItem>
                    <SelectItem value="10">10 miles (Wide search)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.searchRadius && (
                  <p className="text-sm text-destructive">{errors.searchRadius}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Wider searches provide more data but may be less comparable to your specific location
                </p>
              </div>

              {/* Max Results */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxResults">Maximum Results</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Maximum number of comparable properties to fetch (3-20)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Input
                  id="maxResults"
                  type="number"
                  min={3}
                  max={20}
                  value={config.maxResults}
                  onChange={(e) =>
                    setConfig({ ...config, maxResults: parseInt(e.target.value) || 3 })
                  }
                />
                {errors.maxResults && (
                  <p className="text-sm text-destructive">{errors.maxResults}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  More results = better accuracy but higher API costs
                </p>
              </div>

              {/* Max Age */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="maxAgeMonths">Maximum Age (months)</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Only include properties sold within the last X months (6-24)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={config.maxAgeMonths.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, maxAgeMonths: parseInt(value) })
                  }
                >
                  <SelectTrigger id="maxAgeMonths">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">6 months (Most recent)</SelectItem>
                    <SelectItem value="12">12 months (Recommended)</SelectItem>
                    <SelectItem value="18">18 months</SelectItem>
                    <SelectItem value="24">24 months (More data)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.maxAgeMonths && (
                  <p className="text-sm text-destructive">{errors.maxAgeMonths}</p>
                )}
              </div>

              {/* Bedroom Tolerance */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="bedroomTolerance">Bedroom Tolerance</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Allow properties with ±X bedrooms (0-2). E.g., tolerance of 1 for a 3-bed property will include 2-4 bed properties
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={config.bedroomTolerance.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, bedroomTolerance: parseInt(value) })
                  }
                >
                  <SelectTrigger id="bedroomTolerance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Exact match only</SelectItem>
                    <SelectItem value="1">±1 bedroom (Recommended)</SelectItem>
                    <SelectItem value="2">±2 bedrooms</SelectItem>
                  </SelectContent>
                </Select>
                {errors.bedroomTolerance && (
                  <p className="text-sm text-destructive">{errors.bedroomTolerance}</p>
                )}
              </div>

              {/* Min Confidence Score */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="minConfidenceScore">Minimum Confidence Score</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">
                        Filter out comparables below this confidence threshold (0.5-1.0). Higher = more accurate but fewer results
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Select
                  value={config.minConfidenceScore.toString()}
                  onValueChange={(value) =>
                    setConfig({ ...config, minConfidenceScore: parseFloat(value) })
                  }
                >
                  <SelectTrigger id="minConfidenceScore">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.5">0.5 (Low - More results)</SelectItem>
                    <SelectItem value="0.6">0.6 (Medium-Low)</SelectItem>
                    <SelectItem value="0.7">0.7 (Recommended)</SelectItem>
                    <SelectItem value="0.8">0.8 (High)</SelectItem>
                    <SelectItem value="0.9">0.9 (Very High - Fewer results)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.minConfidenceScore && (
                  <p className="text-sm text-destructive">{errors.minConfidenceScore}</p>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">API Credit Usage</p>
                    <p>Each comparable search uses 2 credits (sold prices + rental data).</p>
                    <p>Searches are cached for 24 hours to minimize costs.</p>
                    <p className="pt-1">
                      <Badge variant="outline">
                        Estimated: ~{config.maxResults * 2} credits per property
                      </Badge>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between">
            <Button variant="outline" onClick={handleReset} disabled={isSaving || isLoading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Defaults
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || isLoading}>
                {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  )
}
