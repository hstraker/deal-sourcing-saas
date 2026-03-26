# EPC Data + AVG Rental Fix Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the EPC Rating and EPC Due columns in the Validation tab using the PropertyData energy-efficiency API, and fix the AVG Rental column so it is populated by the calculate-bmv check.

**Architecture:** Three-layer change — (1) DB migration to add `epcRating`, `epcScore`, `epcInspectionDate` fields to `VendorLead`; (2) new `fetchEpcData()` function in `lib/propertydata.ts` plus a `localAverageRent` write fix in the calculate-bmv API route; (3) UI changes in the vendor leads table component to render EPC columns and wire the new fields.

**Tech Stack:** Prisma 5 + PostgreSQL, Next.js 14 API Routes, PropertyData REST API, React/Tailwind/shadcn

---

## File Map

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 3 EPC fields to `VendorLead` model |
| `prisma/migrations/20260317000000_add_epc_fields_to_vendor_lead/migration.sql` | New migration file |
| `lib/propertydata.ts` | Add `fetchEpcData()` export |
| `app/api/vendor-leads/[id]/calculate-bmv/route.ts` | Call `fetchEpcData`, save EPC fields + `localAverageRent` |
| `components/vendors/vendor-leads-table.tsx` | Add EPC fields to interface, `EpcRatingBadge` component, update ValidationRow + headers |

---

## Chunk 1: DB migration — add EPC fields to VendorLead

### Task 1: Update Prisma schema + create migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260317000000_add_epc_fields_to_vendor_lead/migration.sql`

- [ ] **Step 1: Add EPC fields to the `VendorLead` model in schema.prisma**

Open `prisma/schema.prisma`. Find the `// Property Details` section (around line 920). After the `rentConfidence` field (around line 933), add:

```prisma
  // EPC Data (from PropertyData energy-efficiency API)
  epcRating         String?   @map("epc_rating")           // A | B | C | D | E | F | G
  epcScore          Int?      @map("epc_score")             // 0–100
  epcInspectionDate DateTime? @map("epc_inspection_date")  // Date of last EPC inspection
```

- [ ] **Step 2: Create the migration SQL file**

Create the directory and file:
`prisma/migrations/20260317000000_add_epc_fields_to_vendor_lead/migration.sql`

Contents:
```sql
-- AlterTable: add EPC fields to vendor_leads
ALTER TABLE "vendor_leads" ADD COLUMN "epc_rating" TEXT;
ALTER TABLE "vendor_leads" ADD COLUMN "epc_score" INTEGER;
ALTER TABLE "vendor_leads" ADD COLUMN "epc_inspection_date" TIMESTAMP(3);
```

- [ ] **Step 3: Apply the migration via psql**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas
psql $DATABASE_URL -f prisma/migrations/20260317000000_add_epc_fields_to_vendor_lead/migration.sql
```

Expected: `ALTER TABLE` printed three times with no errors.

- [ ] **Step 4: Register the migration in Prisma's tracking table**

```bash
psql $DATABASE_URL -c "
INSERT INTO \"_prisma_migrations\" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
  gen_random_uuid(),
  'manual',
  now(),
  '20260317000000_add_epc_fields_to_vendor_lead',
  NULL, NULL, now(), 1
);"
```

Expected: `INSERT 0 1`

- [ ] **Step 5: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client` with no errors.

- [ ] **Step 6: Verify type-check passes**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output (zero errors).

- [ ] **Step 7: Commit schema + migration**

```bash
git add prisma/schema.prisma prisma/migrations/20260317000000_add_epc_fields_to_vendor_lead/migration.sql
git commit -m "feat: add epc_rating, epc_score, epc_inspection_date to vendor_leads"
```

---

## Chunk 2: PropertyData EPC function + calculate-bmv wiring

### Task 2: Add `fetchEpcData()` to lib/propertydata.ts

**Files:**
- Modify: `lib/propertydata.ts`

The pattern to follow is identical to `fetchRentalData` (lines 395–480 in the current file). Add this export at the end of the file, after `fetchDetailedComparables`.

- [ ] **Step 1: Add the EpcRecord interface and fetchEpcData function**

Append to the end of `lib/propertydata.ts`:

