// components/deals/deal-detail-modal.tsx
"use client"

import { useState } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import type { DealWithRelations } from "@/types/deal"
import { DealScoreRing } from "./deal-score-ring"
import { OfferAnalysisPanel } from "./offer-analysis-panel"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { StatusBadge } from "@/components/ui/status-badge"
import { getDealStatusVarKey } from "@/lib/theme/status-colors"

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatStatus(status: string) {
  return status
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function bmvColor(v: number | null) {
  if (v === null) return "text-gray-400"
  if (v >= 15) return "text-green-500"
  if (v >= 5) return "text-amber-500"
  return "text-red-500"
}

function yieldColor(v: number | null) {
  if (v === null) return "text-gray-400"
  if (v >= 6) return "text-green-500"
  if (v >= 4) return "text-amber-500"
  return "text-red-500"
}

function fmt(v: number | null) {
  return v !== null ? formatCurrency(v) : "—"
}

function pct(v: number | null, decimals = 1) {
  return v !== null ? `${v.toFixed(decimals)}%` : "—"
}

// Maps deal.recommendedStrategy to which card gets the badge
function getRecommendedStrategy(rec: string | null): "btl" | "flip" | "brrr" | null {
  if (!rec) return null
  const r = rec.toLowerCase()
  if (r === "hold" || r === "btl") return "btl"
  if (r === "flip") return "flip"
  if (r === "brrrr" || r === "brrr") return "brrr"
  return null
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        )}
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  )
}

function MetricRow({
  label,
  value,
  colorClass,
}: {
  label: string
  value: string
  colorClass?: string
}) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className={cn("text-sm font-semibold", colorClass ?? "text-gray-900")}>
        {value}
      </span>
    </div>
  )
}

// ── Exit Strategy: card shell ──────────────────────────────────────────────────

function ExitCard({
  title,
  accentColor,
  recommended,
  children,
}: {
  title: string
  accentColor: string
  recommended: boolean
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col gap-1",
        recommended ? "border-2" : "border-gray-200"
      )}
      style={recommended ? { borderColor: accentColor } : undefined}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold" style={{ color: accentColor }}>
          {title}
        </span>
        {recommended && (
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded text-white"
            style={{ backgroundColor: accentColor }}
          >
            RECOMMENDED
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

function CardRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs font-medium text-gray-800">{value}</span>
    </div>
  )
}

