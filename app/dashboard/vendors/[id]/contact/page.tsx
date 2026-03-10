import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorPageShell } from "@/components/vendors/vendor-page-shell"
import { VendorContactPanel } from "./vendor-contact-panel"

export default async function VendorContactPage({
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
      vendorPhone: true,
      vendorEmail: true,
      vendorAddress: true,
      propertyAddress: true,
      propertyPostcode: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      squareFeet: true,
      condition: true,
      askingPrice: true,
      estimatedMonthlyRent: true,
      pipelineStage: true,
      motivationScore: true,
      urgencyLevel: true,
      reasonForSelling: true,
      timelineDays: true,
      competingOffers: true,
      lastContactAt: true,
      conversationStartedAt: true,
      retryCount: true,
    },
  })

  if (!lead) notFound()

  const serialised = {
    ...lead,
    askingPrice: lead.askingPrice ? Number(lead.askingPrice) : null,
    estimatedMonthlyRent: lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    conversationStartedAt: lead.conversationStartedAt?.toISOString() ?? null,
  }

  return (
    <VendorPageShell
      leadId={lead.id}
      vendorName={lead.vendorName}
      propertyAddress={lead.propertyAddress}
      propertyPostcode={lead.propertyPostcode}
    >
      <VendorContactPanel initialLead={serialised} />
    </VendorPageShell>
  )
}
