import { z } from "zod"

// Helper to transform NaN and empty values to null
const optionalInt = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
    const num = typeof val === "string" ? parseInt(val, 10) : val
    return Number.isNaN(num) ? null : num
  },
  z.number().int().min(0).optional().nullable()
)

const optionalFloat = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
    const num = typeof val === "string" ? parseFloat(val) : val
    return Number.isNaN(num) ? null : num
  },
  z.number().min(0).optional().nullable()
)

const optionalPositiveFloat = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
    const num = typeof val === "string" ? parseFloat(val) : val
    return Number.isNaN(num) ? null : num
  },
  z.number().positive().optional().nullable()
)

const optionalUrl = z.preprocess(
  (val) => {
    if (val === "" || val === null || val === undefined) return null
    return val
  },
  z.union([
    z.string().url(),
    z.null(),
  ]).optional().nullable()
)

export const dealSchema = z.object({
  // Property Details
  address: z.string().min(1, "Address is required"),
  postcode: z.string().optional().nullable().or(z.literal("").transform(() => null)),
  propertyType: z.enum(["terraced", "semi", "detached", "flat"]).optional().nullable(),
  bedrooms: optionalInt,
  bathrooms: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
      const num = typeof val === "string" ? parseFloat(val) : val
      return Number.isNaN(num) ? null : num
    },
    z.number().min(0).optional().nullable()
  ),
  squareFeet: optionalInt,
  
  // Pricing
  askingPrice: z.preprocess(
    (val) => {
      if (Number.isNaN(val)) throw new Error("Asking price is required")
      return val
    },
    z.number().positive("Asking price must be positive")
  ),
  marketValue: optionalFloat,
  estimatedRefurbCost: optionalFloat,
  afterRefurbValue: optionalPositiveFloat,
  estimatedMonthlyRent: optionalPositiveFloat,
  
  // Metrics (optional, can be calculated later)
  bmvPercentage: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
      const num = typeof val === "string" ? parseFloat(val) : val
      return Number.isNaN(num) ? null : num
    },
    z.number().min(0).max(100).optional().nullable()
  ),
  grossYield: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
      const num = typeof val === "string" ? parseFloat(val) : val
      return Number.isNaN(num) ? null : num
    },
    z.number().min(0).max(100).optional().nullable()
  ),
  netYield: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
      const num = typeof val === "string" ? parseFloat(val) : val
      return Number.isNaN(num) ? null : num
    },
    z.number().min(0).max(100).optional().nullable()
  ),
  roi: optionalFloat,
  roce: optionalFloat,
  dealScore: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined || Number.isNaN(val)) return null
      const num = typeof val === "string" ? parseInt(val, 10) : val
      return Number.isNaN(num) ? null : num
    },
    z.number().int().min(0).max(100).optional().nullable()
  ),
  
  // Deal Info
  status: z.enum(["new", "review", "in_progress", "ready", "listed", "reserved", "sold", "archived"]).default("new"),
  packTier: z.enum(["basic", "standard", "premium"]).optional().nullable(),
  packPrice: optionalPositiveFloat,
  
  // Source
  dataSource: z.enum(["propertydata", "manual", "rightmove"]).optional().nullable(),
  externalId: z.string().optional().nullable().or(z.literal("").transform(() => null)),
  agentName: z.string().optional().nullable().or(z.literal("").transform(() => null)),
  agentPhone: z.string().optional().nullable().or(z.literal("").transform(() => null)),
  listingUrl: optionalUrl,
  
  // Team
  assignedToId: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
})

export type DealFormData = z.infer<typeof dealSchema>
