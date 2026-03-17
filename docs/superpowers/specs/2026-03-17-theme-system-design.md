# Theme System — Design Spec

## Goal

Introduce a per-user theme system that gives full control over colours, typography, spacing, and badge styles across the app. Delivered in two sequential sub-projects: a consistency pass that routes all styling through CSS variables, followed by a theme picker UI in admin settings.

---

## Sub-project 1: Consistency Pass

### Problem

Styling is currently scattered across the codebase with no single source of truth:

- **6 independent badge/status colour lookup maps** — one per component (`deal-list.tsx`, `vendor-leads-table.tsx`, `investor-list.tsx`, `contact-card.tsx`, `deal-detail-modal.tsx`, `vendor-analytics-panel.tsx`). None reference the `--status-*` CSS variables defined in `globals.css`.
- **2 duplicate KPI bar implementations** — `DealKpiBar` in `deal-list.tsx` and `KpiBar` in `vendor-leads-table.tsx` are structurally identical (~150 lines each) and both use inline `style={{ color: "#16a34a" }}` hex strings instead of the `.kpi-value-positive` / `.kpi-value-highlight` utility classes defined in `globals.css`.
- **Sidebar hardcoded hex** — `DualSidebar.tsx` uses `bg-[#1A1A1F]`, `bg-[#F5A623]` etc. instead of referencing the `--sidebar-bg`, `--sidebar-active-bg` CSS variables already defined in `globals.css`.
- **14 orphaned `--status-*` CSS variables** — defined in `globals.css` but referenced by no component.
- **`font-display` barely used** — Plus Jakarta Sans applied in only 2 files; most headings render in Inter by default.

Until all styling is routed through CSS variables, a theme picker cannot control anything.

### Changes

#### New file: `lib/theme/status-colors.ts`

Single source of truth for all badge colour maps. Exports one function per entity type:

```ts
export function getDealStatusStyle(status: string): string
export function getPipelineStageStyle(stage: string): string
export function getContactTypeStyle(type: string): string
export function getInvestorStrategyStyle(strategy: string): string
export function getInvestorExperienceStyle(experience: string): string
export function getReservationStatusStyle(status: string): string
```

Each function returns a Tailwind class string (e.g. `"bg-blue-100 text-blue-700"`). These replace all local lookup maps. In Sub-project 2, the values will be driven by CSS variables — for Sub-project 1, they centralise the hardcoded values so there is one place to change them.

**Deal status colour mapping (for `getDealStatusStyle`):**

| Status | Background | Text |
|---|---|---|
| `new` | `bg-gray-100` | `text-gray-800` |
| `review` | `bg-yellow-100` | `text-yellow-800` |
| `in_progress` | `bg-blue-100` | `text-blue-800` |
| `ready` | `bg-purple-100` | `text-purple-800` |
| `listed` | `bg-green-100` | `text-green-800` |
| `reserved` | `bg-orange-100` | `text-orange-800` |
| `sold` | `bg-green-200` | `text-green-800` |
| `archived` | `bg-gray-200` | `text-gray-600` |

**Pipeline stage colour mapping (for `getPipelineStageStyle`):**

| Stage | Background | Text |
|---|---|---|
| `NEW_LEAD` | `bg-blue-100` | `text-blue-700` |
| `AI_CONVERSATION` | `bg-violet-100` | `text-violet-700` |
| `DEAL_VALIDATION` | `bg-amber-100` | `text-amber-700` |
| `OFFER_MADE` | `bg-emerald-100` | `text-emerald-700` |
| `NEGOTIATION` | `bg-orange-100` | `text-orange-700` |
| `SOLICITORS` | `bg-indigo-100` | `text-indigo-700` |
| `COMPLETED` | `bg-green-100` | `text-green-700` |
| `DEAD` | `bg-red-100` | `text-red-700` |
| (fallback) | `bg-gray-100` | `text-gray-700` |

**Contact type mapping (for `getContactTypeStyle`):**

| Type | Background | Text |
|---|---|---|
| `SOLICITOR` | `bg-blue-100` | `text-blue-700` |
| `INVESTOR_CONTACT` | `bg-purple-100` | `text-purple-700` |
| `ESTATE_AGENT` | `bg-green-100` | `text-green-700` |
| `MORTGAGE_BROKER` | `bg-amber-100` | `text-amber-700` |
| `ACCOUNTANT` | `bg-gray-100` | `text-gray-700` |
| (fallback) | `bg-gray-100` | `text-gray-700` |

#### New file: `components/ui/status-badge.tsx`

Single shared badge component used everywhere instead of the repeated inline `rounded-full px-2 py-0.5 text-xs font-medium` pattern:

```tsx
interface StatusBadgeProps {
  label: string
  className?: string  // Tailwind colour classes e.g. "bg-blue-100 text-blue-700"
}

export function StatusBadge({ label, className }: StatusBadgeProps) {
  return (
    <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", className)}>
      {label}
    </span>
  )
}
```

Usage: `<StatusBadge label={formatStatus(deal.status)} className={getDealStatusStyle(deal.status)} />`

