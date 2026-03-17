# Theme System — Sub-project 1: Consistency Pass — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route all badge colours, KPI bar implementations, and sidebar colours through a single source of truth so the theme picker (Sub-project 2) can control them via CSS variables.

**Architecture:** Create three shared files (`lib/theme/status-colors.ts`, `components/ui/status-badge.tsx`, `components/ui/kpi-bar.tsx`), then update six components to import from them instead of maintaining local colour maps. The sidebar's hardcoded hex values are replaced with CSS variable references. No schema changes, no API changes.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Radix UI Tooltip (already installed), `@/lib/utils` (cn).

---

## Codebase context (read before starting)

- **No test suite** — verification is `npx tsc --noEmit` (TypeScript, zero new errors) plus a browser smoke-test
- **`@/lib/utils`** exports `cn` (classnames helper)
- **Radix Tooltip** is already installed and used in the codebase. Import from `@/components/ui/tooltip`
- **`components/vendors/vendor-leads-table.tsx`** has a local `StageBadge` component (lines ~250-260) and a local `KpiBar` component (lines 482-536). Both will be replaced by shared components
- **`components/deals/deal-list.tsx`** has a local `DealKpiBar` component (lines ~134-203) and a `getStatusColor` function (lines ~68-80). Both will be replaced
- **`components/dashboard/vendor-analytics-panel.tsx`** has `getStageColor(stage)` returning `{ bg: string }` — this will be simplified to return a plain `string` (callers updated from `.bg` to direct use)
- **`components/investors/investor-list.tsx`** has four local colour maps; the strategy badges use shadcn `<Badge variant="outline">` with border classes included in the colour string — those border classes must be preserved in `getInvestorStrategyStyle`

---

## Chunk 1: Foundation files

### Task 1: Create `lib/theme/status-colors.ts`