function CardRowHighlight({
  label,
  value,
  color,
  hint,
}: {
  label: string
  value: string
  color?: string
  hint?: string
}) {
  return (
    <div className="flex justify-between items-start py-1.5 border-b border-gray-100 last:border-0">
      <div>
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        {hint && <p className="text-[10px] text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <span
        className="text-sm font-bold ml-2 shrink-0"
        style={{ color: color ?? "#111827" }}
      >
        {value}
      </span>
    </div>
  )
}

// ── Section A: Exit Strategy Cards ────────────────────────────────────────────

function ExitStrategyCards({ deal }: { deal: DealWithRelations }) {
  const recommended = getRecommendedStrategy((deal as any).recommendedStrategy ?? null)

  const askingPrice = Number(deal.askingPrice)
  const marketValue = (deal as any).marketValue != null ? Number((deal as any).marketValue) : null
  const refurb = (deal as any).estimatedRefurbCost != null ? Number((deal as any).estimatedRefurbCost) : null
  const arv = (deal as any).afterRefurbValue != null ? Number((deal as any).afterRefurbValue) : null
  const rent = (deal as any).estimatedMonthlyRent != null ? Number((deal as any).estimatedMonthlyRent) : null
  const netYield = (deal as any).netYield != null ? Number((deal as any).netYield) : null

  if (marketValue === null) {
    return (
      <p className="text-sm text-gray-400 italic">
        Market value required — run deal analysis first
      </p>
    )
  }

  // BTL
  const btlCashFlow =
    rent !== null ? rent - (marketValue * 0.75 * 0.055) / 12 : null

  // Flip
  const flipProfit =
    refurb !== null
      ? marketValue - askingPrice - refurb
      : marketValue - askingPrice

  // BRRR
  const brrrCosts = refurb !== null ? askingPrice + refurb : null
  const brrrRefi = arv !== null ? arv * 0.75 : null
  let brrrCapLabel = "Capital Position"
  let brrrCapValue = "—"
  let brrrCapColor: string | undefined

  if (brrrCosts !== null && brrrRefi !== null) {
    const diff = brrrCosts - brrrRefi
    if (Math.abs(diff) < 1) {
      brrrCapLabel = "Fully Recycled"
      brrrCapValue = "£0"
      brrrCapColor = "#22c55e"
    } else if (diff > 0) {
      brrrCapLabel = "Capital Remaining"
      brrrCapValue = formatCurrency(diff)
      brrrCapColor = "#f59e0b"
    } else {
      brrrCapLabel = "Equity Released"
      brrrCapValue = formatCurrency(Math.abs(diff))
      brrrCapColor = "#22c55e"
    }
  }

  const brrrYield =
    rent !== null && arv !== null ? (rent * 12) / arv * 100 : null

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* BTL */}
      <ExitCard title="BTL" accentColor="#22c55e" recommended={recommended === "btl"}>
        <CardRow label="Purchase Price" value={formatCurrency(askingPrice)} />
        <CardRow label="Refurbishment" value={fmt(refurb)} />
        <CardRow label="Monthly Rent" value={fmt(rent)} />
        <CardRowHighlight
          label="Monthly Cash Flow"
          value={fmt(btlCashFlow)}
          color={
            btlCashFlow !== null
              ? btlCashFlow >= 0
                ? "#22c55e"
                : "#ef4444"
              : undefined
          }
          hint="est. 75% LTV, 5.5% IO, excl. mgmt fees"
        />
        <CardRow label="Net Yield" value={pct(netYield)} />
      </ExitCard>

      {/* Flip */}
      <ExitCard title="Flip" accentColor="#6eb5ff" recommended={recommended === "flip"}>
        <CardRow label="Purchase Price" value={formatCurrency(askingPrice)} />
        <CardRow label="Refurbishment" value={fmt(refurb)} />
        <CardRow label="Sale Price / GDV" value={fmt(marketValue)} />
        <CardRowHighlight
          label="Gross Profit"
          value={fmt(flipProfit)}
          color={flipProfit >= 0 ? "#6eb5ff" : "#ef4444"}
        />
      </ExitCard>

      {/* BRRR */}
      <ExitCard title="BRRR" accentColor="#a78bfa" recommended={recommended === "brrr"}>
        <CardRow
          label="Buy + Refurb"
          value={brrrCosts !== null ? formatCurrency(brrrCosts) : "—"}
        />
        <CardRow label="ARV" value={fmt(arv)} />
        <CardRow
          label="Refinance (75% ARV)"
          value={brrrRefi !== null ? formatCurrency(brrrRefi) : "—"}
        />
        <CardRowHighlight
          label={brrrCapLabel}
          value={brrrCapValue}
          color={brrrCapColor}
        />
        <CardRow label="Post-Refi Yield" value={pct(brrrYield)} />
      </ExitCard>
    </div>
  )
}

// ── Section B: Financial Waterfall ────────────────────────────────────────────

