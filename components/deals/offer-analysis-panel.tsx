"use client"

import { useState, useEffect, useCallback } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TooltipProvider } from "@/components/ui/tooltip"
import {
  RefreshCw,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Home,
  Loader2,
  Ban,
  BarChart2,
  DollarSign,
  Layers,
  Banknote,
  Building2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"
import {
  calculatePropertyOffer,
  computeMetricsAtPrice,
  type OfferCalculationResult,
} from "@/lib/offer-engine/property-offer-calculator"
import {
  generateBothLadders,
  type NegotiationLadder,
} from "@/lib/offer-engine/negotiation-ladder"
import { MetricTooltipIcon } from "@/components/deals/metric-tooltip-icon"
import { NegotiationLadderPanel } from "@/components/deals/negotiation-ladder-panel"

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface OfferAnalysisPanelProps {
  dealId?: string | null
  askingPrice: number
  gdv?: number | null
  estimatedRent?: number | null
  totalRefurbishment?: number | null
  missingInputsHint?: string
  onOfferSent?: (offerPrice: number, strategy: "flip" | "hold", round: number) => void
  onReject?: () => void
  readOnly?: boolean
  /** Fired every time a calculation completes — lets the modal left panel stay in sync */
  onResult?: (result: OfferCalculationResult) => void
  // Vendor contact — passed through to the negotiation ladder's Send Offer dialog
  vendorLeadId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  vendorPhone?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return formatCurrency(Math.round(n))
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function opening(ceiling: number): number {
  return Math.round((ceiling * 0.88) / 50) * 50
}

/** Display ROCE — sentinel 99.9 means full BRRR (all capital recycled), show "∞ BRRR" */
function fmtROCE(multiple: number): string {
  return multiple >= 99 ? "∞ (BRRR)" : `${multiple.toFixed(2)}×`
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorecard primitives (Option B — traffic-light rows)
// ─────────────────────────────────────────────────────────────────────────────

type RowStatus = "pass" | "negotiate" | "fail" | "info" | "none"

const SCORECARD_CFG: Record<RowStatus, {
  dot: string
  badge: string
  expandBg: string
  label: string
}> = {
  pass:      { dot: "bg-green-500", badge: "bg-green-100 text-green-700 border-green-200",  expandBg: "border-t border-green-100 bg-green-50/60",  label: "✓ Pass"      },
  negotiate: { dot: "bg-amber-500", badge: "bg-amber-100 text-amber-700 border-amber-200",  expandBg: "border-t border-amber-100 bg-amber-50/60",  label: "⚠ Negotiate" },
  fail:      { dot: "bg-red-500",   badge: "bg-red-100 text-red-700 border-red-200",        expandBg: "border-t border-red-100 bg-red-50/60",      label: "✕ Fail"      },
  info:      { dot: "bg-blue-400",  badge: "bg-blue-100 text-blue-700 border-blue-200",     expandBg: "border-t border-blue-100 bg-blue-50/30",    label: "ℹ Info"      },
  none:      { dot: "bg-gray-300",  badge: "bg-gray-100 text-gray-500 border-gray-200",     expandBg: "border-t border-gray-100 bg-gray-50",       label: "Pending"     },
}

function ScorecardRow({
  criterion,
  icon,
  status,
  summary,
  children,
  defaultOpen = false,
}: {
  criterion: string
  icon?: React.ReactNode
  status: RowStatus
  summary: string
  children?: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const c = SCORECARD_CFG[status]

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 bg-white px-4 py-2.5 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", c.dot)} />
        {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
        <span className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-gray-700">{criterion}</span>
          {summary && (
            <span className="ml-2 text-xs text-gray-400 truncate">{summary}</span>
          )}
        </span>
        <span className={cn(
          "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
          c.badge
        )}>
          {c.label}
        </span>
        {open
          ? <ChevronUp className="h-4 w-4 text-gray-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        }
      </button>
      {open && children && (
        <div className={cn("px-4 py-3", c.expandBg)}>
          {children}
        </div>
      )}
    </div>
  )
}

function KpiMini({
  label,
  value,
  status,
  hint,
}: {
  label: string
  value: string
  status?: RowStatus | null
  hint?: string
}) {
  const colour =
    status === "pass"      ? "text-green-700"
    : status === "fail"    ? "text-red-600"
    : status === "negotiate" ? "text-amber-700"
    :                        "text-gray-800"
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
      <p className={cn("text-sm font-bold leading-tight", colour)}>{value}</p>
      {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Pass/fail inline badge
// ─────────────────────────────────────────────────────────────────────────────

function PassBadge({ pass, passLabel, failLabel }: { pass: boolean; passLabel?: string; failLabel?: string }) {
  return pass ? (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600">
      <CheckCircle2 className="h-3.5 w-3.5" />
      {passLabel ?? "PASS"}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500">
      <XCircle className="h-3.5 w-3.5" />
      {failLabel ?? "FAIL"}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Viability dots
// ─────────────────────────────────────────────────────────────────────────────

function ViabilityDots({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5)
  const colour =
    score >= 70 ? "bg-green-500"
    : score >= 40 ? "bg-amber-400"
    :               "bg-red-400"
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={cn(
            "inline-block w-3 h-3 rounded-full",
            i < filled ? colour : "bg-gray-200"
          )}
        />
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Cash Purchase Panel
// ─────────────────────────────────────────────────────────────────────────────

/** Simple UK SDLT at additional-property (investor) rates */
function calcSDLT(price: number): number {
  const bands: [number, number, number][] = [
    [0,         125_000, 0.03],
    [125_000,   250_000, 0.05],
    [250_000,   925_000, 0.08],
    [925_000, 1_500_000, 0.13],
    [1_500_000, Infinity, 0.15],
  ]
  let tax = 0
  for (const [lo, hi, rate] of bands) {
    if (price <= lo) break
    tax += (Math.min(price, hi) - lo) * rate
  }
  return Math.round(tax)
}

function CashPurchasePanel({
  purchasePrice,
  estimatedRent,
  refurbCost,
}: {
  purchasePrice: number
  estimatedRent: number
  refurbCost: number
}) {
  const sdlt          = calcSDLT(purchasePrice)
  const solicitorFees = 1_500
  const surveyFee     = 500
  const totalCashIn   = purchasePrice + sdlt + solicitorFees + surveyFee + refurbCost

  const grossRentAnnual   = estimatedRent * 12
  const managementAnnual  = Math.round(grossRentAnnual * 0.10)  // 10% mgmt
  const voidAnnual        = estimatedRent                        // 1 month void
  const insuranceAnnual   = 600
  const maintenanceAnnual = Math.round(grossRentAnnual * 0.05)  // 5% maintenance
  const netAnnualCashflow = grossRentAnnual - managementAnnual - voidAnnual - insuranceAnnual - maintenanceAnnual
  const netMonthlyCF      = netAnnualCashflow / 12

  const grossYield   = (grossRentAnnual / purchasePrice) * 100
  const cashYield    = totalCashIn > 0 ? (netAnnualCashflow / totalCashIn) * 100 : 0

  const yieldStatus  = (y: number): RowStatus => y >= 6 ? "pass" : y >= 4 ? "negotiate" : "fail"
  const cfStatus: RowStatus = netMonthlyCF >= 0 ? "pass" : "fail"

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <KpiMini
          label="Total Cash In"
          value={fmt(totalCashIn)}
          hint="purchase + costs + refurb"
        />
        <KpiMini
          label="Gross Yield"
          value={`${grossYield.toFixed(1)}%`}
          status={yieldStatus(grossYield)}
          hint="annual rent ÷ purchase price"
        />
        <KpiMini
          label="Cash Yield"
          value={`${cashYield.toFixed(1)}%`}
          status={yieldStatus(cashYield)}
          hint="net cashflow ÷ total cash in"
        />
        <KpiMini
          label="Net Cashflow"
          value={`${fmt(netMonthlyCF)}/mo`}
          status={cfStatus}
          hint="after all running costs"
        />
      </div>

      {/* Cost breakdown */}
      <ScorecardRow
        criterion="Cash In (Acquisition)"
        icon={<DollarSign className="h-3.5 w-3.5" />}
        status="info"
        summary={`${fmt(totalCashIn)} total cash required`}
        defaultOpen={true}
      >
        <div className="space-y-1.5 text-xs">
          {[
            ["Purchase Price",      purchasePrice],
            ["SDLT (2nd property)", sdlt],
            ["Solicitor / Searches", solicitorFees],
            ["Survey",              surveyFee],
            ["Refurbishment",       refurbCost],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between">
              <span className="text-gray-400">{label as string}</span>
              <span className="font-medium font-mono">{fmt(val as number)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total Cash Required</span>
            <span className="font-mono">{fmt(totalCashIn)}</span>
          </div>
        </div>
      </ScorecardRow>

      {/* Annual cashflow */}
      <ScorecardRow
        criterion="Annual Cashflow"
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        status={cfStatus}
        summary={`${fmt(netMonthlyCF)}/mo net · ${grossYield.toFixed(1)}% gross yield`}
        defaultOpen={true}
      >
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-green-600">
            <span>Gross Annual Rent</span>
            <span className="font-medium font-mono">{fmt(grossRentAnnual)}</span>
          </div>
          {[
            ["Management (10%)",   -managementAnnual],
            ["Void Allowance (1mo)", -voidAnnual],
            ["Insurance",          -insuranceAnnual],
            ["Maintenance (5%)",   -maintenanceAnnual],
          ].map(([label, val]) => (
            <div key={label as string} className="flex justify-between text-red-500">
              <span>{label as string}</span>
              <span className="font-medium font-mono">−{fmt(Math.abs(val as number))}</span>
            </div>
          ))}
          <div className={cn(
            "flex justify-between border-t pt-1 font-semibold",
            netAnnualCashflow >= 0 ? "text-green-600" : "text-red-500"
          )}>
            <span>Net Annual Cashflow</span>
            <span className="font-mono">{fmt(netAnnualCashflow)}</span>
          </div>
          <div className="flex justify-between text-gray-400 text-[11px]">
            <span>= per month</span>
            <span className="font-mono">{fmt(netMonthlyCF)}/mo</span>
          </div>
        </div>
      </ScorecardRow>

      {/* Returns summary */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">
          Cash Returns Summary
        </p>
        <div className="flex justify-between">
          <span className="text-gray-500">Gross yield</span>
          <span className={cn("font-semibold", grossYield >= 6 ? "text-green-700" : grossYield >= 4 ? "text-amber-700" : "text-red-600")}>
            {grossYield.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Net cash yield (on total cash in)</span>
          <span className={cn("font-semibold", cashYield >= 5 ? "text-green-700" : cashYield >= 3 ? "text-amber-700" : "text-red-600")}>
            {cashYield.toFixed(2)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Payback period</span>
          <span className="font-semibold text-gray-700">
            {netAnnualCashflow > 0 ? `${(totalCashIn / netAnnualCashflow).toFixed(1)} years` : "N/A"}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 pt-1 border-t border-gray-200">
          No mortgage, no ICR check, no bridging required. Cash buyer metrics only.
          Management at 10%, void 1 month/yr, maintenance 5%.
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Assumptions override panel
// ─────────────────────────────────────────────────────────────────────────────

interface AssumptionsState {
  gdv: string
  estimatedRent: string
  totalRefurbishment: string
  bridgingMonths: string
  mortgageRate: string
}

function AssumptionsPanel({
  defaults,
  onRecalculate,
  loading,
  hasDefaultedRefurb = false,
}: {
  defaults: AssumptionsState
  onRecalculate: (overrides: AssumptionsState) => void
  loading: boolean
  hasDefaultedRefurb?: boolean
}) {
  const [editMode, setEditMode] = useState(false)
  const [vals, setVals] = useState<AssumptionsState>(defaults)

  const set = (key: keyof AssumptionsState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setVals((prev) => ({ ...prev, [key]: e.target.value }))
  }

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          {vals.gdv && (
            <span>
              <span className="font-medium text-gray-900">GDV</span>{" "}
              £{parseInt(vals.gdv).toLocaleString("en-GB")}
            </span>
          )}
          {vals.estimatedRent && (
            <span>
              <span className="font-medium text-gray-900">Rent</span>{" "}
              £{vals.estimatedRent}/mo
            </span>
          )}
          {vals.totalRefurbishment && (
            <span>
              <span className="font-medium text-gray-900">Refurb</span>{" "}
              £{parseInt(vals.totalRefurbishment).toLocaleString("en-GB")}
            </span>
          )}
          {vals.bridgingMonths && (
            <span>
              <span className="font-medium text-gray-900">Bridge</span>{" "}
              {vals.bridgingMonths}mo
            </span>
          )}
          {vals.mortgageRate && (
            <span>
              <span className="font-medium text-gray-900">Rate</span>{" "}
              {vals.mortgageRate}%
            </span>
          )}
        </div>
        <button
          onClick={() => setEditMode((v) => !v)}
          className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-gray-900 transition-colors shrink-0"
        >
          {editMode ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {editMode ? "Hide" : "Edit Assumptions"}
        </button>
      </div>

      {editMode && (
        <div className="space-y-4 rounded-lg bg-gray-100 border px-4 py-3">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs flex items-center">
                GDV (£)
                <MetricTooltipIcon tooltipKey="gdv" />
              </Label>
              <Input
                value={vals.gdv}
                onChange={set("gdv")}
                placeholder="e.g. 120000"
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Rent PCM (£)</Label>
              <Input
                value={vals.estimatedRent}
                onChange={set("estimatedRent")}
                placeholder="e.g. 830"
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                Refurb (£)
                {hasDefaultedRefurb && (
                  <span className="text-amber-600 font-normal">(estimated — update with actual)</span>
                )}
              </Label>
              <Input
                value={vals.totalRefurbishment}
                onChange={set("totalRefurbishment")}
                placeholder="e.g. 28000"
                className={`h-8 text-sm bg-white ${hasDefaultedRefurb ? "border-amber-300 ring-1 ring-amber-200" : ""}`}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Bridge Months</Label>
              <Input
                value={vals.bridgingMonths}
                onChange={set("bridgingMonths")}
                placeholder="12"
                className="h-8 text-sm bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Mortgage Rate (%)</Label>
              <Input
                value={vals.mortgageRate}
                onChange={set("mortgageRate")}
                placeholder="4.59"
                className="h-8 text-sm bg-white"
              />
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => { onRecalculate(vals); setEditMode(false) }}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            )}
            Recalculate
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function OfferAnalysisPanel({
  dealId,
  askingPrice,
  gdv,
  estimatedRent,
  totalRefurbishment,
  missingInputsHint,
  onOfferSent,
  onReject,
  readOnly,
  vendorLeadId,
  vendorName,
  vendorEmail,
  vendorPhone,
  onResult,
}: OfferAnalysisPanelProps) {
  const [result, setResult] = useState<OfferCalculationResult | null>(null)
  const [ladders, setLadders] = useState<{
    flip: NegotiationLadder | null
    hold: NegotiationLadder | null
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null)
  const [purchaseMode, setPurchaseMode] = useState<"mortgage" | "cash">("mortgage")

  const refurbDefault = !totalRefurbishment && gdv ? Math.round(gdv * 0.1) : null
  const effectiveRefurb = totalRefurbishment ?? refurbDefault
  const hasDefaultedRefurb = !totalRefurbishment && !!refurbDefault

  const hasRequiredInputs = !!(gdv && estimatedRent && effectiveRefurb)

  const assumptionDefaults: AssumptionsState = {
    gdv: gdv ? String(Math.round(gdv)) : "",
    estimatedRent: estimatedRent ? String(Math.round(estimatedRent)) : "",
    totalRefurbishment: effectiveRefurb ? String(effectiveRefurb) : "",
    bridgingMonths: "12",
    mortgageRate: "4.59",
  }

  const runCalculation = useCallback(
    async (overrides?: AssumptionsState) => {
      setLoading(true)
      setError(null)
      try {
        const resolvedGdv = overrides?.gdv ? parseFloat(overrides.gdv) : (gdv ?? 0)
        const resolvedRent = overrides?.estimatedRent
          ? parseFloat(overrides.estimatedRent)
          : (estimatedRent ?? 0)
        const resolvedRefurb = overrides?.totalRefurbishment
          ? parseFloat(overrides.totalRefurbishment)
          : (totalRefurbishment ?? 0)
        const resolvedBridgingMonths = overrides?.bridgingMonths
          ? parseInt(overrides.bridgingMonths)
          : undefined
        const resolvedMortgageRate = overrides?.mortgageRate
          ? parseFloat(overrides.mortgageRate) / 100
          : undefined

        let calcResult: OfferCalculationResult

        if (dealId) {
          const body: Record<string, number> = {}
          if (resolvedGdv > 0) body.gdv = resolvedGdv
          if (resolvedRent > 0) body.estimatedRent = resolvedRent
          if (resolvedRefurb > 0) body.totalRefurbishment = resolvedRefurb
          if (resolvedBridgingMonths !== undefined) body.bridgingMonths = resolvedBridgingMonths
          if (resolvedMortgageRate !== undefined) body.mortgageRate = resolvedMortgageRate

          const res = await fetch(`/api/deals/${dealId}/calculate-offer`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })

          if (!res.ok) {
            const data = (await res.json()) as {
              error?: string
              missing?: { gdv?: boolean; totalRefurbishment?: boolean; estimatedRent?: boolean }
              hint?: string
            }
            if (data.missing) {
              const missingFields = [
                data.missing.gdv && "GDV / market value",
                data.missing.totalRefurbishment && "refurb cost",
                data.missing.estimatedRent && "monthly rent",
              ]
                .filter(Boolean)
                .join(", ")
              throw new Error(
                `Missing: ${missingFields}.${data.hint ? ` ${data.hint}` : ""}`
              )
            }
            throw new Error(data.error ?? "Calculation failed")
          }

          calcResult = (await res.json()) as OfferCalculationResult
        } else {
          calcResult = calculatePropertyOffer({
            askingPrice,
            gdv: resolvedGdv,
            estimatedRent: resolvedRent,
            totalRefurbishment: resolvedRefurb,
            ...(resolvedBridgingMonths !== undefined && { bridgingMonths: resolvedBridgingMonths }),
            ...(resolvedMortgageRate !== undefined && { mortgageRate: resolvedMortgageRate }),
          })
        }

        setResult(calcResult)
        setLadders(generateBothLadders(calcResult))
        setCalculatedAt(new Date().toLocaleTimeString())
        onResult?.(calcResult)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    },
    [dealId, askingPrice, gdv, estimatedRent, totalRefurbishment]
  )

  useEffect(() => {
    if (dealId) return
    if (hasRequiredInputs) {
      void runCalculation(assumptionDefaults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!dealId) return
    const loadCached = async () => {
      try {
        const res = await fetch(`/api/deals/${dealId}/calculate-offer`)
        if (res.ok) {
          const data = (await res.json()) as {
            offerCalculation?: OfferCalculationResult
            offerCalculatedAt?: string
          }
          if (data.offerCalculation) {
            setResult(data.offerCalculation)
            setLadders(generateBothLadders(data.offerCalculation))
            setCalculatedAt(
              data.offerCalculatedAt
                ? new Date(data.offerCalculatedAt).toLocaleDateString()
                : null
            )
            onResult?.(data.offerCalculation)
          }
        }
      } catch {
        // No cache
      }
    }
    void loadCached()
  }, [dealId])

  // ── Derived scorecard data ──────────────────────────────────────────────────
  const flip         = result?.flip
  const hold         = result?.hold
  const bridging     = result?.bridging
  const cashflow     = result?.cashflow
  const mortgage     = result?.mortgage
  const inputs       = result?.inputs

  const flipHasPrice = (flip?.maxPurchasePrice ?? 0) > 0
  const holdHasPrice = (hold?.maxPurchasePrice ?? 0) > 0
  const flipViable   = flipHasPrice && (flip?.viewingCriteriaMet ?? false)
  const holdViable   = holdHasPrice && (hold?.viewingCriteriaMet ?? false)
  const flipSteep    = flipHasPrice && !(flip?.viewingCriteriaMet ?? false)
  const holdSteep    = holdHasPrice && !(hold?.viewingCriteriaMet ?? false)
  const isTrueBRRR   = holdViable && (hold?.moneyLeftIn ?? 1) <= 0

  const atAsking = result ? computeMetricsAtPrice(askingPrice, result.inputs) : null

  const flipStatus: RowStatus = flipViable ? "pass" : flipSteep ? "negotiate" : result ? "fail" : "none"
  const holdStatus: RowStatus = holdViable ? "pass" : holdSteep ? "negotiate" : result ? "fail" : "none"
  const viabilityStatus: RowStatus =
    (result?.viabilityScore ?? 0) >= 70 ? "pass"
    : (result?.viabilityScore ?? 0) >= 40 ? "negotiate"
    : result ? "fail"
    : "none"

  const flipSummary = flip && flipHasPrice
    ? `${fmt(flip.maxPurchasePrice)} ceiling · ${pct(flip.profitOnCost)} profit on cost · ${pct(flip.discountPercent)} off asking`
    : result ? "No viable price at any purchase amount" : ""

  const holdSummary = hold && holdHasPrice
    ? `${fmt(hold.maxPurchasePrice)} ceiling · ${fmtROCE(hold.roceMultiple)} ROCE · ${pct(hold.grossYield)} yield`
    : result ? "No viable price at any purchase amount" : ""

  const flipCeiling = flip?.maxPurchasePrice ?? 0
  const holdCeiling = hold?.maxPurchasePrice ?? 0
  const flipOpening = flipHasPrice ? opening(flipCeiling) : 0
  const holdOpening = holdHasPrice ? opening(holdCeiling) : 0

  // True when the recommended strategy is hold/BTL/BRRR — used to reorder strategy cards and default the ladder tab
  const isHoldPrim = result?.recommendedStrategy === "hold" || result?.recommendedStrategy === "both"

  // Ladder summary shows the RECOMMENDED strategy's numbers, not always flip
  const recOpening = isHoldPrim && holdHasPrice ? holdOpening : flipHasPrice ? flipOpening : holdOpening
  const recCeiling = isHoldPrim && holdHasPrice ? holdCeiling : flipHasPrice ? flipCeiling : holdCeiling
  const ladderSummary = (flipHasPrice || holdHasPrice)
    ? `Open ${fmt(recOpening)} → Max ${fmt(recCeiling)}`
    : "No viable ceiling"

  const viabilityLabel =
    result?.dealViability === "strong" ? "Strong"
    : result?.dealViability === "marginal" ? "Marginal"
    : result ? "No Deal"
    : ""

  const viabilityScore = result?.viabilityScore ?? 0
  const viabilitySummary = result ? `${viabilityScore}/100 · ${viabilityLabel}` : ""

  // Flip result message
  const flipResultMsg = !result ? "" :
    flipViable
      ? `✓ Achievable discount (${pct(flip!.discountPercent)}) with ${pct(flip!.profitOnCost)} profit on cost — ${fmt(flip!.profit)} gross profit at ceiling.`
      : flipSteep
      ? `⚠ Returns work at ${fmt(flip!.maxPurchasePrice)} but needs a ${pct(flip!.discountPercent)} discount from asking — above the 20% threshold. Achievable with a motivated seller.`
      : `✗ After refurb (${fmt(inputs!.totalRefurbishment)}) and bridging finance, the GDV (${fmt(inputs!.gdv)}) doesn't leave enough margin for the 20% profit target.`

  // Hold result message
  const holdResultMsg = !result ? "" :
    holdViable
      ? isTrueBRRR
        ? `✓ True BRRR — ${fmt(hold!.cashSurplus)} cash surplus after refinancing. Full deposit recycled for next deal at ${pct(hold!.grossYield)} gross yield.`
        : `✓ BTL viable — ${fmt(hold!.moneyLeftIn)} equity in deal after refinancing. ${pct(hold!.grossYield)} gross yield, ${fmt(hold!.netMonthlyCashflow)}/mo net cashflow.`
      : holdSteep
      ? `⚠ Returns work at ${fmt(hold!.maxPurchasePrice)} but needs a ${pct(hold!.discountPercent)} discount from asking — above the 20% threshold. Achievable with a motivated seller.`
      : !mortgage?.icrPass
      ? `✗ Rent (${fmt(inputs!.estimatedRent)}/mo) is below the lender ICR minimum (${fmt(mortgage!.requiredRentForICR)}/mo). A BTL mortgage won't be approved.`
      : atAsking && atAsking.roceMultiple >= 99
      ? `✗ Full BRRR appears possible at asking price but cashflow is negative — check rent estimate.`
      : atAsking
      ? `✗ ROCE at asking is ${fmtROCE(atAsking.roceMultiple)} — below the 2.5× target. Not enough cashflow relative to capital invested.`
      : ""

  const recLabel =
    result?.recommendedStrategy === "pass"    ? "No viable strategy"
    : result?.recommendedStrategy === "both"  ? "Flip or BTL/BRRR"
    : result?.recommendedStrategy === "flip"  ? (flipViable ? "Flip" : "Flip (steep discount)")
    : result?.recommendedStrategy === "hold"  ? (holdViable ? (isTrueBRRR ? "BRRR" : "BTL") : "Hold (steep discount)")
    : null

  return (
    <TooltipProvider delayDuration={300}>
      <div className="ds-card overflow-hidden">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 text-base">Offer Analysis Engine</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {purchaseMode === "mortgage"
                  ? "Goal-seek methodology · Excel PropertyAnalyser"
                  : "Cash purchase · no bridging or mortgage"}
                {calculatedAt && ` · Calculated ${calculatedAt}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Purchase mode toggle */}
              <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                <button
                  type="button"
                  onClick={() => setPurchaseMode("mortgage")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                    purchaseMode === "mortgage"
                      ? "bg-blue-600 text-white font-semibold"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Mortgage
                </button>
                <button
                  type="button"
                  onClick={() => setPurchaseMode("cash")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-gray-200",
                    purchaseMode === "cash"
                      ? "bg-green-600 text-white font-semibold"
                      : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  <Banknote className="h-3.5 w-3.5" />
                  Cash
                </button>
              </div>

              {purchaseMode === "mortgage" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void runCalculation()}
                  disabled={loading || !hasRequiredInputs}
                  title={
                    !hasRequiredInputs
                      ? "Set GDV, rent, and refurb cost on this deal to calculate"
                      : undefined
                  }
                >
                  {loading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  {result ? "Recalculate" : "Calculate"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">

          {/* ── Missing inputs ─────────────────────────────────────────── */}
          {(!gdv || !estimatedRent) && !result && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-amber-800">
                <p className="font-medium">Missing inputs</p>
                <p className="text-xs mt-0.5">
                  {[
                    !gdv && "GDV / market value",
                    !estimatedRent && "monthly rent",
                  ]
                    .filter(Boolean)
                    .join(", ")}{" "}
                  must be set to calculate an offer.
                </p>
                {missingInputsHint && (
                  <p className="text-xs mt-1 font-medium">{missingInputsHint}</p>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm">
              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* ── Cash Purchase View ────────────────────────────────────── */}
          {purchaseMode === "cash" && (
            estimatedRent && (askingPrice || (result?.inputs?.gdv)) ? (
              <CashPurchasePanel
                purchasePrice={askingPrice}
                estimatedRent={estimatedRent}
                refurbCost={
                  result?.inputs?.totalRefurbishment ??
                  (totalRefurbishment ?? 0)
                }
              />
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-amber-800">
                  Set a monthly rent estimate to see cash purchase metrics.
                </p>
              </div>
            )
          )}

          {/* ── Result scorecard ──────────────────────────────────────── */}
          {purchaseMode === "mortgage" && result && (
            <>
              {/* Asking / GDV pill */}
              <div className="flex items-center gap-3 text-sm text-gray-400 pb-1 border-b">
                <span className="flex items-center">
                  Asking Price<MetricTooltipIcon tooltipKey="askingPrice" />
                </span>
                <span className="font-semibold text-gray-900">{fmt(askingPrice)}</span>
                <span>·</span>
                <span className="flex items-center">
                  GDV<MetricTooltipIcon tooltipKey="gdv" />
                </span>
                <span className="font-semibold text-gray-900">{fmt(result.inputs.gdv)}</span>
                {recLabel && (
                  <>
                    <span>·</span>
                    <span className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                      result.recommendedStrategy === "pass"
                        ? "bg-red-100 text-red-700 border-red-200"
                        : (flipViable || holdViable)
                        ? "bg-green-100 text-green-700 border-green-200"
                        : "bg-amber-100 text-amber-700 border-amber-200"
                    )}>
                      Recommended: {recLabel}
                    </span>
                  </>
                )}
              </div>

              {/* Scorecard rows — recommended strategy card shown first */}
              <div className="flex flex-col gap-2">

                {/* ── 1. Flip Strategy ───────────────────────────────── */}
                {/* When hold is recommended, flip card moves to second position via CSS order */}
                <div className={isHoldPrim ? "order-2" : "order-1"}>
                <ScorecardRow
                  criterion="Flip Strategy"
                  icon={<TrendingUp className="h-3.5 w-3.5" />}
                  status={flipStatus}
                  summary={flipSummary}
                  defaultOpen={false}
                >
                  {/* KPI grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <KpiMini
                      label="Ceiling"
                      value={flipHasPrice ? fmt(flipCeiling) : "—"}
                      status={flipHasPrice ? (flipViable ? "pass" : "negotiate") : "fail"}
                    />
                    <KpiMini
                      label="Open with"
                      value={flipHasPrice ? fmt(flipOpening) : "—"}
                      hint="88% of ceiling"
                    />
                    <KpiMini
                      label="Profit on cost"
                      value={flipHasPrice ? pct(flip!.profitOnCost) : atAsking ? pct(atAsking.profitOnCost) : "—"}
                      status={((flipHasPrice ? flip!.profitOnCost : atAsking?.profitOnCost ?? 0) >= 0.2) ? "pass" : "fail"}
                      hint="target ≥ 20%"
                    />
                    <KpiMini
                      label="Gross profit"
                      value={flipHasPrice ? fmt(flip!.profit) : atAsking ? fmt(atAsking.profit) : "—"}
                      status={((flipHasPrice ? flip!.profit : atAsking?.profit ?? 0) > 0) ? "pass" : "fail"}
                    />
                  </div>
                  {flipHasPrice && (
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <KpiMini
                        label="Discount required"
                        value={pct(flip!.discountPercent)}
                        status={flip!.viewingCriteriaMet ? "pass" : "negotiate"}
                        hint={flip!.viewingCriteriaMet ? "within 20% ✓" : "above 20% threshold"}
                      />
                      <KpiMini
                        label="Discount amount"
                        value={fmt(flip!.discountFromAsking)}
                        hint="off asking price"
                      />
                    </div>
                  )}
                  {/* Rationale */}
                  <div className={cn(
                    "text-xs rounded-lg p-2.5 leading-relaxed border-l-2",
                    flipViable ? "border-green-400 bg-green-50 text-green-800"
                    : flipSteep  ? "border-amber-400 bg-amber-50 text-amber-800"
                    :              "border-red-300 bg-red-50/50 text-gray-500"
                  )}>
                    {flipResultMsg}
                  </div>
                  {/* Why not at asking price */}
                  {!flipHasPrice && atAsking && (
                    <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white p-3 space-y-1 text-xs">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
                        At asking price
                      </p>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Profit on cost</span>
                        <span className={atAsking.profitOnCost >= 0.2 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {pct(atAsking.profitOnCost)} <span className="text-gray-400 font-normal">(need 20%)</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Gross profit</span>
                        <span className="font-medium">{fmt(atAsking.profit)}</span>
                      </div>
                    </div>
                  )}
                </ScorecardRow>
                </div>{/* end flip wrapper */}

                {/* ── 2. BTL / BRRR ──────────────────────────────────── */}
                {/* When hold is recommended this card moves to first position */}
                <div className={isHoldPrim ? "order-1" : "order-2"}>
                <ScorecardRow
                  criterion="BTL / BRRR"
                  icon={<Home className="h-3.5 w-3.5" />}
                  status={holdStatus}
                  summary={holdSummary}
                  defaultOpen={false}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                    <KpiMini
                      label="Ceiling"
                      value={holdHasPrice ? fmt(holdCeiling) : "—"}
                      status={holdHasPrice ? (holdViable ? "pass" : "negotiate") : "fail"}
                    />
                    <KpiMini
                      label="Open with"
                      value={holdHasPrice ? fmt(holdOpening) : "—"}
                      hint="88% of ceiling"
                    />
                    <KpiMini
                      label="ROCE multiple"
                      value={holdHasPrice ? fmtROCE(hold!.roceMultiple) : atAsking ? fmtROCE(atAsking.roceMultiple) : "—"}
                      status={((holdHasPrice ? hold!.roceMultiple : atAsking?.roceMultiple ?? 0) >= 2.5) ? "pass" : "fail"}
                      hint="target ≥ 2.5×"
                    />
                    <KpiMini
                      label="Gross yield"
                      value={holdHasPrice ? pct(hold!.grossYield) : "—"}
                      status={(holdHasPrice && (hold?.grossYield ?? 0) >= 0.06) ? "pass" : null}
                    />
                  </div>
                  {(holdHasPrice || cashflow) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                      <KpiMini
                        label="Net cashflow"
                        value={cashflow ? `${fmt(cashflow.netMonthlyCashflow)}/mo` : "—"}
                        status={(cashflow?.netMonthlyCashflow ?? 0) >= 0 ? "pass" : "fail"}
                      />
                      <KpiMini
                        label="Money left in"
                        value={holdHasPrice
                          ? (hold!.moneyLeftIn > 0 ? fmt(hold!.moneyLeftIn) : `${fmt(hold!.cashSurplus)} surplus`)
                          : "—"
                        }
                        status={holdHasPrice ? (hold!.moneyLeftIn <= 0 ? "pass" : null) : null}
                        hint={holdHasPrice && hold!.moneyLeftIn <= 0 ? "full BRRR ✓" : holdHasPrice ? "BTL" : undefined}
                      />
                      <KpiMini
                        label="ICR check"
                        value={mortgage ? `${fmt(inputs!.estimatedRent)} vs ${fmt(mortgage.requiredRentForICR)} req.` : "—"}
                        status={mortgage?.icrPass ? "pass" : "fail"}
                        hint={mortgage?.icrPass ? "lender approved" : "lender fail"}
                      />
                      {holdHasPrice && (
                        <KpiMini
                          label="Discount required"
                          value={pct(hold!.discountPercent)}
                          status={hold!.viewingCriteriaMet ? "pass" : "negotiate"}
                          hint={hold!.viewingCriteriaMet ? "within 20% ✓" : "above 20%"}
                        />
                      )}
                    </div>
                  )}
                  {/* Rationale */}
                  <div className={cn(
                    "text-xs rounded-lg p-2.5 leading-relaxed border-l-2",
                    holdViable ? "border-green-400 bg-green-50 text-green-800"
                    : holdSteep  ? "border-amber-400 bg-amber-50 text-amber-800"
                    :              "border-red-300 bg-red-50/50 text-gray-500"
                  )}>
                    {holdResultMsg}
                  </div>
                  {/* Why not at asking price */}
                  {!holdHasPrice && atAsking && mortgage && (
                    <div className="mt-2 rounded-lg border border-dashed border-gray-200 bg-white p-3 space-y-1 text-xs">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">At asking price</p>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Rent vs ICR req.</span>
                        <span className={mortgage.icrPass ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {fmt(inputs!.estimatedRent)}/mo vs {fmt(mortgage.requiredRentForICR)} req.
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">ROCE multiple</span>
                        <span className={atAsking.roceMultiple >= 2.5 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {fmtROCE(atAsking.roceMultiple)}{" "}
                          <span className="text-gray-400 font-normal">(need 2.5×)</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Net cashflow</span>
                        <span className={cashflow && cashflow.netMonthlyCashflow >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                          {cashflow ? fmt(cashflow.netMonthlyCashflow) : "—"}/mo
                        </span>
                      </div>
                    </div>
                  )}
                </ScorecardRow>
                </div>{/* end hold wrapper */}

                {/* ── 3. Negotiation Ladder ──────────────────────────── */}
                <div className="order-3">
                {ladders && (
                  <ScorecardRow
                    criterion="Negotiation Ladder"
                    icon={<Layers className="h-3.5 w-3.5" />}
                    status="info"
                    summary={ladderSummary}
                    defaultOpen={true}
                  >
                    <NegotiationLadderPanel
                      flipLadder={ladders.flip}
                      holdLadder={ladders.hold}
                      recommendedStrategy={isHoldPrim ? "hold" : "flip"}
                      dealId={dealId}
                      onOfferSent={onOfferSent}
                      readOnly={readOnly}
                      vendorLeadId={vendorLeadId}
                      vendorName={vendorName}
                      vendorEmail={vendorEmail}
                      vendorPhone={vendorPhone}
                    />
                  </ScorecardRow>
                )}
                </div>{/* end ladder wrapper */}

                {/* ── 4. Financial Breakdown ────────────────────────── */}
                <div className="order-4">
                {bridging && mortgage && cashflow && flip && (
                  <ScorecardRow
                    criterion="Financial Breakdown"
                    icon={<DollarSign className="h-3.5 w-3.5" />}
                    status="info"
                    summary={`Bridge ${fmt(bridging.totalCosts)} · Equity ${fmt(flip.totalEquityInvested)} · Mortgage ${fmt(mortgage.monthlyPayment)}/mo`}
                    defaultOpen={false}
                  >
                    <div className="grid md:grid-cols-2 gap-6 text-sm">
                      {/* Bridging */}
                      <div>
                        <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-400 flex items-center">
                          Bridging Finance
                          <MetricTooltipIcon tooltipKey="bridgingTotalCosts" />
                        </p>
                        <div className="space-y-1.5">
                          {[
                            ["Gross Loan (75% LTV)", fmt(bridging.grossLoan), "bridgingGrossLoan"],
                            ["Net Advance",           fmt(bridging.netLoanAdvance), "bridgingNetLoanAdvance"],
                            ["Deposit",               fmt(bridging.deposit), "bridgingDeposit"],
                            ["Arrangement Fee",       fmt(bridging.arrangementFee), null],
                            ["Monthly Interest",      fmt(bridging.monthlyInterest), null],
                            ["Total Interest",        fmt(bridging.totalInterest), null],
                            ["Exit Fee",              fmt(bridging.exitFee), null],
                          ].map(([label, val, tip]) => (
                            <div key={label} className="flex justify-between items-center">
                              <span className="text-gray-400 flex items-center">
                                {label}
                                {tip && <MetricTooltipIcon tooltipKey={tip as string} />}
                              </span>
                              <span className="font-medium">{val}</span>
                            </div>
                          ))}
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Total Bridging Costs</span>
                            <span>{fmt(bridging.totalCosts)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Exit Mortgage */}
                      <div>
                        <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-400">
                          Exit Mortgage (on GDV)
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Loan (75% of GDV)</span>
                            <span className="font-medium">{fmt(mortgage.loanAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Monthly Payment</span>
                            <span className="font-medium">{fmt(mortgage.monthlyPayment)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Arrangement Fee</span>
                            <span className="font-medium">{fmt(mortgage.arrangementFee)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center">
                              ICR Check
                              <MetricTooltipIcon tooltipKey="icrPass" />
                            </span>
                            <span className="flex items-center gap-1.5">
                              <PassBadge pass={mortgage.icrPass} />
                              <span className="text-gray-400 text-xs">
                                ({fmt(mortgage.requiredRentForICR)} req.)
                              </span>
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Total Mortgage Costs</span>
                            <span>{fmt(mortgage.totalCosts)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Monthly Cashflow */}
                      <div>
                        <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-400 flex items-center">
                          Monthly Cashflow
                          <MetricTooltipIcon tooltipKey="netMonthlyCashflow" />
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between text-green-600">
                            <span>Rent</span>
                            <span className="font-medium">{fmt(cashflow.grossRentMonthly)}</span>
                          </div>
                          <div className="flex justify-between text-red-500">
                            <span>Mortgage</span>
                            <span className="font-medium">−{fmt(cashflow.mortgagePaymentMonthly)}</span>
                          </div>
                          {cashflow.managementCostMonthly > 0 && (
                            <div className="flex justify-between text-red-500">
                              <span>Management</span>
                              <span className="font-medium">−{fmt(cashflow.managementCostMonthly)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-red-500">
                            <span>Void Allowance</span>
                            <span className="font-medium">−{fmt(cashflow.voidAllowanceMonthly)}</span>
                          </div>
                          <div className="flex justify-between text-red-500">
                            <span>Insurance</span>
                            <span className="font-medium">−{fmt(cashflow.insuranceMonthly)}</span>
                          </div>
                          <div className={cn(
                            "flex justify-between border-t pt-1 font-semibold",
                            cashflow.netMonthlyCashflow >= 0 ? "text-green-600" : "text-red-500"
                          )}>
                            <span>Net Monthly</span>
                            <span>{fmt(cashflow.netMonthlyCashflow)}</span>
                          </div>
                          <div className="flex justify-between items-center text-gray-400 text-xs">
                            <span className="flex items-center">
                              Gross Yield
                              <MetricTooltipIcon tooltipKey="grossYield" />
                            </span>
                            <span>{pct(cashflow.grossYield)}</span>
                          </div>
                        </div>
                      </div>

                      {/* Acquisition & Project Costs */}
                      <div>
                        <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-400">
                          Acquisition &amp; Project Costs
                        </p>
                        <div className="space-y-1.5">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Deposit</span>
                            <span className="font-medium">{fmt(flip.acquisitionCosts.deposit)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-gray-400 flex items-center">
                              Stamp Duty
                              <MetricTooltipIcon tooltipKey="stampDuty" />
                            </span>
                            <span className="font-medium">{fmt(flip.acquisitionCosts.stampDuty)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Solicitor / Searches</span>
                            <span className="font-medium">
                              {fmt(
                                flip.acquisitionCosts.solicitorFees +
                                flip.acquisitionCosts.searches +
                                flip.acquisitionCosts.buildingControl
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Acquisition Total</span>
                            <span className="font-medium">{fmt(flip.acquisitionCosts.total)}</span>
                          </div>
                          <div className="border-t pt-1" />
                          <div className="flex justify-between">
                            <span className="text-gray-400">Refurbishment</span>
                            <span className="font-medium">{fmt(flip.projectCosts.refurbishment)}</span>
                          </div>
                          {flip.projectCosts.contingency > 0 && (
                            <div className="flex justify-between">
                              <span className="text-gray-400">Contingency</span>
                              <span className="font-medium">{fmt(flip.projectCosts.contingency)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-400">Holding / Furnishing</span>
                            <span className="font-medium">
                              {fmt(
                                flip.projectCosts.utilities +
                                flip.projectCosts.councilTax +
                                flip.projectCosts.furnishing
                              )}
                            </span>
                          </div>
                          <div className="flex justify-between border-t pt-1 font-semibold">
                            <span>Total Equity Invested</span>
                            <span>{fmt(flip.totalEquityInvested)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ScorecardRow>
                )}

                {/* ── 5. Deal Viability ──────────────────────────────── */}
                <ScorecardRow
                  criterion="Deal Viability"
                  icon={<BarChart2 className="h-3.5 w-3.5" />}
                  status={viabilityStatus}
                  summary={viabilitySummary}
                  defaultOpen={true}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <ViabilityDots score={viabilityScore} />
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-semibold capitalize",
                            result.dealViability === "strong"   ? "bg-green-100 text-green-700 border-green-200"
                            : result.dealViability === "marginal" ? "bg-amber-100 text-amber-700 border-amber-200"
                            :                                       "bg-red-100 text-red-600 border-red-200"
                          )}
                        >
                          {result.dealViability === "pass" ? "No Deal" : result.dealViability}
                        </Badge>
                        <span className={cn(
                          "text-sm font-semibold",
                          result.dealViability === "strong"   ? "text-green-600"
                          : result.dealViability === "marginal" ? "text-amber-600"
                          :                                       "text-red-500"
                        )}>
                          {viabilityScore}/100
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Recommended</p>
                        <p className="text-sm font-bold capitalize">
                          {result.recommendedStrategy === "pass"
                            ? "No deal"
                            : result.recommendedStrategy === "both"
                            ? "Flip or Hold"
                            : result.recommendedStrategy}
                        </p>
                      </div>
                    </div>
                    <ul className="space-y-1">
                      {result.viabilityNotes.map((note, i) => (
                        <li key={i} className="text-xs text-gray-500 flex items-start gap-1.5">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>

                    {onReject && !readOnly && (
                      <div className="pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 border-red-300 hover:bg-red-50"
                          onClick={onReject}
                        >
                          <Ban className="h-3.5 w-3.5 mr-1.5" />
                          Reject Deal
                        </Button>
                      </div>
                    )}
                  </div>
                </ScorecardRow>

                </div>{/* end financial-breakdown + viability wrapper */}

              </div>{/* end flex flex-col scorecard container */}
            </>
          )}

          {/* ── Assumptions override — mortgage mode only ── */}
          {purchaseMode === "mortgage" && hasRequiredInputs && (
            <AssumptionsPanel
              defaults={assumptionDefaults}
              onRecalculate={runCalculation}
              loading={loading}
              hasDefaultedRefurb={hasDefaultedRefurb}
            />
          )}

        </div>
      </div>
    </TooltipProvider>
  )
}
