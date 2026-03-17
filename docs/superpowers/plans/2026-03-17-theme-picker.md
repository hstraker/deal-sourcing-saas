# Theme System — Sub-project 2: Theme Picker — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each user persist their own CSS variable overrides in the database, with a settings UI that controls colours, typography, spacing, and badge styles, with a live preview.

**Architecture:** A `UserTheme` Prisma model stores a JSON blob of CSS variable overrides keyed by variable name. The dashboard server layout fetches and spreads `DEFAULT_TOKENS + userOverrides` as an inline `style` prop on the layout wrapper `<div>`, so all CSS variables cascade to every descendant. Status badge components are updated to use CSS variable inline styles (so the Status Badges tab actually affects real pages). The settings page at `/dashboard/settings/appearance` is a Client Component with a tabbed control panel and a sticky live preview pane.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma 5 + PostgreSQL, Tailwind CSS, shadcn/ui (`Tabs`, `Button`, `PageHeader`), Sonner toast.

**Prerequisite:** Sub-project 1 (Consistency Pass) must be committed before starting this plan — it creates `lib/theme/status-colors.ts`, `components/ui/status-badge.tsx`, and `components/ui/kpi-bar.tsx`.

---

## Codebase context (read before starting)

- **No test suite** — verification is `npx tsc --noEmit` (zero errors) + browser smoke-test
- **`app/dashboard/layout.tsx`** (line 22) currently returns `<DashboardLayout>{children}</DashboardLayout>` directly — no wrapping div
- **`app/dashboard/settings/page.tsx`** is a `"use client"` component. It has a row of navigation cards (Company Profile, Investor Packs, Scraper, Land Registry, Underwriting Engine) using the `ds-card p-5 flex items-center gap-4` pattern — add the Appearance card to this list
- **`lib/auth.ts`** exports `authOptions` — used in all API routes
- **`lib/db.ts`** exports `prisma` — the singleton Prisma client
- **`components/ui/status-badge.tsx`** currently accepts `className?: string` — this plan adds `cssKey?: string`
- **`lib/theme/status-colors.ts`** currently exports `getDealStatusStyle` etc. returning Tailwind class strings — this plan adds `getDealStatusVarKey` etc. returning CSS variable prefix strings
- **`app/globals.css`** has `--ds-primary`, `--ds-accent`, `--value-positive`, `--value-negative`, `--value-highlight`, `--sidebar-bg`, `--sidebar-active-bg`, `--sidebar-hover`, `--sidebar-border`, `--page-padding`, `--card-padding`, `--section-gap`, `--font-size-base`, `--font-weight-heading`, `--table-row-height` already defined

---

## Chunk 1: Data layer + API

### Task 1: Prisma schema — add `UserTheme` model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `UserTheme` model and User relation**

Open `prisma/schema.prisma`. Add the following model at the bottom (after the last existing model):

```prisma
model UserTheme {
  id        String   @id @default(cuid())
  userId    String   @unique
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokens    Json     @default("{}")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  @@map("user_themes")
}
```

Then find the `User` model (line ~233). At the end of its relations block (before the `@@index` lines), add:

```prisma
  theme               UserTheme?
```

- [ ] **Step 2: Run migration**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx prisma migrate dev --name add_user_theme
```

Expected output: a message confirming the migration was applied, with a file ending in `_add_user_theme` (e.g. `20260317xxxxxx_add_user_theme`)

- [ ] **Step 3: Verify generated client**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors (Prisma generates `prisma.userTheme` accessor automatically).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add UserTheme model for per-user theme persistence"
```

---

### Task 2: Create `lib/theme/types.ts` and `lib/theme/defaults.ts`

**Files:**
- Create: `lib/theme/types.ts`
- Create: `lib/theme/defaults.ts`

- [ ] **Step 1: Create `lib/theme/types.ts`**

```ts
// lib/theme/types.ts
export type ThemeTokens = Record<string, string>
```

- [ ] **Step 2: Create `lib/theme/defaults.ts`**

