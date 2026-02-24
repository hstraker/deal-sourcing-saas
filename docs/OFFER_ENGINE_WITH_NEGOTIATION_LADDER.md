# Claude Code Prompt: Offer Engine + Negotiation Ladder System

## Context
I have an Excel property analyser with a proven two-strategy offer methodology (Flip/Hold) using
goal-seek mathematics to calculate maximum purchase prices from required returns. I want to extend
this with a structured negotiation ladder system that generates a sequence of tapering counter-offers,
all bounded by the goal-seek ceiling, and display the full ladder in the production validation UI.

---

## Task Overview — Do this in order:

1. Read existing offer engine and production validation UI files
2. Create `lib/offer-engine/property-offer-calculator.ts` — the core financial engine
3. Create `lib/offer-engine/negotiation-ladder.ts` — the counter-offer sequence generator
4. Create `lib/offer-engine/offer-tooltips.ts` — tooltip explanations for every metric
5. Create `components/deals/offer-analysis-panel.tsx` — the full UI with ladder and tooltips
6. Create `components/deals/negotiation-ladder-panel.tsx` — the visual offer ladder component
7. Update Prisma schema for negotiation state tracking
8. Create/update the API route for offer progression
9. Run `npx tsc --noEmit` — fix all errors before finishing

---

## Step 1: Explore Existing Code

Search the codebase for:
- Any file named offer-engine, offerEngine, negotiation, or similar
- The production validation UI component (likely in `components/deals/`)
- The deal validation modal or review queue component
- Existing offer-related Prisma models and types
- How offers are currently sent (API route pattern)

Show me what you find before making any changes.

---

## Step 2: Core Financial Engine

Create `lib/offer-engine/property-offer-calculator.ts`

### Input Types

```typescript
export interface OfferEngineInputs {
  // Property
  askingPrice: number
  gdv: number                           // Gross Development Value
  estimatedRent: number                 // Monthly PCM
  totalRefurbishment: number
  propertySize?: number                 // sqm

  // Bridging loan
  bridgingLTV?: number                  // default 0.75
  bridgingArrangementFee?: number       // default 0.01
  bridgingInterestRateMonthly?: number  // default 0.0075
  bridgingMonths?: number               // default 12
  bridgingExitFee?: number              // default 0.005
  bridgingLegalFees?: number            // default 1500
  bridgingValuationFees?: number        // default 750

  // Acquisition costs
  stampDuty?: number                    // calculated if not provided
  solicitorFees?: number                // default 1500
  searches?: number                     // default 350
  buildingControl?: number              // default 600

  // Project costs
  contingencyPercent?: number           // default 0
  utilityBillsMonthly?: number          // default 30
  councilTaxMonthly?: number            // default 30
  furnishingCosts?: number              // default 1000

  // Mortgage (exit finance)
  mortgageLTV?: number                  // default 0.75
  mortgageRate?: number                 // annual, default 0.0459
  mortgageArrangementFeePercent?: number // default 0.02
  mortgageBrokerFee?: number            // default 800
  rentalCoverageRequirement?: number    // default 1.25 (ICR)

  // Monthly running costs
  managementPercent?: number            // default 0
  maintenanceMonthly?: number           // default 0
  buildingInsuranceMonthly?: number     // default 10
  voidsMonthsPerYear?: number           // default 0.5

  // Deal criteria
  flipCriteriaROI?: number              // default 0.20
  holdCriteriaROCEMultiple?: number     // default 2.5
  maxViewingDiscountPercent?: number    // default 0.20
}
```

### Calculations to Implement

Apply these defaults first via a `withDefaults(inputs)` helper, then implement:

**Bridging Finance (at a given purchasePrice)**
```typescript
grossLoan = purchasePrice * bridgingLTV
arrangementFee = grossLoan * bridgingArrangementFee
monthlyInterest = grossLoan * bridgingInterestRateMonthly
totalInterest = monthlyInterest * bridgingMonths
exitFee = grossLoan * bridgingExitFee
netLoanAdvance = grossLoan - arrangementFee - exitFee
totalBridgingCosts = arrangementFee + totalInterest + exitFee + bridgingLegalFees + bridgingValuationFees
deposit = purchasePrice - netLoanAdvance
```

**Acquisition Costs**
```typescript
totalAcquisitionCosts = deposit + stampDuty + solicitorFees + searches + buildingControl
```

**Project Costs**
```typescript
contingency = totalRefurbishment * contingencyPercent
holdingUtilities = utilityBillsMonthly * bridgingMonths
holdingCouncilTax = councilTaxMonthly * bridgingMonths
totalProjectCosts = totalRefurbishment + contingency + holdingUtilities + holdingCouncilTax + furnishingCosts
```

**Mortgage / Exit Finance (always on GDV)**
```typescript
mortgageLoanAmount = gdv * mortgageLTV
monthlyMortgagePayment = (mortgageLoanAmount * mortgageRate) / 12
mortgageArrangementFee = mortgageLoanAmount * mortgageArrangementFeePercent
totalMortgageCosts = mortgageArrangementFee + mortgageBrokerFee
requiredRentForICR = monthlyMortgagePayment * rentalCoverageRequirement
icrPass = estimatedRent >= requiredRentForICR
```

