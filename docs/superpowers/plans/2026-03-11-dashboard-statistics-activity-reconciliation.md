# Dashboard, Statistics & Activity Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the Dashboard, Statistics, and Activity pages so each has a clear role, eliminate content duplication, and add a "Metrics from" date filter to ignore test data without deleting anything.

**Architecture:** Extract the duplicated `DashboardAnalytics` block from Dashboard into a reusable `VendorAnalyticsPanel` that lives in Statistics; move the investor activity feed from Statistics to Activity; make Dashboard and Statistics KPIs/analytics filterable by a date stored in localStorage. A new `DashboardKpiStrip` client component fetches KPIs from a new `/api/analytics/kpis` endpoint. A shared `MetricsDateFilter` component persists the selected date in localStorage and passes it as a `?from=` param to all analytics APIs.

**Tech Stack:** Next.js 14 App Router (server + client components), Prisma 5, shadcn/ui Tabs, Lucide React, date-fns, localStorage

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `app/api/analytics/kpis/route.ts` | KPI counts filtered by optional `from` date |
| Modify | `app/api/analytics/workflow/route.ts` | Add `from` query param to all Prisma where clauses |
| Modify | `app/api/investors/stats/route.ts` | Add `from` query param; remove `recentActivities` |
| Create | `components/ui/metrics-date-filter.tsx` | Date pill UI; reads/writes `ds_metrics_from_date` in localStorage |
| Create | `components/dashboard/dashboard-kpi-strip.tsx` | Client KPI strip that fetches `/api/analytics/kpis` |
| Create | `components/dashboard/vendor-analytics-panel.tsx` | Vendor conversion rates + time metrics (extracted from `DashboardAnalytics`) |
| Modify | `components/settings/investor-management-dashboard.tsx` | Remove "Recent Activity" section; accept `from?: string \| null` prop |
| Create | `app/dashboard/statistics/statistics-client.tsx` | Client wrapper: tabs (Vendor/Investor), shared filter state |
| Modify | `app/dashboard/page.tsx` | Remove `DashboardAnalytics`; use `DashboardKpiStrip`; add mini activity feed |
| Modify | `app/dashboard/statistics/page.tsx` | Replace raw `h1` with `PageHeader`; render `StatisticsClient` |
| Modify | `app/dashboard/vendors/activity/page.tsx` | Add `PageHeader`; add investor activity section via direct Prisma query |

---

## Chunk 1: Backend API Tasks

### Task 1: New `/api/analytics/kpis` endpoint

**Files:**
- Create: `app/api/analytics/kpis/route.ts`

Context: Dashboard KPIs (Total Deals, Vendors, Reservations, Conversion Rate) are currently computed inside the Dashboard server component. This new endpoint serves the same data as a client-fetchable API so the KPI strip can be filtered by a date from localStorage.

- [ ] **Step 1: Create the file**

```ts
// app/api/analytics/kpis/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function parseFromDate(url: string): Date | undefined {
  const { searchParams } = new URL(url)
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fromDate = parseFromDate(request.url)
    const df = fromDate ? { createdAt: { gte: fromDate } } : {}

    // "dealsRecent" = deals created since fromDate (or since start of current month if no filter)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const recentSince = fromDate ?? monthStart

    const [
      totalDeals,
      dealsRecent,
      totalVendors,
      vendorsWithOffers,
      vendorsAccepted,
      totalReservations,
      reservationsWithProof,
    ] = await Promise.all([
      prisma.deal.count({ where: { ...df } }),
      prisma.deal.count({ where: { createdAt: { gte: recentSince } } }),
      prisma.vendor.count({ where: { ...df } }),
      prisma.vendor.count({ where: { status: { in: ["offer_made", "negotiating"] }, ...df } }),
      prisma.vendor.count({ where: { status: "offer_accepted", ...df } }),
      prisma.investorReservation.count({ where: { ...df } }),
      prisma.investorReservation.count({ where: { proofOfFundsVerified: true, ...df } }),
    ])

    const vendorConversionRate =
      totalVendors > 0 ? ((vendorsAccepted / totalVendors) * 100).toFixed(1) : "0"

    return NextResponse.json({
      totalDeals,
      dealsRecent,
      totalVendors,
      vendorsWithOffers,
      vendorsAccepted,
      totalReservations,
      reservationsWithProof,
      vendorConversionRate,
    })
  } catch (error) {
    console.error("Error fetching KPIs:", error)
    return NextResponse.json({ error: "Failed to fetch KPIs" }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/analytics/kpis/route.ts
git commit -m "feat: add /api/analytics/kpis endpoint with optional from date filter"
```

---

### Task 2: Add `from` param to `/api/analytics/workflow`

**Files:**
- Modify: `app/api/analytics/workflow/route.ts` (full file, 208 lines)

Context: This is the existing workflow analytics endpoint used by `VendorPipelineCard`, `TimeInStagesCard`, and `DashboardAnalytics`. Add `from` date filtering to all vendor and reservation Prisma queries so the new `VendorAnalyticsPanel` can filter by date.

- [ ] **Step 1: Replace the full file**