```ts
// lib/theme/defaults.ts
// Single source of truth for all default CSS variable values.
// layout.tsx spreads DEFAULT_TOKENS + userOverrides so every CSS var is
// always set on the wrapper <div>, even before the user saves any theme.
import type { ThemeTokens } from "./types"

export const DEFAULT_TOKENS: ThemeTokens = {
  // Brand
  "--ds-primary":        "#2563EB",
  "--ds-accent":         "#F5A623",
  "--value-positive":    "#16A34A",
  "--value-negative":    "#DC2626",
  "--value-highlight":   "#2563EB",

  // Sidebar
  "--sidebar-bg":        "#1A1A1F",
  "--sidebar-active-bg": "#F5A623",
  "--sidebar-hover":     "#2A2A32",
  "--sidebar-border":    "#2D2D38",

  // Typography
  "--font-size-base":       "14px",
  "--font-weight-heading":  "700",

  // Spacing
  "--page-padding":      "32px",
  "--card-padding":      "24px",
  "--section-gap":       "20px",
  "--table-row-height":  "52px",

  // Deal status badge colours (bg + text as hex)
  "--status-deal-new-bg":         "#f3f4f6",
  "--status-deal-new-text":       "#1f2937",
  "--status-deal-review-bg":      "#fef9c3",
  "--status-deal-review-text":    "#713f12",
  "--status-deal-in_progress-bg": "#dbeafe",
  "--status-deal-in_progress-text":"#1e40af",
  "--status-deal-ready-bg":       "#ede9fe",
  "--status-deal-ready-text":     "#4c1d95",
  "--status-deal-listed-bg":      "#dcfce7",
  "--status-deal-listed-text":    "#14532d",
  "--status-deal-reserved-bg":    "#ffedd5",
  "--status-deal-reserved-text":  "#7c2d12",
  "--status-deal-sold-bg":        "#bbf7d0",
  "--status-deal-sold-text":      "#14532d",
  "--status-deal-archived-bg":    "#e5e7eb",
  "--status-deal-archived-text":  "#4b5563",

  // Pipeline stage badge colours
  "--status-pipeline-new_lead-bg":             "#dbeafe",
  "--status-pipeline-new_lead-text":           "#1d4ed8",
  "--status-pipeline-ai_conversation-bg":      "#ede9fe",
  "--status-pipeline-ai_conversation-text":    "#6d28d9",
  "--status-pipeline-deal_validation-bg":      "#fef3c7",
  "--status-pipeline-deal_validation-text":    "#92400e",
  "--status-pipeline-offer_made-bg":           "#d1fae5",
  "--status-pipeline-offer_made-text":         "#065f46",
  "--status-pipeline-offer_accepted-bg":       "#dcfce7",
  "--status-pipeline-offer_accepted-text":     "#14532d",
  "--status-pipeline-offer_rejected-bg":       "#fee2e2",
  "--status-pipeline-offer_rejected-text":     "#991b1b",
  "--status-pipeline-video_sent-bg":           "#cffafe",
  "--status-pipeline-video_sent-text":         "#164e63",
  "--status-pipeline-retry_1-bg":              "#ffedd5",
  "--status-pipeline-retry_1-text":            "#7c2d12",
  "--status-pipeline-retry_2-bg":              "#ffedd5",
  "--status-pipeline-retry_2-text":            "#7c2d12",
  "--status-pipeline-retry_3-bg":              "#ffedd5",
  "--status-pipeline-retry_3-text":            "#7c2d12",
  "--status-pipeline-paperwork_sent-bg":       "#e0e7ff",
  "--status-pipeline-paperwork_sent-text":     "#3730a3",
  "--status-pipeline-ready_for_investors-bg":  "#ede9fe",
  "--status-pipeline-ready_for_investors-text":"#4c1d95",
  "--status-pipeline-dead_lead-bg":            "#fecaca",
  "--status-pipeline-dead_lead-text":          "#7f1d1d",

  // Contact type badge colours
  "--status-contact-solicitor-bg":         "#dbeafe",
  "--status-contact-solicitor-text":       "#1d4ed8",
  "--status-contact-investor_contact-bg":  "#ede9fe",
  "--status-contact-investor_contact-text":"#4c1d95",
  "--status-contact-vendor_contact-bg":    "#ccfbf1",
  "--status-contact-vendor_contact-text":  "#134e4a",
  "--status-contact-estate_agent-bg":      "#dcfce7",
  "--status-contact-estate_agent-text":    "#14532d",
  "--status-contact-contractor-bg":        "#fef3c7",
  "--status-contact-contractor-text":      "#92400e",
  "--status-contact-other-bg":             "#f3f4f6",
  "--status-contact-other-text":           "#374151",
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add lib/theme/types.ts lib/theme/defaults.ts
git commit -m "feat: add ThemeTokens type and DEFAULT_TOKENS"
```

