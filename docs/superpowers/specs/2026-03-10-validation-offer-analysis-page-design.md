# Validation & Offer Analysis Page Enhancement Design

**Goal:** Upgrade the existing `/dashboard/validation` and `/dashboard/offer-analysis` list pages to match the operational hub pattern established by the Comparables page — replacing row-click navigation with popup Dialogs and adding inline quick-action buttons.

**Date:** 2026-03-10

---

## Context

Both pages are currently basic searchable/filterable lists where clicking a row navigates away to the detail page. The Comparables page was enhanced with:
- Popup Dialog containing the full panel component (instead of navigation)
- Inline quick action button per row (Recheck → updates row in local state)

These two pages follow the same pattern. The existing filter chips and search on each page already work well and are kept unchanged.

---

## Common Pattern

### Popup approach

When the primary action button is clicked:
1. Set `popupLeadId = lead.id` in state
2. Fetch full lead from `GET /api/vendor-leads/[id]`
3. Show loading spinner in Dialog while fetching
4. Render panel component inside a `max-w-5xl max-h-[90vh] overflow-y-auto` Dialog

This keeps the list query lean (no heavy panel-level fields like `validationNotes` JSON fetched for all rows).

### Row state update pattern

Inline quick actions update the specific lead row in local state on success (same as Comparables Recheck) — no page reload.

---

## Files Modified

| Action | Path |
|--------|------|
| Minor edit | `app/dashboard/validation/page.tsx` |
| Rewrite | `app/dashboard/validation/validation-list-client.tsx` |
| Minor edit | `app/dashboard/offer-analysis/page.tsx` |
| Rewrite | `app/dashboard/offer-analysis/offer-list-client.tsx` |

---

## Validation Page

### Server Component (`page.tsx`)

The existing Prisma select already has the right fields. Only change needed: ensure `validatedAt` is serialised as `.toISOString() ?? null` (it may currently be passed as a `Date` object to the client):

```ts
validatedAt: l.validatedAt?.toISOString() ?? null,
askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
```

All other existing fields (`bmvScore`, `motivationScore`) are already numeric.

### Client Component (`validation-list-client.tsx`)

#### Updated `Lead` interface

Add `validatedAt` as `string | null` (previously may have been `Date`):

```ts
interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  bmvScore: number | null
  validationPassed: boolean | null
  validatedAt: string | null     // ISO string
  pipelineStage: string
  motivationScore: number | null
}
```

#### State

```ts
const [leads, setLeads] = useState<Lead[]>(initialLeads)
const [search, setSearch] = useState("")
const [statusFilter, setStatusFilter] = useState<string>("All")  // keep existing chips
const [calcingId, setCalcingId] = useState<string | null>(null)  // which row is calculating BMV
const [popupLeadId, setPopupLeadId] = useState<string | null>(null)
const [popupLeadData, setPopupLeadData] = useState<any>(null)     // full lead for panel
const [popupLoading, setPopupLoading] = useState(false)
```

#### Popup open handler

```ts
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
```

#### Calc BMV quick action

```ts
const handleCalcBMV = async (lead: Lead) => {
  setCalcingId(lead.id)
  try {
    const res = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, { method: "POST" })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? "Calculation failed")
    // Update row — response shape: { success: true, data: { bmvScore, validationPassed, ... } }
    // Note: validatedAt is NOT returned by the API; synthesise with new Date().toISOString()
    setLeads(prev => prev.map(l =>
      l.id === lead.id
        ? {
            ...l,
            bmvScore:         data.data?.bmvScore ?? l.bmvScore,
            validationPassed: data.data?.validationPassed ?? l.validationPassed,
            validatedAt:      new Date().toISOString(),
          }
        : l
    ))
    toast.success("BMV calculated successfully")
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    setCalcingId(null)
  }
}
```

> **Response shape confirmed:** `POST /api/vendor-leads/[id]/calculate-bmv` returns `{ success: true, data: { bmvScore, validationPassed, validationNotes, ... } }`. Fields are under `data.data`. The DB sets `validatedAt` but does **not** return it in the response — always synthesise as `new Date().toISOString()`.

#### Table columns

