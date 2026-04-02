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
} from "lucide-react"
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

function ViabilityDots({ score }: { score: number }) {
  const filled = Math.round((score / 100) * 5)
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`inline-block w-3 h-3 rounded-full ${
            i < filled ? "bg-[#2563EB]" : "bg-gray-100"
          }`}
        />
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Small metric row used inside strategy cards
// ─────────────────────────────────────────────────────────────────────────────

function MetricRow({
  label,
  value,
  pass,
  hint,
}: {
  label: string
  value: string
  pass?: boolean
  hint?: string
}) {
  return (
    <div className="flex justify-between items-center gap-2">
      <span className="text-gray-400 shrink-0">{label}</span>
      <div className="flex items-center gap-1">
        {pass !== undefined && (
          pass
            ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
            : <XCircle className="h-3 w-3 text-red-400 shrink-0" />
        )}
        <span className={`font-medium ${pass === true ? "text-green-700" : pass === false ? "text-red-600" : ""}`}>
          {value}
        </span>
        {hint && <span className="text-gray-400/60 text-[10px]">({hint})</span>}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy breakdown — one card per strategy with key metrics and plain-English
// reason for viability or exclusion
// ─────────────────────────────────────────────────────────────────────────────

function StrategyRationale({ result }: { result: OfferCalculationResult }) {
  const { flip, hold, mortgage, cashflow, inputs, recommendedStrategy } = result

  // Three states per strategy:
  // 1. Viable     — return criteria met + discount within 20% threshold (green)
  // 2. Steep disc — return criteria met but discount > 20% (amber — motivated seller needed)
  // 3. No price   — return criteria can't be met at any purchase price (grey)
  const flipHasPrice = flip.maxPurchasePrice > 0
  const holdHasPrice = hold.maxPurchasePrice > 0
  const flipViable = flipHasPrice && flip.viewingCriteriaMet
  const holdViable = holdHasPrice && hold.viewingCriteriaMet
  const flipSteep = flipHasPrice && !flip.viewingCriteriaMet
  const holdSteep = holdHasPrice && !hold.viewingCriteriaMet
  // BRRR = all capital pulled back out after refinancing (no money left in)
  const isTrueBRRR = holdViable && hold.moneyLeftIn <= 0

  // Metrics at asking price — used for diagnostic display when a strategy isn't viable
  // so the user can see WHY it fails rather than just "—"
  const atAsking = computeMetricsAtPrice(inputs.askingPrice, inputs)

  // Plain-English result messages per strategy state
  // Flip
  const flipResultMsg = flipViable
    ? `✓ Achievable discount (${pct(flip.discountPercent)}) with ${pct(flip.profitOnCost)} profit on cost — ${fmt(flip.profit)} gross profit at ceiling.`
    : flipSteep
    ? `⚠ Returns work at ${fmt(flip.maxPurchasePrice)} but needs a ${pct(flip.discountPercent)} discount from asking — above the 20% threshold. Achievable with a motivated seller.`
    : `✗ After refurb (${fmt(inputs.totalRefurbishment)}) and bridging finance, the GDV (${fmt(inputs.gdv)}) doesn't leave enough margin for the 20% profit target.`

  // Hold
  const holdResultMsg = holdViable
    ? isTrueBRRR
      ? `✓ True BRRR — ${fmt(hold.cashSurplus)} cash surplus after refinancing. Full deposit recycled for next deal at ${pct(hold.grossYield)} gross yield.`
      : `✓ BTL viable — ${fmt(hold.moneyLeftIn)} equity in deal after refinancing. ${pct(hold.grossYield)} gross yield, ${fmt(hold.netMonthlyCashflow)}/mo net cashflow.`
    : holdSteep
    ? `⚠ Returns work at ${fmt(hold.maxPurchasePrice)} but needs a ${pct(hold.discountPercent)} discount from asking — above the 20% threshold. Achievable with a motivated seller.`
    : !mortgage.icrPass
    ? `✗ Rent (${fmt(inputs.estimatedRent)}/mo) is below the lender ICR minimum (${fmt(mortgage.requiredRentForICR)}/mo). A BTL mortgage won't be approved.`
    : `✗ ROCE at asking is ${atAsking.roceMultiple.toFixed(2)}× — below the 2.5× target. Not enough cashflow relative to capital invested.`

  const recLabel =
    recommendedStrategy === "both"
      ? (flipViable || holdViable ? "Flip or BTL/BRRR" : "Both (steep discount)")
      : recommendedStrategy === "flip"
      ? (flipViable ? "Flip" : "Flip (steep discount)")
      : recommendedStrategy === "hold"
      ? (holdViable ? (isTrueBRRR ? "BRRR" : "BTL") : holdSteep ? (hold.moneyLeftIn <= 0 ? "BRRR (steep disc.)" : "BTL (steep disc.)") : "Hold")
      : "No viable strategy"

  const recBadgeClass =
    recommendedStrategy === "pass"
      ? "bg-red-100 text-red-700 border-red-200"
      : flipViable || holdViable
      ? "bg-green-100 text-green-700 border-green-200"
      : "bg-amber-100 text-amber-700 border-amber-200"

  return (
    <div className="space-y-2">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Strategy Breakdown</span>
        <div className="h-px flex-1 bg-border" />
        <Badge variant="outline" className={`text-xs font-semibold ${recBadgeClass}`}>
          Recommended: {recLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* ── Flip ── */}
        <div className={`rounded-lg border p-3 space-y-2 ${
          flipViable ? "border-green-200 bg-green-50/40" :
          flipSteep  ? "border-amber-200 bg-amber-50/30" :
                       "border-[var(--ds-border)] bg-gray-50 opacity-80"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold">Flip</span>
            </div>
            <Badge variant="outline" className={`text-xs font-semibold ${
              flipViable ? "bg-green-100 text-green-700 border-green-300" :
              flipSteep  ? "bg-amber-100 text-amber-700 border-amber-300" :
                           "text-gray-400"
            }`}>
              {flipViable ? "Viable ✓" : flipSteep ? "Steep discount" : "Not achievable"}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Buy with bridging finance, refurbish, then sell at market value for a profit.
          </p>
          <div className="space-y-1 text-xs border-t pt-2">
            <MetricRow
              label="Max offer"
              value={flipHasPrice ? fmt(flip.maxPurchasePrice) : "Not achievable"}
            />
            <MetricRow
              label="Profit on cost"
              value={pct(flipHasPrice ? flip.profitOnCost : atAsking.profitOnCost)}
              pass={(flipHasPrice ? flip.profitOnCost : atAsking.profitOnCost) >= 0.2}
              hint={flipHasPrice ? "target ≥20%" : "at asking · target ≥20%"}
            />
            <MetricRow
              label="Gross profit"
              value={fmt(flipHasPrice ? flip.profit : atAsking.profit)}
            />
            <MetricRow
              label="Discount needed"
              value={flipHasPrice ? pct(flip.discountPercent) : "—"}
              pass={flipHasPrice ? flip.viewingCriteriaMet : undefined}
              hint={flipHasPrice ? (flip.viewingCriteriaMet ? "within 20%" : "above 20% threshold") : undefined}
            />
          </div>
          <div className={`text-xs rounded p-2 leading-relaxed border-l-2 ${
            flipViable ? "border-green-400 bg-green-50 text-green-800" :
            flipSteep  ? "border-amber-400 bg-amber-50 text-amber-800" :
                         "border-red-300 bg-gray-50 text-gray-400"
          }`}>
            {flipResultMsg}
          </div>
        </div>

        {/* ── BTL / BRRR ── */}
        <div className={`rounded-lg border p-3 space-y-2 ${
          holdViable ? "border-green-200 bg-green-50/40" :
          holdSteep  ? "border-amber-200 bg-amber-50/30" :
                       "border-[var(--ds-border)] bg-gray-50 opacity-80"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Home className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold">BTL / BRRR</span>
            </div>
            <Badge variant="outline" className={`text-xs font-semibold ${
              holdViable ? "bg-green-100 text-green-700 border-green-300" :
              holdSteep  ? "bg-amber-100 text-amber-700 border-amber-300" :
                           "text-gray-400"
            }`}>
              {holdViable
                ? (isTrueBRRR ? "BRRR ✓" : "BTL ✓")
                : holdSteep
                ? "Steep discount"
                : "Not achievable"}
            </Badge>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            Buy with bridging, refurbish to add value, refinance to a BTL mortgage, and rent out.{" "}
            {holdViable && isTrueBRRR && <span className="text-green-700 font-medium">Full BRRR — all capital recycled.</span>}
            {holdViable && !isTrueBRRR && <span className="text-amber-700 font-medium">BTL exit — some equity stays in the deal.</span>}
            {holdSteep && <span className="text-amber-700 font-medium">Returns viable — motivated seller needed.</span>}
          </p>
          <div className="space-y-1 text-xs border-t pt-2">
            <MetricRow
              label="Max offer"
              value={holdHasPrice ? fmt(hold.maxPurchasePrice) : "Not achievable"}
            />
            <MetricRow
              label="ICR stress test"
              value={`${fmt(inputs.estimatedRent)}/mo vs ${fmt(mortgage.requiredRentForICR)} req.`}
              pass={mortgage.icrPass}
              hint="lender affordability"
            />
            {/* ROCE — ceiling-price value if has price, else asking-price as diagnostic */}
            <MetricRow
              label="ROCE multiple"
              value={`${(holdHasPrice ? hold.roceMultiple : atAsking.roceMultiple).toFixed(2)}×`}
              pass={(holdHasPrice ? hold.roceMultiple : atAsking.roceMultiple) >= 2.5}
              hint={holdHasPrice ? "target ≥2.5×" : "at asking · target ≥2.5×"}
            />
            {/* Net cashflow is price-independent (mortgage based on GDV) */}
            <MetricRow
              label="Net cashflow"
              value={`${fmt(cashflow.netMonthlyCashflow)}/mo`}
              pass={cashflow.netMonthlyCashflow >= 0}
            />
            {/* Money left in — ceiling price if has price, asking price as diagnostic if not */}
            <MetricRow
              label={holdHasPrice ? "Money left in" : "Capital left in"}
              value={holdHasPrice
                ? (hold.moneyLeftIn > 0 ? fmt(hold.moneyLeftIn) : `${fmt(hold.cashSurplus)} surplus`)
                : (atAsking.moneyLeftIn > 0 ? fmt(atAsking.moneyLeftIn) : "Full BRRR possible")}
              pass={holdHasPrice ? hold.moneyLeftIn <= 0 : undefined}
              hint={holdHasPrice
                ? (hold.moneyLeftIn <= 0 ? "full BRRR" : "BTL")
                : "at asking"}
            />
          </div>
          <div className={`text-xs rounded p-2 leading-relaxed border-l-2 ${
            holdViable ? "border-green-400 bg-green-50 text-green-800" :
            holdSteep  ? "border-amber-400 bg-amber-50 text-amber-800" :
                         "border-red-300 bg-gray-50 text-gray-400"
          }`}>
            {holdResultMsg}
          </div>
        </div>
      </div>
    </div>
  )
}

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
// Collapsible section wrapper
// ─────────────────────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  summary,
  children,
  defaultOpen = true,
}: {
  title: string
  summary?: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 w-full text-left group mb-0"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 group-hover:text-gray-900 transition-colors flex-1">
          {open ? <ChevronUp className="h-3.5 w-3.5 shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 shrink-0" />}
          {title}
        </span>
        {!open && summary && (
          <span className="text-xs text-gray-400 truncate">{summary}</span>
        )}
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Strategy column
// ─────────────────────────────────────────────────────────────────────────────

function StrategyColumn({
  strategy,
  data,
  askingPrice,
  result,
}: {
  strategy: "flip" | "hold"
  data: OfferCalculationResult["flip"] | OfferCalculationResult["hold"]
  askingPrice: number
  result: OfferCalculationResult
}) {
  const isFlip = strategy === "flip"
  const viable = data.maxPurchasePrice > 0
  const atAsking = !viable ? computeMetricsAtPrice(askingPrice, result.inputs) : null

  return (
    <div className="flex-1 min-w-0 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {isFlip ? (
          <TrendingUp className="h-4 w-4 text-[#2563EB] shrink-0" />
        ) : (
          <Home className="h-4 w-4 text-[#2563EB] shrink-0" />
        )}
        <span className="text-sm font-semibold uppercase tracking-wide">
          {isFlip ? "Flip" : "BTL / BRRR"}
        </span>
        <MetricTooltipIcon tooltipKey={isFlip ? "flipMaxPurchasePrice" : "holdMaxPurchasePrice"} />
      </div>

      {/* Ceiling */}
      <div>
        <p className="text-xs text-gray-400 mb-0.5 flex items-center">
          Ceiling
          <MetricTooltipIcon tooltipKey="negotiationCeiling" />
        </p>
        {viable ? (
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-xl font-bold">{fmt(data.maxPurchasePrice)}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-400 italic">No viable price</p>
            {/* Diagnostic metrics at asking price so user can see why */}
            {atAsking && (
              <div className="rounded border border-dashed border-[var(--ds-border)] bg-gray-50 p-2 space-y-1 text-xs">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Why not viable — at asking price</p>
                {!isFlip && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Rent vs ICR req.</span>
                      <span className={result.mortgage.icrPass ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                        {fmt(result.inputs.estimatedRent)}/mo vs {fmt(result.mortgage.requiredRentForICR)} req.
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ROCE multiple</span>
                      <span className={atAsking.roceMultiple >= 2.5 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                        {atAsking.roceMultiple.toFixed(2)}× <span className="text-gray-400 font-normal">(need 2.5×)</span>
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Net cashflow</span>
                      <span className={result.cashflow.netMonthlyCashflow >= 0 ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                        {fmt(result.cashflow.netMonthlyCashflow)}/mo
                      </span>
                    </div>
                  </>
                )}
                {isFlip && (
                  <>
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
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Required discount */}
      {viable && (
        <div>
          <p className="text-xs text-gray-400 mb-0.5 flex items-center">
            Required Discount
            <MetricTooltipIcon tooltipKey="viewingCriteria" />
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">
              {pct(data.discountPercent)}{" "}
              <span className="text-gray-400 text-xs">
                ({fmt(data.discountFromAsking)} off {fmt(askingPrice)})
              </span>
            </p>
          </div>
          <div className="mt-0.5">
            <PassBadge
              pass={data.viewingCriteriaMet}
              passLabel="Viewing: PASS"
              failLabel={`Viewing: FAIL — >${pct(data.discountPercent)}`}
            />
          </div>
        </div>
      )}

      {/* Return at ceiling */}
      {viable && isFlip && (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-gray-400 flex items-center">
            Return at ceiling
            <MetricTooltipIcon tooltipKey="profitOnCost" />
          </p>
          <div className="flex justify-between">
            <span className="text-gray-400">Profit on Cost</span>
            <span
              className={`font-semibold ${
                data.profitOnCost >= 0.2
                  ? "text-green-600"
                  : data.profitOnCost >= 0.1
                  ? "text-amber-600"
                  : "text-red-500"
              }`}
            >
              {pct(data.profitOnCost)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Profit</span>
            <span className="font-semibold">{fmt(data.profit)}</span>
          </div>
        </div>
      )}

      {viable && !isFlip && (
        <div className="space-y-1 text-sm">
          <p className="text-xs text-gray-400 flex items-center">
            Return at ceiling
            <MetricTooltipIcon tooltipKey="roceMultiple" />
          </p>
          <div className="flex justify-between">
            <span className="text-gray-400">ROCE Multiple</span>
            <span
              className={`font-semibold ${
                data.roceMultiple >= 2.5
                  ? "text-green-600"
                  : data.roceMultiple >= 1.5
                  ? "text-amber-600"
                  : "text-red-500"
              }`}
            >
              {data.roceMultiple.toFixed(2)}x
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center">
              Net CF
              <MetricTooltipIcon tooltipKey="netMonthlyCashflow" />
            </span>
            <span
              className={`font-semibold ${
                data.netMonthlyCashflow >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {fmt(data.netMonthlyCashflow)}/mo
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center">
              Money Left In
              <MetricTooltipIcon tooltipKey="moneyLeftIn" />
            </span>
            <span className="font-semibold">
              {data.moneyLeftIn > 0 ? fmt(data.moneyLeftIn) : (
                <span className="text-green-600">{fmt(data.cashSurplus)} surplus</span>
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-400 flex items-center">
              Gross Yield
              <MetricTooltipIcon tooltipKey="grossYield" />
            </span>
            <span className="font-semibold">{pct(data.grossYield)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Financial breakdown (collapsible)
// ─────────────────────────────────────────────────────────────────────────────

function FinancialBreakdown({ result }: { result: OfferCalculationResult }) {
  const { bridging, mortgage, cashflow, flip } = result

  return (
    <CollapsibleSection
      title="Financial Breakdown"
      summary={`Bridge ${fmt(bridging.totalCosts)} · Equity ${fmt(flip.totalEquityInvested)}`}
      defaultOpen={false}
    >
      <div className="grid md:grid-cols-2 gap-6 text-sm">
          {/* Bridging Finance */}
          <div>
            <p className="font-semibold mb-2 text-xs uppercase tracking-wide text-gray-400 flex items-center">
              Bridging Finance
              <MetricTooltipIcon tooltipKey="bridgingTotalCosts" />
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center">
                  Gross Loan (75% LTV)
                  <MetricTooltipIcon tooltipKey="bridgingGrossLoan" />
                </span>
                <span className="font-medium">{fmt(bridging.grossLoan)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center">
                  Net Advance
                  <MetricTooltipIcon tooltipKey="bridgingNetLoanAdvance" />
                </span>
                <span className="font-medium">{fmt(bridging.netLoanAdvance)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 flex items-center">
                  Deposit
                  <MetricTooltipIcon tooltipKey="bridgingDeposit" />
                </span>
                <span className="font-medium">{fmt(bridging.deposit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Arrangement Fee</span>
                <span className="font-medium">{fmt(bridging.arrangementFee)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Monthly Interest</span>
                <span className="font-medium">{fmt(bridging.monthlyInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Interest</span>
                <span className="font-medium">{fmt(bridging.totalInterest)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Exit Fee</span>
                <span className="font-medium">{fmt(bridging.exitFee)}</span>
              </div>
              <div className="flex justify-between border-t pt-1 font-semibold">
                <span>Total Bridging Costs</span>
                <span>{fmt(bridging.totalCosts)}</span>
              </div>
            </div>
          </div>

          {/* Mortgage (Exit) */}
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
              <div
                className={`flex justify-between border-t pt-1 font-semibold ${
                  cashflow.netMonthlyCashflow >= 0 ? "text-green-600" : "text-red-500"
                }`}
              >
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
    </CollapsibleSection>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Assumptions override panel (collapsible)
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
  // Start expanded when refurb was defaulted so the user sees the estimated value
  const [editMode, setEditMode] = useState(hasDefaultedRefurb)
  const [vals, setVals] = useState<AssumptionsState>(defaults)

  const set = (key: keyof AssumptionsState) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setVals((prev) => ({ ...prev, [key]: e.target.value }))
  }

  return (
    <div className="border-t pt-4">
      {/* Always-visible summary row */}
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

      {/* Editable form — shown when editMode */}
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
}: OfferAnalysisPanelProps) {
  const [result, setResult] = useState<OfferCalculationResult | null>(null)
  const [ladders, setLadders] = useState<{
    flip: NegotiationLadder | null
    hold: NegotiationLadder | null
  } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calculatedAt, setCalculatedAt] = useState<string | null>(null)

  // If refurb cost not yet set, estimate 10% of GDV as a standard light-refurb default
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error")
      } finally {
        setLoading(false)
      }
    },
    [dealId, askingPrice, gdv, estimatedRent, totalRefurbishment]
  )

  // Auto-calculate on mount for vendor lead mode (no dealId) when we have enough data
  useEffect(() => {
    if (dealId) return // deal mode loads from cache separately
    if (hasRequiredInputs) {
      void runCalculation(assumptionDefaults)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally run once on mount only

  // Load cached result on mount (deal mode only)
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
          }
        }
      } catch {
        // No cache — that's fine
      }
    }
    void loadCached()
  }, [dealId])

  const viabilityBadgeClass =
    result?.dealViability === "strong"
      ? "bg-green-100 text-green-700 border-green-200"
      : result?.dealViability === "marginal"
      ? "bg-amber-100 text-amber-700 border-amber-200"
      : "bg-red-100 text-red-600 border-red-200"

  const viabilityColor =
    result?.dealViability === "strong"
      ? "text-green-600"
      : result?.dealViability === "marginal"
      ? "text-amber-600"
      : "text-red-500"

  return (
    <TooltipProvider delayDuration={300}>
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 text-base">Offer Analysis Engine</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Based on Excel PropertyAnalyser methodology
                {calculatedAt && ` · Last calculated: ${calculatedAt}`}
              </p>
            </div>
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
          </div>
        </div>

        <div className="p-5 space-y-5">          {/* Missing inputs warning — only shown when GDV or rent are absent (refurb has a default) */}
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

          {result && (
            <>
              {/* ── Asking price summary ─────────────────────────────────── */}
              <div className="flex items-center gap-3 text-sm text-gray-400 pb-2 border-b">
                <span className="flex items-center">
                  Asking Price
                  <MetricTooltipIcon tooltipKey="askingPrice" />
                </span>
                <span className="font-semibold text-gray-900">{fmt(askingPrice)}</span>
                <span className="text-gray-400">·</span>
                <span className="flex items-center">
                  GDV
                  <MetricTooltipIcon tooltipKey="gdv" />
                </span>
                <span className="font-semibold text-gray-900">
                  {fmt(result.inputs.gdv)}
                </span>
              </div>

              {/* ── Offer Ceilings Summary ────────────────────────────── */}
              {(() => {
                const rec = result.recommendedStrategy
                const flipHasPrice = result.flip.maxPurchasePrice > 0
                const holdHasPrice = result.hold.maxPurchasePrice > 0
                if (!flipHasPrice && !holdHasPrice) return null
                const flipCeiling = result.flip.maxPurchasePrice
                const holdCeiling = result.hold.maxPurchasePrice
                const flipOpening = flipHasPrice ? Math.round(flipCeiling * 0.88 / 50) * 50 : 0
                const holdOpening = holdHasPrice ? Math.round(holdCeiling * 0.88 / 50) * 50 : 0
                const isFlipRec = rec === "flip" || rec === "both"
                const isHoldRec = rec === "hold" || rec === "both"
                return (
                  <div className="rounded-lg border border-[var(--ds-border)] bg-gray-50 p-3 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      Offer Ceilings — Opening → Best &amp; Final
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {/* Flip tile */}
                      <div className={`rounded-md border p-2.5 ${
                        !flipHasPrice ? "opacity-60 bg-gray-50 border-[var(--ds-border)]" :
                        isFlipRec ? "border-[#2563EB]/40 bg-[#2563EB]/5" : "border-[var(--ds-border)] bg-white"
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold flex items-center gap-1 text-gray-400">
                            <TrendingUp className="h-3 w-3" /> Flip
                          </span>
                          {isFlipRec && flipHasPrice && (
                            <span className="text-[9px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-1.5 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        {flipHasPrice ? (
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[10px] text-gray-400">Opening</span>
                              <span className="text-sm font-semibold">{fmt(flipOpening)}</span>
                              <span className="text-gray-400 text-[10px]">→</span>
                              <span className={`text-base font-bold ${isFlipRec ? "text-[#2563EB]" : ""}`}>{fmt(flipCeiling)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pct(result.flip.discountPercent)} off asking</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Not achievable</p>
                        )}
                      </div>

                      {/* BTL / BRRR tile */}
                      <div className={`rounded-md border p-2.5 ${
                        !holdHasPrice ? "opacity-60 bg-gray-50 border-[var(--ds-border)]" :
                        isHoldRec ? "border-[#2563EB]/40 bg-[#2563EB]/5" : "border-[var(--ds-border)] bg-white"
                      }`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold flex items-center gap-1 text-gray-400">
                            <Home className="h-3 w-3" /> BTL / BRRR
                          </span>
                          {isHoldRec && holdHasPrice && (
                            <span className="text-[9px] font-semibold text-[#2563EB] bg-[#2563EB]/10 px-1.5 py-0.5 rounded-full">
                              Recommended
                            </span>
                          )}
                        </div>
                        {holdHasPrice ? (
                          <div>
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[10px] text-gray-400">Opening</span>
                              <span className="text-sm font-semibold">{fmt(holdOpening)}</span>
                              <span className="text-gray-400 text-[10px]">→</span>
                              <span className={`text-base font-bold ${isHoldRec ? "text-[#2563EB]" : ""}`}>{fmt(holdCeiling)}</span>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-0.5">{pct(result.hold.discountPercent)} off asking</p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400 italic">Not achievable</p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      Opening = 88% of ceiling to anchor negotiations · Ceiling = goal-seek maximum, do not exceed · Each strategy has its own ceiling
                    </p>
                  </div>
                )
              })()}

              {/* ── Strategy rationale — always visible ──────────────────── */}
              <StrategyRationale result={result} />

              {/* ── Two-column strategy display ──────────────────────────── */}
              <CollapsibleSection
                title="Offer Strategy"
                summary={`Flip ${fmt(result.flip.maxPurchasePrice)} · Hold ${fmt(result.hold.maxPurchasePrice)}`}
                defaultOpen={false}
              >
                <div className="flex gap-6 flex-col sm:flex-row">
                  <StrategyColumn
                    strategy="flip"
                    data={result.flip}
                    askingPrice={askingPrice}
                    result={result}
                  />
                  <div className="hidden sm:block w-px bg-border self-stretch" />
                  <StrategyColumn
                    strategy="hold"
                    data={result.hold}
                    askingPrice={askingPrice}
                    result={result}
                  />
                </div>
              </CollapsibleSection>

              {/* ── Negotiation ladder ───────────────────────────────────── */}
              {ladders && (
                <CollapsibleSection
                  title="Negotiation Ladder"
                  summary={`Opening → Counter 1 → Counter 2 → Best & Final`}
                  defaultOpen={false}
                >
                  <NegotiationLadderPanel
                    flipLadder={ladders.flip}
                    holdLadder={ladders.hold}
                    dealId={dealId}
                    onOfferSent={onOfferSent}
                    readOnly={readOnly}
                    vendorLeadId={vendorLeadId}
                    vendorName={vendorName}
                    vendorEmail={vendorEmail}
                    vendorPhone={vendorPhone}
                  />
                </CollapsibleSection>
              )}

              {/* ── Financial breakdown (collapsible, starts closed) ─────── */}
              <FinancialBreakdown result={result} />

              {/* ── Deal viability score ────────────────────────────────── */}
              <CollapsibleSection
                title="Deal Viability"
                summary={`${result.viabilityScore}/100 · ${result.dealViability === "pass" ? "No Deal" : result.dealViability}`}
                defaultOpen={true}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ViabilityDots score={result.viabilityScore} />
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold capitalize ${viabilityBadgeClass}`}
                    >
                      {result.dealViability === "pass" ? "No Deal" : result.dealViability}
                    </Badge>
                    <span className={`text-sm font-semibold ${viabilityColor}`}>
                      {result.viabilityScore}/100
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
                <ul className="mt-2 space-y-1">
                  {result.viabilityNotes.map((note, i) => (
                    <li key={i} className="text-xs text-gray-400 flex items-start gap-1.5">
                      <span className="mt-0.5 shrink-0">•</span>
                      <span>{note}</span>
                    </li>
                  ))}
                </ul>

                {/* Reject deal button lives inside viability so it's contextual */}
                {onReject && !readOnly && (
                  <div className="pt-3 mt-3 border-t">
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
              </CollapsibleSection>
            </>
          )}

          {/* Assumptions override — always visible when we have base inputs */}
          {hasRequiredInputs && (
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
