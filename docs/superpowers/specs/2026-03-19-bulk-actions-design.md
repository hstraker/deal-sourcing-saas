# Bulk Actions for Vendor Leads Table — Design Spec

## Goal

Allow users to select multiple vendor leads and run a tab-specific action (Portal Check, Validation, Comparables, Offer Analysis) on all selected leads simultaneously, with capped parallelism to avoid rate-limiting external APIs.

---

## Context

### Existing architecture

- `vendor-leads-table.tsx` (~1282 lines) contains all table logic in one file
- `handleCheck(leadId, endpoint, successMsg)` fires a single POST request per lead
- `checkingIds: Set<string>` tracks which leads are currently processing (used to show per-row spinners)
- `checkEndpoints` maps each `TabId` to `{ endpoint, msg }` — constructed inside the row `.map()` loop
- All API endpoints use `/[id]/` path segments — no bulk endpoints exist
- Tabs with check actions: `portal-check`, `validation`, `comparable`, `offer-analysis`
- Tabs without check actions: `map-view`, `property-details`

### Tab → endpoint mapping

| Tab | Endpoint | Success message |
|-----|----------|----------------|
| `portal-check` | `POST /api/vendor-pipeline/leads/:id/run-check` | "Portal check started" |
| `validation` | `POST /api/vendor-leads/:id/calculate-bmv` | "BMV calculation complete" |
| `comparable` | `POST /api/vendor-leads/:id/fetch-comparables` | "Comparables fetched" |
| `offer-analysis` | `POST /api/vendor-leads/:id/calculate-bmv` | "Offer calculated" |

---

## Design

### 1. Selection state

Add a single piece of state to `VendorLeadsTable`:

```tsx
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
```

- Persists when switching tabs (allows selecting across tab contexts)
- Cleared automatically when a bulk run completes successfully
- Not cleared on tab switch or filter change (deliberate — user may want to select then switch tabs)

---

### 2. Checkbox column

Add a `w-10` checkbox column as the **first column** on every tab, before the existing sticky-left vendor name column.

**Header checkbox behaviour:**

| State | Visual | Click action |
|-------|--------|-------------|
| None selected | Unchecked | Select all visible leads |
| Some selected | Indeterminate (dash) | Select all visible leads |
| All selected | Checked | Clear all |

**Row checkbox behaviour:**
- Clicking toggles the lead in/out of `selectedIds`
- Selected rows receive `bg-blue-50` row background (replaces default hover `bg-gray-50`)
- Checkbox uses `accent-color` blue to match the table's blue primary colour

**Implementation note:** The checkbox column must be added to every `TableHeaders` case and every tab's row renderer. The header checkbox uses `ref` with `indeterminate` property set imperatively (React does not support `indeterminate` as a prop).

**Sticky offset adjustment:** The existing `VendorNameCell` uses `sticky left-0` and `AddressCell` uses `sticky left-[180px]`. Prepending the `w-10` (40px) checkbox column shifts both: update to `sticky left-[40px]` and `sticky left-[220px]` respectively.

---

### 3. Floating bottom bar

A `BulkActionBar` component rendered **inside the table card div**, below the `<table>` element, above any existing footer strip. Conditionally visible when `selectedIds.size > 0`. It renders in normal document flow (not `position: fixed/sticky`) — it sits at the bottom of the card and scrolls with the page. The "floating" appearance comes from the dark background contrasting with the white table above it, not from CSS positioning.

```tsx
interface BulkActionBarProps {
  selectedCount: number
  activeTab: TabId
  isRunning: boolean
  progress: { done: number; total: number } | null
  onRun: () => void
  onClear: () => void
}
```

**Visual spec:**
- Background: `bg-[#1e293b]` (matches modal left panel dark colour)
- Text: `text-slate-200`
- Layout: `flex items-center justify-between px-4 py-3`
- Left side: `"{N} leads selected"`
- Right side: Run button + Clear link

**Run button label by tab:**

