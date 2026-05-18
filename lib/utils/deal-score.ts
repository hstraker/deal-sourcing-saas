/**
 * Deal Score Utility
 *
 * Computes a 0–100 composite score for a vendor lead from all available signals.
 * Computed client-side on the fly — no extra API calls or DB columns needed.
 *
 * Signal weights (total 100 pts max):
 *   BMV %              → 0–20 pts  (discount below market — important but not the only path to profit)
 *   Gross Yield        → 0–20 pts  (annual rent / market value, caps at 10%+. Equal to BMV: yield IS the deal for BTL/BRRR)
 *   Portal Risk        → 0–12 pts  (clear=12, caution=6, red_flag=0)
 *   Vendor Motivation  → 0–12 pts  (1–10 scale from AI conversation)
 *   Photo Condition    → 0–10 pts  (AI photo analysis 0–100 score)
 *   Comparables        → 0–10 pts  (count + confidence level)
 *   Flood Zone         → 0–7  pts  (zone1=7, not-checked=5, zone2=3, zone3=0)
 *   EPC Rating         → 0–6  pts  (A/B=6, C/D=5, E=3, F/G=1)
 *   Street View        → 0–3  pts  (kerbAppeal 1–10 from AI)
 *
 * Risk modifier (deduction):
 *   Leasehold <70yr    → −10 pts
 *   Leasehold 70–79yr  → −5 pts
 *   Leasehold 80–84yr  → −2 pts
 *
 * Final score is clamped 0–100.
 *
 * NOTE: BMV and Yield have equal weight (20 pts each) so BRRR/BTL deals with strong
 * yield but modest discount score fairly alongside flip deals with high BMV but lower yield.
 */

export interface DealScoreInputs {
  // Core financials
  bmvScore?: string | number | null
  estimatedMonthlyRent?: string | number | null
  estimatedMarketValue?: string | number | null
  // AI conversation
  motivationScore?: number | null              // 1–10
  // Comparables
  comparablesCount?: number | null
  comparablesConfidence?: string | null        // "HIGH" | "MEDIUM" | "LOW"
  // Photo AI
  photoConditionScore?: number | null          // 0–100
  // Portal / risk
  latestCheckRisk?: string | null              // "clear" | "caution" | "red_flag"
  // Flood
  floodRiskZone?: string | null               // "zone1" | "zone2" | "zone3" | "unknown"
  // EPC
  epcRating?: string | null                   // "A" | "B" | "C" | "D" | "E" | "F" | "G"
  // Street view AI
  streetViewAnalysis?: Record<string, unknown> | null  // { kerbAppeal: 1–10 }
  // Leasehold modifier
  tenureType?: string | null
  leaseholdData?: { yearsRemaining?: number | null } | null
}

export interface DealScoreSignal {
  pts: number
  maxPts: number
  display: string        // human-readable value e.g. "22% BMV"
  available: boolean
}