**Monthly Cashflow**
```typescript
managementCost = estimatedRent * managementPercent
voidCostMonthly = (estimatedRent / 12) * voidsMonthsPerYear
netMonthlyCashflow = estimatedRent - managementCost - monthlyMortgagePayment
                     - maintenanceMonthly - buildingInsuranceMonthly - voidCostMonthly
annualCashflow = netMonthlyCashflow * 12
grossYield = (estimatedRent * 12) / gdv
```

**Key Metrics (at a given purchasePrice)**
```typescript
totalCost = purchasePrice + totalBridgingCosts + totalAcquisitionCosts
            + totalProjectCosts + totalMortgageCosts
totalEquityInvested = totalAcquisitionCosts + totalProjectCosts + totalMortgageCosts
profit = gdv - totalCost
profitOnCost = profit / totalCost                                    // FLIP metric
cashSurplus = mortgageLoanAmount - totalEquityInvested               // negative = money left in
moneyLeftIn = Math.max(cashSurplus * -1, 0)
roce = annualCashflow / Math.max(moneyLeftIn, 1)                     // HOLD metric
roceMultiple = roce / mortgageRate
```

**Goal-Seek Solvers — Binary Search**

```typescript
// Tolerance: £1. Max iterations: 100.
// Search range: £10,000 to askingPrice * 1.5 (cap upper bound)

function solveFlipMaxPurchasePrice(inputs: ResolvedInputs): number | null {
  // Find highest purchasePrice where profitOnCost(purchasePrice) >= flipCriteriaROI
  // If even at purchasePrice = 10000 the criteria isn't met, return null
}

function solveHoldMaxPurchasePrice(inputs: ResolvedInputs): number | null {
  // Find highest purchasePrice where roceMultiple(purchasePrice) >= holdCriteriaROCEMultiple
  // If even at purchasePrice = 10000 the criteria isn't met, return null
}
```

**Viewing Criteria**
```typescript
flipDiscount = (askingPrice - flipMaxPurchasePrice) / askingPrice
holdDiscount = (askingPrice - holdMaxPurchasePrice) / askingPrice
flipViewingPass = flipDiscount <= maxViewingDiscountPercent
holdViewingPass = holdDiscount <= maxViewingDiscountPercent
```

### Output Type

```typescript
export interface OfferCalculationResult {
  flip: {
    maxPurchasePrice: number | null
    discountFromAsking: number
    discountPercent: number
    viewingCriteriaMet: boolean
    profitOnCost: number
    profit: number
    viable: boolean
  }
  hold: {
    maxPurchasePrice: number | null
    discountFromAsking: number
    discountPercent: number
    viewingCriteriaMet: boolean
    roce: number
    roceMultiple: number
    netMonthlyCashflow: number
    moneyLeftIn: number
    grossYield: number
    viable: boolean
  }
  bridging: {
    grossLoan: number
    netLoanAdvance: number
    deposit: number
    totalCosts: number
    monthlyInterest: number
    totalInterest: number
  }
  mortgage: {
    loanAmount: number
    monthlyPayment: number
    totalCosts: number
    icrPass: boolean
    requiredRentForICR: number
  }
  cashflow: {
    netMonthly: number
    annualCashflow: number
    grossYield: number
    voidAllowanceMonthly: number
    managementCost: number
  }
  totalProjectCosts: number
  totalAcquisitionCosts: number
  recommendedStrategy: 'flip' | 'hold' | 'both' | 'pass'
  dealViability: 'strong' | 'marginal' | 'pass'
  viabilityScore: number        // 0–100
  viabilityNotes: string[]
  inputs: ResolvedInputs        // echo back defaults-applied inputs for display
}

export function calculateOffer(inputs: OfferEngineInputs): OfferCalculationResult
```

---

## Step 3: Negotiation Ladder Generator

Create `lib/offer-engine/negotiation-ladder.ts`

### Core Concept

The ladder is anchored entirely to the **goal-seek maximum purchase price ceiling** — never the
asking price. Each offer is derived mathematically from that ceiling. Concession steps
**taper** (get smaller each round) to signal to the vendor that you are approaching your limit.

### The Algorithm

