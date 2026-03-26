# Vendor Lead Modal Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five plain-white inline modal components in the vendor leads table with a consistent two-pane design (dark left financial-summary panel + light right content panel), matching the existing `PropertyDetailsModal`.

**Architecture:** Create a shared `ModalShell` component that handles the backdrop and two-pane layout. Extract each of the five inline modal functions from `vendor-leads-table.tsx` into their own files, giving each a left panel with property/financial context and the same right-panel content as today. Remove the inline definitions and import the new files.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide React, shadcn/ui StatusBadge, `getPipelineStageVarKey` from `lib/theme/status-colors`, `date-fns`

---

## File Structure

| File | Action |
|------|--------|
| `components/vendors/modal-shell.tsx` | **Create** — shared two-pane backdrop + layout shell |
| `components/vendors/validation-modal.tsx` | **Create** — ValidationModal with BMV/financials left panel |
| `components/vendors/portal-check-modal.tsx` | **Create** — PortalCheckModal with risk indicator left panel |
| `components/vendors/comparable-modal.tsx` | **Create** — ComparableModal with comparable summary left panel |
| `components/vendors/offer-analysis-modal.tsx` | **Create** — OfferAnalysisModal with deal inputs left panel |
| `components/vendors/map-modal.tsx` | **Create** — MapModal with vendor contact left panel |
| `components/vendors/vendor-leads-table.tsx` | **Modify** — remove 5 inline modal definitions, add 5 imports |

---

## Chunk 1: ModalShell + ValidationModal

### Task 1: Create the shared ModalShell component

**Files:**
- Create: `components/vendors/modal-shell.tsx`

- [ ] **Step 1: Create `components/vendors/modal-shell.tsx`**

```tsx
"use client"

import { cn } from "@/lib/utils"
import type React from "react"

interface ModalShellProps {
  onClose: () => void
  leftPanel: React.ReactNode
  maxWidth?: "2xl" | "3xl" | "4xl" | "5xl"
  rightPanelClassName?: string
  children: React.ReactNode
}

const MAX_WIDTH: Record<string, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
}

export function ModalShell({
  onClose,
  leftPanel,
  maxWidth = "2xl",
  rightPanelClassName,
  children,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full overflow-hidden rounded-2xl shadow-2xl max-h-[90vh]",
          MAX_WIDTH[maxWidth]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-[260px] shrink-0 overflow-y-auto bg-[#1e293b] text-white">
          {leftPanel}
        </div>
        <div className={cn("flex flex-1 flex-col overflow-y-auto bg-white", rightPanelClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/modal-shell.tsx
git commit -m "feat: add shared ModalShell two-pane component"
```

---

### Task 2: Create ValidationModal

**Files:**
- Create: `components/vendors/validation-modal.tsx`

- [ ] **Step 1: Create `components/vendors/validation-modal.tsx`**

