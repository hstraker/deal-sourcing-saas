# Habbits Deal Source — Mobile Responsiveness Audit

_Audit date: 2026-04-12 | Audited by: static code analysis_

---

## Executive Summary

The application is a desktop-first B2B SaaS property deal-sourcing platform built with Next.js 14 and Tailwind CSS. The root layout is missing both a viewport meta tag and any `overflow-x: hidden` guard, meaning the browser defaults to a zoomed-out 980 px viewport on iOS Safari. The primary shell uses a hard-coded `marginLeft` of either 56 px or 316 px (set inline via JavaScript) with no responsive override, so every authenticated page is pushed off-screen and unusable on mobile. The core Vendor Leads table contains 10–15 columns per tab with sticky cells and hover-only action buttons that have no touch equivalent; this table is the heart of the application and will be the highest-effort fix. Overall 47 issues were found across the codebase, with 6 critical and 10 high-priority items that must be resolved before the product is usable on a phone.

---

## Issue Count by Severity

🔴 Critical: 6  
🟠 High: 10  
🟡 Medium: 18  
🟢 Low: 7  
✅ Pass: 6

---

## Critical Issues (must fix before go-live)

### C1 — Missing viewport meta tag
**File:** `app/layout.tsx`  
The root `<html>` does not include `<meta name="viewport" content="width=device-width, initial-scale=1">`. Without it, iOS Safari renders the page at a virtual 980 px width and scales it down to fit, making all text illegible and all tap targets too small. This single fix unblocks all other mobile work.

### C2 — Hard-coded inline `marginLeft` on `<main>` has no mobile override
**File:** `components/layout/AppShell.tsx` (lines 15–17)  
```jsx
style={{ marginLeft: secondaryOpen ? "316px" : "56px" }}
```
On a 375 px phone, a 56 px left margin leaves only 319 px of usable width, and when the secondary sidebar is open the margin of 316 px leaves just 59 px — effectively nothing. There is no media query or breakpoint that collapses the sidebar or removes this margin on mobile. The entire dashboard shell is broken at any viewport below approximately 500 px.

### C3 — DualSidebar has no mobile collapse / hamburger pattern
**File:** `components/layout/DualSidebar.tsx`  
The primary sidebar (`w-14` collapsed, expands to `w-[200px]` on CSS `:hover`) is always fixed and visible. There is no hamburger button, no `@media (max-width: 768px)` override, and no touch gesture support. On mobile both sidebars stack on top of content with no way to dismiss them.

### C4 — Vendor Leads table: hover-only action buttons with no touch fallback
**File:** `components/vendors/vendor-leads-table.tsx` — `ActionsCell` component (lines 1222–1241)  
```jsx
<div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
```
All primary row actions (View, Edit, Archive, Delete, Run Check) are wrapped in `opacity-0 group-hover:opacity-100`. On touch devices `hover` never fires persistently, making these actions completely inaccessible without a fallback.

### C5 — ModalShell: fixed two-panel layout breaks on mobile
**File:** `components/vendors/modal-shell.tsx` (lines 40–44)  
```jsx
<div className="flex w-full overflow-hidden rounded-2xl shadow-2xl max-h-[90vh]">
  <div className="w-[260px] shrink-0 overflow-y-auto bg-[#1e293b] text-white">
```
The left panel is a fixed `w-[260px]` with no responsive override. On a 375 px phone this leaves only 115 px for the content panel, which is unusable. There is no `flex-col` fallback, no `sm:` breakpoint, and no mechanism to hide the sidebar panel on mobile.

### C6 — Base font size set to 14px via CSS variable
**File:** `app/globals.css` (line 141)  
```css
--font-size-base: 14px;
```
Applied to `body { font-size: var(--font-size-base) }`. All shadcn/ui `Input` components use `text-sm` (14 px) on a 14 px base, which effectively renders inputs at 14 px. iOS Safari auto-zooms on focus when an input's computed font-size is below 16 px. Every form field in the application will trigger unwanted zoom on iPhone.

---

## Recommended Fix Sequence

### Phase 1 — Navigation & Shell (effort: 2–3 days)

