# Pipeline Action Alerts + Investor Criteria Matcher — Design Spec

**Date:** 2026-03-11
**Status:** Approved

---

## Overview

Two features that close workflow gaps between vendor leads and investor assignment:

1. **Pipeline Action Alerts** — surface deals and vendor leads that need action, visible from every page (sidebar badges) and prominently on the Dashboard (amber strip).
2. **Investor Criteria Matcher** — show ranked investor matches on the Deal detail page so the user can immediately see who to reserve for a deal.

---

## Feature 1: Pipeline Action Alerts

### Alert Triggers

| Condition | Alert label | Action button | Destination |
|---|---|---|---|
| `VendorLead.stage = 'READY_FOR_INVESTORS'` | "Vendor {name} — ready for investor" | Match → | `/dashboard/vendors/{id}` |
| `Deal.status = 'in_progress'` with no active reservation | "Deal {address} — in progress, no investor" | Review → | `/dashboard/deals/{id}` |

An "active reservation" means a `InvestorReservation` linked to the deal that is not cancelled.

### New API Endpoint

`GET /api/action-counts`

Auth: `getServerSession(authOptions)` — 401 if unauthenticated.

Response shape:
```json
{
  "dealsCount": 1,
  "vendorsCount": 2,
  "items": [
    { "type": "deal", "id": "...", "label": "14 Park Road, SA1 5DT", "href": "/dashboard/deals/...", "action": "Review" },
    { "type": "vendor", "id": "...", "label": "John Smith", "href": "/dashboard/vendors/...", "action": "Match" }
  ]
}
```

No new DB table — pure Prisma queries on `Deal` and `VendorLead`.

### Dashboard Strip

New client component: `components/dashboard/action-required-strip.tsx`

- `"use client"`. Fetches `/api/action-counts` on mount via `useEffect`.
- Renders nothing if count is 0 or still loading.
- Renders amber banner (`bg-amber-50 border-amber-300`) with "⚡ N actions required" heading when count > 0.
- Each item row: label on left, action button on right (links to `href`).
- Added to `app/dashboard/page.tsx` immediately above `<DashboardKpiStrip />`.

### Sidebar Badges

`components/dashboard/sidebar.tsx` (already a client component) fetches `/api/action-counts` in a `useEffect` on mount.

- Adds a small red `Badge` next to the "Deals" nav item showing `dealsCount` (hidden if 0).
- Adds a small red `Badge` next to the "Vendors" nav item showing `vendorsCount` (hidden if 0).
- Re-fetches are not required (counts refresh on page navigation since the sidebar re-mounts).

---

## Feature 2: Investor Criteria Matcher

### Match Algorithm

Computed server-side in the Deal detail page (`app/dashboard/deals/[id]/page.tsx`).

Fetch all investors who have at least one criteria field set (`preferredAreas`, `minBudget`, `maxBudget`, `minBmv`, `minYield`, or `strategy`).

For each investor, evaluate up to 5 criteria **only if the investor has configured that criterion**:

| Criterion | Investor field | Deal field | Match condition |
|---|---|---|---|
| Area | `preferredAreas: String[]` | `postcode` | postcode starts with any entry in preferredAreas (case-insensitive) |
| Budget | `minBudget`, `maxBudget` | `askingPrice` | `minBudget <= askingPrice <= maxBudget` (only if both set) |
| BMV | `minBmv: Decimal` | `bmvPercentage` | `deal.bmvPercentage >= investor.minBmv` |
| Yield | `minYield: Decimal` | `grossYield` | `deal.grossYield >= investor.minYield` |
| Strategy | `strategy: String[]` | `strategy` | deal strategy is in investor's strategy array |

**Score** = `matched criteria count / total configured criteria count`

Only investors with score > 0 are shown (at least one criterion matches). Sorted descending by score.

### Panel UI

New server component: `components/deals/matching-investors-panel.tsx`

Props: `dealId: string, deal: { postcode, askingPrice, bmvPercentage, grossYield, strategy }`

- Title: "Matching Investors" with a badge showing match count.
- If no matches: brief empty state — "No investors match this deal's criteria yet."
- For each matched investor (score > 0):
  - Investor name (from `user.firstName + lastName`)
  - One-line criteria summary (e.g. "BTL · SA1–SA6 · £60k–£120k")
  - Score bar — green if ≥ 80%, amber if ≥ 50%, gray otherwise
  - Score percentage label
  - "Reserve" link → `/dashboard/reservations?dealId={dealId}&investorId={investorId}`

### Panel Placement

In `app/dashboard/deals/[id]/page.tsx`, the sidebar (`<div className="space-y-6">`). Placed **between `<VendorSection>` and `<ReservationList>`**.

```tsx
<VendorSection ... />
<MatchingInvestorsPanel dealId={deal.id} deal={deal} />  {/* NEW */}
<ReservationList ... />
```

---

## Files Changed

| File | Change |
|---|---|
| `app/api/action-counts/route.ts` | NEW — returns deal/vendor action counts + items |
| `components/dashboard/action-required-strip.tsx` | NEW — amber dashboard alert strip |
| `components/deals/matching-investors-panel.tsx` | NEW — ranked investor match panel |
| `app/dashboard/page.tsx` | Add `<ActionRequiredStrip />` |
| `app/dashboard/deals/[id]/page.tsx` | Add `<MatchingInvestorsPanel />` to sidebar |
| `components/dashboard/sidebar.tsx` | Fetch action counts, add badges to Deals/Vendors nav |

---

## Out of Scope

- Email or SMS notifications (in-app only)
- Persisting or dismissing alerts (always computed live)
- Polling / real-time updates (fetch on mount only)
- The "Reserve" button pre-filling the reservation modal (links to reservations page with query params; pre-fill is a future enhancement)
