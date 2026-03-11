# Pipeline Alerts + Investor Matcher Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add pipeline action alerts (dashboard strip + sidebar badges) and an investor criteria matcher panel on the Deal detail page.

**Architecture:** Two independent features sharing one new API endpoint (`/api/action-counts`). Feature 1 surfaces deals-in-review and vendor-leads-ready-for-investors as amber alerts on the dashboard and red count badges in the nav sidebar. Feature 2 adds a server-rendered panel to the Deal detail page sidebar that ranks all investors by match score against the deal's postcode, budget, BMV, yield, and strategy.

**Tech Stack:** Next.js 14 App Router, Prisma 5 + PostgreSQL, Tailwind CSS, shadcn/ui, Lucide React. No new DB tables or migrations needed.

---

## Key Files to Understand Before Starting

| File | What to know |
|---|---|
| `app/api/analytics/kpis/route.ts` | Reference pattern for API routes: `getServerSession` auth guard, Prisma queries, `NextResponse.json` |
| `components/dashboard/dashboard-kpi-strip.tsx` | Reference for a client component that fetches on mount |
| `app/dashboard/page.tsx` | Dashboard page where `<ActionRequiredStrip>` gets added (above `<DashboardKpiStrip />`) |
| `components/layout/DualSidebar.tsx` | The sidebar — already a client component. Uses `usePathname`, `useSession`. Nav items rendered via `group.items.map(...)` loop. The secondary sidebar is 260px wide. |
| `config/navigation.ts` | `NAV_SECTIONS` — nav items for "Vendor Leads" use `href: "/dashboard/vendors"`, "Deal Analysis" uses `href: "/dashboard/deals"` |
| `app/dashboard/deals/[id]/page.tsx` | Deal detail page. Sidebar starts at line 654. `<VendorSection>` is at line 838, `<ReservationList>` at line 841. Matcher panel goes between these two. |
| `prisma/schema.prisma` | `Deal.status` is a `DealStatus` enum (values: `new`, `review`, `in_progress`, `ready`, `listed`, `reserved`, `sold`, `archived`). `VendorLead.pipelineStage` is a `PipelineStage` enum (includes `READY_FOR_INVESTORS`). `InvestorReservation.status` is `ReservationStatus` enum (includes `cancelled`). `Investor` has `preferredAreas String[]`, `minBudget Int?`, `maxBudget Int?`, `minYield Decimal?`, `minBmv Decimal?`, `strategy String[]`. `Deal` has `postcode String?`, `askingPrice Decimal`, `bmvPercentage Decimal?`, `grossYield Decimal?`, `recommendedStrategy String?` (values: `"flip"` or `"hold"`). |

---

## Chunk 1: Feature 1 — Pipeline Action Alerts

### Task 1: Create `/api/action-counts` endpoint

**Files:**
- Create: `app/api/action-counts/route.ts`

This endpoint queries:
- Deals with `status = 'review'` (needs a review decision)
- VendorLeads with `pipelineStage = 'READY_FOR_INVESTORS'` (ready for investor assignment)

Returns counts + an array of actionable items for the strip component.

- [ ] **Step 1: Create the file**

```typescript
// app/api/action-counts/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

export interface ActionItem {
  type: "deal" | "vendor"
  id: string
  label: string
  href: string
  action: string
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const [dealsInProgress, vendorsReady] = await Promise.all([
    prisma.deal.findMany({
      where: {
        status: "in_progress",
        investorReservations: { none: { status: { not: "cancelled" } } },
      },
      select: { id: true, address: true, postcode: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
    prisma.vendorLead.findMany({
      where: { pipelineStage: "READY_FOR_INVESTORS" },
      select: { id: true, vendorName: true },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ])

  const items: ActionItem[] = [
    ...dealsInProgress.map((d) => ({
      type: "deal" as const,
      id: d.id,
      label: [d.address, d.postcode].filter(Boolean).join(", "),
      href: `/dashboard/deals/${d.id}`,
      action: "Review",
    })),
    ...vendorsReady.map((v) => ({
      type: "vendor" as const,
      id: v.id,
      label: v.vendorName,
      href: `/dashboard/vendors/${v.id}`,
      action: "Match",
    })),
  ]

  return NextResponse.json({
    dealsCount: dealsInProgress.length,
    vendorsCount: vendorsReady.length,
    items,
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors (or only pre-existing unrelated errors)

- [ ] **Step 3: Commit**

```bash
git add app/api/action-counts/route.ts
git commit -m "feat: add /api/action-counts endpoint for pipeline alerts"
```

---

### Task 2: Create `ActionRequiredStrip` component

**Files:**
- Create: `components/dashboard/action-required-strip.tsx`

Client component that fetches `/api/action-counts` on mount and renders an amber banner. Renders nothing if there are no action items.

- [ ] **Step 1: Create the file**

```tsx
// components/dashboard/action-required-strip.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle } from "lucide-react"