**Files:**
- Create: `lib/theme/status-colors.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/theme/status-colors.ts
// Single source of truth for all badge/status colour maps.
// Returns Tailwind class strings. Replace all local colour lookup maps with these.

/** Deal status badges — DealStatus enum values */
export function getDealStatusStyle(status: string): string {
  const map: Record<string, string> = {
    new:         "bg-gray-100 text-gray-800",
    review:      "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    ready:       "bg-purple-100 text-purple-800",
    listed:      "bg-green-100 text-green-800",
    reserved:    "bg-orange-100 text-orange-800",
    sold:        "bg-green-200 text-green-800",
    archived:    "bg-gray-200 text-gray-600",
  }
  return map[status] ?? "bg-gray-100 text-gray-800"
}

/** Pipeline stage badges — exact PipelineStage enum values */
export function getPipelineStageStyle(stage: string): string {
  const map: Record<string, string> = {
    NEW_LEAD:             "bg-blue-100 text-blue-700",
    AI_CONVERSATION:      "bg-violet-100 text-violet-700",
    DEAL_VALIDATION:      "bg-amber-100 text-amber-700",
    OFFER_MADE:           "bg-emerald-100 text-emerald-700",
    OFFER_ACCEPTED:       "bg-green-100 text-green-700",
    OFFER_REJECTED:       "bg-red-100 text-red-700",
    VIDEO_SENT:           "bg-cyan-100 text-cyan-700",
    RETRY_1:              "bg-orange-100 text-orange-700",
    RETRY_2:              "bg-orange-100 text-orange-700",
    RETRY_3:              "bg-orange-100 text-orange-700",
    PAPERWORK_SENT:       "bg-indigo-100 text-indigo-700",
    READY_FOR_INVESTORS:  "bg-purple-100 text-purple-700",
    DEAD_LEAD:            "bg-red-200 text-red-800",
  }
  return map[stage] ?? "bg-gray-100 text-gray-700"
}

/** Contact type badges — exact ContactType enum values */
export function getContactTypeStyle(type: string): string {
  const map: Record<string, string> = {
    SOLICITOR:        "bg-blue-100 text-blue-700",
    INVESTOR_CONTACT: "bg-purple-100 text-purple-700",
    VENDOR_CONTACT:   "bg-teal-100 text-teal-700",
    ESTATE_AGENT:     "bg-green-100 text-green-700",
    CONTRACTOR:       "bg-amber-100 text-amber-700",
    OTHER:            "bg-gray-100 text-gray-700",
  }
  return map[type] ?? "bg-gray-100 text-gray-700"
}

/** Investor strategy badges — includes border class for shadcn Badge variant="outline" */
export function getInvestorStrategyStyle(strategy: string): string {
  const map: Record<string, string> = {
    BRRRR: "bg-pink-100 text-pink-800 border-pink-200",
    BTL:   "bg-cyan-100 text-cyan-800 border-cyan-200",
    Flip:  "bg-orange-100 text-orange-800 border-orange-200",
    HMO:   "bg-purple-100 text-purple-800 border-purple-200",
    SA:    "bg-blue-100 text-blue-800 border-blue-200",
  }
  return map[strategy] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Investor experience level badges — includes border class */
export function getInvestorExperienceStyle(experience: string): string {
  const map: Record<string, string> = {
    beginner:     "bg-blue-100 text-blue-800 border-blue-200",
    intermediate: "bg-green-100 text-green-800 border-green-200",
    advanced:     "bg-purple-100 text-purple-800 border-purple-200",
  }
  return map[experience.toLowerCase()] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Investor pipeline stage chips — includes border class */
export function getInvestorPipelineStageStyle(stage: string): string {
  const map: Record<string, string> = {
    LEAD:          "bg-gray-100 text-gray-700 border-gray-200",
    CONTACTED:     "bg-blue-100 text-blue-700 border-blue-200",
    QUALIFIED:     "bg-green-100 text-green-700 border-green-200",
    VIEWING_DEALS: "bg-purple-100 text-purple-700 border-purple-200",
    RESERVED:      "bg-yellow-100 text-yellow-700 border-yellow-200",
    PURCHASED:     "bg-emerald-100 text-emerald-700 border-emerald-200",
    INACTIVE:      "bg-red-100 text-red-700 border-red-200",
  }
  return map[stage] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Reservation status chips — includes border class */
export function getReservationStatusStyle(status: string): string {
  const map: Record<string, string> = {
    pending:                "bg-gray-100 text-gray-700 border-gray-200",
    pack_sent:              "bg-blue-100 text-blue-700 border-blue-200",
    fee_pending:            "bg-yellow-100 text-yellow-700 border-yellow-200",
    fee_paid:               "bg-emerald-100 text-emerald-700 border-emerald-200",
    proof_of_funds_pending: "bg-orange-100 text-orange-700 border-orange-200",
    pof_received:           "bg-sky-100 text-sky-700 border-sky-200",
    lock_out_sent:          "bg-purple-100 text-purple-700 border-purple-200",
    locked_out:             "bg-violet-100 text-violet-700 border-violet-200",
  }
  return map[status] ?? "bg-gray-100 text-gray-700 border-gray-200"
}

/** Vendor analytics funnel stages (lowercase analytics keys, not PipelineStage enum) */
export function getAnalyticsFunnelStageStyle(stage: string): string {
  const map: Record<string, string> = {
    contacted:      "bg-blue-100 text-blue-800 border-blue-200",
    validated:      "bg-green-100 text-green-800 border-green-200",
    offer_made:     "bg-yellow-100 text-yellow-800 border-yellow-200",
    negotiating:    "bg-orange-100 text-orange-800 border-orange-200",
    offer_accepted: "bg-purple-100 text-purple-800 border-purple-200",
    offer_rejected: "bg-red-100 text-red-800 border-red-200",
    locked_out:     "bg-emerald-100 text-emerald-800 border-emerald-200",
    withdrawn:      "bg-gray-100 text-gray-800 border-gray-200",
  }
  return map[stage] ?? "bg-gray-100 text-gray-800 border-gray-200"
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add lib/theme/status-colors.ts
git commit -m "feat: add centralised status-colors utility"
```

---

### Task 2: Create `components/ui/status-badge.tsx`

**Files:**
- Create: `components/ui/status-badge.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/ui/status-badge.tsx
"use client"

import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface StatusBadgeProps {
  label: string
  className?: string  // Tailwind colour classes e.g. "bg-blue-100 text-blue-700"
  tooltip?: string    // Optional tooltip text shown on hover
}

export function StatusBadge({ label, className, tooltip }: StatusBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  )

  if (!tooltip) return badge

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/status-badge.tsx
git commit -m "feat: add shared StatusBadge component"
```