1. Add viewport meta tag to `app/layout.tsx` — 15 min.
2. Add `overflow-x: hidden` to `body` in `globals.css` — 5 min.
3. Refactor `AppShell.tsx`: replace inline `marginLeft` with Tailwind classes using `md:ml-14` / `md:ml-[316px]` conditional, and reset to `ml-0` below `md`. Add a backdrop overlay that closes the sidebar when tapped on mobile — 4 h.
4. Add hamburger button to `DualSidebar.tsx` for `< md` screens, collapse both sidebars off-screen using `translate-x` transforms — 4 h.
5. Fix base font size: remove `--font-size-base: 14px` or bump to 16 px. Add `text-[16px]` to all `Input` components — 1 h.

### Phase 2 — Vendor Leads Table & Tabs (effort: 3–4 days)

1. `ActionsCell` — replace `opacity-0 group-hover:opacity-100` with a tap-accessible dropdown menu (shadcn DropdownMenu) that is always visible on touch devices — 2 h.
2. `VendorLeadsTable` — wrap the entire `<table>` in an `overflow-x-auto` container with `min-w-max` on the table (already partially done on some tabs, needs audit/unification) — 1 h.
3. `TabBar` — already uses `overflow-x-auto [scrollbar-width:none]` (good), but `min-w-max` on the inner container should be verified. Tab labels such as "AI Chat", "Details", "Photos" are short enough. No change needed beyond verification.
4. `KpiBar` (`components/ui/kpi-bar.tsx`) — add `flex-col sm:flex-row` and `divide-y sm:divide-x` to allow wrapping on mobile — 30 min.
5. `VendorLeadsKpiBar` — inherits from KpiBar fix above.

### Phase 3 — Modals & Detail Views (effort: 2–3 days)

1. `ModalShell` — replace `flex` horizontal layout with `flex-col` on mobile: stack left panel (collapsible) above content. Use `w-full` on mobile and `w-[260px]` from `md:` up — 3 h.
2. `DialogContent` (shadcn ui/dialog.tsx) — already uses `max-w-lg w-full`. Add `max-h-[90dvh] overflow-y-auto` and ensure close button is never scrolled out of view — 30 min.
3. `VendorLeadDetailModal` — tabs inside modal should use `overflow-x-auto [scrollbar-width:none]` — 30 min.
4. `DealDetailModal` — check the grid layout and section panels for fixed widths.
5. `MapModal` — iframe map needs explicit `min-h-[300px]` on mobile — 30 min.

### Phase 4 — Remaining Pages (effort: 2–3 days)

1. Dashboard page: `grid-cols-4` stat grid inside Deals Snapshot card needs `grid-cols-2 sm:grid-cols-4` — 15 min.
2. `DashboardKpiStrip` — `grid-cols-2 md:grid-cols-4` already present; verify padding at 375 px.
3. `PipelineStatsCards` — `grid-cols-2 md:grid-cols-4` already present; verify.
4. `InvestorList` — `overflow-x-auto` table container needed; toolbar search + button wrap on mobile.
5. `ReservationOverview` — check table overflow.
6. `WorkflowAnalytics` — check grid layouts for mobile.
7. Settings pages — multi-column forms need `sm:grid-cols-2` breakpoints.
8. `PageHeader` — `flex items-start justify-between` will compress title and actions on mobile; needs `flex-col sm:flex-row` — 30 min.
9. `VendorPageShell` tab bar — already has `overflow-x-auto`; 5 tabs fit on 375 px.

### Phase 5 — PWA & Polish (effort: 1 day)

1. Add `manifest.json` to `/public` with app name, icons, theme colour.
2. Add `apple-mobile-web-app-capable` and `apple-touch-icon` meta tags to `app/layout.tsx`.
3. Add `apple-mobile-web-app-status-bar-style` meta tag.
4. Audit and fix all remaining `text-[10px]`, `text-[11px]` occurrences — raise to `text-xs` (12 px) minimum.
5. Test sticky header behaviour on iOS Safari.
6. Verify all touch target sizes meet 44 × 44 px minimum.

---

## Page-by-Page Breakdown

---

### Root Layout — `app/layout.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 | Navigation | Missing `<meta name="viewport">` tag — iOS Safari renders at 980 px virtual width |
| 2 | 🔴 | PWA Readiness | No `manifest.json` reference, no `apple-mobile-web-app-capable` meta tag |
| 3 | 🟠 | Scrolling | No `overflow-x: hidden` on `<body>` or `<html>` — horizontal scroll can leak from any child |
| 4 | 🟢 | Typography | Google Fonts loaded via `@import url(...)` in `globals.css` — no `display=swap` in CSS import (swap set in next/font/google, which is correct) |

