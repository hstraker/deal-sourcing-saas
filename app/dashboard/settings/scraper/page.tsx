"use client"

import { useState, useEffect } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Settings,
  Globe,
  Zap,
  Shield,
  Clock,
  Loader2,
  Save,
  MapPin,
  X,
  HelpCircle,
  Star,
  SearchCheck,
} from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { toast } from "sonner"

// Pre-configured UK locations (mirrored from lib/scrapers/constants.ts)
// isPriority = gets a boosted location score in the deal scoring algorithm (SA, CF, NP, LL)
const LOCATIONS: {
  displayName: string
  outcode: string
  slug: string
  postcodes: string
  region: string
  isPriority?: boolean
}[] = [
  { displayName: "Birmingham (B)", outcode: "2245", slug: "birmingham", postcodes: "B1–B99", region: "West Midlands" },
  { displayName: "London (E)", outcode: "87490", slug: "east-london", postcodes: "E1–E20", region: "London" },
  { displayName: "London (N)", outcode: "87498", slug: "north-london", postcodes: "N1–N22", region: "London" },
  { displayName: "London (NW)", outcode: "87499", slug: "north-west-london", postcodes: "NW1–NW11", region: "London" },
  { displayName: "London (SE)", outcode: "87502", slug: "south-east-london", postcodes: "SE1–SE28", region: "London" },
  { displayName: "London (SW)", outcode: "87504", slug: "south-west-london", postcodes: "SW1–SW20", region: "London" },
  { displayName: "London (W)", outcode: "87506", slug: "west-london", postcodes: "W1–W14", region: "London" },
  { displayName: "London (WC)", outcode: "87507", slug: "central-london", postcodes: "WC1–WC2", region: "London" },
  { displayName: "London (EC)", outcode: "87489", slug: "city-of-london", postcodes: "EC1–EC4", region: "London" },
  { displayName: "Manchester (M)", outcode: "904", slug: "manchester", postcodes: "M1–M90", region: "Greater Manchester" },
  { displayName: "Leeds (LS)", outcode: "787", slug: "leeds", postcodes: "LS1–LS29", region: "West Yorkshire" },
  { displayName: "Liverpool (L)", outcode: "791", slug: "liverpool", postcodes: "L1–L40", region: "Merseyside" },
  { displayName: "Sheffield (S)", outcode: "1335", slug: "sheffield", postcodes: "S1–S81", region: "South Yorkshire" },
  { displayName: "Bristol (BS)", outcode: "219", slug: "bristol", postcodes: "BS1–BS49", region: "South West" },
  { displayName: "Nottingham (NG)", outcode: "1024", slug: "nottingham", postcodes: "NG1–NG25", region: "East Midlands" },
  { displayName: "Leicester (LE)", outcode: "770", slug: "leicester", postcodes: "LE1–LE19", region: "East Midlands" },
  { displayName: "Coventry (CV)", outcode: "405", slug: "coventry", postcodes: "CV1–CV37", region: "West Midlands" },
  { displayName: "Bradford (BD)", outcode: "153", slug: "bradford", postcodes: "BD1–BD23", region: "West Yorkshire" },
  { displayName: "Newcastle (NE)", outcode: "1007", slug: "newcastle-upon-tyne", postcodes: "NE1–NE66", region: "North East" },
  { displayName: "Sunderland (SR)", outcode: "1440", slug: "sunderland", postcodes: "SR1–SR8", region: "North East" },
  { displayName: "Glasgow (G)", outcode: "550", slug: "glasgow", postcodes: "G1–G84", region: "Scotland" },
  { displayName: "Edinburgh (EH)", outcode: "475", slug: "edinburgh", postcodes: "EH1–EH55", region: "Scotland" },
  { displayName: "Cardiff (CF)", outcode: "289", slug: "cardiff", postcodes: "CF1–CF64", region: "South Wales", isPriority: true },
  { displayName: "Belfast (BT)", outcode: "233", slug: "belfast", postcodes: "BT1–BT94", region: "Northern Ireland" },
  { displayName: "Wolverhampton (WV)", outcode: "1631", slug: "wolverhampton", postcodes: "WV1–WV16", region: "West Midlands" },
  { displayName: "Derby (DE)", outcode: "424", slug: "derby", postcodes: "DE1–DE75", region: "East Midlands" },
  { displayName: "Stoke-on-Trent (ST)", outcode: "1407", slug: "stoke-on-trent", postcodes: "ST1–ST21", region: "West Midlands" },
  { displayName: "Southampton (SO)", outcode: "1372", slug: "southampton", postcodes: "SO14–SO53", region: "South East" },
  { displayName: "Portsmouth (PO)", outcode: "1167", slug: "portsmouth", postcodes: "PO1–PO41", region: "South East" },
  { displayName: "Plymouth (PL)", outcode: "1148", slug: "plymouth", postcodes: "PL1–PL35", region: "South West" },
  { displayName: "Reading (RG)", outcode: "1207", slug: "reading", postcodes: "RG1–RG45", region: "South East" },
  { displayName: "Milton Keynes (MK)", outcode: "942", slug: "milton-keynes", postcodes: "MK1–MK19", region: "South East" },
  { displayName: "Luton (LU)", outcode: "808", slug: "luton", postcodes: "LU1–LU7", region: "East of England" },
  { displayName: "Northampton (NN)", outcode: "1033", slug: "northampton", postcodes: "NN1–NN29", region: "East Midlands" },
  { displayName: "Newport (NP)", outcode: "REGION^991", slug: "newport", postcodes: "NP1–NP25 (Newport, Monmouthshire, Torfaen, Blaenau Gwent)", region: "South Wales", isPriority: true },
  { displayName: "Swansea (SA)", outcode: "REGION^1305", slug: "swansea", postcodes: "SA1–SA9 (Swansea City & surrounds)", region: "West Wales", isPriority: true },
  { displayName: "Swindon (SN)", outcode: "1361", slug: "swindon", postcodes: "SN1–SN26", region: "South West" },
]

