# Vendor Lead Modal Redesign — Design Spec

## Goal

Bring all five inline vendor-lead popup modals (`MapModal`, `PortalCheckModal`, `ValidationModal`, `ComparableModal`, `OfferAnalysisModal`) into visual parity with the newly-built `PropertyDetailsModal`: dark left financial-summary panel + light right content panel.

## Context

`PropertyDetailsModal` (`components/vendors/property-details-modal.tsx`) established the two-pane pattern. The other five modals are currently defined as inline functions inside `vendor-leads-table.tsx` and use a plain white-card + header layout. This redesign applies the same two-pane visual shell to all five while keeping their existing right-panel content unchanged.

---

## Architecture

### Shared shell component

Create `components/vendors/modal-shell.tsx` exporting `ModalShell`:

```ts
interface ModalShellProps {
  onClose: () => void
  leftPanel: React.ReactNode
  maxWidth?: "2xl" | "3xl" | "4xl" | "5xl"   // default "2xl"
  rightPanelClassName?: string                 // optional override for right panel (e.g. "p-0" for MapModal)
  children: React.ReactNode                   // right panel content
}
```

`ModalShell` handles:
- Fixed backdrop (`bg-black/50 backdrop-blur-sm`, z-50)
- Backdrop-click closes modal (`onClick={onClose}` on outer div)
- Inner container: `flex w-full overflow-hidden rounded-2xl shadow-2xl max-h-[90vh]` + maxWidth class — **must include** `onClick={(e) => e.stopPropagation()}` to prevent backdrop-click when clicking inside
- Left panel wrapper: `w-[260px] shrink-0 overflow-y-auto bg-[#1e293b] text-white`
- Right panel wrapper: `flex flex-1 flex-col overflow-y-auto bg-white` + `rightPanelClassName` merged via `cn()`

`PropertyDetailsModal` will **not** be refactored to use `ModalShell` — it was recently completed and already works. Only the five new/updated modals use it.

### maxWidth class map
```ts
const MAX_WIDTH: Record<string, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
}
```

### File changes

| File | Action |
|------|--------|
| `components/vendors/modal-shell.tsx` | **Create** — shared two-pane shell |
| `components/vendors/validation-modal.tsx` | **Create** — extracted + redesigned |
| `components/vendors/portal-check-modal.tsx` | **Create** — extracted + redesigned |
| `components/vendors/comparable-modal.tsx` | **Create** — extracted + redesigned |
| `components/vendors/offer-analysis-modal.tsx` | **Create** — extracted + redesigned |
| `components/vendors/map-modal.tsx` | **Create** — extracted + redesigned |
| `components/vendors/vendor-leads-table.tsx` | **Modify** — remove 5 inline modal definitions, add 5 imports |

### VendorLead type import

Every new modal file imports the type from the table:
```ts
import type { VendorLead } from "./vendor-leads-table"
```
`VendorLead` is already exported from that file.

### `toNum` and `fmtCurrency` helpers

`toNum` and `fmtCurrency` are **private** (unexported) in `vendor-leads-table.tsx`. The established pattern — already used in `property-details-modal.tsx` — is that each modal file defines its own local copies. Every modal file that needs these helpers must include them verbatim:

```ts
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
```

Do **not** add `export` to these functions in `vendor-leads-table.tsx` — that would change its public API unnecessarily. Do **not** create a shared utility file — YAGNI.

---

## ModalShell Component (complete)

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

---

## Shared Left-Panel Patterns

All left panels use these Tailwind patterns (consistent with `property-details-modal.tsx`):

```
Outer div:          flex flex-col gap-5 p-5 h-full
Address name:       text-sm font-bold leading-snug text-slate-100
Address sub:        mt-0.5 text-xs text-slate-400
Chip (dark):        rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200
Chip (green):       rounded-full bg-green-500 px-2 py-0.5 text-[10px] text-white font-semibold
Chip (amber):       rounded-full bg-amber-400 px-2 py-0.5 text-[10px] text-amber-900 font-semibold
Chip (red):         rounded-full bg-red-500 px-2 py-0.5 text-[10px] text-white font-semibold
Divider:            h-px bg-white/10
Section label:      text-[9px] font-bold uppercase tracking-widest text-slate-500
Metric row label:   text-xs text-slate-400
Metric row value:   text-xs font-bold text-slate-100
Highlight box:      rounded-lg border border-green-500/30 bg-green-500/10 p-3
Highlight label:    text-[11px] text-green-300
Highlight value:    text-xl font-extrabold text-green-400
Highlight value sm: text-sm font-bold text-green-400
Footer wrapper:     mt-auto border-t border-white/10 pt-3 flex items-center justify-between
Footer label:       text-[10px] text-slate-500
```

