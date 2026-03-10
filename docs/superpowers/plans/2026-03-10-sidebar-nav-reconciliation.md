# Sidebar Navigation Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three navigation problems — dead code cleanup, active section state bug, and missing Board + Portal Check routes (including wiring the built-but-unconnected PortalCheckDetailPanel into the modal).

**Architecture:** Changes are isolated to navigation config, sidebar context, and vendor feature files. The board page reuses `UnifiedVendorsView` with a new `defaultView` prop. The portal check flow adds an `initialTab` prop to the existing modal, a new list page, and a new client table component. No new APIs needed — the portal check page fetches directly via Prisma in a server component.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma, shadcn/ui Tabs, Tailwind CSS, date-fns

---

## Chunk 1: Dead code removal + nav href fixes

### Task 1: Delete dead sidebar files

**Files:**
- Delete: `components/dashboard/sidebar.tsx`
- Delete: `components/layout/dual-sidebar.tsx`
- Delete: `lib/navigation.ts`

- [ ] **Step 1: Verify these files are not imported anywhere**

```bash
grep -r "components/dashboard/sidebar" /mnt/c/Users/henry/Projects/deal-sourcing-saas/app /mnt/c/Users/henry/Projects/deal-sourcing-saas/components --include="*.tsx" --include="*.ts"
grep -r "layout/dual-sidebar" /mnt/c/Users/henry/Projects/deal-sourcing-saas/app /mnt/c/Users/henry/Projects/deal-sourcing-saas/components --include="*.tsx" --include="*.ts"
grep -r "lib/navigation" /mnt/c/Users/henry/Projects/deal-sourcing-saas/app /mnt/c/Users/henry/Projects/deal-sourcing-saas/components --include="*.tsx" --include="*.ts"
```

Expected: zero matches for all three

- [ ] **Step 2: Delete the files**

```bash
rm /mnt/c/Users/henry/Projects/deal-sourcing-saas/components/dashboard/sidebar.tsx
rm /mnt/c/Users/henry/Projects/deal-sourcing-saas/components/layout/dual-sidebar.tsx
rm /mnt/c/Users/henry/Projects/deal-sourcing-saas/lib/navigation.ts
```

- [ ] **Step 3: Verify TypeScript still compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (or only pre-existing errors unrelated to deleted files)

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "chore: delete deprecated sidebar and navigation files"
```

---

### Task 2: Fix nav hrefs in config/navigation.ts

**Files:**
- Modify: `config/navigation.ts`

Two items in the Manage section have TODO fallbacks pointing to `/dashboard/vendors`. Update them.

- [ ] **Step 1: Update Board href**

Find:
```ts
{ label: "Board",        href: "/dashboard/vendors",  icon: Squares2X2Icon },  // TODO: dedicated board route
```
Replace with:
```ts
{ label: "Board",        href: "/dashboard/vendors/board",         icon: Squares2X2Icon },
```

- [ ] **Step 2: Update Portal Check href**

Find:
```ts
{ label: "Portal Check", href: "/dashboard/vendors",  icon: ShieldCheckIcon }, // TODO: dedicated portal check route
```
Replace with:
```ts
{ label: "Portal Check", href: "/dashboard/vendors/portal-check",  icon: ShieldCheckIcon },
```

- [ ] **Step 3: Commit**

```bash
git add config/navigation.ts && git commit -m "fix: update Board and Portal Check nav hrefs to dedicated routes"
```

---

## Chunk 2: Active state fix

### Task 3: Fix SidebarContext active state bug

**Files:**
- Modify: `context/SidebarContext.tsx`

**Root cause:** The `useEffect` unconditionally calls `getSectionIdFromPath(pathname)` on every route change, which returns the *first* section containing the URL. URLs that appear in multiple sections (e.g. `/dashboard/vendors` in both Invest and Manage) always resolve to the first section, ignoring the user's section choice.

**Fix:** Only reset `activeSectionId` when the current active section does not contain the new pathname.

- [ ] **Step 1: Add NAV_SECTIONS to the import**

In `context/SidebarContext.tsx`, find the import line:
```ts
import { getSectionIdFromPath } from "@/config/navigation"
```
Replace with:
```ts
import { getSectionIdFromPath, NAV_SECTIONS } from "@/config/navigation"
```

- [ ] **Step 2: Replace the useEffect**

Find:
```ts
useEffect(() => {
  setActiveSectionId(getSectionIdFromPath(pathname))
}, [pathname])
```
Replace with:
```ts
useEffect(() => {
  const currentSection = NAV_SECTIONS.find(s => s.id === activeSectionId)
  const currentOwnsPath = currentSection?.groups.some(g =>
    g.items.some(item =>
      pathname === item.href || pathname.startsWith(item.href + "/")
    )
  )
  if (!currentOwnsPath) {
    setActiveSectionId(getSectionIdFromPath(pathname))
  }
}, [pathname])
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 4: Manual verification in browser**

