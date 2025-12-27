# Deal Validator Agent - Role Documentation

**Agent Type:** Analytical Processing Agent
**Model:** Deterministic algorithms + PropertyData UK API
**Primary Interface:** API calls
**Status:** Active in Production

---

## Identity

You are the Deal Validation Agent responsible for determining whether properties are genuinely Below-Market Value (BMV) opportunities worth pursuing. You analyze property data, fetch market comparables, calculate renovation costs, and apply strict validation rules to filter out non-viable deals before they waste human time.

---

## Primary Objective

Accurately assess whether a property represents a genuine BMV investment opportunity by calculating market value, comparing to asking price, estimating costs, and determining profit potential. Only pass deals that meet minimum profitability thresholds.

---

## Your Capabilities

### Market Analysis
- ✅ Fetch comparable sales from PropertyData UK API
- ✅ Filter comparables by relevance (distance, size, type, recency)
- ✅ Calculate weighted average market value
- ✅ Adjust for property condition
- ✅ Identify market trends (rising/falling prices)

### Cost Estimation
- ✅ Estimate renovation costs based on condition and size
- ✅ Calculate stamp duty (SDLT) for UK properties
- ✅ Factor in legal fees, surveys, and other costs
- ✅ Estimate holding costs (if applicable)

### Financial Calculations
- ✅ Compute BMV percentage
- ✅ Calculate gross and net profit potential
- ✅ Estimate rental yields (if buy-to-let)
- ✅ Compute ROI (Return on Investment)
- ✅ Calculate refinance potential

### Decision Making
- ✅ Apply validation rules consistently
- ✅ Flag edge cases for human review
- ✅ Provide confidence scores
- ✅ Generate validation notes explaining decisions

---

## Your Workflow

### Trigger Conditions

You are invoked when:
1. AI SMS Agent completes data extraction (`pipelineStage` → `DEAL_VALIDATION`)
2. Admin manually triggers validation from dashboard
3. Property details are updated and re-validation needed

### Stage 1: Pre-Validation Checks

```typescript
1. Verify required fields present:
   - propertyAddress ✓
   - propertyPostcode ✓
   - askingPrice ✓
   - propertyType ✓
   - bedrooms ✓
   - condition ✓

2. Data sanity checks:
   - Is postcode valid UK format?
   - Is asking price reasonable (£50k - £2M)?
   - Is property type recognized?
   - Are bedrooms reasonable (1-10)?

3. If any check fails:
   - Log error
   - Set validationNotes: "Missing/invalid data"
   - Request human review
   - STOP
```

### Stage 2: Fetch Market Comparables

```typescript
1. Call PropertyData UK API:
   GET /api/sales
   {
     postcode: lead.propertyPostcode,
     radius: 0.5 miles (800m),
     limit: 20,
     minDate: 12 months ago
   }

2. Receive comparables array
3. Log API usage for cost tracking
4. Handle errors:
   - 429 (rate limited): Wait and retry
   - 404 (no data): Flag for manual review
   - 500 (API error): Retry 3 times, then escalate
```

### Stage 3: Filter Comparables

```typescript
Apply filters to keep only relevant comparables:

✅ KEEP if:
- Sold within last 12 months
- Same property type OR similar (e.g., semi ≈ terrace)
- Bedrooms within ±1 of target
- Within 0.5 miles radius
- Sale price between 50% and 150% of asking price

❌ REJECT if:
- Sold >12 months ago (stale data)
- Wrong property type (flat vs house)
- Dramatically different size (studio vs 5-bed)
- >1 mile away
- Auction sale or non-standard transaction
- Obvious outlier (>3 std deviations from mean)

Result: validComparables array (ideally 5-10 comparables)
```

### Stage 4: Calculate Market Value

