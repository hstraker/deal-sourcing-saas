# Claude Code Prompt — Property Deal Analysis App Updates
# Langdon Property Group — BTL Pipeline Improvements
# Generated: May 2026

---

## Context

You are working on a Node.js property deal analysis SaaS platform for Langdon Property Group, a Welsh buy-to-let investment company. The platform analyses BTL deals sourced via Rightmove scraping, Facebook leads, and a deal sourcer network. It uses the PropertyData API for market valuations and rental data.

The codebase follows this structure:
```
/src
  /pipeline
    validator.js        # Deal validation and pass/fail logic
    scoring.js          # Deal scoring engine (0-100)
    taxCalculator.js    # Stamp duty calculations
    rentResolver.js     # Rent figure resolution
  /api
    propertyData.js     # PropertyData API client
  /models
    deal.js             # Deal data model / schema
  /notifications
    twilio.js           # SMS notifications
  /output
    formatter.js        # Deal analysis output formatting
```

A recent deal analysis produced a false "FAILED" result because:
1. The app used a PropertyData API rent estimate of £505/mo instead of the verified sitting tenant rent of £850/mo
2. The app applied a single global PASS/FAIL instead of per-strategy viability
3. The app calculated SDLT instead of Welsh LTT (Land Transaction Tax)
4. There was no awareness of Welsh tenancy law (Renting Homes Wales Act 2016)

Implement all changes below. Write clean, well-commented code. After each major change, summarise what you changed and why.

---

## Change 1 — Jurisdiction Detection Module

Create `/src/pipeline/jurisdictionDetector.js`.

Requirements:
- Export a function `detectJurisdiction(postcode)` that returns `'WALES'` or `'ENGLAND'`
- Welsh postcodes: any postcode starting with `CF`, `NP`, `SA`, `LL`, `LD`
- All others default to `'ENGLAND'`
- Also export `isWelsh(postcode)` as a convenience boolean helper
- Input should be normalised (trim whitespace, uppercase) before matching
- Add JSDoc comments

Example:
```js
detectJurisdiction('SA11 1PE') // → 'WALES'
detectJurisdiction('SA11 1PE') // → 'WALES'
detectJurisdiction('M1 1AA')   // → 'ENGLAND'
isWelsh('CF24 0AB')            // → true
```

Write unit tests in `/tests/jurisdictionDetector.test.js` covering:
- All Welsh prefixes (CF, NP, SA, LL, LD)
- English postcode
- Mixed case input
- Postcode with extra whitespace

---

## Change 2 — Rent Resolver (priority chain)

Refactor `/src/pipeline/rentResolver.js` to implement a strict priority chain for rent figures.

Priority order (highest to lowest):
1. `verifiedRent` — actual sitting tenant rent, confirmed by sourcer or landlord
2. `agreedRent` — rent agreed with prospective tenant pre-purchase
3. `sourcerEstimate` — estimate from deal pack (unverified)
4. `apiEstimate` — PropertyData `/rent` endpoint result

Requirements:
- Export `resolveRent(dealInput, apiData)` returning:
```js
{
  rentPCM: Number,
  source: 'verified_tenant' | 'agreed_tenant' | 'sourcer_estimate' | 'api_estimate',
  sourceDetail: String,        // e.g. "Confirmed with Lewis Pownall, 13/05/2026"
  confidence: 'high' | 'medium' | 'low' | 'verified',
  apiComparableCount: Number | null,
  apiComparableRange: { min: Number, max: Number } | null,
  warning: String | null       // populated if confidence is low or source is unverified
}
```

- Confidence levels for API estimates:
  - `high`: 8+ comparables AND range spread < 25%
  - `medium`: 4–7 comparables OR range spread 25–50%
  - `low`: fewer than 4 comparables OR range spread > 50%
  - `verified`: always set when source is `verified_tenant` or `agreed_tenant`

- If confidence is `low`, set `warning` to:
  `"⚠️ Low confidence rent estimate (N comparables, range £X–£Y). Verify before proceeding."`

- If source is `api_estimate`, NEVER silently use it — the warning field must always describe the comparable basis

- If source is `verified_tenant`, void risk percentage should be 2% (pass this in the return object as `voidRiskPct: 2`)
- All other sources: `voidRiskPct: 5` (default), or `8` if `dealInput.tenantIssues` is flagged