---

### Task 3: Create `components/ui/kpi-bar.tsx`

**Files:**
- Create: `components/ui/kpi-bar.tsx`

- [ ] **Step 1: Create the file**

```tsx
// components/ui/kpi-bar.tsx
"use client"

import type React from "react"
import { cn } from "@/lib/utils"

export interface KpiTile {
  label: string
  value: string            // pre-formatted display string e.g. "£240,000" or "18.4%"
  icon: React.ReactNode
  iconBgClass: string      // e.g. "bg-blue-50"
  valueColorClass?: string // e.g. "text-green-600" — defaults to "text-gray-900"
  tooltip?: string         // optional tooltip on the value
}

interface KpiBarProps {
  tiles: KpiTile[]
}

export function KpiBar({ tiles }: KpiBarProps) {
  return (
    <div className="flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm">
      {tiles.map((tile, i) => (
        <div key={i} className="flex flex-1 items-center gap-3 px-5 py-4">
          <div
            className={cn(
              "flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg",
              tile.iconBgClass
            )}
          >
            {tile.icon}
          </div>
          <div>
            <p
              className={cn(
                "font-mono text-xl font-bold",
                tile.valueColorClass ?? "text-gray-900"
              )}
            >
              {tile.value}
            </p>
            <p className="text-xs text-gray-500">{tile.label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/kpi-bar.tsx
git commit -m "feat: add shared KpiBar component"
```

---

### Task 4: Update `app/globals.css` — add typography/spacing tokens

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Read the file and find the `:root` block**

Open `app/globals.css`. Find the `:root { ... }` block (around lines 20–75). It already contains `--ds-primary`, `--ds-accent`, `--sidebar-bg` etc.

- [ ] **Step 2: Add new tokens to `:root`**

Inside the `:root` block, add after the existing spacing variables (`--page-padding`, `--card-padding`, `--section-gap`):

```css
/* Typography tokens — controlled by theme picker */
--font-size-base: 14px;
--font-weight-heading: 700;

/* Table density */
--table-row-height: 52px;
```

- [ ] **Step 3: Wire tokens to elements**

Find the existing `body` selector in `globals.css` (it already has `@apply bg-background text-foreground` and `font-feature-settings`). Add `font-size: var(--font-size-base);` as a new line **inside that existing block** — do NOT create a second `body` rule:

```css
body {
  @apply bg-background text-foreground;
  font-feature-settings: "rlig" 1, "calt" 1;
  font-size: var(--font-size-base);   /* ADD THIS LINE */
}
```

Then find or create a heading rule. Add after the body rule:

```css
h1, h2, h3, h4, h5, h6 {
  font-weight: var(--font-weight-heading);
}
```