---

### Task 3: Create `app/api/user/theme/route.ts`

**Files:**
- Create: `app/api/user/theme/route.ts`

- [ ] **Step 1: Create the route file**

```ts
// app/api/user/theme/route.ts
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import type { ThemeTokens } from "@/lib/theme/types"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const userTheme = await prisma.userTheme.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({ tokens: (userTheme?.tokens ?? {}) as ThemeTokens })
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const body = await req.json()
  const incoming = (body.tokens ?? {}) as ThemeTokens

  // Merge incoming tokens with existing ones
  const existing = await prisma.userTheme.findUnique({
    where: { userId: session.user.id },
  })
  const merged = { ...((existing?.tokens ?? {}) as ThemeTokens), ...incoming }

  const updated = await prisma.userTheme.upsert({
    where: { userId: session.user.id },
    update: { tokens: merged },
    create: { userId: session.user.id, tokens: merged },
  })

  return NextResponse.json({ tokens: updated.tokens as ThemeTokens })
}

export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  await prisma.userTheme.upsert({
    where: { userId: session.user.id },
    update: { tokens: {} },
    create: { userId: session.user.id, tokens: {} },
  })

  return NextResponse.json({ tokens: {} })
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/user/theme/route.ts
git commit -m "feat: add GET/PUT/DELETE /api/user/theme route"
```

---

### Task 4: Update `app/dashboard/layout.tsx` — SSR theme injection

**Files:**
- Modify: `app/dashboard/layout.tsx`

- [ ] **Step 1: Read the current file**

Open `app/dashboard/layout.tsx`. It currently (line 22) returns `<DashboardLayout>{children}</DashboardLayout>`.

- [ ] **Step 2: Update the file**

Replace the entire file content with:

```tsx
// app/dashboard/layout.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { DEFAULT_TOKENS } from "@/lib/theme/defaults"
import type { ThemeTokens } from "@/lib/theme/types"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Only allow admin and sourcer roles in Phase 1
  if (session.user.role === "investor") {
    redirect("/")
  }

  const userTheme = session.user.id
    ? await prisma.userTheme.findUnique({ where: { userId: session.user.id } })
    : null

  // Merge defaults with user overrides — all tokens always present (no fallback gaps)
  const themeTokens: ThemeTokens = {
    ...DEFAULT_TOKENS,
    ...((userTheme?.tokens ?? {}) as ThemeTokens),
  }

  return (
    <div style={themeTokens as unknown as React.CSSProperties}>
      <DashboardLayout>{children}</DashboardLayout>
    </div>
  )
}
```

> **Note:** `React.CSSProperties` is cast because TypeScript doesn't type CSS custom property keys natively, but React supports them at runtime. This is SSR-safe and has no client-side hydration flash.

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/layout.tsx
git commit -m "feat: inject user theme tokens as CSS variables in dashboard layout"
```

---

## Chunk 2: Badge CSS variable migration + Theme Picker UI

### Task 5: Update `components/ui/status-badge.tsx` — add `cssKey` prop

**Files:**
- Modify: `components/ui/status-badge.tsx`

The `cssKey` prop lets the component use inline CSS variable styles (so the Status Badges tab actually affects real pages). When `cssKey` is set, inline styles take precedence; `className` is still accepted for backwards compatibility.

- [ ] **Step 1: Update the file**

Replace the entire file content with:

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
  /** CSS variable key prefix, e.g. "status-deal-new" → reads --status-deal-new-bg + --status-deal-new-text */
  cssKey?: string
  /** Tailwind colour classes — used when cssKey is not provided */
  className?: string
  tooltip?: string
}

export function StatusBadge({ label, cssKey, className, tooltip }: StatusBadgeProps) {
  const badge = (
    <span
      className={cn(
        "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
        !cssKey && className
      )}
      style={
        cssKey
          ? {
              backgroundColor: `var(--${cssKey}-bg)`,
              color: `var(--${cssKey}-text)`,
            }
          : undefined
      }
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
git commit -m "feat: add cssKey prop to StatusBadge for CSS variable-driven colours"
```

---

