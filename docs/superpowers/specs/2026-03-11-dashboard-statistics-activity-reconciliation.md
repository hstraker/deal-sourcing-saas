# Dashboard, Statistics & Activity Reconciliation Design

**Goal:** Eliminate content duplication across the three pages, give each a clear role, and add a date-range filter so test/development data can be excluded from metrics without deleting anything.

**Date:** 2026-03-11

---

## Problem Summary

| Page | Issue |
|------|-------|
| Dashboard | `DashboardAnalytics` block duplicates the two pipeline cards already above it (same API, same data). Its "Investor Pipeline" tab is a weaker duplicate of the Statistics page. |
| Statistics | Investor-only despite being called "Statistics". Vendor conversion analytics are missing. Contains a "Recent Activity" section that doesn't belong in an analytics page. Raw `<h1>` instead of `PageHeader`. |
| Activity | Vendor-only pipeline events. Investor activity is buried in Statistics. Raw `<h1>` instead of `PageHeader`. |

---

## Proposed Page Roles

| Page | Role | One-liner |
|------|------|-----------|
| Dashboard | Operational snapshot | What is in the pipeline right now |
| Statistics | Deep analytics | How well is everything performing |
| Activity | Chronological event feed | What has happened recently |

---

## Date Range Filter

A "Metrics from" date filter is added to Dashboard and Statistics. It filters all counts, rates, and analytics to data created on or after the selected date. Useful during development (ignore test data) and in production ("show last 30 days").

### How it works

- A `MetricsDateFilter` client component renders a small pill: `Metrics from: 11 Mar 2026 · [Reset to all time]`
- The selected date is persisted in **localStorage** under the key `ds_metrics_from_date`
- When set, all analytics fetches pass `?from=YYYY-MM-DD` as a query param
- When cleared ("All time"), the param is omitted and all historical data is included
- The Activity page is **not** date-filtered — it always shows the most recent events chronologically

### Hydration strategy

`MetricsDateFilter` uses `useState(null)` initially and reads localStorage in `useEffect`. On the first render (before `useEffect` fires), the filter shows a neutral "Loading..." placeholder — no hydration mismatch because the server never knows the localStorage value. The KPI strip and analytics panels show a loading spinner until the `useEffect` completes (typically <1 frame).

```tsx
// components/ui/metrics-date-filter.tsx
"use client"
export function MetricsDateFilter({ onChange }: { onChange: (from: string | null) => void }) {
  const [from, setFrom] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem("ds_metrics_from_date")
    setFrom(stored)
    setMounted(true)
    onChange(stored)
  }, [])

  const handleSet = (date: string) => {
    localStorage.setItem("ds_metrics_from_date", date)
    setFrom(date)
    onChange(date)
  }
  const handleClear = () => {
    localStorage.removeItem("ds_metrics_from_date")
    setFrom(null)
    onChange(null)
  }

  if (!mounted) return <div className="h-8 w-48 animate-pulse bg-gray-100 rounded-md" />
  // ... render pill with date input and "Reset to all time" button
}
```

### `from` param validation (shared pattern across all routes)

All three routes use the same helper — add to `lib/utils.ts` (or inline):

```ts
function parseFromDate(searchParams: URLSearchParams): Date | undefined {
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}
```

Invalid `from` values silently fall back to `undefined` (show all data). All dates are treated as UTC.

### `from` param applied in Prisma where clauses

```ts
// Pattern used identically in all three routes:
const fromDate = parseFromDate(new URL(request.url).searchParams)
// Apply to each count/query:
where: { ...(fromDate && { createdAt: { gte: fromDate } }) }
```

### Statistics page — single shared filter for both tabs

One `MetricsDateFilter` at the top of the Statistics page (above the tabs). Its `from` value is held in parent state and passed down as a prop to both `VendorAnalyticsPanel` and `InvestorManagementDashboard`. When the date changes, both tabs refetch with the new `from` value. No independent filter per tab.

### Component location

`components/ui/metrics-date-filter.tsx` — shared between Dashboard (`DashboardKpiStrip`) and Statistics page.

---

## Dashboard Page Changes

### Remove

- `DashboardAnalytics` component — entirely removed from the page.
  - Its vendor tab duplicates `VendorPipelineCard` and `TimeInStagesCard` already above it.
  - Its investor tab is superseded by the Statistics page.
  - After removal, Dashboard has **no investor pipeline view** — this is intentional. The KPI strip still shows total Reservations as a count. Investors who want pipeline analytics go to Statistics.

### Add: Recent Activity mini-feed