#### New file: `components/ui/kpi-bar.tsx`

Shared KPI bar replacing the two duplicate implementations:

```tsx
interface KpiTile {
  label: string
  value: string           // pre-formatted display value
  icon: React.ReactNode
  iconBgClass: string     // e.g. "bg-blue-50"
  valueColorClass?: string  // e.g. "text-green-600" — defaults to "text-gray-900"
}

interface KpiBarProps {
  tiles: KpiTile[]
}

export function KpiBar({ tiles }: KpiBarProps) { ... }
```

Tile layout: `flex items-stretch divide-x divide-gray-200 rounded-xl border border-gray-200 bg-white shadow-sm`. Each tile: `flex flex-1 items-center gap-3 px-5 py-4`. Value: `font-mono text-xl font-bold`. Label: `text-xs text-gray-500`.

#### Modified file: `components/layout/DualSidebar.tsx`

Replace all hardcoded hex with CSS variable references:

| Before | After |
|---|---|
| `bg-[#1A1A1F]` | `bg-[var(--sidebar-bg)]` |
| `border-[#2D2D38]` | `border-[var(--sidebar-border)]` |
| `bg-[#F5A623]` (active) | `bg-[var(--sidebar-active-bg)]` |
| `hover:bg-[#2A2A32]` | `hover:bg-[var(--sidebar-hover-bg)]` |
| `bg-[#F5A623]` (logo mark) | `bg-[var(--sidebar-active-bg)]` |

Add to `globals.css` `--sidebar-*` group:
- `--sidebar-border: #2D2D38`
- `--sidebar-hover-bg: #2A2A32`

#### Modified files: `components/deals/deal-list.tsx`, `components/vendors/vendor-leads-table.tsx`

- Remove local `DealKpiBar` and `KpiBar` implementations
- Import and use the new shared `<KpiBar>` component
- Remove inline `style={{ color: "#16a34a" }}` etc. — pass `valueColorClass="text-green-600"` via the tile config instead
- Replace local `getStatusColor()` / `STAGE_STYLE` maps with imports from `lib/theme/status-colors.ts`
- Replace inline badge JSX with `<StatusBadge>`

#### Modified files: `components/deals/deal-detail-modal.tsx`, `components/investors/investor-list.tsx`, `components/contacts/contact-card.tsx`

- Replace local colour lookup maps with imports from `lib/theme/status-colors.ts`
- Replace inline badge JSX with `<StatusBadge>`

---

## Sub-project 2: Theme Picker

### Data Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model UserTheme {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokens    Json     @default("{}")
  updatedAt DateTime @updatedAt

  @@map("user_themes")
}
```

`tokens` is a JSON object containing only overrides from the defaults, keyed by CSS variable name:

```json
{
  "--ds-primary": "#7C3AED",
  "--sidebar-bg": "#0F172A",
  "--sidebar-active-bg": "#7C3AED"
}
```

Unset tokens fall back to the values in `globals.css`. The `User` model gains a `theme UserTheme?` relation.

### Theme Application

**File: `app/dashboard/layout.tsx`**

The dashboard layout server component fetches the user's `UserTheme` and injects tokens as an inline style on the outermost `<div>`:

```tsx
const userTheme = await prisma.userTheme.findUnique({ where: { userId: session.user.id } })
const themeStyle = userTheme?.tokens
  ? Object.entries(userTheme.tokens as Record<string, string>)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")
  : ""

