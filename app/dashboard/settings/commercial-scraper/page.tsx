"use client"

import { useState, useEffect } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
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
  Star,
  Building2,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"

// Same location list as residential settings
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
  { displayName: "Glasgow (G)", outcode: "550", slug: "glasgow", postcodes: "G1–G84", region: "Scotland" },
  { displayName: "Edinburgh (EH)", outcode: "475", slug: "edinburgh", postcodes: "EH1–EH55", region: "Scotland" },
  { displayName: "Cardiff (CF)", outcode: "289", slug: "cardiff", postcodes: "CF1–CF64", region: "South Wales", isPriority: true },
  { displayName: "Newport (NP)", outcode: "REGION^991", slug: "newport", postcodes: "NP1–NP25", region: "South Wales", isPriority: true },
  { displayName: "Swansea (SA)", outcode: "REGION^1305", slug: "swansea", postcodes: "SA1–SA9", region: "West Wales", isPriority: true },
  { displayName: "Southampton (SO)", outcode: "1372", slug: "southampton", postcodes: "SO14–SO53", region: "South East" },
  { displayName: "Portsmouth (PO)", outcode: "1167", slug: "portsmouth", postcodes: "PO1–PO41", region: "South East" },
  { displayName: "Reading (RG)", outcode: "1207", slug: "reading", postcodes: "RG1–RG45", region: "South East" },
  { displayName: "Milton Keynes (MK)", outcode: "942", slug: "milton-keynes", postcodes: "MK1–MK19", region: "South East" },
  { displayName: "Swindon (SN)", outcode: "1361", slug: "swindon", postcodes: "SN1–SN26", region: "South West" },
  { displayName: "Derby (DE)", outcode: "424", slug: "derby", postcodes: "DE1–DE75", region: "East Midlands" },
  { displayName: "Stoke-on-Trent (ST)", outcode: "1407", slug: "stoke-on-trent", postcodes: "ST1–ST21", region: "West Midlands" },
  { displayName: "Wolverhampton (WV)", outcode: "1631", slug: "wolverhampton", postcodes: "WV1–WV16", region: "West Midlands" },
]

// Commercial property types — replaces the residential bedroom-based types
const COMMERCIAL_PROPERTY_TYPES = [
  { value: "office",      label: "Office" },
  { value: "retail",      label: "Retail" },
  { value: "industrial",  label: "Industrial" },
  { value: "warehouse",   label: "Warehouse" },
  { value: "mixed-use",   label: "Mixed Use" },
  { value: "leisure",     label: "Leisure" },
  { value: "land",        label: "Land" },
  { value: "hotel",       label: "Hotel" },
  { value: "healthcare",  label: "Healthcare" },
]

interface LocationCriteria {
  outcode: string
  displayName: string
  slug?: string
}

interface SearchCriteria {
  category: "COMMERCIAL"
  locations: LocationCriteria[]
  minPrice?: number | null
  maxPrice?: number | null
  propertyTypes?: string[] | null
  addedSince?: "24hours" | "3days" | "7days" | "14days" | null
  includeSSTC?: boolean
  maxPages?: number | null
}

interface CommercialSettingsState {
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
  category: "COMMERCIAL",
  locations: [],
  minPrice: null,
  maxPrice: null,
  propertyTypes: null,
  addedSince: "24hours",
  includeSSTC: false,
  maxPages: 5,
}

const DEFAULT_SETTINGS: CommercialSettingsState = {
  enabled: false,
  scheduleType: "TWICE_DAILY",
  rightmoveEnabled: true,
  zooplaEnabled: true,
  onthemarketEnabled: true,
  primelocationEnabled: true,
  autoAnalysisEnabled: false,
  autoAnalysisThreshold: null,
  requireManualReview: true,
  requestDelay: 3000,
  maxConcurrent: 2,
  useProxy: false,
  proxyUrl: null,
  searchCriteria: DEFAULT_CRITERIA,
}

