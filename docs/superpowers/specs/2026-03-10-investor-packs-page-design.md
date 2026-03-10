# Investor Packs Page Design

**Goal:** Replace the "Packs" nav item (currently pointing to the settings/templates page) with a dedicated operational page showing every investor pack delivery — which investor received which pack, tracking status, and actions (download, resend, view deal).

**Date:** 2026-03-10

---

## Context

The codebase has a complete investor pack delivery pipeline:
- `InvestorPackGeneration` — records every PDF generated (template used, property, file size)
- `InvestorPackDelivery` — records every pack sent to every investor (tracking tokens, view/download counts, email status)
- `InvestorPackTemplate` — the template used
- `/api/investors/pack-delivery` — POST/GET endpoints
- `/api/investors/pack-delivery/[id]/resend` — resend endpoint
- `/api/deals/[id]/investor-pack?token=...` — token-authenticated PDF download

The existing "Packs" nav item (`config/navigation.ts`) incorrectly links to `/dashboard/settings/investor-packs` (the template editor). It needs to point to the new page.

---

## Route

**New page:** `/dashboard/investors/packs`

**Nav change:** Update `config/navigation.ts` — Manage → Investors → Packs → change `href` from `/dashboard/settings/investor-packs` to `/dashboard/investors/packs`.

---

## Page Architecture

**Server Component** (`app/dashboard/investors/packs/page.tsx`):
- Auth check (redirect `/login` if no session)
- Fetches `InvestorPackDelivery` records via Prisma, joined with:
  - `investor → user` (name, email)
  - `generation → template` (template name)
  - `generation` (propertyAddress, askingPrice, dealId)
  - `deal` (for the "View Deal" navigation link, if present)
- Serialises DateTime/Decimal fields to primitives
- Renders `<InvestorPacksClient deliveries={...} />`

**Client Component** (`components/investors/investor-packs-client.tsx`):
- Handles filter/search state client-side
- Manages Resend action (POST to API, optimistic status update)

---

## UI Sections

### 1. Summary Stats Bar
Four stat cards in a horizontal row:

| Stat | Calculation |
|------|-------------|
| Total Sent | `COUNT(deliveries)` |
| Opened | `COUNT WHERE viewCount > 0` / total as % |
| Downloaded | `COUNT WHERE downloadCount > 0` / total as % |
| Sent This Week | `COUNT WHERE sentAt >= 7 days ago` |

### 2. Filter Toolbar
- **Search** input: filters by investor name/email or property address (client-side)
- **Status chips:** All · Sent · Viewed · Downloaded
- **Method chips:** All · Email · Download · Manual

### 3. Delivery List Table
Each row = one `InvestorPackDelivery` record.

| Column | Source | Notes |
|--------|--------|-------|
| Investor | `delivery.investor.user.firstName + lastName` + email | Avatar with initials |
| Property | `delivery.generation.propertyAddress` | Truncated to 1 line |
| Template | `delivery.generation.template.name` | "—" if no template recorded |
| Part | `delivery.partNumber` | "Full" if null, else "Part 1" etc. |
| Sent | `delivery.sentAt` | Formatted date, "Never" if null |
| Status | `viewCount`, `downloadCount`, `emailStatus` | Badge: Sent / Viewed (N) / Downloaded (N) |
| Actions | — | See below |

### 4. Row Actions (3 buttons per row)

| Button | Action | API |
|--------|--------|-----|
| **Download** | Opens PDF in new tab | `GET /api/deals/[dealId]/investor-pack?token=[downloadToken]` |
| **Resend** | Re-sends pack email, shows toast | `POST /api/investors/pack-delivery/[id]/resend` |
| **View Deal** | Navigates to `/dashboard/vendors/[vendorLeadId]` or `/dashboard/deals/[dealId]` | Client-side navigation |

**Empty states:**
- No `downloadToken` → Download button disabled with tooltip "No download link available"
- No `dealId` → View Deal button disabled
- Delivery method is "download" (no email sent) → Resend button disabled with tooltip "Not sent by email"

---

## Filtering Logic (client-side)

```
Status:
  "Sent"       → sentAt IS NOT NULL
  "Viewed"     → viewCount > 0
  "Downloaded" → downloadCount > 0

Method:
  "Email"    → deliveryMethod === "email"
  "Download" → deliveryMethod === "download"
  "Manual"   → deliveryMethod === "manual"

Search:
  Match on: investorName, investorEmail, propertyAddress (case-insensitive substring)
```

---

## Empty State

If no deliveries exist yet, show a centred empty state:
> "No packs sent yet. Packs are generated from the Vendor Leads page when a deal is ready for investors."

---

## Data Fetching (Prisma query outline)

```ts
const deliveries = await prisma.investorPackDelivery.findMany({
  include: {
    investor: {
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    },
    generation: {
      include: { template: { select: { name: true } } },
    },
    deal: { select: { id: true } },
  },
  orderBy: { sentAt: "desc" },
})
```

---

## Files

| Action | Path |
|--------|------|
| Create | `app/dashboard/investors/packs/page.tsx` |
| Create | `components/investors/investor-packs-client.tsx` |
| Modify | `config/navigation.ts` — update Packs href |