- Last 5 `PipelineEvent` records, server-fetched inline in `page.tsx` (simple Prisma query, no new API route needed)
- Renders as a compact timeline list using the same dot + event title + vendor name + time style as the Activity page
- "View all activity →" link to `/dashboard/vendors/activity`
- No date filtering on this feed (always shows latest 5 events)

### Add: DashboardKpiStrip client component

Dashboard KPIs are currently computed inline in the server component. They are extracted to a new client component `DashboardKpiStrip` that:

1. Reads `ds_metrics_from_date` from localStorage on mount (via `MetricsDateFilter` callback)
2. Fetches `GET /api/analytics/kpis?from=YYYY-MM-DD` with the stored date
3. Renders the four KPI cards with the `MetricsDateFilter` pill inline

The `DashboardKpiStrip` is placed where the old KPI strip was. The server component no longer runs the 9 Prisma queries for KPIs.

### New API endpoint: `GET /api/analytics/kpis`

File: `app/api/analytics/kpis/route.ts`

Query params:
- `from` (optional ISO date string) — if provided, all counts use `createdAt >= fromDate`; invalid values silently ignored

Response shape:
```json
{
  "totalDeals": 3,
  "dealsRecent": 2,
  "totalVendors": 7,
  "vendorsWithOffers": 4,
  "vendorsAccepted": 1,
  "totalReservations": 2,
  "reservationsWithProof": 1,
  "vendorConversionRate": "14.3"
}
```

- `dealsRecent` — count of deals created since `fromDate` (or since start of current month if no `from`). The UI label shows `+N this month` when no filter is set, or `+N since [date]` when a filter is active.
- `totalDeals`, `totalVendors`, etc. — always filtered by `fromDate` when set (i.e., counts of records created after `from`)
- `vendorConversionRate` — `(vendorsAccepted / totalVendors * 100).toFixed(1)`, computed server-side

Auth: `getServerSession(authOptions)` — returns 401 if not authenticated.

---

## Statistics Page Changes

### Structure: two tabs

The page gains a client-side `Tabs` wrapper with:

- **Vendor Pipeline** — vendor conversion rates + time in stages
- **Investor Pipeline** — investor/reservation stats (existing `InvestorManagementDashboard` content)

Both tabs receive the same `from` value from the page-level `MetricsDateFilter`.

#### Vendor Pipeline tab — `VendorAnalyticsPanel`

New component: `components/dashboard/vendor-analytics-panel.tsx`

Content extracted from `DashboardAnalytics` vendor tab:
- Vendor Pipeline Overview (by stage counts)
- Conversion Rates (Contacted→Validated→Offer→Accepted→Locked Out + overall)
- Time in Stages (avg days per stage, avg offers per deal, avg negotiation time)

Props:
```ts
interface VendorAnalyticsPanelProps {
  from?: string  // ISO date string passed from Statistics page
}
```

Fetch: `GET /api/analytics/workflow?from=` (passing `from` prop as query param).

#### Investor Pipeline tab — `InvestorManagementDashboard`

Two changes to the existing component:
1. **Remove section 7** ("Recent Activity", lines ~329–356) — the `recentActivities` data moves to the Activity page
2. **Accept `from?: string` prop** and append `?from=` to its `/api/investors/stats` fetch

Updated prop signature:
```ts
interface InvestorManagementDashboardProps {
  from?: string
}
```

#### Statistics page server component → client component

Because the page now needs to hold `from` state and pass it to child components, `statistics/page.tsx` becomes a `"use client"` component (or the tabs/filter logic lives in a new `StatisticsClient` client component rendered from the server page).

Simplest approach: keep `page.tsx` as a server component (for auth redirect) but render a `<StatisticsClient />` client component that owns the tab + filter state.

### Remove `recentActivities` from `/api/investors/stats`

Since `InvestorManagementDashboard` no longer renders the activity section, the `recentActivities` field is removed from the `/api/investors/stats` Prisma query and response. This cleans up bandwidth (previously fetched 10 activity records on every stats load unnecessarily).

### Add: PageHeader

Replace raw `<h1>Statistics</h1>` with:
```tsx
<PageHeader
  title="Statistics"
  subtitle="Vendor & investor performance analytics"
/>
```

---

## Activity Page Changes

### Add: Investor Activity section

A new section below the existing vendor pipeline events feed.

Fetch: `GET /api/investors/activity` (new lightweight endpoint).

Display as a flat card list (matching the existing event list style):
- Investor name, activity description, timestamp
- Color dot: green for positive events (reservation completed, POF verified), red for cancellations, blue for everything else

### New API endpoint: `GET /api/investors/activity`

