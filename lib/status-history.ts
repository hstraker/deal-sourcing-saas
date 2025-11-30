import type { DealStatusValue } from "@/lib/deal-scoring"

export interface StatusHistoryEntry {
  status: DealStatusValue
  changedAt: string
  changedBy: string
  note?: string | null
}

export const parseStatusHistory = (history: unknown): StatusHistoryEntry[] => {
  if (!history) return []
  if (Array.isArray(history)) {
    return history.filter((entry): entry is StatusHistoryEntry => {
      return (
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as any).status === "string" &&
        typeof (entry as any).changedAt === "string"
      )
    })
  }
  return []
}

export const appendStatusHistory = (
  history: unknown,
  entry: StatusHistoryEntry
): StatusHistoryEntry[] => {
  const parsed = parseStatusHistory(history)
  return [...parsed, entry]
}


