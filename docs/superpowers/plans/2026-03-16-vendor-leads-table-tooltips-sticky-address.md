# Vendor Leads Table: Tooltips, Sticky Address & Check Button Fixes

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add status tooltips to all badge/pill components, make the address column sticky (alongside the vendor name), and fix the Offer Analysis check button to call the correct endpoint.

**Architecture:** All changes are isolated to `components/vendors/vendor-leads-table.tsx`. Import and use the existing shadcn Radix Tooltip (`components/ui/tooltip.tsx`) via a small `Tip` wrapper component. Give `VendorNameCell` an explicit `w-[180px]`, add an `AddressCell` sticky at `left-[180px]`, update all 6 row renderers and all 6 header rows. Change the Offer Analysis check endpoint from `send-vendor-offer` to `calculate-bmv`.

**Tech Stack:** React, Tailwind CSS, shadcn/ui Radix Tooltip (`@radix-ui/react-tooltip`)

---

## Chunk 1: All changes in vendor-leads-table.tsx

### Task 1: Add `Tip` wrapper + tooltip description maps

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

- [ ] **Step 1: Add Tooltip imports at the top of the file**

In `components/vendors/vendor-leads-table.tsx`, after the existing imports add:

```tsx
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
```

- [ ] **Step 2: Add the `Tip` convenience wrapper component**

Add this right after the existing `ActionBtn` component (around line 523), before the `MapModal`:

```tsx
// ─────────────────────────────────────────────────────────────────────────────
// Tooltip helper
// ─────────────────────────────────────────────────────────────────────────────

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent className="max-w-[220px] text-center text-[11px] leading-snug">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 3: Add stage description map**

Add this directly below `STAGE_STYLE` (around line 219):

```tsx
const STAGE_DESC: Record<PipelineStage, string> = {
  NEW_LEAD:             "Just added — not yet processed",
  AI_CONVERSATION:      "AI is actively engaging the vendor",
  DEAL_VALIDATION:      "Running BMV & market value checks",
  OFFER_MADE:           "Offer calculated and ready to send",
  OFFER_ACCEPTED:       "Vendor accepted the offer",
  OFFER_REJECTED:       "Vendor rejected the offer",
  VIDEO_SENT:           "Educational video sent to vendor",
  RETRY_1:              "First follow-up offer sent",
  RETRY_2:              "Second follow-up offer sent",
  RETRY_3:              "Third follow-up offer sent",
  PAPERWORK_SENT:       "Legal paperwork sent to vendor",
  READY_FOR_INVESTORS:  "Validated deal ready to show investors",
  DEAD_LEAD:            "Lead closed — not proceeding",
}
```

- [ ] **Step 4: Wrap `StageBadge` with `Tip`**

Replace the existing `StageBadge` function:

```tsx
function StageBadge({ stage }: { stage: PipelineStage }) {
  return (
    <Tip text={STAGE_DESC[stage]}>
      <span className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", STAGE_STYLE[stage])}>
        {STAGE_LABEL[stage]}
      </span>
    </Tip>
  )
}
```

- [ ] **Step 5: Wrap `PortalPill` with `Tip`**

Replace the existing `PortalPill` function:

```tsx
const PORTAL_PILL_DESC: Record<"listed" | "clear" | "blocked" | "none", string> = {
  listed:  "Property found on this portal — vendor may be testing the market",
  clear:   "No active listings found — property not currently for sale publicly",
  blocked: "Portal blocked our check — manual verification may be needed",
  none:    "Portal check not yet run for this lead",
}

function PortalPill({ status, matchCount }: { status: "listed" | "clear" | "blocked" | null; matchCount?: number }) {
  const desc = PORTAL_PILL_DESC[status ?? "none"]
  if (status === "listed")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 cursor-default">
          Listed{matchCount && matchCount > 0 ? ` (${matchCount})` : ""}
        </span>
      </Tip>
    )
  if (status === "clear")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Clear</span>
      </Tip>
    )
  if (status === "blocked")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 cursor-default">Blocked</span>
      </Tip>
    )
  return (
    <Tip text={desc}>
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">—</span>
    </Tip>
  )
}
```

- [ ] **Step 6: Wrap `RiskBadge` with `Tip`**

Replace the existing `RiskBadge` function:

```tsx
const RISK_DESC: Record<string, string> = {
  clear:     "No portals found this property listed — safe to proceed",
  caution:   "Property found on some portals — review carefully before offering",
  red_flag:  "Property actively listed on portals — vendor may have other agents",
  pending:   "Portal check not yet run for this lead",
}

