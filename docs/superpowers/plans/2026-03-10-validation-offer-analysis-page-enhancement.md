# Validation & Offer Analysis Page Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Validation and Offer Analysis list pages to match the Comparables operational hub pattern — replacing row-click navigation with popup Dialogs containing existing panel components and adding inline quick-action buttons.

**Architecture:** Each page has a Server Component (Prisma fetch + serialisation) and a Client Component (filter chips, table, Dialog, quick actions). The Validation popup fetches the full lead on open via `GET /api/vendor-leads/[id]` then renders `VendorValidationPanel`. The Offer Analysis popup constructs `OfferAnalysisPanel` directly from list-level data (no extra fetch needed, since extra fields are added to the server query). All row state updates are local (no page reload).

**Tech Stack:** Next.js 14 App Router (Server + Client), Prisma 5, TypeScript, Tailwind CSS, shadcn/ui (Dialog, Button), Lucide React, Sonner toasts, date-fns.

**Spec:** `docs/superpowers/specs/2026-03-10-validation-offer-analysis-page-design.md`

---

## File Structure

| Action | Path |
|--------|------|
| Rewrite | `app/dashboard/validation/page.tsx` |
| Rewrite | `app/dashboard/validation/validation-list-client.tsx` |
| Rewrite | `app/dashboard/offer-analysis/page.tsx` |
| Rewrite | `app/dashboard/offer-analysis/offer-list-client.tsx` |

---

## Chunk 1: Validation Page

---

### Task 1: Validation server component — ensure all fields are serialised

**Files:**
- Rewrite: `app/dashboard/validation/page.tsx`

The current file selects the right fields but may pass `Date` and `Decimal` objects to the client. Replace the whole file to guarantee correct serialisation.

- [ ] **Step 1: Read the current file**

```bash
cat /mnt/c/Users/henry/Projects/deal-sourcing-saas/app/dashboard/validation/page.tsx
```

Note how it currently calls `ValidationListClient` and what fields it selects. The replacement below keeps the same select but adds explicit serialisation.

- [ ] **Step 2: Replace `app/dashboard/validation/page.tsx`**

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ValidationListClient } from "./validation-list-client"

export const metadata = { title: "Validation — DealStack" }
export const dynamic = "force-dynamic"

export default async function ValidationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      bmvScore: true,
      validationPassed: true,
      validatedAt: true,
      pipelineStage: true,
      motivationScore: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const serialised = leads.map((l) => ({
    ...l,
    askingPrice:          l.askingPrice ? Number(l.askingPrice) : null,
    estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
    bmvScore:             l.bmvScore ? Number(l.bmvScore) : null,
    validatedAt:          l.validatedAt?.toISOString() ?? null,
  }))

  return <ValidationListClient leads={serialised as any} />
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```

Expected: zero errors in source files (`.next/types` errors are pre-existing — ignore).

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && git add app/dashboard/validation/page.tsx && git commit -m "feat: extend validation server page with proper field serialisation"
```

---

### Task 2: Validation client component — full rewrite with popup and Calc BMV

**Files:**
- Rewrite: `app/dashboard/validation/validation-list-client.tsx`

**Key imports to know:**
- `VendorValidationPanel` — `@/app/dashboard/vendors/[id]/validation/vendor-validation-panel`
  > Note: `[id]` is a literal directory name. TypeScript resolves it fine as a regular import path.
  > Prop: `initialLead` (NOT `lead`) — confirmed from source: `export function VendorValidationPanel({ initialLead }: { initialLead: Lead })`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` — `@/components/ui/dialog`
- `Button` — `@/components/ui/button`
- `Input` — `@/components/ui/input`
- `formatCurrency` — `@/lib/format`
- `formatDistanceToNow` — `date-fns`
- `cn` — `@/lib/utils`
- `toast` — `sonner`
- Icons — `Search`, `ClipboardCheck`, `Calculator`, `Loader2` from `lucide-react`

**API calls:**
- Popup: `GET /api/vendor-leads/[id]` — returns full lead object
- Calc BMV: `POST /api/vendor-leads/[id]/calculate-bmv` — returns `{ success: true, data: { bmvScore, validationPassed, validationNotes, ... } }`
  - `validatedAt` is NOT in the response — always synthesise as `new Date().toISOString()`

- [ ] **Step 1: Replace `app/dashboard/validation/validation-list-client.tsx`**

```tsx
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VendorValidationPanel } from "@/app/dashboard/vendors/[id]/validation/vendor-validation-panel"
import { Search, ClipboardCheck, Calculator, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  bmvScore: number | null
  validationPassed: boolean | null
  validatedAt: string | null   // ISO string
  pipelineStage: string
  motivationScore: number | null
}