export interface DealScoreResult {
  total: number          // 0–100 final score (clamped)
  rawTotal: number       // pre-clamp total (may be <0 with leasehold penalty)
  // Individual signals
  bmv: DealScoreSignal
  portalRisk: DealScoreSignal
  motivation: DealScoreSignal
  yield: DealScoreSignal
  photoCondition: DealScoreSignal
  comparables: DealScoreSignal
  floodZone: DealScoreSignal
  epc: DealScoreSignal
  streetView: DealScoreSignal
  leaseholdPenalty: number    // 0, -2, -4, or -8
  // Summary
  signalsAvailable: number
  signalsTotal: number
  label: "Excellent" | "Good" | "Fair" | "Weak"
  colour: "green" | "blue" | "amber" | "red"
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function num(v: string | number | null | undefined): number | null {
  if (v == null) return null
  const n = typeof v === "string" ? parseFloat(v) : v
  return isFinite(n) ? n : null
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function signal(pts: number, maxPts: number, display: string, available: boolean): DealScoreSignal {
  return { pts, maxPts, display, available }
}

// ─── main scorer ──────────────────────────────────────────────────────────────

export function computeDealScore(inputs: DealScoreInputs): DealScoreResult {
  // ── BMV % (0–20 pts) ──────────────────────────────────────────────────────
  // 30%+ BMV → full 20 pts, linear. Important but equal weight to yield.
  const bmvVal = num(inputs.bmvScore)
  const bmv = bmvVal != null
    ? signal(Math.round(clamp(bmvVal / 30, 0, 1) * 20), 20, `${bmvVal.toFixed(1)}% BMV`, true)
    : signal(0, 20, "Not calculated", false)

  // ── Portal Risk (0–12 pts) ─────────────────────────────────────────────────
  const riskVal = inputs.latestCheckRisk
  const portalRisk = riskVal === "clear"    ? signal(12, 12, "Clear ✓", true)
                   : riskVal === "caution"  ? signal(6,  12, "Caution ⚠", true)
                   : riskVal === "red_flag" ? signal(0,  12, "Red Flag ⛔", true)
                   : signal(0, 12, "Not checked", false)

  // ── Vendor Motivation (0–12 pts) ───────────────────────────────────────────
  // motivationScore is stored 1–10
  const motivVal = inputs.motivationScore
  const motivation = motivVal != null
    ? signal(Math.round(clamp(motivVal / 10, 0, 1) * 12), 12, `${motivVal}/10`, true)
    : signal(0, 12, "Not assessed", false)

  // ── Gross Yield (0–20 pts) ─────────────────────────────────────────────────
  // Annual rent / market value. Caps at 10%+. Equal weight to BMV: yield IS the deal for BTL/BRRR.
  const rentVal = num(inputs.estimatedMonthlyRent)
  const mvVal   = num(inputs.estimatedMarketValue)
  let yieldSignal: DealScoreSignal
  if (rentVal != null && mvVal != null && mvVal > 0) {
    const grossYield = (rentVal * 12) / mvVal * 100
    yieldSignal = signal(
      Math.round(clamp(grossYield / 10, 0, 1) * 20),
      20,
      `${grossYield.toFixed(1)}% gross yield`,
      true
    )
  } else {
    yieldSignal = signal(0, 20, "No rent/value data", false)
  }

  // ── Photo Condition (0–10 pts) ─────────────────────────────────────────────
  const photoVal = inputs.photoConditionScore
  const photoCondition = photoVal != null
    ? signal(Math.round(clamp(photoVal / 100, 0, 1) * 10), 10, `${photoVal}/100 condition`, true)
    : signal(0, 10, "Not analysed", false)

  // ── Comparables (0–10 pts) ─────────────────────────────────────────────────
  const compsCount = inputs.comparablesCount ?? null
  const compsConf  = inputs.comparablesConfidence ?? null
  let comparables: DealScoreSignal
  if (compsCount != null && compsCount > 0) {
    // Confidence multiplier: HIGH=1.0, MEDIUM=0.7, LOW=0.4
    const confMulti = compsConf === "HIGH" ? 1.0 : compsConf === "MEDIUM" ? 0.7 : compsConf === "LOW" ? 0.4 : 0.6
    const basePts   = Math.round(clamp(compsCount / 5, 0, 1) * 10)
    const pts       = Math.round(basePts * confMulti)
    const confLabel = compsConf ?? "unrated"
    comparables = signal(pts, 10, `${compsCount} comps (${confLabel.toLowerCase()})`, true)
  } else {
    comparables = signal(0, 10, "No comparables", false)
  }

  // ── Flood Zone (0–7 pts) ───────────────────────────────────────────────────
  // Not checked gets a neutral 5/7 — most UK properties are zone 1 by default.
  const floodVal = inputs.floodRiskZone
  const floodZone = floodVal === "zone1"   ? signal(7, 7, "Zone 1 — Low Risk", true)
                  : floodVal === "zone2"   ? signal(3, 7, "Zone 2 — Medium Risk", true)
                  : floodVal === "zone3"   ? signal(0, 7, "Zone 3 — High Risk ⛔", true)
                  : floodVal === "unknown" ? signal(2, 7, "Unknown zone", true)
                  : signal(5, 7, "Not checked (assumed ok)", false) // neutral default

  // ── EPC Rating (0–6 pts) ───────────────────────────────────────────────────
  const epcVal = inputs.epcRating?.toUpperCase()
  const epcPts = epcVal === "A" || epcVal === "B" ? 6
               : epcVal === "C" || epcVal === "D" ? 5
               : epcVal === "E"                   ? 3
               : epcVal === "F" || epcVal === "G" ? 1
               : null
  const epc = epcVal && epcPts != null
    ? signal(epcPts, 6, `EPC ${epcVal}`, true)
    : signal(0, 6, "No EPC data", false)

  // ── Street View Kerb Appeal (0–3 pts) ─────────────────────────────────────
  const svAnalysis = inputs.streetViewAnalysis as { kerbAppeal?: number; hasStreetViewData?: boolean } | null
  const kerbAppeal = svAnalysis?.kerbAppeal ?? null
  const streetView = kerbAppeal != null && svAnalysis?.hasStreetViewData !== false
    ? signal(Math.round(clamp(kerbAppeal / 10, 0, 1) * 3), 3, `${kerbAppeal}/10 kerb appeal`, true)
    : signal(0, 3, "Not analysed", false)

  // ── Leasehold Penalty (modifier, 0 / −2 / −5 / −10) ──────────────────────
  const tenure = (inputs.tenureType ?? "").toLowerCase()
  const isLeasehold = tenure.includes("leasehold") && !tenure.includes("freehold")
  const lhYears = inputs.leaseholdData?.yearsRemaining ?? null
  let leaseholdPenalty = 0
  if (isLeasehold && lhYears != null) {
    if      (lhYears < 70) leaseholdPenalty = -10
    else if (lhYears < 80) leaseholdPenalty = -5
    else if (lhYears < 85) leaseholdPenalty = -2
  }

  // ── Final score ───────────────────────────────────────────────────────────
  const rawTotal =
    bmv.pts + portalRisk.pts + motivation.pts + yieldSignal.pts +
    photoCondition.pts + comparables.pts + floodZone.pts + epc.pts +
    streetView.pts + leaseholdPenalty

  const total = clamp(rawTotal, 0, 100)

  const allSignals = [bmv, portalRisk, motivation, yieldSignal, photoCondition, comparables, floodZone, epc, streetView]
  const signalsAvailable = allSignals.filter(s => s.available).length
  const signalsTotal     = allSignals.length

  let label: DealScoreResult["label"]
  let colour: DealScoreResult["colour"]
  if      (total >= 75) { label = "Excellent"; colour = "green" }
  else if (total >= 55) { label = "Good";      colour = "blue"  }
  else if (total >= 35) { label = "Fair";      colour = "amber" }
  else                  { label = "Weak";      colour = "red"   }

  return {
    total,
    rawTotal,
    bmv,
    portalRisk,
    motivation,
    yield: yieldSignal,
    photoCondition,
    comparables,
    floodZone,
    epc,
    streetView,
    leaseholdPenalty,
    signalsAvailable,
    signalsTotal,
    label,
    colour,
  }
}

/** Returns Tailwind colour classes for the score badge */
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
