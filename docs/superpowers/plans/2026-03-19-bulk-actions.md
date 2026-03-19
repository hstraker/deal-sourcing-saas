# Bulk Actions for Vendor Leads Table — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add row-selection checkboxes and a floating dark bottom bar to the vendor leads table so users can select multiple leads and run the tab-specific action (Portal Check, Validation, Comparables, Offer Analysis) on all selected leads simultaneously at 3-at-a-time concurrency.

**Architecture:** All changes live in `components/vendors/vendor-leads-table.tsx`. A `BULK_CHECK_ENDPOINTS` constant (outside the component) maps tab IDs to endpoint factory functions. A `BulkActionBar` sub-component renders the dark bottom bar. `handleBulkCheck` processes selected leads in batches of 3 using `Promise.allSettled`, reusing the existing `checkingIds` Set for per-row spinners.

**Tech Stack:** Next.js 14 App Router, React, TypeScript, Tailwind CSS, Lucide React (`Zap`, `Loader2` already imported), Sonner toasts

---

## File Structure

| File | Change |
|------|--------|
| `components/vendors/vendor-leads-table.tsx` | Only file modified. Adds: `BULK_CHECK_ENDPOINTS` constant, `BulkActionBar` component, 3 state vars, `handleBulkCheck`, checkbox column in `TableHeaders` + all 6 row renderers, sticky offset fixes, bottom bar render. |

---

## Chunk 1: BulkActionBar component + new state + handleBulkCheck

### Task 1: Add BULK_CHECK_ENDPOINTS constant and BulkActionBar component

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` — insert before line ~984 (`// ─── Main Component ───`)

- [ ] **Step 1: Insert `BULK_CHECK_ENDPOINTS`, `BULK_ACTION_LABELS`, `BulkActionBarProps`, and `BulkActionBar` just before the `// ─────────────────────────────────────────────────────────────────────────────\n// Main Component` comment block**

Find this exact text in the file:
```
// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
```

Insert the following block immediately before it:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// Bulk Action constants + BulkActionBar
// ─────────────────────────────────────────────────────────────────────────────

const BULK_CHECK_ENDPOINTS: Partial<Record<TabId, {
  endpoint: (id: string) => string
  successMsg: string
}>> = {
  "portal-check":   { endpoint: (id) => `/api/vendor-pipeline/leads/${id}/run-check`,  successMsg: "portal checks started" },
  "validation":     { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,        successMsg: "validations complete" },
  "comparable":     { endpoint: (id) => `/api/vendor-leads/${id}/fetch-comparables`,    successMsg: "comparables fetched" },
  "offer-analysis": { endpoint: (id) => `/api/vendor-leads/${id}/calculate-bmv`,        successMsg: "offer analyses complete" },
}

const BULK_ACTION_LABELS: Partial<Record<TabId, string>> = {
  "portal-check":   "Run Portal Check",
  "validation":     "Run Validation",
  "comparable":     "Fetch Comparables",
  "offer-analysis": "Run Offer Analysis",
}

interface BulkActionBarProps {
  selectedCount: number
  activeTab: TabId
  isRunning: boolean
  progress: { done: number; total: number } | null
  onRun: () => void
  onClear: () => void
}

function BulkActionBar({ selectedCount, activeTab, isRunning, progress, onRun, onClear }: BulkActionBarProps) {
  const actionLabel = BULK_ACTION_LABELS[activeTab]
  return (
    <div className="flex items-center justify-between bg-[#1e293b] px-4 py-3">
      <span className="text-sm font-medium text-slate-200">
        {selectedCount} lead{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div className="flex items-center gap-4">
        {actionLabel && (
          <button
            onClick={onRun}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {progress ? `Running… (${progress.done}/${progress.total})` : "Running…"}
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                {`${actionLabel} on ${selectedCount}`}
              </>
            )}
          </button>
        )}
        {!isRunning && (
          <button onClick={onClear} className="text-sm text-slate-400 hover:text-slate-200">
            ✕ Clear
          </button>
        )}
      </div>
    </div>
  )
}

