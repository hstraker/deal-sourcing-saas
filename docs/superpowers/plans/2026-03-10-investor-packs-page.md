# Investor Packs Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new `/dashboard/investors/packs` page that shows every investor pack delivery — who received what, tracking status, and download/resend/view-deal actions — and update the nav to point to it instead of the template settings page.

**Architecture:** A Next.js Server Component fetches all `InvestorPackDelivery` records (joined with investor user, generation, and template) via Prisma, serialises DateTime/Decimal fields, and passes them to a client component. The client handles filtering, search, stats, and the Resend action (POST to `/api/investors/pack-delivery/[id]/resend`). The Download action opens the PDF via `/api/deals/[dealId]/investor-pack?token=[downloadToken]`.

**Tech Stack:** Next.js 14 App Router (Server + Client components), Prisma 5, TypeScript, Tailwind CSS, shadcn/ui (Button, Badge), Lucide React, Sonner toasts, `date-fns`.

---

## File Structure

| Action | Path |
|--------|------|
| Modify | `config/navigation.ts` — change Packs href |
| Create | `app/dashboard/investors/packs/page.tsx` — Server Component |
| Create | `components/investors/investor-packs-client.tsx` — Client Component |

---

## Task 1: Update nav href for "Packs"

**Files:**
- Modify: `config/navigation.ts`

The Investors group in the Manage section currently sends "Packs" to the template settings page. Update the href.

- [ ] **Step 1: Edit the href**

In `config/navigation.ts`, find the item `{ label: "Packs", href: "/dashboard/settings/investor-packs", ... }` (inside the `"manage"` section, `"Investors"` group) and change the href:

```ts
// BEFORE
{ label: "Packs", href: "/dashboard/settings/investor-packs", icon: DocumentDuplicateIcon },

// AFTER
{ label: "Packs", href: "/dashboard/investors/packs", icon: DocumentDuplicateIcon },
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add config/navigation.ts
git commit -m "feat: update Packs nav href to new investor packs delivery page"
```

---

## Task 2: Create `components/investors/investor-packs-client.tsx`

**Files:**
- Create: `components/investors/investor-packs-client.tsx`

This is the main client component. It accepts pre-fetched, serialised deliveries and handles filtering, search, stats display, and the Resend action.

### Data type

```ts
interface PackDelivery {
  id: string
  dealId: string
  deliveryMethod: string
  recipientEmail: string | null
  partNumber: number | null
  emailStatus: string | null
  sentAt: string            // always set (default now in DB)
  viewedAt: string | null
  downloadedAt: string | null
  viewCount: number
  downloadCount: number
  downloadToken: string | null
  investor: {
    user: {
      firstName: string | null
      lastName: string | null
      email: string
    }
  }
  generation: {
    propertyAddress: string
    askingPrice: number | null
    template: { name: string } | null
  } | null
}
```

### Steps

- [ ] **Step 1: Create the file**

Create `/mnt/c/Users/henry/Projects/deal-sourcing-saas/components/investors/investor-packs-client.tsx`:

```tsx
"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Download, RefreshCw, ExternalLink, Search,
  Package, Eye, TrendingUp, Calendar,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow, isAfter, subDays } from "date-fns"

// ── Types ─────────────────────────────────────────────────────────────────────

interface PackDelivery {
  id: string
  dealId: string
  deliveryMethod: string
  recipientEmail: string | null
  partNumber: number | null
  emailStatus: string | null
  sentAt: string
  viewedAt: string | null
  downloadedAt: string | null
  viewCount: number
  downloadCount: number
  downloadToken: string | null
  investor: {
    user: {
      firstName: string | null
      lastName: string | null
      email: string
    }
  }
  generation: {
    propertyAddress: string
    askingPrice: number | null
    template: { name: string } | null
  } | null
}

interface Props {
  deliveries: PackDelivery[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function investorName(d: PackDelivery): string {
  const { firstName, lastName, email } = d.investor.user
  return [firstName, lastName].filter(Boolean).join(" ") || email
}

function investorInitial(d: PackDelivery): string {
  return investorName(d).charAt(0).toUpperCase()
}

function statusLabel(d: PackDelivery): { label: string; cls: string } {
  if (d.downloadCount > 0)
    return { label: `Downloaded (${d.downloadCount})`, cls: "bg-emerald-100 text-emerald-700 border-emerald-200" }
  if (d.viewCount > 0)
    return { label: `Viewed (${d.viewCount})`, cls: "bg-blue-100 text-blue-700 border-blue-200" }
  if (d.emailStatus === "failed")
    return { label: "Failed", cls: "bg-red-100 text-red-700 border-red-200" }
  if (d.emailStatus === "no_smtp")
    return { label: "No SMTP", cls: "bg-amber-100 text-amber-700 border-amber-200" }
  return { label: "Sent", cls: "bg-gray-100 text-gray-600 border-gray-200" }
}

const STATUS_FILTERS = ["All", "Sent", "Viewed", "Downloaded"] as const
const METHOD_FILTERS = ["All", "Email", "Download", "Manual"] as const

// ── Component ─────────────────────────────────────────────────────────────────

export function InvestorPacksClient({ deliveries }: Props) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>("All")
  const [methodFilter, setMethodFilter] = useState<typeof METHOD_FILTERS[number]>("All")
  const [resendingId, setResendingId] = useState<string | null>(null)

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = deliveries.length
    const opened = deliveries.filter((d) => d.viewCount > 0).length
    const downloaded = deliveries.filter((d) => d.downloadCount > 0).length
    const thisWeek = deliveries.filter((d) =>
      d.sentAt && isAfter(new Date(d.sentAt), subDays(new Date(), 7))
    ).length
    return { total, opened, downloaded, thisWeek }
  }, [deliveries])

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return deliveries.filter((d) => {
      // Search
      if (q) {
        const name = investorName(d).toLowerCase()
        const email = d.investor.user.email.toLowerCase()
        const address = (d.generation?.propertyAddress ?? "").toLowerCase()
        if (!name.includes(q) && !email.includes(q) && !address.includes(q)) return false
      }
      // Status
      if (statusFilter === "Sent" && (d.viewCount > 0 || d.downloadCount > 0)) return false
      if (statusFilter === "Viewed" && d.viewCount === 0) return false
      if (statusFilter === "Downloaded" && d.downloadCount === 0) return false
      // Method
      if (methodFilter !== "All" && d.deliveryMethod.toLowerCase() !== methodFilter.toLowerCase()) return false
      return true
    })
  }, [deliveries, search, statusFilter, methodFilter])

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleDownload = (d: PackDelivery) => {
    if (!d.downloadToken) {
      toast.error("No download link available for this delivery.")
      return
    }
    window.open(`/api/deals/${d.dealId}/investor-pack?token=${d.downloadToken}`, "_blank")
  }

  const handleResend = async (d: PackDelivery) => {
    setResendingId(d.id)
    try {
      const res = await fetch(`/api/investors/pack-delivery/${d.id}/resend`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to resend")
      if (data.noSmtp) {
        toast.warning("SMTP not configured — pack was not emailed.")
      } else {
        toast.success("Pack re-sent successfully.")
      }
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setResendingId(null)
    }
  }

  const handleViewDeal = (d: PackDelivery) => {
    window.location.href = `/dashboard/deals/${d.dealId}`
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Investor Packs</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Track every investor pack delivery, view engagement, and resend packs
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Sent",    value: stats.total,      icon: Package,    color: "text-gray-600" },
          { label: "Opened",        value: stats.total > 0 ? `${Math.round((stats.opened / stats.total) * 100)}%` : "—",
            icon: Eye,     color: "text-blue-600" },
          { label: "Downloaded",    value: stats.total > 0 ? `${Math.round((stats.downloaded / stats.total) * 100)}%` : "—",
            icon: TrendingUp, color: "text-emerald-600" },
          { label: "Sent This Week", value: stats.thisWeek,  icon: Calendar,  color: "text-amber-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="ds-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn("h-4 w-4", color)} />
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search investor or property…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status chips */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                statusFilter === f
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Method chips */}
        <div className="flex gap-1.5 flex-wrap">
          {METHOD_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setMethodFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                methodFilter === f
                  ? "bg-gray-900 border-gray-900 text-white"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-400"
              )}
            >
              {f}
            </button>
          ))}
        </div>

        <span className="text-sm text-gray-400 self-center ml-auto">
          {filtered.length} {filtered.length === 1 ? "delivery" : "deliveries"}
        </span>
      </div>

      {/* Table / Empty */}
      {deliveries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-14 text-center">
          <Package className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm font-medium text-gray-500">No packs sent yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Packs are generated from the Vendor Leads page when a deal is ready for investors.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No deliveries match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Investor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Property</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Template</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Part</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Sent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((d) => {
                  const { label: statusLbl, cls: statusCls } = statusLabel(d)
                  const name = investorName(d)
                  return (
                    <tr key={d.id} className="table-row group">
                      {/* Investor */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-purple-100 flex items-center justify-center text-xs font-semibold text-purple-700">
                            {investorInitial(d)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 leading-tight">{name}</p>
                            <p className="text-xs text-gray-400">{d.investor.user.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Property */}
                      <td className="table-cell">
                        <span className="text-gray-700 line-clamp-1">
                          {d.generation?.propertyAddress ?? <span className="text-gray-300">—</span>}
                        </span>
                      </td>

                      {/* Template */}
                      <td className="table-cell">
                        <span className="text-gray-600">
                          {d.generation?.template?.name ?? <span className="text-gray-300">—</span>}
                        </span>
                      </td>

                      {/* Part */}
                      <td className="table-cell">
                        <span className="text-gray-600">
                          {d.partNumber ? `Part ${d.partNumber}` : "Full"}
                        </span>
                      </td>

                      {/* Sent */}
                      <td className="table-cell text-gray-500">
                        {d.sentAt
                          ? formatDistanceToNow(new Date(d.sentAt), { addSuffix: true })
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Status */}
                      <td className="table-cell">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
                          statusCls
                        )}>
                          {statusLbl}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(d)}
                            disabled={!d.downloadToken}
                            title={!d.downloadToken ? "No download link available" : "Download pack PDF"}
                            className="gap-1.5"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResend(d)}
                            disabled={
                              resendingId === d.id ||
                              d.deliveryMethod !== "email"
                            }
                            title={d.deliveryMethod !== "email" ? "Not sent by email" : "Resend pack email"}
                            className="gap-1.5"
                          >
                            <RefreshCw className={cn("h-3.5 w-3.5", resendingId === d.id && "animate-spin")} />
                            Resend
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewDeal(d)}
                            className="gap-1.5"
                            title="View deal"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Deal
                          </Button>
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
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors. Common issues to fix:
- `ds-card` or `table-header` / `table-row` / `table-cell` CSS classes — these are project-specific utility classes used throughout the codebase (e.g. in `vendor-contacts-client.tsx`). They are defined in global CSS and should work as-is.
- If `isAfter` or `subDays` don't exist in `date-fns`, replace the `thisWeek` calculation with: `deliveries.filter((d) => d.sentAt && new Date(d.sentAt) > new Date(Date.now() - 7 * 86400000)).length`

- [ ] **Step 3: Commit**

```bash
git add components/investors/investor-packs-client.tsx
git commit -m "feat: add InvestorPacksClient — delivery list with stats, filters, and actions"
```

---

## Task 3: Create `app/dashboard/investors/packs/page.tsx`

**Files:**
- Create: `app/dashboard/investors/packs/page.tsx`

Server component that fetches all deliveries with their relations and serialises DateTime/Decimal fields before passing to the client.

- [ ] **Step 1: Create the file**

Create `/mnt/c/Users/henry/Projects/deal-sourcing-saas/app/dashboard/investors/packs/page.tsx`:

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { InvestorPacksClient } from "@/components/investors/investor-packs-client"

export const metadata = { title: "Investor Packs — DealStack" }
export const dynamic = "force-dynamic"

export default async function InvestorPacksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const raw = await prisma.investorPackDelivery.findMany({
    include: {
      investor: {
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      generation: {
        include: {
          template: { select: { name: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  })

  // Serialise DateTime and Decimal fields for the client boundary
  const deliveries = raw.map((d) => ({
    ...d,
    sentAt:      d.sentAt.toISOString(),
    viewedAt:    d.viewedAt?.toISOString() ?? null,
    downloadedAt: d.downloadedAt?.toISOString() ?? null,
    generation: d.generation
      ? {
          ...d.generation,
          createdAt:   d.generation.createdAt?.toISOString() ?? null,
          sentAt:      d.generation.sentAt?.toISOString() ?? null,
          viewedAt:    d.generation.viewedAt?.toISOString() ?? null,
          downloadedAt: d.generation.downloadedAt?.toISOString() ?? null,
          askingPrice: d.generation.askingPrice ? Number(d.generation.askingPrice) : null,
        }
      : null,
  }))

  return <InvestorPacksClient deliveries={deliveries as any} />
}
```