- [ ] **Step 4: Verify TypeScript (globals.css has no TS, just confirm the build doesn't break)**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "feat: add typography and spacing CSS tokens"
```

---

## Chunk 2: Component updates

### Task 5: Update `components/layout/DualSidebar.tsx` — replace hardcoded hex with CSS variables

**Files:**
- Modify: `components/layout/DualSidebar.tsx`

The following CSS variables already exist in `globals.css` — no new additions needed:
- `--sidebar-bg` = `#1A1A1F`
- `--sidebar-active-bg` = `#F5A623`
- `--sidebar-hover` = `#2A2A32`
- `--sidebar-border` = `#2D2D38`

- [ ] **Step 1: Replace all hardcoded hex values**

Make these exact replacements throughout the file (use search-and-replace, there are multiple occurrences of each):

| Find | Replace |
|---|---|
| `bg-[#1A1A1F]` | `bg-[var(--sidebar-bg)]` |
| `text-[#1A1A1F]` | `text-[var(--sidebar-bg)]` |
| `bg-[#F5A623]` | `bg-[var(--sidebar-active-bg)]` |
| `hover:bg-[#2A2A32]` | `hover:bg-[var(--sidebar-hover)]` |
| `border-[#2D2D38]` | `border-[var(--sidebar-border)]` |
| `bg-[#2D2D38]` | `bg-[var(--sidebar-border)]` |

Expected occurrences: `bg-[#1A1A1F]` — 1, `text-[#1A1A1F]` — 2, `bg-[#F5A623]` — 2, `hover:bg-[#2A2A32]` — 2, `border-[#2D2D38]` — 2, `bg-[#2D2D38]` — 1.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero new errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/DualSidebar.tsx
git commit -m "refactor: replace sidebar hardcoded hex with CSS variables"
```

---

### Task 6: Update `components/deals/deal-list.tsx`

**Files:**
- Modify: `components/deals/deal-list.tsx`

- [ ] **Step 0: Record baseline**

```bash
npx tsc --noEmit 2>&1 | tee /tmp/ts-baseline-deallist.log; echo "done"
```

- [ ] **Step 1: Add imports**

At the top of the file, add:
```tsx
import { KpiBar, type KpiTile } from "@/components/ui/kpi-bar"
import { StatusBadge } from "@/components/ui/status-badge"
import { getDealStatusStyle } from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Remove `getStatusColor` local function**

> **Note:** The live `getStatusColor` maps `sold` to `"bg-success/20 text-success"`, while `getDealStatusStyle` normalises it to `"bg-green-200 text-green-800"`. This is an intentional normalisation — the semantic colour token (`bg-success/20`) is replaced with an explicit Tailwind class so the theme picker can control it. Not a regression.

Find and delete the `getStatusColor` function (lines ~68-80):
```ts
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    ...
  }
  return colors[status] || "bg-gray-100 text-gray-800"
}
```

Keep the `formatStatus` function — it's still needed as a label formatter.

- [ ] **Step 3: Replace the `DealKpiBar` function with a slimmer version**

Find the `DealKpiBar` function (lines ~134-203). Replace the entire function with this leaner version that uses the shared `KpiBar`:

```tsx
function DealKpiBar({ deals }: { deals: DealWithRelations[] }) {
  const kpis = useMemo(() => computeKpis(deals), [deals])

  const tiles: KpiTile[] = [
    {
      label: "Active Deals",
      value: String(kpis.activeDeals),
      icon: <Target className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-gray-900",
    },
    {
      label: "Avg BMV %",
      value: kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      iconBgClass: "bg-green-50",
      valueColorClass: "text-green-600",
    },
    {
      label: "Avg Gross Yield",
      value: kpis.avgGrossYield !== null ? `${kpis.avgGrossYield.toFixed(1)}%` : "—",
      icon: <BarChart2 className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-blue-600",
    },
    {
      label: "Pipeline Value",
      value: formatCurrency(kpis.totalPipelineValue),
      icon: <DollarSign className="h-4 w-4 text-purple-600" />,
      iconBgClass: "bg-purple-50",
      valueColorClass: "text-purple-600",
    },
    {
      label: "Avg Deal Score",
      value: kpis.avgDealScore !== null ? `${kpis.avgDealScore.toFixed(0)}/100` : "—",
      icon: <Star className="h-4 w-4 text-amber-600" />,
      iconBgClass: "bg-amber-50",
      valueColorClass: "text-amber-600",
    },
  ]

  return <KpiBar tiles={tiles} />
}
```

- [ ] **Step 4: Update the Status table cell in TableView**

Find the Status column in `TableView` (look for `getStatusColor`):
```tsx
<td className="table-cell">
  <span
    className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(deal.status)}`}
  >
    {formatStatus(deal.status)}
  </span>
</td>
```

Replace with:
```tsx
<td className="table-cell">
  <StatusBadge
    label={formatStatus(deal.status)}
    className={getDealStatusStyle(deal.status)}
  />
</td>
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Compare with baseline. Fix any new errors.

- [ ] **Step 6: Commit**

```bash
git add components/deals/deal-list.tsx
git commit -m "refactor: use shared KpiBar and StatusBadge in deal-list"
```

---

### Task 7: Update `components/deals/deal-detail-modal.tsx`

**Files:**
- Modify: `components/deals/deal-detail-modal.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { StatusBadge } from "@/components/ui/status-badge"
import { getDealStatusStyle } from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Remove local `statusColor` and `STATUS_COLORS` constant**

Find and delete:
```tsx
const STATUS_COLORS: Record<string, string> = {
  new: "bg-gray-100 text-gray-800",
  ...
}

function statusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-100 text-gray-800"
}
```

- [ ] **Step 3: Update the status badge in the left panel**

Find the status badge in the left panel (inside the property header section):
```tsx
<span
  className={cn(
    "rounded-full px-2 py-0.5 text-[10px] font-medium",
    statusColor(deal.status)
  )}
>
  {formatStatus(deal.status)}
</span>
```

Replace with:
```tsx
<StatusBadge
  label={formatStatus(deal.status)}
  className={getDealStatusStyle(deal.status)}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero new errors.

- [ ] **Step 5: Commit**

```bash
git add components/deals/deal-detail-modal.tsx
git commit -m "refactor: use shared StatusBadge in deal-detail-modal"
```

---

### Task 8: Update `components/vendors/vendor-leads-table.tsx`

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

- [ ] **Step 0: Record baseline**

```bash
npx tsc --noEmit 2>&1 | tee /tmp/ts-baseline-vlt.log; echo "done"
```

- [ ] **Step 1: Add imports**

```tsx
import { KpiBar, type KpiTile } from "@/components/ui/kpi-bar"
import { StatusBadge } from "@/components/ui/status-badge"
import { getPipelineStageStyle } from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Delete the `STAGE_STYLE` constant**

Find and delete:
```ts
const STAGE_STYLE: Record<PipelineStage, string> = {
  NEW_LEAD: "bg-blue-100 text-blue-700",
  ...
}
```

- [ ] **Step 3: Update the `StageBadge` component**

> **Note:** The canonical colours in `getPipelineStageStyle` differ intentionally from the old `STAGE_STYLE` for four stages: `VIDEO_SENT` (sky → cyan), `PAPERWORK_SENT` (teal → indigo), `READY_FOR_INVESTORS` (green → purple), `DEAD_LEAD` (neutral grey → red-on-red). These are deliberate normalisation changes — not regressions. Do not revert them to match the old values.

Find the `StageBadge` function (it uses `STAGE_STYLE` and wraps in `<Tip>`). Replace it with a version that uses the shared components:

```tsx
function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <StatusBadge
      label={STAGE_LABEL[stage]}
      className={getPipelineStageStyle(stage)}
      tooltip={STAGE_DESC[stage]}
    />
  )
}
```

Note: `STAGE_LABEL` and `STAGE_DESC` constants should remain unchanged — they provide the display text and tooltip descriptions.

- [ ] **Step 4: Replace the local `KpiBar` function**

Find the `KpiBar` function (lines 482–536). Replace it with a version that builds a tiles array and uses the shared `KpiBar`:

```tsx
function VendorLeadsKpiBar({ kpis }: { kpis: Kpis }) {
  const tiles: KpiTile[] = [
    {
      label: "Total Leads",
      value: String(kpis.total),
      icon: <Users className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-gray-900",
    },
    {
      label: "Avg BMV %",
      value: kpis.avgBmv !== null ? `${kpis.avgBmv.toFixed(1)}%` : "—",
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      iconBgClass: "bg-green-50",
      valueColorClass: "text-green-600",
    },
    {
      label: "Portal Pass Rate",
      value: kpis.portalPassRate !== null ? `${kpis.portalPassRate.toFixed(0)}%` : "—",
      icon: <BarChart2 className="h-4 w-4 text-blue-600" />,
      iconBgClass: "bg-blue-50",
      valueColorClass: "text-blue-600",
    },
    {
      label: "Processing",
      value: String(kpis.processing),
      icon: <Zap className="h-4 w-4 text-amber-600" />,
      iconBgClass: "bg-amber-50",
      valueColorClass: "text-amber-600",
    },
  ]
  return <KpiBar tiles={tiles} />
}
```

Then find where `<KpiBar kpis={kpis} />` is called in the JSX and change it to `<VendorLeadsKpiBar kpis={kpis} />`.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any new errors.

- [ ] **Step 6: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "refactor: use shared KpiBar and StatusBadge in vendor-leads-table"
```

---

### Task 9: Update `components/investors/investor-list.tsx`

**Files:**
- Modify: `components/investors/investor-list.tsx`

- [ ] **Step 1: Add imports**