```typescript
export interface NegotiationRung {
  round: number                    // 0 = opening, 1 = counter 1, 2 = counter 2
  label: string                    // "Opening Offer" | "Counter 1" | "Counter 2"
  offerPrice: number               // rounded to nearest £50 for realism
  discountFromAsking: number       // £ amount below asking price
  discountPercent: number          // % below asking price
  discountFromCeiling: number      // £ amount below max purchase price ceiling
  ceilingPercent: number           // % of ceiling (e.g. 90% = 10% below ceiling)
  gapClosedPercent: number         // how much of gap between prev offer and ceiling is closed
  profitAtThisPrice: number        // profit/ROCE at this exact offer price
  returnAtThisPrice: number        // profitOnCost (flip) or roceMultiple (hold)
  returnLabel: string              // "Profit on Cost" | "ROCE Multiple"
  returnMeetsCriteria: boolean     // still above the target return at this price?
  headroomRemaining: number        // £ gap between this offer and the ceiling
  isAbsoluteMaximum: boolean       // true for final rung (at ceiling)
  negotiatingNote: string          // human-readable tactical note for this rung
  tooltip: string                  // explains why this price was chosen
}

export interface NegotiationLadder {
  strategy: 'flip' | 'hold'
  ceiling: number                  // goal-seek max purchase price
  askingPrice: number
  rungs: NegotiationRung[]         // ordered opening → final
  walkAwayPrice: number            // ceiling + 1 (never go above)
  totalConcession: number          // opening offer to ceiling difference
  taperedSteps: number[]           // the £ step sizes between each rung
  ladderRationale: string          // overall explanation of the ladder strategy
}
```

### Ladder Construction Rules

```
Given: ceiling (goal-seek max), askingPrice, strategy

Opening Offer:
  = ceiling * openingBufferPercent
  where openingBufferPercent default = 0.88 (12% below ceiling)
  Round to nearest £50

Gap = ceiling - openingOffer

Counter 1 (if vendor rejects opening):
  = openingOffer + (gap * 0.45)    // close 45% of remaining gap
  Round to nearest £50

Counter 2 (if vendor rejects counter 1):
  = counter1 + (remainingGap * 0.40)  // close 40% of remaining gap
  Round to nearest £50
  Must not exceed ceiling

Final Position (if vendor rejects counter 2):
  = ceiling                         // absolute maximum, presented as "best and final"
  This is the walk-away threshold

Step sizes should be DECREASING:
  Step 1 (opening → counter1): largest jump
  Step 2 (counter1 → counter2): smaller jump
  Step 3 (counter2 → ceiling): smallest jump
  This tapering signals you are approaching your limit

Validate all rungs:
  - No rung may exceed ceiling
  - Each rung must be higher than the previous
  - At each rung price, recalculate the actual return and verify it still meets criteria
  - If counter2 would exceed ceiling, cap it at ceiling and mark isAbsoluteMaximum = true
```

### Tactical Notes Per Rung

Generate human-readable `negotiatingNote` for each rung:

```typescript
round 0 (Opening):
  "Open low to anchor the negotiation. This is £{gap} below your ceiling — 
   leaves you room for two meaningful moves while staying disciplined."

round 1 (Counter 1):
  "Move up by £{step} — a meaningful concession that shows good faith. 
   You still have £{headroom} of headroom before your limit."

round 2 (Counter 2):
  "Final substantive move. The smaller step (£{step} vs £{prevStep} previously) 
   signals you are nearly at your limit. Only £{headroom} remains."

round 3 (Best & Final — at ceiling):
  "Best and final offer. You are at your mathematical maximum. 
   Any higher and the deal fails your {strategy} return criteria. Walk away if rejected."
```

### Export Function

```typescript
export function generateNegotiationLadder(
  result: OfferCalculationResult,
  strategy: 'flip' | 'hold',
  config?: {
    openingBufferPercent?: number    // default 0.88
    maxRounds?: number               // default 3 (opening + 2 counters + best/final)
  }
): NegotiationLadder

// Also generate both strategies for comparison:
export function generateBothLadders(
  result: OfferCalculationResult,
  config?: LadderConfig
): { flip: NegotiationLadder | null; hold: NegotiationLadder | null }
```

---

## Step 4: Tooltip Definitions

Create `lib/offer-engine/offer-tooltips.ts`

Every metric shown in the UI must have a plain-English tooltip explaining what it means,
how it is calculated, and why it matters. This is the key educational layer.

