/**
 * Mortgage amortisation — repayment (principal + interest) schedule.
 * Used by BTL/BRRR for DSCR and debt service. Pure, deterministic math.
 */

export interface AmortisationPeriod {
  month: number
  payment: number
  principal: number
  interest: number
  balance: number
}

export interface AmortisationResult {
  /** Fixed monthly payment (principal + interest) */
  monthlyPayment: number
  /** Total number of payments */
  numberOfPayments: number
  /** Optional full schedule; can be omitted if only payment is needed */
  schedule?: AmortisationPeriod[]
}

/**
 * Calculate repayment mortgage: fixed monthly payment so loan is paid off over term.
 * Formula: P * r * (1+r)^n / ((1+r)^n - 1)
 * Used for DSCR (annual debt service = monthlyPayment * 12).
 */
export function calculateAmortisation(
  principal: number,
  annualRatePercent: number,
  termYears: number,
  options?: { includeSchedule: boolean }
): AmortisationResult {
  const n = termYears * 12
  const r = annualRatePercent / 100 / 12

  let monthlyPayment: number
  if (r <= 0 || principal <= 0) {
    monthlyPayment = n > 0 ? principal / n : 0
  } else {
    const factor = Math.pow(1 + r, n)
    monthlyPayment = (principal * r * factor) / (factor - 1)
  }
  monthlyPayment = Math.round(monthlyPayment * 100) / 100

  const result: AmortisationResult = {
    monthlyPayment,
    numberOfPayments: n,
  }

  if (options?.includeSchedule && n > 0 && principal > 0 && r > 0) {
    const schedule: AmortisationPeriod[] = []
    let balance = principal
    for (let month = 1; month <= n; month++) {
      const interest = Math.round(balance * r * 100) / 100
      const principalPaid = Math.min(monthlyPayment - interest, balance)
      balance = Math.round((balance - principalPaid) * 100) / 100
      if (balance < 0) balance = 0
      schedule.push({
        month,
        payment: monthlyPayment,
        principal: principalPaid,
        interest,
        balance,
      })
    }
    result.schedule = schedule
  }

  return result
}

/**
 * Annual debt service (for DSCR): 12 * monthly payment.
 */
export function annualDebtService(monthlyPayment: number): number {
  return monthlyPayment * 12
}