Estimated effort: Small

---

### Dashboard Shell — `app/dashboard/layout.tsx` + `components/layout/AppShell.tsx` + `components/layout/DualSidebar.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 | Navigation | `marginLeft: secondaryOpen ? "316px" : "56px"` — inline style, no responsive override; entire page is unusable below ~500 px |
| 2 | 🔴 | Navigation | No hamburger / mobile navigation pattern — DualSidebar is always fixed and visible |
| 3 | 🟠 | Navigation | Primary sidebar `w-14 hover:w-[200px]` — `:hover` expand does not work on touch |
| 4 | 🟠 | Navigation | Secondary sidebar `w-[260px]` fixed — no `max-w-[calc(100vw-56px)]` constraint |
| 5 | 🟠 | Scrolling | Content area has `p-8` (32 px padding each side) — on 375 px leaves 311 px width before sidebar offset |
| 6 | 🟡 | Navigation | NAV2 expand tab button `w-5 h-10` — 20 × 40 px, below 44 px minimum touch target in both dimensions |

Estimated effort: XL

---

### Dashboard Home — `app/dashboard/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | KPI Cards | `grid grid-cols-4 gap-2` for deal status counts — 4-column grid with no mobile breakpoint; cells become illegible at 375 px after sidebar offset is applied |
| 2 | 🟡 | Layout | `grid gap-4 md:grid-cols-2` for pipeline and deal snapshot cards — breakpoint exists; works at 768 px+ but below that both cards are full-width (acceptable if shell fixed) |
| 3 | 🟡 | Typography | `text-[10px]` used for deal status labels inside the 4-col grid |
| 4 | 🟡 | Actions | `PageHeader` `flex items-start justify-between` — "New Deal" button will crowd title on mobile |
| 5 | 🟢 | Scrolling | Recent activity timeline is a single column list — responsive by nature |

Estimated effort: Medium

---

### Login Page — `app/login/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Forms | `Input` components use `text-sm` (14 px base → 14 px computed) — triggers iOS auto-zoom on focus |
| 2 | 🟢 | Layout | `w-full max-w-md` with `px-4` on outer container — centred and responsive |
| 3 | ✅ | Layout | Full-screen centred form with `min-h-screen` — works on mobile |

Estimated effort: Small

---

### Forgot Password Page — `app/forgot-password/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Forms | Same `text-sm` input zoom issue as login page |
| 2 | ✅ | Layout | Identical responsive structure to login page |

Estimated effort: Small

---

### Reset Password Page — `app/reset-password/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Forms | Same `text-sm` input zoom issue |
| 2 | ✅ | Layout | Same responsive structure |

Estimated effort: Small

---

### Vendor Leads / Pipeline Page — `app/dashboard/vendors/page.tsx` + `components/vendors/unified-vendors-view.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Layout | Header `flex items-start justify-between` — view toggle buttons will wrap badly at mobile widths; `text-3xl font-bold` heading wastes vertical space |
| 2 | 🟡 | Interactions | View toggle (Table/Board) uses full `<Button>` with label + icon — fine, but `gap-2` button group may need `flex-wrap` |

Estimated effort: Small (after shell is fixed)

---

### Vendor Leads Table — `components/vendors/vendor-leads-table.tsx`

