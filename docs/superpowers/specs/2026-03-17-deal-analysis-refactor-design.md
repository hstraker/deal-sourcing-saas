# Deal Analysis Page Refactor — Design Spec

## Goal

Refactor the Deal Analysis page to match the clean Lendlord-style table pattern used across the app, surface investor-relevant metrics inline, and replace the existing navigation-based "View" with a rich two-panel investor decision modal.

## Architecture

The refactor touches two surfaces: the list page (`app/dashboard/deals/page.tsx` + `components/deals/deal-list.tsx`) and a new modal component (`components/deals/deal-detail-modal.tsx`). The existing three view modes (cards / list / table) are replaced by a single clean table. The modal adds a new exit strategy summary, financial waterfall, and mortgage scenarios, and reuses the existing `OfferAnalysisPanel` for detailed offer analysis.

## Tech Stack

Next.js 14 App Router, TypeScript, Tailwind CSS, shadcn/ui, Lucide React icons, Radix UI Tooltip.

---

## Section 1: List Page

### KPI Bar

A sticky bar at the top of the list (above the table, below the page header) showing five summary stats computed from the currently-loaded deals array (client-side, no extra API call):

| Stat | Calculation |
|---|---|
| Active Deals | count where `status` is NOT `archived` or `sold` |
| Avg BMV % | mean of non-null `bmvPercentage` values; shows "—" if all null |
| Avg Gross Yield | mean of non-null `grossYield` values; shows "—" if all null |
| Total Pipeline Value | sum of non-null `marketValue` values |
| Avg Deal Score | mean of non-null `dealScore` values; shows "—" if all null |

KPI tiles are read-only, styled identically to the vendor leads KPI bar.

### Table

Single flat table replacing the three existing view modes. The existing search, filter, sort, and pagination controls are retained. The view-mode toggle is removed.

**Correct field names from the `Deal` Prisma model:**

| # | Column | Field | Notes |
|---|---|---|---|
| 1 | Address | `address` + `postcode` | Two-line cell (`address` is the primary field; `postcode` is a separate nullable field) |
| 2 | Status | `status` | Colour-coded badge using `DealStatus` enum values: `new`, `review`, `in_progress`, `ready`, `listed`, `reserved`, `sold`, `archived` |
| 3 | Type | `propertyType` | Badge |
| 4 | Asking Price | `askingPrice` | Currency (Decimal) |
| 5 | Market Value | `marketValue` | Currency (Decimal, nullable) — show "—" if null |
| 6 | BMV % | `bmvPercentage` | Green ≥15%, amber 5–14.9%, red <5%; show "—" if null |
| 7 | Gross Yield | `grossYield` | Green ≥6%, amber 4–5.9%, red <4%; show "—" if null |
| 8 | Deal Score | `dealScore` | Coloured chip: green 80–100, amber 60–79, blue 40–59, red 0–39; show "—" if null |
| 9 | Assigned | `assignedTo` (relation) | First name + last initial, or "—" |
| 10 | Actions | — | "View" button → opens deal detail modal |

The "New Deal" button and all filter controls remain unchanged.

---

## Section 2: Deal Detail Modal

Triggered by the View button on any table row. Full-screen overlay (`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm`) with a two-panel layout side-by-side.

### Close Button

A single `X` (XIcon / `×`) button fixed at the **top-right corner of the entire overlay** (`absolute top-4 right-4`), not inside the left panel.

### Left Panel (sticky, ~260px wide, full-height)

Always visible while the right panel scrolls. Contains top-to-bottom:

1. **Property header**
   - `address` (bold)
   - `postcode` (muted, if present)
   - `propertyType` badge (if present)
   - `status` colour-coded badge

2. **Deal score ring**
   Large circular SVG ring (~96px diameter) with the score number in the centre. Ring colour by score band:
   - null: grey ring, label "NOT SCORED"
   - 0–39: red (`#ef4444`), label "POOR DEAL"
   - 40–59: amber (`#f59e0b`), label "AVERAGE"
   - 60–79: blue (`#6eb5ff`), label "GOOD DEAL"
   - 80–100: green (`#22c55e`), label "GREAT DEAL"

3. **Key metrics list** — label / value rows with colour-coded values (same thresholds as table columns):
   - BMV %  (`bmvPercentage`)
   - Asking Price  (`askingPrice`)
   - Market Value  (`marketValue`)
   - Gross Yield  (`grossYield`)
   - Net Yield  (`netYield`)
   - ROI  (`roi`)
   - ROCE  (`roce`)

4. **Property details**
   - Bedrooms (`bedrooms`, if present)
   - Bathrooms (`bathrooms`, if present)
   - *(No EPC field — not present on the Deal model)*

