/**
 * lib/motivation-scorer.ts
 *
 * Computes a motivation score (0–100) for a property listing.
 *
 * The score represents how "motivated" the seller is to move quickly
 * and/or at a discount — a stronger signal than the raw bmvScore.
 *
 * Signals & weights (capped at 100):
 * ─────────────────────────────────────────────────────────────────────────────
 *  Signal                        Points   Notes
 * ─────────────────────────────────────────────────────────────────────────────
 *  Price reduced ≥ 5%            +20
 *  Price reduced ≥ 10%           +35      replaces +20
 *  Price reduced ≥ 20%           +50      replaces +35
 *  Back on market                +25      priceHistory shows re-list
 *  60–89 DOM                     +10
 *  90–179 DOM                    +20      replaces +10
 *  180+ DOM                      +30      replaces +20
 *  EPC F or G                    +10      structural work likely
 *  Chain free                    +10
 *  Probate                       +15
 *  Requires modernisation        +10      from needsWorkKeywords
 *  Motivated seller keywords     +20      e.g. "must sell", "urgent"
 *  Auction listing               +25
 *  Repossession                  +30
 *  Cash buyers only              +10
 *  Withdrawn / relisted signal   +20      >1 price history event
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Each contributing signal is recorded in `signals[]` for display in the UI.
 */

import type { BmvIndicatorsData, PriceHistoryEntry } from "@/types/property-listing"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MotivationSignal {
  name:   string   // Human-readable label shown in UI
  points: number   // Points contributed by this signal
}

export interface MotivationScorerInput {
  price:          number
  priceHistory:   PriceHistoryEntry[]
  bmvIndicators:  BmvIndicatorsData
  epcRating:      string | null | undefined
  isChainFree:    boolean | null | undefined
  keyFeatures:    string[]
  daysOnMarket:   number
  listedDate:     string | null | undefined
}

export interface MotivationScorerResult {
  motivationScore:   number             // 0–100
  motivationSignals: MotivationSignal[] // Individual signal breakdown
}

// ─── Keyword detection helpers ────────────────────────────────────────────────

const MOTIVATED_KEYWORDS = [
  "must sell", "urgent sale", "needs to sell", "quick sale", "quick move",
  "motivated seller", "open to offers", "below market value", "priced to sell",
  "immediate sale", "relocation", "chain free quick", "financial difficulties",
  "sell fast", "below valuation",
]

function containsMotivatedKeyword(text: string): boolean {
  const lower = text.toLowerCase()
  return MOTIVATED_KEYWORDS.some(k => lower.includes(k))
}

// ─── Main scorer ──────────────────────────────────────────────────────────────

export function computeMotivationScore(input: MotivationScorerInput): MotivationScorerResult {
  const signals: MotivationSignal[] = []
  let raw = 0

  const bmv = input.bmvIndicators

  // ── 1. Price reduction ──────────────────────────────────────────────────────
  if (bmv.hasReduction && bmv.reductionPercentage) {
    const pct = bmv.reductionPercentage
    if (pct >= 20) {
      signals.push({ name: `Reduced ${pct.toFixed(0)}% (major)`, points: 50 })
      raw += 50
    } else if (pct >= 10) {
      signals.push({ name: `Reduced ${pct.toFixed(0)}%`, points: 35 })
      raw += 35
    } else if (pct >= 5) {
      signals.push({ name: `Reduced ${pct.toFixed(0)}%`, points: 20 })
      raw += 20
    }
  }

  // ── 2. Back on market / withdrawn-relisted ──────────────────────────────────
  // More than 1 price history entry suggests relisting
  if (input.priceHistory.length > 1) {
    // Check if the price dropped back down (withdrawn then relisted cheaper)
    const prices = input.priceHistory.map(h => h.price)
    const hasRelist = prices.some((p, i) => i > 0 && p < prices[0])
    if (hasRelist) {
      signals.push({ name: "Back on market / relisted", points: 25 })
      raw += 25
    } else {
      signals.push({ name: "Multiple price changes", points: 20 })
      raw += 20
    }
  }

  // ── 3. Days on market ───────────────────────────────────────────────────────
  const dom = input.daysOnMarket
  if (dom >= 180) {
    signals.push({ name: `${dom}d on market (very long)`, points: 30 })
    raw += 30
  } else if (dom >= 90) {
    signals.push({ name: `${dom}d on market (long)`, points: 20 })
    raw += 20
  } else if (dom >= 60) {
    signals.push({ name: `${dom}d on market`, points: 10 })
    raw += 10
  }

  // ── 4. EPC rating F or G ────────────────────────────────────────────────────
  if (input.epcRating && ["F", "G"].includes(input.epcRating.toUpperCase())) {
    signals.push({ name: `EPC ${input.epcRating} — works required`, points: 10 })
    raw += 10
  }

  // ── 5. Chain free ───────────────────────────────────────────────────────────
  if (input.isChainFree) {
    signals.push({ name: "Chain free", points: 10 })
    raw += 10
  }

  // ── 6. Probate ──────────────────────────────────────────────────────────────
  if (bmv.isProbate) {
    signals.push({ name: "Probate sale", points: 15 })
    raw += 15
  }

  // ── 7. Repossession ─────────────────────────────────────────────────────────
  if (bmv.isRepossession) {
    signals.push({ name: "Repossession", points: 30 })
    raw += 30
  }

  // ── 8. Auction ──────────────────────────────────────────────────────────────
  if (bmv.isAuction) {
    signals.push({ name: "Auction listing", points: 25 })
    raw += 25
  }

  // ── 9. Cash buyers only ─────────────────────────────────────────────────────
  if (bmv.isCashBuyersOnly) {
    signals.push({ name: "Cash buyers only", points: 10 })
    raw += 10
  }

  // ── 10. Requires modernisation ──────────────────────────────────────────────
  if (bmv.needsWorkKeywords.length > 0) {
    signals.push({ name: "Requires modernisation", points: 10 })
    raw += 10
  }

  // ── 11. Motivated seller keywords ───────────────────────────────────────────
  const allText = [
    ...input.keyFeatures,
    ...bmv.motivatedSellerKeywords,
  ].join(" ")
  if (bmv.motivatedSellerKeywords.length > 0 || containsMotivatedKeyword(allText)) {
    signals.push({ name: "Motivated seller language", points: 20 })
    raw += 20
  }

  // ── Cap at 100 ──────────────────────────────────────────────────────────────
  const motivationScore = Math.min(100, raw)

  return { motivationScore, motivationSignals: signals }
}

// ─── Level label helper (for UI badges) ──────────────────────────────────────

export function motivationLevel(score: number): {
  label: string
  color: "red" | "orange" | "amber" | "blue" | "gray"
} {
  if (score >= 70) return { label: "High Motivation",     color: "red" }
  if (score >= 45) return { label: "Moderate Motivation", color: "orange" }
  if (score >= 20) return { label: "Some Motivation",     color: "amber" }
  return            { label: "Standard",                  color: "gray" }
}
