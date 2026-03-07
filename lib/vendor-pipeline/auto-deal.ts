/**
 * Auto-creates a Deal record from a VendorLead when the offer is accepted,
 * then links it back via vendorLead.dealId.
 *
 * Safe to call multiple times — returns the existing dealId if one is already linked.
 */

import { prisma } from "@/lib/db"

type DealPropertyType = "terraced" | "semi" | "detached" | "flat" | "maisonette"

function mapPropertyType(vendorType?: string | null): DealPropertyType | null {
  if (!vendorType) return null
  const map: Record<string, DealPropertyType> = {
    terraced: "terraced",
    "semi-detached": "semi",
    semi: "semi",
    detached: "detached",
    flat: "flat",
    maisonette: "maisonette",
  }
  return map[vendorType.toLowerCase()] ?? null
}

export async function ensureDealForVendorLead(leadId: string): Promise<string | null> {
  const lead = await prisma.vendorLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      dealId: true,
      propertyAddress: true,
      propertyPostcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      squareFeet: true,
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedRefurbCost: true,
      estimatedMonthlyRent: true,
    },
  })

  if (!lead) return null
  if (lead.dealId) return lead.dealId // already linked

  const address = lead.propertyAddress
  const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : null
  if (!address || !askingPrice) return null // insufficient data to create a deal

  const deal = await prisma.deal.create({
    data: {
      address,
      postcode: lead.propertyPostcode ?? null,
      propertyType: mapPropertyType(lead.propertyType),
      bedrooms: lead.bedrooms ?? null,
      bathrooms: lead.bathrooms ?? null,
      squareFeet: lead.squareFeet ?? null,
      askingPrice,
      afterRefurbValue: lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
      estimatedRefurbCost: lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
      estimatedMonthlyRent: lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
      status: "in_progress",
      dataSource: "manual",
    },
  })

  await prisma.vendorLead.update({
    where: { id: leadId },
    data: { dealId: deal.id },
  })

  console.log(`[auto-deal] Created deal ${deal.id} for vendor lead ${leadId}`)
  return deal.id
}