Update `dealInput` schema (in `/src/models/deal.js`) to accept:
```js
{
  // existing fields...
  verifiedRent: Number | null,
  verifiedRentSource: String | null,     // e.g. "Lewis Pownall, sourcer"
  verifiedRentDate: String | null,       // ISO date string
  agreedRent: Number | null,
  sourcerEstimatedRent: Number | null,
  isTenanted: Boolean,
  tenantContractType: 'ftsc' | 'periodic' | 'ast' | null,
  tenantMonthsRemaining: Number | null,
  tenantIssues: Boolean,
  addValuePotential: 'none' | 'minor' | 'moderate' | 'major',
  postWorksGDV: Number | null,
}
```

Write unit tests in `/tests/rentResolver.test.js` covering:
- Verified rent takes priority over API estimate
- Low confidence API estimate triggers warning
- Void risk is 2% for verified tenant, 5% for vacant
- Correct confidence banding at 3, 5, and 9 comparable counts

---

## Change 3 — Tax Calculator (LTT + SDLT)

Refactor `/src/pipeline/taxCalculator.js` to support both Welsh LTT and English SDLT.

Requirements:

Export `calculateTax(purchasePrice, jurisdiction)` returning:
```js
{
  jurisdiction: 'WALES' | 'ENGLAND',
  taxType: 'LTT' | 'SDLT',
  taxAmount: Number,
  bandBreakdown: [
    { band: '£0 – £180,000', rate: '4%', taxableAmount: Number, taxDue: Number },
    // ...
  ],
  sourcerQuote: Number | null,          // populated if passed in
  discrepancy: Number | null,           // sourcerQuote - taxAmount, null if no quote
  discrepancyFlag: Boolean              // true if Math.abs(discrepancy) > 200
}
```

Welsh LTT bands (additional dwelling / company purchase — Langdon Property Group always uses these):
```
£0 – £180,000:          4%
£180,001 – £250,000:    7.5%
£250,001 – £400,000:    9%
£400,001 – £750,000:    11.5%
£750,001 – £1,500,000:  14%
Above £1,500,000:       16%
```

English SDLT bands (additional dwelling surcharge):
```
£0 – £250,000:          3%
£250,001 – £925,000:    8%
£925,001 – £1,500,000:  13%
Above £1,500,000:       15%
```

Note: Both tax systems use a flat rate applied to the full purchase price in the relevant band — NOT a tiered/progressive calculation like personal SDLT. Apply the single applicable rate to the full price.

Example assertion:
```js
calculateTax(86000, 'WALES').taxAmount === 3440  // 86000 × 4%
calculateTax(86000, 'ENGLAND').taxAmount === 2580 // 86000 × 3%
```

Write unit tests in `/tests/taxCalculator.test.js` covering:
- £86,000 Welsh → £3,440
- £86,000 English → £2,580
- £200,000 Welsh (crosses 180k band)
- Discrepancy flag triggers when sourcer quote differs by more than £200

---

## Change 4 — Per-Strategy Validation (replace global pass/fail)

Refactor `/src/pipeline/validator.js` to assess viability per strategy instead of returning a single boolean.

Requirements:

Export `validateDeal(dealData)` returning:
```js
{
  strategies: {
    btl:        { viable: Boolean, reasons: String[] },
    brrr:       { viable: Boolean, reasons: String[] },
    buyAndHold: { viable: Boolean, reasons: String[] },
    flip:       { viable: Boolean, reasons: String[] },
  },
  viableCount: Number,           // 0–4
  recommended: 'btl' | 'brrr' | 'buyAndHold' | 'flip' | null,
  globalDisqualified: Boolean,
  globalDisqualifyReasons: String[],
  headline: String               // e.g. "2 of 4 strategies viable: BTL ✅ BRRR ✅ Buy & Hold ❌ Flip ❌"
}
```

Per-strategy criteria:

**BTL:**
- BMV ≥ 15% on current MV, OR BMV ≥ 20% on post-works GDV (if provided)
- Gross yield ≥ 7% (using resolved rent from rentResolver)
- Net monthly cashflow > 0
- ICR ≥ 125% at 6% stress-test rate

**BRRR:**
- Post-works GDV must be provided (if not: mark not viable, reason: "No post-works GDV provided")
- 75% LTV of post-works GDV ≥ 80% of total cash invested (purchase + refurb + costs)
- Net monthly cashflow > 0 post-refinance
- Refurb cost must be provided and > 0