```ts
// app/api/analytics/workflow/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function parseFromDate(url: string): Date | undefined {
  const { searchParams } = new URL(url)
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (session.user.role !== "admin" && session.user.role !== "sourcer") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const fromDate = parseFromDate(request.url)
    const df = fromDate ? { createdAt: { gte: fromDate } } : {}

    // Vendor Pipeline Analytics
    const vendorsByStage = await prisma.vendor.groupBy({
      by: ["status"],
      _count: { id: true },
      where: { ...df },
    })

    // Calculate time in each stage
    const vendorsWithStageTime = await prisma.vendor.findMany({
      where: { status: { not: "contacted" }, ...df },
      select: {
        id: true,
        status: true,
        createdAt: true,
        qualifiedAt: true,
        lockedOutAt: true,
      },
    })

    // Calculate average time in stages
    const stageTimes: Record<string, number[]> = {}
    vendorsWithStageTime.forEach((vendor) => {
      const now = new Date()
      const created = new Date(vendor.createdAt)

      if (vendor.status === "validated" && vendor.qualifiedAt) {
        const timeInContacted =
          (new Date(vendor.qualifiedAt).getTime() - created.getTime()) / (1000 * 60 * 60 * 24)
        if (!stageTimes["contacted"]) stageTimes["contacted"] = []
        stageTimes["contacted"].push(timeInContacted)
      }

      if (
        ["offer_made", "negotiating", "offer_accepted"].includes(vendor.status) &&
        vendor.qualifiedAt
      ) {
        const timeInValidated =
          (now.getTime() - new Date(vendor.qualifiedAt).getTime()) / (1000 * 60 * 60 * 24)
        if (!stageTimes["validated"]) stageTimes["validated"] = []
        stageTimes["validated"].push(timeInValidated)
      }
    })

    const avgStageTimes: Record<string, number> = {}
    Object.keys(stageTimes).forEach((stage) => {
      const times = stageTimes[stage]
      avgStageTimes[stage] =
        times.length > 0
          ? Math.round((times.reduce((a, b) => a + b, 0) / times.length) * 10) / 10
          : 0
    })

    // Conversion Rates
    const [
      totalContacted,
      totalValidated,
      totalOffersMade,
      totalAccepted,
      totalLockedOut,
      totalVendors,
    ] = await Promise.all([
      prisma.vendor.count({ where: { status: "contacted", ...df } }),
      prisma.vendor.count({ where: { status: "validated", ...df } }),
      prisma.vendor.count({ where: { status: { in: ["offer_made", "negotiating"] }, ...df } }),
      prisma.vendor.count({ where: { status: "offer_accepted", ...df } }),
      prisma.vendor.count({ where: { status: "locked_out", ...df } }),
      prisma.vendor.count({ where: { ...df } }),
    ])

    const conversionRates = {
      contactedToValidated:
        totalContacted > 0 ? (totalValidated / totalContacted) * 100 : 0,
      validatedToOffer:
        totalValidated > 0 ? (totalOffersMade / totalValidated) * 100 : 0,
      offerToAccepted:
        totalOffersMade > 0 ? (totalAccepted / totalOffersMade) * 100 : 0,
      acceptedToLockedOut:
        totalAccepted > 0 ? (totalLockedOut / totalAccepted) * 100 : 0,
      overallContactedToLockedOut:
        totalContacted > 0 ? (totalLockedOut / totalContacted) * 100 : 0,
    }

    // Offer Statistics — not date-filtered (offer analytics are secondary metrics)
    const allOffers = await prisma.vendorOffer.findMany({
      include: { vendor: { select: { id: true, status: true } } },
    })

    const offersByDeal = await prisma.vendorOffer.groupBy({
      by: ["dealId"],
      _count: { id: true },
      where: { dealId: { not: null } },
    })

    const avgOffersPerDeal =
      offersByDeal.length > 0
        ? offersByDeal.reduce((sum, group) => sum + group._count.id, 0) / offersByDeal.length
        : 0

    const acceptedOffers = await prisma.vendorOffer.findMany({
      where: {
        vendorDecision: "accepted",
        vendorDecisionDate: { not: null },
      },
      include: {
        vendor: {
          select: {
            id: true,
            offers: { orderBy: { offerDate: "asc" }, take: 1 },
          },
        },
      },
    })

    const negotiationTimes: number[] = []
    acceptedOffers.forEach((offer) => {
      if (offer.vendor.offers.length > 0 && offer.vendorDecisionDate) {
        const firstOfferDate = new Date(offer.vendor.offers[0].offerDate)
        const acceptedDate = new Date(offer.vendorDecisionDate)
        const days =
          (acceptedDate.getTime() - firstOfferDate.getTime()) / (1000 * 60 * 60 * 24)
        negotiationTimes.push(days)
      }
    })

    const avgNegotiationTime =
      negotiationTimes.length > 0
        ? Math.round(
            (negotiationTimes.reduce((a, b) => a + b, 0) / negotiationTimes.length) * 10
          ) / 10
        : 0

    // Investor Reservation Conversion
    const [
      totalReservations,
      reservationsWithProof,
      reservationsLockedOut,
      reservationsCompleted,
    ] = await Promise.all([
      prisma.investorReservation.count({ where: { ...df } }),
      prisma.investorReservation.count({ where: { proofOfFundsVerified: true, ...df } }),
      prisma.investorReservation.count({ where: { status: "locked_out", ...df } }),
      prisma.investorReservation.count({ where: { status: "completed", ...df } }),
    ])

    const reservationConversionRates = {
      reservationToProof:
        totalReservations > 0 ? (reservationsWithProof / totalReservations) * 100 : 0,
      proofToLockedOut:
        reservationsWithProof > 0 ? (reservationsLockedOut / reservationsWithProof) * 100 : 0,
      lockedOutToCompleted:
        reservationsLockedOut > 0 ? (reservationsCompleted / reservationsLockedOut) * 100 : 0,
      overallReservationToCompleted:
        totalReservations > 0 ? (reservationsCompleted / totalReservations) * 100 : 0,
    }

    return NextResponse.json({
      vendorPipeline: {
        byStage: vendorsByStage.map((stage) => ({
          stage: stage.status,
          count: stage._count.id,
        })),
        conversionRates,
        avgStageTimes,
        avgOffersPerDeal: Math.round(avgOffersPerDeal * 10) / 10,
        avgNegotiationTime,
        totalVendors,
        totalOffers: allOffers.length,
      },
      investorPipeline: {
        conversionRates: reservationConversionRates,
        totalReservations,
        reservationsWithProof,
        reservationsLockedOut,
        reservationsCompleted,
      },
    })
  } catch (error) {
    console.error("Error fetching workflow analytics:", error)
    return NextResponse.json(
      { error: "Failed to fetch workflow analytics" },
      { status: 500 }
    )
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/analytics/workflow/route.ts
git commit -m "feat: add from date filter to /api/analytics/workflow"
```