```typescript
export interface MetricTooltip {
  term: string           // display name
  definition: string     // what it is in plain English
  calculation: string    // how it is calculated (human-readable formula)
  whyItMatters: string   // why this number matters to a property investor
  example?: string       // optional concrete example
  goodRange?: string     // what a "good" value looks like
}

export const OFFER_TOOLTIPS: Record<string, MetricTooltip> = {

  askingPrice: {
    term: "Asking Price",
    definition: "The price the vendor is advertising the property for.",
    calculation: "Set by the vendor or estate agent — it is not the market value.",
    whyItMatters: "Your starting point for negotiation. Almost always higher than what the property will actually sell for.",
    goodRange: "Expect to pay 10–25% below asking on a BMV deal."
  },

  gdv: {
    term: "GDV — Gross Development Value",
    definition: "The estimated open market value of the property after all works are complete.",
    calculation: "Derived from sold comparables within 0.5 miles in the last 6 months, adjusted for size (£/sqm) and condition.",
    whyItMatters: "This is what the property will be worth when you are done — it determines your exit value and how much the mortgage lender will lend.",
    goodRange: "GDV should be at least 30–40% above your total all-in cost for a strong flip."
  },

  maxPurchasePrice: {
    term: "Maximum Purchase Price",
    definition: "The highest price you can pay for the property and still hit your minimum target return.",
    calculation: "Calculated by working backwards from your target return (Flip: 20% profit on cost / Hold: 2.5x ROCE multiple) using a goal-seek solver — the same logic as Excel's Goal Seek tool.",
    whyItMatters: "This is your hard ceiling. Never offer above this price — if you do, the deal fails your investment criteria before you even start.",
    goodRange: "Should be at least 15–20% below asking price to be worth pursuing."
  },

  flipMaxPurchasePrice: {
    term: "Flip Max Purchase Price",
    definition: "The maximum you can pay so that selling the refurbished property generates at least 20% profit on total cost.",
    calculation: "Goal-seek: find purchase price where (GDV − Total Cost) ÷ Total Cost ≥ 20%.\nTotal Cost includes purchase price + bridging costs + acquisition costs + refurb + mortgage fees.",
    whyItMatters: "Sets your Flip strategy ceiling. If this ceiling is more than 20% below asking price, the property is too expensive to flip profitably.",
    goodRange: "20%+ profit on cost is the minimum. 25–30% is strong for a flip."
  },

  holdMaxPurchasePrice: {
    term: "Hold Max Purchase Price",
    definition: "The maximum you can pay so that the rental income generates a ROCE multiple of at least 2.5x.",
    calculation: "Goal-seek: find purchase price where ROCE ÷ mortgage rate ≥ 2.5.\nROCE = Annual Net Cashflow ÷ Money Left In after refinance.",
    whyItMatters: "Sets your Hold strategy ceiling. The Hold ceiling is usually higher than the Flip ceiling because you are measuring ongoing rental returns, not a one-time profit.",
    goodRange: "2.5x ROCE multiple minimum. 3x+ is excellent for a BTL hold."
  },

  profitOnCost: {
    term: "Profit on Cost",
    definition: "Your total profit expressed as a percentage of the total money spent on the project.",
    calculation: "Profit on Cost = (GDV − Total Cost) ÷ Total Cost\nTotal Cost = Purchase Price + Bridging + Acquisition Costs + Refurb + Mortgage Fees",
    whyItMatters: "The primary Flip strategy metric. Measures efficiency — how much profit you make for every £1 spent.",
    example: "Spend £100,000 total, sell for £120,000. Profit on Cost = 20%.",
    goodRange: "≥20% is the minimum threshold. 25%+ is strong."
  },

  roceMultiple: {
    term: "ROCE Multiple",
    definition: "How many times your annual return covers the mortgage rate — a measure of how hard your money is working.",
    calculation: "ROCE Multiple = ROCE ÷ Mortgage Rate\nROCE = Annual Net Cashflow ÷ Money Left In after refinance\nMoney Left In = Equity invested that you could not pull back out via the mortgage",
    whyItMatters: "The primary Hold strategy metric. A multiple of 2.5x means your money is working 2.5x harder than it would sitting in a mortgage product.",
    goodRange: "≥2.5x is the minimum. 3x+ means you are getting excellent returns on trapped equity."
  },

  roce: {
    term: "ROCE — Return on Cash Employed",
    definition: "Annual net rental profit divided by the cash you cannot pull back out of the property after refinancing.",
    calculation: "ROCE = (Annual Net Cashflow) ÷ (Money Left In)\nAnnual Net Cashflow = Monthly Net Cashflow × 12\nMoney Left In = Total Equity Invested − Cash Released via Mortgage",
    whyItMatters: "Unlike gross yield, ROCE accounts for leverage and actual cash deployment. A high ROCE means you are using borrowed money efficiently.",
    goodRange: "10–15%+ ROCE is strong for a leveraged BTL property."
  },

  moneyLeftIn: {
    term: "Money Left In",
    definition: "The cash that remains trapped in the property after you have refinanced onto a buy-to-let mortgage.",
    calculation: "Money Left In = Total Equity Invested − (GDV × Mortgage LTV)\nIf negative, you have pulled all your money back out — a 'money recycling' deal.",
    whyItMatters: "The goal of a BRRR strategy is to minimise money left in. The closer to zero (or below), the more capital-efficient the deal.",
    goodRange: "Below £15,000 is good. Negative means you have recycled your capital completely."
  },

  netMonthlyCashflow: {
    term: "Net Monthly Cashflow",
    definition: "The actual cash profit the property generates each month after all expenses are paid.",
    calculation: "Net Monthly = Rent − Mortgage Payment − Management − Maintenance − Insurance − Void Allowance",
    whyItMatters: "Positive cashflow means the property pays for itself and generates income. Negative cashflow means you must top it up from your own pocket each month.",
    goodRange: "£200+ per month is acceptable. £400+ per month is strong."
  },

  grossYield: {
    term: "Gross Yield",
    definition: "Annual rent as a percentage of the property's value, before any expenses.",
    calculation: "Gross Yield = (Monthly Rent × 12) ÷ GDV",
    whyItMatters: "A quick comparison metric across different properties and markets. Does not account for costs, so always look at net yield and cashflow too.",
    goodRange: "≥7% is strong for UK BTL. Below 5% is difficult to cashflow positively."
  },

  bridgingGrossLoan: {
    term: "Bridging Gross Loan",
    definition: "The total amount the bridging lender advances before deducting their fees.",
    calculation: "Gross Loan = Purchase Price × LTV (default 75%)",
    whyItMatters: "Determines how much of the purchase price the lender covers. The rest (deposit) comes from your own cash.",
    goodRange: "70–75% LTV is standard for bridging. Some lenders go to 80%."
  },

  bridgingNetLoanAdvance: {
    term: "Net Loan Advance",
    definition: "The actual cash you receive from the bridging lender after they deduct their arrangement and exit fees upfront.",
    calculation: "Net Advance = Gross Loan − Arrangement Fee − Exit Fee",
    whyItMatters: "This is the real cash you receive on day one. The difference between gross and net loan is money that leaves your pocket immediately.",
  },

  bridgingDeposit: {
    term: "Bridging Deposit",
    definition: "The cash you must contribute from your own funds to make up the difference between the purchase price and the net loan advance.",
    calculation: "Deposit = Purchase Price − Net Loan Advance",
    whyItMatters: "Your initial cash outlay. Lower deposits preserve capital for other deals.",
  },

  bridgingTotalCosts: {
    term: "Total Bridging Costs",
    definition: "The total cost of the short-term bridging loan including all fees and interest.",
    calculation: "Total = Arrangement Fee + (Monthly Interest × Months) + Exit Fee + Legal Fees + Valuation Fees",
    whyItMatters: "Bridging is expensive — typically costs 6–10% of the loan per year. Must be factored into your profit calculation.",
    goodRange: "Minimise by shortening the bridging period. Plan refurb timeline carefully."
  },

  icrPass: {
    term: "ICR — Interest Coverage Ratio",
    definition: "A stress test that checks whether the rental income covers the mortgage payment by a sufficient safety margin.",
    calculation: "Required Rent = Monthly Mortgage Payment × Coverage Ratio (default 1.25)\nICR Pass = Estimated Rent ≥ Required Rent",
    whyItMatters: "Most buy-to-let lenders require rent to cover mortgage payments by 125–145%. If your property fails ICR, many lenders will not offer a mortgage regardless of LTV.",
    goodRange: "Pass at 125% minimum. Aim for 140%+ for wider lender choice."
  },

  stampDuty: {
    term: "Stamp Duty",
    definition: "The government tax paid on property purchases in England and Wales.",
    calculation: "For investment properties (second homes/BTL), the standard rates apply plus a 3% surcharge on the full purchase price.",
    whyItMatters: "A significant upfront cost that directly reduces your profit. Must be included in total cost calculations.",
  },

  viewingCriteria: {
    term: "Viewing Criteria",
    definition: "A filter that decides whether a property is even worth viewing based on the discount required from asking price.",
    calculation: "Required Discount = (Asking Price − Max Purchase Price) ÷ Asking Price\nPass = Required Discount ≤ 20%",
    whyItMatters: "Saves time — if you need more than 20% off asking price for the deal to work, the vendor is very unlikely to accept. Filter these out before spending time on viewings.",
    goodRange: "Under 15% discount required = easy negotiation. 15–20% = needs motivated seller. Over 20% = very difficult."
  },

  openingOffer: {
    term: "Opening Offer",
    definition: "Your first offer to the vendor — deliberately set below your maximum purchase price ceiling to leave room for negotiation.",
    calculation: "Opening Offer = Ceiling × 88% (12% below your maximum purchase price)\nRounded to nearest £50 for credibility.",
    whyItMatters: "Anchors the negotiation low. The further below asking, the stronger your anchor — but too low risks being dismissed. This gives you room for two or three meaningful counter-moves.",
    goodRange: "Aim for opening offer at least 15–20% below asking price."
  },

  counter1: {
    term: "Counter Offer 1",
    definition: "Your first counter after the vendor rejects the opening offer.",
    calculation: "Counter 1 = Opening Offer + 45% of (Ceiling − Opening Offer)\nRounded to nearest £50.",
    whyItMatters: "A meaningful concession that shows good faith and keeps the negotiation alive. The step size is intentionally larger than subsequent moves.",
    negotiationTip: "Acknowledge their position: 'I understand you were hoping for more. I've reviewed the works needed and can stretch to...' — then give the number."
  },

  counter2: {
    term: "Counter Offer 2",
    definition: "Your second counter after the vendor rejects Counter 1.",
    calculation: "Counter 2 = Counter 1 + 40% of (Ceiling − Counter 1)\nRounded to nearest £50. Capped at ceiling.",
    whyItMatters: "The deliberately smaller step signals that you are nearly at your limit. Vendors read tapering concessions as approaching a genuine ceiling.",
    negotiationTip: "Make this feel final even if it isn't: 'I've had to go back to my partners on this. This is really the furthest we can go given the works required...'"
  },

  bestAndFinal: {
    term: "Best & Final Offer",
    definition: "Your absolute maximum offer — equal to the goal-seek ceiling. Any higher and the deal fails your investment criteria.",
    calculation: "Best & Final = Max Purchase Price ceiling (from goal-seek solver)\nThis is a mathematical limit, not a negotiating position.",
    whyItMatters: "If the vendor rejects this, walk away. The moment you exceed the ceiling, the deal destroys value. Discipline here is what separates professional investors from emotional buyers.",
    negotiationTip: "Be explicit: 'I want to be transparent — this is genuinely the maximum the numbers support. I cannot go higher without the deal not working for us.'"
  },

  taperingConcessions: {
    term: "Tapering Concessions",
    definition: "A negotiation technique where each counter-offer moves by a smaller amount than the previous one.",
    calculation: "Step 1 > Step 2 > Step 3\nExample: +£5,000, then +£3,000, then +£2,000 — each move is smaller.",
    whyItMatters: "Signals to the vendor that you are genuinely approaching your limit. Equal-sized steps suggest you have unlimited room to move — vendors will keep pushing. Tapering tells a believable story.",
    example: "Step 1: £80k→£85k (+£5k). Step 2: £85k→£88k (+£3k). Step 3: £88k→£90k (+£2k). The vendor sees momentum slowing and is more likely to accept."
  },

  negotiationCeiling: {
    term: "Negotiation Ceiling",
    definition: "The absolute maximum purchase price, derived from the goal-seek solver. The offer system never exceeds this.",
    calculation: "The goal-seek solver finds the highest purchase price at which the deal still meets return criteria. Every rung of the ladder is constructed within this boundary.",
    whyItMatters: "The ceiling is not a negotiating position — it is a mathematical fact. Exceeding it means the deal fails your investment criteria regardless of how good the property looks."
  }
}
```