**Buy & Hold:**
- BMV ≥ 10%
- Net monthly cashflow ≥ 0 (neutral or positive)

**Flip:**
- Profit on cost ≥ 20% (profit = MV - purchase price - refurb - all costs)
- Flag in reasons if asking price is within 5% of ceiling

**Global disqualifiers (fail all strategies immediately):**
- Asking price > £500,000
- Property type is commercial, land, or mixed-use
- Missing required fields: postcode, askingPrice, marketValue
- `dealData.majorStructuralIssues === true`

Remove all references to the old single `PASS` / `FAIL` boolean from the codebase. Update any callers of `validateDeal` accordingly.

Write unit tests in `/tests/validator.test.js` covering:
- Brookdale Street scenario: £86k purchase, £105k MV, £850/mo rent → BTL and BRRR viable
- Global disqualifier short-circuits all strategies
- BRRR fails gracefully when no post-works GDV provided
- Headline string format is correct

---

## Change 5 — Welsh Tenancy Law Module

Create `/src/pipeline/welshTenancyRules.js`.

Requirements:

Export `getWelshTenancyContext(dealInput)` returning:
```js
{
  applicable: Boolean,                 // true if Welsh property
  contractType: 'ftsc' | 'periodic' | 'unknown',
  landlordNoticePeriodMonths: Number,  // always 6 for Welsh properties
  canGiveNoticeNow: Boolean,           // false if FTSC within first 6 months
  voidRiskPct: Number,                 // 2 (sitting tenant) or 5 (vacant) or 8-10 (issues)
  legalCostBuffer: Number,             // £0 normally, £1500 if tenantIssues flagged
  epcRating: String | null,
  epcCompliant: Boolean | null,        // null if rating unknown; true if E or above
  epcMediumTermRisk: Boolean,          // true if rated D (future C requirement)
  epcWarning: String | null,
  notes: String[]                      // human-readable summary of Welsh law implications
}
```

Rules to implement:
- `landlordNoticePeriodMonths` is always 6 for Welsh properties (vs 2 months S21 in England)
- `canGiveNoticeNow` is false if `tenantContractType === 'ftsc'` AND `tenantMonthsRemaining > (totalContractLength - 6)` (i.e. within first 6 months)
- EPC compliance: Band E or above = compliant. Band D = medium-term risk. Below E = non-compliant, flag as compliance cost in refurb budget.
- If `applicable === false`, return all fields as null/false with a note: "English property — Welsh tenancy rules do not apply"

Export separately:
- `getVoidRiskPct(isTenanted, tenantIssues)` — returns 2, 5, or 8

Write unit tests in `/tests/welshTenancyRules.test.js` covering:
- Welsh FTSC with tenant in situ → 2% void, 6 month notice
- Vacant Welsh property → 5% void
- EPC D rating → medium-term risk flag
- EPC F rating → non-compliant flag
- English property → applicable: false

---

## Change 6 — Output Formatter Updates

Update `/src/output/formatter.js` to produce the new deal analysis output format.

The output must follow this structure exactly (adapt from text to your existing output method — JSON, HTML email, SMS, console — as appropriate):

