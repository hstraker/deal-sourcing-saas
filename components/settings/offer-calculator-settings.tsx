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
} from "lucide-react"
import { toast } from "sonner"

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
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help inline ml-1" />
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
      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
        %
      </span>
    </div>
  )
}

export function OfferCalculatorSettings() {
  const [config, setConfig] = useState<ConfigState>(DEFAULT_CONFIG)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isDirty, setIsDirty] = useState(false)

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
      <div className="flex items-center justify-center py-24 text-muted-foreground">
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
          <h2 className="text-2xl font-bold tracking-tight">BMV Offer Calculator</h2>
          <p className="text-muted-foreground text-sm mt-1">
            Configure how the system calculates maximum offer prices for vendor leads.
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

      {/* ── Card 1: Calculator Mode ─────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
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
              <p className="text-xs text-muted-foreground max-w-md">
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
                  <p className="text-xs text-muted-foreground mt-0.5">
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
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background text-muted-foreground border-input hover:border-primary/50"
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
                  <p className="text-xs text-muted-foreground mt-0.5">
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
            <TrendingDown className="h-5 w-5 text-primary" />
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
              <p className="text-[11px] text-muted-foreground">Floor — even in best conditions</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Maximum discount</Label>
              <PctInput
                value={config.baseDiscountMax}
                onChange={(v) => update("baseDiscountMax", v)}
                min={config.baseDiscountMin + 5}
                max={60}
              />
              <p className="text-[11px] text-muted-foreground">Ceiling — worst-case risk</p>
            </div>
          </div>

          {/* Visual range */}
          <div className="rounded-lg border bg-muted/30 p-4 max-w-sm">
            <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
              <span>Starting midpoint</span>
              <span className="font-semibold text-foreground">
                {((config.baseDiscountMin + config.baseDiscountMax) / 2).toFixed(1)}% off market value
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted relative">
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
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1">
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
            <Target className="h-5 w-5 text-primary" />
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
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-muted-foreground w-3">{sign}</span>
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
              <p className="text-sm font-semibold text-muted-foreground">
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
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      /10
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Score {config.highDemandThreshold}–10 = strong demand
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Discount reduction applied</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">−</span>
                    <PctInput
                      value={config.highDemandReduction}
                      onChange={(v) => update("highDemandReduction", v)}
                      min={0}
                      max={15}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
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
              <Calculator className="h-5 w-5 text-primary" />
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
                      <span className="text-sm text-muted-foreground">MV ×</span>
                      <PctInput
                        value={config.flipMarketValuePct}
                        onChange={(v) => update("flipMarketValuePct", v)}
                        min={50}
                        max={85}
                      />
                      <span className="text-sm text-muted-foreground">− refurb cost</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Example: MV £{flipExampleMV.toLocaleString()} × {config.flipMarketValuePct}% − refurb £{flipExampleRefurb.toLocaleString()} ={" "}
                  <span className="font-semibold text-foreground">max offer £{flipExampleMax.toLocaleString()}</span>
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
                      <span className="text-sm text-muted-foreground">LTV on refinance</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Example: MV £{brrExampleMV.toLocaleString()} × {config.brrLtvPercent}% − refurb £{brrExampleRefurb.toLocaleString()} ={" "}
                  <span className="font-semibold text-foreground">max offer £{brrExampleMax.toLocaleString()}</span>
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
                <p className="text-xs text-muted-foreground">
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
                <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground space-y-1">
                  <p>Example rent: £{yieldExampleRent}/month (£{(yieldExampleRent * 12).toLocaleString()}/yr)</p>
                  {config.activeStrategies.includes("BuyHold") && (
                    <p>
                      BuyHold {config.buyHoldMinYield}% yield ceiling:{" "}
                      <span className="font-semibold text-foreground">max offer £{bhMax.toLocaleString()}</span>
                    </p>
                  )}
                  {config.activeStrategies.includes("BTL") && (
                    <p>
                      BTL {config.btlMinYield}% yield ceiling:{" "}
                      <span className="font-semibold text-foreground">max offer £{btlMax.toLocaleString()}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Card 5: Validation Thresholds ────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Validation Thresholds
          </CardTitle>
          <CardDescription>
            Deals that don't meet these criteria are flagged as not passing investment validation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
              <p className="text-xs text-muted-foreground">
                Asking price must be at least {config.minBmvPercentage}% below market value
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Minimum profit potential
                <InfoTip text="Market value minus offer price minus refurb cost must exceed this figure. Protects against deals where margins are too thin." />
              </Label>
              <div className="relative w-36">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
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
              <p className="text-xs text-muted-foreground">
                Net profit ≥ £{config.minProfitPotential.toLocaleString("en-GB")} after refurb
              </p>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>How validation works:</strong> A deal passes when (1) the asking price is at
              least {config.minBmvPercentage}% below market value AND (2) the estimated profit
              (market value − offer − refurb) is at least £{config.minProfitPotential.toLocaleString("en-GB")}.
              Failing deals are still shown but flagged clearly in the pipeline.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Bottom save */}
      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={isSaving || !isDirty} size="lg">
          {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save All Changes
        </Button>
      </div>
    </div>
  )
}