Each file imports `cn` from `@/lib/utils`, `StatusBadge` from `@/components/ui/status-badge`, and `getPipelineStageVarKey` from `@/lib/theme/status-colors` for the pipeline stage badge.

**BMV highlight box conditionality (standard across all modals):**
```tsx
{(bmv !== null || profit !== null) && (
  <div className="highlight-box ...">
    {/* BMV row */}
    {/* Profit row */}
  </div>
)}
```
Where `bmv = toNum(lead.bmvScore)` and `profit = toNum(lead.profitPotential)`.

---

## Per-Modal Specification

### 1. ValidationModal (`max-w-2xl`)

**File:** `components/vendors/validation-modal.tsx`
**Props:** `{ lead: VendorLead; onClose: () => void }`
**Imports needed:** `cn`, `StatusBadge`, `getPipelineStageVarKey`, `toNum`, `fmtCurrency`, `VendorLead`, `ModalShell`, `X` from lucide

**Left panel:**
- Address block: `lead.vendorName` (bold), `lead.propertyAddress` (muted)
- Chips row:
  - Bedrooms chip (dark) if `lead.bedrooms != null`
  - Property type chip (dark) if `lead.propertyType`
  - Validation status chip: green "✓ Passed" if `validationPassed === true`; red "✗ Failed" if `false`; grey (bg-white/10, text-slate-400) "Not validated" if `null`
- Divider
- Section "FINANCIALS"
- Metric rows: Asking Price (`fmtCurrency(lead.askingPrice)`), Market Value (`fmtCurrency(lead.estimatedMarketValue)`)
- BMV highlight box (shown when `bmv !== null || profit !== null`): BMV Discount (`bmv.toFixed(1)%`), Profit Potential (`fmtCurrency(profit)`)
- Divider
- Footer: Pipeline Stage `StatusBadge`

**Right panel (using ModalShell `children`):**
- Close button (top-right, `h-7 w-7 bg-gray-100 rounded-lg`, `aria-label="Close"`)
- Heading "VALIDATION NOTES" (`text-[10px] font-bold uppercase tracking-widest text-gray-500`)
- If `lead.validationNotes` present: `<pre className="whitespace-pre-wrap font-sans text-sm text-gray-700">` inside a `rounded-lg border border-gray-200 bg-gray-50 p-4` card
- If absent: empty state — `TrendingUp` icon (import from lucide) + "No validation run yet. Use the Check button to calculate BMV."
- **Removed:** the 4-metric grid (asking price, market value, BMV, profit) that existed in the old modal — this data is now in the left panel

### 2. PortalCheckModal (`max-w-3xl`)

**File:** `components/vendors/portal-check-modal.tsx`
**Props:** `{ lead: VendorLead; onClose: () => void; onRiskUpdated?: (newRisk: string | null, newDate: string | null) => void }`
**Note:** `onRiskUpdated` is passed through to `PortalCheckDetailPanel` so the table row updates after a re-run without a page refresh. The existing render call-site in `vendor-leads-table.tsx` does not pass this prop (it is optional), so no changes are needed at the call-site.
**Imports needed:** `PortalCheckDetailPanel` from `./portal-check-detail-panel`, `formatDistanceToNow` from `date-fns`, `ModalShell`, `VendorLead`, `X` from lucide

**Left panel:**
- Address block: `lead.vendorName` (bold), `lead.propertyAddress` (muted)
- Risk chip in chips row based on `lead.latestCheckRisk`:
  - `"clear"` → green chip "Clear"
  - `"caution"` → amber chip "Caution"
  - `"red_flag"` → red chip "Red Flag"
  - `null` → dark chip "Not checked"
- Divider
- Section "OVERALL RISK"
- Large risk box (full-width, rounded, padded, centred text):
  - `"clear"` → `bg-green-500/10 border border-green-500/30` — large "CLEAR" in `text-2xl font-extrabold text-green-400`, subtitle "No flags found" in `text-xs text-green-300`
  - `"caution"` → `bg-amber-500/10 border border-amber-500/30` — "CAUTION" in `text-amber-400`, subtitle "Review flags below" in `text-amber-300`
  - `"red_flag"` → `bg-red-500/10 border border-red-500/30` — "RED FLAG" in `text-red-400`, subtitle "Action required" in `text-red-300`
  - `null` → `bg-white/5 border border-white/10` — "NOT RUN" in `text-slate-400`, subtitle "Run a portal check" in `text-slate-500`