function RiskBadge({ risk }: { risk: string | null }) {
  const desc = RISK_DESC[risk ?? "pending"] ?? "Unknown status"
  if (risk === "clear")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Not Listed</span>
      </Tip>
    )
  if (risk === "caution")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 cursor-default">Partial</span>
      </Tip>
    )
  if (risk === "red_flag")
    return (
      <Tip text={desc}>
        <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 cursor-default">Listed</span>
      </Tip>
    )
  return (
    <Tip text={desc}>
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">Pending</span>
    </Tip>
  )
}
```

- [ ] **Step 7: Wrap `ProcessingIcon` with `Tip`**

Replace the existing `ProcessingIcon` function:

```tsx
const PROCESSING_DESC: Record<ProcessingStatus, string> = {
  RUNNING:  "AI checks in progress — table auto-refreshes every 3 s",
  COMPLETE: "All processing steps completed successfully",
  FAILED:   "Processing failed — retry or check manually",
  PENDING:  "Awaiting processing",
}

function ProcessingIcon({ status }: { status: ProcessingStatus }) {
  const icon = (() => {
    switch (status) {
      case "RUNNING":  return <Loader2 className="inline h-3.5 w-3.5 animate-spin text-blue-500" />
      case "COMPLETE": return <CheckCircle2 className="inline h-3.5 w-3.5 text-green-500" />
      case "FAILED":   return <XCircle className="inline h-3.5 w-3.5 text-red-500" />
      default:         return <Minus className="inline h-3.5 w-3.5 text-gray-300" />
    }
  })()
  return <Tip text={PROCESSING_DESC[status]}>{icon}</Tip>
}
```

- [ ] **Step 8: Add inline tooltips for validation passed/failed badges in `ValidationRow`**

In `ValidationRow`, replace the two inline badge spans with tooltip-wrapped versions:

```tsx
{lead.validationPassed === true && (
  <Tip text="Deal passed BMV and profit validation criteria">
    <span className="inline-block rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 cursor-default">Passed</span>
  </Tip>
)}
{lead.validationPassed === false && (
  <Tip text="Deal did not meet minimum BMV or profit thresholds">
    <span className="inline-block rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 cursor-default">Failed</span>
  </Tip>
)}
```

- [ ] **Step 9: Add inline tooltip for email sent badge in `OfferAnalysisRow`**

In `OfferAnalysisRow`, replace the two inline badge spans:

```tsx
{emailSent
  ? (
    <Tip text="Offer email or lockout agreement sent to vendor">
      <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 cursor-default">Sent</span>
    </Tip>
  )
  : (
    <Tip text="No offer communication sent yet">
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 cursor-default">Pending</span>
    </Tip>
  )}
```

- [ ] **Step 10: Wrap `TooltipProvider` around the component output**

In the `VendorLeadsTable` return statement, wrap the outermost `<div className="flex flex-col gap-0">` with `<TooltipProvider>`:

```tsx
return (
  <TooltipProvider>
    <div className="flex flex-col gap-0">
      {/* ... all existing content unchanged ... */}
    </div>
  </TooltipProvider>
)
```

---

### Task 2: Sticky address column

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

- [ ] **Step 1: Give `VendorNameCell` an explicit width**

In `VendorNameCell`, change the `<td>` opening tag to add `w-[180px]`:

```tsx
// Before:
<td className="sticky left-0 z-10 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">