---

### Task 3: Update `/api/investors/stats` — add `from` param, remove `recentActivities`

**Files:**
- Modify: `app/api/investors/stats/route.ts` (133 lines)

Context: Two changes: (1) add `from` date filtering so Statistics investor tab can be filtered; (2) remove `recentActivities` from the query and response since that section is moving to the Activity page. This cleans up unnecessary data fetched on every stats load.

- [ ] **Step 1: Replace the full file**

```ts
// app/api/investors/stats/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"

function parseFromDate(url: string): Date | undefined {
  const { searchParams } = new URL(url)
  const from = searchParams.get("from")
  if (!from) return undefined
  const d = new Date(from)
  return isNaN(d.getTime()) ? undefined : d
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const fromDate = parseFromDate(request.url)
    const df = fromDate ? { createdAt: { gte: fromDate } } : {}

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // ── Fire all independent queries in parallel ───────────────────────────────
    const [
      totalInvestors,
      activeInvestors,
      byStage,
      totalPurchases,
      totalRevenue,
      allReservations,
      totalPacksSent,
      packsViewed,
      packsDownloaded,
      topInvestors,
    ] = await Promise.all([
      prisma.investor.count({ where: { ...df } }),
      prisma.investor.count({ where: { lastActivityAt: { gte: thirtyDaysAgo } } }),
      prisma.investor.groupBy({ by: ["pipelineStage"], _count: true, where: { ...df } }),
      prisma.investor.aggregate({ _sum: { dealsPurchased: true }, where: { ...df } }),
      prisma.investor.aggregate({ _sum: { totalSpent: true }, where: { ...df } }),
      prisma.investorReservation.findMany({
        select: {
          status: true,
          reservationFee: true,
          feePaid: true,
          proofOfFundsVerified: true,
          lockOutAgreementSigned: true,
        },
        where: { ...df },
      }),
      prisma.investorPackDelivery.count({ where: { ...df } }),
      prisma.investorPackDelivery.count({ where: { viewedAt: { not: null }, ...df } }),
      prisma.investorPackDelivery.count({ where: { downloadedAt: { not: null }, ...df } }),
      prisma.investor.findMany({
        orderBy: { totalSpent: "desc" },
        take: 10,
        include: { user: { select: { firstName: true, lastName: true, email: true } } },
        where: { ...df },
      }),
    ])

    // ── Derive reservation stats in-memory ────────────────────────────────────
    const stageStats = byStage.reduce((acc, item) => {
      acc[item.pipelineStage] = item._count
      return acc
    }, {} as Record<string, number>)

    const TERMINAL = ["completed", "cancelled"]
    const activeRes = allReservations.filter((r) => !TERMINAL.includes(r.status))
    const completedRes = allReservations.filter((r) => r.status === "completed")
    const cancelledRes = allReservations.filter((r) => r.status === "cancelled")
    const feePaidRes = allReservations.filter((r) => r.feePaid)
    const feeUnpaidActiveRes = activeRes.filter((r) => !r.feePaid)

    const feesCollected = feePaidRes.reduce((s, r) => s + Number(r.reservationFee), 0)
    const feesOutstanding = feeUnpaidActiveRes.reduce((s, r) => s + Number(r.reservationFee), 0)
    const pofVerified = allReservations.filter((r) => r.proofOfFundsVerified).length
    const lockOutSigned = allReservations.filter((r) => r.lockOutAgreementSigned).length

    const ALL_STATUSES = [
      "pending", "pack_sent", "fee_pending", "fee_paid",
      "proof_of_funds_pending", "pof_received", "verified",
      "lock_out_sent", "locked_out", "completed", "cancelled",
    ]
    const byReservationStatus = allReservations.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)
    ALL_STATUSES.forEach((s) => { if (!(s in byReservationStatus)) byReservationStatus[s] = 0 })

    // ── Conversion rates ───────────────────────────────────────────────────────
    const conversionRates = {
      leadToQualified: totalInvestors > 0 ? (stageStats.QUALIFIED || 0) / totalInvestors : 0,
      qualifiedToPurchased:
        (stageStats.QUALIFIED || 0) > 0
          ? (stageStats.PURCHASED || 0) / stageStats.QUALIFIED
          : 0,
      viewingToReserved:
        (stageStats.VIEWING_DEALS || 0) > 0
          ? activeRes.length / stageStats.VIEWING_DEALS
          : 0,
    }

    return NextResponse.json({
      overview: {
        totalInvestors,
        activeInvestors,
        totalReservations: allReservations.length,
        activeReservations: activeRes.length,
        completedReservations: completedRes.length,
        cancelledReservations: cancelledRes.length,
        totalPurchases: totalPurchases._sum.dealsPurchased || 0,
        totalRevenue: Number(totalRevenue._sum.totalSpent) || 0,
      },
      reservationStats: {
        feesCollected,
        feesOutstanding,
        feesCollectedCount: feePaidRes.length,
        feesPendingCount: feeUnpaidActiveRes.length,
        pofVerified,
        lockOutSigned,
      },
      byStage: stageStats,
      byReservationStatus,
      packStats: {
        totalPacksSent,
        packsViewed,
        packsDownloaded,
        viewRate: totalPacksSent > 0 ? (packsViewed / totalPacksSent) * 100 : 0,
        downloadRate: totalPacksSent > 0 ? (packsDownloaded / totalPacksSent) * 100 : 0,
      },
      conversionRates,
      topInvestors,
    })
  } catch (error: any) {
    console.error("Error fetching investor stats:", error)
    return NextResponse.json({ error: "Failed to fetch investor stats" }, { status: 500 })
  }
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: TypeScript will complain that `InvestorManagementDashboard` still references `recentActivities` from the response type. That's fine for now — it gets fixed in Task 7.

- [ ] **Step 3: Commit**

```bash
git add app/api/investors/stats/route.ts
git commit -m "feat: add from date filter to /api/investors/stats, remove recentActivities"
```

---

## Chunk 2: UI Components

### Task 4: `MetricsDateFilter` component

**Files:**
- Create: `components/ui/metrics-date-filter.tsx`

Context: Shared date filter pill used on both the Dashboard KPI strip and the Statistics page. Reads/writes `ds_metrics_from_date` in localStorage. Uses `useState(null)` + `useEffect` to avoid Next.js hydration mismatches (server never knows localStorage values).

- [ ] **Step 1: Create the file**

```tsx
// components/ui/metrics-date-filter.tsx
"use client"

