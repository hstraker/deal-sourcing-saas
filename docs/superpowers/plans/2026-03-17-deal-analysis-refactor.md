# Deal Analysis Page Refactor — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-view-mode Deal Analysis list with a clean investor-focused table + KPI bar, and add a rich two-panel investor decision modal triggered by the View button.

**Architecture:** Three components are touched: a new `DealScoreRing` SVG component, a new `DealDetailModal` with four collapsible sections (exit strategy cards, financial waterfall, mortgage scenarios, offer analysis), and a refactored `DealList` that removes ~400 lines of card/list view code and wires in the KPI bar and modal. No backend changes are needed — all data already exists on `DealWithRelations`.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide React, `@/lib/format` (formatCurrency), `@/lib/utils` (cn), `@/types/deal` (DealWithRelations), existing `OfferAnalysisPanel`.

---

## Codebase context (read before starting)

- **`components/deals/deal-list.tsx`** — 1209-line file with `DealList`, `CardView`, `ListView`, `TableView`, `DealCard`, `ListItem`, `InvestorMatchBadge`, `DealActions`, `DeleteConfirmDialog`. The refactor removes CardView, ListView, DealCard, ListItem and the view-toggle state. Keep everything else.
- **`app/dashboard/deals/page.tsx`** — Server component that fetches deals, converts all Decimal fields to `number` via `Number()`, then passes to `DealList` with `as any`. Do not change this file.
- **`types/deal.ts`** — `DealWithRelations = Deal & { assignedTo, createdBy, photos, _count }`. All Prisma `Decimal` fields (askingPrice, marketValue, etc.) arrive as `number` at runtime (converted in page.tsx) despite the TypeScript type saying `Decimal`. Use `Number(deal.field)` defensively throughout.
- **`components/deals/offer-analysis-panel.tsx`** — Already exists. Import path: `@/components/deals/offer-analysis-panel`. Props include `dealId`, `askingPrice`, `gdv`, `estimatedRent`, `totalRefurbishment`, `vendorLeadId?`, `vendorName?`, `vendorEmail?`, `vendorPhone?`, `missingInputsHint?`.
- **`lib/format.ts`** — exports `formatCurrency(n: number): string` (formats as £XX,XXX).
- **KPI bar pattern** (from vendor leads table): `flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm`. Each tile: `flex flex-1 items-center gap-3 px-5 py-4`. Icon in `flex h-9 w-9 items-center justify-center rounded-lg bg-{color}-50`. Value: `font-mono text-xl font-bold`. Label: `text-xs text-gray-500`.
- **Status colours** — already defined in `deal-list.tsx` as `getStatusColor(status)` and `formatStatus(status)`. These functions must be copied to `deal-detail-modal.tsx` (don't import from deal-list — it's not exported).
- **TypeScript check**: run `npx tsc --noEmit` from the project root after each task. Zero errors is the target. The project tolerates pre-existing `any` types; don't introduce new suppressions.

---

## Chunk 1: New Components

### Task 1: DealScoreRing component

**Files:**
- Create: `components/deals/deal-score-ring.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/deals/deal-score-ring.tsx
"use client"

interface DealScoreRingProps {
  score: number | null
  size?: number
}

function getScoreBand(score: number | null): { color: string; label: string } {
  if (score === null) return { color: "#6b7280", label: "NOT SCORED" }
  if (score >= 80) return { color: "#22c55e", label: "GREAT DEAL" }
  if (score >= 60) return { color: "#6eb5ff", label: "GOOD DEAL" }
  if (score >= 40) return { color: "#f59e0b", label: "AVERAGE" }
  return { color: "#ef4444", label: "POOR DEAL" }
}

export function DealScoreRing({ score, size = 96 }: DealScoreRingProps) {
  const { color, label } = getScoreBand(score)
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const pct = score !== null ? Math.min(Math.max(score, 0), 100) / 100 : 0
  const strokeDashoffset = circumference * (1 - pct)

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} viewBox="0 0 100 100">
        {/* Track */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#1f2937"
          strokeWidth="8"
        />
        {/* Progress */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        {/* Score text */}
        <text
          x="50"
          y="50"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={color}
          fontSize="20"
          fontWeight="bold"
          fontFamily="monospace"
        >
          {score !== null ? score : "—"}
        </text>
      </svg>
      <p className="text-xs font-semibold tracking-wide" style={{ color }}>
        {label}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no new errors from `deal-score-ring.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/deals/deal-score-ring.tsx
