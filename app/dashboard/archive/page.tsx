import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PageHeader } from "@/components/ui/page-header"
import { ArchivePage } from "@/components/archive/archive-page"

export const dynamic = "force-dynamic"

export default async function ArchivePageRoute() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <div>Unauthorized</div>
  }

  // Fetch archived vendor leads
  const archivedLeads = await prisma.vendorLead.findMany({
    where: {
      archivedAt: { not: null },
    },
    select: {
      id: true,
      vendorName: true,
      vendorPhone: true,
      propertyAddress: true,
      propertyPostcode: true,
      pipelineStage: true,
      offerAmount: true,
      motivationScore: true,
      archivedAt: true,
      dealId: true,
      createdAt: true,
      validationPassed: true,
      bmvScore: true,
    },
    orderBy: { archivedAt: "desc" },
  })

  // Fetch archived deals
  const archivedDeals = await prisma.deal.findMany({
    where: {
      archivedAt: { not: null },
    },
    select: {
      id: true,
      address: true,
      postcode: true,
      askingPrice: true,
      status: true,
      archivedAt: true,
      createdAt: true,
      bmvPercentage: true,
      assignedTo: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { archivedAt: "desc" },
  })

  // Fetch vendor leads for archived deals (relation must be queried separately)
  const dealIds = archivedDeals.map((d) => d.id)
  const dealVendorLeads = dealIds.length
    ? await prisma.vendorLead.findMany({
        where: { dealId: { in: dealIds }, archivedAt: { not: null } },
        select: {
          id: true,
          dealId: true,
          vendorName: true,
        },
      })
    : []
  const vendorLeadByDealId = Object.fromEntries(
    dealVendorLeads.map((vl) => [vl.dealId!, { id: vl.id, vendorName: vl.vendorName }])
  )

  // Convert Decimal fields to numbers for client components
  const leadsForClient = archivedLeads.map((lead) => ({
    ...lead,
    offerAmount: lead.offerAmount ? Number(lead.offerAmount) : null,
    bmvScore: lead.bmvScore ? Number(lead.bmvScore) : null,
  }))

  const dealsForClient = archivedDeals.map((deal) => ({
    ...deal,
    askingPrice: Number(deal.askingPrice),
    bmvPercentage: deal.bmvPercentage ? Number(deal.bmvPercentage) : null,
    vendorLead: vendorLeadByDealId[deal.id] ?? null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Archive"
        subtitle={`${leadsForClient.length} archived lead${leadsForClient.length !== 1 ? "s" : ""}, ${dealsForClient.length} archived deal${dealsForClient.length !== 1 ? "s" : ""}`}
      />

      <ArchivePage leads={leadsForClient as any} deals={dealsForClient as any} />
    </div>
  )
}