### Task 6: Update `lib/theme/status-colors.ts` — add `*VarKey` functions

**Files:**
- Modify: `lib/theme/status-colors.ts`

- [ ] **Step 1: Add three new exported functions at the bottom of the file**

Open `lib/theme/status-colors.ts`. At the very bottom, after all existing functions, add:

```ts
// ── CSS variable key helpers (Sub-project 2) ──────────────────────────────
// These return the CSS variable prefix that StatusBadge's cssKey prop expects.
// The actual color values come from --{key}-bg and --{key}-text CSS variables
// injected by app/dashboard/layout.tsx.

/** Returns CSS variable key for a deal status, e.g. "status-deal-new" */
export function getDealStatusVarKey(status: string): string {
  return `status-deal-${status.toLowerCase()}`
}

/** Returns CSS variable key for a pipeline stage, e.g. "status-pipeline-new_lead" */
export function getPipelineStageVarKey(stage: string): string {
  return `status-pipeline-${stage.toLowerCase()}`
}

/** Returns CSS variable key for a contact type, e.g. "status-contact-solicitor" */
export function getContactTypeVarKey(type: string): string {
  return `status-contact-${type.toLowerCase()}`
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
git commit -m "feat: add getDealStatusVarKey/getPipelineStageVarKey/getContactTypeVarKey"
```

---

### Task 7: Update component callers to use `cssKey`

**Files:**
- Modify: `components/deals/deal-list.tsx`
- Modify: `components/deals/deal-detail-modal.tsx`
- Modify: `components/vendors/vendor-leads-table.tsx`
- Modify: `components/contacts/contact-card.tsx`

Update each file to import the new `*VarKey` function and pass `cssKey` to `StatusBadge` instead of `className`. The `getXxxStyle` functions from Plan 1 remain available but are no longer used by these callers.

> **IMPORTANT — Prerequisite check:** This task requires Sub-project 1 (Consistency Pass) to be committed first. Before starting, verify the following files exist and contain `StatusBadge` / `getDealStatusStyle` references:
>
> ```bash
> grep -l "StatusBadge\|getDealStatusStyle" components/deals/deal-list.tsx components/deals/deal-detail-modal.tsx components/vendors/vendor-leads-table.tsx components/contacts/contact-card.tsx
> ```
>
> All four files must be listed. If any are missing or don't yet contain `StatusBadge`, stop and complete Sub-project 1 first. The "Before" snippets below describe the state after Sub-project 1, not the original state.

- [ ] **Step 1: Update `deal-list.tsx`**

Add import (alongside existing):
```tsx
import { getDealStatusVarKey } from "@/lib/theme/status-colors"
```

Find the `<StatusBadge>` in TableView's status column:
```tsx
// Before:
<StatusBadge
  label={formatStatus(deal.status)}
  className={getDealStatusStyle(deal.status)}
/>
// After:
<StatusBadge
  label={formatStatus(deal.status)}
  cssKey={getDealStatusVarKey(deal.status)}
/>
```

Remove the `getDealStatusStyle` import if it's no longer used elsewhere in the file.

- [ ] **Step 2: Update `deal-detail-modal.tsx`**

Add import:
```tsx
import { getDealStatusVarKey } from "@/lib/theme/status-colors"
```

Find the `<StatusBadge>` in the left panel:
```tsx
// Before:
<StatusBadge
  label={formatStatus(deal.status)}
  className={getDealStatusStyle(deal.status)}
/>
// After:
<StatusBadge
  label={formatStatus(deal.status)}
  cssKey={getDealStatusVarKey(deal.status)}
/>
```

- [ ] **Step 3: Update `vendor-leads-table.tsx`**

Add import:
```tsx
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
```

Find the `StageBadge` function. Update it to pass `cssKey` instead of `className`:
```tsx
function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <StatusBadge
      label={STAGE_LABEL[stage]}
      cssKey={getPipelineStageVarKey(stage)}
      tooltip={STAGE_DESC[stage]}
    />
  )
}
```

- [ ] **Step 4: Update `contact-card.tsx`**

Add import:
```tsx
import { getContactTypeVarKey } from "@/lib/theme/status-colors"
```

Find the `<StatusBadge>` in the contact type badge:
```tsx
// Before:
<StatusBadge
  label={TYPE_LABELS[contact.type]}
  className={getContactTypeStyle(contact.type)}
/>
// After:
<StatusBadge
  label={TYPE_LABELS[contact.type]}
  cssKey={getContactTypeVarKey(contact.type)}
/>
```

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors.

