export type { Contact, ContactType } from "@prisma/client"

import type { Contact } from "@prisma/client"

export interface ContactWithCounts extends Contact {
  _count: { vendorLeads: number; investors: number }
}

export interface ContactCreateInput {
  type: import("@prisma/client").ContactType
  firstName: string
  lastName: string
  company?: string
  jobTitle?: string
  email?: string
  phone?: string
  mobilePhone?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  county?: string
  postcode?: string
  sraNumber?: string
  website?: string
  practiceAreas?: string[]
  notes?: string
  tags?: string[]
  isPreferred?: boolean
}
