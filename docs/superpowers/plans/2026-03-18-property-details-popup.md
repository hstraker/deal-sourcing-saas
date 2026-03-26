# Property Details Popup Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a rich two-pane investor-focused popup modal to the Property Details tab of the Vendor Leads Table, replacing the current behaviour that navigates away to the contact page.

**Architecture:** A new self-contained `PropertyDetailsModal` component reads from the `VendorLead` object already loaded in the table — no API calls needed. The `VendorLead` type is exported from `vendor-leads-table.tsx` and imported by the new modal file. Two small edits to `vendor-leads-table.tsx` wire it up: a new state variable and an updated `onView` handler.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide React, shadcn/ui StatusBadge, `getPipelineStageVarKey` from `lib/theme/status-colors`

---

## File Structure

| File | Change |
|------|--------|
| `components/vendors/property-details-modal.tsx` | **Create** — full modal component |
| `components/vendors/vendor-leads-table.tsx` | **Modify** — export type, add state + handler + render |

---

## Chunk 1: New modal component + type export

### Task 1: Export VendorLead from vendor-leads-table and create PropertyDetailsModal

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` (line ~56 — the `interface VendorLead` declaration)
- Create: `components/vendors/property-details-modal.tsx`

---

- [ ] **Step 1: Add missing fields and export VendorLead type**

In `components/vendors/vendor-leads-table.tsx`, first find the block of local type aliases near the top of the file (after the imports, before the interfaces). Add two new local union types alongside `PipelineStage` and `ProcessingStatus`:

```ts
type UrgencyLevel = "urgent" | "quick" | "moderate" | "flexible"
type ReasonForSale = "relocation" | "financial" | "divorce" | "inheritance" | "downsize" | "other"
```

Next, find the closing brace of the `VendorLead` interface:
```ts
  latestPortalCheck: LatestPortalCheck | null
  offerRetries: OfferRetry[]
}
```
Replace with (adds 5 fields used by the modal):
```ts
  latestPortalCheck: LatestPortalCheck | null
  offerRetries: OfferRetry[]
  motivationScore: number | null
  urgencyLevel: UrgencyLevel | null
  reasonForSelling: ReasonForSale | null
  competingOffers: boolean
  timelineDays: number | null
}
```
Note: `competingOffers` is `boolean` (not `boolean | null`) because the database column has `@default(false)` and is non-nullable — it is always returned as a boolean.

Then change the declaration line from:
```ts
interface VendorLead {
```
to:
```ts
export interface VendorLead {
```
This allows `property-details-modal.tsx` to import the type without duplication, and ensures the 5 seller-intel fields are available to the modal.

- [ ] **Step 2: Create the modal file**

Create `components/vendors/property-details-modal.tsx` with the full content below:

```tsx
"use client"

import React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import type { VendorLead } from "./vendor-leads-table"

// ── Helpers (local — no external dependency) ──────────────────────────────────

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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusRow({
  colour,
  label,
}: {
  colour: "green" | "amber" | "red" | "grey"
  label: string
}) {
  const dotClass =
    colour === "green"
      ? "bg-green-400"
      : colour === "amber"
      ? "bg-amber-400"
      : colour === "red"
      ? "bg-red-400"
      : "bg-slate-600"
  const icon =
    colour === "green" ? "✓" : colour === "amber" ? "!" : colour === "red" ? "✕" : "–"
  const iconText =
    colour === "green"
      ? "text-green-900"
      : colour === "amber"
      ? "text-amber-900"
      : colour === "red"
      ? "text-white"
      : "text-slate-500"
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold",
          dotClass,
          iconText
        )}
      >
        {icon}
      </span>
      <span className={colour === "grey" ? "text-slate-500" : "text-slate-200"}>{label}</span>
    </div>
  )
}

function Chip({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-700",
        className
      )}
    >
      {children}
    </span>
  )
}

function MetricCell({
  label,
  value,
  colour,
}: {
  label: string
  value: string
  colour: string
}) {
  return (
    <div>
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={cn("text-sm font-bold", colour)}>{value}</p>
    </div>
  )
}