### Right Panel (scrollable, flex-1)

Four sections rendered top-to-bottom, each collapsible (open by default).

---

#### Section A: Exit Strategy Summary

Three side-by-side summary cards — **BTL**, **Flip**, **BRRR**.

The **RECOMMENDED** badge is determined by `deal.recommendedStrategy` (already stored by the offer engine). Mapping:
- `'hold'` or `'btl'` → badge on BTL card
- `'flip'` → badge on Flip card
- `'brrrr'` or `'brrr'` → badge on BRRR card
- null, empty string, or any unrecognised value → no badge shown on any card; non-matching cards display at full opacity (no dimming)

Each card is a compact cost-to-return waterfall derived entirely from existing Deal fields. If a required input is null, that line shows "—" and a hint at the bottom of the card reads "Run deal analysis to populate".

**BTL card** — fields used: `askingPrice`, `estimatedRefurbCost`, `marketValue`, `estimatedMonthlyRent`, `grossYield`, `netYield`:
- Purchase Price (`askingPrice`)
- Refurbishment (`estimatedRefurbCost` or "—")
- Monthly Rent (`estimatedMonthlyRent` or "—")
- **Monthly Cash Flow** (highlighted) — `estimatedMonthlyRent − (marketValue × 0.75 × 0.055 / 12)`; show "—" if either input null. Label this line "(est. 75% LTV, 5.5% IO, excl. mgmt fees)" in muted text below the value.
- Net Yield (`netYield` or "—")

**Flip card** — fields used: `askingPrice`, `estimatedRefurbCost`, `marketValue`:
- Purchase Price (`askingPrice`)
- Refurbishment (`estimatedRefurbCost` or "—")
- Sale Price/GDV (`marketValue` or "—")
- **Gross Profit** (highlighted) — `marketValue − askingPrice − estimatedRefurbCost`; show "—" if any input null