git commit -m "feat: add DealScoreRing SVG component"
```

---

### Task 2: DealDetailModal component

**Files:**
- Create: `components/deals/deal-detail-modal.tsx`

This is the main new component. Implement it in the order shown below — left panel first, then each right panel section.

- [ ] **Step 1: Create the file with shell, imports, and helper utilities**

```tsx
// components/deals/deal-detail-modal.tsx
"use client"

import { useState } from "react"
import { X, ChevronDown, ChevronUp } from "lucide-react"
import type { DealWithRelations } from "@/types/deal"
import { DealScoreRing } from "./deal-score-ring"
import { OfferAnalysisPanel } from "./offer-analysis-panel"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  review: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  ready: "bg-purple-100 text-purple-800",
  listed: "bg-green-100 text-green-800",
  reserved: "bg-orange-100 text-orange-800",
  sold: "bg-green-200 text-green-800",
  archived: "bg-gray-200 text-gray-600",
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"
}

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
        Market value required — run deal analysis first
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
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-medium",
                  statusColor(deal.status)
                )}
              >
                {formatStatus(deal.status)}
              </span>
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero new errors. Fix any type errors before proceeding — do not suppress with `as any` unless the existing codebase already does so for that field.

- [ ] **Step 3: Commit**

```bash
git add components/deals/deal-detail-modal.tsx
git commit -m "feat: add DealDetailModal two-panel investor decision component"
```

---

## Chunk 2: Refactor DealList

### Task 3: Refactor deal-list.tsx — remove view modes, add KPI bar, wire modal

**Files:**
- Modify: `components/deals/deal-list.tsx`

- [ ] **Step 0: Record TypeScript baseline**

```bash
npx tsc --noEmit 2>&1 | tee /tmp/ts-baseline.log; echo "Baseline recorded"
```

This captures any pre-existing errors so you can distinguish them from new ones introduced during the refactor.

The changes are:
1. Remove `ViewMode` type, `viewMode` state, `handleViewChange`, localStorage view saving/loading
2. Remove `CardView`, `ListView`, `DealCard`, `ListItem` functions (~600 lines)
3. Remove `LayoutGrid`, `List`, `Table as TableIcon` imports (no longer needed)
4. Add `selectedDeal` modal state
5. Add `DealKpiBar` component and render it above the table
6. Change `DealActions` Eye link to a "View" button that calls `onView`
7. Update `TableView` rows: remove `onClick={() => router.push(...)}` — View button in Actions column handles navigation to modal
8. Render `DealDetailModal` when `selectedDeal` is set

- [ ] **Step 1: Add imports and remove unused ones**

At the top of `deal-list.tsx`, make these import changes:

**Remove** these imports (they're only used by card/list views):
```tsx
// Remove:
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  LayoutGrid,
  List,
  Table as TableIcon,
  ...
} from "lucide-react"
import { calculateAllMetrics } from "@/lib/calculations/deal-metrics"
import { DealCardSections } from "@/components/deals/deal-card-sections"
```

**Keep** these imports:
```tsx
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"   // still needed by TableView row clicks? No — remove row onClick. But keep for DeleteConfirmDialog redirect.
import {
  BookmarkPlus,
  Eye,
  Pencil,
  Trash2,
  Users,
  Loader2,
  Zap,
  TrendingUp,
  BarChart2,
  Target,
  DollarSign,
  Star,
} from "lucide-react"
```

Wait — `useRouter` is used by `DeleteConfirmDialog` for `router.refresh()`. Keep it.

**Add** these new imports:
```tsx
import { DealDetailModal } from "@/components/deals/deal-detail-modal"
import { formatCurrency } from "@/lib/format"
```

**Note:** `formatCurrency` may already be imported. Check — if so, don't add a duplicate.

- [ ] **Step 2: Remove ViewMode type, state, and view toggle**

Delete:
```tsx
type ViewMode = "cards" | "list" | "table"
```

In `DealList`, delete:
- `const [viewMode, setViewMode] = useState<ViewMode>("cards")`
- `const handleViewChange = (mode: ViewMode) => { ... }`
- The `useEffect` that reads `localStorage.getItem("deal-view-mode")`

- [ ] **Step 3: Add selectedDeal state and modal rendering**

In `DealList`, add after the existing state declarations:
```tsx
const [selectedDeal, setSelectedDeal] = useState<DealWithRelations | null>(null)
```

At the bottom of the `DealList` return, just before the closing `</div>`, add:
```tsx
{selectedDeal && (
  <DealDetailModal
    deal={selectedDeal}
    onClose={() => setSelectedDeal(null)}
  />
)}
```

- [ ] **Step 4: Add DealKpiBar component**

Add this component just above the `DealList` function:

```tsx
interface DealKpis {
  activeDeals: number
  avgBmv: number | null
  avgGrossYield: number | null
  totalPipelineValue: number
  avgDealScore: number | null
}

function computeKpis(deals: DealWithRelations[]): DealKpis {
  const activeDeals = deals.filter(
    (d) => d.status !== "archived" && d.status !== "sold"
  ).length

  const bmvValues = deals
    .map((d) => ((d as any).bmvPercentage != null ? Number((d as any).bmvPercentage) : null))
    .filter((v): v is number => v !== null)
  const avgBmv = bmvValues.length > 0
    ? bmvValues.reduce((a, b) => a + b, 0) / bmvValues.length
    : null

  const yieldValues = deals
    .map((d) => ((d as any).grossYield != null ? Number((d as any).grossYield) : null))
    .filter((v): v is number => v !== null)
  const avgGrossYield = yieldValues.length > 0
    ? yieldValues.reduce((a, b) => a + b, 0) / yieldValues.length
    : null

  const totalPipelineValue = deals
    .reduce((sum, d) => {
      const mv = (d as any).marketValue != null ? Number((d as any).marketValue) : 0
      return sum + mv
    }, 0)

  const scoreValues = deals
    .map((d) => d.dealScore)
    .filter((v): v is number => v !== null)
  const avgDealScore = scoreValues.length > 0
    ? scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length
    : null

  return { activeDeals, avgBmv, avgGrossYield, totalPipelineValue, avgDealScore }
}

function DealKpiBar({ deals }: { deals: DealWithRelations[] }) {
  const kpis = useMemo(() => computeKpis(deals), [deals])

  return (
    <div className="flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Active Deals */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <Target className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-gray-900">{kpis.activeDeals}</p>
          <p className="text-xs text-gray-500">Active Deals</p>
        </div>
      </div>

      {/* Avg BMV % */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-green-50">
          <TrendingUp className="h-4 w-4 text-green-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#16a34a" }}>
            {kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500">Avg BMV %</p>
        </div>
      </div>

      {/* Avg Gross Yield */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <BarChart2 className="h-4 w-4 text-blue-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#2563eb" }}>
            {kpis.avgGrossYield !== null ? `${kpis.avgGrossYield.toFixed(1)}%` : "—"}
          </p>
          <p className="text-xs text-gray-500">Avg Gross Yield</p>
        </div>
      </div>

      {/* Total Pipeline Value */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-purple-50">
          <DollarSign className="h-4 w-4 text-purple-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold text-purple-600">
            {formatCurrency(kpis.totalPipelineValue)}
          </p>
          <p className="text-xs text-gray-500">Pipeline Value</p>
        </div>
      </div>

      {/* Avg Deal Score */}
      <div className="flex flex-1 items-center gap-3 px-5 py-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-50">
          <Star className="h-4 w-4 text-amber-600" />
        </div>
        <div>
          <p className="font-mono text-xl font-bold" style={{ color: "#d97706" }}>
            {kpis.avgDealScore !== null ? `${kpis.avgDealScore.toFixed(0)}/100` : "—"}
          </p>
          <p className="text-xs text-gray-500">Avg Deal Score</p>
        </div>
      </div>
    </div>
  )
}
```

Note: `DealKpiBar` uses `useMemo` from React — it's already imported in the file.

- [ ] **Step 5: Update the DealList return — replace view toggle and render sections**

In `DealList`'s return value, find the first `<div className="space-y-4">` (the one containing `{/* Search, Filters, Sorting, and View Toggle */}`). It starts at around line 299 in the original file and contains:
- A `DealSearch` component
- A view-toggle button group (with `border-[var(--ds-border)]`)
- `DealFiltersComponent` and `DealSorting`

Replace that entire `<div className="space-y-4">...</div>` block with:

```tsx
<div className="space-y-4">
  <DealKpiBar deals={deals} />
  <div className="flex items-center gap-4">
    <div className="flex-1">
      <DealSearch
        deals={deals}
        searchQuery={searchQuery}
        onSearchQueryChange={handleSearchChange}
      />
    </div>
  </div>
  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
    <DealFiltersComponent
      deals={deals}
      onFiltersChange={setFilters}
      teamMembers={teamMembers}
    />
    <DealSorting sortConfig={sortConfig} onSortChange={setSortConfig} />
  </div>
</div>
```

- [ ] **Step 6: Replace view-mode render block with single TableView**

Find the `{/* Render based on view mode */}` comment in the DealList return. Replace the entire conditional block from that comment to its closing `</>` (including the empty-state div, the `viewMode === "cards"` checks, and the DealPagination call) with:
```tsx
{paginatedDeals.length === 0 ? (
  <div className="ds-card py-12 text-center">
    <p className="text-gray-400">No deals match your search or filters</p>
  </div>
) : (
  <>
    <TableView
      deals={paginatedDeals}
      matchesByDealId={matchesByDealId}
      actionDealIds={actionDealIds}
      onViewDeal={setSelectedDeal}
    />
    {totalPages > 1 && (
      <DealPagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        totalItems={sortedDeals.length}
        itemsPerPage={ITEMS_PER_PAGE}
      />
    )}
  </>
)}
```

- [ ] **Step 7: Update TableView signature and body**

**Important:** Table rows are NOT clickable. Only the View button (in the Actions column via `DealActions`) opens the modal. Do NOT add `onClick` to `<tr>` elements. The existing `stopPropagation()` on the Investors and Actions `<td>` cells is a defensive pattern; keep it.

Update `TableView` to accept `onViewDeal`:

```tsx
function TableView({
  deals,
  matchesByDealId,
  actionDealIds,
  onViewDeal,
}: {
  deals: DealWithRelations[]
  matchesByDealId: Map<string, MatchResult[]>
  actionDealIds: Set<string>
  onViewDeal: (deal: DealWithRelations) => void
}) {
```

Update the table headers to match the new column set:
```tsx
<thead>
  <tr>
    <th className="table-header">Address</th>
    <th className="table-header">Status</th>
    <th className="table-header">Type</th>
    <th className="table-header text-right">Asking Price</th>
    <th className="table-header text-right">Market Value</th>
    <th className="table-header text-center">BMV %</th>
    <th className="table-header text-center">Gross Yield</th>
    <th className="table-header text-center">Score</th>
    <th className="table-header">Assigned</th>
    <th className="table-header text-center">Investors</th>
    <th className="table-header text-right">Actions</th>
  </tr>
</thead>
```

Update each `<tr>` — remove `onClick={() => router.push(...)}` from the row, and replace the old table cells with these new ones:

```tsx
<tr key={deal.id} className="table-row">
  {/* Address */}
  <td className="table-cell">
    <div className="flex items-center gap-1.5">
      <div>
        <div className="font-medium">{deal.address}</div>
        {deal.postcode && (
          <div className="text-xs text-gray-400">{deal.postcode}</div>
        )}
      </div>
      {actionDealIds.has(deal.id) && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            </TooltipTrigger>
            <TooltipContent>Needs investor reservation</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  </td>

  {/* Status */}
  <td className="table-cell">
    <span
      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(deal.status)}`}
    >
      {formatStatus(deal.status)}
    </span>
  </td>

  {/* Type */}
  <td className="table-cell">
    {deal.propertyType ? (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 capitalize">
        {deal.propertyType}
      </span>
    ) : (
      <span className="text-gray-400">—</span>
    )}
  </td>

  {/* Asking Price */}
  <td className="table-cell text-right font-medium">
    {formatCurrency(Number(deal.askingPrice))}
  </td>

  {/* Market Value */}
  <td className="table-cell text-right">
    {(deal as any).marketValue != null
      ? formatCurrency(Number((deal as any).marketValue))
      : <span className="text-gray-400">—</span>
    }
  </td>

  {/* BMV % */}
  <td className="table-cell text-center">
    {(deal as any).bmvPercentage != null ? (() => {
      const v = Number((deal as any).bmvPercentage)
      const cls = v >= 15 ? "text-green-500" : v >= 5 ? "text-amber-500" : "text-red-500"
      return <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
    })() : <span className="text-gray-400">—</span>}
  </td>

  {/* Gross Yield */}
  <td className="table-cell text-center">
    {(deal as any).grossYield != null ? (() => {
      const v = Number((deal as any).grossYield)
      const cls = v >= 6 ? "text-green-500" : v >= 4 ? "text-amber-500" : "text-red-500"
      return <span className={`font-semibold ${cls}`}>{v.toFixed(1)}%</span>
    })() : <span className="text-gray-400">—</span>}
  </td>

  {/* Deal Score */}
  <td className="table-cell text-center">
    {deal.dealScore != null ? (() => {
      const s = deal.dealScore
      const cls =
        s >= 80 ? "text-green-500" :
        s >= 60 ? "text-blue-400" :
        s >= 40 ? "text-amber-500" : "text-red-500"
      return <span className={`font-bold ${cls}`}>{s}/100</span>
    })() : <span className="text-gray-400">—</span>}
  </td>

  {/* Assigned */}
  <td className="table-cell text-sm">
    {deal.assignedTo
      ? `${deal.assignedTo.firstName ?? ""} ${(deal.assignedTo.lastName ?? "").charAt(0)}.`.trim()
      : <span className="text-gray-400">—</span>
    }
  </td>

  {/* Investors */}
  <td
    className="table-cell text-center"
    onClick={(e) => e.stopPropagation()}
  >
    <InvestorMatchBadge
      matches={
        deal.status === "archived" || deal.status === "sold"
          ? []
          : (matchesByDealId.get(deal.id) ?? [])
      }
    />
  </td>

  {/* Actions */}
  <td
    className="table-cell text-right"
    onClick={(e) => e.stopPropagation()}
  >
    <DealActions
      dealId={deal.id}
      dealAddress={deal.address}
      onView={() => onViewDeal(deal)}
    />
  </td>