1. Navigate to `/dashboard/vendors` — Invest section should be active by default
2. Click the Manage section in the primary sidebar — secondary sidebar shows Manage items
3. Click "Leads" under Manage → Vendors — Manage section should stay highlighted (not reset to Invest)
4. Navigate to `/dashboard/settings` — Admin section should become active
5. Navigate back to `/dashboard/vendors` — should activate Invest (since current section, Admin, does not own that URL)

- [ ] **Step 5: Commit**

```bash
git add context/SidebarContext.tsx && git commit -m "fix: preserve active sidebar section when navigating to shared URLs"
```

---

## Chunk 3: Board route

### Task 4: Add defaultView prop to UnifiedVendorsView

**Files:**
- Modify: `components/vendors/unified-vendors-view.tsx`

`UnifiedVendorsView` currently reads the initial view from localStorage only. Add a `defaultView` prop that takes precedence on first render so the Board page can force board mode.

- [ ] **Step 1: Add the prop to the component signature**

Find:
```ts
export function UnifiedVendorsView() {
```
Replace with:
```ts
export function UnifiedVendorsView({ defaultView }: { defaultView?: "table" | "board" }) {
```

- [ ] **Step 2: Update the useEffect to respect the prop**

Find:
```ts
useEffect(() => {
  setIsClient(true)
  const savedView = localStorage.getItem("vendors-view-mode") as ViewMode
  if (savedView === "table" || savedView === "board") {
    setViewMode(savedView)
  }
}, [])
```
Replace with:
```ts
useEffect(() => {
  setIsClient(true)
  if (defaultView) {
    setViewMode(defaultView)
  } else {
    const savedView = localStorage.getItem("vendors-view-mode") as ViewMode
    if (savedView === "table" || savedView === "board") {
      setViewMode(savedView)
    }
  }
}, [])
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors

- [ ] **Step 4: Commit**

```bash
git add components/vendors/unified-vendors-view.tsx && git commit -m "feat: add defaultView prop to UnifiedVendorsView"
```

---

### Task 5: Create the Board page

**Files:**
- Create: `app/dashboard/vendors/board/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { UnifiedVendorsView } from "@/components/vendors/unified-vendors-view"

export const dynamic = "force-dynamic"

export default async function VendorsBoardPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }
  return <UnifiedVendorsView defaultView="board" />
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Manual verification**