- [ ] **Step 6: Commit**

```bash
git add components/deals/deal-list.tsx components/deals/deal-detail-modal.tsx \
        components/vendors/vendor-leads-table.tsx components/contacts/contact-card.tsx
git commit -m "refactor: use cssKey prop for StatusBadge in all status badge callers"
```

---

### Task 8: Create `app/dashboard/settings/appearance/page.tsx`

**Files:**
- Create: `app/dashboard/settings/appearance/page.tsx`

This is a `"use client"` page. On mount it fetches the user's saved tokens via `GET /api/user/theme`, merges with `DEFAULT_TOKENS`, and stores them in `previewTokens` state. The live preview pane has `style={previewTokens as React.CSSProperties}` so changes show immediately. "Save" calls `PUT /api/user/theme`. "Reset" calls `DELETE /api/user/theme`.

- [ ] **Step 1: Create the file**

```tsx
// app/dashboard/settings/appearance/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { DEFAULT_TOKENS } from "@/lib/theme/defaults"
import type { ThemeTokens } from "@/lib/theme/types"
import { StatusBadge } from "@/components/ui/status-badge"
import { Palette, Type, Layout, Monitor, Sidebar, Tag } from "lucide-react"

// ── Shared control primitives ─────────────────────────────────────────────

function ColorRow({
  label,
  varName,
  tokens,
  onChange,
}: {
  label: string
  varName: string
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const value = tokens[varName] ?? DEFAULT_TOKENS[varName] ?? "#000000"
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(varName, e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
        />
        <span className="w-20 font-mono text-xs text-gray-500">{value}</span>
      </div>
    </div>
  )
}

function SegmentRow({
  label,
  varName,
  options,
  tokens,
  onChange,
}: {
  label: string
  varName: string
  options: { label: string; value: string }[]
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const current = tokens[varName] ?? DEFAULT_TOKENS[varName]
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(varName, opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              current === opt.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ColorPairRow({
  label,
  bgVar,
  textVar,
  tokens,
  onChange,
}: {
  label: string
  bgVar: string
  textVar: string
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const bgValue = tokens[bgVar] ?? DEFAULT_TOKENS[bgVar] ?? "#f3f4f6"
  const textValue = tokens[textVar] ?? DEFAULT_TOKENS[textVar] ?? "#1f2937"
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">bg</span>
          <input
            type="color"
            value={bgValue}
            onChange={(e) => onChange(bgVar, e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">text</span>
          <input
            type="color"
            value={textValue}
            onChange={(e) => onChange(textVar, e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
          />
        </div>
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: bgValue, color: textValue }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────────────────

function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div
      style={tokens as React.CSSProperties}
      className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"
    >
      {/* Sidebar strip */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: "var(--sidebar-bg)" }}
      >
        <div
          className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: "var(--sidebar-active-bg)", color: "var(--sidebar-bg)" }}
        >
          DS
        </div>
        <span className="text-xs font-medium text-white opacity-80">DealStack</span>
      </div>

      {/* KPI tiles */}
      <div className="flex divide-x divide-gray-100 bg-white">
        <div className="flex-1 px-4 py-3">
          <p className="font-mono text-lg font-bold" style={{ color: "var(--value-positive)" }}>
            18.4%
          </p>
          <p className="text-xs text-gray-500">Avg BMV</p>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="font-mono text-lg font-bold" style={{ color: "var(--value-highlight)" }}>
            £1.2M
          </p>
          <p className="text-xs text-gray-500">Pipeline</p>
        </div>
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-t border-gray-100">
        <StatusBadge label="In Progress" cssKey="status-deal-in_progress" />
        <StatusBadge label="New Lead" cssKey="status-pipeline-new_lead" />
        <StatusBadge label="Solicitor" cssKey="status-contact-solicitor" />
      </div>

      {/* Card sample */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <h3
          className="text-sm mb-1"
          style={{ fontWeight: "var(--font-weight-heading)" as any, fontSize: "var(--font-size-base)" }}
        >
          Sample Property Card
        </h3>
        <p className="text-xs text-gray-400">
          3-bed terrace · Asking £240,000 · <strong style={{ color: "var(--ds-primary)" }}>15% BMV</strong>
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AppearancePage() {
  const [tokens, setTokens] = useState<ThemeTokens>({ ...DEFAULT_TOKENS })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/user/theme")
      .then((r) => r.json())
      .then((data) => {
        setTokens({ ...DEFAULT_TOKENS, ...(data.tokens ?? {}) })
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false))
  }, [])

  const handleChange = useCallback((varName: string, value: string) => {
    setTokens((prev) => ({ ...prev, [varName]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Send only the values that differ from defaults
      const overrides: ThemeTokens = {}
      for (const [k, v] of Object.entries(tokens)) {
        if (v !== DEFAULT_TOKENS[k]) overrides[k] = v
      }
      const res = await fetch("/api/user/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: overrides }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Appearance saved")
    } catch {
      toast.error("Failed to save appearance")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      await fetch("/api/user/theme", { method: "DELETE" })
      setTokens({ ...DEFAULT_TOKENS })
      toast.success("Reset to defaults")
    } catch {
      toast.error("Failed to reset")
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Appearance" subtitle="Customise the look and feel of your dashboard" />
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Appearance" subtitle="Customise the look and feel of your dashboard" />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* ── Control Panel ── */}
        <div className="ds-card overflow-hidden">
          <Tabs defaultValue="brand">
            <div className="px-5 pt-4 border-b border-[var(--ds-border)]">
              <TabsList className="grid w-full grid-cols-6 mb-0 h-auto gap-1 bg-transparent p-0">
                <TabsTrigger value="brand" className="flex items-center gap-1 text-xs h-9">
                  <Palette className="h-3.5 w-3.5" />Brand
                </TabsTrigger>
                <TabsTrigger value="sidebar" className="flex items-center gap-1 text-xs h-9">
                  <Sidebar className="h-3.5 w-3.5" />Sidebar
                </TabsTrigger>
                <TabsTrigger value="badges" className="flex items-center gap-1 text-xs h-9">
                  <Tag className="h-3.5 w-3.5" />Badges
                </TabsTrigger>
                <TabsTrigger value="typography" className="flex items-center gap-1 text-xs h-9">
                  <Type className="h-3.5 w-3.5" />Type
                </TabsTrigger>
                <TabsTrigger value="spacing" className="flex items-center gap-1 text-xs h-9">
                  <Layout className="h-3.5 w-3.5" />Spacing
                </TabsTrigger>
                <TabsTrigger value="kpi" className="flex items-center gap-1 text-xs h-9">
                  <Monitor className="h-3.5 w-3.5" />KPI
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Brand */}
            {/* NOTE: The spec lists --value-positive/negative/highlight under both Brand and KPI Colours tabs.
                This plan places them only in the KPI Colours tab to avoid duplication — Brand is limited to
                primary/accent identity colours. */}
            <TabsContent value="brand" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">
                Primary and accent identity colours. KPI value colours are in the KPI tab.
              </p>
              <ColorRow label="Primary colour" varName="--ds-primary" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Accent colour" varName="--ds-accent" tokens={tokens} onChange={handleChange} />
            </TabsContent>

            {/* Sidebar */}
            <TabsContent value="sidebar" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">Sidebar background, active item, and hover state</p>
              <ColorRow label="Background" varName="--sidebar-bg" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Active item" varName="--sidebar-active-bg" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Hover" varName="--sidebar-hover" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Border" varName="--sidebar-border" tokens={tokens} onChange={handleChange} />
            </TabsContent>

            {/* Status Badges */}
            <TabsContent value="badges" className="px-5 py-4">
              <p className="text-xs text-gray-400 mb-3">Background and text colour for each status badge</p>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-3 mb-1">Deal Statuses</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "New",         bgVar: "--status-deal-new-bg",         textVar: "--status-deal-new-text" },
                  { label: "Review",      bgVar: "--status-deal-review-bg",      textVar: "--status-deal-review-text" },
                  { label: "In Progress", bgVar: "--status-deal-in_progress-bg", textVar: "--status-deal-in_progress-text" },
                  { label: "Ready",       bgVar: "--status-deal-ready-bg",       textVar: "--status-deal-ready-text" },
                  { label: "Listed",      bgVar: "--status-deal-listed-bg",      textVar: "--status-deal-listed-text" },
                  { label: "Reserved",    bgVar: "--status-deal-reserved-bg",    textVar: "--status-deal-reserved-text" },
                  { label: "Sold",        bgVar: "--status-deal-sold-bg",        textVar: "--status-deal-sold-text" },
                  { label: "Archived",    bgVar: "--status-deal-archived-bg",    textVar: "--status-deal-archived-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-4 mb-1">Pipeline Stages</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "New Lead",            bgVar: "--status-pipeline-new_lead-bg",            textVar: "--status-pipeline-new_lead-text" },
                  { label: "AI Conversation",     bgVar: "--status-pipeline-ai_conversation-bg",     textVar: "--status-pipeline-ai_conversation-text" },
                  { label: "Deal Validation",     bgVar: "--status-pipeline-deal_validation-bg",     textVar: "--status-pipeline-deal_validation-text" },
                  { label: "Offer Made",          bgVar: "--status-pipeline-offer_made-bg",          textVar: "--status-pipeline-offer_made-text" },
                  { label: "Offer Accepted",      bgVar: "--status-pipeline-offer_accepted-bg",      textVar: "--status-pipeline-offer_accepted-text" },
                  { label: "Offer Rejected",      bgVar: "--status-pipeline-offer_rejected-bg",      textVar: "--status-pipeline-offer_rejected-text" },
                  { label: "Video Sent",          bgVar: "--status-pipeline-video_sent-bg",          textVar: "--status-pipeline-video_sent-text" },
                  { label: "Retry 1",             bgVar: "--status-pipeline-retry_1-bg",             textVar: "--status-pipeline-retry_1-text" },
                  { label: "Retry 2",             bgVar: "--status-pipeline-retry_2-bg",             textVar: "--status-pipeline-retry_2-text" },
                  { label: "Retry 3",             bgVar: "--status-pipeline-retry_3-bg",             textVar: "--status-pipeline-retry_3-text" },
                  { label: "Paperwork Sent",      bgVar: "--status-pipeline-paperwork_sent-bg",      textVar: "--status-pipeline-paperwork_sent-text" },
                  { label: "Ready for Investors", bgVar: "--status-pipeline-ready_for_investors-bg", textVar: "--status-pipeline-ready_for_investors-text" },
                  { label: "Dead Lead",           bgVar: "--status-pipeline-dead_lead-bg",           textVar: "--status-pipeline-dead_lead-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-4 mb-1">Contact Types</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "Solicitor",        bgVar: "--status-contact-solicitor-bg",         textVar: "--status-contact-solicitor-text" },
                  { label: "Investor Contact", bgVar: "--status-contact-investor_contact-bg",   textVar: "--status-contact-investor_contact-text" },
                  { label: "Vendor Contact",   bgVar: "--status-contact-vendor_contact-bg",     textVar: "--status-contact-vendor_contact-text" },
                  { label: "Estate Agent",     bgVar: "--status-contact-estate_agent-bg",       textVar: "--status-contact-estate_agent-text" },
                  { label: "Contractor",       bgVar: "--status-contact-contractor-bg",         textVar: "--status-contact-contractor-text" },
                  { label: "Other",            bgVar: "--status-contact-other-bg",              textVar: "--status-contact-other-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>
            </TabsContent>

            {/* Typography */}
            <TabsContent value="typography" className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">Font size and heading weight</p>
              <SegmentRow
                label="Base font size"
                varName="--font-size-base"
                options={[
                  { label: "Small (12px)", value: "12px" },
                  { label: "Normal (14px)", value: "14px" },
                  { label: "Large (16px)", value: "16px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Heading weight"
                varName="--font-weight-heading"
                options={[
                  { label: "Normal (400)", value: "400" },
                  { label: "Medium (600)", value: "600" },
                  { label: "Bold (700)", value: "700" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Spacing */}
            <TabsContent value="spacing" className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">Page, card, and table density</p>
              <SegmentRow
                label="Page padding"
                varName="--page-padding"
                options={[
                  { label: "Compact (20px)", value: "20px" },
                  { label: "Normal (32px)", value: "32px" },
                  { label: "Spacious (48px)", value: "48px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Card padding"
                varName="--card-padding"
                options={[
                  { label: "Compact (16px)", value: "16px" },
                  { label: "Normal (24px)", value: "24px" },
                  { label: "Spacious (32px)", value: "32px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Section gap"
                varName="--section-gap"
                options={[
                  { label: "Compact (12px)", value: "12px" },
                  { label: "Normal (20px)", value: "20px" },
                  { label: "Spacious (28px)", value: "28px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Table row height"
                varName="--table-row-height"
                options={[
                  { label: "Compact (40px)", value: "40px" },
                  { label: "Normal (52px)", value: "52px" },
                  { label: "Comfortable (64px)", value: "64px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
            </TabsContent>

            {/* KPI Colours */}
            {/* NOTE: The spec mentions a "Neutral colour" in this tab but defines no CSS variable for it
                in the Token Reference table. It is intentionally omitted here — add if a --value-neutral
                variable is ever formalised. */}
            <TabsContent value="kpi" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">Colours used for KPI values in the dashboard</p>
              <ColorRow label="Positive (gains, yield)" varName="--value-positive"  tokens={tokens} onChange={handleChange} />
              <ColorRow label="Negative (losses)"       varName="--value-negative"  tokens={tokens} onChange={handleChange} />
              <ColorRow label="Highlight (primary KPI)" varName="--value-highlight" tokens={tokens} onChange={handleChange} />
            </TabsContent>
          </Tabs>

          {/* Save / Reset */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--ds-border)]">
            <Button onClick={handleSave} disabled={saving} className="btn-primary h-9">
              {saving ? "Saving…" : "Save Appearance"}
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-9">
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* ── Sticky Live Preview ── */}
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Preview</p>
          <ThemePreview tokens={tokens} />
          <p className="text-xs text-gray-400 mt-2">
            Changes preview instantly. Click "Save Appearance" to persist.
          </p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Fix any errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/settings/appearance/page.tsx
git commit -m "feat: add theme picker appearance settings page"
```

