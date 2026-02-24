/**
 * IRR solver — internal rate of return for a series of cashflows.
 * Used by BuyHold (e.g. 5-year IRR). Newton-Raphson with fallback to binary search.
 * Deterministic; same cashflows => same IRR.
 */

const MAX_ITERATIONS = 100
const TOLERANCE = 1e-7
const RATE_MIN = -0.99
const RATE_MAX = 10

/**
 * NPV at rate r: sum of cf[t] / (1+r)^t for t = 0..n.
 */
function npv(cashflows: number[], rate: number): number {
  let sum = 0
  for (let t = 0; t < cashflows.length; t++) {
    sum += cashflows[t] / Math.pow(1 + rate, t)
  }
  return sum
}

/**
 * Derivative of NPV w.r.t. r (for Newton-Raphson).
 * d/dr [ cf[t] / (1+r)^t ] = cf[t] * (-t) * (1+r)^(-t-1)
 */
function npvDerivative(cashflows: number[], rate: number): number {
  let sum = 0
  for (let t = 0; t < cashflows.length; t++) {
    if (t === 0) continue
    const factor = Math.pow(1 + rate, -t - 1)
    sum += cashflows[t] * (-t) * factor
  }
  return sum
}

/**
 * Calculate IRR using Newton-Raphson. Falls back to binary search if NR fails.
 * cashflows[0] = initial outflow (negative), cashflows[1..] = subsequent flows.
 * Returns annual rate as decimal (e.g. 0.12 = 12%). Returns null if no solution.
 */
export function calculateIRR(cashflows: number[], guess: number = 0.1): number | null {
  if (cashflows.length < 2) return null
  // Need at least one sign change for a valid IRR
  const hasPositive = cashflows.some((cf) => cf > 0)
  const hasNegative = cashflows.some((cf) => cf < 0)
  if (!hasPositive || !hasNegative) return null

  let r = guess
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const val = npv(cashflows, r)
    if (Math.abs(val) < TOLERANCE) return Math.round(r * 1e9) / 1e9
    const der = npvDerivative(cashflows, r)
    if (Math.abs(der) < 1e-15) break // avoid division by zero
    r = r - val / der
    if (r <= RATE_MIN || r >= RATE_MAX) break
  }

  // Binary search fallback
  let low = RATE_MIN
  let high = RATE_MAX
  if (npv(cashflows, low) * npv(cashflows, high) > 0) return null
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const mid = (low + high) / 2
    const v = npv(cashflows, mid)
    if (Math.abs(v) < TOLERANCE) return Math.round(mid * 1e9) / 1e9
    if (v > 0) low = mid
    else high = mid
  }
  const mid = (low + high) / 2
  return Math.round(mid * 1e9) / 1e9
}

/**
 * IRR as percentage (e.g. 12 for 12%).
 */
export function calculateIRRPercent(cashflows: number[], guess: number = 0.1): number | null {
  const r = calculateIRR(cashflows, guess)
  return r === null ? null : r * 100
}