export default function CommercialScraperSettingsPage() {
  const [settings, setSettings] = useState<CommercialSettingsState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [locationSearch, setLocationSearch] = useState("")

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/scraper/settings/commercial")
      if (res.ok) {
        const data = await res.json()
        // Ensure category is always COMMERCIAL
        const s = data.settings as CommercialSettingsState
        if (s?.searchCriteria) s.searchCriteria.category = "COMMERCIAL"
        setSettings(s ?? DEFAULT_SETTINGS)
      } else {
        // No commercial settings row yet — use defaults
        setSettings(DEFAULT_SETTINGS)
      }
    } catch {
      setSettings(DEFAULT_SETTINGS)
    } finally {
      setIsLoading(false)
    }
  }

  const saveSettings = async () => {
    if (!settings) return
    setIsSaving(true)
    // Always force category = COMMERCIAL before saving
    const payload = {
      ...settings,
      searchCriteria: { ...criteria, category: "COMMERCIAL" },
    }
    try {
      const res = await fetch("/api/scraper/settings/commercial", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error("Failed to save settings")
      toast.success("Commercial settings saved")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setIsSaving(false)
    }
  }

  const updateSetting = <K extends keyof CommercialSettingsState>(
    key: K,
    value: CommercialSettingsState[K]
  ) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  const criteria: SearchCriteria = {
    ...(settings?.searchCriteria ?? DEFAULT_CRITERIA),
    category: "COMMERCIAL",
  }

  const updateCriteria = (updates: Partial<SearchCriteria>) => {
    const updated = { ...criteria, ...updates, category: "COMMERCIAL" as const }
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
    updateCriteria({ locations: criteria.locations.filter((l) => l.outcode !== outcode) })
  }

  const togglePropertyType = (type: string) => {
    const current = criteria.propertyTypes ?? []
    const updated = current.includes(type) ? current.filter((t) => t !== type) : [...current, type]
    updateCriteria({ propertyTypes: updated.length > 0 ? updated : null })
  }

  const filteredLocations = LOCATIONS.filter(
    (loc) =>
      loc.displayName.toLowerCase().includes(locationSearch.toLowerCase()) &&
      !criteria.locations.some((l) => l.outcode === loc.outcode)
  )

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Commercial Settings"
        subtitle="Configure commercial property scanning — offices, retail, industrial, warehouses"
        className="mb-6"
        actions={
          <Button className="btn-primary" onClick={saveSettings} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Settings
          </Button>
        }
      />

      {/* Category locked banner */}
      <div className="mb-5 flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        <Building2 className="h-4 w-4 flex-shrink-0" />
        <span>
          This scanner is locked to <strong>Commercial</strong> properties.
          All four portals hit their commercial-specific search URLs —
          Rightmove <code className="text-xs bg-amber-100 px-1 rounded">/commercial-property-for-sale/</code>,
          Zoopla <code className="text-xs bg-amber-100 px-1 rounded">/for-sale/commercial/property/</code>,
          OnTheMarket <code className="text-xs bg-amber-100 px-1 rounded">/for-sale/commercial-property/</code>,
          PrimeLocation <code className="text-xs bg-amber-100 px-1 rounded">/for-sale/commercial-property/</code>.
        </span>
      </div>

      <div className="max-w-4xl space-y-5">

        {/* Row 1: Control + Schedule | Sources */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Control &amp; Schedule
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enabled">Commercial scanner enabled</Label>
                <Switch
                  id="enabled"
                  checked={settings.enabled}
                  onCheckedChange={(v) => updateSetting("enabled", v)}
                />
              </div>
              <div className="border-t border-[var(--ds-border)]" />
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-gray-400" />
                  Schedule
                </Label>
                <Select
                  value={settings.scheduleType}
                  onValueChange={(v) => updateSetting("scheduleType", v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TWICE_DAILY">Twice daily (6 AM &amp; 6 PM)</SelectItem>
                    <SelectItem value="DAILY">Daily</SelectItem>
                    <SelectItem value="HOURLY">Hourly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Sources
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">All four portals support commercial listings</p>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                {[
                  { id: "rightmoveEnabled", label: "Rightmove" },
                  { id: "zooplaEnabled", label: "Zoopla" },
                  { id: "onthemarketEnabled", label: "OnTheMarket" },
                  { id: "primelocationEnabled", label: "PrimeLocation" },
                ].map(({ id, label }) => (
                  <div key={id} className="flex items-center justify-between">
                    <Label htmlFor={id} className="cursor-pointer">{label}</Label>
                    <Switch
                      id={id}
                      checked={(settings as any)[id]}
                      onCheckedChange={(v) => updateSetting(id as any, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Search Criteria */}
        <div className="ds-card overflow-hidden border-amber-200">
          <div className="px-5 py-4 border-b border-amber-200">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-amber-600" />
              Search Criteria
              <span className="ml-auto text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                COMMERCIAL
              </span>
            </h3>
          </div>
          <div className="p-5 space-y-5">

            {/* Locations */}
            <div className="space-y-2">
              <Label>Locations</Label>

              {criteria.locations.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {criteria.locations.map((loc) => {
                    const meta = LOCATIONS.find((l) => l.outcode === loc.outcode)
                    return (
                      <Badge
                        key={loc.outcode}
                        variant="secondary"
                        className={`pl-2 pr-1 py-1 gap-1 cursor-default ${
                          meta?.isPriority ? "border border-amber-400/50 bg-amber-50 text-amber-800" : ""
                        }`}
                      >
                        {meta?.isPriority && <Star className="h-3 w-3 fill-amber-500 text-amber-500" />}
                        {loc.displayName}
                        <button
                          onClick={() => removeLocation(loc.outcode)}
                          className="ml-1 rounded-full hover:bg-gray-100 p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    )
                  })}
                </div>
              )}

              {criteria.locations.length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  No locations selected. Add at least one location to enable scanning.
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
                  <div className="absolute z-10 top-full mt-1 w-full bg-white border border-[var(--ds-border)] rounded-md shadow-md max-h-56 overflow-y-auto">
                    {filteredLocations.map((loc) => (
                      <button
                        key={loc.outcode}
                        onClick={() => addLocation(loc)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          {loc.isPriority && <Star className="h-3 w-3 fill-amber-500 text-amber-500 flex-shrink-0" />}
                          <span className="font-medium">{loc.displayName}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">{loc.region} · {loc.postcodes.split(" ")[0]}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Added Since + Max Pages */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Added Since</Label>
                <Select
                  value={criteria.addedSince ?? "any"}
                  onValueChange={(v) =>
                    updateCriteria({ addedSince: v === "any" ? null : v as SearchCriteria["addedSince"] })
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                    type="number" min={1} max={42}
                    value={criteria.maxPages ?? ""}
                    onChange={(e) =>
                      updateCriteria({ maxPages: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-20"
                  />
                  <span className="text-xs text-gray-400">~24 per page</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Include Under Offer</Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <Switch
                    id="includeSSTC"
                    checked={criteria.includeSSTC ?? false}
                    onCheckedChange={(v) => updateCriteria({ includeSSTC: v })}
                  />
                  <Label htmlFor="includeSSTC" className="text-sm font-normal cursor-pointer text-gray-500">
                    Include under offer / SSTC
                  </Label>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Price Range */}
            <div className="space-y-1.5">
              <Label>Price Range</Label>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input
                    type="number" min={0} step={10000} placeholder="Min"
                    value={criteria.minPrice ?? ""}
                    onChange={(e) =>
                      updateCriteria({ minPrice: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-36 pl-6"
                  />
                </div>
                <span className="text-gray-400 text-sm">—</span>
                <div className="relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm">£</span>
                  <Input
                    type="number" min={0} step={10000} placeholder="Max"
                    value={criteria.maxPrice ?? ""}
                    onChange={(e) =>
                      updateCriteria({ maxPrice: e.target.value ? parseInt(e.target.value) : null })
                    }
                    className="w-36 pl-6"
                  />
                </div>
                <span className="text-xs text-gray-400">Typical SSAS range £100k–£500k</span>
              </div>
            </div>

            <div className="border-t border-[var(--ds-border)]" />

            {/* Commercial Property Types */}
            <div className="space-y-2">
              <Label>
                Property Types
                <span className="text-xs font-normal text-gray-400 ml-1">(leave blank for all)</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {COMMERCIAL_PROPERTY_TYPES.map((pt) => (
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
          </div>
        </div>

        {/* Row 3: Auto-Approve | Advanced */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Auto-Approve
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="autoAnalysis">Auto-approve high-scoring properties</Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Properties at or above the BMV threshold skip the review queue
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
                  <Label className="whitespace-nowrap text-sm text-gray-400">Auto-approve if BMV score ≥</Label>
                  <Input
                    type="number" min={0} max={100} placeholder="e.g. 60"
                    value={settings.autoAnalysisThreshold ?? ""}
                    onChange={(e) =>
                      updateSetting("autoAnalysisThreshold", e.target.value ? parseInt(e.target.value) : null)
                    }
                    className="w-24"
                  />
                  <span className="text-xs text-gray-400">/ 100</span>
                </div>
              )}
              <div className="border-t border-[var(--ds-border)]" />
              <div className="flex items-start justify-between gap-4">
                <div>
                  <Label htmlFor="manualReview">Require manual review</Label>
                  <p className="text-xs text-gray-400 mt-0.5">All listings go to review queue first</p>
                </div>
                <Switch
                  id="manualReview"
                  checked={settings.requireManualReview}
                  onCheckedChange={(v) => updateSetting("requireManualReview", v)}
                />
              </div>
            </div>
          </div>

          <div className="ds-card overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--ds-border)]">
              <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Advanced
              </h3>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap text-sm w-36">Request delay (ms)</Label>
                <Input
                  type="number" min={1000} max={30000} step={500}
                  value={settings.requestDelay}
                  onChange={(e) => updateSetting("requestDelay", parseInt(e.target.value) || 3000)}
                  className="w-28"
                />
              </div>
              <div className="flex items-center gap-3">
                <Label className="whitespace-nowrap text-sm w-36">Max concurrent</Label>
                <Input
                  type="number" min={1} max={10}
                  value={settings.maxConcurrent}
                  onChange={(e) => updateSetting("maxConcurrent", parseInt(e.target.value) || 2)}
                  className="w-20"
                />
              </div>
              <div className="border-t border-[var(--ds-border)]" />
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
                  type="url" placeholder="http://proxy:port"
                  value={settings.proxyUrl || ""}
                  onChange={(e) => updateSetting("proxyUrl", e.target.value || null)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
