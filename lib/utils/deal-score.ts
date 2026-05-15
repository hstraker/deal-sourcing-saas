/**
 * Deal Score Utility
 *
 * Computes a 0-100 composite score for a vendor lead from existing fields.
 * No DB field needed — computed client-side on the fly.
 *
 * Weighting:
 *   BMV %            → up to 40 pts  (max at 30%+)
 *   Gross yield      → up to 20 pts  (max at 8%+)
 *   Vendor motivation → up to 20 pts (motivationScore 0-100 → 0-20)
 *   Comparables count → up to 10 pts (max at 5+ comps)
 *   Photo condition   → up to 10 pts (photoConditionScore 0-100 → 0-10)
 */

export interface DealScoreInputs {
  bmvScore?: string | number | null            // BMV% e.g. 18.5
  estimatedMonthlyRent?: string | number | null
  estimatedMarketValue?: string | number | null
  motivationScore?: number | null
  comparablesCount?: number | null
  photoConditionScore?: number | null
}

export interface DealScoreResult {
  total: number        // 0-100
  bmvPts: number       // 0-40
  yieldPts: number     // 0-20
  motivationPts: number// 0-20
  compsPts: number     // 0-10
  conditionPts: number // 0-10
  label: "Excellent" | "Good" | "Fair" | "Weak" | "Unknown"
  colour: "green" | "blue" | "amber" | "red" | "gray"
}

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "string" ? parseFloat(v) : v
  return isFinite(n) ? n : null
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

export function computeDealScore(inputs: DealScoreInputs): DealScoreResult | null {
  const bmv  = num(inputs.bmvScore)
  const rent  = num(inputs.estimatedMonthlyRent)
  const mv    = num(inputs.estimatedMarketValue)
  const motiv = inputs.motivationScore ?? null
  const comps = inputs.comparablesCount ?? null

  // We need at least BMV to produce a meaningful score
  if (bmv == null) return null

  // ── BMV pts (0–40) ─────────────────────────────────────────────────────────
  // 0% → 0 pts, 30%+ → 40 pts, linear in between
  const bmvPts = Math.round(clamp(bmv / 30, 0, 1) * 40)

  // ── Yield pts (0–20) ───────────────────────────────────────────────────────
  // Calculated as: (annual rent / market value) * 100
  // 0% → 0, 8%+ → 20 pts
  let yieldPts = 0
  if (rent != null && mv != null && mv > 0) {
    const grossYield = (rent * 12) / mv * 100
    yieldPts = Math.round(clamp(grossYield / 8, 0, 1) * 20)
  }

  // ── Motivation pts (0–20) ──────────────────────────────────────────────────
  const motivationPts = motiv != null ? Math.round(clamp(motiv / 100, 0, 1) * 20) : 10 // default 10 if unknown

  // ── Comparables pts (0–10) ─────────────────────────────────────────────────
  // 0 comps → 0 pts, 5+ comps → 10 pts
  const compsPts = comps != null ? Math.round(clamp(comps / 5, 0, 1) * 10) : 0

  // ── Condition pts (0–10) ───────────────────────────────────────────────────
  // photoConditionScore is 0-100, rescale to 0-10
  const condScore = inputs.photoConditionScore ?? null
  const conditionPts = condScore != null ? Math.round(clamp(condScore / 100, 0, 1) * 10) : 5 // default 5 if no photos

  const total = bmvPts + yieldPts + motivationPts + compsPts + conditionPts

  let label: DealScoreResult["label"]
  let colour: DealScoreResult["colour"]

  if (total >= 75) { label = "Excellent"; colour = "green"  }
  else if (total >= 55) { label = "Good";      colour = "blue"  }
  else if (total >= 35) { label = "Fair";      colour = "amber" }
  else               { label = "Weak";      colour = "red"   }

  return { total, bmvPts, yieldPts, motivationPts, compsPts, conditionPts, label, colour }
}

/** Returns a Tailwind colour class set for the badge */
export function dealScoreClasses(colour: DealScoreResult["colour"]): {
  bg: string; text: string; border: string
} {
  switch (colour) {
    case "green": return { bg: "bg-green-50",  text: "text-green-700",  border: "border-green-200" }
    case "blue":  return { bg: "bg-blue-50",   text: "text-blue-700",   border: "border-blue-200"  }
    case "amber": return { bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200" }
    case "red":   return { bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"   }
    default:      return { bg: "bg-gray-50",   text: "text-gray-500",   border: "border-gray-200"  }
  }
}
