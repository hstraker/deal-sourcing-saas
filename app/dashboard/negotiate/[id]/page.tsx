import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { NegotiateLeadPage } from "@/components/vendors/negotiate-lead-page"

export const dynamic = "force-dynamic"

export default async function NegotiationCoachLeadPage({
  params,
}: {
  params: { id: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  // Fetch the lead with enough data to seed the offer engine assumptions
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
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedMonthlyRent: true,
      estimatedAnnualRent: true,
      estimatedRefurbCost: true,
      localAverageRent: true,
      bmvScore: true,
      motivationScore: true,
      urgencyLevel: true,
      reasonForSelling: true,
      timelineDays: true,
      competingOffers: true,
      pipelineStage: true,
      calculatorAssumptions: true,
      dealId: true,
      tenureType: true,
      condition: true,
      photoAnalysisStatus: true,
      photoConditionScore: true,
      photoConditionOverride: true,
      archivedAt: true,
      createdAt: true,
    },
  })

  if (!lead || lead.archivedAt) notFound()

  // Cast to VendorLead shape (Prisma Decimal → serialisable number via JSON round-trip)
  const serialised = JSON.parse(JSON.stringify(lead))

  return <NegotiateLeadPage lead={serialised} />
}