```tsx
import {
  getInvestorStrategyStyle,
  getInvestorExperienceStyle,
  getInvestorPipelineStageStyle,
  getReservationStatusStyle,
} from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Delete the four local colour maps**

Find and delete these four constants:
- `const experienceColors: Record<string, string> = { ... }`
- `const strategyColors: Record<string, string> = { ... }`
- `const pipelineStageColors: Record<string, string> = { ... }`
- `const reservationStatusColors: Record<string, string> = { ... }`

- [ ] **Step 3: Update callers**

Search the file for all usages of the deleted maps and replace:

**`experienceColors` — no JSX callers:** The `experienceColors` map is defined in the file but is never referenced in any JSX. Simply deleting it is sufficient — there is no caller to update. `getInvestorExperienceStyle` is imported for completeness (it is part of the public API of `status-colors.ts`) and will be used by future code; there is no JSX update step needed here.

**`strategyColors[s]` → `getInvestorStrategyStyle(s)`**

> **Note:** The live `strategyColors` map only has three entries: `BRRRR`, `BTL`, `Flip`. The shared function adds `HMO` and `SA` as new supported values. This is intentional — existing data is unaffected (the old fallback handled missing keys; the new function does too).

The strategy badges use shadcn `<Badge variant="outline" className={...}>`. Keep the shadcn Badge DOM element — just replace the className source:
```tsx
// Before:
<Badge key={s} variant="outline" className={`text-xs ${strategyColors[s] || "bg-gray-100 text-gray-800 border-gray-200"}`}>
// After:
<Badge key={s} variant="outline" className={`text-xs ${getInvestorStrategyStyle(s)}`}>
```

**`pipelineStageColors[stage]` → `getInvestorPipelineStageStyle(stage)`**

The pipeline stage chip is a square div (not a pill badge) — keep the `h-6 w-6 rounded` DOM element, just replace the colour source:
```tsx
// Before:
className={`h-6 w-6 rounded flex items-center justify-center border cursor-default shrink-0 ${pipelineStageColors[stage] || "bg-gray-100 text-gray-700 border-gray-200"}`}
// After:
className={`h-6 w-6 rounded flex items-center justify-center border cursor-default shrink-0 ${getInvestorPipelineStageStyle(stage)}`}
```

Also update the pill badge variant (in the edit dialog):
```tsx
// Before:
className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${pipelineStageColors[stage] ?? "..."}`}
// After:
className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getInvestorPipelineStageStyle(stage)}`}
```

**`reservationStatusColors[res.status]` → `getReservationStatusStyle(res.status)`**

The reservation chip uses a small `<span>` — keep the DOM element:
```tsx
// Before:
className={`shrink-0 px-1 py-px rounded text-[10px] font-medium ${reservationStatusColors[res.status]}`}
// After:
className={`shrink-0 px-1 py-px rounded text-[10px] font-medium ${getReservationStatusStyle(res.status)}`}
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any new errors.

- [ ] **Step 5: Commit**

```bash
git add components/investors/investor-list.tsx
git commit -m "refactor: use shared status-colors in investor-list"
```

---

### Task 10: Update `components/contacts/contact-card.tsx`

**Files:**
- Modify: `components/contacts/contact-card.tsx`

- [ ] **Step 1: Add imports**

```tsx
import { StatusBadge } from "@/components/ui/status-badge"
import { getContactTypeStyle } from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Delete the `TYPE_COLORS` map**

> **Note:** Two values differ intentionally: `VENDOR_CONTACT` changes from `bg-orange-100 text-orange-700` → `bg-teal-100 text-teal-700`, and `CONTRACTOR` changes from `bg-yellow-100 text-yellow-700` → `bg-amber-100 text-amber-700`. These are deliberate normalisation changes — not regressions.

Find and delete:
```ts
const TYPE_COLORS: Record<ContactType, string> = {
  SOLICITOR:        "bg-blue-100 text-blue-700",
  INVESTOR_CONTACT: "bg-purple-100 text-purple-700",
  VENDOR_CONTACT:   "bg-orange-100 text-orange-700",
  ESTATE_AGENT:     "bg-green-100 text-green-700",
  CONTRACTOR:       "bg-yellow-100 text-yellow-700",
  OTHER:            "bg-gray-100 text-gray-700",
}
```

- [ ] **Step 3: Replace the contact type badge**

Find the badge that uses `TYPE_COLORS`:
```tsx
<span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[contact.type]}`}>
  {TYPE_LABELS[contact.type]}
</span>
```