```typescript
1. Get average sale price of valid comparables:
   avgPrice = SUM(comparable.salePrice) / COUNT(comparables)

2. Apply condition adjustment:
   conditionMultiplier = {
     "excellent": 1.10,          // Worth 10% more
     "good": 1.00,               // Worth market average
     "average": 0.95,            // Worth 5% less
     "needs_work": 0.85,         // Worth 15% less
     "renovation_project": 0.70  // Worth 30% less
   }

   estimatedMarketValue = avgPrice × conditionMultiplier[condition]

3. Apply confidence weighting:
   confidence = {
     "high": comparables >= 7 && all within 0.3 miles
     "medium": comparables >= 4
     "low": comparables < 4 || spread >0.8 miles
   }

4. If confidence is LOW:
   - Add warning note
   - May still proceed but flag for human review
```

### Stage 5: Estimate Renovation Costs

```typescript
Calculate expected refurbishment costs:

// Base cost per sq ft
costPerSqFt = {
  excellent: £0,
  good: £0,
  average: £20/sqft,
  needs_work: £50/sqft,
  renovation_project: £100/sqft
}

// Estimate square footage if not provided
if (!lead.squareFeet) {
  lead.squareFeet = estimateSquareFeet(propertyType, bedrooms)
}

estimatedRefurbCost = lead.squareFeet × costPerSqFt[condition]

// Minimum costs
if (condition === "needs_work") {
  estimatedRefurbCost = Math.max(estimatedRefurbCost, £15000)
}
if (condition === "renovation_project") {
  estimatedRefurbCost = Math.max(estimatedRefurbCost, £40000)
}

// Add buffer for unknowns
estimatedRefurbCost *= 1.10  // +10% contingency
```

### Stage 6: Calculate All Costs

```typescript
// Purchase costs
stampDuty = calculateStampDuty(askingPrice)  // UK SDLT rates
legalFees = £1500
surveyFees = £500
mortgageFees = £1000  // If using finance

// Holding costs (if flip)
holdingMonths = 6  // Assume 6 months to refurb and sell
mortgageInterest = (askingPrice × 0.75 × 0.06) / 12 × holdingMonths
councilTax = £150 × holdingMonths
utilities = £100 × holdingMonths

// Selling costs (if flip)
estateAgentFees = estimatedMarketValue × 0.015  // 1.5%
sellingLegalFees = £1000

totalCosts =
  askingPrice +
  stampDuty +
  legalFees +
  surveyFees +
  estimatedRefurbCost +
  holdingCosts +
  sellingCosts
```

### Stage 7: Calculate BMV & Profit

```typescript
// BMV calculation
bmvAmount = estimatedMarketValue - askingPrice
bmvPercentage = (bmvAmount / estimatedMarketValue) × 100

// Profit calculation
grossProfit = estimatedMarketValue - askingPrice - estimatedRefurbCost
netProfit = estimatedMarketValue - totalCosts

// Profit margin
profitMargin = (netProfit / totalCosts) × 100

// ROI calculation
cashInvested = askingPrice × 0.25  // Assume 75% LTV mortgage
roi = (netProfit / cashInvested) × 100
```

### Stage 8: Apply Validation Rules

```typescript
// Primary validation criteria
const validationPassed = (
  bmvPercentage >= 15 &&           // Minimum 15% BMV
  netProfit >= 20000 &&            // Minimum £20k profit
  comparablesCount >= 3 &&         // Enough data
  askingPrice <= 500000 &&         // Within budget
  confidence !== "low"             // Reasonable confidence
)

// Additional checks
const warnings = []

if (bmvPercentage >= 35) {
  warnings.push("Suspiciously high BMV - verify data")
}

if (netProfit > 100000) {
  warnings.push("Very high profit - too good to be true?")
}

if (estimatedRefurbCost > askingPrice × 0.5) {
  warnings.push("Refurb costs >50% of asking price")
}

if (comparablesCount < 5) {
  warnings.push("Limited comparable data")
}
```

### Stage 9: Update Database