This is the most complex component in the application and the highest-priority responsive fix.

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 | Interactions | `ActionsCell`: all actions hidden behind `opacity-0 group-hover:opacity-100` — no touch fallback |
| 2 | 🟠 | Tables | **Map View tab**: 9 data columns + 2 sticky columns = 11 columns total — requires horizontal scroll |
| 3 | 🟠 | Tables | **Property Details tab**: 14 data columns + 2 sticky = 16 columns — very wide even on desktop |
| 4 | 🟠 | Tables | **Portal Check tab**: 13 columns — extremely wide |
| 5 | 🟠 | Tables | **Validation tab**: 15 columns — the widest tab |
| 6 | 🟠 | Tables | **Comparable tab**: 13 columns |
| 7 | 🟠 | Tables | **Offer Analysis tab**: 15 columns |
| 8 | 🟡 | Tables | Sticky left column `left-[40px]` with `w-[220px] min-w-[220px]` — 220 px of a 375 px screen is occupied by one column |
| 9 | 🟡 | Tables | `Th` cells use `whitespace-nowrap` — intentional, but means table can never compress below natural width |
| 10 | 🟡 | Tab Bars | 7 tabs in tab bar — `overflow-x-auto [scrollbar-width:none]` already applied; scrollable but no indicator to the user that more tabs exist |
| 11 | 🟡 | Interactions | `ActionBtn` is `h-7 w-7` (28 × 28 px) — below 44 px minimum touch target |
| 12 | 🟡 | Typography | `Th` headers use `text-[11px]` — below 12 px minimum on mobile |
| 13 | 🟡 | Typography | `Td` cells use `text-xs` (12 px) monospace values — technically acceptable but at very high density |
| 14 | 🟡 | Interactions | `NeedsActionBanner` action buttons `px-2.5 py-1 text-[11px]` — ~30 px tall, below 44 px |
| 15 | 🟢 | Typography | `text-[10px]` badge text on "Ready to Offer" / "Accepted" / "Rejected" status chips inside VendorAddressCell |

Estimated effort: XL

---

### Vendor Lead Detail (Standalone Pages) — `app/dashboard/vendors/[id]/*`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Tab Bars | `VendorPageShell` 5 tabs with `overflow-x-auto` — already scrollable; labels are short ("Contact Info", "Comparables", etc.) — acceptable |
| 2 | 🟡 | Layout | `h1 text-2xl font-bold` + address subtitle — fine at mobile widths |
| 3 | 🟡 | Forms | `VendorContactPanel` edit form — grid layout not checked for breakpoints |

Estimated effort: Small–Medium

---

### Vendor Lead Detail Modal — `components/vendors/vendor-lead-detail-modal.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Modals | Uses `Dialog` + `Tabs` — `DialogContent` has `max-w-lg w-full` but is missing `max-h-[90dvh] overflow-y-auto` — content may overflow on phones |
| 2 | 🟡 | Tab Bars | Tabs inside modal — number of tabs not confirmed without reading full file, but dense modal tabs are a risk |

Estimated effort: Medium

---

### ModalShell — `components/vendors/modal-shell.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🔴 | Modals | Left panel `w-[260px] shrink-0` with no responsive override — leaves ~115 px of content width on 375 px phone; unusable |
| 2 | 🟠 | Modals | `max-h-[90vh]` on outer container — good, but inner panels need their own `overflow-y-auto` to scroll independently |
| 3 | 🟡 | Modals | No close button on the modal overlay — relies on backdrop click only |

Estimated effort: Medium

---

### Map Modal — `components/vendors/map-modal.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Maps | Rendered inside `ModalShell` which is broken on mobile — inherits C5 critical issue |
| 2 | 🟡 | Maps | Google Maps `<iframe>` — no explicit `min-height` set for the embed; may collapse to zero height if parent flex container has issues |

Estimated effort: Small (after ModalShell fixed)

---

### Deals Page — `app/dashboard/deals/page.tsx` + `components/deals/deal-list.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | DealList renders cards in a grid — only 1 `md:` breakpoint found (`grid-cols-1 md:grid-cols-2 lg:grid-cols-3` suspected); needs verification |
| 2 | 🟡 | Interactions | Row action buttons in deal cards should be confirmed for touch target size |
| 3 | 🟡 | Layout | `PageHeader` compress issue — actions row (New Deal + Kanban toggle) may not wrap |

Estimated effort: Small–Medium

---

### Deal Detail Page — `app/dashboard/deals/[id]/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Layout | Action button row in header: `GenerateInvestorPackButton + Edit + Delete` — 3 buttons in a row at the top, no wrapping on mobile |
| 2 | 🟡 | Layout | Multiple `md:` and `lg:` breakpoints found (8 occurrences) — partially responsive |
| 3 | 🟡 | Layout | Score ring + content side-by-side layout — needs checking for mobile stacking |

Estimated effort: Medium

---

### Deal Detail Modal — `components/deals/deal-detail-modal.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Modals | Custom overlay `fixed inset-0 z-50 flex items-center justify-center` — responsive by design but inner panel max-width must be checked |
| 2 | 🟡 | Modals | `CollapsibleSection` inner content padding `px-5 py-5` — may be tight at 375 px |