Replace with:
```tsx
<StatusBadge
  label={TYPE_LABELS[contact.type]}
  className={getContactTypeStyle(contact.type)}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 5: Commit**

```bash
git add components/contacts/contact-card.tsx
git commit -m "refactor: use shared StatusBadge in contact-card"
```

---

### Task 11: Update `components/dashboard/vendor-analytics-panel.tsx`

**Files:**
- Modify: `components/dashboard/vendor-analytics-panel.tsx`

- [ ] **Step 1: Add import**

```tsx
import { getAnalyticsFunnelStageStyle } from "@/lib/theme/status-colors"
```

- [ ] **Step 2: Delete `getStageColor` function**

Find and delete:
```ts
const getStageColor = (stage: string) => {
  const colors: Record<string, { bg: string }> = {
    contacted:      { bg: "bg-blue-100 text-blue-800 border-blue-200" },
    ...
  }
  return colors[stage] || { bg: "bg-gray-100 text-gray-800 border-gray-200" }
}
```

- [ ] **Step 3: Update all callers of `getStageColor`**

Search for `getStageColor(` in the file. There are two patterns to fix:

**Pattern A** — Used as `getStageColor(stage.stage).bg`:
```tsx
// Before:
<Badge className={getStageColor(stage.stage).bg} variant="outline">
// After:
<Badge className={getAnalyticsFunnelStageStyle(stage.stage)} variant="outline">
```

**Pattern B** — A second call site where the argument is `stage` (not `stage.stage`):
```tsx
// Before:
<Badge className={getStageColor(stage).bg} variant="outline">
// After:
<Badge className={getAnalyticsFunnelStageStyle(stage)} variant="outline">
```

- [ ] **Step 4: Check for inline hardcoded badge classes in data arrays**

Search the file for `cls:` properties. They appear inside a nested `from`/`to` structure, like this:
```tsx
{
  from: { label: "Contacted", cls: "bg-blue-100 text-blue-800 border-blue-200" },
  to:   { label: "Validated",  cls: "bg-green-100 text-green-800 border-green-200" },
  ...
}
```

Replace each `cls` string literal with a call to `getAnalyticsFunnelStageStyle` using the appropriate lowercase key:
```tsx
{
  from: { label: "Contacted", cls: getAnalyticsFunnelStageStyle("contacted") },
  to:   { label: "Validated",  cls: getAnalyticsFunnelStageStyle("validated") },
  ...
}
```

Valid keys: `"contacted"`, `"validated"`, `"offer_made"`, `"negotiating"`, `"offer_accepted"`, `"offer_rejected"`, `"locked_out"`, `"withdrawn"`.

- [ ] **Step 4b: Update inline Badge hardcodes in the "Overall" section**

There is a separate block (outside the data array) with two hardcoded `className` Badge strings. Find and update them:

```tsx
// Before:
<Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Contacted</Badge>
<span>→</span>
<Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Locked Out</Badge>

// After:
<Badge variant="outline" className={getAnalyticsFunnelStageStyle("contacted")}>Contacted</Badge>
<span>→</span>
<Badge variant="outline" className={getAnalyticsFunnelStageStyle("locked_out")}>Locked Out</Badge>
```

Note: `getConversionColor` is a threshold function (not a colour map) — leave it unchanged.

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any new errors.

- [ ] **Step 6: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 7: Commit**

```bash
git add components/dashboard/vendor-analytics-panel.tsx
git commit -m "refactor: use shared status-colors in vendor-analytics-panel"
```

---

## Smoke test

After all 11 tasks are committed, verify visually in the browser:

```bash
npm run dev
```

1. Navigate to `/dashboard/deals` — KPI bar renders, status badges visible
2. Navigate to `/dashboard/vendor-leads` — KPI bar renders, stage badges with tooltips visible
3. Navigate to `/dashboard/investors` — strategy badges and pipeline stage chips visible
4. Navigate to `/dashboard/contacts` — contact type badges visible
5. Navigate to `/dashboard` (main dashboard) — vendor analytics panel renders, funnel stage badges visible
6. Sidebar — colours look identical to before (same values, now via CSS vars)

If any page looks broken, run `npx tsc --noEmit` to check for errors, and compare the failing badge's colour class against what `status-colors.ts` returns for that value.