```typescript
// ─────────────────────────────────────────────────────────────────────────────
// Energy Efficiency (EPC) API
// ─────────────────────────────────────────────────────────────────────────────

export interface EpcRecord {
  address: string
  rating: string        // "A" | "B" | "C" | "D" | "E" | "F" | "G"
  score: number         // 0–100
  inspectionDate: Date
}

/**
 * Fetch EPC (Energy Performance Certificate) data for a postcode.
 * Calls PropertyData /energy-efficiency endpoint.
 * Returns records sorted newest-first, or null on error / no data.
 *
 * @see https://propertydata.co.uk/api/documentation/energy-efficiency
 */
export async function fetchEpcData(postcode: string): Promise<EpcRecord[] | null> {
  if (!PROPERTYDATA_API_KEY) {
    console.warn("[EPC] PROPERTYDATA_API_KEY not set — skipping EPC fetch")
    return null
  }

  try {
    const params = new URLSearchParams({
      key: PROPERTYDATA_API_KEY,
      postcode,
    })

    const url = `${PROPERTYDATA_API_URL}/energy-efficiency?${params.toString()}`
    console.log(`[EPC] Fetching energy efficiency data for postcode: ${postcode}`)

    const response = await fetch(url)

    if (!response.ok) {
      console.error(`[EPC] API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (data.status !== "success" || !Array.isArray(data.energy_efficiency)) {
      console.warn(`[EPC] Unexpected response shape for ${postcode}:`, data.status)
      return null
    }

    const records: EpcRecord[] = data.energy_efficiency.map((item: any) => ({
      address: item.address as string,
      rating: item.rating as string,
      score: Number(item.score),
      inspectionDate: new Date(item.inspection_date),
    }))

    // Sort newest inspection first
    records.sort((a, b) => b.inspectionDate.getTime() - a.inspectionDate.getTime())

    console.log(`[EPC] Found ${records.length} EPC records for ${postcode}`)
    return records
  } catch (error) {
    console.error("[EPC] Fetch error:", error)
    return null
  }
}

/**
 * Find the best-matching EPC record for a given property address.
 * Matches by house number extracted from the address string.
 * Falls back to the most recent record if no house-number match found.
 */