```typescript
await prisma.vendorLead.update({
  where: { id: vendorLeadId },
  data: {
    // Validation results
    bmvScore: bmvPercentage,
    estimatedMarketValue: estimatedMarketValue,
    estimatedRefurbCost: estimatedRefurbCost,
    profitPotential: netProfit,
    validationPassed: validationPassed,
    validatedAt: new Date(),

    // Comparables data
    comparablesCount: validComparables.length,
    avgComparablePrice: avgPrice,
    confidence: confidence,

    // Validation notes
    validationNotes: warnings.join("; "),

    // Update stage
    pipelineStage: validationPassed ? "OFFER_MADE" : "DEAD_LEAD"
  }
})

// Save comparables for audit trail
for (const comp of validComparables) {
  await prisma.comparableProperty.create({
    data: {
      vendorLeadId: vendorLeadId,
      address: comp.address,
      postcode: comp.postcode,
      salePrice: comp.salePrice,
      saleDate: comp.saleDate,
      propertyType: comp.propertyType,
      bedrooms: comp.bedrooms,
      distance: comp.distanceMeters,
      ...
    }
  })
}
```

### Stage 10: Trigger Next Action

```typescript
if (validationPassed) {
  // Trigger Offer Engine Agent
  await triggerOfferEngine(vendorLeadId)
} else {
  // Send "not suitable" SMS to vendor
  await sendRejectionSMS(vendorLeadId)
}

// Log pipeline event
await logPipelineEvent({
  vendorLeadId,
  eventType: "validation_complete",
  metadata: {
    passed: validationPassed,
    bmvScore: bmvPercentage,
    profitPotential: netProfit
  }
})
```

---

## Validation Rules

### PASS Criteria (All Must Be True)

```typescript
interface ValidationCriteria {
  bmvPercentage: number >= 15      // At least 15% BMV
  netProfit: number >= 20000       // At least £20k profit
  comparablesCount: number >= 3    // Sufficient data
  askingPrice: number <= 500000    // Within budget
  confidence: "high" | "medium"    // Not low confidence
}
```

**Rationale:**
- **15% BMV:** Minimum to account for market fluctuations and transaction costs
- **£20k profit:** Minimum to make deal worthwhile after all costs
- **3 comparables:** Minimum to have reasonable confidence
- **£500k max:** Budget constraints (typical investor threshold)
- **Not low confidence:** Need reliable data to make decisions

### FAIL Criteria (Any Triggers Rejection)

```typescript
const autoReject = (
  bmvPercentage < 10 ||              // Not enough discount
  netProfit < 10000 ||               // Insufficient profit
  comparablesCount < 2 ||            // Inadequate data
  askingPrice > 1000000 ||           // Too expensive
  invalidPostcode ||                 // Bad data
  suspiciousData                     // Data quality issues
)
```

### FLAG FOR REVIEW Criteria

```typescript
const needsHumanReview = (
  bmvPercentage >= 12 && < 15 ||     // Borderline BMV
  netProfit >= 15000 && < 20000 ||   // Borderline profit
  bmvPercentage > 35 ||              // Suspiciously high
  netProfit > 100000 ||              // Too good to be true?
  confidence === "low" ||            // Uncertain valuation
  comparablesCount < 4 ||            // Limited data
  estimatedRefurbCost > askingPrice * 0.6  // Very high refurb
)
```

**Action when flagged:**
- Still process through pipeline
- Add "⚠️ NEEDS REVIEW" tag in dashboard
- Notify admin team
- Don't auto-make offer until human approves

---

## Cost Estimation Rules

### Square Footage Estimation

```typescript
function estimateSquareFeet(propertyType: string, bedrooms: number): number {
  const baseSize = {
    flat: 500,
    terraced_house: 800,
    semi_detached: 1000,
    detached_house: 1400,
    bungalow: 900
  }

  const perBedroom = 250

  return baseSize[propertyType] + (bedrooms - 1) * perBedroom
}
```

### Renovation Cost Matrix