> **Note on `as any`:** The `generation.createdAt` and related DateTime fields on `InvestorPackGeneration` may or may not exist depending on the exact schema version. If TypeScript reports `Property 'createdAt' does not exist on type ...` for `d.generation`, remove those lines. The `as any` cast at the end is the final safety net.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero errors.

If you see `Property 'X' does not exist` for any generation DateTime field (`sentAt`, `viewedAt`, `downloadedAt`, `createdAt`), simply remove those lines from the `generation` serialisation block. The `as any` cast will cover the rest.

If `session.user.role` is missing in TypeScript, check `types/next-auth.d.ts` — if `role` is not in the Session type, remove the role check entirely (just keep the `!session` redirect).

- [ ] **Step 3: Verify the page loads in the browser**

Start the dev server:
```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npm run dev
```

Navigate to `http://localhost:3000/dashboard/investors/packs`. Verify:
- Page loads without errors
- Summary stats display correctly
- Delivery rows appear (or empty state if no data)
- Download button opens PDF in new tab (if `downloadToken` present)
- Resend button sends request and shows a toast

Also verify in the nav: Manage → Investors → Packs now goes to this new page (not the template settings page).

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/investors/packs/page.tsx
git commit -m "feat: add /dashboard/investors/packs — investor pack delivery list page"
```

---

## Verification Checklist

- [ ] Nav "Packs" under Manage → Investors goes to `/dashboard/investors/packs`
- [ ] Summary stats show total sent, opened %, downloaded %, and sent-this-week counts
- [ ] Status filter chips work (All / Sent / Viewed / Downloaded)
- [ ] Method filter chips work (All / Email / Download / Manual)
- [ ] Search filters by investor name/email and property address
- [ ] Download button opens PDF in a new tab using `downloadToken`
- [ ] Download button is disabled (with tooltip) when `downloadToken` is null
- [ ] Resend button POSTs to `/api/investors/pack-delivery/[id]/resend`, shows success/error toast
- [ ] Resend button is disabled when `deliveryMethod !== "email"`
- [ ] View Deal button navigates to `/dashboard/deals/[dealId]`
- [ ] Empty state shows when no deliveries exist
- [ ] No TypeScript errors (`npx tsc --noEmit`)