export function matchEpcRecord(
  records: EpcRecord[],
  propertyAddress: string | null
): EpcRecord | null {
  if (records.length === 0) return null
  if (!propertyAddress) return records[0] // most recent

  // Extract leading house number (e.g. "26", "44", "34A")
  const extractNumber = (addr: string): string | null => {
    const m = addr.match(/\b(\d+[a-zA-Z]?)\b/)
    return m ? m[1].toLowerCase() : null
  }

  const targetNum = extractNumber(propertyAddress)
  if (!targetNum) return records[0] // no number in lead address → use most recent

  const matched = records.find(
    (r) => extractNumber(r.address) === targetNum
  )
  return matched ?? records[0] // fallback to most recent
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add lib/propertydata.ts
git commit -m "feat: add fetchEpcData and matchEpcRecord to propertydata lib"
```

---

### Task 3: Wire EPC fetch + localAverageRent into calculate-bmv route

**Files:**
- Modify: `app/api/vendor-leads/[id]/calculate-bmv/route.ts`

There are two changes in this file:
1. Import and call `fetchEpcData` / `matchEpcRecord` after the other API calls
2. Add `localAverageRent` and EPC fields to the `prisma.vendorLead.update` call

- [ ] **Step 1: Add EPC imports at the top of the route**

In `app/api/vendor-leads/[id]/calculate-bmv/route.ts`, find the existing import from `@/lib/propertydata` (around line 12):

```typescript
// Before:
import {
  fetchSoldPrices,
  fetchPropertyValuation,
  fetchRentalData,
  filterComparables,
  calculateAverageComparablePrice,
  SoldProperty,
} from "@/lib/propertydata"

// After:
import {
  fetchSoldPrices,
  fetchPropertyValuation,
  fetchRentalData,
  filterComparables,
  calculateAverageComparablePrice,
  fetchEpcData,
  matchEpcRecord,
  SoldProperty,
} from "@/lib/propertydata"
```

- [ ] **Step 2: Add EPC state variables near the other data-fetch variables**

After the `let landRegistryOwnership` block (around line 236), add:

```typescript
// ── EPC data ─────────────────────────────────────────────────────────────────
let epcRating: string | null = null
let epcScore: number | null = null
let epcInspectionDate: Date | null = null
```

- [ ] **Step 3: Add the EPC fetch call after the land-registry block**

After the land-registry block closing brace (around line 258, after `// ────────────────────────────────────────────────────────────────────────────`), add:

```typescript
// ── EPC fetch ─────────────────────────────────────────────────────────────────
if (effectivePostcode && !isOutcodeOnly) {
  try {
    const epcRecords = await fetchEpcData(effectivePostcode)
    if (epcRecords && epcRecords.length > 0) {
      const best = matchEpcRecord(epcRecords, lead.propertyAddress ?? null)
      if (best) {
        epcRating = best.rating
        epcScore = best.score
        epcInspectionDate = best.inspectionDate
        console.log(`[BMV Calculator] EPC: ${best.rating} (${best.score}/100) inspected ${best.inspectionDate.toLocaleDateString("en-GB")}`)
      }
    }
  } catch (err) {
    console.warn("[BMV Calculator] EPC fetch failed:", err)
  }
}
// ─────────────────────────────────────────────────────────────────────────────
```

- [ ] **Step 4: Update the prisma.vendorLead.update call to include EPC + localAverageRent**

Find the `prisma.vendorLead.update` call (around line 814). Replace the `data` block:

```typescript
// Before:
data: {
  estimatedMarketValue: marketValue,
  bmvScore,
  offerPercentage,
  offerAmount: calculatedOffer,
  profitPotential,
  validationPassed,
  validationNotes,
  validatedAt: new Date(),
  updatedAt: new Date(),
  // Update rental data if fetched from API
  ...(rentalDataSource === "propertydata_api" && {
    estimatedMonthlyRent: monthlyRent,
    estimatedAnnualRent: annualRent,
  }),
},

// After:
data: {
  estimatedMarketValue: marketValue,
  bmvScore,
  offerPercentage,
  offerAmount: calculatedOffer,
  profitPotential,
  validationPassed,
  validationNotes,
  validatedAt: new Date(),
  updatedAt: new Date(),
  // Update rental data if fetched from API
  ...(rentalDataSource === "propertydata_api" && {
    estimatedMonthlyRent: monthlyRent,
    estimatedAnnualRent: annualRent,
    localAverageRent: monthlyRent,   // area average from PropertyData
  }),
  // EPC data (if fetched)
  ...(epcRating !== null && {
    epcRating,
    epcScore,
    epcInspectionDate,
  }),
},
```

- [ ] **Step 5: Verify type-check passes**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app/api/vendor-leads/[id]/calculate-bmv/route.ts
git commit -m "feat: fetch EPC data and save localAverageRent in calculate-bmv"
```

---

## Chunk 3: UI — EPC columns in the Validation tab

### Task 4: Update vendor-leads-table component

**Files:**
- Modify: `components/vendors/vendor-leads-table.tsx`

- [ ] **Step 1: Add EPC fields to the VendorLead interface**

In the `VendorLead` interface (around line 85), after `validationPassed`:

```typescript
// Before:
  validationPassed: boolean | null
  latestPortalCheck: LatestPortalCheck | null

// After:
  validationPassed: boolean | null
  epcRating: string | null
  epcScore: number | null
  epcInspectionDate: string | null   // ISO string from API
  latestPortalCheck: LatestPortalCheck | null
```

- [ ] **Step 2: Add the `EpcRatingBadge` component**

Add this after the `RiskBadge` component (which ends around line 321), before `BmvCell`:

```tsx
// EPC rating colour map — UK convention: A/B=green, C=lime, D=yellow, E=amber, F/G=red
const EPC_COLOUR: Record<string, string> = {
  A: "bg-green-700 text-white",
  B: "bg-green-500 text-white",
  C: "bg-lime-500 text-white",
  D: "bg-yellow-400 text-gray-900",
  E: "bg-amber-500 text-white",
  F: "bg-orange-600 text-white",
  G: "bg-red-700 text-white",
}

function EpcRatingBadge({ rating, score, inspectionDate }: {
  rating: string | null
  score: number | null
  inspectionDate: string | null
}) {
  if (!rating) {
    return (
      <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-400 cursor-default">
        —
      </span>
    )
  }

  const colourCls = EPC_COLOUR[rating.toUpperCase()] ?? "bg-gray-200 text-gray-700"
  const expiryDate = inspectionDate
    ? new Date(new Date(inspectionDate).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000)
    : null
  const tooltipText = [
    score !== null ? `Score: ${score}/100` : null,
    inspectionDate ? `Inspected: ${fmtDate(inspectionDate)}` : null,
    expiryDate ? `Expires: ${fmtDate(expiryDate.toISOString())}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  const badge = (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold cursor-default ${colourCls}`}>
      {rating.toUpperCase()}
    </span>
  )

  return tooltipText ? <Tip text={tooltipText}>{badge}</Tip> : badge
}
```

- [ ] **Step 3: Add an `EpcDueCell` helper function**

Add this directly after `EpcRatingBadge`:

```tsx
/** Returns the expiry date string (inspection + 10 years) with a tooltip, or "—" */
function EpcDueCell({ rating, score, inspectionDate }: {
  rating: string | null
  score: number | null
  inspectionDate: string | null
}) {
  if (!inspectionDate) {
    return <span className="font-mono text-xs text-gray-400">—</span>
  }

  const expiry = new Date(new Date(inspectionDate).getTime() + 10 * 365.25 * 24 * 60 * 60 * 1000)
  const isExpired = expiry < new Date()
  const tooltipText = [
    score !== null ? `Score: ${score}/100` : null,
    rating ? `Rating: ${rating.toUpperCase()}` : null,
    `Inspected: ${fmtDate(inspectionDate)}`,
  ]
    .filter(Boolean)
    .join(" · ")

  const label = (
    <span className={`font-mono text-xs ${isExpired ? "text-red-600 font-semibold" : "text-gray-700"}`}>
      {fmtDate(expiry.toISOString())}
      {isExpired && " ⚠"}
    </span>
  )

  return <Tip text={tooltipText}>{label}</Tip>
}
```

- [ ] **Step 4: Update the `TableHeaders` validation case**

In `TableHeaders`, find the `"validation"` case and replace `<Th>EPC Due</Th>` with two headers:

```tsx
// Before:
case "validation":
  return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
    {stickyLeft}
    {addressHeader}
    <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
    <Th>AVG Rental</Th><Th>Asking Price</Th><Th>AVG Sale Price</Th><Th>AVG Yield</Th>
    <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC Due</Th><Th>EST Rental</Th>
    {stickyRight}
  </tr>