Navigate to `/dashboard/vendors/board` — the page should load with the kanban board pre-selected (not the table). The Board nav item in the Manage section should highlight as active.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/vendors/board/page.tsx && git commit -m "feat: add /dashboard/vendors/board dedicated route"
```

---

## Chunk 4: Portal Check — modal tab

### Task 6: Wire PortalCheckDetailPanel into the vendor detail modal

**Files:**
- Modify: `components/vendors/vendor-lead-detail-modal.tsx`

`PortalCheckDetailPanel` (`components/vendors/portal-check-detail-panel.tsx`) is already built. It requires props: `leadId: string`, `latestCheckRisk: string | null`, `latestCheckedAt: string | null`, `onRiskUpdated?: (risk, date) => void`. The modal's local variable for the displayed lead is `currentLead` (line ~470: `const currentLead = fullLead || transformLead(lead)`).

- [ ] **Step 1: Add the import for PortalCheckDetailPanel**

In `vendor-lead-detail-modal.tsx`, add after the last local import:
```ts
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
```

- [ ] **Step 2: Verify ShieldCheck is already imported — no action needed**

`ShieldCheck` is already imported on its own line near the top of the file (around line 70):
```ts
import { ShieldCheck } from "lucide-react"
```
Do NOT add it again — a duplicate import will cause a TypeScript compile error (`TS2300: Duplicate identifier`). Simply confirm it is present and move on.

- [ ] **Step 3: Add initialTab prop to the interface**

Find:
```ts
interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}
```
Replace with:
```ts
interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
  initialTab?: "details" | "comparables" | "activity" | "portal-check"
}
```

- [ ] **Step 4: Destructure initialTab from props**

Find the function signature:
```ts
export function VendorLeadDetailModal({
  lead,
  open,
  onOpenChange,
  onUpdate,
}: VendorLeadDetailModalProps) {
```
Replace with:
```ts
export function VendorLeadDetailModal({
  lead,
  open,
  onOpenChange,
  onUpdate,
  initialTab,
}: VendorLeadDetailModalProps) {
```

- [ ] **Step 5: Wire initialTab into state**

Find:
```ts
const [activeTab, setActiveTab] = useState("details")
```
Replace with:
```ts
const [activeTab, setActiveTab] = useState(initialTab ?? "details")
```

- [ ] **Step 6: Expand tab grid from 3 to 4 columns**

Find:
```tsx
<TabsList className="grid w-full grid-cols-3 h-auto p-1 gap-0.5 bg-gray-50">
```
Replace with:
```tsx
<TabsList className="grid w-full grid-cols-4 h-auto p-1 gap-0.5 bg-gray-50">
```

- [ ] **Step 7: Add the Portal Check tab trigger**

After the closing `</TabsTrigger>` of the Activity tab, add:
```tsx
<TabsTrigger
  value="portal-check"
  className="flex flex-col gap-0.5 py-2 text-xs font-medium rounded-md transition-all
    hover:bg-gray-50 hover:text-[#2563EB] hover:shadow-sm
    data-[state=active]:bg-white data-[state=active]:text-[#2563EB] data-[state=active]:shadow-sm"
>
  <ShieldCheck className="h-3.5 w-3.5" />
  <span>Portal Check</span>
</TabsTrigger>
```

- [ ] **Step 8: Add the Portal Check tab content**

**Important — DOM vs trigger order:** shadcn Tabs matches triggers to content by the `value` attribute, not DOM position. The file's `TabsContent` blocks appear in a different order than the triggers (details → activity → comparables, not details → comparables → activity). Insert the new `TabsContent` after the very last `</TabsContent>` before `</Tabs>` — which is the comparables content block ending around line 1987. This is the correct and safe insertion point regardless of DOM order.

After the closing `</TabsContent>` of the comparables tab (the last TabsContent in the file), add:
```tsx
<TabsContent value="portal-check" className="space-y-4">
  <PortalCheckDetailPanel
    leadId={currentLead.id}
    latestCheckRisk={currentLead.latestCheckRisk ?? null}
    latestCheckedAt={
      currentLead.latestCheckedAt
        ? new Date(currentLead.latestCheckedAt).toISOString()
        : null
    }
    onRiskUpdated={() => onUpdate?.()}
  />
</TabsContent>
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. Common error to watch for: `latestCheckedAt` type — it may be `Date | null` on the model. Wrap in `new Date(...).toISOString()` as shown above.

- [ ] **Step 10: Manual verification**

1. Open the vendors list, click any vendor lead
2. A 4th tab "Portal Check" (with shield icon) should appear in the tab bar
3. Click it — the panel should render (may say "No check has been run yet")
4. The Re-run Check button should be functional

- [ ] **Step 11: Commit**

```bash
git add components/vendors/vendor-lead-detail-modal.tsx && git commit -m "feat: add Portal Check tab to vendor lead detail modal"
```

---

## Chunk 5: Portal Check — list page

### Task 7: Create the PortalCheckList client component

**Files:**
- Create: `components/vendors/portal-check-list.tsx`

A client component that renders a sortable table of all vendor leads, ordered by risk severity. Clicking a row opens `VendorLeadDetailModal` with `initialTab="portal-check"`.

Risk sort order: `red_flag` → `caution` → `clear` → `pending`/`running` → `null` (unchecked last).

- [ ] **Step 0: Export VendorLead from the modal**

The `VendorLead` interface is defined inside `vendor-lead-detail-modal.tsx` but is not currently exported. Add `export` to its declaration so `portal-check-list.tsx` can import it.

In `components/vendors/vendor-lead-detail-modal.tsx`, find the interface (it should now be near the top of the file after Task 6 edits):
```ts
interface VendorLead {
```
Add `export`:
```ts
export interface VendorLead {
```

- [ ] **Step 1: Create the component**

```tsx
// components/vendors/portal-check-list.tsx
"use client"

import { useState } from "react"
import { VendorLeadDetailModal, type VendorLead } from "./vendor-lead-detail-modal"
import { PortalCheckBadge } from "./portal-check-badge"
import { formatDistanceToNow } from "date-fns"
import { ShieldCheck } from "lucide-react"

const RISK_ORDER: Record<string, number> = {
  red_flag: 0,
  caution: 1,
  clear: 2,
  pending: 3,
  running: 3,
}

function riskSortValue(risk: string | null): number {
  if (!risk) return 4
  return RISK_ORDER[risk] ?? 4
}

interface PortalCheckListProps {
  leads: VendorLead[]
}

export function PortalCheckList({ leads }: PortalCheckListProps) {
  const [selectedLead, setSelectedLead] = useState<VendorLead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const sorted = [...leads].sort(
    (a, b) =>
      riskSortValue(a.latestCheckRisk ?? null) -
      riskSortValue(b.latestCheckRisk ?? null)
  )

  const handleRowClick = (lead: VendorLead) => {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  return (
    <>
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Last Checked
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => handleRowClick(lead)}
                  className="bg-white hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                    {lead.propertyAddress || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">
                    {lead.stage?.toLowerCase().replace(/_/g, " ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PortalCheckBadge
                      risk={lead.latestCheckRisk as any}
                      isMockData={lead.isTest}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {lead.latestCheckedAt
                      ? formatDistanceToNow(new Date(lead.latestCheckedAt as any), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <VendorLeadDetailModal
          lead={selectedLead}
          open={modalOpen}
          onOpenChange={setModalOpen}
          initialTab="portal-check"
        />
      )}
    </>
  )
}
```

**Note:** `VendorLead` is imported from `vendor-lead-detail-modal` after Step 0 exports it. There is no `types/vendor.ts` in this project — do not attempt to import from there.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Commit**

```bash
git add components/vendors/portal-check-list.tsx && git commit -m "feat: add PortalCheckList client component"
```

---

### Task 8: Create the Portal Check page

**Files:**
- Create: `app/dashboard/vendors/portal-check/page.tsx`

Server component. Fetches all vendor leads with their portal check fields from Prisma. Passes them to `PortalCheckList`. Schema confirms the fields are: `latestCheckRisk String?` and `latestCheckedAt DateTime?`.

- [ ] **Step 1: Determine which VendorLead fields the modal requires**

The modal is large and references many fields on `currentLead`. The safest approach is to fetch all columns (omit `select`) rather than listing every required field. If query performance is a concern, a `select` can be added later.

- [ ] **Step 2: Create the page**

```tsx
// app/dashboard/vendors/portal-check/page.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PortalCheckList } from "@/components/vendors/portal-check-list"
import { ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PortalCheckPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const leads = await prisma.vendorLead.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Serialize ALL Date objects to ISO strings — Next.js will throw
  // "Only plain objects can be passed to Client Components" for any Date that
  // crosses the server→client boundary. The VendorLead model has many DateTime
  // fields; serialize all of them here proactively.
  const serialized = leads.map((lead) => ({
    ...lead,
    createdAt:                       lead.createdAt.toISOString(),
    updatedAt:                       lead.updatedAt.toISOString(),
    latestCheckedAt:                 lead.latestCheckedAt?.toISOString() ?? null,
    validatedAt:                     lead.validatedAt?.toISOString() ?? null,
    offerSentAt:                     lead.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:                 lead.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:                 lead.offerRejectedAt?.toISOString() ?? null,
    nextRetryAt:                     lead.nextRetryAt?.toISOString() ?? null,
    videoSentAt:                     lead.videoSentAt?.toISOString() ?? null,
    lockoutAgreementSentAt:          lead.lockoutAgreementSentAt?.toISOString() ?? null,
    lockoutAgreementSignedAt:        lead.lockoutAgreementSignedAt?.toISOString() ?? null,
    lastContactAt:                   lead.lastContactAt?.toISOString() ?? null,
    conversationStartedAt:           lead.conversationStartedAt?.toISOString() ?? null,
    dealClosedAt:                    lead.dealClosedAt?.toISOString() ?? null,
    comparablesFetchedAt:            lead.comparablesFetchedAt?.toISOString() ?? null,
    lastInvestorPackGeneratedAt:     lead.lastInvestorPackGeneratedAt?.toISOString() ?? null,
    reservedAt:                      lead.reservedAt?.toISOString() ?? null,
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-6 w-6 text-gray-400" />
          <h1 className="text-3xl font-bold">Portal Check</h1>
        </div>
        <p className="text-gray-400">
          Portal and ownership risk status across all vendor leads
        </p>
      </div>
      <PortalCheckList leads={serialized as any} />
    </div>
  )
}
```

**Date serialization:** The `serialized` map converts all known `DateTime` fields from the Prisma `VendorLead` model. If TypeScript reports that a field in the map does not exist (because a field name changed in the schema), remove that entry. If a new DateTime field was added to the schema after this plan was written, add it to the map.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 4: Manual verification**

1. Navigate to `/dashboard/vendors/portal-check`
2. A table of all vendor leads appears, sorted by risk severity (Red Flag rows first)
3. Each row shows: address, stage, risk badge, last checked time
4. Clicking a row opens the vendor detail modal directly on the Portal Check tab
5. The "Portal Check" nav item in the Manage section highlights as active

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/vendors/portal-check/page.tsx && git commit -m "feat: add /dashboard/vendors/portal-check page"
```

---

## Final Verification

- [ ] **TypeScript clean build**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1
```

Expected: zero errors (or only pre-existing errors from before this work).

- [ ] **Full nav walkthrough**

| Route | Expected behaviour |
|-------|--------------------|
| Invest → Vendor Leads | `/dashboard/vendors` loads, Invest highlighted |
| Manage → Vendors → Board | `/dashboard/vendors/board` loads in kanban mode, Manage highlighted |
| Manage → Vendors → Portal Check | `/dashboard/vendors/portal-check` loads risk table, Manage highlighted |
| Click a row in portal check table | Modal opens on Portal Check tab |
| Navigate within Manage (e.g. Investors) | Manage section stays highlighted |
| Navigate to Settings | Admin section activates |