```

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (exit code 0).

- [ ] **Step 3: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: add BULK_CHECK_ENDPOINTS constant and BulkActionBar component"
```

---

### Task 2: Add selection state and handleBulkCheck to VendorLeadsTable

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` — inside `VendorLeadsTable` function

- [ ] **Step 1: Add 3 new state variables after existing state declarations**

Find this exact line (around line 999):
```tsx
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
```

Insert immediately after it:

```tsx
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null)
```

- [ ] **Step 2: Add handleBulkCheck after the existing handleCheck function**

Find this exact text (around line 1045):
```tsx
  }, [fetchLeads])

  // ── Poll RUNNING leads every 3 seconds ────────────────────────────────────
```

Insert the following block between `}, [fetchLeads])` and the Poll comment:

```tsx
  // ── Bulk tab-specific check action ───────────────────────────────────────
  const handleBulkCheck = useCallback(async () => {
    const ids = Array.from(selectedIds)
    const cfg = BULK_CHECK_ENDPOINTS[activeTab]
    if (!cfg || ids.length === 0) return

    const CONCURRENCY = 3
    let done = 0
    let failed = 0
    setBulkRunning(true)
    setBulkProgress({ done: 0, total: ids.length })

    for (let i = 0; i < ids.length; i += CONCURRENCY) {
      const batch = ids.slice(i, i + CONCURRENCY)
      await Promise.allSettled(
        batch.map(async (id) => {
          setCheckingIds((prev) => new Set(prev).add(id))
          try {
            const res = await fetch(cfg.endpoint(id), { method: "POST" })
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

- [ ] **Step 3: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: add selectedIds state and handleBulkCheck with 3-concurrency batching"
```

---

## Chunk 2: TableHeaders + sticky offsets + RowRendererProps + row renderers

### Task 3: Update TableHeaders with checkbox column and fix sticky offsets

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` — `TableHeaders`, `VendorNameCell`, `AddressCell`

- [ ] **Step 1: Update VendorNameCell sticky class from `left-0` to `left-[40px]`**

Find:
```tsx
function VendorNameCell({ lead }: { lead: VendorLead }) {
  return (
    <td className="sticky left-0 z-10 w-[180px] bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
```

Replace with:
```tsx
function VendorNameCell({ lead }: { lead: VendorLead }) {
  return (
    <td className="sticky left-[40px] z-10 w-[180px] bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
```

- [ ] **Step 2: Update AddressCell sticky class from `left-[180px]` to `left-[220px]`**

Find:
```tsx
    <td className="sticky left-[180px] z-10 max-w-[200px] border-r border-gray-200 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
```

Replace with:
```tsx
    <td className="sticky left-[220px] z-10 max-w-[200px] border-r border-gray-200 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
```

- [ ] **Step 3: Replace the entire TableHeaders function**

Find the entire `TableHeaders` function (from `function TableHeaders` through the closing `}`), currently:

```tsx
function TableHeaders({ tab }: { tab: TabId }) {
  const stickyLeft = <Th className="sticky left-0 z-10 w-[180px] bg-[#f9fafb]">Vendor Name</Th>
  const addressHeader = <Th className="sticky left-[180px] z-10 border-r border-gray-200 bg-[#f9fafb]">Address</Th>
  const stickyRight = <Th className="sticky right-0 z-10 bg-[#f9fafb]">Actions</Th>

  switch (tab) {
    case "map-view":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Postcode</Th><Th>Type</Th><Th>Status</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "property-details":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th><Th>Tenure</Th>
        <Th>Asking Price</Th><Th>Market Value</Th><Th>Rental</Th><Th>BMV %</Th>
        <Th>Bed/Bath</Th><Th>Finish</Th>
        {stickyRight}
      </tr>

    case "portal-check":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Rightmove</Th><Th>Zoopla</Th><Th>OnTheMarket</Th><Th>Primelocation</Th>
        <Th>Ownership</Th><Th>Tenure</Th><Th>Owner Type</Th><Th>Company</Th>
        {stickyRight}
      </tr>

    case "validation":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>AVG Rental</Th><Th>Asking Price</Th><Th>AVG Sale Price</Th><Th>AVG Yield</Th>
        <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC</Th><Th>EPC Due</Th><Th>EST Rental</Th>
        {stickyRight}
      </tr>

    case "comparable":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>No. Comps</Th><Th>AVG Rental</Th><Th>AVG Yield</Th><Th>AVG Sale Price</Th>
        <Th>Range</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "offer-analysis":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Asking Price</Th><Th>Initial Offer</Th><Th>Next Offer</Th><Th>Final Offer</Th>
        <Th>No. Offers</Th><Th>Email Sent</Th>
        {stickyRight}
      </tr>

    default:
      return null
  }
}
```

Replace with:

```tsx
function TableHeaders({ tab, allSelected, someSelected, onSelectAll }: {
  tab: TabId
  allSelected: boolean
  someSelected: boolean
  onSelectAll: () => void
}) {
  const checkboxRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = someSelected && !allSelected
    }
  }, [someSelected, allSelected])

  const selectAllTh = (
    <th className="sticky left-0 z-10 w-10 bg-[#f9fafb] px-3 py-2.5">
      <input
        ref={checkboxRef}
        type="checkbox"
        checked={allSelected}
        onChange={onSelectAll}
        className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
      />
    </th>
  )
  const stickyLeft = <Th className="sticky left-[40px] z-10 w-[180px] bg-[#f9fafb]">Vendor Name</Th>
  const addressHeader = <Th className="sticky left-[220px] z-10 border-r border-gray-200 bg-[#f9fafb]">Address</Th>
  const stickyRight = <Th className="sticky right-0 z-10 bg-[#f9fafb]">Actions</Th>

  switch (tab) {
    case "map-view":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Postcode</Th><Th>Type</Th><Th>Status</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "property-details":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th><Th>Tenure</Th>
        <Th>Asking Price</Th><Th>Market Value</Th><Th>Rental</Th><Th>BMV %</Th>
        <Th>Bed/Bath</Th><Th>Finish</Th>
        {stickyRight}
      </tr>

    case "portal-check":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Rightmove</Th><Th>Zoopla</Th><Th>OnTheMarket</Th><Th>Primelocation</Th>
        <Th>Ownership</Th><Th>Tenure</Th><Th>Owner Type</Th><Th>Company</Th>
        {stickyRight}
      </tr>

    case "validation":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>AVG Rental</Th><Th>Asking Price</Th><Th>AVG Sale Price</Th><Th>AVG Yield</Th>
        <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC</Th><Th>EPC Due</Th><Th>EST Rental</Th>
        {stickyRight}
      </tr>

    case "comparable":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>No. Comps</Th><Th>AVG Rental</Th><Th>AVG Yield</Th><Th>AVG Sale Price</Th>
        <Th>Range</Th><Th>BMV %</Th>
        {stickyRight}
      </tr>

    case "offer-analysis":
      return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
        {selectAllTh}
        {stickyLeft}
        {addressHeader}
        <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
        <Th>Asking Price</Th><Th>Initial Offer</Th><Th>Next Offer</Th><Th>Final Offer</Th>
        <Th>No. Offers</Th><Th>Email Sent</Th>
        {stickyRight}
      </tr>

    default:
      return null
  }
}
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: TypeScript will report errors because `TableHeaders` is now called with only `tab` in the main render. That is expected — those wiring errors will be fixed in Task 5. Confirm the errors are ONLY about the `TableHeaders` call site and new missing props (not unrelated errors).

- [ ] **Step 5: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: add checkbox column to TableHeaders, fix sticky offsets for VendorNameCell/AddressCell"
```

---

### Task 4: Add checkbox to RowRendererProps and all 6 row renderers

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` — `RowRendererProps` + 6 row renderer functions

- [ ] **Step 1: Add `isSelected` and `onToggleSelect` to RowRendererProps**

Find:
```tsx
interface RowRendererProps {
  lead: VendorLead
  onRowClick: () => void
  onView: () => void
  onArchive: () => void
  onDelete: () => void
  onCheck?: () => void
  isChecking?: boolean
}
```

Replace with:
```tsx
interface RowRendererProps {
  lead: VendorLead
  onRowClick: () => void
  onView: () => void
  onArchive: () => void
  onDelete: () => void
  onCheck?: () => void
  isChecking?: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
}
```

- [ ] **Step 2: Add checkbox td helper comment (for reference)**

Note: each row renderer needs a checkbox `<td>` as the first cell, with this structure:

```tsx
<td
  className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]"
  onClick={(e) => e.stopPropagation()}
>
  <input
    type="checkbox"
    checked={!!isSelected}
    onChange={() => onToggleSelect?.()}
    className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
  />
</td>
```

The `onClick` stopPropagation prevents the row's `onRowClick` from firing when clicking the checkbox.

- [ ] **Step 3: Update MapViewRow**

Find:
```tsx
function MapViewRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  return (
    <tr
      className="group cursor-pointer border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]"
      onClick={onRowClick}
    >
      <VendorNameCell lead={lead} />
```

Replace with:
```tsx
function MapViewRow({ lead, onRowClick, onView, onArchive, onDelete, isSelected, onToggleSelect }: RowRendererProps) {
  return (
    <tr
      className={cn("group cursor-pointer border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}
      onClick={onRowClick}
    >
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 4: Update PropertyDetailsRow**

Find:
```tsx
function PropertyDetailsRow({ lead, onRowClick, onView, onArchive, onDelete }: RowRendererProps) {
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

Replace with:
```tsx
function PropertyDetailsRow({ lead, onRowClick, onView, onArchive, onDelete, isSelected, onToggleSelect }: RowRendererProps) {
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 5: Update PortalCheckRow**

Find:
```tsx
function PortalCheckRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking }: RowRendererProps) {
  const ownership = lead.latestPortalCheck?.ownershipCheckRaw as any
  const ownerType = ownership?.isCorporateOwned
    ? ownership?.isOverseasOwned ? "Overseas Corp" : "Corporate"
    : ownership ? "Private" : null
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

Replace with:
```tsx
function PortalCheckRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  const ownership = lead.latestPortalCheck?.ownershipCheckRaw as any
  const ownerType = ownership?.isCorporateOwned
    ? ownership?.isOverseasOwned ? "Overseas Corp" : "Corporate"
    : ownership ? "Private" : null
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 6: Update ValidationRow**

Find:
```tsx
function ValidationRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking }: RowRendererProps) {
  // Gross monthly cashflow ≈ rent - 20% expenses (rough estimate)
  const rentNum = toNum(lead.estimatedMonthlyRent)
  const cashflow = rentNum ? rentNum * 0.8 : null
  // Rental yield from annual rent / asking price
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const yieldPct = annualRent && price ? (annualRent / price) * 100 : null

  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

Replace with:
```tsx
function ValidationRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  // Gross monthly cashflow ≈ rent - 20% expenses (rough estimate)
  const rentNum = toNum(lead.estimatedMonthlyRent)
  const cashflow = rentNum ? rentNum * 0.8 : null
  // Rental yield from annual rent / asking price
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const yieldPct = annualRent && price ? (annualRent / price) * 100 : null

  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 7: Update ComparableRow**

Find:
```tsx
function ComparableRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking }: RowRendererProps) {
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const avgPrice = toNum(lead.avgComparablePrice)
  const yieldPct = annualRent && price ? (annualRent / price) * 100 : null
  // Price range: show "—" until comparables are fetched (no min/max on lead model)
  const hasComps = (lead.comparablesCount ?? 0) > 0

  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

Replace with:
```tsx
function ComparableRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
  const annualRent = toNum(lead.estimatedAnnualRent)
  const price = toNum(lead.askingPrice)
  const avgPrice = toNum(lead.avgComparablePrice)
  const yieldPct = annualRent && price ? (annualRent / price) * 100 : null
  // Price range: show "—" until comparables are fetched (no min/max on lead model)
  const hasComps = (lead.comparablesCount ?? 0) > 0

  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 8: Update OfferAnalysisRow**

Find:
```tsx
function OfferAnalysisRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking }: RowRendererProps) {
  // Build offer chain: initial offer → retries → current offer
```

(then the row starts with)
```tsx
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

Replace the function signature line:
```tsx
function OfferAnalysisRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking }: RowRendererProps) {
```

with:
```tsx
function OfferAnalysisRow({ lead, onRowClick, onView, onArchive, onDelete, onCheck, isChecking, isSelected, onToggleSelect }: RowRendererProps) {
```

And replace the `<tr>` opening + first cell:
```tsx
  return (
    <tr className="group border-b border-[#f3f4f6] transition-colors hover:bg-[#f3f4f6]">
      <VendorNameCell lead={lead} />
```

with:
```tsx
  return (
    <tr className={cn("group border-b border-[#f3f4f6] transition-colors", isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-[#f3f4f6]")}>
      <td className="sticky left-0 z-10 w-10 bg-white px-3 py-[11px] group-hover:bg-[#f3f4f6]" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={!!isSelected} onChange={() => onToggleSelect?.()} className="h-3.5 w-3.5 cursor-pointer accent-blue-600" />
      </td>
      <VendorNameCell lead={lead} />
```

- [ ] **Step 9: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: errors only about `TableHeaders` missing props (from Task 3 Step 4). No row renderer errors.

- [ ] **Step 10: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: add checkbox column to all 6 row renderers with blue selected state"
```

---

## Chunk 3: Wiring — selection logic, TableHeaders call, BulkActionBar render

### Task 5: Wire selection state into main render

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx` — inside `VendorLeadsTable` render

- [ ] **Step 1: Add derived selection variables after `visibleLeads`**

Find:
```tsx
  const kpis = computeKpis(leads)
  const visibleLeads = leads.filter((l) => !l.archivedAt)
```

Replace with:
```tsx
  const kpis = computeKpis(leads)
  const visibleLeads = leads.filter((l) => !l.archivedAt)
  const allVisibleSelected = visibleLeads.length > 0 && visibleLeads.every((l) => selectedIds.has(l.id))
  const someVisibleSelected = visibleLeads.some((l) => selectedIds.has(l.id))
  const handleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(visibleLeads.map((l) => l.id)))
    }
  }
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }
```

- [ ] **Step 2: Update the TableHeaders call site to pass new props**

Find:
```tsx
            <thead>
              <TableHeaders tab={activeTab} />
            </thead>
```

Replace with:
```tsx
            <thead>
              <TableHeaders
                tab={activeTab}
                allSelected={allVisibleSelected}
                someSelected={someVisibleSelected}
                onSelectAll={handleSelectAll}
              />
            </thead>
```

- [ ] **Step 3: Add isSelected and onToggleSelect to rowProps**

Find:
```tsx
                const rowProps: RowRendererProps = {
                  lead,
                  onRowClick: () => {
                    if (activeTab === "map-view") setMapLead(lead)
                  },
                  onView: () => {
                    if (activeTab === "property-details") {
                      setPropertyDetailsModalLead(lead)
                    } else if (activeTab === "portal-check") {
                      setPortalCheckModalLead(lead)
                    } else if (activeTab === "validation") {
                      setValidationModalLead(lead)
                    } else if (activeTab === "comparable") {
                      setComparableModalLead(lead)
                    } else if (activeTab === "offer-analysis") {
                      setOfferModalLead(lead)
                    } else {
                      router.push(`/dashboard/vendors/${lead.id}/contact`)
                    }
                  },
                  onArchive: () => handleArchive(lead.id),
                  onDelete: () => handleDelete(lead.id),
                  onCheck: checkCfg
                    ? () => handleCheck(lead.id, checkCfg.endpoint, checkCfg.msg)
                    : undefined,
                  isChecking: checkingIds.has(lead.id),
                }
```

Replace with:
```tsx
                const rowProps: RowRendererProps = {
                  lead,
                  onRowClick: () => {
                    if (activeTab === "map-view") setMapLead(lead)
                  },
                  onView: () => {
                    if (activeTab === "property-details") {
                      setPropertyDetailsModalLead(lead)
                    } else if (activeTab === "portal-check") {
                      setPortalCheckModalLead(lead)
                    } else if (activeTab === "validation") {
                      setValidationModalLead(lead)
                    } else if (activeTab === "comparable") {
                      setComparableModalLead(lead)
                    } else if (activeTab === "offer-analysis") {
                      setOfferModalLead(lead)
                    } else {
                      router.push(`/dashboard/vendors/${lead.id}/contact`)
                    }
                  },
                  onArchive: () => handleArchive(lead.id),
                  onDelete: () => handleDelete(lead.id),
                  onCheck: checkCfg
                    ? () => handleCheck(lead.id, checkCfg.endpoint, checkCfg.msg)
                    : undefined,
                  isChecking: checkingIds.has(lead.id),
                  isSelected: selectedIds.has(lead.id),
                  onToggleSelect: () => handleToggleSelect(lead.id),
                }
```

- [ ] **Step 4: Add BulkActionBar between the closing `</div>` of the overflow-x-auto div and the Footer comment**

Find:
```tsx
        </div>

        {/* Footer */}
        {!loading && leads.some((l) => l.processingStatus === "RUNNING") && (
```

Replace with:
```tsx
        </div>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <BulkActionBar
            selectedCount={selectedIds.size}
            activeTab={activeTab}
            isRunning={bulkRunning}
            progress={bulkProgress}
            onRun={handleBulkCheck}
            onClear={() => setSelectedIds(new Set())}
          />
        )}

        {/* Footer */}
        {!loading && leads.some((l) => l.processingStatus === "RUNNING") && (
```

- [ ] **Step 5: Verify TypeScript — no errors expected**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (exit code 0). All prior type errors from Tasks 3-4 should now be resolved.

- [ ] **Step 6: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "$(cat <<'EOF'
feat: wire bulk action selection and BulkActionBar into vendor leads table

- Checkbox column on all tabs with select-all header (indeterminate state)
- Blue row highlight when selected
- Dark floating bottom bar shows when rows selected
- Tab-aware Run button fires 3-concurrent batch actions on selected leads
- Progress counter updates during run, auto-clears selection on completion
EOF
)"
```

---

## Manual Verification

1. `npm run dev` → navigate to `/dashboard/vendors`
2. Confirm checkbox column appears as first column on every tab
3. Check select-all: click header checkbox → all rows tick, header shows checked; click again → all clear
4. Check indeterminate: select 2 of 5 rows → header shows dash (—)
5. Selected rows show blue tint (`bg-blue-50`)
6. Switch tab with rows selected → selection persists
7. Select 2+ leads on **Validation** tab → dark bottom bar appears: `"2 leads selected"` + `"⚡ Run Validation on 2"` button + `"✕ Clear"` link
8. On **Map View** tab with rows selected → bar shows count + Clear, but no Run button
9. Click **Run Validation on 2**: rows show individual spinners, bar shows `"Running… (0/2)"` → `"Running… (1/2)"` → `"Running… (2/2)"` → success toast, selection clears
10. Click `"✕ Clear"` → bar disappears immediately