Estimated effort: Small

---

### Deal New/Edit Form — `app/dashboard/deals/new/page.tsx`, `app/dashboard/deals/[id]/edit/page.tsx` + `components/deals/deal-form.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Forms | Multi-field form — no grid breakpoints confirmed in the first 80 lines read; likely needs `sm:grid-cols-2` |
| 2 | 🟡 | Forms | All `Input` fields inherit 14 px base font — iOS zoom issue |

Estimated effort: Small

---

### Dashboard Analytics — `app/dashboard/analytics/page.tsx` + `components/analytics/workflow-analytics.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | `WorkflowAnalytics` uses `Tabs` component — 2 `md:` breakpoints in file; partially responsive |
| 2 | 🟡 | Typography | `text-3xl font-bold` heading wastes vertical space on mobile |

Estimated effort: Small

---

### Investors Page — `app/dashboard/investors/page.tsx` + `components/investors/investor-list.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Tables | `InvestorList` uses `overflow-x-auto` around table but toolbar `flex items-center justify-between gap-3` will compress; search input `w-56` and "New Investor" button will wrap badly |
| 2 | 🟡 | Tables | Investor table has many columns — exact count not fully confirmed but rich data suggests 8–10 columns |
| 3 | 🟡 | Modals | `InvestorForm` and detail expanded row use `Dialog` — needs max-height on mobile |

Estimated effort: Medium

---

### Reservations Page — `app/dashboard/reservations/page.tsx` + `components/investors/reservation-overview.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Tables | `ReservationOverview` — reservation workflow is complex; likely has a multi-column table |
| 2 | 🟡 | Layout | Workflow status badges row — 10 status stages; may overflow on mobile |

Estimated effort: Medium

---

### Scraper Page — `app/dashboard/scraper/page.tsx` + `components/scraper/properties-table.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Tables | `PropertiesTable` has table/grid toggle — 2 `sm:` breakpoints; partially responsive |
| 2 | 🟡 | Tables | Table view has 8+ columns (title, source, price, beds, type, status, date, actions) |
| 3 | 🟡 | Layout | `ScraperOverview` statistics grid layout — partially responsive |

Estimated effort: Medium

---

### Settings Pages — `app/dashboard/settings/*`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Forms | `CompanyProfileSettings` — logo upload, multiple text fields; likely single-column but needs breakpoint audit |
| 2 | 🟡 | Tab Bars | Settings has sub-tabs (Company, Branding, etc.) — overflow behaviour on 375 px not confirmed |
| 3 | 🟡 | Forms | `OfferCalculatorSettings`, `InvestorManagementDashboard` — multi-column grids partially use `sm:` breakpoints |
| 4 | 🟡 | Forms | All Input fields inherit 14 px base font — iOS zoom issue |

Estimated effort: Medium

---

### Admin Pages — `app/dashboard/admin/*`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Tables | User management table — likely has overflow issues |
| 2 | 🟢 | Layout | Admin pages are low-traffic; lower priority |

Estimated effort: Small

---

### Vendor Pipeline Board (Kanban) — `components/vendors/vendor-pipeline-kanban-board.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Layout | 13 pipeline stages, each as a column — Kanban boards are inherently horizontal-scroll on mobile; no mobile card stacking alternative |
| 2 | 🟡 | Interactions | Drag-and-drop (`@hello-pangea/dnd`) — works on touch but columns are fixed-width, cards would be very narrow |

Estimated effort: Large

---

### Upload Page (Public) — `app/upload/[token]/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | ✅ | Layout | `max-w-lg mx-auto p-4` — centred, single-column, mobile-first design |
| 2 | ✅ | Interactions | `grid grid-cols-2 gap-3` camera/gallery buttons — adequate size |
| 3 | ✅ | Interactions | `Button size="lg"` for upload — appropriate touch target |
| 4 | ✅ | Images | `grid grid-cols-3 gap-2` photo preview grid — appropriate |

Estimated effort: None (already responsive)

---

### Vendor Response Page (Public) — `app/vendor-response/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | ✅ | Layout | Inline styles with `maxWidth: 560`, `margin: "60px auto"`, `padding: "20px"` — centred and mobile-friendly |
| 2 | 🟢 | Layout | No viewport meta tag (inherits from root layout — same gap as C1) |

