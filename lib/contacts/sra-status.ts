import type { Contact } from "@prisma/client"

export type SraVerificationStatus = "verified" | "stale" | "unverified" | "not-solicitor"

export interface SraStatusInfo {
  status: SraVerificationStatus
  label: string
  badgeVariant: "success" | "warning" | "destructive" | "secondary"
  daysSinceVerified: number | null
}

const STALE_DAYS = 30

export function getSraVerificationStatus(contact: Contact): SraStatusInfo {
  if (contact.type !== "SOLICITOR") {
    return {
      status: "not-solicitor",
      label: "N/A",
      badgeVariant: "secondary",
      daysSinceVerified: null,
    }
  }

  if (!contact.sraVerifiedAt) {
    return {
      status: "unverified",
      label: "Not verified",
      badgeVariant: "warning",
      daysSinceVerified: null,
    }
  }

  const daysSince = Math.floor(
    (Date.now() - new Date(contact.sraVerifiedAt).getTime()) / (1000 * 60 * 60 * 24)
  )

  if (!contact.sraVerified || daysSince > STALE_DAYS) {
    return {
      status: "stale",
      label: `Verified ${daysSince}d ago — re-check needed`,
      badgeVariant: "warning",
      daysSinceVerified: daysSince,
    }
  }

  return {
    status: "verified",
    label: contact.sraStatus ?? "Authorised",
    badgeVariant: "success",
    daysSinceVerified: daysSince,
  }
}
