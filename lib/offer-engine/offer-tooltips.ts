/**
 * Tooltip definitions for every metric shown in the Offer Analysis Panel.
 * Each tooltip explains the term in plain English, how it is calculated,
 * and why it matters to a property investor.
 */

export interface MetricTooltip {
  term: string
  definition: string
  calculation: string
  whyItMatters: string
  example?: string
  goodRange?: string
  negotiationTip?: string
}

export const OFFER_TOOLTIPS: Record<string, MetricTooltip> = {
  askingPrice: {
    term: "Asking Price",
    definition: "The price the vendor is advertising the property for.",
    calculation: "Set by the vendor or estate agent — it is not the market value.",
    whyItMatters:
      "Your starting point for negotiation. Almost always higher than what the property will actually sell for.",
    goodRange: "Expect to pay 10–25% below asking on a BMV deal.",
  },

  gdv: {
    term: "GDV — Gross Development Value",
    definition:
      "The estimated open market value of the property after all works are complete.",
    calculation:
      "Derived from sold comparables within 0.5 miles in the last 6 months, adjusted for size (£/sqm) and condition.",
    whyItMatters:
      "This is what the property will be worth when you are done — it determines your exit value and how much the mortgage lender will lend.",
    goodRange:
      "GDV should be at least 30–40% above your total all-in cost for a strong flip.",
  },

  maxPurchasePrice: {
    term: "Maximum Purchase Price",
    definition:
      "The highest price you can pay for the property and still hit your minimum target return.",
    calculation:
      "Calculated by working backwards from your target return (Flip: 20% profit on cost / Hold: 2.5x ROCE multiple) using a goal-seek solver — the same logic as Excel's Goal Seek tool.",
    whyItMatters:
      "This is your hard ceiling. Never offer above this price — if you do, the deal fails your investment criteria before you even start.",
    goodRange: "Should be at least 15–20% below asking price to be worth pursuing.",
  },

  flipMaxPurchasePrice: {
    term: "Flip Max Purchase Price",
    definition:
      "The maximum you can pay so that selling the refurbished property generates at least 20% profit on total cost.",
    calculation:
      "Goal-seek: find purchase price where (GDV − Total Cost) ÷ Total Cost ≥ 20%.\nTotal Cost includes purchase price + bridging costs + acquisition costs + refurb + mortgage fees.",
    whyItMatters:
      "Sets your Flip strategy ceiling. If this ceiling is more than 20% below asking price, the property is too expensive to flip profitably.",
    goodRange: "20%+ profit on cost is the minimum. 25–30% is strong for a flip.",
  },

  holdMaxPurchasePrice: {
    term: "Hold Max Purchase Price",
    definition:
      "The maximum you can pay so that the rental income generates a ROCE multiple of at least 2.5x.",
    calculation:
      "Goal-seek: find purchase price where ROCE ÷ mortgage rate ≥ 2.5.\nROCE = Annual Net Cashflow ÷ Money Left In after refinance.",
    whyItMatters:
      "Sets your Hold strategy ceiling. The Hold ceiling is usually higher than the Flip ceiling because you are measuring ongoing rental returns, not a one-time profit.",
    goodRange: "2.5x ROCE multiple minimum. 3x+ is excellent for a BTL hold.",
  },

  profitOnCost: {
    term: "Profit on Cost",
    definition:
      "Your total profit expressed as a percentage of the total money spent on the project.",
    calculation:
      "Profit on Cost = (GDV − Total Cost) ÷ Total Cost\nTotal Cost = Purchase Price + Bridging + Acquisition Costs + Refurb + Mortgage Fees",
    whyItMatters:
      "The primary Flip strategy metric. Measures efficiency — how much profit you make for every £1 spent.",
    example: "Spend £100,000 total, sell for £120,000. Profit on Cost = 20%.",
    goodRange: "≥20% is the minimum threshold. 25%+ is strong.",
  },

  roceMultiple: {
    term: "ROCE Multiple",
    definition:
      "How many times your annual return covers the mortgage rate — a measure of how hard your money is working.",
    calculation:
      "ROCE Multiple = ROCE ÷ Mortgage Rate\nROCE = Annual Net Cashflow ÷ Money Left In after refinance\nMoney Left In = Equity invested that you could not pull back out via the mortgage",
    whyItMatters:
      "The primary Hold strategy metric. A multiple of 2.5x means your money is working 2.5x harder than it would sitting in a mortgage product.",
    goodRange:
      "≥2.5x is the minimum. 3x+ means you are getting excellent returns on trapped equity.",
  },

  roce: {
    term: "ROCE — Return on Cash Employed",
    definition:
      "Annual net rental profit divided by the cash you cannot pull back out of the property after refinancing.",
    calculation:
      "ROCE = (Annual Net Cashflow) ÷ (Money Left In)\nAnnual Net Cashflow = Monthly Net Cashflow × 12\nMoney Left In = Total Equity Invested − Cash Released via Mortgage",
    whyItMatters:
      "Unlike gross yield, ROCE accounts for leverage and actual cash deployment. A high ROCE means you are using borrowed money efficiently.",
    goodRange: "10–15%+ ROCE is strong for a leveraged BTL property.",
  },

  moneyLeftIn: {
    term: "Money Left In",
    definition:
      "The cash that remains trapped in the property after you have refinanced onto a buy-to-let mortgage.",
    calculation:
      "Money Left In = Total Equity Invested − (GDV × Mortgage LTV)\nIf negative, you have pulled all your money back out — a 'money recycling' deal.",
    whyItMatters:
      "The goal of a BRRR strategy is to minimise money left in. The closer to zero (or below), the more capital-efficient the deal.",
    goodRange: "Below £15,000 is good. Negative means you have recycled your capital completely.",
  },

  netMonthlyCashflow: {
    term: "Net Monthly Cashflow",
    definition:
      "The actual cash profit the property generates each month after all expenses are paid.",
    calculation:
      "Net Monthly = Rent − Mortgage Payment − Management − Maintenance − Insurance − Void Allowance",
    whyItMatters:
      "Positive cashflow means the property pays for itself and generates income. Negative cashflow means you must top it up from your own pocket each month.",
    goodRange: "£200+ per month is acceptable. £400+ per month is strong.",
  },

  grossYield: {
    term: "Gross Yield",
    definition: "Annual rent as a percentage of the property's value, before any expenses.",
    calculation: "Gross Yield = (Monthly Rent × 12) ÷ GDV",
    whyItMatters:
      "A quick comparison metric across different properties and markets. Does not account for costs, so always look at net yield and cashflow too.",
    goodRange: "≥7% is strong for UK BTL. Below 5% is difficult to cashflow positively.",
  },

  bridgingGrossLoan: {
    term: "Bridging Gross Loan",
    definition: "The total amount the bridging lender advances before deducting their fees.",
    calculation: "Gross Loan = Purchase Price × LTV (default 75%)",
    whyItMatters:
      "Determines how much of the purchase price the lender covers. The rest (deposit) comes from your own cash.",
    goodRange: "70–75% LTV is standard for bridging. Some lenders go to 80%.",
  },

  bridgingNetLoanAdvance: {
    term: "Net Loan Advance",
    definition:
      "The actual cash you receive from the bridging lender after they deduct their arrangement and exit fees upfront.",
    calculation: "Net Advance = Gross Loan − Arrangement Fee − Exit Fee",
    whyItMatters:
      "This is the real cash you receive on day one. The difference between gross and net loan is money that leaves your pocket immediately.",
  },

  bridgingDeposit: {
    term: "Bridging Deposit",
    definition:
      "The cash you must contribute from your own funds to make up the difference between the purchase price and the net loan advance.",
    calculation: "Deposit = Purchase Price − Net Loan Advance",
    whyItMatters: "Your initial cash outlay. Lower deposits preserve capital for other deals.",
  },

  bridgingTotalCosts: {
    term: "Total Bridging Costs",
    definition: "The total cost of the short-term bridging loan including all fees and interest.",
    calculation:
      "Total = Arrangement Fee + (Monthly Interest × Months) + Exit Fee + Legal Fees + Valuation Fees",
    whyItMatters:
      "Bridging is expensive — typically costs 6–10% of the loan per year. Must be factored into your profit calculation.",
    goodRange:
      "Minimise by shortening the bridging period. Plan refurb timeline carefully.",
  },

  icrPass: {
    term: "ICR — Interest Coverage Ratio",
    definition:
      "A stress test that checks whether the rental income covers the mortgage payment by a sufficient safety margin.",
    calculation:
      "Required Rent = Monthly Mortgage Payment × Coverage Ratio (default 1.25)\nICR Pass = Estimated Rent ≥ Required Rent",
    whyItMatters:
      "Most buy-to-let lenders require rent to cover mortgage payments by 125–145%. If your property fails ICR, many lenders will not offer a mortgage regardless of LTV.",
    goodRange: "Pass at 125% minimum. Aim for 140%+ for wider lender choice.",
  },

  stampDuty: {
    term: "Stamp Duty",
    definition: "The government tax paid on property purchases in England and Wales.",
    calculation:
      "For investment properties (second homes/BTL), the standard rates apply plus a 3% surcharge on the full purchase price.",
    whyItMatters:
      "A significant upfront cost that directly reduces your profit. Must be included in total cost calculations.",
  },

  viewingCriteria: {
    term: "Viewing Criteria",
    definition:
      "A filter that decides whether a property is even worth viewing based on the discount required from asking price.",
    calculation:
      "Required Discount = (Asking Price − Max Purchase Price) ÷ Asking Price\nPass = Required Discount ≤ 20%",
    whyItMatters:
      "Saves time — if you need more than 20% off asking price for the deal to work, the vendor is very unlikely to accept. Filter these out before spending time on viewings.",
    goodRange:
      "Under 15% discount required = easy negotiation. 15–20% = needs motivated seller. Over 20% = very difficult.",
  },

  openingOffer: {
    term: "Opening Offer",
    definition:
      "Your first offer to the vendor — deliberately set below your maximum purchase price ceiling to leave room for negotiation.",
    calculation:
      "Opening Offer = Ceiling × 88% (12% below your maximum purchase price)\nRounded to nearest £50 for credibility.",
    whyItMatters:
      "Anchors the negotiation low. The further below asking, the stronger your anchor — but too low risks being dismissed. This gives you room for two or three meaningful counter-moves.",
    goodRange: "Aim for opening offer at least 15–20% below asking price.",
  },

  counter1: {
    term: "Counter Offer 1",
    definition: "Your first counter after the vendor rejects the opening offer.",
    calculation:
      "Counter 1 = Opening Offer + 45% of (Ceiling − Opening Offer)\nRounded to nearest £50.",
    whyItMatters:
      "A meaningful concession that shows good faith and keeps the negotiation alive. The step size is intentionally larger than subsequent moves.",
    negotiationTip:
      "Acknowledge their position: 'I understand you were hoping for more. I've reviewed the works needed and can stretch to...' — then give the number.",
  },

  counter2: {
    term: "Counter Offer 2",
    definition: "Your second counter after the vendor rejects Counter 1.",
    calculation:
      "Counter 2 = Counter 1 + 40% of (Ceiling − Counter 1)\nRounded to nearest £50. Capped at ceiling.",
    whyItMatters:
      "The deliberately smaller step signals that you are nearly at your limit. Vendors read tapering concessions as approaching a genuine ceiling.",
    negotiationTip:
      "Make this feel final even if it isn't: 'I've had to go back to my partners on this. This is really the furthest we can go given the works required...'",
  },

  bestAndFinal: {
    term: "Best & Final Offer",
    definition:
      "Your absolute maximum offer — equal to the goal-seek ceiling. Any higher and the deal fails your investment criteria.",
    calculation:
      "Best & Final = Max Purchase Price ceiling (from goal-seek solver)\nThis is a mathematical limit, not a negotiating position.",
    whyItMatters:
      "If the vendor rejects this, walk away. The moment you exceed the ceiling, the deal destroys value. Discipline here is what separates professional investors from emotional buyers.",
    negotiationTip:
      "Be explicit: 'I want to be transparent — this is genuinely the maximum the numbers support. I cannot go higher without the deal not working for us.'",
  },

  taperingConcessions: {
    term: "Tapering Concessions",
    definition:
      "A negotiation technique where each counter-offer moves by a smaller amount than the previous one.",
    calculation:
      "Step 1 > Step 2 > Step 3\nExample: +£5,000, then +£3,000, then +£2,000 — each move is smaller.",
    whyItMatters:
      "Signals to the vendor that you are genuinely approaching your limit. Equal-sized steps suggest you have unlimited room to move — vendors will keep pushing. Tapering tells a believable story.",
    example:
      "Step 1: £80k→£85k (+£5k). Step 2: £85k→£88k (+£3k). Step 3: £88k→£90k (+£2k). The vendor sees momentum slowing and is more likely to accept.",
  },

  negotiationCeiling: {
    term: "Negotiation Ceiling",
    definition:
      "The absolute maximum purchase price, derived from the goal-seek solver. The offer system never exceeds this.",
    calculation:
      "The goal-seek solver finds the highest purchase price at which the deal still meets return criteria. Every rung of the ladder is constructed within this boundary.",
    whyItMatters:
      "The ceiling is not a negotiating position — it is a mathematical fact. Exceeding it means the deal fails your investment criteria regardless of how good the property looks.",
  },
}