// ── Validation badge ──────────────────────────────────────────────────────────

function ValidationBadge({ passed }: { passed: boolean | null }) {
  if (passed === true) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200">
        Passed
      </span>
    )
  }
  if (passed === false) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border-red-200">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
      Pending
    </span>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const STATUS_CHIPS = ["All", "Passed", "Failed", "Pending"] as const
type StatusChip = typeof STATUS_CHIPS[number]

// ── Component ─────────────────────────────────────────────────────────────────

export function ValidationListClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusChip>("All")
  const [calcingId, setCalcingId] = useState<string | null>(null)
  const [popupLeadId, setPopupLeadId] = useState<string | null>(null)
  const [popupLeadData, setPopupLeadData] = useState<any>(null)
  const [popupLoading, setPopupLoading] = useState(false)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      if (q) {
        const match =
          l.vendorName.toLowerCase().includes(q) ||
          (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
          (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      switch (statusFilter) {
        case "Passed":  return l.validationPassed === true
        case "Failed":  return l.validationPassed === false
        case "Pending": return l.validationPassed === null
        default:        return true
      }
    })
  }, [leads, search, statusFilter])

  // ── Popup open ─────────────────────────────────────────────────────────────
  const handleOpenValidate = async (lead: Lead) => {
    setPopupLeadId(lead.id)
    setPopupLeadData(null)
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}`)
      const data = await res.json()
      setPopupLeadData(data)
    } catch {
      toast.error("Failed to load lead data")
      setPopupLeadId(null)
    } finally {
      setPopupLoading(false)
    }
  }

  // ── Calc BMV ───────────────────────────────────────────────────────────────
  const handleCalcBMV = async (lead: Lead) => {
    setCalcingId(lead.id)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? "Calculation failed")
      // Response shape: { success: true, data: { bmvScore, validationPassed, ... } }
      // validatedAt is NOT returned — synthesise it
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                bmvScore:         data.data?.bmvScore ?? l.bmvScore,
                validationPassed: data.data?.validationPassed ?? l.validationPassed,
                validatedAt:      new Date().toISOString(),
              }
            : l
        )
      )
      toast.success("BMV calculated successfully")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCalcingId(null)
    }
  }

  const popupMeta = popupLeadId ? leads.find((l) => l.id === popupLeadId) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validation</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review and manage property deal validation for all vendor leads
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setStatusFilter(chip)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              statusFilter === chip
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} leads</span>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No leads match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asking Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Market Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">BMV</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Validated</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="table-row group">
                    {/* Vendor */}
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                          {lead.vendorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                      </div>
                    </td>

                    {/* Property */}
                    <td className="table-cell">
                      <p className="text-sm text-gray-700 line-clamp-1">
                        {lead.propertyAddress
                          ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                          : <span className="text-gray-400">—</span>}
                      </p>
                    </td>

                    {/* Asking Price */}
                    <td className="table-cell">
                      <span className="text-sm font-medium text-gray-900">
                        {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Market Value */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-700">
                        {lead.estimatedMarketValue ? formatCurrency(lead.estimatedMarketValue) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* BMV */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-700">
                        {lead.bmvScore != null ? `${lead.bmvScore}%` : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <ValidationBadge passed={lead.validationPassed} />
                    </td>

                    {/* Last Validated */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-500">
                        {lead.validatedAt
                          ? formatDistanceToNow(new Date(lead.validatedAt), { addSuffix: true })
                          : <span className="text-gray-400">Never</span>}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenValidate(lead)}
                          className="gap-1.5"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Validate
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCalcBMV(lead)}
                          disabled={calcingId === lead.id}
                          className="gap-1.5"
                        >
                          {calcingId === lead.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Calculator className="h-3.5 w-3.5" />}
                          Calc BMV
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation popup */}
      <Dialog
        open={!!popupLeadId}
        onOpenChange={(open) => {
          if (!open) { setPopupLeadId(null); setPopupLeadData(null) }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Validation — {popupMeta?.propertyAddress ?? popupMeta?.vendorName}
            </DialogTitle>
          </DialogHeader>
          {popupLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {!popupLoading && popupLeadData && (
            <VendorValidationPanel initialLead={popupLeadData as any} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

> **Import note:** `VendorValidationPanel` is imported from `@/app/dashboard/vendors/[id]/validation/vendor-validation-panel`. The `[id]` is a literal directory name on disk — TypeScript resolves it as a regular import path.

> **TypeScript note:** `popupLeadData` is typed as `any` because the API returns the full lead with many fields not in the list-level `Lead` interface. The `as any` cast on `initialLead` is intentional and safe.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -30
```