| Column | Notes |
|--------|-------|
| Vendor | Avatar initial + name |
| Property | Address + postcode, type, beds |
| Asking Price | Formatted |
| Market Value | `estimatedMarketValue`, formatted |
| BMV Score | `bmvScore` as `X%`, `"—"` if null |
| Status | Validation badge: Passed (emerald) / Failed (red) / Pending (gray) |
| Last Validated | `validatedAt` as "X days ago" / "Never" |
| Actions | Two buttons |

Remove row `onClick` navigation.

#### Action buttons

**"Validate" button:**
- Icon: `ClipboardCheck` (or `ClipboardDocumentCheck`)
- `onClick`: `handleOpenValidate(lead)`

**"Calc BMV" button:**
- Icon: `Calculator`
- `disabled`: `calcingId === lead.id`
- Shows spinner (`animate-spin`) on icon when loading
- `onClick`: `handleCalcBMV(lead)`

#### Validation status badge colours

| Value | Badge |
|-------|-------|
| `true` (passed) | `bg-emerald-100 text-emerald-700 border-emerald-200` — "Passed" |
| `false` (failed) | `bg-red-100 text-red-700 border-red-200` — "Failed" |
| `null` (pending) | `bg-gray-100 text-gray-500 border-gray-200` — "Pending" |

#### Popup Dialog

```tsx
<Dialog open={!!popupLeadId} onOpenChange={(open) => { if (!open) { setPopupLeadId(null); setPopupLeadData(null) } }}>
  <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
    <DialogHeader>
      <DialogTitle>
        Validation — {/* find lead name from leads list by popupLeadId */}
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
```

> **Prop name confirmed:** `VendorValidationPanel` expects `initialLead` (not `lead`) — signature: `{ initialLead: Lead }`. The `as any` cast suppresses TypeScript complaints because `popupLeadData` is typed as `any` and the panel's internal `Lead` interface is not exported.

---

## Offer Analysis Page

### Server Component (`page.tsx`)

Add these fields to the Prisma select (needed for `OfferAnalysisPanel` props when popup opens — passed directly to avoid a second fetch):

```ts
estimatedMonthlyRent:  true,
estimatedRefurbCost:   true,
dealId:               true,
vendorEmail:          true,
vendorPhone:          true,
validationNotes:      true,
```

Serialise all date and decimal fields:

```ts
askingPrice:           l.askingPrice ? Number(l.askingPrice) : null,
estimatedMarketValue:  l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
estimatedMonthlyRent:  l.estimatedMonthlyRent ? Number(l.estimatedMonthlyRent) : null,
estimatedRefurbCost:   l.estimatedRefurbCost ? Number(l.estimatedRefurbCost) : null,
offerAmount:          l.offerAmount ? Number(l.offerAmount) : null,
offerPercentage:      l.offerPercentage ? Number(l.offerPercentage) : null,
bmvScore:             l.bmvScore ? Number(l.bmvScore) : null,
offerSentAt:          l.offerSentAt?.toISOString() ?? null,
offerAcceptedAt:      l.offerAcceptedAt?.toISOString() ?? null,
offerRejectedAt:      l.offerRejectedAt?.toISOString() ?? null,
```

### Client Component (`offer-list-client.tsx`)

#### Updated `Lead` interface

```ts
interface Lead {
  id: string
  vendorName: string
  vendorEmail: string | null
  vendorPhone: string | null
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
```

#### State

```ts
const [leads, setLeads] = useState<Lead[]>(initialLeads)
const [search, setSearch] = useState("")
const [statusFilter, setStatusFilter] = useState<string>("All")  // keep existing chips
const [decidingId, setDecidingId] = useState<string | null>(null)  // which row is Accept/Reject in progress
const [popupLead, setPopupLead] = useState<Lead | null>(null)
```

> **No separate fetch for popup** — unlike Validation, the Offer Analysis popup uses the lead data already in the list (after adding the extra fields to the server query). `OfferAnalysisPanel` is constructed directly from the `Lead` object.

#### Missing inputs hint (computed inline)

```ts
const getMissingInputsHint = (lead: Lead): string | undefined => {
  if (!lead.estimatedMarketValue || !lead.estimatedRefurbCost) {
    return "Complete validation first to get market value and refurb cost."
  }
  return undefined
}
```

#### Offer Analysis popup