```
DEAL ANALYSIS SUMMARY
=====================
[🏴󠁧󠁢󠁷󠁬󠁳󠁿 WELSH PROPERTY | 🏴󠁧󠁢󠁥󠁮󠁧󠁿 ENGLISH PROPERTY]
Property:   {address}
Type:       {propertyType}
Condition:  {condition}
Tenanted:   {isTenanted ? `Yes — £${rent}/mo, ${contractType}, ${monthsRemaining} months remaining` : 'No — vacant'}

RENT
----
Rent used:        £{rentPCM} PCM
Source:           {sourceLabel}
API comparables:  {apiComparableCount} comps, range £{min}–£{max}, confidence: {confidence}
{warning if present}

Rental comparables:
  Address              | Beds | Rent/mo | Distance | Date
  ---------------------|------|---------|----------|------
  {row per comparable}
  Average ({n} comps): £{avg}/mo

FINANCIALS
----------
Asking Price:     £{askingPrice}
Market Value:     £{marketValue}  ({compCount} comps, avg £{compAvg})
BMV (current):    {bmvCurrent}%
Post-works GDV:   £{postWorksGDV}  [if applicable]
BMV (post-works): {bmvPostWorks}%  [if applicable]
Profit potential: £{profit}

Tax ({taxType}):  £{taxAmount}  [{band breakdown}]
Closing costs:    £{closingCosts}
Refurb:           £{refurbCosts}
Total cash in:    £{totalCashIn}

Gross Yield:      {grossYield}%
Net Yield:        {netYield}%
Monthly cashflow: £{monthlyCashflow}
ICR at 6%:        {icr}%

STRATEGY VIABILITY
------------------
BTL:        {btlViable ? '✅ VIABLE' : '❌ NOT VIABLE'}  — {btlReason}
BRRR:       {brrrViable ? '✅ VIABLE' : '❌ NOT VIABLE'} — {brrrReason}
Buy & Hold: {buyHoldViable ? '✅ VIABLE' : '❌ NOT VIABLE'} — {buyHoldReason}
Flip:       {flipViable ? '✅ VIABLE' : '❌ NOT VIABLE'}  — {flipReason}

Recommended: {recommended} — {recommendedRationale}

DEAL SCORE: {score}/100
  BMV (30%):        {bmvScore}
  Yield (25%):      {yieldScore}
  Condition (15%):  {conditionScore}
  Location (15%):   {locationScore}
  Market (10%):     {marketScore}
  Additional (5%):  {additionalScore}

OVERALL: {viableCount} of 4 strategies viable

WELSH LAW NOTES   [Welsh properties only — omit for English]
----------------
Contract type:    {contractType}
Notice period:    6 months (landlord) — longer than English AST
Void modelling:   {voidRiskPct}% applied
EPC rating:       Band {epcRating} — {epcStatus}
LTT applied:      £{taxAmount} (vs sourcer quote £{sourcerQuote} — {match/discrepancy})

NEXT STEPS
----------
{nextSteps}
```

Additional requirements:
- If `taxDiscrepancyFlag === true`, add a prominent warning line under WELSH LAW NOTES (or FINANCIALS for English): `⚠️ Tax discrepancy: sourcer quoted £X, LTT/SDLT calculates to £Y. Use calculated figure.`
- If `rentConfidence === 'low'`, add a prominent warning before the FINANCIALS section
- Format all currency values with `£` prefix and comma thousands separator
- Format all percentages to 1 decimal place

---

## Change 7 — Database Schema Updates

Update the deals table (or equivalent storage layer) to add these new columns. If using PostgreSQL, write a migration file at `/migrations/YYYYMMDD_deal_analysis_updates.sql`:

```sql
-- Jurisdiction
ALTER TABLE deals ADD COLUMN jurisdiction VARCHAR(10) DEFAULT 'ENGLAND';
ALTER TABLE deals ADD COLUMN is_welsh BOOLEAN GENERATED ALWAYS AS (jurisdiction = 'WALES') STORED;

-- Rent fields
ALTER TABLE deals ADD COLUMN verified_rent INTEGER;
ALTER TABLE deals ADD COLUMN verified_rent_source VARCHAR(255);
ALTER TABLE deals ADD COLUMN verified_rent_date DATE;
ALTER TABLE deals ADD COLUMN rent_source VARCHAR(50);         -- 'verified_tenant' | 'agreed_tenant' | 'sourcer_estimate' | 'api_estimate'
ALTER TABLE deals ADD COLUMN rent_confidence VARCHAR(10);     -- 'high' | 'medium' | 'low' | 'verified'
ALTER TABLE deals ADD COLUMN api_comparable_count INTEGER;
ALTER TABLE deals ADD COLUMN api_rent_min INTEGER;
ALTER TABLE deals ADD COLUMN api_rent_max INTEGER;

-- Tenancy
ALTER TABLE deals ADD COLUMN is_tenanted BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN tenant_contract_type VARCHAR(20); -- 'ftsc' | 'periodic' | 'ast'
ALTER TABLE deals ADD COLUMN tenant_months_remaining INTEGER;
ALTER TABLE deals ADD COLUMN tenant_issues BOOLEAN DEFAULT FALSE;
ALTER TABLE deals ADD COLUMN void_risk_pct DECIMAL(4,2) DEFAULT 5.00;

-- Tax
ALTER TABLE deals ADD COLUMN tax_type VARCHAR(10);            -- 'LTT' | 'SDLT'
ALTER TABLE deals ADD COLUMN tax_amount INTEGER;
ALTER TABLE deals ADD COLUMN sourcer_tax_quote INTEGER;
ALTER TABLE deals ADD COLUMN tax_discrepancy_flag BOOLEAN DEFAULT FALSE;

-- Add-value
ALTER TABLE deals ADD COLUMN add_value_potential VARCHAR(10) DEFAULT 'none'; -- 'none' | 'minor' | 'moderate' | 'major'
ALTER TABLE deals ADD COLUMN post_works_gdv INTEGER;
ALTER TABLE deals ADD COLUMN bmv_post_works DECIMAL(5,2);

-- Per-strategy viability (replace single pass/fail boolean)
ALTER TABLE deals ADD COLUMN btl_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN brrr_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN buy_hold_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN flip_viable BOOLEAN;
ALTER TABLE deals ADD COLUMN viable_strategy_count INTEGER;
ALTER TABLE deals ADD COLUMN recommended_strategy VARCHAR(20);

-- Deprecate old pass/fail column (do not drop yet — keep for rollback)
ALTER TABLE deals ADD COLUMN legacy_pass_fail BOOLEAN;
-- After confirming new columns work in production: DROP COLUMN pass_fail
```

