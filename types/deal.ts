import type { Deal, User, DealPhoto, VendorLead } from "@prisma/client"

export type DealWithRelations = Deal & {
  assignedTo: {
    id: string
    firstName: string | null
    lastName: string | null
  } | null
  createdBy: {
    id: string
    firstName: string | null
    lastName: string | null
  } | null
  photos: DealPhoto[]
  vendorLead: {
    id: string
    vendorName: string
    vendorPhone: string
    pipelineStage: string
    offerAmount: string | number | null
    motivationScore: number | null
  } | null
  _count: {
    photos: number
    favorites: number
    dealViews?: number
  }
}

// Helper type for Prisma query results
export type DealWithRelationsFromQuery = Omit<DealWithRelations, "_count"> & {
  _count: {
    photos: number
    favorites: number
    dealViews?: number
  }
}