const PROPERTY_TYPES = [
  { value: "terraced", label: "Terraced" },
  { value: "semi-detached", label: "Semi-Detached" },
  { value: "detached", label: "Detached" },
  { value: "flat", label: "Flat" },
  { value: "bungalow", label: "Bungalow" },
  { value: "land", label: "Land" },
]

interface LocationCriteria {
  outcode: string
  displayName: string
  slug?: string
}

interface SearchCriteria {
  category: "RESIDENTIAL" | "COMMERCIAL" | "BOTH"
  locations: LocationCriteria[]
  minPrice?: number | null
  maxPrice?: number | null
  minBedrooms?: number | null
  maxBedrooms?: number | null
  propertyTypes?: string[] | null
  addedSince?: "24hours" | "3days" | "7days" | "14days" | null
  includeSSTC?: boolean
  maxPages?: number | null
}

interface ScraperSettingsState {
  enabled: boolean
  scheduleType: string
  rightmoveEnabled: boolean
  zooplaEnabled: boolean
  onthemarketEnabled: boolean
  primelocationEnabled: boolean
  autoAnalysisEnabled: boolean
  autoAnalysisThreshold: number | null
  requireManualReview: boolean
  requestDelay: number
  maxConcurrent: number
  useProxy: boolean
  proxyUrl: string | null
  searchCriteria: SearchCriteria | null
}

const DEFAULT_CRITERIA: SearchCriteria = {
  category: "RESIDENTIAL",
  locations: [],
  minPrice: null,
  maxPrice: null,
  minBedrooms: null,
  maxBedrooms: null,
  propertyTypes: null,
  addedSince: "24hours",
  includeSSTC: false,
  maxPages: 5,
}