interface ActionItem {
  type: "deal" | "vendor"
  id: string
  label: string
  href: string
  action: string
}

interface ActionCounts {
  dealsCount: number
  vendorsCount: number
  items: ActionItem[]
}

export function ActionRequiredStrip() {
  const [data, setData] = useState<ActionCounts | null>(null)

  useEffect(() => {
    fetch("/api/action-counts")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {
        /* silently ignore */
      })
  }, [])

  if (!data || data.items.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <AlertTriangle className="h-4 w-4" />
        {data.items.length} action{data.items.length !== 1 ? "s" : ""} required
      </p>
      <div className="space-y-1.5">
        {data.items.map((item) => (
          <div
            key={`${item.type}-${item.id}`}
            className="flex items-center justify-between gap-4 border-t border-amber-200 pt-1.5"
          >
            <p className="truncate text-sm text-amber-900">{item.label}</p>
            <Link
              href={item.href}
              className="shrink-0 rounded bg-amber-400 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-500"
            >
              {item.action} →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/action-required-strip.tsx
git commit -m "feat: add ActionRequiredStrip amber alert component"
```

---

### Task 3: Add `ActionRequiredStrip` to Dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

Add `<ActionRequiredStrip />` between the `<PageHeader>` block and `<DashboardKpiStrip />`. Also add the import.

- [ ] **Step 1: Add the import**

In `app/dashboard/page.tsx`, add to the existing imports:

```typescript
import { ActionRequiredStrip } from "@/components/dashboard/action-required-strip"
```

- [ ] **Step 2: Add the component**

Find this in `app/dashboard/page.tsx` (around line 83):

```tsx
      {/* KPI strip — client component, fetches /api/analytics/kpis with date filter */}
      <DashboardKpiStrip />
```

Replace with:

```tsx
      {/* Pipeline action alerts — amber strip showing deals/vendors needing attention */}
      <ActionRequiredStrip />

      {/* KPI strip — client component, fetches /api/analytics/kpis with date filter */}
      <DashboardKpiStrip />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: show pipeline action alerts strip on dashboard"
```

---

### Task 4: Add count badges to sidebar nav items

**Files:**
- Modify: `components/layout/DualSidebar.tsx`

The `DualSidebar` is already a client component. Add a `useEffect` to fetch `/api/action-counts` on mount, store the counts, and render a small red badge on the "Vendor Leads" nav item (`/dashboard/vendors`) and "Deal Analysis" nav item (`/dashboard/deals`) when their counts are > 0.

- [ ] **Step 1: Add state and fetch to `DualSidebar`**

In `components/layout/DualSidebar.tsx`, find the `DualSidebar` function declaration (line 110) and add state + fetch after the existing state/hooks:

```typescript
// After the existing useState/useSidebar hooks, add:
const [vendorsCount, setVendorsCount] = useState(0)
const [dealsCount, setDealsCount] = useState(0)

useEffect(() => {
  fetch("/api/action-counts")
    .then((r) => r.json())
    .then((d) => {
      setVendorsCount(d.vendorsCount ?? 0)
      setDealsCount(d.dealsCount ?? 0)
    })
    .catch(() => {
      /* silently ignore */
    })
}, [])
```

(The `useState` import is already present. `useEffect` needs to be added to the existing React import at line 7.)

- [ ] **Step 2: Add badges to nav item rendering**

In `components/layout/DualSidebar.tsx`, find the nav item `<Link>` block in the NAV2 section (around line 296). The current code looks like:

```tsx
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-[7px] rounded-lg
                      text-sm transition-all duration-100 mb-0.5 whitespace-nowrap
                      ${
                        active
                          ? "bg-[#FEF3C7] text-gray-900 font-semibold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        w-4 h-4 flex-shrink-0 transition-colors
                        ${active ? "text-[#D97706]" : "text-gray-400"}
                      `}
                    />
                    <span>{item.label}</span>
                  </Link>
```

Replace with:

```tsx
                  <Link
                    key={`${group.label}-${item.label}`}
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-[7px] rounded-lg
                      text-sm transition-all duration-100 mb-0.5 whitespace-nowrap
                      ${
                        active
                          ? "bg-[#FEF3C7] text-gray-900 font-semibold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        w-4 h-4 flex-shrink-0 transition-colors
                        ${active ? "text-[#D97706]" : "text-gray-400"}
                      `}
                    />
                    <span>{item.label}</span>
                    {(() => {
                      const count =
                        item.href === "/dashboard/vendors"
                          ? vendorsCount
                          : item.href === "/dashboard/deals"
                          ? dealsCount
                          : 0
                      return count > 0 ? (
                        <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                          {count}
                        </span>
                      ) : null
                    })()}
                  </Link>
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add components/layout/DualSidebar.tsx
git commit -m "feat: show action count badges on Vendors and Deals sidebar nav items"
```

---

## Chunk 2: Feature 2 — Investor Criteria Matcher

### Task 5: Create investor matching utility

**Files:**
- Create: `lib/deals/investor-matcher.ts`

Pure TypeScript function — no Prisma, no Next.js. Accepts plain objects and returns ranked match results. This separation makes the logic easy to reason about and test independently of the component.

**Matching criteria evaluated (only when the investor has the field configured):**
1. **Area** — deal postcode prefix (first segment e.g. `"SA1"` from `"SA1 5DT"`) is in `investor.preferredAreas` (case-insensitive prefix match)
2. **Budget** — both `minBudget` and `maxBudget` must be set; `deal.askingPrice` must be in range
3. **BMV** — `minBmv` set; `deal.bmvPercentage >= minBmv`
4. **Yield** — `minYield` set; `deal.grossYield >= minYield`
5. **Strategy** — `investor.strategy` non-empty; `deal.recommendedStrategy` maps to investor strategy: `"flip"` → `["Flip"]`, `"hold"` → `["BTL", "BRRRR"]`

**Score** = matched count / total configured criteria count.
Only investors with score > 0 are returned, sorted descending.

- [ ] **Step 1: Create the file**

```typescript
// lib/deals/investor-matcher.ts

export interface InvestorCriteria {
  id: string
  name: string
  preferredAreas: string[]
  minBudget: number | null
  maxBudget: number | null
  minYield: number | null
  minBmv: number | null
  strategy: string[]
}

export interface DealForMatching {
  postcode: string | null
  askingPrice: number
  bmvPercentage: number | null
  grossYield: number | null
  recommendedStrategy: string | null
}

export interface MatchResult {
  investorId: string
  name: string
  /** 0–1 */
  score: number
  matched: string[]
  /** e.g. "BTL/BRRRR · SA1, SA2 · £60k–£100k" */
  criteriaLine: string
}

function dealStrategies(recommendedStrategy: string | null): string[] {
  if (recommendedStrategy === "flip") return ["Flip"]
  if (recommendedStrategy === "hold") return ["BTL", "BRRRR"]
  return []
}

export function matchInvestors(
  investors: InvestorCriteria[],
  deal: DealForMatching
): MatchResult[] {
  const results: MatchResult[] = []

  for (const investor of investors) {
    const checks: Array<{ label: string; pass: boolean }> = []

    // 1. Area
    if (investor.preferredAreas.length > 0 && deal.postcode) {
      const prefix = deal.postcode.split(" ")[0].toUpperCase()
      const pass = investor.preferredAreas.some((a) =>
        prefix.startsWith(a.toUpperCase())
      )
      checks.push({ label: "area", pass })
    }

    // 2. Budget (both bounds required)
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const pass =
        deal.askingPrice >= investor.minBudget &&
        deal.askingPrice <= investor.maxBudget
      checks.push({ label: "budget", pass })
    }

    // 3. BMV
    if (investor.minBmv !== null && deal.bmvPercentage !== null) {
      checks.push({ label: "BMV", pass: deal.bmvPercentage >= investor.minBmv })
    }

    // 4. Yield
    if (investor.minYield !== null && deal.grossYield !== null) {
      checks.push({ label: "yield", pass: deal.grossYield >= investor.minYield })
    }

    // 5. Strategy (only checked when deal has a known strategy value)
    if (investor.strategy.length > 0 && deal.recommendedStrategy) {
      const ds = dealStrategies(deal.recommendedStrategy)
      // ds is empty when recommendedStrategy is an unknown value (e.g. "both", "pass")
      // — skip the criterion rather than always failing it
      if (ds.length > 0) {
        const pass = ds.some((s) => investor.strategy.includes(s))
        checks.push({ label: "strategy", pass })
      }
    }

    if (checks.length === 0) continue

    const matchedLabels = checks.filter((c) => c.pass).map((c) => c.label)
    const score = matchedLabels.length / checks.length
    if (score === 0) continue

    // Build one-line criteria summary
    const parts: string[] = []
    if (investor.strategy.length > 0) parts.push(investor.strategy.join("/"))
    if (investor.preferredAreas.length > 0)
      parts.push(investor.preferredAreas.join(", "))
    if (investor.minBudget !== null && investor.maxBudget !== null) {
      const min = (investor.minBudget / 1000).toFixed(0)
      const max = (investor.maxBudget / 1000).toFixed(0)
      parts.push(`£${min}k–£${max}k`)
    }

    results.push({
      investorId: investor.id,
      name: investor.name,
      score,
      matched: matchedLabels,
      criteriaLine: parts.join(" · "),
    })
  }

  return results.sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add lib/deals/investor-matcher.ts
git commit -m "feat: add investor matching utility function"
```

---

### Task 6: Create `MatchingInvestorsPanel` component

**Files:**
- Create: `components/deals/matching-investors-panel.tsx`

Server component (no `"use client"`). Queries all investors with at least one criterion set, runs the matching algorithm, and renders a ranked list with score bars and Reserve links.

The Reserve link points to `/dashboard/reservations?dealId={dealId}&investorId={investorId}` — the reservations page can use these query params to pre-fill the create modal.

- [ ] **Step 1: Create the file**

```tsx
// components/deals/matching-investors-panel.tsx
import { prisma } from "@/lib/db"
import { matchInvestors } from "@/lib/deals/investor-matcher"
import Link from "next/link"
import { Users } from "lucide-react"

interface Props {
  dealId: string
  postcode: string | null
  askingPrice: number
  bmvPercentage: number | null
  grossYield: number | null
  recommendedStrategy: string | null
}

export async function MatchingInvestorsPanel({
  dealId,
  postcode,
  askingPrice,
  bmvPercentage,
  grossYield,
  recommendedStrategy,
}: Props) {
  const investors = await prisma.investor.findMany({
    where: {
      OR: [
        { preferredAreas: { isEmpty: false } },
        { minBudget: { not: null } },
        { maxBudget: { not: null } },
        { minYield: { not: null } },
        { minBmv: { not: null } },
        { strategy: { isEmpty: false } },
      ],
    },
    select: {
      id: true,
      preferredAreas: true,
      minBudget: true,
      maxBudget: true,
      minYield: true,
      minBmv: true,
      strategy: true,
      user: { select: { firstName: true, lastName: true } },
    },
  })

  const normalised = investors.map((inv) => ({
    id: inv.id,
    name:
      [inv.user.firstName, inv.user.lastName].filter(Boolean).join(" ") || "—",
    preferredAreas: inv.preferredAreas,
    minBudget: inv.minBudget ?? null,
    maxBudget: inv.maxBudget ?? null,
    minYield: inv.minYield ? Number(inv.minYield) : null,
    minBmv: inv.minBmv ? Number(inv.minBmv) : null,
    strategy: inv.strategy,
  }))

  const matches = matchInvestors(normalised, {
    postcode,
    askingPrice,
    bmvPercentage,
    grossYield,
    recommendedStrategy,
  })

  return (
    <div className="ds-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Users className="h-4 w-4 text-[#2563EB]" />
          Matching Investors
        </h2>
        {matches.length > 0 && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
            {matches.length}
          </span>
        )}
      </div>
      <div className="p-5">
        {matches.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">
            No investors match this deal&apos;s criteria yet.
          </p>
        ) : (
          <div className="space-y-4">
            {matches.map((m) => {
              const pct = Math.round(m.score * 100)
              const barColor =
                pct >= 80
                  ? "bg-green-500"
                  : pct >= 50
                  ? "bg-amber-400"
                  : "bg-gray-300"
              const pctColor =
                pct >= 80
                  ? "text-green-600"
                  : pct >= 50
                  ? "text-amber-500"
                  : "text-gray-400"
              return (
                <div
                  key={m.investorId}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {m.name}
                    </p>
                    {m.criteriaLine && (
                      <p className="truncate text-xs text-gray-500">
                        {m.criteriaLine}
                      </p>
                    )}
                    <Link
                      href={`/dashboard/reservations?dealId=${dealId}&investorId=${m.investorId}`}
                      className="mt-1 inline-block text-xs font-semibold text-[#2563EB] hover:underline"
                    >
                      + Reserve
                    </Link>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <div className="h-1.5 w-10 rounded-full bg-gray-100">
                      <div
                        className={`h-1.5 rounded-full ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className={`w-8 text-right text-xs font-bold ${pctColor}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add components/deals/matching-investors-panel.tsx
git commit -m "feat: add MatchingInvestorsPanel server component"
```

---

### Task 7: Add `MatchingInvestorsPanel` to Deal detail page

**Files:**
- Modify: `app/dashboard/deals/[id]/page.tsx`

Add the import and insert `<MatchingInvestorsPanel>` between `<VendorSection>` and `<ReservationList>` in the sidebar (around line 838–841).

- [ ] **Step 1: Add the import**

In `app/dashboard/deals/[id]/page.tsx`, add to the existing imports:

```typescript
import { MatchingInvestorsPanel } from "@/components/deals/matching-investors-panel"
```

- [ ] **Step 2: Insert the panel into the sidebar**

Find this in `app/dashboard/deals/[id]/page.tsx` (around line 837–841):

```tsx
            {/* Vendor Information */}
            <VendorSection dealId={deal.id} vendorId={deal.vendor?.id} />

            {/* Investor Reservations */}
            <ReservationList
```

Replace with:

```tsx
            {/* Vendor Information */}
            <VendorSection dealId={deal.id} vendorId={deal.vendor?.id} />

            {/* Matching Investors */}
            <MatchingInvestorsPanel
              dealId={deal.id}
              postcode={deal.postcode ?? null}
              askingPrice={Number(deal.askingPrice)}
              bmvPercentage={deal.bmvPercentage ? Number(deal.bmvPercentage) : null}
              grossYield={deal.grossYield ? Number(deal.grossYield) : null}
              recommendedStrategy={deal.recommendedStrategy ?? null}
            />

            {/* Investor Reservations */}
            <ReservationList
```

- [ ] **Step 3: Verify TypeScript compiles with zero errors**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/deals/[id]/page.tsx
git commit -m "feat: add investor matcher panel to deal detail page sidebar"
```

---

## Final Verification

- [ ] **Run full TypeScript check**

Run: `cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit`
Expected: exit code 0, no output

- [ ] **Smoke-test in browser (optional but recommended)**
  1. Open `/dashboard` — amber strip should appear if any deals are `in_progress` with no active reservation, or vendors at `READY_FOR_INVESTORS`
  2. Navigate to another page (e.g. Statistics) — Vendors/Deals sidebar badges should appear if counts > 0
  3. Open any deal at `/dashboard/deals/{id}` — "Matching Investors" panel should appear in sidebar between Vendor section and Reservations

---

## Summary of New Files

| File | Type | Purpose |
|---|---|---|
| `app/api/action-counts/route.ts` | API route | Returns deal + vendor alert counts and items |
| `components/dashboard/action-required-strip.tsx` | Client component | Amber alert strip for dashboard |
| `lib/deals/investor-matcher.ts` | Utility | Pure match scoring function |
| `components/deals/matching-investors-panel.tsx` | Server component | Ranked investor match panel |

## Modified Files

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Add `<ActionRequiredStrip />` |
| `components/layout/DualSidebar.tsx` | Fetch counts + render badges on Vendors/Deals nav items |
| `app/dashboard/deals/[id]/page.tsx` | Add `<MatchingInvestorsPanel />` to sidebar |