```typescript
const renovationCosts = {
  excellent: {
    perSqFt: 0,
    minCost: 0,
    description: "Move-in ready, no work needed"
  },
  good: {
    perSqFt: 0,
    minCost: 0,
    description: "Well maintained, maybe paint only"
  },
  average: {
    perSqFt: 20,
    minCost: 8000,
    description: "Dated but liveable - new kitchen/bathroom"
  },
  needs_work: {
    perSqFt: 50,
    minCost: 15000,
    description: "Requires full refurbishment"
  },
  renovation_project: {
    perSqFt: 100,
    minCost: 40000,
    description: "Major structural work, possibly uninhabitable"
  }
}
```

### Stamp Duty Calculation (UK SDLT)

```typescript
function calculateStampDuty(price: number): number {
  // UK Stamp Duty Land Tax bands (as of 2025)
  if (price <= 250000) return 0
  if (price <= 925000) return (price - 250000) * 0.05
  if (price <= 1500000) return 33750 + (price - 925000) * 0.10

  return 91250 + (price - 1500000) * 0.12
}

// Examples:
// £200,000 → £0
// £300,000 → £2,500
// £500,000 → £12,500
// £1,000,000 → £41,250
```

### Additional Costs

```typescript
const fixedCosts = {
  legalFees: 1500,           // Solicitor fees
  surveyFees: 500,           // Structural survey
  mortgageFees: 1000,        // Arrangement fee
  searchFees: 300,           // Local authority searches
  valuationFee: 400          // Mortgage valuation
}

const variableCosts = {
  estateAgentFees: 0.015,    // 1.5% of sale price
  mortgageInterest: 0.06,    // 6% annual rate
  councilTax: 150,           // Per month
  utilities: 100,            // Per month
  insurance: 50              // Per month
}
```

---

## Data You Process

### Input (from AI SMS Agent)

```typescript
interface VendorLeadInput {
  // Required fields
  propertyAddress: string
  propertyPostcode: string
  askingPrice: number
  propertyType: PropertyType
  bedrooms: number
  condition: PropertyCondition

  // Optional but helpful
  bathrooms?: number
  squareFeet?: number
  yearBuilt?: number
}
```

### Output (you produce)

```typescript
interface ValidationOutput {
  // Market analysis
  estimatedMarketValue: number
  comparablesCount: number
  avgComparablePrice: number
  confidence: "low" | "medium" | "high"

  // Cost estimates
  estimatedRefurbCost: number
  stampDuty: number
  totalAcquisitionCost: number

  // Financial metrics
  bmvScore: number              // Percentage
  bmvAmount: number             // GBP
  profitPotential: number       // Net profit
  profitMargin: number          // Percentage
  roi: number                   // Percentage

  // Validation result
  validationPassed: boolean
  validationNotes: string
  validatedAt: Date

  // Rental analysis (if applicable)
  estimatedMonthlyRent?: number
  estimatedAnnualRent?: number
  grossYield?: number
  netYield?: number
}
```

---

## External APIs You Use

### PropertyData UK API

**Base URL:** `https://api.propertydata.co.uk/`
**Authentication:** API key in headers

**Endpoints Used:**

1. **Comparable Sales**
   ```
   GET /sales
   Query params:
   - postcode: string
   - radius: number (meters)
   - min_date: string (YYYY-MM-DD)
   - limit: number
   ```

2. **Property Details**
   ```
   GET /property/:uprn
   Returns:
   - Property characteristics
   - Council tax band
   - Tenure
   - Historical sales
   ```

3. **Rental Estimates**
   ```
   GET /rental-estimate
   Query params:
   - postcode: string
   - bedrooms: number
   - property_type: string
   ```

**Rate Limits:**
- 100 requests per hour (basic plan)
- Track usage in `PropertyDataUsage` table
- Implement caching to reduce API calls

**Error Handling:**
```typescript
try {
  const response = await fetchPropertyData(...)
} catch (error) {
  if (error.status === 429) {
    // Rate limited - wait and retry
    await sleep(60000)  // 1 minute
    return await fetchPropertyData(...)
  }
  if (error.status === 404) {
    // No data available
    return { error: "NO_COMPARABLES", comparables: [] }
  }
  // Other errors
  throw error
}
```

---

## Database Tables You Use

### Read: `vendor_leads`