---

### Task 9: Update `app/dashboard/settings/page.tsx` — add Appearance card

**Files:**
- Modify: `app/dashboard/settings/page.tsx`

- [ ] **Step 1: Add Palette import**

Find the last entry in the Lucide import block (`FlaskConical`). Replace:
```tsx
  FlaskConical,
} from "lucide-react"
```
With:
```tsx
  FlaskConical,
  Palette,
} from "lucide-react"
```

- [ ] **Step 2: Add the Appearance navigation card**

Find this exact comment (which anchors the Company Profile card):
```tsx
      {/* Company Profile */}
```
Insert the entire Appearance card block immediately BEFORE that line:

```tsx
{/* Appearance */}
<div className="ds-card p-5 flex items-center gap-4">
  <div className="shrink-0 p-2 rounded-lg bg-violet-50">
    <Palette className="h-5 w-5 text-violet-600" />
  </div>
  <div className="flex-1 min-w-0">
    <p className="text-sm font-semibold text-gray-900">Appearance</p>
    <p className="text-xs text-gray-400 mt-0.5">
      Customise fonts, colours, spacing, and badge styles for your dashboard
    </p>
    <p className="text-xs text-gray-400 mt-0.5">
      Changes are saved per-user and apply across all devices
    </p>
  </div>
  <Link href="/dashboard/settings/appearance" className="shrink-0">
    <Button className="btn-primary h-9">
      <Palette className="h-4 w-4 mr-2" />
      Customise
    </Button>
  </Link>
</div>
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 4: Final TypeScript check**

```bash
npx tsc --noEmit
```

Expected: zero errors across the entire project.

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/settings/page.tsx
git commit -m "feat: add Appearance navigation card to settings page"
```

---

## Smoke test

After all 9 tasks are committed:

```bash
npm run dev
```

1. Navigate to `/dashboard/settings` — Appearance card visible at the top of the navigation cards
2. Click "Customise" → `/dashboard/settings/appearance` — page loads, tabs visible, controls populated
3. Change sidebar background colour → preview sidebar strip updates immediately
4. Change a deal status badge colour → preview badge in the Badge row updates immediately
5. Click "Save Appearance" → toast "Appearance saved" shown
6. Reload page → saved colours persist in the controls
7. Navigate to `/dashboard/deals` — status badges use the saved colours
8. Navigate to `/dashboard/vendor-leads` — pipeline stage badges use the saved colours
9. Navigate to `/dashboard/contacts` — contact type badges use the saved colours
10. Click "Reset to Defaults" → controls reset, toast shown, re-save then reload to confirm