If not using PostgreSQL, implement equivalent schema changes for your storage layer and note what was changed.

---

## Change 8 — Pipeline Integration (wire everything together)

Update the main deal processing pipeline entry point (likely `/src/pipeline/index.js` or similar) to call the new modules in the correct order:

```
1. detectJurisdiction(postcode)
2. resolveRent(dealInput, apiData)
3. calculateTax(purchasePrice, jurisdiction)
4. getWelshTenancyContext(dealInput)   [only if Welsh]
5. validateDeal(enrichedDealData)       [per-strategy]
6. scoreDeal(enrichedDealData)
7. formatOutput(allResults)
8. saveToDatabase(allResults)
9. sendNotification(allResults)         [if viableCount >= 1]
```

Requirements:
- Jurisdiction must be detected before any other step
- Rent must be resolved before validation or scoring
- Welsh tenancy context must be computed before formatting
- Notification should fire if `viableCount >= 1` (not only if all 4 pass)
- Include the strategy count in the Twilio SMS alert: `"[DEAL ALERT] 2/4 strategies viable — Brookdale St SA11. BTL ✅ BRRR ✅. Reply INFO for full report."`

---

## Testing

After implementing all changes, run the following integration test scenario and confirm the output matches expectations:

**Test input — Brookdale Street (the deal that previously produced a false FAIL):**
```js
{
  address: 'Brookdale Street, Neath',
  postcode: 'SA11 1PE',
  askingPrice: 86000,
  marketValue: 105000,
  propertyType: 'terraced_house',
  condition: 'average',
  isTenanted: true,
  verifiedRent: 850,
  verifiedRentSource: 'Lewis Pownall, deal sourcer',
  verifiedRentDate: '2026-05-13',
  tenantContractType: 'ftsc',
  tenantMonthsRemaining: null,
  tenantIssues: false,
  addValuePotential: 'major',
  postWorksGDV: 115000,
  epcRating: 'D',
  sourcerTaxQuote: 4300,
  refurbCosts: 3000,
  closingCosts: 1300,
  mortgageRate: 0.06,
  ltv: 0.75,
}
```

**Expected output:**
- Jurisdiction: WALES
- Rent used: £850/mo, source: verified_tenant, confidence: verified
- LTT: £3,440 (not £4,300), discrepancy flag: true
- BMV current: 18.1%, BMV post-works: 25.2%
- BTL: viable, BRRR: viable
- Viable count: at least 2 of 4
- Welsh law notes section present
- EPC D → medium-term risk flag
- NO global FAIL in output

---

## Definition of Done

- [ ] All 8 modules created or updated
- [ ] Unit tests written and passing for each module
- [ ] Integration test (Brookdale scenario) passes
- [ ] Old single-boolean pass/fail removed from all output and notifications
- [ ] Database migration written
- [ ] No API rent estimate is used silently anywhere in the pipeline
- [ ] Welsh postcode triggers LTT, Occupation Contract rules, and 6-month notice period automatically
- [ ] `formatter.js` produces the new output format with all sections