function StrategyCard({
  fit,
  name,
  reason,
}: {
  fit: boolean
  name: string
  reason: string
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-2",
        fit ? "border-green-200 bg-green-50" : "border-gray-200 bg-gray-50 opacity-60"
      )}
    >
      <p className={cn("text-[11px] font-bold", fit ? "text-green-700" : "text-gray-500")}>
        {fit ? "✓" : "—"} {name}
      </p>
      <p className={cn("mt-0.5 text-[10px]", fit ? "text-green-600" : "text-gray-400")}>
        {reason}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function PropertyDetailsModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const asking = toNum(lead.askingPrice)
  const marketVal = toNum(lead.estimatedMarketValue)
  const refurb = toNum(lead.estimatedRefurbCost)
  const bmv = toNum(lead.bmvScore)
  const profit = toNum(lead.profitPotential)
  const monthlyRent = toNum(lead.estimatedMonthlyRent)
  const annualRent = toNum(lead.estimatedAnnualRent)
  const motivation = toNum(lead.motivationScore)

  const grossYield =
    asking && asking > 0 && annualRent ? (annualRent / asking) * 100 : null
  const netYield = grossYield !== null ? grossYield * 0.8 : null

  // Strategy fit
  const btlFit = monthlyRent !== null && grossYield !== null && grossYield >= 5
  const flipFit = bmv !== null && bmv >= 10 && profit !== null && profit > 0
  const brrFit = refurb !== null && bmv !== null && bmv >= 10

  // Condition colour on dark background
  const conditionChipClass =
    lead.condition === "excellent" || lead.condition === "good"
      ? "bg-green-500 text-white"
      : lead.condition === "needs_work" || lead.condition === "needs_modernisation"
      ? "bg-amber-400 text-amber-900"
      : lead.condition === "poor"
      ? "bg-red-500 text-white"
      : "bg-white/10 text-slate-200"

  // Portal check indicator
  const portalColour =
    lead.latestCheckRisk === "clear"
      ? "green"
      : lead.latestCheckRisk === "caution"
      ? "amber"
      : lead.latestCheckRisk === "red_flag"
      ? "red"
      : ("grey" as const)
  const portalLabel =
    lead.latestCheckRisk === "clear"
      ? "Portal check clear"
      : lead.latestCheckRisk === "caution"
      ? "Portal caution"
      : lead.latestCheckRisk === "red_flag"
      ? "Portal red flag"
      : "Portal check not run"

  const hasSellerIntel =
    !!lead.urgencyLevel ||
    lead.timelineDays != null ||
    !!lead.reasonForSelling ||
    motivation !== null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ═══════════════════════════════════════════════
            LEFT PANEL — dark, financial summary
        ═══════════════════════════════════════════════ */}
        <div className="flex w-[260px] shrink-0 flex-col gap-5 overflow-y-auto bg-[#1e293b] p-5 text-white">
          {/* Address */}
          <div>
            <p className="text-sm font-bold leading-snug text-slate-100">
              {lead.propertyAddress ?? "No address"}
            </p>
            {lead.propertyPostcode && (
              <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode}</p>
            )}
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

          {/* Financials */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Financials
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Asking Price</span>
              <span className="font-bold text-slate-100">{fmtCurrency(asking)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Market Value</span>
              <span className="font-bold text-slate-100">{fmtCurrency(marketVal)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Refurb Est.</span>
              <span className="font-semibold text-slate-100">{fmtCurrency(refurb)}</span>
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
                  <span className="font-bold text-green-400">{fmtCurrency(profit)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10" />

          {/* Status indicators */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Status
            </p>
            <StatusRow colour={portalColour} label={portalLabel} />
            <StatusRow
              colour={
                lead.validationPassed === true
                  ? "green"
                  : lead.validationPassed === false
                  ? "red"
                  : "grey"
              }
              label={
                lead.validationPassed === true
                  ? "Validation passed"
                  : lead.validationPassed === false
                  ? "Validation failed"
                  : "Not validated"
              }
            />
            <StatusRow
              colour={lead.urgencyLevel === "urgent" ? "amber" : "grey"}
              label={
                lead.urgencyLevel === "urgent" && lead.timelineDays
                  ? `Urgent — ${lead.timelineDays} days`
                  : lead.urgencyLevel === "urgent"
                  ? "Urgent"
                  : "No urgency flag"
              }
            />
            <StatusRow
              colour={lead.competingOffers ? "red" : "grey"}
              label={lead.competingOffers ? "Competing offers" : "No competing offers"}
            />
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

        {/* ═══════════════════════════════════════════════
            RIGHT PANEL — light, property details
        ═══════════════════════════════════════════════ */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-5">
          {/* Close button */}
          <div className="-mr-1 -mt-1 flex justify-end">
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Property Specs */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Property Specs
            </p>
            <div className="flex flex-wrap gap-1.5">
              {lead.bedrooms != null && (
                <Chip>
                  🛏 {lead.bedrooms} Bedroom{lead.bedrooms !== 1 ? "s" : ""}
                </Chip>
              )}
              {lead.bathrooms != null && (
                <Chip>
                  🚿 {lead.bathrooms} Bathroom{lead.bathrooms !== 1 ? "s" : ""}
                </Chip>
              )}
              {lead.squareFeet && (
                <Chip>📐 {lead.squareFeet.toLocaleString()} sq ft</Chip>
              )}
              {lead.propertyType && (
                <Chip className="capitalize">🏠 {lead.propertyType}</Chip>
              )}
              {lead.epcRating && (
                <Chip>
                  ⚡ EPC: {lead.epcRating}
                  {lead.epcScore ? ` (${lead.epcScore})` : ""}
                </Chip>
              )}
              {lead.tenureType && (
                <Chip className="capitalize">🔑 {lead.tenureType}</Chip>
              )}
            </div>
          </div>

          {/* Rental Income */}
          {monthlyRent !== null && (
            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-green-700">
                Rental Income
              </p>
              <div className="grid grid-cols-2 gap-3">
                <MetricCell
                  label="Monthly Rent"
                  value={fmtCurrency(monthlyRent)}
                  colour="text-gray-900"
                />
                <MetricCell
                  label="Annual Rent"
                  value={fmtCurrency(annualRent)}
                  colour="text-gray-900"
                />
                <MetricCell
                  label="Gross Yield"
                  value={grossYield !== null ? `${grossYield.toFixed(1)}%` : "—"}
                  colour="text-green-700"
                />
                <MetricCell
                  label="Net Yield ~"
                  value={netYield !== null ? `${netYield.toFixed(1)}%` : "—"}
                  colour="text-green-700"
                />
              </div>
            </div>
          )}

          {/* Strategy Fit */}
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
              Strategy Fit
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StrategyCard
                fit={btlFit}
                name="BTL"
                reason={
                  btlFit && grossYield !== null
                    ? `${grossYield.toFixed(1)}% yield · good cashflow`
                    : "Insufficient yield data"
                }
              />
              <StrategyCard
                fit={flipFit}
                name="Flip"
                reason={
                  flipFit && bmv !== null
                    ? `${bmv.toFixed(1)}% BMV · ${fmtCurrency(profit)} profit`
                    : "Insufficient BMV/profit data"
                }
              />
              <StrategyCard
                fit={brrFit}
                name="BRR"
                reason={brrFit ? "Refurb + refi potential" : "Insufficient refurb/BMV data"}
              />
              <StrategyCard fit={false} name="SA" reason="Insufficient data" />
            </div>
          </div>

          {/* Seller Intelligence */}
          {hasSellerIntel && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                Seller Intelligence
              </p>
              <div className="grid grid-cols-2 gap-3">
                {lead.urgencyLevel && (
                  <MetricCell
                    label="Urgency"
                    value={lead.urgencyLevel.toUpperCase()}
                    colour={
                      lead.urgencyLevel === "urgent" ? "text-red-600" : "text-gray-700"
                    }
                  />
                )}
                {lead.timelineDays != null && (
                  <MetricCell
                    label="Timeline"
                    value={`${lead.timelineDays} days`}
                    colour="text-gray-900"
                  />
                )}
                {lead.reasonForSelling && (
                  <MetricCell
                    label="Reason"
                    value={lead.reasonForSelling}
                    colour="text-gray-700"
                  />
                )}
                {motivation !== null && (
                  <MetricCell
                    label="Motivation"
                    value={`${motivation} / 10${motivation >= 8 ? " 🔥" : ""}`}
                    colour="text-gray-900"
                  />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (exit code 0). If errors appear, fix them before continuing.

- [ ] **Step 4: Commit**

```bash
git add components/vendors/property-details-modal.tsx components/vendors/vendor-leads-table.tsx
git commit -m "feat: create PropertyDetailsModal component"
```

---

## Chunk 2: Wire modal into vendor-leads-table

### Task 2: Add state, handler, and render to VendorLeadsTable

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

Three targeted edits:

---

- [ ] **Step 1: Add import at the top of vendor-leads-table.tsx**

Find the existing import block for local vendor components (around line 41–43):
```ts
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
```

Add one line:
```ts
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { OfferAnalysisPanel } from "../deals/offer-analysis-panel"
import { PropertyDetailsModal } from "./property-details-modal"
```

- [ ] **Step 2: Add state variable**

In the `VendorLeadsTable` component body, find the block of modal state variables (around line 1253–1256):
```ts
const [portalCheckModalLead, setPortalCheckModalLead] = useState<VendorLead | null>(null)
const [validationModalLead, setValidationModalLead] = useState<VendorLead | null>(null)
const [comparableModalLead, setComparableModalLead] = useState<VendorLead | null>(null)
const [offerModalLead, setOfferModalLead] = useState<VendorLead | null>(null)
```

Add one line:
```ts
const [propertyDetailsModalLead, setPropertyDetailsModalLead] = useState<VendorLead | null>(null)
const [portalCheckModalLead, setPortalCheckModalLead] = useState<VendorLead | null>(null)
const [validationModalLead, setValidationModalLead] = useState<VendorLead | null>(null)
const [comparableModalLead, setComparableModalLead] = useState<VendorLead | null>(null)
const [offerModalLead, setOfferModalLead] = useState<VendorLead | null>(null)
```

- [ ] **Step 3: Update the onView handler**

Find the `onView` handler inside the `visibleLeads.map(...)` block (around line 1447). The current handler is:
```ts
onView: () => {
  if (activeTab === "portal-check") {
    setPortalCheckModalLead(lead)
  } else if (activeTab === "validation") {
    setValidationModalLead(lead)
  } else if (activeTab === "comparable") {
    setComparableModalLead(lead)
  } else if (activeTab === "offer-analysis") {
    setOfferModalLead(lead)
  } else {
    router.push(`/dashboard/vendors/${lead.id}/contact`)
  }
},
```

Replace the entire `onView` function body with:
```ts
onView: () => {
  if (activeTab === "property-details") {
    setPropertyDetailsModalLead(lead)
  } else if (activeTab === "portal-check") {
    setPortalCheckModalLead(lead)
  } else if (activeTab === "validation") {
    setValidationModalLead(lead)
  } else if (activeTab === "comparable") {
    setComparableModalLead(lead)
  } else if (activeTab === "offer-analysis") {
    setOfferModalLead(lead)
  } else {
    router.push(`/dashboard/vendors/${lead.id}/contact`)
  }
},
```

The `property-details` branch must be the first `if` (not `else if`) so it is always evaluated. The `map-view` tab falls through to `router.push` in the final `else` branch — this is intentional and unchanged.

- [ ] **Step 4: Render the modal**

Find where the other modals are rendered near the bottom of the component JSX (around line 1491):
```tsx
{/* Map Modal */}
{mapLead && <MapModal lead={mapLead} onClose={() => setMapLead(null)} />}

{/* Portal Check Modal */}
{portalCheckModalLead && (
  <PortalCheckModal lead={portalCheckModalLead} onClose={() => setPortalCheckModalLead(null)} />
)}
```

Add the property details modal directly before the Map Modal:
```tsx
{/* Property Details Modal */}
{propertyDetailsModalLead && (
  <PropertyDetailsModal lead={propertyDetailsModalLead} onClose={() => setPropertyDetailsModalLead(null)} />
)}

{/* Map Modal */}
{mapLead && <MapModal lead={mapLead} onClose={() => setMapLead(null)} />}

{/* Portal Check Modal */}
{portalCheckModalLead && (
  <PortalCheckModal lead={portalCheckModalLead} onClose={() => setPortalCheckModalLead(null)} />
)}
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (exit code 0).

- [ ] **Step 6: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: wire PropertyDetailsModal into vendor leads table

Property Details tab View button now opens the investor-focused
two-pane popup instead of navigating to the contact page."
```

---

## Manual verification

1. Run `npm run dev`
2. Navigate to `/dashboard/vendors`
3. Click the **Property Details** tab
4. Click the **View** (eye) button on any lead
5. Confirm a popup appears with dark left panel (financials) and light right panel (specs, rental, strategy fit, seller intel)
6. Confirm clicking the backdrop or ✕ closes the modal without navigating away
7. Switch to another tab (e.g. Validation) and confirm View still opens that tab's existing modal
