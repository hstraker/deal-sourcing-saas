"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Calculator,
  TrendingDown,
  Settings2,
  Target,
  ShieldCheck,
  Loader2,
  Save,
  Info,
  HelpCircle,
  Home,
  Wrench,
  RefreshCw,
  Building,
  CheckCircle2,
  Play,
  Building2,
  FileText,
} from "lucide-react"
import { toast } from "sonner"
import { buildTestUnderwritingInput } from "@/lib/engine/test-defaults"

const ALL_STRATEGIES = ["BTL", "BuyHold", "Flip", "BRR"] as const
type Strategy = (typeof ALL_STRATEGIES)[number]

const STRATEGY_LABELS: Record<Strategy, string> = {
  BTL: "BTL (Buy to Let)",
  BuyHold: "Buy & Hold",
  Flip: "Flip",
  BRR: "BRR (Buy, Refurb, Refinance)",
}

const STRATEGY_ICONS: Record<Strategy, React.ReactNode> = {
  BTL: <Building className="h-3.5 w-3.5" />,
  BuyHold: <Home className="h-3.5 w-3.5" />,
  Flip: <TrendingDown className="h-3.5 w-3.5" />,
  BRR: <Wrench className="h-3.5 w-3.5" />,
}

interface ConfigState {
  enableStrategyMode: boolean
  activeStrategies: string[]
  defaultStrategy: string
  minDiscountFromAsking: number
  baseDiscountMin: number
  baseDiscountMax: number
  poorConditionDiscount: number
  avgConditionDiscount: number
  leaseholdDiscount: number
  longChainDiscount: number
  shortChainDiscount: number
  highDemandThreshold: number
  highDemandReduction: number
  flipMarketValuePct: number
  brrLtvPercent: number
  buyHoldMinYield: number
  btlMinYield: number
  minBmvPercentage: number
  minProfitPotential: number
}

const DEFAULT_CONFIG: ConfigState = {
  enableStrategyMode: false,
  activeStrategies: ["BuyHold", "BTL"],
  defaultStrategy: "BuyHold",
  minDiscountFromAsking: 5,
  baseDiscountMin: 10,
  baseDiscountMax: 40,
  poorConditionDiscount: 10,
  avgConditionDiscount: 3,
  leaseholdDiscount: 5,
  longChainDiscount: 5,
  shortChainDiscount: 2,
  highDemandThreshold: 8,
  highDemandReduction: 5,
  flipMarketValuePct: 70,
  brrLtvPercent: 75,
  buyHoldMinYield: 8,
  btlMinYield: 7,
  minBmvPercentage: 15,
  minProfitPotential: 10000,
}

function toNumber(v: unknown): number {
  const n = typeof v === "string" ? parseFloat(v) : Number(v)
  return isNaN(n) ? 0 : n
}

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-gray-400 cursor-help inline ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[260px] text-xs">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function PctInput({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 0.5,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div className="relative w-24">
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(toNumber(e.target.value))}
        className="pr-7 text-sm h-8"
      />
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
        %
      </span>
    </div>
  )
}

type TestSource = "vendor" | "listing"

interface VendorLeadOption {
  id: string
  vendorName: string
  propertyAddress: string | null
  askingPrice: number | null
}

interface ListingOption {
  id: string
  title: string
  price: number
  address?: { displayAddress?: string }
  propertyDataAnalysis?: { marketValue?: number; estimatedMonthlyRent?: number; refurbCost?: number } | null
}

interface ScreeningResult {
  passesScreening: boolean
  discountPercent: number
  grossYield: number
  basicROI: number
  quickScore: number
}

interface StrategyResult {
  strategy: string
  metrics: Record<string, number>
  maxAllowableOffer: number
  pass: boolean
  score: number
}

interface CapitalAllocationResult {
  recommendedStrategy: string
  finalMaxOffer: number
  strategies: StrategyResult[]
  institutionalScore: number
}