```tsx
"use client"

import { X, TrendingUp } from "lucide-react"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import type { VendorLead } from "./vendor-leads-table"

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

export function ValidationModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">{lead.vendorName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyAddress ?? "No address"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.validationPassed === true && (
            <span className="rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              ✓ Passed
            </span>
          )}
          {lead.validationPassed === false && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
              ✗ Failed
            </span>
          )}
          {lead.validationPassed === null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
              Not validated
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Financials */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Financials</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Market Value</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.estimatedMarketValue)}</span>
        </div>
        {(bmv !== null || profit !== null) && (
          <div className="mt-1 space-y-1.5 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">BMV Discount</span>
              <span className="text-xl font-extrabold text-green-400">
                {bmv !== null ? `${bmv.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">Profit Potential</span>
              <span className="text-sm font-bold text-green-400">{fmtCurrency(profit)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="2xl">
      {/* Close button */}
      <div className="-mr-1 -mt-1 flex justify-end p-4 pb-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 p-5 pt-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
          Validation Notes
        </p>
        {lead.validationNotes ? (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">
              {lead.validationNotes}
            </pre>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
            <TrendingUp className="mx-auto mb-2 h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">
              No validation run yet. Use the Check button to calculate BMV.
            </p>
          </div>
        )}
      </div>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/validation-modal.tsx
git commit -m "feat: create ValidationModal with two-pane dark/light design"
```

---

## Chunk 2: PortalCheckModal + ComparableModal

### Task 3: Create PortalCheckModal

**Files:**
- Create: `components/vendors/portal-check-modal.tsx`

- [ ] **Step 1: Create `components/vendors/portal-check-modal.tsx`**

```tsx
"use client"

import { X } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { ModalShell } from "./modal-shell"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import type { VendorLead } from "./vendor-leads-table"

type RiskLevel = "clear" | "caution" | "red_flag"

const RISK_CONFIG: Record<
  RiskLevel,
  { boxClass: string; textClass: string; subClass: string; label: string; subtitle: string; chipClass: string; chipLabel: string }
> = {
  clear: {
    boxClass: "rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-green-400",
    subClass: "mt-1 text-xs text-green-300",
    label: "CLEAR",
    subtitle: "No flags found",
    chipClass: "rounded-full bg-green-500 px-2 py-0.5 text-[10px] font-semibold text-white",
    chipLabel: "Clear",
  },
  caution: {
    boxClass: "rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-amber-400",
    subClass: "mt-1 text-xs text-amber-300",
    label: "CAUTION",
    subtitle: "Review flags below",
    chipClass: "rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-semibold text-amber-900",
    chipLabel: "Caution",
  },
  red_flag: {
    boxClass: "rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-center",
    textClass: "text-2xl font-extrabold text-red-400",
    subClass: "mt-1 text-xs text-red-300",
    label: "RED FLAG",
    subtitle: "Action required",
    chipClass: "rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white",
    chipLabel: "Red Flag",
  },
}

export function PortalCheckModal({
  lead,
  onClose,
  onRiskUpdated,
}: {
  lead: VendorLead
  onClose: () => void
  onRiskUpdated?: (newRisk: string | null, newDate: string | null) => void
}) {
  const risk = lead.latestCheckRisk as RiskLevel | null
  const config = risk ? RISK_CONFIG[risk] : null

  const lastChecked = lead.latestCheckedAt
    ? formatDistanceToNow(new Date(lead.latestCheckedAt), { addSuffix: true })
    : "Never"

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">{lead.vendorName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyAddress ?? "No address"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {config ? (
            <span className={config.chipClass}>{config.chipLabel}</span>
          ) : (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-400">
              Not checked
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Overall risk */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Overall Risk
        </p>
        {config ? (
          <div className={config.boxClass}>
            <p className={config.textClass}>{config.label}</p>
            <p className={config.subClass}>{config.subtitle}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-400">NOT RUN</p>
            <p className="mt-1 text-xs text-slate-500">Run a portal check</p>
          </div>
        )}
      </div>

      {/* Last checked — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Last Checked</span>
          <span className="text-[10px] text-slate-400">{lastChecked}</span>
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="3xl">
      {/* Close button */}
      <div className="-mr-1 -mt-1 flex justify-end p-4 pb-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 p-4 pt-2">
        <PortalCheckDetailPanel
          leadId={lead.id}
          latestCheckRisk={lead.latestCheckRisk}
          latestCheckedAt={lead.latestCheckedAt}
          onRiskUpdated={onRiskUpdated}
        />
      </div>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/portal-check-modal.tsx
git commit -m "feat: create PortalCheckModal with risk indicator left panel"
```

---

### Task 4: Create ComparableModal

**Files:**
- Create: `components/vendors/comparable-modal.tsx`

- [ ] **Step 1: Create `components/vendors/comparable-modal.tsx`**

```tsx
"use client"

import { X } from "lucide-react"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import type { VendorLead } from "./vendor-leads-table"

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

export function ComparableModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address — property-focused (vendorName intentionally omitted for comparable context) */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Subject property */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Subject Property
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Postcode</span>
          <span className="font-bold text-slate-100">{lead.propertyPostcode ?? "—"}</span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Comparables summary */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Comparables
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Found</span>
          <span className="font-bold text-slate-100">{lead.comparablesCount ?? "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Avg Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.avgComparablePrice)}</span>
        </div>
        {(bmv !== null || profit !== null) && (
          <div className="mt-1 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">Implied BMV</span>
              <span className="text-xl font-extrabold text-green-400">
                {bmv !== null ? `${bmv.toFixed(1)}%` : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="4xl">
      {/* Close button */}
      <div className="-mr-1 -mt-1 flex justify-end p-4 pb-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 p-4 pt-2">
        <VendorComparablesTab
          vendorLeadId={lead.id}
          askingPrice={toNum(lead.askingPrice) ?? undefined}
          propertyPostcode={lead.propertyPostcode}
        />
      </div>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/comparable-modal.tsx
git commit -m "feat: create ComparableModal with comparable summary left panel"
```

---

## Chunk 3: OfferAnalysisModal + MapModal

### Task 5: Create OfferAnalysisModal

**Files:**
- Create: `components/vendors/offer-analysis-modal.tsx`

- [ ] **Step 1: Create `components/vendors/offer-analysis-modal.tsx`**

```tsx
"use client"

import { X } from "lucide-react"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
import type { VendorLead } from "./vendor-leads-table"

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

export function OfferAnalysisModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)
  const askingPrice = toNum(lead.askingPrice) ?? 0
  const gdv = toNum(lead.estimatedMarketValue)
  const estimatedRent = toNum(lead.estimatedMonthlyRent)
  const totalRefurb = toNum(lead.estimatedRefurbCost)

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">{lead.vendorName}</p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyAddress ?? "No address"}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Deal inputs */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
          Deal Inputs
        </p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Market Value</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.estimatedMarketValue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Monthly Rent</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.estimatedMonthlyRent)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Refurb Est.</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.estimatedRefurbCost)}</span>
        </div>
        {(bmv !== null || profit !== null) && (
          <div className="mt-1 space-y-1.5 rounded-lg border border-green-500/30 bg-green-500/10 p-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">BMV Discount</span>
              <span className="text-xl font-extrabold text-green-400">
                {bmv !== null ? `${bmv.toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-green-300">Profit Potential</span>
              <span className="text-sm font-bold text-green-400">{fmtCurrency(profit)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="4xl">
      {/* Close button */}
      <div className="-mr-1 -mt-1 flex justify-end p-4 pb-0">
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pt-2">
        <OfferAnalysisPanel
          vendorLeadId={lead.id}
          dealId={lead.dealId}
          askingPrice={askingPrice}
          gdv={gdv}
          estimatedRent={estimatedRent}
          totalRefurbishment={totalRefurb}
          vendorName={lead.vendorName}
          vendorEmail={lead.vendorEmail}
          vendorPhone={lead.vendorPhone}
          missingInputsHint={!gdv ? "Run BMV calculation first to populate Market Value." : undefined}
        />
      </div>
    </ModalShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/offer-analysis-modal.tsx
git commit -m "feat: create OfferAnalysisModal with deal inputs left panel"
```

---

### Task 6: Create MapModal

**Files:**
- Create: `components/vendors/map-modal.tsx`

- [ ] **Step 1: Create `components/vendors/map-modal.tsx`**

```tsx
"use client"

import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import { ModalShell } from "./modal-shell"
import type { VendorLead } from "./vendor-leads-table"

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function fmtCurrency(v: string | number | null | undefined): string {
  const n = toNum(v)
  if (n === null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

export function MapModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const address = lead.propertyAddress ?? ""
  const encoded = encodeURIComponent(address)
  // No hardcoded fallback key — use env var only
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""
  const src = `https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}`

  const conditionChipClass =
    lead.condition === "excellent" || lead.condition === "good"
      ? "bg-green-500 text-white"
      : lead.condition === "needs_work" || lead.condition === "needs_modernisation"
      ? "bg-amber-400 text-amber-900"
      : lead.condition === "poor"
      ? "bg-red-500 text-white"
      : "bg-white/10 text-slate-200"

  const leftPanel = (
    <div className="flex flex-col gap-5 p-5 h-full">
      {/* Address */}
      <div>
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms} bed
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.condition && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
                conditionChipClass
              )}
            >
              {lead.condition.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Property details */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Property</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Asking Price</span>
          <span className="font-bold text-slate-100">{fmtCurrency(lead.askingPrice)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Type</span>
          <span className="font-bold capitalize text-slate-100">{lead.propertyType ?? "—"}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Bedrooms</span>
          <span className="font-bold text-slate-100">{lead.bedrooms?.toString() ?? "—"}</span>
        </div>
      </div>

      <div className="h-px bg-white/10" />

      {/* Vendor contact */}
      <div className="space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Name</span>
          <span className="font-bold text-slate-100">{lead.vendorName}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-slate-400">Phone</span>
          <span className="font-bold text-slate-100">{lead.vendorPhone}</span>
        </div>
      </div>

      {/* Pipeline stage — pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage
              .replace(/_/g, " ")
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  return (
    // rightPanelClassName="p-0" removes padding so the map fills edge-to-edge
    // No close button in right panel — backdrop-click closes the modal
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="3xl" rightPanelClassName="p-0">
      <iframe
        src={src}
        width="100%"
        height="100%"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="block h-full min-h-[300px] w-full border-0"
        title={`Map: ${address}`}
      />
    </ModalShell>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add components/vendors/map-modal.tsx
git commit -m "feat: create MapModal with property+vendor context left panel"
```

---

## Chunk 4: Wire into vendor-leads-table

### Task 7: Replace inline modal definitions with imports

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

The inline modal definitions in `vendor-leads-table.tsx` must be removed and replaced with imports. This task has two parts: (A) add imports, (B) delete the inline definitions.

- [ ] **Step 1: Add five imports**

Find the existing block of vendor component imports. It currently contains (approximately):
```ts
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
import { PropertyDetailsModal } from "./property-details-modal"
```

Add five new lines after `PropertyDetailsModal`:
```ts
import { MapModal } from "./map-modal"
import { PortalCheckModal } from "./portal-check-modal"
import { ValidationModal } from "./validation-modal"
import { ComparableModal } from "./comparable-modal"
import { OfferAnalysisModal } from "./offer-analysis-modal"
```

- [ ] **Step 2: Remove the five inline modal function definitions**

Search for and delete the following five function definitions in their entirety (including their comment header lines). Each starts with a comment block and ends at the closing `}` of the function:

1. **MapModal** — starts with `// Map Modal` comment, `function MapModal(...)`. Delete from the `// ─────` separator before `// Map Modal` through the closing `}` of the `MapModal` function.

2. **PortalCheckModal** — starts with `// Portal Check Modal` comment. Delete from the `// ─────` separator through the closing `}`.

3. **ValidationModal** — starts with `// Validation Modal` comment. Delete from the `// ─────` separator through the closing `}`.

4. **ComparableModal** — starts with `// Comparable Modal` comment. Delete from the `// ─────` separator through the closing `}`.

5. **OfferAnalysisModal** — starts with `// Offer Analysis Modal` comment. Delete from the `// ─────` separator through the closing `}`.

After deletion, confirm the file jumps directly from the `PropertyDetailsModal` import area to the `// Per-tab Row renderers` section.

**Important:** The import for `PortalCheckDetailPanel`, `VendorComparablesTab`, and `OfferAnalysisPanel` at the top of the file should also be removed — they are no longer used directly in `vendor-leads-table.tsx` (each is now used inside its own modal file). Remove these three import lines:
```ts
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

Expected: no output. If there are "unused import" or "cannot find name" errors, fix them before committing. Common issues:
- If any of the three removed imports are still referenced in the file, do NOT remove them
- If `CheckCircle2`, `XCircle` (used in the old ValidationModal) are now unused in the table file, remove them from the lucide imports

- [ ] **Step 4: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: replace inline vendor modal defs with extracted components

All 5 vendor lead popup modals (Map, PortalCheck, Validation,
Comparable, OfferAnalysis) now live in their own files with the
two-pane dark/light design consistent with PropertyDetailsModal."
```

---

## Manual Verification

1. `npm run dev`
2. Navigate to `/dashboard/vendors`
3. Click each tab and the **View** button on a lead:
   - **Property Details tab** → existing `PropertyDetailsModal` (unchanged)
   - **Portal Check tab** → dark left panel with CLEAR/CAUTION/RED FLAG box
   - **Validation tab** → dark left panel with BMV%, right panel shows notes or empty state
   - **Comparable tab** → dark left panel with comparable count + BMV, right panel loads comparables
   - **Offer Analysis tab** → dark left panel with deal inputs, right panel loads offer calculator
   - **Map View tab** → dark left panel with vendor details, right panel shows full-height map
4. Confirm backdrop-click closes every modal
5. Confirm ✕ button closes every modal (except MapModal which has no ✕)
