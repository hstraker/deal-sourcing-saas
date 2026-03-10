# Comparables Page Enhancement Design

**Goal:** Upgrade the existing `/dashboard/comparables` jump-off list into an operational comparables management hub — showing status, counts, and last-check timestamps per lead, with inline Recheck and Comparable popup actions.

**Date:** 2026-03-10

---

## Context

The existing page (`app/dashboard/comparables/page.tsx` + `comparables-list-client.tsx`) is a basic searchable list. Each row navigates to `/dashboard/vendors/[id]/comparables` (a route that doesn't exist). It shows no comparables status, no counts, and no actions.

The `VendorLead` model already tracks comparables summary fields:
- `comparablesCount Int?` — number of fetched comparables
- `comparablesFetchedAt DateTime?` — timestamp of last fetch
- `comparablesConfidence String?` — `"HIGH"` | `"MEDIUM"` | `"LOW"`
- `avgComparablePrice Decimal?` — computed average sale price from last fetch

The `VendorComparablesTab` component (`components/vendors/vendor-comparables-tab.tsx`) is a fully self-contained tab that handles fetching, displaying, and configuring comparables for a single lead. It accepts `vendorLeadId`, `askingPrice?`, and `propertyPostcode?` props. It will be reused inside a Dialog for the Comparable popup.

The fetch API is `POST /api/vendor-leads/[id]/fetch-comparables` (body: `{ forceRefresh: boolean }`). The response includes updated summary stats.

---

## Files Modified

| Action | Path |
|--------|------|
| Rewrite | `app/dashboard/comparables/page.tsx` — add comparables summary fields to Prisma select |
| Rewrite | `app/dashboard/comparables/comparables-list-client.tsx` — new table, filter chips, Dialog, Recheck action |

No new files needed. The nav href `/dashboard/comparables` stays unchanged.

---

## Server Component Changes (`page.tsx`)

Add these fields to the Prisma `select`:
```ts
comparablesCount:       true,
comparablesFetchedAt:   true,
comparablesConfidence:  true,
avgComparablePrice:     true,
estimatedMonthlyRent:   true,   // for display in the popup (passed to VendorComparablesTab via askingPrice prop)
```

Add serialisation:
```ts
comparablesFetchedAt: l.comparablesFetchedAt?.toISOString() ?? null,
avgComparablePrice:   l.avgComparablePrice ? Number(l.avgComparablePrice) : null,
estimatedMonthlyRent: l.estimatedMonthlyRent ? Number(l.estimatedMonthlyRent) : null,
```

Keep existing Decimal serialisation for `askingPrice` and `estimatedMarketValue`.

---

## Client Component Rewrite (`comparables-list-client.tsx`)

### Updated `Lead` interface

```ts
interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyType: string | null
  bedrooms: number | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  estimatedMonthlyRent: number | null
  pipelineStage: string
  // New comparables summary fields:
  comparablesCount: number | null
  comparablesFetchedAt: string | null   // ISO string
  comparablesConfidence: string | null  // "HIGH" | "MEDIUM" | "LOW"
  avgComparablePrice: number | null
}
```

### State

```ts
const [leads, setLeads] = useState<Lead[]>(initialLeads)   // local copy, updated by Recheck
const [search, setSearch] = useState("")
const [statusFilter, setStatusFilter] = useState<string>("All")  // "All" | "Not Fetched" | "High" | "Medium" | "Low"
const [recheckingId, setRecheckingId] = useState<string | null>(null)
const [popupLead, setPopupLead] = useState<Lead | null>(null)    // the lead whose popup is open
```

### Filter chips

```
All | Not Fetched | High | Medium | Low
```

Filter logic:
- `"Not Fetched"` → `comparablesFetchedAt === null`
- `"High"` → `comparablesConfidence === "HIGH"`
- `"Medium"` → `comparablesConfidence === "MEDIUM"`
- `"Low"` → `comparablesConfidence === "LOW"`

### Table columns

| Column | Notes |
|--------|-------|
| Vendor | Name + avatar initial (existing) |
| Property | Address + postcode, type, beds (existing) |
| Asking Price | Formatted (existing) |
| Status | Confidence badge: High (emerald) / Medium (amber) / Low (red) / Not Fetched (gray) |
| Avg Price | `avgComparablePrice` formatted, "—" if null |
| # Comps | `comparablesCount ?? "—"` |
| Last Checked | `comparablesFetchedAt` as "X days ago" / "Never" |
| Actions | Two buttons (see below) |

Remove the old "Market Value" column. Remove the row `onClick` navigation (replaced by the Comparable button).

### Action buttons

**Comparable button:**
- Label: "Comparable" + BarChart3 icon
- `onClick`: set `popupLead = lead`
- Opens the Dialog containing `VendorComparablesTab`

**Recheck button:**
- Label: "Recheck" + RefreshCw icon (spinner when loading)
- `disabled`: when `recheckingId === lead.id`
- `onClick`:
  1. `setRecheckingId(lead.id)`
  2. `POST /api/vendor-leads/[id]/fetch-comparables` with body `{ forceRefresh: true }`
  3. On success: update the lead row in local state with fresh stats from response (see below)
  4. On error: show error toast
  5. `setRecheckingId(null)`

### Recheck response → state update

The successful API response shape is:
```json
{
  "success": true,
  "data": {
    "count": number,
    "avgPrice": number | null,
    "confidence": "HIGH" | "MEDIUM" | "LOW",
    ...
  }
}
```

`comparablesFetchedAt` is **not** in the response — synthesise it client-side as `new Date().toISOString()` on success.

Update the specific lead in state:
```ts
setLeads(prev => prev.map(l =>
  l.id === lead.id
    ? {
        ...l,
        comparablesCount:      data.data.count,
        comparablesConfidence: data.data.confidence,
        avgComparablePrice:    data.data.avgPrice,
        comparablesFetchedAt:  new Date().toISOString(),
      }
    : l
))
```

Show a success toast: `"Comparables refreshed — ${data.data.count} comparables found"`

### Comparable popup (Dialog)

```tsx
<Dialog open={!!popupLead} onOpenChange={(open) => { if (!open) setPopupLead(null) }}>
  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>Comparables — {popupLead?.propertyAddress ?? popupLead?.vendorName}</DialogTitle>
    </DialogHeader>
    {popupLead && (
      <VendorComparablesTab
        vendorLeadId={popupLead.id}
        askingPrice={popupLead.askingPrice ?? undefined}
        propertyPostcode={popupLead.propertyPostcode ?? undefined}
      />
    )}
  </DialogContent>
</Dialog>
```

The `VendorComparablesTab` component manages its own state (fetch, display, settings). No props changes needed.

After the user fetches comparables from inside the popup, the row stats in the list won't auto-update (the tab manages its own state). This is acceptable — the Recheck button on the row handles quick refreshes. If this becomes an issue, a future enhancement can add a callback.

---

## Confidence Badge Colours

| Value | Badge |
|-------|-------|
| `"HIGH"` | `bg-emerald-100 text-emerald-700 border-emerald-200` |
| `"MEDIUM"` | `bg-amber-100 text-amber-700 border-amber-200` |
| `"LOW"` | `bg-red-100 text-red-700 border-red-200` |
| null (never fetched) | `bg-gray-100 text-gray-500 border-gray-200` — label "Not Fetched" |

---

## Empty State

If `leads.length === 0` (no leads at all): show centred message "No vendor leads found."
If `filtered.length === 0` (filters active): show "No leads match your filters."