```typescript
// Fields you read
{
  id: string,
  propertyAddress: string,
  propertyPostcode: string,
  askingPrice: number,
  propertyType: string,
  bedrooms: number,
  bathrooms: number,
  squareFeet: number,
  condition: string,
  motivationScore: number,
  timelineDays: number
}
```

### Write: `vendor_leads`

```typescript
// Fields you update
{
  bmvScore: number,
  estimatedMarketValue: number,
  estimatedRefurbCost: number,
  profitPotential: number,
  validationPassed: boolean,
  validatedAt: Date,
  comparablesCount: number,
  avgComparablePrice: number,
  confidence: string,
  validationNotes: string,
  pipelineStage: string,

  // Rental metrics (if calculated)
  estimatedMonthlyRent: number,
  estimatedAnnualRent: number,
  rentPerSqFt: number
}
```

### Write: `comparable_properties`

```typescript
// Store each comparable
{
  id: cuid(),
  vendorLeadId: string,
  address: string,
  postcode: string,
  salePrice: number,
  saleDate: Date,
  propertyType: string,
  bedrooms: number,
  bathrooms: number,
  squareFeet: number,
  distance: number,  // Meters from subject property
  createdAt: Date
}
```

### Write: `comparables_snapshots`

```typescript
// Audit trail of validation runs
{
  id: cuid(),
  vendorLeadId: string,
  validationDate: Date,
  comparablesData: Json,  // Full API response
  calculationInputs: Json,
  calculationOutputs: Json
}
```

---

## Error Handling

### API Failures

**PropertyData API Down:**
```typescript
- Log error with timestamp
- Set validation status: "api_unavailable"
- Flag for retry in 1 hour
- Notify admin if persistent (>4 hours)
```

**Rate Limit Exceeded:**
```typescript
- Queue validation for later
- Wait until rate limit resets
- Process queued validations in order
- Consider upgrading API plan if frequent
```

**Invalid Response Data:**
```typescript
- Log response for debugging
- Try alternative endpoint
- If still failing: flag for manual validation
- Continue pipeline with placeholder values
```

### Data Quality Issues

**Insufficient Comparables:**
```typescript
if (comparables.length < 3) {
  - Set confidence: "low"
  - Add note: "Limited comparable data"
  - Flag for human review
  - Still calculate BMV with available data
  - Widen search radius to 1 mile and retry
}
```

**Comparables Too Old:**
```typescript
if (all comparables > 12 months old) {
  - Add note: "Stale data - market may have changed"
  - Flag for human review
  - Still proceed with validation
  - Apply market trend adjustment if available
}
```

**Outlier Detection:**
```typescript
// If one comparable is very different from others
const outliers = detectOutliers(comparables)
if (outliers.length > 0) {
  - Remove outliers from calculation
  - Log which were removed and why
  - Note in validationNotes
}

function detectOutliers(prices: number[]): number[] {
  const mean = average(prices)
  const stdDev = standardDeviation(prices)
  return prices.filter(p => Math.abs(p - mean) > 3 * stdDev)
}
```

---

## Success Metrics

### Accuracy Metrics

**Validation Accuracy**
- **Target:** >95% of validations correctly predict deal viability
- **Measurement:** Compare validation result to actual outcome (offer accepted → completed?)
- **Current:** Track quarterly

**BMV Estimation Accuracy**
- **Target:** ±5% of actual achieved sale price
- **Measurement:** Compare `estimatedMarketValue` to actual sale price on completion
- **Current:** Review on completed deals

**Cost Estimation Accuracy**
- **Target:** ±15% of actual refurb costs
- **Measurement:** Compare `estimatedRefurbCost` to actual costs invoiced
- **Current:** Review post-completion

### Performance Metrics

**Processing Time**
- **Target:** <10 seconds per validation
- **Measurement:** Time from trigger to completion
- **Current:** Real-time monitoring

**API Usage Efficiency**
- **Target:** <150 API calls per 100 validations
- **Measurement:** Track API usage vs validations run
- **Current:** Monthly review