import { useState, useEffect } from "react"
import { Calendar, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO } from "date-fns"

const STORAGE_KEY = "ds_metrics_from_date"

interface MetricsDateFilterProps {
  onChange: (from: string | null) => void
}

export function MetricsDateFilter({ onChange }: MetricsDateFilterProps) {
  const [from, setFrom] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    setFrom(stored)
    setMounted(true)
    onChange(stored)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = (date: string) => {
    if (!date) { handleClear(); return }
    localStorage.setItem(STORAGE_KEY, date)
    setFrom(date)
    onChange(date)
  }

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY)
    setFrom(null)
    onChange(null)
  }

  if (!mounted) {
    return <div className="h-7 w-48 animate-pulse rounded-md bg-gray-100" />
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400">Metrics from:</span>
      <div className="relative flex items-center">
        <Calendar className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-gray-400" />
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) => handleChange(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="h-7 rounded-md border border-[var(--ds-border)] bg-white pl-7 pr-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
        />
      </div>
      {from ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-7 px-2 text-xs text-gray-400 hover:text-gray-700"
        >
          <X className="mr-1 h-3 w-3" />
          All time
        </Button>
      ) : (
        <span className="text-xs text-gray-400 italic">All time</span>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/ui/metrics-date-filter.tsx
git commit -m "feat: add MetricsDateFilter component with localStorage persistence"
```

---

### Task 5: `DashboardKpiStrip` client component

**Files:**
- Create: `components/dashboard/dashboard-kpi-strip.tsx`

Context: Replaces the server-rendered KPI section in Dashboard. Fetches from the new `/api/analytics/kpis` endpoint. The first fetch is triggered by `MetricsDateFilter`'s `onChange` callback (which fires on mount after reading localStorage). Until then the component shows a loading skeleton. The `MetricsDateFilter` is embedded inline in this component's header bar.

- [ ] **Step 1: Create the file**

```tsx
// components/dashboard/dashboard-kpi-strip.tsx
"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Info } from "lucide-react"
import { KpiCard } from "@/components/ui/kpi-card"
import { MetricsDateFilter } from "@/components/ui/metrics-date-filter"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { format, parseISO } from "date-fns"

interface KpiData {
  totalDeals: number
  dealsRecent: number
  totalVendors: number
  vendorsWithOffers: number
  vendorsAccepted: number
  totalReservations: number
  reservationsWithProof: number
  vendorConversionRate: string
}

export function DashboardKpiStrip() {
  const [data, setData] = useState<KpiData | null>(null)
  const [from, setFrom] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchKpis = async (fromDate: string | null) => {
    setLoading(true)
    try {
      const url = fromDate ? `/api/analytics/kpis?from=${fromDate}` : "/api/analytics/kpis"
      const res = await fetch(url)
      if (res.ok) setData(await res.json())
    } catch (err) {
      console.error("Failed to fetch KPIs", err)
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (newFrom: string | null) => {
    setFrom(newFrom)
    fetchKpis(newFrom)
  }

  const subLabelDeals = from
    ? `+${data?.dealsRecent ?? 0} since ${format(parseISO(from), "d MMM")}`
    : `+${data?.dealsRecent ?? 0} this month`

  return (
    <TooltipProvider>
      <div className="ds-card overflow-hidden">
        {/* Filter bar */}
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Overview
          </span>
          <MetricsDateFilter onChange={handleFilterChange} />
        </div>

        {/* Loading / data */}
        {loading || !data ? (
          <div className="flex min-h-[100px] items-center justify-center p-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
          </div>
        ) : (
          <div className="grid grid-cols-2 divide-x divide-[var(--ds-border)] md:grid-cols-4">
            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Total Deals"
                  value={String(data.totalDeals)}
                  subLabel={subLabelDeals}
                  valueType="highlight"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    All deals across all stages: new, review, in-progress, ready, listed,
                    reserved, sold, archived.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Active Vendors"
                  value={String(data.totalVendors)}
                  subLabel={`${data.vendorsWithOffers} with offers`}
                  valueType="neutral"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Total vendors from all sources. Each represents a potential property seller.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Reservations"
                  value={String(data.totalReservations)}
                  subLabel={`${data.reservationsWithProof} verified`}
                  valueType="neutral"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    All investor reservations across all deals and statuses.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            <div className="p-6">
              <div className="flex items-start justify-between gap-2">
                <KpiCard
                  label="Conversion Rate"
                  value={`${data.vendorConversionRate}%`}
                  subLabel={`${data.vendorsAccepted} accepted`}
                  valueType={Number(data.vendorConversionRate) > 0 ? "positive" : "neutral"}
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="mt-1 h-3.5 w-3.5 shrink-0 cursor-help text-gray-300" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    (Accepted Offers / Total Vendors) × 100. Shows % of vendors who accepted
                    offers.
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-kpi-strip.tsx
git commit -m "feat: add DashboardKpiStrip client component with date filter"
```

---

### Task 6: `VendorAnalyticsPanel` component

**Files:**
- Create: `components/dashboard/vendor-analytics-panel.tsx`

Context: The vendor tab content from `DashboardAnalytics` (Vendor Pipeline Overview, Conversion Rates, Time in Stages) extracted into a standalone component. It fetches from `/api/analytics/workflow?from=` using a `from` prop. When `from` changes (e.g. Statistics page filter), it refetches. Renders loading spinner while fetching.

- [ ] **Step 1: Create the file**

The content is the vendor tab section of `components/dashboard/dashboard-analytics.tsx` (lines 129–468), extracted into its own component with a `from` prop.

```tsx
// components/dashboard/vendor-analytics-panel.tsx
"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Loader2, TrendingUp, Clock, Building2, ArrowRight } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

interface VendorPipelineData {
  byStage: Array<{ stage: string; count: number }>
  conversionRates: {
    contactedToValidated: number
    validatedToOffer: number
    offerToAccepted: number
    acceptedToLockedOut: number
    overallContactedToLockedOut: number
  }
  avgStageTimes: Record<string, number>
  avgOffersPerDeal: number
  avgNegotiationTime: number
  totalVendors: number
  totalOffers: number
}

interface VendorAnalyticsPanelProps {
  from?: string | null
}

const formatPercentage = (value: number) => `${value.toFixed(1)}%`
const formatDays = (value: number) => `${value.toFixed(1)} days`

const stageLabels: Record<string, string> = {
  contacted: "Contacted",
  validated: "Validated",
  offer_made: "Offer Made",
  negotiating: "Negotiating",
  offer_accepted: "Accepted",
  offer_rejected: "Rejected",
  locked_out: "Locked Out",
  withdrawn: "Withdrawn",
}

const getStageColor = (stage: string) => {
  const colors: Record<string, { bg: string }> = {
    contacted: { bg: "bg-blue-100 text-blue-800 border-blue-200" },
    validated: { bg: "bg-green-100 text-green-800 border-green-200" },
    offer_made: { bg: "bg-yellow-100 text-yellow-800 border-yellow-200" },
    negotiating: { bg: "bg-orange-100 text-orange-800 border-orange-200" },
    offer_accepted: { bg: "bg-purple-100 text-purple-800 border-purple-200" },
    offer_rejected: { bg: "bg-red-100 text-red-800 border-red-200" },
    locked_out: { bg: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    withdrawn: { bg: "bg-gray-100 text-gray-800 border-gray-200" },
  }
  return colors[stage] || { bg: "bg-gray-100 text-gray-800 border-gray-200" }
}

const getConversionColor = (pct: number) => {
  if (pct >= 70) return "text-green-600"
  if (pct >= 50) return "text-blue-600"
  if (pct >= 30) return "text-yellow-600"
  return "text-red-600"
}

export function VendorAnalyticsPanel({ from }: VendorAnalyticsPanelProps) {
  const [data, setData] = useState<VendorPipelineData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        const url = from
          ? `/api/analytics/workflow?from=${from}`
          : "/api/analytics/workflow"
        const res = await fetch(url)
        if (res.ok) {
          const json = await res.json()
          setData(json.vendorPipeline)
        }
      } catch (err) {
        console.error("Failed to fetch vendor analytics", err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [from])

  if (isLoading || !data) {
    return (
      <div className="ds-card flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6 pt-4">
        {/* Pipeline Overview */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                  Vendor Pipeline Overview
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 cursor-help text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-sm font-medium mb-1">How it&apos;s calculated:</p>
                      <p className="text-xs">
                        Counts vendors grouped by their current status in the workflow.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </h3>
                <p className="mt-0.5 text-xs text-gray-400">
                  Track vendors through each stage of the workflow
                </p>
              </div>
              <Link href="/dashboard/vendors">
                <Button variant="ghost" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="p-5">
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
              {data.byStage.map((stage) => (
                <div
                  key={stage.stage}
                  className="rounded-lg border p-4 text-center transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2 text-2xl font-bold">{stage.count}</div>
                  <Badge className={getStageColor(stage.stage).bg} variant="outline">
                    {stageLabels[stage.stage] || stage.stage}
                  </Badge>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="ds-card overflow-hidden">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total Vendors</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalVendors}</div>
                </div>
              </div>
              <div className="ds-card overflow-hidden">
                <div className="p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm text-gray-400">Total Offers</span>
                  </div>
                  <div className="text-2xl font-bold">{data.totalOffers}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Conversion Rates */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <TrendingUp className="h-5 w-5" />
              Conversion Rates
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Track conversion rates between workflow stages
            </p>
          </div>
          <div className="p-5">
            <div className="space-y-4">
              {[
                {
                  from: { label: "Contacted", cls: "bg-blue-100 text-blue-800 border-blue-200" },
                  to: { label: "Validated", cls: "bg-green-100 text-green-800 border-green-200" },
                  value: data.conversionRates.contactedToValidated,
                  desc: "Vendors who passed initial validation",
                },
                {
                  from: { label: "Validated", cls: "bg-green-100 text-green-800 border-green-200" },
                  to: { label: "Offer Made", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
                  value: data.conversionRates.validatedToOffer,
                  desc: "Validated vendors who received offers",
                },
                {
                  from: { label: "Offer", cls: "bg-yellow-100 text-yellow-800 border-yellow-200" },
                  to: { label: "Accepted", cls: "bg-purple-100 text-purple-800 border-purple-200" },
                  value: data.conversionRates.offerToAccepted,
                  desc: "Offers that were accepted by vendors",
                },
                {
                  from: { label: "Accepted", cls: "bg-purple-100 text-purple-800 border-purple-200" },
                  to: { label: "Locked Out", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
                  value: data.conversionRates.acceptedToLockedOut,
                  desc: "Accepted offers that reached lock-out",
                },
              ].map((row) => (
                <div
                  key={row.desc}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <div className="flex items-center gap-2 font-medium">
                      <Badge variant="outline" className={row.from.cls}>{row.from.label}</Badge>
                      <span>→</span>
                      <Badge variant="outline" className={row.to.cls}>{row.to.label}</Badge>
                    </div>
                    <div className="mt-1 text-sm text-gray-400">{row.desc}</div>
                  </div>
                  <div className={`text-2xl font-bold ${getConversionColor(row.value)}`}>
                    {formatPercentage(row.value)}
                  </div>
                </div>
              ))}

              {/* Overall */}
              <div className="flex items-center justify-between rounded-lg border-2 border-[#2563EB]/20 bg-[#2563EB]/5 p-4">
                <div>
                  <div className="flex items-center gap-2 font-medium">
                    <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">Contacted</Badge>
                    <span>→</span>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-800 border-emerald-200">Locked Out</Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-400">End-to-end conversion rate</div>
                </div>
                <div className={`text-2xl font-bold ${getConversionColor(data.conversionRates.overallContactedToLockedOut)}`}>
                  {formatPercentage(data.conversionRates.overallContactedToLockedOut)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Time in Stages */}
        <div className="ds-card overflow-hidden">
          <div className="border-b border-[var(--ds-border)] px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <Clock className="h-5 w-5" />
              Time in Stages
            </h3>
            <p className="mt-0.5 text-xs text-gray-400">
              Average time vendors spend in each stage
            </p>
          </div>
          <div className="p-5">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(data.avgStageTimes).map(([stage, days]) => (
                <div
                  key={stage}
                  className="rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="mb-2">
                    <Badge className={getStageColor(stage).bg} variant="outline">
                      {stageLabels[stage] || stage}
                    </Badge>
                  </div>
                  <div className="text-2xl font-bold">{formatDays(days)}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
                <div className="mb-2 text-sm text-gray-400">Avg Offers per Deal</div>
                <div className="text-2xl font-bold">{data.avgOffersPerDeal.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border p-4 transition-colors hover:bg-gray-50">
                <div className="mb-2 text-sm text-gray-400">Avg Negotiation Time</div>
                <div className="text-2xl font-bold">{formatDays(data.avgNegotiationTime)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/vendor-analytics-panel.tsx
git commit -m "feat: add VendorAnalyticsPanel component extracted from DashboardAnalytics"
```

---

### Task 7: Update `InvestorManagementDashboard` — remove activity section, add `from` prop

**Files:**
- Modify: `components/settings/investor-management-dashboard.tsx`

Context: Two changes: (1) remove section 7 "Recent Activity" (lines ~329–356) since that content moves to the Activity page; (2) accept a `from?: string | null` prop and append it to the `/api/investors/stats` fetch URL. Also remove `recentActivities` from the `InvestorStats` interface since the API no longer returns it.

- [ ] **Step 1: Add `from` prop to component signature**

Find the existing component signature (line ~121):
```ts
export function InvestorManagementDashboard() {
```
Replace with:
```ts
export function InvestorManagementDashboard({ from }: { from?: string | null } = {}) {
```

- [ ] **Step 2: Update the fetch URL to include `from`**

Find the existing fetch call (line ~127):
```ts
fetch("/api/investors/stats", { cache: "no-store" })
```
Replace with:
```ts
fetch(from ? `/api/investors/stats?from=${from}` : "/api/investors/stats", { cache: "no-store" })
```

- [ ] **Step 3: Refetch when `from` changes**

Find the existing `useEffect`:
```ts
useEffect(() => {
  fetch(...)
    ...
}, [])
```
Change the dependency array to `[from]` so it refetches when the date filter changes:
```ts
}, [from])
```

- [ ] **Step 4: Remove `recentActivities` from the `InvestorStats` interface**

Find the `InvestorStats` interface (lines ~18–64). Remove the `recentActivities` field:
```ts
  recentActivities: Array<{
    id: string
    activityType: string
    description: string | null
    createdAt: Date
    investor: { user: { firstName: string | null; lastName: string | null; email: string } }
  }>
```

- [ ] **Step 5: Remove section 7 "Recent Activity" from the render**

Find the comment `{/* ── Section 7: Recent activity ─────────────────────────────────────── */}` (around line 329) and delete the entire section block through to its closing `</section>` tag.

- [ ] **Step 6: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors. If there are complaints about `stats.recentActivities` still being referenced after the section removal, find and remove those references.

- [ ] **Step 7: Commit**

```bash
git add components/settings/investor-management-dashboard.tsx
git commit -m "feat: remove recent activity from InvestorManagementDashboard, add from prop"
```

---

## Chunk 3: Page Updates

### Task 8: `StatisticsClient` + update Statistics page

**Files:**
- Create: `app/dashboard/statistics/statistics-client.tsx`
- Modify: `app/dashboard/statistics/page.tsx`

Context: Statistics page gains: (1) `PageHeader` replacing raw `h1`; (2) two tabs — Vendor Pipeline (new `VendorAnalyticsPanel`) and Investor Pipeline (existing `InvestorManagementDashboard`); (3) a shared `MetricsDateFilter` above the tabs. The filter state and tab state live in a new `StatisticsClient` client component. The server `page.tsx` handles auth redirect and renders `PageHeader` + `StatisticsClient`.

Note on filter initialisation: `from` state starts as `undefined` in `StatisticsClient`. Neither panel renders until `MetricsDateFilter` fires `onChange` (on its `useEffect` after mount), at which point `from` becomes `null` (no filter) or an ISO date string. This avoids a redundant initial fetch with `from = null` before the stored value is known.

- [ ] **Step 1: Create `statistics-client.tsx`**

```tsx
// app/dashboard/statistics/statistics-client.tsx
"use client"

import { useState } from "react"
import { Building2, Users } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MetricsDateFilter } from "@/components/ui/metrics-date-filter"
import { VendorAnalyticsPanel } from "@/components/dashboard/vendor-analytics-panel"
import { InvestorManagementDashboard } from "@/components/settings/investor-management-dashboard"

export function StatisticsClient() {
  // undefined = filter not yet initialised (MetricsDateFilter useEffect pending)
  // null = filter initialised, no date selected
  // string = filter initialised with a date
  const [from, setFrom] = useState<string | null | undefined>(undefined)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <MetricsDateFilter onChange={(v) => setFrom(v)} />
      </div>

      <Tabs defaultValue="vendor" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="vendor" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Vendor Pipeline
          </TabsTrigger>
          <TabsTrigger value="investor" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Investor Pipeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="vendor">
          {from !== undefined && <VendorAnalyticsPanel from={from} />}
        </TabsContent>

        <TabsContent value="investor">
          {from !== undefined && <InvestorManagementDashboard from={from} />}
        </TabsContent>
      </Tabs>
    </div>
  )
}
```

- [ ] **Step 2: Update `page.tsx`**

Replace the full contents of `app/dashboard/statistics/page.tsx`:

```tsx
// app/dashboard/statistics/page.tsx
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PageHeader } from "@/components/ui/page-header"
import { StatisticsClient } from "./statistics-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "Statistics — DealStack" }

export default async function StatisticsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics"
        subtitle="Vendor & investor performance analytics"
      />
      <Suspense fallback={<div className="py-8 text-center text-sm text-gray-400">Loading statistics…</div>}>
        <StatisticsClient />
      </Suspense>
    </div>
  )
}
```

- [ ] **Step 3: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/statistics/statistics-client.tsx app/dashboard/statistics/page.tsx
git commit -m "feat: add Vendor/Investor tabs and MetricsDateFilter to Statistics page"
```

---

### Task 9: Update Dashboard page

**Files:**
- Modify: `app/dashboard/page.tsx`

Context: Three changes: (1) remove `DashboardAnalytics` import and its JSX; (2) replace the server-rendered KPI strip with the new `DashboardKpiStrip` client component; (3) add a compact "Recent Activity" mini-feed (last 5 `PipelineEvent` records, server-fetched, with a "View all" link).

- [ ] **Step 1: Replace the full file**

```tsx
// app/dashboard/page.tsx
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { RateLimitMonitor } from "@/components/vendor-pipeline/rate-limit-monitor"
import { VendorPipelineCard } from "@/components/dashboard/vendor-pipeline-card"
import { TimeInStagesCard } from "@/components/dashboard/time-in-stages-card"
import { DashboardKpiStrip } from "@/components/dashboard/dashboard-kpi-strip"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Plus, Clock, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"

export const dynamic = "force-dynamic"

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Email Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
}

function dotColor(eventType: string): string {
  if (eventType === "offer_accepted" || eventType === "deal_validated") return "bg-green-500"
  if (eventType === "offer_rejected" || eventType === "deal_rejected") return "bg-red-500"
  if (eventType === "vendor_offer_sent") return "bg-yellow-500"
  return "bg-blue-500"
}

function eventTitle(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = STAGE_LABELS[details.toStage as string] ?? details.toStage ?? "—"
    return `Stage → ${to}`
  }
  if (eventType === "vendor_offer_sent") {
    const price = details.offerPrice ? ` £${Number(details.offerPrice).toLocaleString()}` : ""
    return `Offer sent${price}`
  }
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)

  const recentEvents = await prisma.pipelineEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      eventType: true,
      details: true,
      createdAt: true,
      vendorLead: {
        select: { vendorName: true },
      },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${session?.user?.name || session?.user?.email || "there"}`}
        subtitle="Here's your pipeline at a glance"
        actions={
          <Link href="/dashboard/deals/new">
            <Button className="btn-primary h-9">
              <Plus className="mr-2 h-4 w-4" />
              New Deal
            </Button>
          </Link>
        }
      />

      {/* KPI strip — client component, fetches /api/analytics/kpis with date filter */}
      <DashboardKpiStrip />

      {/* AI Rate Limits */}
      <RateLimitMonitor />

      {/* Pipeline Overview */}
      <div className="grid gap-4 md:grid-cols-2">
        <VendorPipelineCard />
        <TimeInStagesCard />
      </div>

      {/* Recent Activity mini-feed */}
      <div className="ds-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-[#2563EB]" />
            Recent Activity
          </h3>
          <Link
            href="/dashboard/vendors/activity"
            className="flex items-center gap-1 text-xs text-[#2563EB] hover:underline"
          >
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="p-5">
          {recentEvents.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">No activity recorded yet</p>
          ) : (
            <ol className="relative ml-3 space-y-4 border-l border-[var(--ds-border)]">
              {recentEvents.map((ev) => {
                const details = (ev.details ?? {}) as Record<string, unknown>
                const color = dotColor(ev.eventType)
                const title = eventTitle(ev.eventType, details)
                return (
                  <li key={ev.id} className="ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <p className="text-sm font-medium leading-tight">{title}</p>
                    {ev.vendorLead && (
                      <p className="text-xs text-gray-500">{ev.vendorLead.vendorName}</p>
                    )}
                    <time
                      suppressHydrationWarning
                      className="mt-0.5 block text-xs text-gray-400/70"
                    >
                      {formatDistanceToNow(new Date(ev.createdAt), { addSuffix: true })}
                    </time>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors. In particular, `DashboardAnalytics` is no longer imported.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: update Dashboard page — DashboardKpiStrip, mini activity feed, remove DashboardAnalytics"
```

---

### Task 10: Update Activity page — PageHeader + investor activity section

**Files:**
- Modify: `app/dashboard/vendors/activity/page.tsx`

Context: Two changes: (1) replace raw `<h1>` with `PageHeader`; (2) add an "Investor Activity" section below the existing vendor events, fetched directly from Prisma (the page is already a server component, so no new API endpoint is needed). The `InvestorActivity` model exists in the schema with an `investor` relation and `user` sub-relation for names.

- [ ] **Step 1: Replace the full file**

```tsx
// app/dashboard/vendors/activity/page.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Clock, ArrowRight, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { PageHeader } from "@/components/ui/page-header"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "Activity — DealStack" }

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Email Offer Sent",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
  VALUATION_PENDING: "Valuation Pending",
}

function dotColor(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = details.toStage as string
    if (["OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"].includes(to))
      return "bg-green-500"
    if (["OFFER_REJECTED", "DEAD_LEAD"].includes(to)) return "bg-red-500"
    return "bg-blue-500"
  }
  if (eventType === "offer_accepted") return "bg-green-600"
  if (eventType === "offer_rejected") return "bg-red-500"
  if (eventType === "deal_validated") return "bg-green-500"
  if (eventType === "deal_rejected") return "bg-orange-500"
  if (eventType === "vendor_offer_sent") return "bg-yellow-500"
  return "bg-slate-400"
}

function eventTitle(eventType: string, details: Record<string, unknown>): string {
  if (eventType === "stage_transition") {
    const to = STAGE_LABELS[details.toStage as string] ?? details.toStage ?? "—"
    return `Stage → ${to}`
  }
  if (eventType === "vendor_offer_sent") {
    const channel = ((details.channel as string) ?? "").toUpperCase()
    const price = details.offerPrice ? ` £${Number(details.offerPrice).toLocaleString()}` : ""
    return `Offer sent via ${channel}${price}`
  }
  return eventType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function investorDotColor(activityType: string): string {
  if (["PURCHASE_COMPLETED", "RESERVATION_MADE"].includes(activityType)) return "bg-green-500"
  if (activityType === "RESERVATION_CANCELLED") return "bg-red-500"
  return "bg-blue-500"
}

export default async function VendorActivityPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [events, investorActivities] = await Promise.all([
    prisma.pipelineEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        eventType: true,
        details: true,
        createdAt: true,
        vendorLeadId: true,
        vendorLead: {
          select: { vendorName: true, propertyAddress: true, propertyPostcode: true },
        },
      },
    }),
    prisma.investorActivity.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        activityType: true,
        description: true,
        createdAt: true,
        investor: {
          select: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    }),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        subtitle="Recent pipeline events across all vendors and investors"
      />

      {/* Vendor pipeline events */}
      <div className="ds-card overflow-hidden">
        <div className="border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Clock className="h-4 w-4 text-[#2563EB]" />
            {events.length} vendor event{events.length !== 1 ? "s" : ""}
          </h3>
        </div>
        <div className="p-5">
          {events.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">No activity recorded yet</p>
          ) : (
            <ol className="relative ml-3 space-y-5 border-l border-[var(--ds-border)]">
              {events.map((ev) => {
                const details = (ev.details ?? {}) as Record<string, unknown>
                const color = dotColor(ev.eventType, details)
                const title = eventTitle(ev.eventType, details)
                const address = ev.vendorLead
                  ? [ev.vendorLead.propertyAddress, ev.vendorLead.propertyPostcode]
                      .filter(Boolean)
                      .join(", ")
                  : null
                return (
                  <li key={ev.id} className="group ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium leading-tight">{title}</p>
                        {ev.vendorLead && (
                          <p className="mt-0.5 text-xs text-gray-500">
                            {ev.vendorLead.vendorName}
                            {address && (
                              <span className="text-gray-400"> · {address}</span>
                            )}
                          </p>
                        )}
                        <time
                          suppressHydrationWarning
                          className="mt-0.5 block text-xs text-gray-400/70"
                        >
                          {new Date(ev.createdAt).toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      {ev.vendorLeadId && (
                        <Link
                          href={`/dashboard/vendors/${ev.vendorLeadId}/activity`}
                          className="flex shrink-0 items-center gap-1 text-xs text-[#2563EB] opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                        >
                          View <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>

      {/* Investor activity */}
      <div className="ds-card overflow-hidden">
        <div className="border-b border-[var(--ds-border)] px-5 py-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Users className="h-4 w-4 text-[#2563EB]" />
            {investorActivities.length} investor event{investorActivities.length !== 1 ? "s" : ""}
          </h3>
        </div>
        <div className="p-5">
          {investorActivities.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">
              No investor activity recorded yet
            </p>
          ) : (
            <ol className="relative ml-3 space-y-5 border-l border-[var(--ds-border)]">
              {investorActivities.map((act) => {
                const color = investorDotColor(act.activityType)
                const name = [
                  act.investor.user.firstName,
                  act.investor.user.lastName,
                ]
                  .filter(Boolean)
                  .join(" ") || act.investor.user.email
                return (
                  <li key={act.id} className="ml-5">
                    <span
                      className={cn(
                        "absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-background",
                        color
                      )}
                    />
                    <p className="text-sm font-medium leading-tight">{name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {act.description ||
                        act.activityType.replace(/_/g, " ").toLowerCase()}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {act.activityType}
                      </Badge>
                      <time
                        suppressHydrationWarning
                        className="text-xs text-gray-400/70"
                      >
                        {new Date(act.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -20
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/vendors/activity/page.tsx
git commit -m "feat: update Activity page — PageHeader, investor activity section"
```

---

## Final verification

After all 10 tasks:

```bash
npx tsc --noEmit 2>&1 | grep -v ".next" | head -30
```

Expected: zero TypeScript errors.

Visually verify in browser:
- Dashboard: KPI strip loads (brief spinner → 4 KPI cards), date picker appears top-right of KPIs, changing date updates counts, "View all" link works, DashboardAnalytics tabs are gone
- Statistics: "Vendor Pipeline" and "Investor Pipeline" tabs visible, date filter in top-right, vendor analytics render, investor analytics render, no "Recent Activity" section
- Activity: both "N vendor events" and "N investor events" sections visible, PageHeader with updated subtitle