export function OfferCalculatorSettings() {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

  // Test workflow state
  const [testSource, setTestSource] = useState<TestSource>("vendor")
  const [vendorLeads, setVendorLeads] = useState<VendorLeadOption[]>([])
  const [listings, setListings] = useState<ListingOption[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>("")
  const [selectedListing, setSelectedListing] = useState<ListingOption | null>(null)
  const [selectedVendorFull, setSelectedVendorFull] = useState<{
    askingPrice: number
    estimatedMarketValue: number | null
    estimatedRefurbCost: number | null
    estimatedMonthlyRent: number | null
    estimatedAnnualRent: number | null
  } | null>(null)
  const [screeningResult, setScreeningResult] = useState<ScreeningResult | null>(null)
  const [allocationResult, setAllocationResult] = useState<CapitalAllocationResult | null>(null)
  /** Listing/asking price used for the last allocation run — used to cap displayed "recommended offer" at list price. */
  const [allocationAskingPrice, setAllocationAskingPrice] = useState<number | null>(null)
  const [loadingScreening, setLoadingScreening] = useState(false)
  const [loadingAllocation, setLoadingAllocation] = useState(false)
  const [activeTab, setActiveTab] = useState("configuration")

  const fetchConfig = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch("/api/settings/offer-calculator")
      if (res.ok) {
        const data = await res.json()
        if (data.config) {
          // Convert Prisma Decimal strings to numbers
          const c = data.config
          setConfig({
            enableStrategyMode:    Boolean(c.enableStrategyMode),
            activeStrategies:      Array.isArray(c.activeStrategies) ? c.activeStrategies : DEFAULT_CONFIG.activeStrategies,
            defaultStrategy:       c.defaultStrategy ?? DEFAULT_CONFIG.defaultStrategy,
            minDiscountFromAsking: c.minDiscountFromAsking != null ? toNumber(c.minDiscountFromAsking) : DEFAULT_CONFIG.minDiscountFromAsking,
            baseDiscountMin:       toNumber(c.baseDiscountMin),
            baseDiscountMax:       toNumber(c.baseDiscountMax),
            poorConditionDiscount: toNumber(c.poorConditionDiscount),
            avgConditionDiscount:  toNumber(c.avgConditionDiscount),
            leaseholdDiscount:     toNumber(c.leaseholdDiscount),
            longChainDiscount:     toNumber(c.longChainDiscount),
            shortChainDiscount:    toNumber(c.shortChainDiscount),
            highDemandThreshold:   toNumber(c.highDemandThreshold),
            highDemandReduction:   toNumber(c.highDemandReduction),
            flipMarketValuePct:    toNumber(c.flipMarketValuePct),
            brrLtvPercent:         toNumber(c.brrLtvPercent),
            buyHoldMinYield:       toNumber(c.buyHoldMinYield),
            btlMinYield:           toNumber(c.btlMinYield),
            minBmvPercentage:      toNumber(c.minBmvPercentage),
            minProfitPotential:    toNumber(c.minProfitPotential),
          })
        }
      }
    } catch (err) {
      console.error("[OfferCalculatorSettings] fetch failed:", err)
      toast.error("Failed to load calculator settings")
    } finally {
      setIsLoading(false)
      setIsDirty(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  // Fetch vendor leads and listings for test workflow
  const fetchTestOptions = useCallback(async () => {
    try {
      const [leadsRes, listRes] = await Promise.all([
        fetch("/api/vendor-pipeline/leads?limit=100"),
        fetch("/api/properties/listings?limit=100"),
      ])
      if (leadsRes.ok) {
        const data = await leadsRes.json()
        const leads = (data.leads ?? data ?? []).map((l: any) => ({
          id: l.id,
          vendorName: l.vendorName ?? "—",
          propertyAddress: l.propertyAddress ?? null,
          askingPrice: l.askingPrice != null ? Number(l.askingPrice) : null,
        }))
        setVendorLeads(leads)
      }
      if (listRes.ok) {
        const data = await listRes.json()
        const items = (data.listings ?? data?.listings ?? []).map((l: any) => ({
          id: l.id,
          title: l.title ?? l.address?.displayAddress ?? "—",
          price: typeof l.price === "number" ? l.price : Number(l.price) || 0,
          address: l.address,
          propertyDataAnalysis: l.propertyDataAnalysis ?? null,
        }))
        setListings(items)
      }
    } catch (e) {
      console.error("[Test workflow] fetch options:", e)
    }
  }, [])

  // Only fetch vendor leads and listings when user opens the Test workflow tab (avoids slow load on settings page)
  useEffect(() => {
    if (activeTab === "test") fetchTestOptions()
  }, [activeTab, fetchTestOptions])

  const loadVendorFull = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/vendor-leads/${id}`)
      if (!res.ok) return
      const lead = await res.json()
      setSelectedVendorFull({
        askingPrice: lead.askingPrice != null ? Number(lead.askingPrice) : 0,
        estimatedMarketValue: lead.estimatedMarketValue != null ? Number(lead.estimatedMarketValue) : null,
        estimatedRefurbCost: lead.estimatedRefurbCost != null ? Number(lead.estimatedRefurbCost) : null,
        estimatedMonthlyRent: lead.estimatedMonthlyRent != null ? Number(lead.estimatedMonthlyRent) : null,
        estimatedAnnualRent: lead.estimatedAnnualRent != null ? Number(lead.estimatedAnnualRent) : null,
      })
    } catch (e) {
      console.error("[Test workflow] load vendor:", e)
      setSelectedVendorFull(null)
    }
  }, [])

  useEffect(() => {
    if (testSource === "vendor" && selectedVendorId) loadVendorFull(selectedVendorId)
    else setSelectedVendorFull(null)
  }, [testSource, selectedVendorId, loadVendorFull])

  const runScreening = useCallback(async () => {
    let askingPrice: number
    let marketValue: number
    let monthlyRent: number
    let refurbCost: number

    if (testSource === "vendor") {
      if (!selectedVendorFull?.askingPrice) {
        toast.error("Select a vendor lead with an asking price")
        return
      }
      askingPrice = selectedVendorFull.askingPrice
      marketValue = selectedVendorFull.estimatedMarketValue ?? askingPrice * 1.1
      monthlyRent = selectedVendorFull.estimatedMonthlyRent ?? (selectedVendorFull.estimatedAnnualRent ?? 0) / 12
      refurbCost = selectedVendorFull.estimatedRefurbCost ?? 0
    } else {
      if (!selectedListing?.price) {
        toast.error("Select a scraped listing with a price")
        return
      }
      askingPrice = selectedListing.price
      marketValue = selectedListing.propertyDataAnalysis?.marketValue ?? selectedListing.price * 1.15
      monthlyRent = selectedListing.propertyDataAnalysis?.estimatedMonthlyRent ?? 0
      refurbCost = selectedListing.propertyDataAnalysis?.refurbCost ?? 0
    }

    setLoadingScreening(true)
    setScreeningResult(null)
    setAllocationResult(null)
    setAllocationAskingPrice(null)
    try {
      const res = await fetch("/api/underwriting/screening", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ askingPrice, marketValue, monthlyRent, refurbCost }),
      })
      if (!res.ok) throw new Error("Screening failed")
      const result = await res.json()
      setScreeningResult(result)
      if (result.passesScreening) {
        toast.success("Screening passed — run Capital Allocator for full decision")
      } else {
        toast.info("Screening did not pass — adjust deal or criteria")
      }
    } catch (e: any) {
      toast.error(e.message ?? "Screening failed")
    } finally {
      setLoadingScreening(false)
    }
  }, [testSource, selectedVendorFull, selectedListing])

  const runCapitalAllocator = useCallback(async () => {
    if (!screeningResult?.passesScreening) {
      toast.error("Run screening first and ensure it passes")
      return
    }
    let askingPrice: number
    let marketValue: number
    let monthlyRent: number
    let refurbCost: number

    if (testSource === "vendor") {
      if (!selectedVendorFull?.askingPrice) return
      askingPrice = selectedVendorFull.askingPrice
      marketValue = selectedVendorFull.estimatedMarketValue ?? askingPrice * 1.1
      monthlyRent = selectedVendorFull.estimatedMonthlyRent ?? (selectedVendorFull.estimatedAnnualRent ?? 0) / 12
      refurbCost = selectedVendorFull.estimatedRefurbCost ?? 0
    } else {
      if (!selectedListing?.price) return
      askingPrice = selectedListing.price
      marketValue = selectedListing.propertyDataAnalysis?.marketValue ?? selectedListing.price * 1.15
      monthlyRent = selectedListing.propertyDataAnalysis?.estimatedMonthlyRent ?? 0
      refurbCost = selectedListing.propertyDataAnalysis?.refurbCost ?? 0
    }

    setLoadingAllocation(true)
    setAllocationResult(null)
    setAllocationAskingPrice(null)
    try {
      const input = buildTestUnderwritingInput({
        purchasePrice: askingPrice,
        askingPrice,
        marketValue,
        refurbCost,
        monthlyRent,
      })
      const res = await fetch("/api/underwriting/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      if (!res.ok) throw new Error("Capital Allocator failed")
      const data = await res.json()
      setAllocationResult(data.capitalAllocation)
      setAllocationAskingPrice(askingPrice)
      toast.success("Capital Allocator complete")
    } catch (e: any) {
      toast.error(e.message ?? "Capital Allocator failed")
    } finally {
      setLoadingAllocation(false)
    }
  }, [screeningResult, testSource, selectedVendorFull, selectedListing])

  const update = <K extends keyof ConfigState>(key: K, value: ConfigState[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
    setIsDirty(true)
  }

  const toggleStrategy = (strategy: string) => {
    const current = config.activeStrategies
    const next = current.includes(strategy)
      ? current.filter((s) => s !== strategy)
      : [...current, strategy]
    if (next.length === 0) return // must keep at least one
    update("activeStrategies", next)
  }

  const save = async () => {
    setIsSaving(true)
    try {
      const res = await fetch("/api/settings/offer-calculator", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? "Save failed")
      }
      toast.success("Offer calculator settings saved")
      setIsDirty(false)
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading calculator settings…
      </div>
    )
  }

  // Worked example for Flip
  const flipExampleMV = 200000
  const flipExampleRefurb = 20000
  const flipExampleMax = Math.round((flipExampleMV * config.flipMarketValuePct / 100) - flipExampleRefurb)

  // Worked example for BRR
  const brrExampleMV = 150000
  const brrExampleRefurb = 25000
  const brrExampleMax = Math.round((brrExampleMV * config.brrLtvPercent / 100) - brrExampleRefurb)

  // Worked example for yield
  const yieldExampleRent = 800
  const bhMax = Math.round((yieldExampleRent * 12) / (config.buyHoldMinYield / 100))
  const btlMax = Math.round((yieldExampleRent * 12) / (config.btlMinYield / 100))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">BMV Offer Analysis</h2>
          <p className="text-gray-400 text-sm mt-1">
            Global settings that control how offer prices are calculated across vendor leads. All formula variables are configurable here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-400">
              Unsaved changes
            </Badge>
          )}
          <Button onClick={save} disabled={isSaving || !isDirty}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v ?? "configuration")} className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="test">Test workflow</TabsTrigger>
        </TabsList>

        <TabsContent value="configuration" className="space-y-6 mt-6">
      {/* ── Card 0: Investor Constraints (always visible, most impactful) ──── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[#2563EB]" />
            Investor Offer Constraints
          </CardTitle>
          <CardDescription>
            Hard rules applied to every offer regardless of strategy. These ensure the calculator
            always behaves like a professional investor — offering below asking and requiring
            a minimum profit margin.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Min discount from asking — THE key investor rule */}
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <Label className="text-sm font-semibold">
                  Minimum discount from asking price
                  <InfoTip text="An investor always offers below asking — even when the deal is already BMV. This floor is applied after all other formula steps to guarantee the offer never reaches or exceeds the asking price." />
                </Label>
                <p className="text-xs text-gray-400">
                  The offer will always be at least this % below asking price.
                  At 5%, a £120,000 asking price becomes a max offer of £114,000.
                  Increase to 10–15% for more aggressive negotiation.
                </p>
              </div>
              <PctInput
                value={config.minDiscountFromAsking}
                onChange={(v) => update("minDiscountFromAsking", v)}
                min={1}
                max={30}
                step={1}
              />
            </div>
            {/* Live example */}
            <div className="rounded-md bg-background border px-3 py-2 text-xs space-y-1">
              <p className="text-gray-400 font-medium">Live example</p>
              <div className="flex gap-6">
                <span>Asking: <strong>£119,950</strong></span>
                <span>Max offer: <strong className="text-[#2563EB]">
                  £{Math.floor(119950 * (1 - config.minDiscountFromAsking / 100) / 1000) * 1000 < 119950
                    ? (Math.floor(119950 * (1 - config.minDiscountFromAsking / 100) / 1000) * 1000).toLocaleString("en-GB")
                    : Math.floor(119950 * (1 - config.minDiscountFromAsking / 100)).toLocaleString("en-GB")}
                </strong></span>
                <span className="text-gray-400">({config.minDiscountFromAsking}% below asking)</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Validation thresholds — moved here from Card 5 */}
          <div>
            <p className="text-sm font-semibold mb-3">Deal validation thresholds</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Minimum BMV discount
                  <InfoTip text="The asking price must be at least this far below market value for the deal to pass validation. Industry standard is 15–20%." />
                </Label>
                <PctInput
                  value={config.minBmvPercentage}
                  onChange={(v) => update("minBmvPercentage", v)}
                  min={5}
                  max={40}
                />
                <p className="text-xs text-gray-400">
                  Asking price must be ≥ {config.minBmvPercentage}% below market value
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Minimum profit potential
                  <InfoTip text="Market value minus offer price minus refurb cost must exceed this figure. Protects against deals where margins are too thin." />
                </Label>
                <div className="relative w-36">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                    £
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step={1000}
                    value={config.minProfitPotential}
                    onChange={(e) => update("minProfitPotential", toNumber(e.target.value))}
                    className="pl-6 text-sm h-8"
                  />
                </div>
                <p className="text-xs text-gray-400">
                  Net profit ≥ £{config.minProfitPotential.toLocaleString("en-GB")} after refurb
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 1: Calculator Mode ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-[#2563EB]" />
            Calculator Mode
          </CardTitle>
          <CardDescription>
            Choose between the legacy motivation-based calculation or the professional
            strategy-aware model.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable toggle */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Enable Strategy-Aware Calculator</Label>
              <p className="text-xs text-gray-400 max-w-md">
                When enabled, offer prices are derived from strategy-specific formulae (Flip, BRR,
                BuyHold, BTL) with configurable discount ranges and risk adjustments. When off, the
                original motivation-based calculator runs.
              </p>
            </div>
            <Switch
              checked={config.enableStrategyMode}
              onCheckedChange={(v) => update("enableStrategyMode", v)}
            />
          </div>

          {config.enableStrategyMode && (
            <>
              <Separator />

              {/* Active strategies */}
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-medium">Active Strategies</Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    These strategies appear in the vendor lead strategy selector.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_STRATEGIES.map((s) => {
                    const active = config.activeStrategies.includes(s)
                    return (
                      <button
                        key={s}
                        onClick={() => toggleStrategy(s)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
                          active
                            ? "bg-primary text-[#2563EB]-foreground border-primary"
                            : "bg-background text-gray-400 border-input hover:border-primary/50"
                        }`}
                      >
                        {STRATEGY_ICONS[s]}
                        {STRATEGY_LABELS[s]}
                        {active && <CheckCircle2 className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>

              <Separator />

              {/* Default strategy */}
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Default Strategy</Label>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Applied when a vendor lead has no strategy set.
                  </p>
                </div>
                <Select
                  value={config.defaultStrategy}
                  onValueChange={(v) => update("defaultStrategy", v)}
                >
                  <SelectTrigger className="w-52">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.activeStrategies.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STRATEGY_LABELS[s as Strategy] ?? s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {!config.enableStrategyMode && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs">
                The legacy calculator uses a fixed 78% base offer, adjusted by motivation score,
                condition, and urgency. Enable strategy mode above to use professional investor
                formulae with configurable parameters.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Card 2: Base Discount Range ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-[#2563EB]" />
            Base Discount Range
          </CardTitle>
          <CardDescription>
            The calculator starts at the midpoint of this range, then shifts up or down based on
            risk factors below. The final discount is always clamped within these bounds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6 max-w-sm">
            <div className="space-y-2">
              <Label className="text-sm">Minimum discount</Label>
              <PctInput
                value={config.baseDiscountMin}
                onChange={(v) => update("baseDiscountMin", v)}
                min={5}
                max={config.baseDiscountMax - 5}
              />
              <p className="text-[11px] text-gray-400">Floor — even in best conditions</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Maximum discount</Label>
              <PctInput
                value={config.baseDiscountMax}
                onChange={(v) => update("baseDiscountMax", v)}
                min={config.baseDiscountMin + 5}
                max={60}
              />
              <p className="text-[11px] text-gray-400">Ceiling — worst-case risk</p>
            </div>
          </div>

          {/* Visual range */}
          <div className="rounded-lg border bg-gray-50 p-4 max-w-sm">
            <div className="flex justify-between text-[11px] text-gray-400 mb-1">
              <span>Starting midpoint</span>
              <span className="font-semibold text-gray-900">
                {((config.baseDiscountMin + config.baseDiscountMax) / 2).toFixed(1)}% off market value
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 relative">
              <div
                className="absolute h-full rounded-full bg-primary/40"
                style={{
                  left: `${(config.baseDiscountMin / 60) * 100}%`,
                  width: `${((config.baseDiscountMax - config.baseDiscountMin) / 60) * 100}%`,
                }}
              />
              <div
                className="absolute h-4 w-1 bg-primary rounded-full top-1/2 -translate-y-1/2"
                style={{ left: `${(((config.baseDiscountMin + config.baseDiscountMax) / 2) / 60) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-[11px] text-gray-400 mt-1">
              <span>{config.baseDiscountMin}%</span>
              <span>{config.baseDiscountMax}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Risk Adjustments ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-[#2563EB]" />
            Risk Adjustments
          </CardTitle>
          <CardDescription>
            Each factor increases or decreases the discount from market value. Adjustments stack
            and are clamped to the range above.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-0 divide-y">
            {[
              {
                label: "Poor condition extra discount",
                key: "poorConditionDiscount" as const,
                description: "Property requires significant structural or cosmetic work",
                sign: "+",
                tip: "Covers additional refurb risk not captured in the refurb cost estimate.",
              },
              {
                label: "Average condition extra discount",
                key: "avgConditionDiscount" as const,
                description: "Property needs cosmetic updating",
                sign: "+",
                tip: "Minor uplift for properties rated 'needs work' or 'average'.",
              },
              {
                label: "Leasehold tenure discount",
                key: "leaseholdDiscount" as const,
                description: "Adds risk for service charges, ground rent, short lease",
                sign: "+",
                tip: "Leasehold properties are harder to mortgage and may have hidden costs.",
              },
              {
                label: "Long chain extra discount",
                key: "longChainDiscount" as const,
                description: "3+ properties in chain — high fall-through risk",
                sign: "+",
                tip: "Industry average fall-through rate for long chains is >30%.",
              },
              {
                label: "Short chain extra discount",
                key: "shortChainDiscount" as const,
                description: "1–2 properties in chain — moderate risk",
                sign: "+",
                tip: "Some delay risk but manageable. No chain = no adjustment.",
              },
            ].map(({ label, key, description, sign, tip }) => (
              <div key={key} className="flex items-center justify-between gap-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {label}
                    <InfoTip text={tip} />
                  </p>
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-400 w-3">{sign}</span>
                  <PctInput
                    value={config[key] as number}
                    onChange={(v) => update(key, v)}
                    min={0}
                    max={30}
                  />
                </div>
              </div>
            ))}

            <Separator className="my-2" />

            {/* Demand reduction */}
            <div className="pt-3 space-y-3">
              <p className="text-sm font-semibold text-gray-400">
                Demand Reduction
                <InfoTip text="When postcode demand is high, investors compete harder for properties. Reducing the discount makes offers more competitive in hot markets." />
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs">High demand threshold (score ≥)</Label>
                  <div className="relative w-24">
                    <Input
                      type="number"
                      min={3}
                      max={10}
                      step={1}
                      value={config.highDemandThreshold}
                      onChange={(e) => update("highDemandThreshold", parseInt(e.target.value) || 8)}
                      className="pr-10 text-sm h-8"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                      /10
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Score {config.highDemandThreshold}–10 = strong demand
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Discount reduction applied</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">−</span>
                    <PctInput
                      value={config.highDemandReduction}
                      onChange={(v) => update("highDemandReduction", v)}
                      min={0}
                      max={15}
                    />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Partial (score {config.highDemandThreshold - 2}–{config.highDemandThreshold - 1}):{" "}
                    −{Math.floor(config.highDemandReduction * 0.4)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Strategy Targets ─────────────────────────────────────────── */}
      {config.enableStrategyMode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-[#2563EB]" />
              Strategy Targets
            </CardTitle>
            <CardDescription>
              Each strategy applies an independent ceiling to ensure the offer meets professional
              investment criteria. The lower of the discount-based offer and the ceiling is used.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Flip */}
            {config.activeStrategies.includes("Flip") && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-orange-500" />
                  <h4 className="font-semibold text-sm">Flip</h4>
                  <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px]">
                    Buy · Refurb · Sell
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">
                      Offer ceiling = Market Value × _% − Refurb Cost
                      <InfoTip text="At 70%, you're buying at 70% of market value minus refurb — leaving the remaining 30% to cover all costs and profit." />
                    </Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-400">MV ×</span>
                      <PctInput
                        value={config.flipMarketValuePct}
                        onChange={(v) => update("flipMarketValuePct", v)}
                        min={50}
                        max={85}
                      />
                      <span className="text-sm text-gray-400">− refurb cost</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-400">
                  Example: MV £{flipExampleMV.toLocaleString()} × {config.flipMarketValuePct}% − refurb £{flipExampleRefurb.toLocaleString()} ={" "}
                  <span className="font-semibold text-gray-900">max offer £{flipExampleMax.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* BRR */}
            {config.activeStrategies.includes("BRR") && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-purple-500" />
                  <h4 className="font-semibold text-sm">BRR / BRRR</h4>
                  <Badge variant="outline" className="text-purple-600 border-purple-300 text-[10px]">
                    Buy · Refurb · Refinance · Repeat
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">
                      Refinance LTV %
                      <InfoTip text="After refurb, you refinance at this LTV. The offer ceiling ensures the refinance proceeds cover both purchase price and refurb cost — leaving you with zero capital tied in." />
                    </Label>
                    <div className="flex items-center gap-2">
                      <PctInput
                        value={config.brrLtvPercent}
                        onChange={(v) => update("brrLtvPercent", v)}
                        min={60}
                        max={85}
                      />
                      <span className="text-sm text-gray-400">LTV on refinance</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-400">
                  Example: MV £{brrExampleMV.toLocaleString()} × {config.brrLtvPercent}% − refurb £{brrExampleRefurb.toLocaleString()} ={" "}
                  <span className="font-semibold text-gray-900">max offer £{brrExampleMax.toLocaleString()}</span>
                  <span className="ml-2">(refinance fully recovers all capital)</span>
                </div>
              </div>
            )}

            {/* BuyHold / BTL */}
            {(config.activeStrategies.includes("BuyHold") || config.activeStrategies.includes("BTL")) && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Home className="h-4 w-4 text-green-500" />
                  <h4 className="font-semibold text-sm">BuyHold / BTL</h4>
                  <Badge variant="outline" className="text-green-600 border-green-300 text-[10px]">
                    Income-Based Ceiling
                  </Badge>
                </div>
                <p className="text-xs text-gray-400">
                  Maximum offer is derived from rental income: offer ≤ annual rent ÷ min yield.
                  This ensures the property hits the target gross yield from day one.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  {config.activeStrategies.includes("BuyHold") && (
                    <div className="space-y-2">
                      <Label className="text-xs">
                        BuyHold min gross yield
                        <InfoTip text="Long-term hold strategy. Slightly higher yield target than BTL to account for illiquidity." />
                      </Label>
                      <PctInput
                        value={config.buyHoldMinYield}
                        onChange={(v) => update("buyHoldMinYield", v)}
                        min={4}
                        max={20}
                        step={0.5}
                      />
                    </div>
                  )}
                  {config.activeStrategies.includes("BTL") && (
                    <div className="space-y-2">
                      <Label className="text-xs">
                        BTL min gross yield
                        <InfoTip text="Buy to Let. Standard mortgage lenders typically require 125% rental coverage at 5.5% stress rate, equivalent to ~6.9% yield." />
                      </Label>
                      <PctInput
                        value={config.btlMinYield}
                        onChange={(v) => update("btlMinYield", v)}
                        min={4}
                        max={20}
                        step={0.5}
                      />
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-400 space-y-1">
                  <p>Example rent: £{yieldExampleRent}/month (£{(yieldExampleRent * 12).toLocaleString()}/yr)</p>
                  {config.activeStrategies.includes("BuyHold") && (
                    <p>
                      BuyHold {config.buyHoldMinYield}% yield ceiling:{" "}
                      <span className="font-semibold text-gray-900">max offer £{bhMax.toLocaleString()}</span>
                    </p>
                  )}
                  {config.activeStrategies.includes("BTL") && (
                    <p>
                      BTL {config.btlMinYield}% yield ceiling:{" "}
                      <span className="font-semibold text-gray-900">max offer £{btlMax.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Bottom save */}
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={isSaving || !isDirty} size="lg">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
        </TabsContent>

        <TabsContent value="test" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Play className="h-5 w-5 text-[#2563EB]" />
                Test workflow
              </CardTitle>
              <CardDescription>
                Run BMV screening on a vendor lead or scraped listing. If screening passes, run the Capital Allocator for the full decision summary and best-fit strategy.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Source</Label>
                <Select value={testSource} onValueChange={(v: TestSource) => { setTestSource(v); setScreeningResult(null); setAllocationResult(null); setAllocationAskingPrice(null) }}>
                  <SelectTrigger className="w-[240px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vendor">
                      <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Vendor lead</span>
                    </SelectItem>
                    <SelectItem value="listing">
                      <span className="flex items-center gap-2"><FileText className="h-4 w-4" /> Scraped listing</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {testSource === "vendor" && (
                <div className="space-y-2">
                  <Label>Vendor lead</Label>
                  <Select
                    value={selectedVendorId}
                    onValueChange={(v) => { setSelectedVendorId(v); setScreeningResult(null); setAllocationResult(null); setAllocationAskingPrice(null) }}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a vendor lead (with asking price)" />
                    </SelectTrigger>
                    <SelectContent>
                      {vendorLeads.length === 0 && (
                        <SelectItem value="__none" disabled>No vendor leads — add leads first</SelectItem>
                      )}
                      {vendorLeads.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          {l.vendorName} — {l.askingPrice != null ? `£${Number(l.askingPrice).toLocaleString()}` : "No price"} {l.propertyAddress ? ` · ${l.propertyAddress}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {testSource === "listing" && (
                <div className="space-y-2">
                  <Label>Scraped listing</Label>
                  <Select
                    value={selectedListing?.id ?? ""}
                    onValueChange={(v) => {
                      const item = listings.find((l) => l.id === v) ?? null
                      setSelectedListing(item)
                      setScreeningResult(null)
                      setAllocationResult(null)
                      setAllocationAskingPrice(null)
                    }}
                  >
                    <SelectTrigger className="w-full max-w-md">
                      <SelectValue placeholder="Select a scraped listing" />
                    </SelectTrigger>
                    <SelectContent>
                      {listings.length === 0 && (
                        <SelectItem value="__none" disabled>No listings — run scraper first</SelectItem>
                      )}
                      {listings.map((l) => (
                        <SelectItem key={l.id} value={l.id}>
                          £{l.price.toLocaleString()} — {l.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={runScreening}
                  disabled={loadingScreening || (testSource === "vendor" ? !selectedVendorId || !selectedVendorFull?.askingPrice : !selectedListing?.price)}
                >
                  {loadingScreening ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                  Run screening
                </Button>
                <Button
                  variant="secondary"
                  onClick={runCapitalAllocator}
                  disabled={loadingAllocation || !screeningResult?.passesScreening}
                >
                  {loadingAllocation ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Run Capital Allocator
                </Button>
              </div>

              {screeningResult && (
                <Card className="border-muted">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Screening result</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Pass:</span>
                      <Badge variant={screeningResult.passesScreening ? "default" : "secondary"}>
                        {screeningResult.passesScreening ? "Pass" : "Fail"}
                      </Badge>
                    </div>
                    <p>Discount: {screeningResult.discountPercent.toFixed(1)}% · Gross yield: {screeningResult.grossYield.toFixed(1)}% · Basic ROI: {screeningResult.basicROI.toFixed(1)}% · Quick score: {screeningResult.quickScore}</p>
                  </CardContent>
                </Card>
              )}

              {allocationResult && (
                <Card className="border-primary/30">
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Capital Allocator result</CardTitle>
                    <CardDescription>
                      <div className="space-y-1">
                        <span>
                          Recommended: {allocationResult.recommendedStrategy} · Recommended offer: £{(allocationAskingPrice != null ? Math.min(allocationResult.finalMaxOffer, allocationAskingPrice) : allocationResult.finalMaxOffer).toLocaleString("en-GB")} · Institutional score: {allocationResult.institutionalScore.toFixed(1)}
                        </span>
                        {allocationAskingPrice != null && allocationResult.finalMaxOffer > allocationAskingPrice && (
                          <p className="text-xs text-gray-400">
                            Model ceiling £{allocationResult.finalMaxOffer.toLocaleString("en-GB")} — listing is below ceiling (deal has headroom).
                          </p>
                        )}
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs uppercase text-gray-400">Strategies (max offer = highest price model allows and still meets targets)</Label>
                      <div className="rounded-md border divide-y">
                        {allocationResult.strategies.map((s) => (
                          <div key={s.strategy} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                            <div className="font-medium">{s.strategy}</div>
                            <div className="flex items-center gap-2">
                              <Badge variant={s.pass ? "default" : "secondary"}>{s.pass ? "Pass" : "Fail"}</Badge>
                              <span className="text-gray-400">Score: {s.score} · Max offer (model): £{s.maxAllowableOffer.toLocaleString("en-GB")}</span>
                            </div>
                            <div className="w-full text-xs text-gray-400">
                              {Object.entries(s.metrics).map(([k, v]) => `${k}: ${typeof v === "number" ? v.toFixed(2) : v}`).join(" · ")}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