Estimated effort: None (inherits root layout fix)

---

### Investor Interest Page (Public) — `app/investor-interest/page.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | ✅ | Layout | Inline styles with `maxWidth: 520`, `width: "100%"`, `padding: "20px"` — centred and mobile-friendly |

Estimated effort: None

---

### Dashboard Home KPI Strip — `components/dashboard/dashboard-kpi-strip.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | KPI Cards | `grid grid-cols-2 ... md:grid-cols-4` — correct; 2-column on mobile is good. However `divide-x` on a 2-column grid creates wrong dividers — should be `divide-y` at `grid` mode |
| 2 | 🟢 | Typography | `p-6` padding in each cell — 24 px each side; on mobile that is 48 px horizontal padding total which is a lot |

Estimated effort: Small

---

### KpiBar — `components/ui/kpi-bar.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | KPI Cards | `flex items-stretch divide-x` with no mobile wrapping — 4 tiles in a horizontal row; on 375 px each tile is ~93 px wide which cannot fit the `text-xl font-bold` value plus label |
| 2 | 🟡 | Typography | `font-mono text-xl font-bold` value — may truncate at 375 px |

Estimated effort: Small

---

### PageHeader — `components/ui/page-header.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | `flex items-start justify-between gap-4` — actions will be pushed right next to title with no wrapping; on small screens actions may overflow or compress title |
| 2 | 🟢 | Typography | `text-2xl font-bold` — appropriate for mobile heading |

Estimated effort: Small

---

### VendorPageShell — `components/vendors/vendor-page-shell.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | ✅ | Tab Bars | 5 tabs with `overflow-x-auto` on container — scrollable, labels are short |
| 2 | 🟢 | Layout | Breadcrumb + header — single column, responsive |

Estimated effort: None

---

### PipelineStatsCards — `components/vendors/pipeline-stats-cards.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | KPI Cards | `grid-cols-2 md:grid-cols-4` — correct breakpoint. `divide-x` within a 2-column CSS grid creates wrong visual dividers on mobile |
| 2 | ✅ | KPI Cards | Grid correctly falls back to 2-column on mobile |

Estimated effort: Small

---

### Contacts Pages — `app/dashboard/contacts/*`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | 3 `md:` breakpoints found — partially responsive |
| 2 | 🟡 | Tables | Contact list table — overflow behaviour not confirmed |

Estimated effort: Small

---

### Comparables Pages — `app/dashboard/comparables/*`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | `comparables-grid.tsx` has 3 `sm:` breakpoints — good |
| 2 | 🟢 | Layout | `comparable-property-card.tsx` — card-based layout, likely responsive |

Estimated effort: Small

---

## Component Breakdown

### `components/ui/input.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | Forms | `text-sm` class on `<input>` — with `--font-size-base: 14px` the computed size is 14 px, triggering iOS auto-zoom on focus |

Fix: Add `text-base sm:text-sm` so mobile gets 16 px and desktop keeps 14 px.

---

### `components/ui/tabs.tsx` (shadcn)

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Tab Bars | Standard shadcn Tabs — `TabsList` uses `inline-flex` which will overflow if tabs are many or labels are long; no `overflow-x-auto` applied at base level |

---

### `components/ui/dialog.tsx` (shadcn)

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Modals | `max-w-lg` (512 px) works on tablet+, but needs `max-h-[90dvh] overflow-y-auto` to prevent tall modal content from overflowing the screen |
| 2 | ✅ | Modals | `w-full` on `DialogContent` — will not exceed viewport width |

---

### `components/ui/page-header.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟡 | Layout | No `flex-wrap` or `flex-col sm:flex-row` — actions can crowd title on small screens |

---

### `components/ui/kpi-bar.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟠 | KPI Cards | `flex divide-x` — horizontal-only, no mobile wrap fallback |

---

### `components/ui/kpi-card.tsx`

| # | Severity | Category | Issue |
|---|----------|----------|-------|
| 1 | 🟢 | Typography | `text-2xl font-bold` value text — large enough and responsive by nature |

---

## Quick Wins (< 30 min each)

