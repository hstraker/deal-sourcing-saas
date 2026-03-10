import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorPageShell } from "@/components/vendors/vendor-page-shell"
import { VendorValidationPanel } from "./vendor-validation-panel"

export default async function VendorValidationPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const lead = await prisma.vendorLead.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedRefurbCost: true,
      estimatedMonthlyRent: true,
      estimatedAnnualRent: true,
      bedrooms: true,
      bathrooms: true,
      squareFeet: true,
      condition: true,
      motivationScore: true,
      urgencyLevel: true,
      bmvScore: true,
      profitPotential: true,
      validationPassed: true,
      validationNotes: true,
      validatedAt: true,
    },
  })

  if (!lead) notFound()

  const serialised = {
    ...lead,
    askingPrice: lead.askingPrice ? Number(lead.askingPrice) : null,
    estimatedMarketValue: lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
    estimatedRefurbCost: lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
    estimatedMonthlyRent: lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
    estimatedAnnualRent: lead.estimatedAnnualRent ? Number(lead.estimatedAnnualRent) : null,
    bmvScore: lead.bmvScore ? Number(lead.bmvScore) : null,
    profitPotential: lead.profitPotential ? Number(lead.profitPotential) : null,
    validatedAt: lead.validatedAt?.toISOString() ?? null,
  }

  return (
    <VendorPageShell
      leadId={lead.id}
      vendorName={lead.vendorName}
      propertyAddress={lead.propertyAddress}
      propertyPostcode={lead.propertyPostcode}
    >
      <VendorValidationPanel initialLead={serialised} />
    </VendorPageShell>
  )
}
