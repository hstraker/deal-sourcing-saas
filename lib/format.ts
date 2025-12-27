/**
 * Shared formatting utilities for consistent display across the application
 */

/**
 * Format a number as GBP currency
 * @param amount - The amount to format (can be number, null, or undefined)
 * @returns Formatted currency string (e.g., "£250,000") or "N/A" if null/undefined
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "N/A"

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Format a number with thousand separators
 * @param num - The number to format (can be number, null, or undefined)
 * @returns Formatted number string (e.g., "1,234,567") or "N/A" if null/undefined
 */
export function formatNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "N/A"
  return num.toLocaleString("en-GB")
}

/**
 * Format a number as a percentage
 * @param num - The number to format (can be number, null, or undefined)
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string (e.g., "15.5%") or "N/A" if null/undefined
 */
export function formatPercentage(
  num: number | null | undefined,
  decimals: number = 1
): string {
  if (num === null || num === undefined) return "N/A"
  return `${num.toFixed(decimals)}%`
}

/**
 * Format a date in UK format
 * @param date - The date to format (can be Date, string, null, or undefined)
 * @returns Formatted date string (e.g., "25 Dec 2025") or "N/A" if null/undefined
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"

  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * Format a date with time in UK format
 * @param date - The date to format (can be Date, string, null, or undefined)
 * @returns Formatted datetime string (e.g., "25 Dec 2025, 14:30") or "N/A" if null/undefined
 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "N/A"

  return new Date(date).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/**
 * Format a decimal as currency with decimal places
 * @param amount - The amount to format (can be number, null, or undefined)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted currency string (e.g., "£1,234.56") or "N/A" if null/undefined
 */
export function formatCurrencyWithDecimals(
  amount: number | null | undefined,
  decimals: number = 2
): string {
  if (amount === null || amount === undefined) return "N/A"

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/**
 * Shorten large numbers with K, M, B suffixes
 * @param num - The number to format
 * @returns Shortened number string (e.g., "1.5M", "250K")
 */
export function formatCompactNumber(num: number | null | undefined): string {
  if (num === null || num === undefined) return "N/A"

  if (num >= 1_000_000_000) {
    return `${(num / 1_000_000_000).toFixed(1)}B`
  }
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`
  }
  return num.toString()
}

/**
 * Format a phone number (basic UK format)
 * @param phone - The phone number to format
 * @returns Formatted phone string or original if can't format
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "N/A"

  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "")

  // UK mobile format: 07XXX XXXXXX
  if (cleaned.startsWith("07") && cleaned.length === 11) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`
  }

  // UK landline format: 0XX XXXX XXXX
  if (cleaned.startsWith("0") && cleaned.length === 11) {
    return `${cleaned.slice(0, 3)} ${cleaned.slice(3, 7)} ${cleaned.slice(7)}`
  }

  // International format: +XX XXX XXX XXXX
  if (cleaned.startsWith("44") && cleaned.length >= 12) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
  }

  // Return original if no pattern matches
  return phone
}