Common issues to fix:
- If `ClipboardCheck` doesn't exist in lucide-react, try `ClipboardList` or `ClipboardDocumentCheck` (check with `grep -r "ClipboardCheck" node_modules/lucide-react/dist/` or just try `ClipboardList`)
- If `VendorValidationPanel` import causes issues due to the `[id]` path, check the actual component file's export name and adjust

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && git add app/dashboard/validation/validation-list-client.tsx && git commit -m "feat: enhance validation page with popup, Calc BMV action, and status badges"
```

---

## Chunk 2: Offer Analysis Page

---

### Task 3: Offer Analysis server component — add extra fields for popup

**Files:**
- Rewrite: `app/dashboard/offer-analysis/page.tsx`

Add `estimatedMonthlyRent`, `estimatedRefurbCost`, `dealId`, `vendorEmail`, `vendorPhone`, `validationNotes` to the Prisma select. These are used to construct `OfferAnalysisPanel` props directly from list data (no extra fetch on popup open).

- [ ] **Step 1: Read the current file**

```bash
cat /mnt/c/Users/henry/Projects/deal-sourcing-saas/app/dashboard/offer-analysis/page.tsx
```

Note the current Prisma select and any preprocessing logic (the current page also computes `missingInputsHint` — this is moved to the client component in the new version).

- [ ] **Step 2: Replace `app/dashboard/offer-analysis/page.tsx`**

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { OfferListClient } from "./offer-list-client"

export const metadata = { title: "Offer Analysis — DealStack" }
export const dynamic = "force-dynamic"

export default async function OfferAnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      vendorEmail: true,
      vendorPhone: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedMonthlyRent: true,
      estimatedRefurbCost: true,
      bmvScore: true,
      offerAmount: true,
      offerPercentage: true,
      offerSentAt: true,
      offerAcceptedAt: true,
      offerRejectedAt: true,
      dealId: true,
      validationNotes: true,
      pipelineStage: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const serialised = leads.map((l) => ({
    ...l,
    askingPrice:          l.askingPrice ? Number(l.askingPrice) : null,
    estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
    estimatedMonthlyRent: l.estimatedMonthlyRent ? Number(l.estimatedMonthlyRent) : null,
    estimatedRefurbCost:  l.estimatedRefurbCost ? Number(l.estimatedRefurbCost) : null,
    bmvScore:             l.bmvScore ? Number(l.bmvScore) : null,
    offerAmount:          l.offerAmount ? Number(l.offerAmount) : null,
    offerPercentage:      l.offerPercentage ? Number(l.offerPercentage) : null,
    offerSentAt:          l.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:      l.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:      l.offerRejectedAt?.toISOString() ?? null,
  }))

  return <OfferListClient leads={serialised as any} />
}
```