**BRRR card** — fields used: `askingPrice`, `estimatedRefurbCost`, `afterRefurbValue`, `estimatedMonthlyRent`:
- Buy + Refurb (`askingPrice + estimatedRefurbCost` or "—")
- ARV (`afterRefurbValue` or "—")  ← uses `afterRefurbValue`, not `marketValue`
- Refinance at 75% (`afterRefurbValue × 0.75` or "—")
- **Cash Left In** (highlighted) — `(askingPrice + estimatedRefurbCost) − (afterRefurbValue × 0.75)`; target £0; show "—" if any input null. If result is positive (i.e., refinance doesn't fully recycle capital), display in amber with label "Capital remaining". If result is negative (over-refinanced), display in green with label "Equity released".
- Post-Refi Yield — `(estimatedMonthlyRent × 12) / afterRefurbValue × 100`; show "—" if null

---

#### Section B: Financial Waterfall

A vertical stacked breakdown. Each line is a label + value. Values from Deal fields:

```
Purchase Price           askingPrice
+ Refurbishment          estimatedRefurbCost
+ Stamp Duty             calculated client-side: 3% on residential investment purchase
                         (simplified SDLT: 3% surcharge on full price for <£500k;
                          this is an estimate, not a legal calculation)
+ Legal / Survey Fees    fixed estimate: £2,500 (displayed with "(estimate)" label)
──────────────────────────────────────────
= Total Cost In          sum of above
vs Market Value (GDV)    marketValue
= Gross Equity / Profit  marketValue − Total Cost In
```

If `marketValue` is null: show "Market value required — run deal analysis first" in place of the waterfall.
If `estimatedRefurbCost` is null: use £0 and display "(no refurb entered)" label.

---

#### Section C: Mortgage Scenarios

Three columns: **65% LTV** / **70% LTV** / **75% LTV**.

This logic is new (not reused from elsewhere). For each LTV percentage, calculate using:
- Loan amount = `marketValue × ltv`
- Monthly payment = `loanAmount × (0.055 / 12)` (5.5% annual BTL rate, interest-only)
- Monthly cash flow = `estimatedMonthlyRent − monthlyPayment`
- Net yield = `(estimatedMonthlyRent × 12 − monthlyPayment × 12) / (marketValue × (1 − ltv)) × 100`

Rate note: "Based on 5.5% BTL rate (interest-only). Rates vary." shown as a subtitle.

If `marketValue` is null: show "Market value required" placeholder.
If `estimatedMonthlyRent` is null: cash flow and net yield rows show "—".

---

#### Section D: Offer Analysis

Renders the existing `OfferAnalysisPanel` component. The component internally calls `/api/deals/${dealId}/calculate-offer` when `dealId` is provided, using cached server-side results. `vendorName`, `vendorEmail`, and `vendorPhone` are not applicable for deals — passed as `undefined`. The panel handles these gracefully (vendor contact section is not rendered).

`missingInputsHint` is passed only when `marketValue` is null (the minimum required for offer calculation). Other missing optional fields (`estimatedRent`, `totalRefurbishment`) are handled gracefully by the panel itself with partial results.

```tsx
<OfferAnalysisPanel
  dealId={deal.id}                                    // triggers server-side cache path
  askingPrice={Number(deal.askingPrice)}
  gdv={deal.marketValue ? Number(deal.marketValue) : undefined}
  estimatedRent={deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : undefined}
  totalRefurbishment={deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : undefined}
  vendorName={undefined}
  vendorEmail={undefined}
  vendorPhone={undefined}
  missingInputsHint={
    !deal.marketValue ? "Market value required to generate offer analysis" : undefined
  }
/>
```

This section provides the full negotiation ladder and detailed strategy breakdown already built into `OfferAnalysisPanel`.

---

#### Comparable Sales — Out of Scope for this refactor

`VendorComparablesTab` is coupled to `vendorLeadId` and the `/api/vendor-leads/[id]/comparables` route. The Deal model has no equivalent comparables API. Adding a comparables section for deals requires a new API route and either a new generic component or a refactor of `VendorComparablesTab` — this is deferred to a separate task. The modal will not include a comparables section in this refactor.

---

## Section 3: Data Mapping

No schema changes required. Complete mapping of Deal model fields used:

| Purpose | Prisma field | TypeScript type |
|---|---|---|
| Address | `address` | `string` |
| Postcode | `postcode` | `string \| null` |
| Property type | `propertyType` | `string \| null` |
| Bedrooms / bathrooms | `bedrooms`, `bathrooms` | `number \| null` |
| Asking price | `askingPrice` | `Decimal` |
| Market value / GDV | `marketValue` | `Decimal \| null` |
| After-refurb value (ARV) | `afterRefurbValue` | `Decimal \| null` |
| Refurb cost | `estimatedRefurbCost` | `Decimal \| null` |
| Monthly rent | `estimatedMonthlyRent` | `Decimal \| null` |
| BMV % | `bmvPercentage` | `Decimal \| null` |
| Gross / net yield | `grossYield`, `netYield` | `Decimal \| null` |
| ROI / ROCE | `roi`, `roce` | `Decimal \| null` |
| Deal score | `dealScore` | `number \| null` |
| Deal score breakdown | `dealScoreBreakdown` | `Json \| null` |
| Recommended strategy | `recommendedStrategy` | `string \| null` |
| Status | `status` | `DealStatus` enum |
| Assigned to | `assignedTo` (relation) | `User \| null` |
| Deal ID | `id` | `string` |

---

## Section 4: Component Structure

```
components/deals/
  deal-list.tsx           — MODIFY: remove view-toggle + card/list-view code; add KPI bar; add modal state
  deal-detail-modal.tsx   — CREATE: full two-panel investor modal shell + left panel + right panel sections
  deal-score-ring.tsx     — CREATE: circular SVG ring, props: score (number|null), size (number)
```

Exit strategy cards, financial waterfall, and mortgage scenarios are implemented as inline subcomponents within `deal-detail-modal.tsx` (not separate files) since they are only used in one place.

`DealList` becomes leaner: remove ~400 lines of card/list view code and view-mode toggle state. Retain: filters, search, sort, pagination, table view.

---

## Section 5: Error Handling & Empty States

| Situation | Behaviour |
|---|---|
| `marketValue` is null | Exit strategy summary, financial waterfall, mortgage scenarios all show inline message: "Market value required — run deal analysis first" |
| `estimatedRefurbCost` is null | BTL/Flip/BRRR card lines show "—"; financial waterfall uses £0 with "(no refurb entered)" label |
| `estimatedMonthlyRent` is null | BTL cash flow, BRRR post-refi yield, mortgage cash flow rows show "—" |
| `afterRefurbValue` is null | BRRR card shows "—" for ARV, refinance, cash left in, post-refi yield |
| `dealScore` is null | Ring renders as full grey circle; label "NOT SCORED" |
| `recommendedStrategy` is null | No RECOMMENDED badge on any exit strategy card |
| No deals in list | Retain existing empty state |
| KPI bar — all values null for a stat | Tile shows "—" |

---

## Out of Scope

- Comparable sales section in modal (requires new API route — deferred)
- PDF export / print view (future)
- Editing deal fields from within the modal (use existing deal edit page)
- HMO / multi-let exit strategy variant (future)
- Customisable BTL rate (future — settings page)