File: `app/api/investors/activity/route.ts`

No query params (not date-filtered — Activity page always shows latest events).

Response shape:
```json
{
  "activities": [
    {
      "id": "string",
      "activityType": "string",
      "description": "string | null",
      "createdAt": "ISO string",
      "investor": {
        "id": "string",
        "firstName": "string | null",
        "lastName": "string | null",
        "email": "string"
      }
    }
  ]
}
```

Query: last 50 `InvestorActivity` records ordered by `createdAt desc`, with investor → user join for name/email. Auth: `getServerSession(authOptions)`.

The `InvestorActivity` model already exists (used by `/api/investors/stats` for `recentActivities`). This new endpoint is a lightweight alternative that returns up to 50 records (vs the 10 in stats).

### Add: PageHeader

Replace raw `<h1>Activity</h1>` with:
```tsx
<PageHeader
  title="Activity"
  subtitle="Recent pipeline events across all vendors and investors"
/>
```

---

## Files Modified / Created

| Action | Path |
|--------|------|
| Create | `app/api/analytics/kpis/route.ts` |
| Modify | `app/api/analytics/workflow/route.ts` — add `from` param |
| Modify | `app/api/investors/stats/route.ts` — add `from` param, remove `recentActivities` |
| Create | `app/api/investors/activity/route.ts` |
| Create | `components/ui/metrics-date-filter.tsx` |
| Create | `components/dashboard/dashboard-kpi-strip.tsx` |
| Create | `components/dashboard/vendor-analytics-panel.tsx` |
| Create | `app/dashboard/statistics/statistics-client.tsx` — client wrapper for tabs + filter state |
| Modify | `components/settings/investor-management-dashboard.tsx` — remove recent activity section, accept `from` prop |
| Modify | `app/dashboard/page.tsx` — remove DashboardAnalytics, add mini activity feed, use DashboardKpiStrip |
| Modify | `app/dashboard/statistics/page.tsx` — render StatisticsClient, add PageHeader |
| Modify | `app/dashboard/vendors/activity/page.tsx` — add investor activity section, PageHeader |

---

## Verification Checklist

### Dashboard
- [ ] KPI strip is now `DashboardKpiStrip` client component — no KPI Prisma queries in server component
- [ ] `MetricsDateFilter` renders in KPI area; selecting a date re-fetches KPIs with `?from=`
- [ ] "Reset to all time" clears localStorage and shows unfiltered counts
- [ ] Subtext on Total Deals card shows "+N this month" (no filter) or "+N since [date]" (filter active)
- [ ] Recent Activity mini-feed shows last 5 events with "View all activity →" link
- [ ] `DashboardAnalytics` is entirely gone — no vendor/investor tabs below the cards
- [ ] `VendorPipelineCard` and `TimeInStagesCard` render unchanged

### Statistics
- [ ] `PageHeader` renders with title "Statistics" and subtitle
- [ ] "Vendor Pipeline" tab shows pipeline stage counts, conversion rates, and time-in-stages
- [ ] "Investor Pipeline" tab shows all existing investor content except "Recent Activity" section
- [ ] `MetricsDateFilter` at top of page (above tabs); `from` passed to both tab components
- [ ] Changing date re-fetches both vendor analytics and investor stats with new `from`
- [ ] No "Recent Activity" section anywhere on Statistics page

### Activity
- [ ] `PageHeader` renders with title "Activity" and updated subtitle
- [ ] Existing vendor pipeline events unchanged (still last 100, timeline style)
- [ ] New "Investor Activity" section below with last 50 investor activity records
- [ ] Investor activity shows name, description, timestamp, and colour dot

### Date filter
- [ ] Setting a date filters Dashboard KPIs (counts drop to exclude pre-filter data)
- [ ] Setting a date filters Statistics vendor analytics
- [ ] Setting a date filters Statistics investor analytics
- [ ] Clearing to "All time" restores unfiltered data on both pages
- [ ] Filter value persists across page navigation (localStorage `ds_metrics_from_date`)
- [ ] Invalid `from` value (e.g., corrupted localStorage) falls back gracefully to all-time

### API
- [ ] `GET /api/analytics/kpis?from=2026-03-11` returns counts filtered to that date
- [ ] `GET /api/analytics/workflow?from=2026-03-11` returns analytics filtered to that date
- [ ] `GET /api/investors/stats?from=2026-03-11` returns stats filtered to that date (no `recentActivities` field)
- [ ] `GET /api/investors/activity` returns last 50 investor activity records
- [ ] Invalid `from` param (e.g., `from=not-a-date`) returns unfiltered data (no 400 error)
