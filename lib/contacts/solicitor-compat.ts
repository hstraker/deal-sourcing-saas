/**
 * Compatibility helpers: map Contact records (type=SOLICITOR) → the legacy
 * Solicitor interface used by SolicitorSelector / SolicitorFormDialog.
 *
 * This lets all existing vendor/investor form pickers continue to work
 * without modification while the DB now stores contacts.
 */
import type { Contact } from "@prisma/client"

export interface SolicitorShape {
  id: string
  name: string
  firmName: string
  sraNumber: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  specialisation: string | null
  notes: string | null
  sraVerified: boolean
  sraVerifiedAt: string | null
  sraStatus: string | null
  sraDisplayName: string | null
}

export function contactToSolicitor(contact: Contact): SolicitorShape {
  return {
    id: contact.id,
    name: contact.fullName,
    firmName: contact.company ?? "",
    sraNumber: contact.sraNumber,
    email: contact.email,
    phone: contact.phone,
    website: contact.website,
    address: contact.addressLine1,
    specialisation: contact.practiceAreas.length > 0 ? contact.practiceAreas.join(", ") : null,
    notes: contact.notes,
    sraVerified: contact.sraVerified,
    sraVerifiedAt: contact.sraVerifiedAt?.toISOString() ?? null,
    sraStatus: contact.sraStatus,
    sraDisplayName: contact.sraDisplayName,
  }
}