export default function ScraperSettingsPage() {
  const [settings, setSettings] = useState<ScraperSettingsState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")
  const [isFixingPostcodes, setIsFixingPostcodes] = useState(false)
  const [isDryRunning, setIsDryRunning] = useState(false)
  const [postcodeFixResult, setPostcodeFixResult] = useState<{
    totalProcessed: number
    totalCorrected: number
    propertyListings: { processed: number; corrected: number; failed: number }
    vendorLeads: { processed: number; corrected: number; failed: number }
    dryRun: boolean
  } | null>(null)

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/scraper/settings")
      if (!res.ok) throw new Error("Failed to load settings")
      const data = await res.json()
      setSettings(data.settings)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/scraper/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      toast.success("Settings saved")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = <K extends keyof ScraperSettingsState>(
    key: K,
    value: ScraperSettingsState[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const criteria = settings?.searchCriteria ?? DEFAULT_CRITERIA

  const updateCriteria = (updates: Partial<SearchCriteria>) => {
    const updated = { ...criteria, ...updates }
    updateSetting("searchCriteria", updated)
  }

  const addLocation = (loc: typeof LOCATIONS[number]) => {
    if (criteria.locations.some((l) => l.outcode === loc.outcode)) return
    updateCriteria({
      locations: [
        ...criteria.locations,
        { outcode: loc.outcode, displayName: loc.displayName, slug: loc.slug },
      ],
    })
    setLocationSearch("")
  }

  const removeLocation = (outcode: string) => {
    updateCriteria({
      locations: criteria.locations.filter((l) => l.outcode !== outcode),
    })
  }

  const togglePropertyType = (type: string) => {
    const current = criteria.propertyTypes ?? []
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type]
    updateCriteria({ propertyTypes: updated.length > 0 ? updated : null })
  }

  const filteredLocations = LOCATIONS.filter(
    (loc) =>
      loc.displayName.toLowerCase().includes(locationSearch.toLowerCase()) &&
      !criteria.locations.some((l) => l.outcode === loc.outcode)
  )

  const runPostcodeFix = async (dryRun: boolean) => {
    if (!dryRun && !confirm("This will update postcodes for all scraped properties and vendor leads with missing or incorrect postcodes. Continue?")) {
      return
    }
    if (dryRun) setIsDryRunning(true)
    else setIsFixingPostcodes(true)
    setPostcodeFixResult(null)
    try {
      const res = await fetch("/api/admin/fix-postcodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? "Postcode fix failed")
        return
      }
      setPostcodeFixResult({ ...data.summary, dryRun: data.dryRun })
      toast.success(
        dryRun
          ? `Dry run: ${data.summary?.totalCorrected ?? 0} of ${data.summary?.totalProcessed ?? 0} records would be corrected`
          : `Fixed ${data.summary?.totalCorrected ?? 0} of ${data.summary?.totalProcessed ?? 0} records`
      )
    } catch {
      toast.error("Postcode fix failed")
    } finally {
      if (dryRun) setIsDryRunning(false)
      else setIsFixingPostcodes(false)
    }
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scraper Settings</h1>
          <p className="text-muted-foreground">Configure property scraping behaviour</p>
        </div>
        <Button onClick={saveSettings} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save Settings
        </Button>
      </div>

      <div className="max-w-4xl space-y-5">

        {/* Row 1: Control + Schedule | Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Control & Schedule */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Control & Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Scraper enabled</Label>
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(v) => updateSetting("enabled", v)}
                />
              </div>
              <Separator />
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  Schedule
                </Label>
                <Select
                  value={settings.scheduleType}
                  onValueChange={(v) => updateSetting("scheduleType", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TWICE_DAILY">Twice daily (6 AM &amp; 6 PM)</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Sources */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Sources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rightmove" className="cursor-pointer">Rightmove</Label>
                  <Switch
                    id="rightmove"
                    checked={settings.rightmoveEnabled}
                    onCheckedChange={(v) => updateSetting("rightmoveEnabled", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="zoopla" className="cursor-pointer">Zoopla</Label>
                  <Switch
                    id="zoopla"
                    checked={settings.zooplaEnabled}
                    onCheckedChange={(v) => updateSetting("zooplaEnabled", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="onthemarket" className="cursor-pointer">OnTheMarket</Label>
                  <Switch
                    id="onthemarket"
                    checked={settings.onthemarketEnabled}
                    onCheckedChange={(v) => updateSetting("onthemarketEnabled", v)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="primelocation" className="cursor-pointer">PrimeLocation</Label>
                  <Switch
                    id="primelocation"
                    checked={settings.primelocationEnabled}
                    onCheckedChange={(v) => updateSetting("primelocationEnabled", v)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Row 2: Search Criteria (full width) */}
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-green-600" />
              Search Criteria
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Locations */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Locations</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="right" className="max-w-xs text-xs">
                      <p className="font-semibold mb-1">Priority Scoring Areas</p>
                      <p className="mb-1">
                        Locations marked <span className="text-yellow-500">★</span> are priority investment areas
                        in the deal scoring algorithm — they receive a higher location score (95/100 vs 55/100
                        for other areas).
                      </p>
                      <p className="font-medium">Current priority areas: SA, CF, NP, LL</p>
                      <p className="text-muted-foreground mt-1">
                        Hover over any selected location badge to see the postcode districts it covers.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {criteria.locations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {criteria.locations.map((loc) => {
                    const meta = LOCATIONS.find((l) => l.outcode === loc.outcode)
                    return (
                      <TooltipProvider key={loc.outcode}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={`pl-2 pr-1 py-1 gap-1 cursor-default ${
                                meta?.isPriority ? "border border-yellow-400/50 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-800 dark:text-yellow-300" : ""
                              }`}
                            >
                              {meta?.isPriority && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />}
                              {loc.displayName}
                              <button
                                onClick={() => removeLocation(loc.outcode)}
                                className="ml-1 rounded-full hover:bg-muted p-0.5"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </Badge>
                          </TooltipTrigger>
                          {meta && (
                            <TooltipContent side="bottom" className="text-xs max-w-[260px]">
                              <p className="font-semibold">{meta.displayName}</p>
                              <p className="text-muted-foreground">{meta.region}</p>
                              <p className="mt-1">
                                <span className="font-medium">Postcodes: </span>
                                {meta.postcodes}
                              </p>
                              {meta.isPriority && (
                                <p className="mt-1 text-yellow-600 dark:text-yellow-400 font-medium">
                                  ★ Priority scoring area — boosted location score
                                </p>
                              )}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                </div>
              )}

              {criteria.locations.length === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5">
                  No locations selected. Add at least one location to enable scraping.
                </p>
              )}

              <div className="relative">
                <Input
                  placeholder="Search locations to add..."
                  value={locationSearch}
                  onChange={(e) => setLocationSearch(e.target.value)}
                  className="text-sm"
                />
                {locationSearch && filteredLocations.length > 0 && (
                  <div className="absolute z-10 top-full mt-1 w-full bg-popover border rounded-md shadow-md max-h-56 overflow-y-auto">
                    {filteredLocations.map((loc) => (
                      <button
                        key={loc.outcode}
                        onClick={() => addLocation(loc)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {loc.isPriority && <Star className="h-3 w-3 fill-yellow-500 text-yellow-500 flex-shrink-0" />}
                          <span className="font-medium">{loc.displayName}</span>
                        </div>
                        <div className="text-xs text-muted-foreground flex gap-2 mt-0.5 ml-0">
                          <span>{loc.region}</span>
                          <span>·</span>
                          <span>{loc.postcodes.split(" ")[0]}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Category + Added Since + Include SSTC in one row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select
                  value={criteria.category}
                  onValueChange={(v) => updateCriteria({ category: v as SearchCriteria["category"] })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                    <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                    <SelectItem value="BOTH">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Added Since</Label>
                <Select
                  value={criteria.addedSince ?? "any"}
                  onValueChange={(v) =>
                    updateCriteria({ addedSince: v === "any" ? null : v as SearchCriteria["addedSince"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Any time</SelectItem>
                    <SelectItem value="24hours">Last 24 hours</SelectItem>
                    <SelectItem value="3days">Last 3 days</SelectItem>
                    <SelectItem value="7days">Last 7 days</SelectItem>
                    <SelectItem value="14days">Last 14 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Max Pages / Location</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={42}
                    value={criteria.maxPages ?? ""}
                    onChange={(e) =>
                      updateCriteria({ maxPages: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-muted-foreground">~24 per page</span>
                </div>
              </div>
            </div>

            <Separator />

            {/* Price + Bedrooms in one row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Price Range</Label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                    <Input
                      type="number"
                      min={0}
                      step={5000}
                      placeholder="Min"
                      value={criteria.minPrice ?? ""}
                      onChange={(e) =>
                        updateCriteria({ minPrice: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="w-32 pl-6"
                    />
                  </div>
                  <span className="text-muted-foreground text-sm">—</span>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">£</span>
                    <Input
                      type="number"
                      min={0}
                      step={5000}
                      placeholder="Max"
                      value={criteria.maxPrice ?? ""}
                      onChange={(e) =>
                        updateCriteria({ maxPrice: e.target.value ? parseInt(e.target.value) : null })
                      }
                      className="w-32 pl-6"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Bedrooms</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="Min"
                    value={criteria.minBedrooms ?? ""}
                    onChange={(e) =>
                      updateCriteria({ minBedrooms: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-20"
                  />
                  <span className="text-muted-foreground text-sm">—</span>
                  <Input
                    type="number"
                    min={0}
                    max={10}
                    placeholder="Max"
                    value={criteria.maxBedrooms ?? ""}
                    onChange={(e) =>
                      updateCriteria({ maxBedrooms: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-20"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Property Types + Include SSTC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Property Types <span className="text-xs font-normal text-muted-foreground">(leave blank for all)</span></Label>
                <div className="grid grid-cols-3 gap-2">
                  {PROPERTY_TYPES.map((pt) => (
                    <div key={pt.value} className="flex items-center gap-2">
                      <Checkbox
                        id={`pt-${pt.value}`}
                        checked={(criteria.propertyTypes ?? []).includes(pt.value)}
                        onCheckedChange={() => togglePropertyType(pt.value)}
                      />
                      <Label htmlFor={`pt-${pt.value}`} className="text-sm font-normal cursor-pointer">
                        {pt.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Other</Label>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="includeSSTC" className="text-sm font-normal cursor-pointer">Include SSTC</Label>
                    <p className="text-xs text-muted-foreground">Include Sold Subject To Contract</p>
                  </div>
                  <Switch
                    id="includeSSTC"
                    checked={criteria.includeSSTC ?? false}
                    onCheckedChange={(v) => updateCriteria({ includeSSTC: v })}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Row 3: Analysis | Advanced | Data Quality */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Auto-Approve */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Approve
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="autoAnalysis">Auto-approve high-scoring properties</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Properties scoring at or above the threshold skip the review queue (unless flagged as ambiguous)
                  </p>
                </div>
                <Switch
                  id="autoAnalysis"
                  checked={settings.autoAnalysisEnabled}
                  onCheckedChange={(v) => updateSetting("autoAnalysisEnabled", v)}
                />
              </div>
              {settings.autoAnalysisEnabled && (
                <div className="flex items-center gap-3">
                  <Label htmlFor="threshold" className="whitespace-nowrap text-sm text-muted-foreground">
                    Auto-approve if BMV score ≥
                  </Label>
                  <Input
                    id="threshold"
                    type="number"
                    min={0}
                    max={100}
                    placeholder="e.g. 60"
                    value={settings.autoAnalysisThreshold ?? ""}
                    onChange={(e) =>
                      updateSetting("autoAnalysisThreshold", e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-muted-foreground">/ 100</span>
                </div>
              )}
              <Separator />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="manualReview">Require manual review</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    All properties go to the review queue — unless the score threshold above is met
                  </p>
                </div>
                <Switch
                  id="manualReview"
                  checked={settings.requireManualReview}
                  onCheckedChange={(v) => updateSetting("requireManualReview", v)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Advanced: Rate Limiting + Proxy */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Advanced
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Label htmlFor="requestDelay" className="whitespace-nowrap text-sm w-36">
                  Request delay (ms)
                </Label>
                <Input
                  id="requestDelay"
                  type="number"
                  min={1000}
                  max={30000}
                  step={500}
                  value={settings.requestDelay}
                  onChange={(e) =>
                    updateSetting("requestDelay", parseInt(e.target.value) || 3000)
                  }
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label htmlFor="maxConcurrent" className="whitespace-nowrap text-sm w-36">
                  Max concurrent
                </Label>
                <Input
                  id="maxConcurrent"
                  type="number"
                  min={1}
                  max={10}
                  value={settings.maxConcurrent}
                  onChange={(e) =>
                    updateSetting("maxConcurrent", parseInt(e.target.value) || 2)
                  }
                  className="w-20"
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <Label htmlFor="useProxy">Enable proxy</Label>
                <Switch
                  id="useProxy"
                  checked={settings.useProxy}
                  onCheckedChange={(v) => updateSetting("useProxy", v)}
                />
              </div>
              {settings.useProxy && (
                <Input
                  id="proxyUrl"
                  type="url"
                  placeholder="http://proxy:port"
                  value={settings.proxyUrl || ""}
                  onChange={(e) => updateSetting("proxyUrl", e.target.value || null)}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data Quality: Postcode Repair */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <SearchCheck className="h-4 w-4" />
              Postcode Repair
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Cross-checks all scraped property listings and vendor leads against Land Registry data to
              validate and fill in missing or incorrect postcodes. Uses a 3-step process: stored postcode
              validation → Land Registry street lookup → postcodes.io fallback.
            </p>

            {postcodeFixResult && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-2">
                <p className="font-medium">
                  {postcodeFixResult.dryRun ? "Dry run complete — no changes saved" : "Postcode repair complete"}
                </p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                  <span>Scraped properties scanned:</span>
                  <span className="font-medium text-foreground">{postcodeFixResult.propertyListings.processed}</span>
                  <span>Scraped properties corrected:</span>
                  <span className="font-medium text-green-600">{postcodeFixResult.propertyListings.corrected}</span>
                  <span>Vendor leads scanned:</span>
                  <span className="font-medium text-foreground">{postcodeFixResult.vendorLeads.processed}</span>
                  <span>Vendor leads corrected:</span>
                  <span className="font-medium text-green-600">{postcodeFixResult.vendorLeads.corrected}</span>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => runPostcodeFix(true)}
                disabled={isDryRunning || isFixingPostcodes}
              >
                {isDryRunning ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SearchCheck className="mr-2 h-4 w-4" />
                )}
                Dry Run
              </Button>
              <Button
                size="sm"
                onClick={() => runPostcodeFix(false)}
                disabled={isDryRunning || isFixingPostcodes}
              >
                {isFixingPostcodes ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <SearchCheck className="mr-2 h-4 w-4" />
                )}
                Fix Postcodes
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
