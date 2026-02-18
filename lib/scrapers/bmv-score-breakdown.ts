/**
 * BMV Score Breakdown — pure display helpers.
 *
 * Mirrors the exact scoring logic in bmv-detector.ts → calculateBmvScore()
 * so the UI can show "why this score" without re-running detection.
 */

import type { BmvIndicatorsData } from "@/types/property-listing"

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BmvBreakdownItem {
  /** Display label */
  label: string
  /** Extra detail string (keywords found, reduction %, etc.) */
  detail: string | null
  /** Points contributed to the score (0 if inactive) */
  points: number
  /** Whether this signal fired */
  active: boolean
}

export interface BmvGrade {
  grade: "Weak" | "Moderate" | "Strong" | "Exceptional"
  /** Tailwind text colour class */
  textColor: string
  /** Tailwind bg colour class for badge */
  bgColor: string
  /** Tailwind ring/border colour */
  ringColor: string
  /** Short description shown in tooltip */
  description: string
}

// ─── Grade tier ────────────────────────────────────────────────────────────────

export function bmvGrade(score: number): BmvGrade {
  if (score >= 80) {
    return {
      grade: "Exceptional",
      textColor: "text-blue-700 dark:text-blue-300",
      bgColor: "bg-blue-100 dark:bg-blue-900/40",
      ringColor: "ring-blue-300 dark:ring-blue-700",
      description: "Highest-confidence BMV opportunity — multiple strong signals detected",
    }
  }
  if (score >= 60) {
    return {
      grade: "Strong",
      textColor: "text-green-700 dark:text-green-300",
      bgColor: "bg-green-100 dark:bg-green-900/40",
      ringColor: "ring-green-300 dark:ring-green-700",
      description: "Multiple strong signals — good investment candidate",
    }
  }
  if (score >= 30) {
    return {
      grade: "Moderate",
      textColor: "text-amber-700 dark:text-amber-300",
      bgColor: "bg-amber-100 dark:bg-amber-900/40",
      ringColor: "ring-amber-300 dark:ring-amber-700",
      description: "Some indicators present — worth reviewing",
    }
  }
  return {
    grade: "Weak",
    textColor: "text-gray-600 dark:text-gray-400",
    bgColor: "bg-gray-100 dark:bg-gray-800",
    ringColor: "ring-gray-300 dark:ring-gray-600",
    description: "Few signals detected — likely a standard market listing",
  }
}

// ─── Breakdown builder ─────────────────────────────────────────────────────────

/**
 * Build a per-signal breakdown matching calculateBmvScore() in bmv-detector.ts.
 * Returns items sorted: active first, then inactive.
 */
export function buildBmvBreakdown(bmv: BmvIndicatorsData): BmvBreakdownItem[] {
  const items: BmvBreakdownItem[] = []

  // ── Price reduction (up to 30 pts) ──────────────────────────────────────────
  if (bmv.hasReduction) {
    const pct = bmv.reductionPercentage ?? 0
    let pts = 5
    if (pct >= 20) pts = 30
    else if (pct >= 10) pts = 20
    else if (pct >= 5) pts = 10

    const detail = [
      pct > 0 ? `${pct}% reduction` : "reduction detected",
      bmv.originalPrice ? `was £${bmv.originalPrice.toLocaleString()}` : null,
    ]
      .filter(Boolean)
      .join(" — ")

    items.push({ label: "Price Reduced", detail, points: pts, active: true })
  } else {
    items.push({ label: "Price Reduced", detail: null, points: 0, active: false })
  }

  // ── Needs-work keywords (up to 25 pts, 5 each, max 5) ─────────────────────
  const kwCount = bmv.needsWorkKeywords?.length ?? 0
  if (kwCount > 0) {
    const pts = Math.min(kwCount, 5) * 5
    const kws = bmv.needsWorkKeywords.slice(0, 5).join(", ")
    const extra = kwCount > 5 ? ` +${kwCount - 5} more` : ""
    items.push({
      label: "Needs Work",
      detail: `${kws}${extra} (${kwCount} keyword${kwCount > 1 ? "s" : ""})`,
      points: pts,
      active: true,
    })
  } else {
    items.push({ label: "Needs Work", detail: null, points: 0, active: false })
  }

  // ── Motivated-seller keywords (up to 20 pts, 5 each, max 4) ───────────────
  const msCount = bmv.motivatedSellerKeywords?.length ?? 0
  if (msCount > 0) {
    const pts = Math.min(msCount, 4) * 5
    const kws = bmv.motivatedSellerKeywords.slice(0, 4).join(", ")
    const extra = msCount > 4 ? ` +${msCount - 4} more` : ""
    items.push({
      label: "Motivated Seller",
      detail: `${kws}${extra} (${msCount} keyword${msCount > 1 ? "s" : ""})`,
      points: pts,
      active: true,
    })
  } else {
    items.push({ label: "Motivated Seller", detail: null, points: 0, active: false })
  }

  // ── Repossession (15 pts) ──────────────────────────────────────────────────
  if (bmv.isRepossession) {
    items.push({ label: "Repossession", detail: "bank/lender sale", points: 15, active: true })
  } else {
    items.push({ label: "Repossession", detail: null, points: 0, active: false })
  }

  // ── Long time on market (up to 15 pts) ────────────────────────────────────
  if (bmv.longTimeOnMarket) {
    const days = bmv.daysOnMarket ?? 0
    const pts = days > 180 ? 15 : days > 120 ? 10 : 5
    items.push({
      label: "Long on Market",
      detail: `${days} days (${days > 180 ? "6+ months" : days > 120 ? "4+ months" : "3+ months"})`,
      points: pts,
      active: true,
    })
  } else {
    const days = bmv.daysOnMarket ?? 0
    items.push({
      label: "Long on Market",
      detail: days > 0 ? `${days} days` : null,
      points: 0,
      active: false,
    })
  }

  // ── Auction (10 pts) ───────────────────────────────────────────────────────
  if (bmv.isAuction) {
    items.push({ label: "Auction Listing", detail: null, points: 10, active: true })
  } else {
    items.push({ label: "Auction Listing", detail: null, points: 0, active: false })
  }

  // ── Probate (10 pts) ───────────────────────────────────────────────────────
  if (bmv.isProbate) {
    items.push({ label: "Probate / Estate Sale", detail: null, points: 10, active: true })
  } else {
    items.push({ label: "Probate / Estate Sale", detail: null, points: 0, active: false })
  }

  // ── Cash buyers only (5 pts) ───────────────────────────────────────────────
  if (bmv.isCashBuyersOnly) {
    items.push({ label: "Cash Buyers Only", detail: "mortgage restrictions", points: 5, active: true })
  } else {
    items.push({ label: "Cash Buyers Only", detail: null, points: 0, active: false })
  }

  // Sort: active items first, then inactive
  return [
    ...items.filter((i) => i.active).sort((a, b) => b.points - a.points),
    ...items.filter((i) => !i.active),
  ]
}