> **Note:** If any of the new fields (`vendorEmail`, `vendorPhone`, `estimatedMonthlyRent`, `estimatedRefurbCost`) don't exist on `VendorLead` in `prisma/schema.prisma`, remove them from the select and the serialised map. Check the schema at lines ~900–970 of `prisma/schema.prisma`.

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && git add app/dashboard/offer-analysis/page.tsx && git commit -m "feat: extend offer analysis server page with extra fields for popup"
```

---

### Task 3b: Patch PATCH route Zod schema to accept offer decision timestamps

**Files:**
- Modify: `app/api/vendor-leads/[id]/route.ts`

The `handleDecision` function in the client sends `PATCH /api/vendor-leads/[id]` with `{ offerAcceptedAt: ISO_string }` or `{ offerRejectedAt: ISO_string }`. Zod's default behaviour (`strip`) silently drops unknown fields — so without this fix, Accept/Reject will show a success toast but never write to the database.

- [ ] **Step 1: Read the current Zod schema in the PATCH route**

```bash
grep -n "offerAccept\|offerReject\|z\.string\|updateVendorLead" /mnt/c/Users/henry/Projects/deal-sourcing-saas/app/api/vendor-leads/[id]/route.ts | head -40
```

Find the `updateVendorLeadSchema` definition (around lines 12-39) and look for whether `offerAcceptedAt` or `offerRejectedAt` are already present.

- [ ] **Step 2: Add the two fields to the Zod schema**

In `app/api/vendor-leads/[id]/route.ts`, find the `updateVendorLeadSchema = z.object({...})` and add these two lines inside the object:

```ts
offerAcceptedAt:  z.string().datetime().optional().nullable(),
offerRejectedAt:  z.string().datetime().optional().nullable(),
```

Use `Edit` to add them near the other offer-related fields (search for `offerSentAt` or `offerAmount` to find the right place).

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```

- [ ] **Step 4: Commit**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && git add "app/api/vendor-leads/[id]/route.ts" && git commit -m "fix: add offerAcceptedAt and offerRejectedAt to vendor lead PATCH schema"
```

---

### Task 4: Offer Analysis client component — full rewrite with popup and Accept/Reject

**Files:**
- Rewrite: `app/dashboard/offer-analysis/offer-list-client.tsx`

**Key imports to know:**
- `OfferAnalysisPanel` — `@/components/deals/offer-analysis-panel`
  > Confirmed props: `vendorLeadId`, `dealId?`, `askingPrice`, `gdv`, `estimatedRent?`, `totalRefurbishment?`, `missingInputsHint?`, `vendorName`, `vendorEmail?`, `vendorPhone?`, `onOfferSent?`, `onReject?`, `readOnly?`
  > `onOfferSent` signature: `(offerPrice: number, strategy: "flip" | "hold", round: number) => void`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` — `@/components/ui/dialog`
- `Button` — `@/components/ui/button`
- `Input` — `@/components/ui/input`
- `formatCurrency` — `@/lib/format`
- `formatDistanceToNow` — `date-fns`
- `cn` — `@/lib/utils`
- `toast` — `sonner`
- Icons — `Search`, `BarChart3`, `CheckCircle2`, `XCircle` from `lucide-react`

**API call for Accept/Reject:**
- `PATCH /api/vendor-leads/[id]` with body `{ offerAcceptedAt: ISO_string }` or `{ offerRejectedAt: ISO_string }`

- [ ] **Step 1: Replace `app/dashboard/offer-analysis/offer-list-client.tsx`**