// After:
<td className="sticky left-0 z-10 w-[180px] bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
```

- [ ] **Step 2: Add `AddressCell` component**

Add this after `VendorNameCell`, before `ActionsCell`:

```tsx
/** Sticky second-left address cell */
function AddressCell({ address }: { address: string | null }) {
  return (
    <td className="sticky left-[180px] z-10 max-w-[200px] border-r border-gray-200 bg-white px-4 py-[11px] group-hover:bg-[#f3f4f6]">
      <p className="truncate text-sm text-gray-700">{address ?? <span className="text-gray-400">—</span>}</p>
    </td>
  )
}
```

- [ ] **Step 3: Update `TableHeaders` — vendor name width + address header sticky**

In `TableHeaders`, update `stickyLeft` to add `w-[180px]`, and define the sticky address header constant. Then replace the body of every `case` as shown below.

First, add the two header constants (replacing the current `stickyLeft` declaration):

```tsx
const stickyLeft = <Th className="sticky left-0 z-10 w-[180px] bg-[#f9fafb]">Vendor Name</Th>
const addressHeader = <Th className="sticky left-[180px] z-10 border-r border-gray-200 bg-[#f9fafb]">Address</Th>
const stickyRight = <Th className="sticky right-0 z-10 bg-[#f9fafb]">Actions</Th>
```

Replace the entire `switch (tab)` block with:

```tsx
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
      <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC Due</Th><Th>EST Rental</Th>
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
```

- [ ] **Step 4: Replace address `<Td>` with `<AddressCell>` in all 6 row renderers**

For each row renderer, remove the existing address `<Td>` and place `<AddressCell address={lead.propertyAddress} />` immediately after `<VendorNameCell lead={lead} />`.

**MapViewRow** — remove:
```tsx
<Td className="max-w-[220px]">
  <p className="truncate">{lead.propertyAddress ?? <span className="text-gray-400">—</span>}</p>
</Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

**PropertyDetailsRow** — remove:
```tsx
<Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

**PortalCheckRow** — remove:
```tsx
<Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

**ValidationRow** — remove:
```tsx
<Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

**ComparableRow** — remove:
```tsx
<Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

**OfferAnalysisRow** — remove:
```tsx
<Td className="max-w-[200px]"><p className="truncate">{lead.propertyAddress ?? "—"}</p></Td>
```
Replace with:
```tsx
<AddressCell address={lead.propertyAddress} />
```

---

### Task 3: Fix Offer Analysis check button endpoint

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

- [ ] **Step 1: Change the Offer Analysis check endpoint to `calculate-bmv`**

In the `VendorLeadsTable` component, find the `checkEndpoints` object inside the `visibleLeads.map` callback (around line 1084):

```tsx
// Before:
"offer-analysis": { endpoint: `/api/vendor-pipeline/leads/${lead.id}/send-vendor-offer`, msg: "Offer sent to vendor" },

// After:
"offer-analysis": { endpoint: `/api/vendor-leads/${lead.id}/calculate-bmv`, msg: "Offer calculated" },
```

- [ ] **Step 2: Update the check button title for Offer Analysis tab**

In `OfferAnalysisRow`, the `checkAction` title is currently `"Send Vendor Offer"`. Update to `"Calculate Offer"`:

```tsx
// Before:
checkAction={onCheck ? { icon: Send, title: "Send Vendor Offer", onClick: onCheck, loading: isChecking } : undefined}

// After:
checkAction={onCheck ? { icon: Calculator, title: "Calculate Offer", onClick: onCheck, loading: isChecking } : undefined}
```

Also add `Calculator` to the lucide-react imports at the top (it is already imported — verify it's present in the import list).

---

### Task 4: Verify the build compiles

- [ ] **Step 1: Run the Next.js type-checker**

```bash
npx tsc --noEmit
```

Expected: no errors. If there are type errors, fix them (most likely a `React.ReactNode` type on the `AddressCell` address prop — ensure the prop type is `string | null`).

- [ ] **Step 2: Run the dev build check**

```bash
npx next build 2>&1 | tail -20
```

Expected: build completes without errors.

- [ ] **Step 3: Manual smoke-test in browser**

1. Navigate to the vendor leads table
2. Switch to **Portal Check** tab — hover over a stage badge, portal pill, and risk badge → tooltip should appear
3. Switch to **Validation** tab — hover over passed/failed badge → tooltip should appear
4. Switch to **Offer Analysis** tab — hover over Sent/Pending badge → tooltip; click the Check button → should trigger `calculate-bmv` and populate offer columns
5. Scroll the table right on any tab → Vendor Name and Address columns should remain fixed
6. Switch to **Comparable** tab — click Check on a lead with a postcode → `comparablesCount` and `avgComparablePrice` columns should populate after refresh

- [ ] **Step 4: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: sticky address column, status tooltips, fix offer-analysis check button"
```