function FinancialWaterfall({ deal }: { deal: DealWithRelations }) {
  const askingPrice = Number(deal.askingPrice)
  const marketValue = (deal as any).marketValue != null ? Number((deal as any).marketValue) : null
  const refurb = (deal as any).estimatedRefurbCost != null ? Number((deal as any).estimatedRefurbCost) : null

  if (marketValue === null) {
    return (
      <p className="text-sm text-gray-400 italic">
        Market value required — run deal analysis first
      </p>
    )
  }

  const refurbCost = refurb ?? 0
  const stampDuty = askingPrice * 0.03
  const legalFees = 2500
  const totalCostIn = askingPrice + refurbCost + stampDuty + legalFees
  const grossProfit = marketValue - totalCostIn

  const rows: Array<{ label: string; value: string; indent?: boolean; separator?: boolean; highlight?: boolean; color?: string }> = [
    { label: "Purchase Price", value: formatCurrency(askingPrice) },
    {
      label: refurb !== null ? "+ Refurbishment" : "+ Refurbishment (no refurb entered)",
      value: formatCurrency(refurbCost),
      indent: true,
    },
    { label: "+ Stamp Duty (3% estimate)", value: formatCurrency(stampDuty), indent: true },
    { label: "+ Legal / Survey Fees (estimate)", value: formatCurrency(legalFees), indent: true },
    { label: "= Total Cost In", value: formatCurrency(totalCostIn), separator: true, highlight: true },
    { label: "Market Value (GDV)", value: formatCurrency(marketValue) },
    {
      label: "= Gross Profit / Equity",
      value: formatCurrency(grossProfit),
      separator: true,
      highlight: true,
      color: grossProfit >= 0 ? "#22c55e" : "#ef4444",
    },
  ]

  return (
    <div className="divide-y divide-gray-100">
      {rows.map((row, i) => (
        <div
          key={i}
          className={cn(
            "flex justify-between items-center py-2",
            row.indent && "pl-4",
            row.separator && "border-t-2 border-gray-300 pt-2 mt-1"
          )}
        >
          <span
            className={cn(
              "text-sm",
              row.highlight ? "font-semibold text-gray-800" : "text-gray-500"
            )}
          >
            {row.label}
          </span>
          <span
            className={cn("text-sm font-semibold", !row.color && "text-gray-900")}
            style={row.color ? { color: row.color } : undefined}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Section C: Mortgage Scenarios ─────────────────────────────────────────────

function MortgageScenarios({ deal }: { deal: DealWithRelations }) {
  const marketValue = (deal as any).marketValue != null ? Number((deal as any).marketValue) : null
  const rent = (deal as any).estimatedMonthlyRent != null ? Number((deal as any).estimatedMonthlyRent) : null

  if (marketValue === null) {
    return (
      <p className="text-sm text-gray-400 italic">
        Market value required
      </p>
    )
  }

  const LTVS = [0.65, 0.70, 0.75] as const
  const RATE = 0.055

  const scenarios = LTVS.map((ltv) => {
    const loan = marketValue * ltv
    const monthlyPayment = loan * (RATE / 12)
    const cashFlow = rent !== null ? rent - monthlyPayment : null
    const deposit = marketValue * (1 - ltv)
    const netYield =
      rent !== null && deposit > 0
        ? ((rent * 12 - monthlyPayment * 12) / deposit) * 100
        : null
    return { ltv, loan, monthlyPayment, cashFlow, netYield }
  })

  return (
    <div>
      <p className="text-xs text-gray-400 mb-4">
        Based on 5.5% BTL rate (interest-only). Rates vary.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {scenarios.map(({ ltv, loan, monthlyPayment, cashFlow, netYield }) => (
          <div key={ltv} className="rounded-lg border border-gray-200 p-4">
            <p className="text-sm font-bold text-gray-800 mb-3">
              {Math.round(ltv * 100)}% LTV
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Loan</span>
                <span className="font-medium">{formatCurrency(loan)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Monthly Payment</span>
                <span className="font-medium">{formatCurrency(monthlyPayment)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 pt-2">
                <span className="text-gray-500 text-xs">Cash Flow/mo</span>
                <span
                  className="font-semibold"
                  style={{
                    color:
                      cashFlow === null
                        ? "#9ca3af"
                        : cashFlow >= 0
                        ? "#22c55e"
                        : "#ef4444",
                  }}
                >
                  {cashFlow !== null ? fmt(cashFlow) : "—"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Net Yield</span>
                <span className="font-semibold text-blue-500">
                  {pct(netYield)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Modal Component ───────────────────────────────────────────────────────

interface DealDetailModalProps {
  deal: DealWithRelations
  onClose: () => void
}

export function DealDetailModal({ deal, onClose }: DealDetailModalProps) {
  const askingPrice = Number(deal.askingPrice)
  const marketValue = (deal as any).marketValue != null ? Number((deal as any).marketValue) : null
  const refurb = (deal as any).estimatedRefurbCost != null ? Number((deal as any).estimatedRefurbCost) : null
  const rent = (deal as any).estimatedMonthlyRent != null ? Number((deal as any).estimatedMonthlyRent) : null
  const bmv = (deal as any).bmvPercentage != null ? Number((deal as any).bmvPercentage) : null
  const grossYield = (deal as any).grossYield != null ? Number((deal as any).grossYield) : null
  const netYield = (deal as any).netYield != null ? Number((deal as any).netYield) : null
  const roi = (deal as any).roi != null ? Number((deal as any).roi) : null
  const roce = (deal as any).roce != null ? Number((deal as any).roce) : null
  const score = deal.dealScore ?? null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex"
      onClick={onClose}
    >
      {/* Modal container — click inside doesn't close */}
      <div
        className="relative m-auto flex w-full max-w-6xl max-h-[92vh] rounded-2xl bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          className="absolute top-4 right-4 z-10 rounded-full p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          onClick={onClose}
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Left panel */}
        <div className="w-64 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-y-auto p-5 gap-4">
          {/* Property header */}
          <div>
            <h2 className="font-bold text-gray-900 text-sm leading-tight">{deal.address}</h2>
            {deal.postcode && (
              <p className="text-xs text-gray-400 mt-0.5">{deal.postcode}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {deal.propertyType && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 capitalize">
                  {deal.propertyType}
                </span>
              )}
              <StatusBadge
                label={formatStatus(deal.status)}
                cssKey={getDealStatusVarKey(deal.status)}
              />
            </div>
          </div>

          {/* Deal score ring */}
          <div className="flex justify-center py-2">
            <DealScoreRing score={score} size={96} />
          </div>

          {/* Key metrics */}
          <div className="border-t border-gray-200 pt-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Key Metrics
            </p>
            <MetricRow
              label="BMV %"
              value={pct(bmv)}
              colorClass={bmvColor(bmv)}
            />
            <MetricRow label="Asking Price" value={formatCurrency(askingPrice)} />
            <MetricRow
              label="Market Value"
              value={marketValue !== null ? formatCurrency(marketValue) : "—"}
            />
            <MetricRow
              label="Gross Yield"
              value={pct(grossYield)}
              colorClass={yieldColor(grossYield)}
            />
            <MetricRow
              label="Net Yield"
              value={pct(netYield)}
              colorClass={yieldColor(netYield)}
            />
            <MetricRow
              label="ROI"
              value={pct(roi)}
              colorClass={roi !== null ? "text-purple-500" : "text-gray-400"}
            />
            <MetricRow
              label="ROCE"
              value={pct(roce)}
              colorClass={roce !== null ? "text-purple-500" : "text-gray-400"}
            />
          </div>

          {/* Property details */}
          {(deal.bedrooms || deal.bathrooms) && (
            <div className="border-t border-gray-200 pt-3">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Property
              </p>
              {deal.bedrooms && (
                <MetricRow label="Bedrooms" value={String(deal.bedrooms)} />
              )}
              {deal.bathrooms && (
                <MetricRow label="Bathrooms" value={String(deal.bathrooms)} />
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <CollapsibleSection title="Exit Strategies">
            <ExitStrategyCards deal={deal} />
          </CollapsibleSection>

          <CollapsibleSection title="Financial Waterfall">
            <FinancialWaterfall deal={deal} />
          </CollapsibleSection>

          <CollapsibleSection title="Mortgage Scenarios">
            <MortgageScenarios deal={deal} />
          </CollapsibleSection>

          <CollapsibleSection title="Offer Analysis">
            <OfferAnalysisPanel
              dealId={deal.id}
              askingPrice={askingPrice}
              gdv={marketValue ?? undefined}
              estimatedRent={rent ?? undefined}
              totalRefurbishment={refurb ?? undefined}
              vendorLeadId={undefined}
              vendorName={undefined}
              vendorEmail={undefined}
              vendorPhone={undefined}
              missingInputsHint={
                marketValue === null
                  ? "Market value required to generate offer analysis"
                  : undefined
              }
            />
          </CollapsibleSection>
        </div>
      </div>
    </div>
  )
}