```tsx
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import { Search, BarChart3, CheckCircle2, XCircle } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  vendorName: string
  vendorEmail: string | null
  vendorPhone: string        // non-nullable in schema (@map("vendor_phone") String)
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  estimatedMonthlyRent: number | null
  estimatedRefurbCost: number | null
  bmvScore: number | null
  offerAmount: number | null
  offerPercentage: number | null
  offerSentAt: string | null
  offerAcceptedAt: string | null
  offerRejectedAt: string | null
  dealId: string | null
  validationNotes: string | null
  pipelineStage: string
}

// ── Offer status badge ────────────────────────────────────────────────────────

function OfferStatusBadge({ lead }: { lead: Lead }) {
  if (lead.offerAcceptedAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200">
        Accepted
      </span>
    )
  }
  if (lead.offerRejectedAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border-red-200">
        Rejected
      </span>
    )
  }
  if (lead.offerSentAt) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-700 border-amber-200">
        Awaiting
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
      No Offer
    </span>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const STATUS_CHIPS = ["All", "No Offer", "Sent", "Accepted", "Rejected"] as const
type StatusChip = typeof STATUS_CHIPS[number]

// ── Missing inputs hint ───────────────────────────────────────────────────────

function getMissingInputsHint(lead: Lead): string | undefined {
  if (!lead.estimatedMarketValue || !lead.estimatedRefurbCost) {
    return "Complete validation first to get market value and refurb cost."
  }
  return undefined
}

// ── Component ─────────────────────────────────────────────────────────────────

export function OfferListClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusChip>("All")
  const [decidingId, setDecidingId] = useState<string | null>(null)
  const [popupLead, setPopupLead] = useState<Lead | null>(null)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      if (q) {
        const match =
          l.vendorName.toLowerCase().includes(q) ||
          (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
          (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      switch (statusFilter) {
        case "No Offer":  return !l.offerSentAt && !l.offerAcceptedAt && !l.offerRejectedAt
        case "Sent":      return !!l.offerSentAt && !l.offerAcceptedAt && !l.offerRejectedAt
        case "Accepted":  return !!l.offerAcceptedAt
        case "Rejected":  return !!l.offerRejectedAt
        default:          return true
      }
    })
  }, [leads, search, statusFilter])

  // ── Accept / Reject ────────────────────────────────────────────────────────
  const handleDecision = async (lead: Lead, decision: "accept" | "reject") => {
    setDecidingId(lead.id)
    const field = decision === "accept" ? "offerAcceptedAt" : "offerRejectedAt"
    const value = new Date().toISOString()
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      })
      if (!res.ok) throw new Error("Failed to update offer status")
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, [field]: value } : l))
      )
      toast.success(decision === "accept" ? "Offer accepted" : "Offer rejected")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDecidingId(null)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Offer Analysis</h1>
        <p className="text-sm text-gray-400 mt-1">
          Analyse and manage property offers across all vendor leads
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setStatusFilter(chip)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              statusFilter === chip
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} leads</span>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No leads match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asking Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">BMV</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Offer Sent</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => {
                  const awaitingDecision =
                    !!lead.offerSentAt && !lead.offerAcceptedAt && !lead.offerRejectedAt
                  return (
                    <tr key={lead.id} className="table-row group">
                      {/* Vendor */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                            {lead.vendorName.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                        </div>
                      </td>

                      {/* Property */}
                      <td className="table-cell">
                        <p className="text-sm text-gray-700 line-clamp-1">
                          {lead.propertyAddress
                            ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                            : <span className="text-gray-400">—</span>}
                        </p>
                      </td>

                      {/* Asking Price */}
                      <td className="table-cell">
                        <span className="text-sm font-medium text-gray-900">
                          {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Offer Amount */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-700">
                          {lead.offerAmount ? formatCurrency(lead.offerAmount) : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* BMV */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-700">
                          {lead.bmvScore != null ? `${lead.bmvScore}%` : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <OfferStatusBadge lead={lead} />
                      </td>

                      {/* Offer Sent */}
                      <td className="table-cell">
                        <span className="text-sm text-gray-500">
                          {lead.offerSentAt
                            ? formatDistanceToNow(new Date(lead.offerSentAt), { addSuffix: true })
                            : <span className="text-gray-400">—</span>}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setPopupLead(lead)}
                            disabled={decidingId === lead.id}
                            className="gap-1.5"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Offer Analysis
                          </Button>

                          {awaitingDecision && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecision(lead, "accept")}
                                disabled={decidingId === lead.id}
                                className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDecision(lead, "reject")}
                                disabled={decidingId === lead.id}
                                className="gap-1.5 text-red-500 border-red-200 hover:bg-red-50"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Offer Analysis popup */}
      <Dialog open={!!popupLead} onOpenChange={(open) => { if (!open) setPopupLead(null) }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Offer Analysis — {popupLead?.propertyAddress ?? popupLead?.vendorName}
            </DialogTitle>
          </DialogHeader>
          {popupLead && (
            <OfferAnalysisPanel
              vendorLeadId={popupLead.id}
              dealId={popupLead.dealId ?? undefined}
              askingPrice={popupLead.askingPrice ?? 0}
              gdv={popupLead.estimatedMarketValue ?? 0}
              estimatedRent={popupLead.estimatedMonthlyRent ?? undefined}
              totalRefurbishment={popupLead.estimatedRefurbCost ?? undefined}
              missingInputsHint={getMissingInputsHint(popupLead)}
              vendorName={popupLead.vendorName}
              vendorEmail={popupLead.vendorEmail ?? undefined}
              vendorPhone={popupLead.vendorPhone ?? undefined}
              onOfferSent={(offerPrice, _strategy, _round) => {
                setLeads((prev) =>
                  prev.map((l) =>
                    l.id === popupLead.id
                      ? { ...l, offerSentAt: new Date().toISOString(), offerAmount: offerPrice }
                      : l
                  )
                )
              }}
              onReject={() => {
                setLeads((prev) =>
                  prev.map((l) =>
                    l.id === popupLead.id
                      ? { ...l, offerRejectedAt: new Date().toISOString() }
                      : l
                  )
                )
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -30
```