- Divider
- Footer: label "LAST CHECKED" + value:
  - If `lead.latestCheckedAt`: `formatDistanceToNow(new Date(lead.latestCheckedAt), { addSuffix: true })` (e.g. "2 hours ago")
  - If null: "Never"

**Right panel:**
- Close button (top-right)
- `PortalCheckDetailPanel` with props: `leadId={lead.id}`, `latestCheckRisk={lead.latestCheckRisk}`, `latestCheckedAt={lead.latestCheckedAt}`, `onRiskUpdated={onRiskUpdated}`

### 3. ComparableModal (`max-w-4xl`)

**File:** `components/vendors/comparable-modal.tsx`
**Props:** `{ lead: VendorLead; onClose: () => void }`
**Design note (intentional):** The left panel leads with `propertyAddress` bold and `propertyPostcode` muted, omitting `vendorName`. This is intentional — comparable analysis focuses on the subject property, not the vendor identity. All other modals lead with `vendorName`.
**Imports needed:** `VendorComparablesTab` from `./vendor-comparables-tab`, `ModalShell`, `VendorLead`, `toNum`, `fmtCurrency`, `cn`, `StatusBadge`, `getPipelineStageVarKey`, `X` from lucide

**Left panel:**
- Address block: `lead.propertyAddress` (bold), `lead.propertyPostcode` (muted) — **vendorName omitted, see note above**
- Chips: bedrooms chip (dark) if present, property type chip (dark) if present
- Divider
- Section "SUBJECT PROPERTY"
- Metric rows: Asking Price (`fmtCurrency(lead.askingPrice)`), Postcode (`lead.propertyPostcode ?? "—"`)
- Divider
- Section "COMPARABLES"
- Metric rows: Found (`lead.comparablesCount ?? "—"`), Avg Price (`fmtCurrency(lead.avgComparablePrice)`)
- BMV highlight box (shown when `bmv !== null || profit !== null`): Implied BMV (`bmv.toFixed(1)%`)
- Divider
- Footer: Pipeline Stage `StatusBadge`

**Right panel:**
- Close button (top-right)
- `VendorComparablesTab` with props: `vendorLeadId={lead.id}`, `askingPrice={toNum(lead.askingPrice) ?? undefined}`, `propertyPostcode={lead.propertyPostcode}`

### 4. OfferAnalysisModal (`max-w-4xl`)

**File:** `components/vendors/offer-analysis-modal.tsx`
**Props:** `{ lead: VendorLead; onClose: () => void }`
**Note:** max-w stays at `4xl` — same as the existing inline modal. (The original spec draft incorrectly stated `5xl`.)
**Imports needed:** `OfferAnalysisPanel` from `../deals/offer-analysis-panel`, `ModalShell`, `VendorLead`, `toNum`, `fmtCurrency`, `cn`, `StatusBadge`, `getPipelineStageVarKey`, `X` from lucide

**Left panel:**
- Address block: `lead.vendorName` (bold), `lead.propertyAddress` (muted)
- Chips: bedrooms chip (dark) if present
- Divider
- Section "DEAL INPUTS"
- Metric rows: Asking Price (`fmtCurrency(lead.askingPrice)`), Market Value (`fmtCurrency(lead.estimatedMarketValue)`), Monthly Rent (`fmtCurrency(lead.estimatedMonthlyRent)`), Refurb Est. (`fmtCurrency(lead.estimatedRefurbCost)`). Missing values show "—".
- BMV highlight box (shown when `bmv !== null || profit !== null`): BMV Discount (`bmv.toFixed(1)%`), Profit Potential (`fmtCurrency(profit)`)
- Divider
- Footer: Pipeline Stage `StatusBadge`

**Right panel:**
- Close button (top-right)
- `OfferAnalysisPanel` with all existing props:
  ```tsx
  <OfferAnalysisPanel
    vendorLeadId={lead.id}
    dealId={lead.dealId}
    askingPrice={toNum(lead.askingPrice) ?? 0}
    gdv={toNum(lead.estimatedMarketValue)}
    estimatedRent={toNum(lead.estimatedMonthlyRent)}
    totalRefurbishment={toNum(lead.estimatedRefurbCost)}
    vendorName={lead.vendorName}
    vendorEmail={lead.vendorEmail}
    vendorPhone={lead.vendorPhone}
    missingInputsHint={!toNum(lead.estimatedMarketValue) ? "Run BMV calculation first to populate Market Value." : undefined}
  />
  ```