</tr>
```

- [ ] **Step 8: Update DealActions to use onView callback**

Update `DealActions` signature and replace the Eye `<Link>` with a button:

```tsx
function DealActions({
  dealId,
  dealAddress,
  onView,
}: {
  dealId: string
  dealAddress: string
  onView?: () => void
}) {
  const [deleteOpen, setDeleteOpen] = useState(false)
  return (
    <>
      <TooltipProvider>
        <div className="flex items-center gap-0.5">
          {onView && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  onClick={(e) => {
                    e.stopPropagation()
                    onView()
                  }}
                >
                  <Eye className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>View</TooltipContent>
            </Tooltip>
          )}
          {/* Edit, Reserve, Delete remain unchanged */}
          ...
        </div>
      </TooltipProvider>
      ...
    </>
  )
}
```

Keep the Edit (Pencil → Link), Reserve (BookmarkPlus → Link), and Delete (Trash2 → button) exactly as they are. Only the Eye button changes.

- [ ] **Step 9: Delete the now-unused CardView, ListView, DealCard, ListItem functions**

Delete these entire function blocks from the file:
- `function CardView(...)` (lines ~397–424)
- `function ListView(...)` (lines ~426–453)
- `function ListItem(...)` (lines ~455–569)
- `function DealCard(...)` (lines ~722–1017)

After deletion, also remove these imports if they become unused:
- `calculateAllMetrics` from `@/lib/calculations/deal-metrics`
- `DealCardSections` from `@/components/deals/deal-card-sections`
- `LayoutGrid`, `List`, `Table as TableIcon` from `lucide-react`
- `Link` from `next/link` (check: only used in DealActions for Edit/Reserve links — keep if still used there)

- [ ] **Step 10: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: zero errors. Common issues to fix:
- `Link` from next/link may still be needed in `DealActions` for the Edit and Reserve buttons
- `useRouter` is still needed by `DeleteConfirmDialog` for `router.refresh()`
- If `DollarSign`, `Target`, `Star` icons aren't in the lucide-react version, substitute: `Target` → `Crosshair`, `DollarSign` → `PoundSterling`, `Star` → `Award`

Run: `npx tsc --noEmit 2>&1 | head -30` to see first errors if any.

- [ ] **Step 11: Smoke test in browser**

```bash
npm run dev
```

Navigate to `/dashboard/deals`. Verify:
1. KPI bar renders at top with 5 tiles
2. Table renders with correct columns (no cards/list toggle)
3. Clicking "View" (eye icon) on a deal opens the modal
4. Modal shows left panel (score ring, metrics) and right panel (4 collapsible sections)
5. Clicking X or the backdrop closes the modal
6. Pagination still works
7. Delete dialog still works

- [ ] **Step 12: Commit**

```bash
git add components/deals/deal-list.tsx
git commit -m "feat: refactor Deal Analysis to clean table + KPI bar + investor modal"
```

---

## Final check

After all three tasks are committed:

```bash
npx tsc --noEmit
```

Expected: zero errors (or the same pre-existing errors as before the refactor — run `git stash && npx tsc --noEmit && git stash pop` to baseline if needed).