Common issues to fix:
- If `OfferAnalysisPanel` doesn't exist at `@/components/deals/offer-analysis-panel`, search with: `find /mnt/c/Users/henry/Projects/deal-sourcing-saas/components -name "offer-analysis*"`
- If `offerAmount` is not in the lead's schema for the PATCH endpoint, check `app/api/vendor-leads/[id]/route.ts` to confirm `offerAcceptedAt` and `offerRejectedAt` are accepted fields

- [ ] **Step 3: Commit**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && git add app/dashboard/offer-analysis/offer-list-client.tsx && git commit -m "feat: enhance offer analysis page with popup, Accept/Reject actions, and status badges"
```

---

## Verification Checklist

### Validation
- [ ] `/dashboard/validation` loads with Vendor, Property, Asking Price, Market Value, BMV, Status, Last Validated, Actions columns
- [ ] Row click does NOT navigate — only the "Validate" button opens the Dialog
- [ ] "Validate" button opens Dialog, shows spinner while fetching, then renders `VendorValidationPanel`
- [ ] "Calc BMV" button shows loading spinner, calls the API, updates the row's BMV score and status badge without page reload
- [ ] Validation status badges: Passed (emerald), Failed (red), Pending (gray)
- [ ] Filter chips (All/Passed/Failed/Pending) filter the table correctly
- [ ] Empty state messages show correctly

### Offer Analysis
- [ ] `/dashboard/offer-analysis` loads with Vendor, Property, Asking Price, Offer Amount, BMV, Status, Offer Sent, Actions columns
- [ ] Row click does NOT navigate — only the "Offer Analysis" button opens the Dialog
- [ ] `OfferAnalysisPanel` renders inside Dialog with correct calculated props
- [ ] `onOfferSent` updates the row's offer status to "Awaiting" and sets the offer amount
- [ ] Accept/Reject buttons only appear for leads with `offerSentAt` and no decision yet
- [ ] Accepting/Rejecting updates the row's status badge without page reload
- [ ] Offer status badges: Accepted (emerald), Rejected (red), Awaiting (amber), No Offer (gray)
- [ ] Filter chips (All/No Offer/Sent/Accepted/Rejected) filter correctly
- [ ] No TypeScript errors