return <div style={themeStyle ? { [themeStyle]: "" } as any : undefined}>...</div>
```

Actually, the correct approach is to set the style as a CSS string on the element. In Next.js this is done via:

```tsx
<div style={themeStyle ? Object.fromEntries(
  Object.entries(userTheme.tokens as Record<string, string>)
) : {}}>
```

CSS variables cascade from this element to all descendants. No client-side hydration required. SSR-safe.

### API Routes

**`app/api/user/theme/route.ts`**

```
GET  /api/user/theme     → returns { tokens: Record<string, string> }
PUT  /api/user/theme     → body: { tokens: Record<string, string> }, merges with existing
DELETE /api/user/theme   → clears all overrides (reset to defaults)
```

All routes check `getServerSession(authOptions)` and scope to the current user's `userId`.

### Theme Picker UI

**File: `app/dashboard/settings/appearance/page.tsx`**

Page layout: two-column on desktop, stacked on mobile.

- **Left column** — tabbed control panel (6 tabs)
- **Right column** — sticky live preview panel

**Left column tabs:**

| Tab | Controls |
|---|---|
| Brand | Primary colour (`--ds-primary`), Accent colour (`--ds-accent`), Positive value colour (`--value-positive`), Negative value colour (`--value-negative`), Highlight colour (`--value-highlight`) |
| Sidebar | Background (`--sidebar-bg`), Active item (`--sidebar-active-bg`), Hover (`--sidebar-hover-bg`), Border (`--sidebar-border`) |
| Status Badges | Colour pair (bg + text) for each: 8 deal statuses, up to 9 pipeline stages, 6 contact types — stored as `--status-{entity}-{status}-bg` and `--status-{entity}-{status}-text` |
| Typography | Base font size (12 / 14 / 16px → `--font-size-base`), Heading font (Plus Jakarta Sans / Inter / System → `--font-display`), Font weight: normal/medium/bold scale (`--font-weight-heading`) |
| Spacing | Page padding Compact/Normal/Spacious (`--page-padding`), Card padding (`--card-padding`), Section gap (`--section-gap`), Table row height (`--table-row-height`) |
| KPI Colours | Per-tile value colour for each KPI category (positive/negative/highlight/neutral) |

**Controls used:**
- Colour tokens → `<input type="color">` wrapped in a styled swatch button showing the hex value
- Discrete options (font size, spacing density) → segmented button group (3 options)
- Font family → `<select>` dropdown

**Live preview panel (right column):**

A miniature render using real Tailwind classes applied to the preview container's inline style. Contains:
- A sidebar strip (showing background, active item colours)
- A KPI tile row (2–3 tiles showing value colour tokens)
- A table row with 3 status badges
- A `ds-card` with a heading and body text (showing typography tokens)

Changes are applied to the preview container immediately (client-side CSS variable injection) without saving. "Save Appearance" calls `PUT /api/user/theme`. "Reset to Defaults" calls `DELETE /api/user/theme` and reloads defaults.

**Settings page navigation** (`app/dashboard/settings/page.tsx`): Add an "Appearance" card linking to `/dashboard/settings/appearance`.

### Token Reference (full list of controllable CSS variables)

| Group | Variable | Default |
|---|---|---|
| Brand | `--ds-primary` | `#2563EB` |
| Brand | `--ds-accent` | `#F5A623` |
| Brand | `--value-positive` | `#16A34A` |
| Brand | `--value-negative` | `#DC2626` |
| Brand | `--value-highlight` | `#2563EB` |
| Sidebar | `--sidebar-bg` | `#1A1A1F` |
| Sidebar | `--sidebar-active-bg` | `#F5A623` |
| Sidebar | `--sidebar-hover-bg` | `#2A2A32` |
| Sidebar | `--sidebar-border` | `#2D2D38` |
| Typography | `--font-size-base` | `14px` |
| Typography | `--font-display` | `'Plus Jakarta Sans'` |
| Typography | `--font-weight-heading` | `700` |
| Spacing | `--page-padding` | `32px` |
| Spacing | `--card-padding` | `24px` |
| Spacing | `--section-gap` | `20px` |
| Spacing | `--table-row-height` | `52px` |
| Status (deal) | `--status-deal-{status}-bg` | (per mapping above) |
| Status (deal) | `--status-deal-{status}-text` | (per mapping above) |
| Status (pipeline) | `--status-pipeline-{stage}-bg` | (per mapping above) |
| Status (pipeline) | `--status-pipeline-{stage}-text` | (per mapping above) |
| Status (contact) | `--status-contact-{type}-bg` | (per mapping above) |
| Status (contact) | `--status-contact-{type}-text` | (per mapping above) |

---

## Out of Scope

- Dark mode (the app is currently light-mode only; adding dark mode is a separate project)
- Custom CSS input (direct CSS editing is not exposed to users)
- Theme export/import (future)
- Per-page overrides (themes apply globally to the user's session)
- Shared/team themes (future — would require a `TeamTheme` model)

---

## File Structure

### Sub-project 1 (Consistency Pass)

```
lib/theme/
  status-colors.ts          CREATE — centralised badge colour maps

components/ui/
  status-badge.tsx          CREATE — shared badge component
  kpi-bar.tsx               CREATE — shared KPI bar component

components/layout/
  DualSidebar.tsx           MODIFY — swap hardcoded hex for CSS vars

components/deals/
  deal-list.tsx             MODIFY — remove DealKpiBar, use shared KpiBar + StatusBadge
  deal-detail-modal.tsx     MODIFY — replace local colour map with status-colors.ts

components/vendors/
  vendor-leads-table.tsx    MODIFY — remove KpiBar, use shared KpiBar + StatusBadge

components/investors/
  investor-list.tsx         MODIFY — replace local colour maps with status-colors.ts

components/contacts/
  contact-card.tsx          MODIFY — replace local colour map with status-colors.ts

app/globals.css             MODIFY — add --sidebar-border, --sidebar-hover-bg variables
```

### Sub-project 2 (Theme Picker)

```
prisma/schema.prisma        MODIFY — add UserTheme model

app/api/user/theme/
  route.ts                  CREATE — GET / PUT / DELETE theme tokens

app/dashboard/
  layout.tsx                MODIFY — inject UserTheme tokens as CSS variables

app/dashboard/settings/
  page.tsx                  MODIFY — add Appearance card
  appearance/
    page.tsx                CREATE — theme picker client page

lib/theme/
  defaults.ts               CREATE — full default token values (used for reset + preview)
  types.ts                  CREATE — ThemeTokens interface
```