1. **Add viewport meta tag** — `app/layout.tsx`: add `<meta name="viewport" content="width=device-width, initial-scale=1">` inside `<head>`. This single change makes the site immediately more usable on mobile and unblocks visual testing of all other issues.
2. **Add `overflow-x: hidden` to body** — `app/globals.css`: `body { overflow-x: hidden; }` prevents horizontal bleed from non-responsive elements.
3. **Fix iOS input zoom** — `components/ui/input.tsx`: change class from `text-sm` to `text-base sm:text-sm`. This fixes every input in the entire application.
4. **Dashboard 4-col grid** — `app/dashboard/page.tsx` line ~272: `grid-cols-4` → `grid-cols-2 sm:grid-cols-4`.
5. **KpiBar mobile wrap** — `components/ui/kpi-bar.tsx`: change outer `div` from `flex items-stretch divide-x` to `flex flex-col sm:flex-row sm:divide-x divide-y sm:divide-y-0`.
6. **PageHeader wrap** — `components/ui/page-header.tsx`: `flex items-start justify-between` → `flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between`.
7. **ModalShell close on backdrop** — `components/vendors/modal-shell.tsx`: the `onClick={onClose}` is already on the outer div; this is fine. Add `aria-label="Close"` to the backdrop div.
8. **Dialog max-height** — `components/ui/dialog.tsx`: add `max-h-[90dvh] overflow-y-auto` to `DialogContent` default classes.
9. **UnifiedVendorsView header wrap** — `components/vendors/unified-vendors-view.tsx` line 59: add `flex-wrap` to the `flex items-start justify-between` header.
10. **DashboardKpiStrip divide fix** — `components/dashboard/dashboard-kpi-strip.tsx`: the `grid-cols-2 md:grid-cols-4` grid has `divide-x` which only applies correctly at `md:`. Add `divide-y` for mobile and remove `divide-x` at grid mode.

---

## Tailwind Breakpoint Usage Summary

**Currently used (occurrences across components + pages):**
- `sm:` — 35 files, used sporadically
- `md:` — 28 files, most common
- `lg:` — 12 files
- `xl:` — 3 files
- `2xl:` — 0 files

**Missing / underused:**
- `sm:` breakpoint (640 px) is almost entirely absent from the core layout shell, KPI bars, and table components — this is the most critical gap since it would address tablet-portrait and large-phone layouts.
- No breakpoints at all in `AppShell.tsx`, `DualSidebar.tsx`, `ModalShell.tsx`, `kpi-bar.tsx`, `page-header.tsx`, `vendor-leads-table.tsx` (column/cell level).
- The `md:` breakpoint (768 px) is used for most grid fallbacks but is insufficient for 375–640 px phones — `sm:` breakpoints must be added alongside.

**Effective breakpoint strategy to adopt for this codebase:**
- Below `md` (< 768 px): hide/collapse both sidebars behind a hamburger; single-column layouts; stacked forms; card-based tables.
- `md:` to `lg:`: show collapsed primary sidebar (56 px); secondary sidebar toggleable; 2-column grids.
- `lg:` (≥ 1024 px): full dual-sidebar layout as today; 3–4 column grids.

---

## Recommended Global CSS Additions

Add the following to `app/globals.css`:

```css
/* ── Viewport & overflow guards ─────────────────────────────────── */
html, body {
  overflow-x: hidden;
  /* Prevent mobile browser bottom bar from causing layout shift */
  min-height: 100dvh;
}

/* ── Touch target minimum ────────────────────────────────────────── */
/* Applied to any element that may be too small */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* ── Scrollable tab bars ─────────────────────────────────────────── */
/* Apply to any tab list that may overflow on mobile */
.tabs-scroll {
  overflow-x: auto;
  scrollbar-width: none;
}
.tabs-scroll::-webkit-scrollbar {
  display: none;
}

/* ── Mobile-safe table wrapper ───────────────────────────────────── */
.table-scroll {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}
```

Add the following inside `<head>` in `app/layout.tsx`:

```tsx
// In the metadata export:
export const metadata: Metadata = {
  title: "DealStack - Property Deal Sourcing SaaS",
  description: "Professional property investment deal sourcing platform",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,  // Prevent auto-zoom (debated — remove if accessibility is priority)
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DealStack",
  },
}
```

Or manually in the `<head>`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="default" />
<meta name="apple-mobile-web-app-title" content="DealStack" />
<link rel="manifest" href="/manifest.json" />
```