| Tab | Button label |
|-----|-------------|
| `portal-check` | `⚡ Run Portal Check on {N}` |
| `validation` | `⚡ Run Validation on {N}` |
| `comparable` | `⚡ Fetch Comparables for {N}` |
| `offer-analysis` | `⚡ Run Offer Analysis on {N}` |
| `map-view`, `property-details` | *(button hidden — no bulk action for these tabs)* |

**While running:**
- Button label: `"Running… ({done}/{total})"` with `Loader2` spinner
- Button disabled
- Clear link hidden

---

### 4. Bulk execution — `handleBulkCheck`

```tsx
const handleBulkCheck = useCallback(async () => {
  const ids = Array.from(selectedIds)
  const cfg = BULK_CHECK_ENDPOINTS[activeTab]
  if (!cfg || ids.length === 0) return

  const CONCURRENCY = 3
  let done = 0
  let failed = 0
  setBulkRunning(true)
  setBulkProgress({ done: 0, total: ids.length })

  // Process in batches of CONCURRENCY
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const batch = ids.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (id) => {
        setCheckingIds((prev) => new Set(prev).add(id))
        try {
          const endpoint = cfg.endpoint(id)
          const res = await fetch(endpoint, { method: "POST" })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error(err.error || `Failed (${res.status})`)
          }
          done++
        } catch (err: any) {
          failed++
          toast.error(`${id.slice(0, 6)}… — ${err.message}`)
        } finally {
          setCheckingIds((prev) => { const n = new Set(prev); n.delete(id); return n })
          setBulkProgress({ done: done + failed, total: ids.length })
        }
      })
    )
  }

  await fetchLeads()
  setBulkRunning(false)
  setBulkProgress(null)
  setSelectedIds(new Set())

  if (failed === 0) {
    toast.success(`${done}/${ids.length} ${cfg.successMsg}`)
  } else {
    toast.warning(`${done}/${ids.length} complete — ${failed} failed`)
  }
}, [selectedIds, activeTab, fetchLeads])
```

**State additions:**

```tsx
const [bulkRunning, setBulkRunning] = useState(false)
const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
```

**`BULK_CHECK_ENDPOINTS` constant** (defined outside the component, unlike the per-row `checkEndpoints` which is built inside `.map()`):

```tsx
const BULK_CHECK_ENDPOINTS: Partial<Record<TabId, {
  endpoint: (id: string) => string
  successMsg: string
}>> = {
  "portal-check":   { endpoint: (id) => `/api/vendor-pipeline/leads/${id}/run-check`,   successMsg: "portal checks started" },
  "validation":     { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,          successMsg: "validations complete" },
  "comparable":     { endpoint: (id) => `/api/vendor-leads/${id}/fetch-comparables`,       successMsg: "comparables fetched" },
  "offer-analysis": { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,          successMsg: "offer analyses complete" },
}
```

---

### 5. Error handling

| Scenario | Behaviour |
|----------|-----------|
| All succeed | Single success toast: `"5/5 validations complete"` |
| Some fail | Warning toast: `"3/5 complete — 2 failed"` + individual error toasts per failure |
| All fail | Warning toast: `"0/5 complete — 5 failed"` + individual error toasts |
| Network offline | Individual error toasts, same summary |
| Tab with no bulk action | Run button hidden in bar; only count + Clear shown |

---

### 6. Files changed

| File | Change |
|------|--------|
| `components/vendors/vendor-leads-table.tsx` | All changes — `selectedIds`, `bulkRunning`, `bulkProgress` state; `BULK_CHECK_ENDPOINTS` constant; `handleBulkCheck` function; checkbox column in `TableHeaders` + all row renderers; `BulkActionBar` component; wire-up |

No new files required. No API changes required.

---

## Out of scope

- Bulk archive / bulk delete (separate feature)
- Persisting selection across page refresh
- Selecting leads across multiple pages (table loads all 200 at once anyway)
- Progress bar / ETA estimate