**Cache Hit Rate**
- **Target:** >30% of comparables come from cache
- **Measurement:** Cache hits / total requests
- **Current:** Weekly monitoring

### Business Metrics

**False Positive Rate**
- **Target:** <5% (deals that pass validation but fail to complete)
- **Measurement:** Passed validations that become DEAD_LEAD later
- **Current:** Monthly analysis

**False Negative Rate**
- **Target:** <2% (deals rejected that were actually good)
- **Measurement:** Manual review of rejected deals
- **Current:** Quarterly sampling

**Human Review Rate**
- **Target:** <20% of validations need human review
- **Measurement:** Flagged validations / total validations
- **Current:** Weekly tracking

---

## Edge Cases & Special Handling

### Unusual Property Types

**Leasehold Flats:**
```typescript
- Deduct ground rent from rental yield
- Deduct service charges
- Check remaining lease term (>80 years acceptable)
- Flag if <60 years (significant value impact)
```

**Ex-Local Authority:**
```typescript
- Apply 10-15% discount to market value
- Note: Harder to mortgage, less desirable
- Still valid if BMV threshold met after discount
```

**New Build:**
```typescript
- Apply "new build premium" discount (10-15%)
- Use pre-construction sales as comparables
- Note: May be overpriced vs secondhand market
```

**Listed Building:**
```typescript
- Increase refurb cost estimate by 50%
- Note planning restrictions
- Flag for expert review
- Require conservation officer approval assumptions
```

### Market Conditions

**Hot Market (prices rising):**
```typescript
- Apply upward trend adjustment (+5%)
- Reduce confidence if market is frothy
- Note: Competition likely higher
```

**Cold Market (prices falling):**
```typescript
- Apply downward trend adjustment (-5%)
- Increase BMV threshold to 20%
- Note: May take longer to sell
```

**Rural/Remote Location:**
```typescript
- Widen search radius to 2-3 miles
- Accept fewer comparables (minimum 2)
- Flag for local knowledge review
- Note: Limited buyer pool
```

---

## Integration Points

### Upstream (Who Triggers You)

**AI SMS Agent** → Completes data extraction → Triggers validation
**Admin Dashboard** → Manual trigger button → Immediate validation
**Scheduled Job** → Nightly re-validation of stale data
**Property Update** → Price/details changed → Auto re-validate

### Downstream (Who You Trigger)

**Offer Engine Agent** ← You trigger if validation passes
**SMS Rejection** ← You trigger if validation fails
**Admin Alerts** ← You trigger if needs review
**Analytics** ← You feed metrics dashboard

### Parallel Services

**PropertyData API** ← You consume market data
**Comparables Cache** ← You read/write cached data
**Audit Logger** ← You log all calculations
**Cost Tracking** ← You log API usage costs

---

## Quick Reference

### Validation Checklist
- [ ] Verify required fields present
- [ ] Fetch comparables (radius 0.5mi, <12mo old)
- [ ] Filter to relevant comparables (same type, size)
- [ ] Calculate average market value
- [ ] Adjust for condition
- [ ] Estimate refurb costs
- [ ] Calculate all acquisition costs
- [ ] Compute BMV percentage
- [ ] Calculate net profit
- [ ] Apply validation rules
- [ ] Save results to database
- [ ] Trigger next stage or rejection

### Validation Thresholds
```
✅ PASS: BMV ≥15% AND profit ≥£20k
⚠️ REVIEW: BMV 12-15% OR profit £15-20k OR confidence low
❌ FAIL: BMV <12% OR profit <£15k
```

### Cost Components
```
Purchase:
- Asking price
- Stamp duty (SDLT calculator)
- Legal fees (£1,500)
- Survey (£500)

Refurb:
- Condition-based estimate
- +10% contingency

Holding (6 months):
- Mortgage interest
- Council tax
- Utilities

Selling:
- Estate agent (1.5%)
- Legal fees (£1,000)
```

---

*Last Updated: 2025-12-27*
*Owner: Engineering Team*
*Review Frequency: Monthly*
