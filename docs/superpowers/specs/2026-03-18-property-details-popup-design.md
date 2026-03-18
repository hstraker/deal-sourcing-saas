# Property Details Popup — Design Spec

## Goal

Replace the current "View" button behaviour on the Property Details tab of the Vendor Leads Table — which navigates away to the contact page — with a rich, investor-focused popup modal that shows all key property and deal information at a glance.

## Context

The Vendor Leads Table (`components/vendors/vendor-leads-table.tsx`) has six tabs. Every tab except **Property Details** already has a dedicated popup modal when the View button is clicked. The Property Details tab currently calls `router.push(...)` instead. This spec adds a `PropertyDetailsModal` component following the same pattern as the existing `ValidationModal`, `ComparableModal`, etc.

## Layout — Option C (approved)

Two-pane horizontal layout inside a standard backdrop + centered dialog:

- **Left panel** — dark (`#1e293b`), fixed ~260 px width. Permanently visible financial summary.
- **Right panel** — white, flex-1. Property details, income, strategy fit, seller intel.
- Modal max-width: `max-w-2xl` (≈ 780 px). Max-height: 90 vh, scrollable right panel.

---

## Left Panel — Content

### Header
- Full property address (bold, light colour)
- Postcode on a second line (muted)
- Chips row: bedrooms count, property type, condition badge (colour-coded: green = excellent/good, amber = needs_work/needs_modernisation, red = poor)

### Financials section
Label: "FINANCIALS"

| Row | Value |
|-----|-------|
| Asking Price | `lead.askingPrice` |
| Market Value | `lead.estimatedMarketValue` |
| Refurb Est. | `lead.estimatedRefurbCost` |

Highlighted box (green tinted border):
- BMV Discount % — large, green
- Profit Potential — `lead.profitPotential`, green

All values formatted with `formatCurrency()`. Missing values show `—`.

### Status indicators
Label: "STATUS"

Four rows with coloured circle icons:
1. Portal check — green ✓ if `latestCheckRisk === "clear"`, amber ⚠ if caution, red ✕ if red_flag, grey — if null
2. Validation — green ✓ if `validationPassed === true`, red ✕ if false, grey — if null
3. Urgency — amber ⚠ + "Urgent — N days" if `urgencyLevel === "urgent"` and `timelineDays` set; grey — otherwise
4. Competing offers — red ⚠ "Competing offers" if `competingOffers === true`, grey — if false/null

### Footer
Pipeline stage badge (`pipelineStage`) using `getPipelineStageStyle()` for colour.

---

## Right Panel — Content

### Close button
Top-right corner, `×` button.

### Property Specs  (chip grid)
Chips rendered only when data present:
- 🛏 N Bedrooms
- 🚿 N Bathroom(s)
- 📐 N sq ft
- 🏠 Property type (capitalised)
- ⚡ EPC: X (score) — only if `epcRating` present on lead
- 🔑 Tenure (if available)

### Rental Income (green tinted card)
2×2 grid:
- Monthly Rent · Annual Rent
- Gross Yield % (= annualRent / askingPrice × 100) · Net Yield ~ % (gross × 0.8, approximate)

All shown only when `estimatedMonthlyRent` is present. If absent, section is hidden.

### Strategy Fit (2×2 grid of badges)
Calculated purely from existing lead fields. Each strategy shows green card (fit) or grey card (not fit / insufficient data):

| Strategy | Green if… |
|----------|-----------|
| **BTL** | grossYield ≥ 5% and `estimatedMonthlyRent` present |
| **Flip** | `bmvScore` ≥ 10 and `profitPotential` present and positive |
| **BRR** | `estimatedRefurbCost` present and `bmvScore` ≥ 10 |
| **SA** | Grey/insufficient — not calculable from current data |

Each card shows strategy name + one-line reason (e.g. "5.5% yield · good cashflow").

### Seller Intelligence (amber tinted card)
2×2 grid:
- Urgency (`urgencyLevel`, coloured red if urgent) · Timeline (`timelineDays` + "days")
- Reason for selling (`reasonForSelling`) · Motivation score (`motivationScore` / 10 + flame emoji if ≥ 8)

Section hidden if none of these fields are populated.

---

## Architecture

### New file
`components/vendors/property-details-modal.tsx` — self-contained `PropertyDetailsModal` component.

Props:
```ts
interface PropertyDetailsModalProps {
  lead: VendorLead        // reuses existing VendorLead type from vendor-leads-table.tsx
  onClose: () => void
}
```

No new API calls. All data comes from the `VendorLead` already loaded in the table.

### Changes to `vendor-leads-table.tsx`
1. Import `PropertyDetailsModal`
2. Add `propertyDetailsModalLead` state (`VendorLead | null`)
3. In `onView` handler: when `activeTab === "property-details"`, set `propertyDetailsModalLead(lead)` instead of `router.push(...)`
4. Render `<PropertyDetailsModal>` alongside the other modals at bottom of JSX

### No other files change.

---

## Data fields used

All from the existing `VendorLead` interface — no schema changes needed:

`propertyAddress`, `propertyPostcode`, `propertyType`, `bedrooms`, `bathrooms`, `squareFeet`, `condition`, `askingPrice`, `estimatedMarketValue`, `estimatedRefurbCost`, `bmvScore`, `profitPotential`, `estimatedMonthlyRent`, `estimatedAnnualRent`, `epcRating`, `epcScore`, `latestCheckRisk`, `validationPassed`, `urgencyLevel`, `timelineDays`, `competingOffers`, `reasonForSelling`, `motivationScore`, `pipelineStage`

---

## Error / empty states

- If a field is null/undefined, its chip or row is simply omitted (not shown as empty).
- If no financial data at all: left panel financial section shows all `—`.
- Clicking the backdrop or the ✕ button closes the modal.

---

## Testing

TypeScript compilation (`npx tsc --noEmit`) is the primary verification step — no test suite exists. Manual verification: open Property Details tab, click View on any lead, confirm popup opens without navigation.