// After:
case "validation":
  return <tr className="border-b border-[#e5e7eb] bg-[#f9fafb]">
    {stickyLeft}
    {addressHeader}
    <Th>Status</Th><Th>Postcode</Th><Th>Type</Th>
    <Th>AVG Rental</Th><Th>Asking Price</Th><Th>AVG Sale Price</Th><Th>AVG Yield</Th>
    <Th>Comparables</Th><Th>Gross Cashflow</Th><Th>EPC</Th><Th>EPC Due</Th><Th>EST Rental</Th>
    {stickyRight}
  </tr>
```

- [ ] **Step 5: Update `ValidationRow` to render EPC cells**

In `ValidationRow`, find the hardcoded `<Td className="text-xs text-gray-400">—</Td>` (the old EPC Due cell) and replace it with two cells:

```tsx
// Before:
      <Td className="text-xs text-gray-400">—</Td>
      <Td><span className="font-mono text-xs">{lead.estimatedMonthlyRent ? `${fmtCurrency(lead.estimatedMonthlyRent)}/mo` : "—"}</span></Td>

// After:
      <Td><EpcRatingBadge rating={lead.epcRating} score={lead.epcScore} inspectionDate={lead.epcInspectionDate} /></Td>
      <Td><EpcDueCell rating={lead.epcRating} score={lead.epcScore} inspectionDate={lead.epcInspectionDate} /></Td>
      <Td><span className="font-mono text-xs">{lead.estimatedMonthlyRent ? `${fmtCurrency(lead.estimatedMonthlyRent)}/mo` : "—"}</span></Td>
```

- [ ] **Step 6: Verify type-check passes**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add components/vendors/vendor-leads-table.tsx
git commit -m "feat: EPC rating + EPC due columns in validation tab, fix AVG rental display"
```

---

### Task 5: Smoke test

- [ ] **Step 1: Start dev server and navigate to Vendor Leads → Validation tab**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard/vendors` and click the Validation tab.

- [ ] **Step 2: Verify column headers**

Check that headers are: `... | AVG Rental | Asking Price | AVG Sale Price | AVG Yield | Comparables | Gross Cashflow | EPC | EPC Due | EST Rental | Actions`

- [ ] **Step 3: Click Check on a lead that has a postcode**

The lead row should show a spinner, then refresh. Verify:
- **EPC column** shows a coloured letter badge (e.g. `D`) or `—` if no EPC data found
- Hovering the badge shows the tooltip: `Score: 66/100 · Inspected 27 Jan 2023 · Expires 27 Jan 2033`
- **EPC Due** shows a date like `27 Jan 33` or `—`
- Hovering EPC Due shows the tooltip with score + inspection date
- **AVG Rental** column now shows a £ value (no longer `—`) after the check
- **EST Rental** still shows the estimated rent for the property

- [ ] **Step 4: Verify expired EPC styling**

If a lead has an EPC inspection date before Jan 2015 (>10 years ago), the EPC Due date should display in red with a `⚠` suffix.
