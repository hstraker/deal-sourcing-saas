"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight, Info, Calculator, TrendingUp, AlertTriangle, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import {
  calculateSdlt,
  calculateAcquisitionCost,
  type SdltBuyerType,
  type AcquisitionCostResult,
} from "@/lib/sdlt"

// ── helpers ───────────────────────────────────────────────────────────────────

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n)
}

function pct(n: number) { return `${n.toFixed(2)}%` }

const BUYER_TYPE_OPTIONS: { value: SdltBuyerType; label: string }[] = [
  { value: "individual_additional", label: "Individual — BTL / Additional Property" },
  { value: "company",               label: "Company Purchase" },
  { value: "individual_main",       label: "Individual — Main Residence" },
  { value: "first_time_buyer",      label: "First-Time Buyer" },
]

// ── SDLT band table ───────────────────────────────────────────────────────────

function SdltBreakdown({ purchasePrice, buyerType }: { purchasePrice: number; buyerType: SdltBuyerType }) {
  const result = useMemo(() => calculateSdlt(purchasePrice, buyerType), [purchasePrice, buyerType])

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Band</th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Rate</th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Taxable</th>
              <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Tax</th>
            </tr>
          </thead>
          <tbody>
            {result.bands.map((band, i) => (
              <tr key={i} className={cn("border-b border-gray-100 last:border-0", i % 2 === 0 ? "bg-white" : "bg-gray-50/50")}>
                <td className="px-3 py-1.5 text-gray-600">
                  {gbp(band.from)} – {band.to ? gbp(band.to) : "above"}
                </td>
                <td className="px-3 py-1.5 text-right font-semibold text-gray-800">{band.rate}%</td>
                <td className="px-3 py-1.5 text-right text-gray-600">{gbp(band.taxableAmount)}</td>
                <td className="px-3 py-1.5 text-right font-bold text-gray-900">{gbp(band.tax)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-blue-50 border-t-2 border-blue-200">
              <td colSpan={2} className="px-3 py-2 text-xs font-bold text-blue-800">
                Total SDLT — Effective rate {pct(result.effectiveRate)}
              </td>
              <td className="px-3 py-2" />
              <td className="px-3 py-2 text-right text-sm font-extrabold text-blue-700">{gbp(result.totalTax)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
      {result.notes.map((note, i) => (
        <p key={i} className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
          ⚠ {note}
        </p>
      ))}
    </div>
  )
}

// ── All-In cost table ─────────────────────────────────────────────────────────

function AllInCostTable({ result }: { result: AcquisitionCostResult }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-xs">
        <tbody>
          {result.lines.map((line, i) => (
            <tr key={i} className={cn(
              "border-b border-gray-100",
              i === 0 ? "bg-white font-semibold" : "bg-gray-50/30"
            )}>
              <td className={cn("px-3 py-2", line.isCalculated ? "text-blue-700" : "text-gray-700")}>
                {line.isCalculated && <span className="mr-1 text-[10px] text-blue-500">∑</span>}
                {line.label}
              </td>
              <td className="px-3 py-2 text-right font-bold text-gray-900">{gbp(line.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-green-50 border-t-2 border-green-300">
            <td className="px-3 py-2.5 text-sm font-extrabold text-green-800">
              Total Cash Required
            </td>
            <td className="px-3 py-2.5 text-right text-base font-extrabold text-green-700">
              {gbp(result.totalCashRequired)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Editable cost inputs ──────────────────────────────────────────────────────

interface CostOverrides {
  buyerType: SdltBuyerType
  solicitorFees: number
  surveyFee: number
  bridgingCost: number
  insurance: number
}

function CostInputRow({
  label, value, onChange, tooltip,
}: {
  label: string; value: number; onChange: (v: number) => void; tooltip?: string
}) {
  const [raw, setRaw] = useState(String(value))

  return (
    <div className="flex items-center justify-between gap-3">
      <TooltipProvider delayDuration={200}>
        <span className="flex items-center gap-1 text-xs text-gray-600 shrink-0">
          {label}
          {tooltip && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-gray-400 cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[200px] text-[11px]">{tooltip}</TooltipContent>
            </Tooltip>
          )}
        </span>
      </TooltipProvider>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">£</span>
        <input
          type="number"
          className="w-28 rounded border border-gray-200 pl-5 pr-2 py-1 text-xs text-right font-semibold text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
          value={raw}
          onChange={e => {
            setRaw(e.target.value)
            const n = parseFloat(e.target.value)
            if (!isNaN(n) && n >= 0) onChange(n)
          }}
          onBlur={() => setRaw(String(value))}
          min={0}
        />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export interface AcquisitionCostPanelProps {
  purchasePrice: number
  refurbCost?: number
  /** Monthly rent for ICR / cashflow calculations in the mortgage section */
  monthlyRent?: number
  /** Persisted overrides from the lead record */
  savedBuyerType?: string | null
  savedSolicitorFees?: number | null
  savedSurveyFee?: number | null
  savedBridgingCost?: number | null
  savedInsurance?: number | null
  /** Called when user changes any field — parent can save to DB */
  onSave?: (overrides: Partial<CostOverrides>) => void
}

export function AcquisitionCostPanel({
  purchasePrice,
  refurbCost = 0,
  monthlyRent = 0,
  savedBuyerType,
  savedSolicitorFees,
  savedSurveyFee,
  savedBridgingCost,
  savedInsurance,
  onSave,
}: AcquisitionCostPanelProps) {
  const [buyerType, setBuyerType] = useState<SdltBuyerType>(
    (savedBuyerType as SdltBuyerType) ?? "individual_additional"
  )
  const [solicitorFees, setSolicitorFees] = useState(savedSolicitorFees ?? 1800)
  const [surveyFee, setSurveyFee] = useState(savedSurveyFee ?? 600)
  const [bridgingCost, setBridgingCost] = useState(savedBridgingCost ?? 0)
  const [insurance, setInsurance] = useState(savedInsurance ?? 400)
  const [sdltOpen, setSdltOpen] = useState(false)
  const [ltvPct, setLtvPct] = useState(75)
  const [mortgageRate, setMortgageRate] = useState(5.5)
  const [mortgageOpen, setMortgageOpen] = useState(true)

  const result = useMemo(() => calculateAcquisitionCost({
    purchasePrice,
    buyerType,
    solicitorFees,
    surveyFee,
    bridgingCostTotal: bridgingCost,
    insuranceFirstYear: insurance,
    refurbCost,
  }), [purchasePrice, buyerType, solicitorFees, surveyFee, bridgingCost, insurance, refurbCost])

  // ── Mortgage calculations ───────────────────────────────────────────────────
  const mortgageAmount   = Math.round(purchasePrice * ltvPct / 100)
  const deposit          = purchasePrice - mortgageAmount
  // Interest-only monthly payment (standard for BTL)
  const monthlyPayment   = Math.round(mortgageAmount * (mortgageRate / 100) / 12)
  // Total cash-in with mortgage = deposit + all costs EXCEPT the purchase price itself
  const otherCosts       = result.totalCashRequired - purchasePrice
  const totalCashIn      = deposit + otherCosts
  const monthlyCashflow  = monthlyRent > 0 ? monthlyRent - monthlyPayment : null
  // ICR: rent / mortgage payment × 100 — lenders typically require ≥125%
  const icr              = monthlyPayment > 0 && monthlyRent > 0
                             ? Math.round((monthlyRent / monthlyPayment) * 100)
                             : null
  const icrPass          = icr !== null && icr >= 125

  const sdlt = result.sdlt

  function handleChange<K extends keyof CostOverrides>(key: K, value: CostOverrides[K]) {
    if (key === "buyerType") setBuyerType(value as SdltBuyerType)
    else if (key === "solicitorFees") setSolicitorFees(value as number)
    else if (key === "surveyFee") setSurveyFee(value as number)
    else if (key === "bridgingCost") setBridgingCost(value as number)
    else if (key === "insurance") setInsurance(value as number)
    onSave?.({ [key]: value })
  }

  if (!purchasePrice || purchasePrice <= 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
        <Calculator className="h-6 w-6 text-gray-300 mx-auto mb-2" />
        <p className="text-xs text-gray-400">Enter a purchase price to calculate acquisition costs</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* Buyer type selector */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
          Buyer Type
        </label>
        <select
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-800 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100"
          value={buyerType}
          onChange={e => handleChange("buyerType", e.target.value as SdltBuyerType)}
        >
          {BUYER_TYPE_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* SDLT summary — click to expand full band table */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-blue-100/60 transition-colors"
          onClick={() => setSdltOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {sdltOpen ? <ChevronDown className="h-3.5 w-3.5 text-blue-500" /> : <ChevronRight className="h-3.5 w-3.5 text-blue-500" />}
            <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
              SDLT — {sdlt.label}
            </span>
          </div>
          <div className="text-right">
            <span className="text-base font-extrabold text-blue-700">{gbp(sdlt.totalTax)}</span>
            <span className="ml-2 text-[10px] text-blue-500">({pct(sdlt.effectiveRate)} effective)</span>
          </div>
        </button>
        {sdltOpen && (
          <div className="px-4 pb-4 pt-1">
            <SdltBreakdown purchasePrice={purchasePrice} buyerType={buyerType} />
          </div>
        )}
      </div>

      {/* Cost inputs */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          Adjust Cost Estimates
        </p>
        <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
          <CostInputRow
            label="Solicitor / Legal Fees"
            value={solicitorFees}
            onChange={v => handleChange("solicitorFees", v)}
            tooltip="Conveyancing fees typically £1,500–£3,000 including disbursements"
          />
          <CostInputRow
            label="Survey"
            value={surveyFee}
            onChange={v => handleChange("surveyFee", v)}
            tooltip="Homebuyer report £400–£700, full structural survey £600–£1,500"
          />
          <CostInputRow
            label="Bridging Finance Costs"
            value={bridgingCost}
            onChange={v => handleChange("bridgingCost", v)}
            tooltip="Total bridging costs: arrangement fee + monthly interest + exit fee"
          />
          <CostInputRow
            label="Buildings Insurance (yr 1)"
            value={insurance}
            onChange={v => handleChange("insurance", v)}
            tooltip="First year premium — required from exchange of contracts"
          />
        </div>
      </div>

      {/* All-In cost table */}
      <div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">
          All-In Cost of Acquisition (Cash Purchase)
        </p>
        <AllInCostTable result={result} />
      </div>

      {/* BTL Mortgage section */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-indigo-100/60 transition-colors"
          onClick={() => setMortgageOpen(o => !o)}
        >
          <div className="flex items-center gap-2">
            {mortgageOpen
              ? <ChevronDown className="h-3.5 w-3.5 text-indigo-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-indigo-500" />}
            <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">
              BTL Mortgage — Cash-In Calculator
            </span>
          </div>
          <span className="text-[10px] text-indigo-400">interest-only</span>
        </button>

        {mortgageOpen && (
          <div className="px-4 pb-4 pt-2 space-y-3">
            {/* LTV & rate controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1.5">
                  LTV %
                </label>
                <div className="flex gap-1">
                  {[65, 70, 75, 80].map(v => (
                    <button
                      key={v}
                      onClick={() => setLtvPct(v)}
                      className={cn(
                        "flex-1 rounded py-1 text-[11px] font-bold transition-colors",
                        ltvPct === v
                          ? "bg-indigo-600 text-white"
                          : "bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                      )}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-1.5">
                  Interest Rate %
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    min={1}
                    max={15}
                    value={mortgageRate}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      if (!isNaN(v) && v > 0) setMortgageRate(v)
                    }}
                    className="w-full rounded border border-indigo-200 bg-white px-3 pr-7 py-1 text-xs font-semibold text-indigo-800 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-100"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400">%</span>
                </div>
              </div>
            </div>

            {/* Mortgage breakdown table */}
            <div className="overflow-hidden rounded-lg border border-indigo-200 bg-white text-xs">
              <table className="w-full">
                <tbody>
                  <tr className="border-b border-indigo-100">
                    <td className="px-3 py-2 text-indigo-700">Purchase Price</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{gbp(purchasePrice)}</td>
                  </tr>
                  <tr className="border-b border-indigo-100 bg-indigo-50/40">
                    <td className="px-3 py-2 text-indigo-700">Mortgage ({ltvPct}% LTV)</td>
                    <td className="px-3 py-2 text-right font-bold text-indigo-700">{gbp(mortgageAmount)}</td>
                  </tr>
                  <tr className="border-b border-indigo-100">
                    <td className="px-3 py-2 text-indigo-700">Deposit ({100 - ltvPct}%)</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{gbp(deposit)}</td>
                  </tr>
                  <tr className="border-b border-indigo-100 bg-indigo-50/40">
                    <td className="px-3 py-2 text-indigo-700">Acquisition Costs (SDLT + fees)</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{gbp(otherCosts)}</td>
                  </tr>
                  <tr className="border-b border-indigo-100">
                    <td className="px-3 py-2 text-indigo-700">Monthly Payment (interest-only)</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{gbp(monthlyPayment)}/mo</td>
                  </tr>
                  {monthlyRent > 0 && monthlyCashflow !== null && (
                    <tr className={cn("border-b border-indigo-100", monthlyCashflow >= 0 ? "bg-green-50" : "bg-red-50")}>
                      <td className={cn("px-3 py-2", monthlyCashflow >= 0 ? "text-green-700" : "text-red-700")}>
                        Est. Monthly Cashflow (rent − mortgage)
                      </td>
                      <td className={cn("px-3 py-2 text-right font-bold", monthlyCashflow >= 0 ? "text-green-700" : "text-red-700")}>
                        {monthlyCashflow >= 0 ? "+" : ""}{gbp(monthlyCashflow)}/mo
                      </td>
                    </tr>
                  )}
                  {icr !== null && (
                    <tr className={cn(icrPass ? "bg-green-50" : "bg-amber-50")}>
                      <td className={cn("px-3 py-2 flex items-center gap-1", icrPass ? "text-green-700" : "text-amber-700")}>
                        {icrPass
                          ? <CheckCircle2 className="h-3 w-3 shrink-0" />
                          : <AlertTriangle className="h-3 w-3 shrink-0" />}
                        ICR (lender stress test ≥125%)
                      </td>
                      <td className={cn("px-3 py-2 text-right font-bold", icrPass ? "text-green-700" : "text-amber-700")}>
                        {icr}%
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Cash-In highlight */}
            <div className="rounded-lg bg-indigo-600 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200">
                  Total Cash Required (with mortgage)
                </p>
                <p className="text-[10px] text-indigo-300 mt-0.5">
                  Deposit + SDLT + all fees (excluding refurb)
                </p>
              </div>
              <p className="text-xl font-extrabold text-white">{gbp(totalCashIn)}</p>
            </div>

            {!monthlyRent && (
              <p className="text-[10px] text-indigo-500 text-center">
                Run BMV calculation to see cashflow and ICR figures
              </p>
            )}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-400">
        ∑ = calculated automatically. Adjust figures above to match your actual costs.
        SDLT rates as of April 2026 — verify with your solicitor.
      </p>
    </div>
  )
}