---

## Step 5: Main Offer Analysis Panel

Create `components/deals/offer-analysis-panel.tsx`

This is the top-level component rendered in the production validation offer tab.

### Props

```typescript
interface OfferAnalysisPanelProps {
  property: {
    id: string
    askingPrice: number
    gdv?: number | null
    estimatedRentPcm?: number | null
    totalRefurbishment?: number | null
    propertySize?: number | null
    offerCalculation?: OfferCalculationResult | null
  }
  onOfferSent?: (offerPrice: number, strategy: 'flip' | 'hold', round: number) => void
  onReject?: () => void
  readOnly?: boolean
}
```

### Layout (render in this exact order)

```
┌─────────────────────────────────────────────────────────────────┐
│  OFFER ANALYSIS ENGINE                    [Edit Assumptions ▼]  │
│  Based on Excel PropertyAnalyser methodology                    │
├──────────────────────────────────────────────────────────────────┤
│  [Assumptions Override Panel — collapsible, hidden by default]  │
│  GDV: [£___]  Rent PCM: [£___]  Refurb: [£___]                 │
│  Bridging Months: [__]  Mortgage Rate: [__%]  [Recalculate]     │
├──────────────────────────┬───────────────────────────────────────┤
│  🔄 FLIP STRATEGY [?]    │  🏠 HOLD / BRRR STRATEGY [?]        │
│                          │                                       │
│  Ceiling [?]             │  Ceiling [?]                         │
│  £59,692                 │  £64,554                             │
│                          │                                       │
│  Required Discount [?]   │  Required Discount [?]               │
│  27.2% of asking         │  21.3% of asking                     │
│  [✓ Viewing: PASS]       │  [✗ Viewing: FAIL — >20%]           │
│                          │                                       │
│  Return at ceiling [?]   │  Return at ceiling [?]               │
│  Profit on Cost: 20.1%   │  ROCE Multiple: 2.5x                 │
│  Profit: £5,733          │  Net CF: £410/mo                     │
│                          │  Money Left In: £24,267 [?]          │
├──────────────────────────┴───────────────────────────────────────┤
│  [NEGOTIATION LADDER PANEL — see Step 6]                        │
├──────────────────────────────────────────────────────────────────┤
│  FINANCIAL BREAKDOWN [▼ Show Details]                            │
│  [Collapsible — hidden by default]                               │
│                                                                  │
│  Bridging Finance [?]          Mortgage (Exit Finance) [?]       │
│  Gross Loan: £54,375           Loan Amount: £90,000              │
│  Net Advance: £46,263 [?]      Monthly Payment: £344             │
│  Total Cost: £6,612 [?]        ICR: ✓ PASS [?]                  │
│  Monthly Interest: £419        Required Rent: £430               │
│                                                                  │
│  Monthly Cashflow [?]                                            │
│  Rent £830 − Mortgage £344 − Voids £35 − Insurance £10 = £441   │
│  Gross Yield: 8.3% [?]                                          │
│                                                                  │
│  Acquisition Costs [?]         Project Costs                     │
│  Deposit: £26,237              Refurb: £28,000                   │
│  Stamp Duty: £2,175            Contingency: £0                   │
│  Solicitor: £1,500             Utilities: £720                   │
│  Searches: £350                Furnishing: £1,000                │
│  Total: £30,262                Total: £29,720                    │
├──────────────────────────────────────────────────────────────────┤
│  DEAL VIABILITY: ●●●●○  MARGINAL                                │
│  • Flip strategy passes viewing criteria (27.2% discount needed)│
│  • Hold strategy just exceeds 20% threshold — needs negotiation  │
│  • ICR passes — rental income covers mortgage comfortably        │
│  • Consider negotiating to £60k to unlock Hold strategy          │
├──────────────────────────────────────────────────────────────────┤
│  [✗ Reject Deal]                                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Tooltip Implementation

Every metric with a `[?]` icon must use a shadcn/ui `Tooltip` that renders the relevant
`MetricTooltip` from `offer-tooltips.ts`.

Create a reusable `MetricTooltipIcon` component:

```tsx
// components/deals/metric-tooltip-icon.tsx
function MetricTooltipIcon({ tooltipKey }: { tooltipKey: keyof typeof OFFER_TOOLTIPS }) {
  const tooltip = OFFER_TOOLTIPS[tooltipKey]
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 cursor-help text-muted-foreground hover:text-foreground">
          <InfoIcon className="h-3.5 w-3.5 inline" />
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 space-y-1.5">
        <p className="font-semibold text-sm">{tooltip.term}</p>
        <p className="text-xs text-muted-foreground">{tooltip.definition}</p>
        <div className="border-t pt-1.5">
          <p className="text-xs font-medium">How it's calculated:</p>
          <p className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">{tooltip.calculation}</p>
        </div>
        <div className="border-t pt-1.5">
          <p className="text-xs font-medium">Why it matters:</p>
          <p className="text-xs text-muted-foreground">{tooltip.whyItMatters}</p>
        </div>
        {tooltip.goodRange && (
          <div className="border-t pt-1.5">
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              ✓ Good range: {tooltip.goodRange}
            </p>
          </div>
        )}
        {tooltip.example && (
          <div className="border-t pt-1.5">
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Example: {tooltip.example}
            </p>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  )
}
```

---

## Step 6: Negotiation Ladder Panel

Create `components/deals/negotiation-ladder-panel.tsx`

This renders the visual step-by-step offer ladder for a given strategy.

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  NEGOTIATION LADDER [?]          Strategy: [Flip ▼] [Hold ▼]   │
│  "Tapering concessions anchored to your return ceiling"         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Asking Price    £82,000  ──────────────────────────── 100%    │
│                                                                 │
│  ┌─ ROUND 0: OPENING OFFER ─────────────────────────────────┐  │
│  │  £53,700        34.5% below asking    12% below ceiling   │  │
│  │  Step up from nothing                                     │  │
│  │  Return at this price: Profit on Cost 22.4% ✓            │  │
│  │  ▸ "Open low to anchor negotiation. Leaves £6,000        │  │
│  │     of room before your ceiling."                        │  │
│  │  [💬 Send This Offer]   [Mark as Sent]                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│          │ +£5,000 (if rejected ↓)                             │
│  ┌─ ROUND 1: COUNTER OFFER 1 ───────────────────────────────┐  │
│  │  £57,700        29.6% below asking    3.3% below ceiling  │  │
│  │  Step: +£4,000 ← smaller than would be if equal steps    │  │
│  │  Return at this price: Profit on Cost 20.8% ✓            │  │
│  │  ▸ "Meaningful concession showing good faith.            │  │
│  │     £2,000 headroom remains."                            │  │
│  │  [💬 Send This Offer]   [Mark as Sent]                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│          │ +£2,000 (if rejected ↓) — step getting smaller      │
│  ┌─ ROUND 2: COUNTER OFFER 2 ───────────────────────────────┐  │
│  │  £59,350        27.6% below asking    0.6% below ceiling  │  │
│  │  Step: +£1,650 ← tapering signals limit                  │  │
│  │  Return at this price: Profit on Cost 20.1% ✓            │  │
│  │  ▸ "Smaller step signals you are nearly at limit.        │  │
│  │     Only £342 of headroom remaining."                    │  │
│  │  [💬 Send This Offer]   [Mark as Sent]                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│          │ +£342 (if rejected ↓) — tiny final move             │
│  ┌─ ROUND 3: BEST & FINAL ──────────────────────────────────┐  │
│  │  £59,692 ⚠️  YOUR CEILING — DO NOT EXCEED               │  │
│  │  27.2% below asking                                       │  │
│  │  Return at this price: Profit on Cost 20.0% (minimum)    │  │
│  │  ▸ "This is a mathematical limit. If rejected,           │  │
│  │     walk away. The deal no longer works above this."     │  │
│  │  [💬 Send Best & Final]  [🚫 Walk Away]                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Concession Summary:                                            │
│  Opening → Counter 1: +£4,000  Counter 1 → Counter 2: +£1,650 │
│  Counter 2 → Best&Final: +£342   Total room: £5,992            │
│  [✓ Steps are tapering correctly]                               │
└─────────────────────────────────────────────────────────────────┘
```

### State Management

Track which rounds have been sent/rejected:

```typescript
interface LadderState {
  strategy: 'flip' | 'hold'
  currentRound: number              // which rung is active
  rounds: {
    rung: NegotiationRung
    status: 'pending' | 'sent' | 'rejected' | 'accepted'
    sentAt?: Date
    rejectedAt?: Date
    notes?: string
  }[]
  outcome: 'in_progress' | 'accepted' | 'walked_away' | null
}
```

Buttons per rung:
- **pending** → `[💬 Send This Offer]` (triggers onOfferSent callback + marks as sent)
- **sent** → `[Awaiting Response]` + `[✓ Accepted]` + `[✗ Rejected — Next Counter]`
- **rejected** → shows next rung as active
- **accepted** → show green "DEAL AGREED at £X" banner, lock all further rungs
- Final rung rejected → show `[🚫 Walk Away — Deal Dead]` button

---

## Step 7: Update Prisma Schema

Check existing schema. Add if not present:

```prisma
model Property {
  // ... existing fields ...

  // Offer engine inputs
  gdv                     Float?
  estimatedRentPcm        Float?
  totalRefurbishment      Float?
  propertySize            Float?

  // Cached calculation
  offerCalculation        Json?
  offerCalculatedAt       DateTime?

  // Goal-seek ceilings
  flipMaxPurchasePrice    Float?
  holdMaxPurchasePrice    Float?
  recommendedStrategy     String?

  // Negotiation state (JSON array of ladder state)
  negotiationLadder       Json?
  negotiationStrategy     String?      // 'flip' | 'hold'
  currentOfferRound       Int          @default(0)
  currentOfferPrice       Float?
  offerOutcome            String?      // 'in_progress' | 'accepted' | 'walked_away'
  dealAgreedPrice         Float?
  dealAgreedAt            DateTime?
}
```

Run: `npx prisma migrate dev --name add_offer_engine_and_negotiation_ladder`

---

## Step 8: API Routes

**POST `/api/deals/[id]/calculate-offer`**
```typescript
// Body: Partial<OfferEngineInputs> (overrides)
// Runs calculateOffer() + generateBothLadders()
// Saves to property record
// Returns: { calculation: OfferCalculationResult, ladders: { flip, hold } }
```

**POST `/api/deals/[id]/send-offer`**
```typescript
// Body: { strategy: 'flip' | 'hold', round: number, offerPrice: number }
// Updates negotiationLadder JSON, currentOfferRound, currentOfferPrice
// Triggers existing offer-sending logic (SMS/email)
// Returns: updated property record
```

**POST `/api/deals/[id]/offer-response`**
```typescript
// Body: { round: number, response: 'accepted' | 'rejected', notes?: string }
// Updates ladder rung status
// If accepted: sets dealAgreedPrice, dealAgreedAt, offerOutcome = 'accepted'
// If rejected and no more rounds: prompts walk-away decision
// Returns: updated ladder state
```

**POST `/api/deals/[id]/walk-away`**
```typescript
// Sets offerOutcome = 'walked_away'
// Records reason
// Updates deal status
```

---

## Step 9: Wire Into Production Validation Page

Find the production validation offer tab. Replace the content with:

```tsx
<OfferAnalysisPanel
  property={property}
  onOfferSent={(price, strategy, round) => {
    // call POST /api/deals/[id]/send-offer
  }}
  onReject={() => {
    // existing reject logic
  }}
/>
```

---

## Constraints

- Do NOT change the overall production validation page layout — only the offer tab content
- All monetary values: GBP, £ prefix, comma-formatted (e.g. £59,692)
- All percentages: one decimal place (e.g. 27.2%)
- Tooltip icons use the shadcn/ui `Tooltip` + `TooltipProvider` correctly
- `TooltipProvider` must wrap at the page level if not already present
- TypeScript strict mode — no `any` types anywhere
- The binary search solver must converge within 100 iterations and handle null (no viable price)
- Ladder rungs must always be in ascending order of price
- Each rung price must stay strictly below the ceiling (except best & final which equals ceiling)
- Rounding to nearest £50 must happen after all calculations, not before

---

## Validation Test

After implementation, verify with this example from the Excel file:

```
askingPrice: 82000
gdv: 120000
estimatedRent: 830
totalRefurbishment: 28000
(all other inputs: defaults)

Expected outputs:
  flipMaxPurchasePrice: ≈ £59,692
  holdMaxPurchasePrice: ≈ £64,554
  flipViewingPass: true  (27.2% < 20% threshold? Actually FAIL — 27.2% > 20%)
  holdViewingPass: false (21.3% > 20%)

  Ladder (Flip, opening buffer 88%):
    Opening: £59,692 × 0.88 = £52,529 → rounded £52,550
    Counter 1: £52,550 + (£7,142 × 0.45) = £55,764 → rounded £55,750
    Counter 2: £55,750 + (£3,942 × 0.40) = £57,327 → rounded £57,350
    Best & Final: £59,692

  Steps: +£3,200 → +£1,600 → +£2,342 (tapering correctly)
```

Run `npx tsc --noEmit` — must complete with zero errors.

---

## Start

Search the codebase for existing offer engine files and the production validation component.
Show me what you find, then begin with Step 2 (core financial engine).
