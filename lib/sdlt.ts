/**
 * UK Stamp Duty Land Tax (SDLT) Calculator
 * Rates correct as of April 2026
 *
 * Buyer types:
 *  - "individual_main"       Standard rates (main residence, replacing only home)
 *  - "individual_additional" Standard + 3% surcharge (BTL, second home, investment)
 *  - "company"               Same as individual_additional (3% surcharge applies)
 *  - "first_time_buyer"      Relief: 0% up to £425k, 5% £425k–£625k, else standard
 */

export type SdltBuyerType =
  | "individual_additional"
  | "company"
  | "first_time_buyer"
  | "individual_main"

export interface SdltBand {
  from: number
  to: number | null   // null = no upper limit
  rate: number        // percentage, e.g. 5 = 5%
  tax: number         // tax on this band for this purchase
  taxableAmount: number
}

export interface SdltResult {
  purchasePrice: number
  buyerType: SdltBuyerType
  totalTax: number
  effectiveRate: number   // totalTax / purchasePrice * 100
  bands: SdltBand[]
  label: string           // human-readable buyer type label
  notes: string[]         // any special conditions or warnings
}

// ── Band definitions ──────────────────────────────────────────────────────────

const STANDARD_BANDS = [
  { from: 0,         to: 250_000,   rate: 0  },
  { from: 250_000,   to: 925_000,   rate: 5  },
  { from: 925_000,   to: 1_500_000, rate: 10 },
  { from: 1_500_000, to: null,      rate: 12 },
]

// Additional dwelling / company: standard + 3%
const ADDITIONAL_BANDS = STANDARD_BANDS.map(b => ({ ...b, rate: b.rate + 3 }))

// First-time buyer bands (relief up to £625k)
const FTB_BANDS_RELIEF = [
  { from: 0,         to: 425_000,   rate: 0  },
  { from: 425_000,   to: 625_000,   rate: 5  },
]

// ── Core calculation ──────────────────────────────────────────────────────────

function applyBands(
  price: number,
  bands: Array<{ from: number; to: number | null; rate: number }>
): SdltBand[] {
  return bands.map(band => {
    const bandTop = band.to ?? Infinity
    if (price <= band.from) {
      return { ...band, tax: 0, taxableAmount: 0 }
    }
    const taxable = Math.min(price, bandTop) - band.from
    const tax = Math.round((taxable * band.rate) / 100)
    return { ...band, tax, taxableAmount: taxable }
  })
}

export function calculateSdlt(
  purchasePrice: number,
  buyerType: SdltBuyerType = "individual_additional"
): SdltResult {
  if (purchasePrice <= 0) {
    return {
      purchasePrice, buyerType, totalTax: 0, effectiveRate: 0,
      bands: [], label: labelFor(buyerType), notes: [],
    }
  }

  const notes: string[] = []
  let bands: SdltBand[]

  switch (buyerType) {
    case "individual_main": {
      bands = applyBands(purchasePrice, STANDARD_BANDS)
      break
    }

    case "individual_additional":
    case "company": {
      bands = applyBands(purchasePrice, ADDITIONAL_BANDS)
      if (buyerType === "company") {
        notes.push("Company rate: standard SDLT + 3% additional dwelling surcharge applies.")
        if (purchasePrice >= 500_000) {
          notes.push("Warning: Properties over £500k bought via a company may attract ATED (Annual Tax on Enveloped Dwellings). Seek specialist advice.")
        }
      } else {
        notes.push("Additional 3% surcharge applies — this is not your main residence or you already own a property.")
      }
      break
    }

    case "first_time_buyer": {
      if (purchasePrice > 625_000) {
        // No FTB relief — standard rates apply above £625k
        bands = applyBands(purchasePrice, STANDARD_BANDS)
        notes.push("First-time buyer relief does not apply above £625,000. Standard rates charged.")
      } else {
        bands = applyBands(purchasePrice, FTB_BANDS_RELIEF)
        notes.push("First-time buyer relief applied: 0% up to £425,000, 5% from £425,001 to £625,000.")
      }
      break
    }
  }

  const totalTax = bands.reduce((sum, b) => sum + b.tax, 0)
  const effectiveRate = purchasePrice > 0
    ? Math.round((totalTax / purchasePrice) * 10000) / 100
    : 0

  return {
    purchasePrice,
    buyerType,
    totalTax,
    effectiveRate,
    bands: bands.filter(b => b.taxableAmount > 0),  // only show active bands
    label: labelFor(buyerType),
    notes,
  }
}

function labelFor(t: SdltBuyerType): string {
  switch (t) {
    case "individual_main":       return "Main Residence"
    case "individual_additional": return "Additional Property / BTL"
    case "company":               return "Company Purchase"
    case "first_time_buyer":      return "First-Time Buyer"
  }
}

// ── Convenience: all-in acquisition cost breakdown ───────────────────────────

export interface AcquisitionCostInput {
  purchasePrice: number
  buyerType?: SdltBuyerType
  solicitorFees?: number      // default 1800
  surveyFee?: number          // default 600
  bridgingCostTotal?: number  // default 0
  insuranceFirstYear?: number // default 400
  refurbCost?: number         // default 0
  refurbContingencyPct?: number // default 10 (%)
  otherCosts?: number         // default 0
}

export interface AcquisitionCostLine {
  label: string
  amount: number
  isCalculated?: boolean  // derived (SDLT, contingency)
  note?: string
}

export interface AcquisitionCostResult {
  lines: AcquisitionCostLine[]
  totalCashRequired: number
  sdlt: SdltResult
}

export function calculateAcquisitionCost(input: AcquisitionCostInput): AcquisitionCostResult {
  const {
    purchasePrice,
    buyerType = "individual_additional",
    solicitorFees = 1800,
    surveyFee = 600,
    bridgingCostTotal = 0,
    insuranceFirstYear = 400,
    refurbCost = 0,
    refurbContingencyPct = 10,
    otherCosts = 0,
  } = input

  const sdlt = calculateSdlt(purchasePrice, buyerType)
  const contingency = refurbCost > 0
    ? Math.round(refurbCost * (refurbContingencyPct / 100))
    : 0

  const lines: AcquisitionCostLine[] = [
    { label: "Purchase Price",       amount: purchasePrice },
    { label: `SDLT (${sdlt.label})`, amount: sdlt.totalTax, isCalculated: true },
    { label: "Solicitor / Legal Fees", amount: solicitorFees },
    { label: "Survey",               amount: surveyFee },
  ]

  if (bridgingCostTotal > 0) {
    lines.push({ label: "Bridging Finance Costs", amount: bridgingCostTotal })
  }
  if (insuranceFirstYear > 0) {
    lines.push({ label: "Buildings Insurance (year 1)", amount: insuranceFirstYear })
  }
  if (refurbCost > 0) {
    lines.push({ label: "Refurbishment",             amount: refurbCost })
    lines.push({ label: `Refurb Contingency (${refurbContingencyPct}%)`, amount: contingency, isCalculated: true })
  }
  if (otherCosts > 0) {
    lines.push({ label: "Other Costs", amount: otherCosts })
  }

  const totalCashRequired = lines.reduce((sum, l) => sum + l.amount, 0)

  return { lines, totalCashRequired, sdlt }
}