```tsx
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
          setLeads(prev => prev.map(l =>
            l.id === popupLead.id
              ? { ...l, offerSentAt: new Date().toISOString(), offerAmount: offerPrice }
              : l
          ))
        }}
        onReject={() => {
          setLeads(prev => prev.map(l =>
            l.id === popupLead.id
              ? { ...l, offerRejectedAt: new Date().toISOString() }
              : l
          ))
        }}
      />
    )}
  </DialogContent>
</Dialog>
```

> **Callback signatures confirmed:** `onOfferSent: (offerPrice: number, strategy: "flip" | "hold", round: number) => void` — use `offerPrice` as the first argument (store it as `offerAmount` in list state). `onReject: () => void`. `dealId` is optional.

#### Accept / Reject quick actions

These buttons appear **only when** `offerSentAt !== null && offerAcceptedAt === null && offerRejectedAt === null`.

```ts
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
    setLeads(prev => prev.map(l =>
      l.id === lead.id ? { ...l, [field]: value } : l
    ))
    toast.success(decision === "accept" ? "Offer accepted" : "Offer rejected")
  } catch (err: any) {
    toast.error(err.message)
  } finally {
    setDecidingId(null)
  }
}
```

**"Offer Analysis" button:**
- Icon: `BarChart3`
- `disabled`: `decidingId === lead.id` (prevent opening popup while a PATCH is in flight)
- `onClick`: `setPopupLead(lead)`

**"Accept" button:**
- Icon: `CheckCircle2`, colour: `text-emerald-600`
- `disabled`: `decidingId === lead.id`
- `onClick`: `handleDecision(lead, "accept")`

**"Reject" button:**
- Icon: `XCircle`, colour: `text-red-500`
- `disabled`: `decidingId === lead.id`
- `onClick`: `handleDecision(lead, "reject")`

#### Table columns

| Column | Notes |
|--------|-------|
| Vendor | Avatar initial + name |
| Property | Address + postcode |
| Asking Price | Formatted |
| Offer Amount | `offerAmount` formatted, "—" if null |
| BMV | `bmvScore` as `X%`, "—" if null |
| Status | Offer status badge (see below) |
| Offer Sent | `offerSentAt` as "X days ago" / "—" |
| Actions | Buttons (see below) |

Remove row `onClick` navigation.

#### Offer status badge colours

| Condition | Badge |
|-----------|-------|
| `offerAcceptedAt` set | `bg-emerald-100 text-emerald-700 border-emerald-200` — "Accepted" |
| `offerRejectedAt` set | `bg-red-100 text-red-700 border-red-200` — "Rejected" |
| `offerSentAt` set (awaiting) | `bg-amber-100 text-amber-700 border-amber-200` — "Awaiting" |
| none | `bg-gray-100 text-gray-500 border-gray-200` — "No Offer" |

#### Actions column layout

```
[Offer Analysis btn]  [Accept btn]  [Reject btn]
```

Accept + Reject only rendered when `offerSentAt && !offerAcceptedAt && !offerRejectedAt`.

---

## Empty States

Both pages:
- Zero leads total → "No vendor leads found."
- Zero after filtering → "No leads match your filters."

---

## Verification Checklist

### Validation
- [ ] Row click no longer navigates — "Validate" button opens Dialog
- [ ] Dialog shows loading spinner while fetching full lead
- [ ] `VendorValidationPanel` renders inside Dialog with full lead data
- [ ] "Calc BMV" button triggers POST, shows spinner on that row, updates bmvScore / validationPassed / validatedAt in list
- [ ] Validation status badges: Passed (emerald), Failed (red), Pending (gray)
- [ ] Existing filter chips (All/Passed/Failed/Pending) still work

### Offer Analysis
- [ ] Row click no longer navigates — "Offer Analysis" button opens Dialog
- [ ] `OfferAnalysisPanel` renders inside Dialog with correct props
- [ ] `onOfferSent` callback updates the row's offerSentAt and offerAmount in list
- [ ] Accept/Reject buttons only appear for "awaiting" leads
- [ ] Accept/Reject PATCH updates row state and shows toast
- [ ] Offer status badges: Accepted (emerald), Rejected (red), Awaiting (amber), No Offer (gray)
- [ ] Existing filter chips (All/No Offer/Sent/Accepted/Rejected) still work
- [ ] No TypeScript errors