### 5. MapModal (`max-w-3xl`)

**File:** `components/vendors/map-modal.tsx`
**Props:** `{ lead: VendorLead; onClose: () => void }`
**Right-panel padding:** Pass `rightPanelClassName="p-0"` to `ModalShell` so the map fills edge-to-edge. No close button in right panel — backdrop-click is sufficient for this modal.
**API key:** Use `process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""` — **no hardcoded fallback key**. The original inline modal contained a hardcoded key; the extracted file must not copy it.
**Imports needed:** `ModalShell`, `VendorLead`, `toNum`, `fmtCurrency`, `cn`, `StatusBadge`, `getPipelineStageVarKey`

**Left panel:**
- Address block: `lead.propertyAddress` (bold), `lead.propertyPostcode` (muted)
- Chips: bedrooms chip (dark) if present, property type chip (dark) if present, condition chip colour-coded:
  - green if `lead.condition === "excellent" || "good"`
  - amber if `"needs_work" || "needs_modernisation"`
  - red if `"poor"`
  - dark (default) if null
- Divider
- Section "PROPERTY"
- Metric rows: Asking Price (`fmtCurrency(lead.askingPrice)`), Type (`lead.propertyType ?? "—"`), Bedrooms (`lead.bedrooms?.toString() ?? "—"`)
- Divider
- Section "VENDOR"
- Metric rows: Name (`lead.vendorName`), Phone (`lead.vendorPhone`)
- Divider
- Footer: Pipeline Stage `StatusBadge`

**Right panel (via ModalShell `children`):**
- Google Maps `<iframe>` with:
  - `src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}`}`
  - `className="block h-full min-h-[300px] w-full border-0"`
  - `width="100%"` `height="100%"`
  - `loading="lazy"` `referrerPolicy="no-referrer-when-downgrade"`
  - `title={`Map: ${address}`}`

---

## vendor-leads-table.tsx Changes

1. **Remove** the five inline modal function definitions at approximately lines 683–948:
   - `function MapModal(...)`
   - `function PortalCheckModal(...)`
   - `function ValidationModal(...)`
   - `function ComparableModal(...)`
   - `function OfferAnalysisModal(...)`

2. **Add** five imports alongside the existing vendor component imports:
   ```ts
   import { MapModal } from "./map-modal"
   import { PortalCheckModal } from "./portal-check-modal"
   import { ValidationModal } from "./validation-modal"
   import { ComparableModal } from "./comparable-modal"
   import { OfferAnalysisModal } from "./offer-analysis-modal"
   ```

All existing state variables, render call-sites, and `onView` handler logic remain **unchanged**.

---

## Data Fields Used

All from existing `VendorLead` interface — no schema or API changes needed:

`vendorName`, `vendorPhone`, `propertyAddress`, `propertyPostcode`, `propertyType`, `bedrooms`, `condition`, `askingPrice`, `estimatedMarketValue`, `estimatedMonthlyRent`, `estimatedRefurbCost`, `bmvScore`, `profitPotential`, `comparablesCount`, `avgComparablePrice`, `validationPassed`, `validationNotes`, `latestCheckRisk`, `latestCheckedAt`, `dealId`, `vendorEmail`, `pipelineStage`

---

## Error / Empty States

- Missing numeric values: formatted as "—" via `fmtCurrency(null)` → "—"
- `latestCheckRisk === null` in PortalCheckModal: grey "NOT RUN" box, "Never" in footer
- `comparablesCount === null`: metric row shows "—", no highlight box shown
- BMV highlight box hidden entirely when both `bmv === null && profit === null` (standard guard)
- MapModal with no address: `encoded = encodeURIComponent("")` renders a generic map — acceptable

---

## Testing

TypeScript compilation (`npx tsc --noEmit`) is the primary verification step.

Manual verification: open each of the 6 tabs in the vendor leads table, click View on a lead:
1. **Property Details tab** — existing `PropertyDetailsModal` (unchanged)
2. **Portal Check tab** — new `PortalCheckModal`, confirm CLEAR/CAUTION/RED FLAG left panel
3. **Validation tab** — new `ValidationModal`, confirm notes or empty state in right panel
4. **Comparable tab** — new `ComparableModal`, confirm comparables table loads in right panel
5. **Offer Analysis tab** — new `OfferAnalysisModal`, confirm offer calculator loads
6. **Map View tab** — new `MapModal`, confirm map fills right panel edge-to-edge

Confirm backdrop-click and/or ✕ button close each modal.
