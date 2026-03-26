import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { KanbanSquare, Plus } from "lucide-react"
import { PageHeader } from "@/components/ui/page-header"
import { DealList } from "@/components/deals/deal-list"

export const dynamic = "force-dynamic"

export default async function DealsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    return <div>Unauthorized</div>
  }

  // Build where clause based on role
  // Always exclude archived deals — they belong on the Archive page
  const where: any = {
    status: { not: "archived" },
    archivedAt: null,
  }

  if (session.user.role === "sourcer") {
    where.OR = [
      { assignedToId: session.user.id },
      { assignedToId: null },
      { createdById: session.user.id },
    ]
  }

  const deals = await prisma.deal.findMany({
    where,
    include: {
      assignedTo: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      photos: {
        where: { isCover: true },
        take: 1,
      },
      _count: {
        select: {
          photos: true,
          favorites: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    // Remove the limit - we'll paginate on the client side
  })

  // VendorLead.dealId → Deal is a raw FK with no Prisma relation declared,
  // so we fetch vendor leads separately and join manually.
  const dealIds = deals.map((d) => d.id)
  const vendorLeads = dealIds.length
    ? await prisma.vendorLead.findMany({
        where: { dealId: { in: dealIds } },
        select: {
          id: true,
          dealId: true,
          vendorName: true,
          vendorPhone: true,
          pipelineStage: true,
          offerAmount: true,
          motivationScore: true,
        },
      })
    : []
  const vendorLeadByDealId = Object.fromEntries(
    vendorLeads.map((vl) => [vl.dealId!, vl])
  )

  // Fetch team members for the filter dropdown
  const teamMembers = await prisma.user.findMany({
    where: {
      role: {
        in: ["admin", "sourcer"],
      },
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  })

  // Convert Decimal fields to numbers for client components
  const dealsForClient = deals.map((deal) => {
    const vl = vendorLeadByDealId[deal.id] ?? null
    return {
      ...deal,
      askingPrice: Number(deal.askingPrice),
      marketValue: deal.marketValue ? Number(deal.marketValue) : null,
      estimatedRefurbCost: deal.estimatedRefurbCost ? Number(deal.estimatedRefurbCost) : null,
      afterRefurbValue: deal.afterRefurbValue ? Number(deal.afterRefurbValue) : null,
      estimatedMonthlyRent: deal.estimatedMonthlyRent ? Number(deal.estimatedMonthlyRent) : null,
      bmvPercentage: deal.bmvPercentage ? Number(deal.bmvPercentage) : null,
      grossYield: deal.grossYield ? Number(deal.grossYield) : null,
      netYield: deal.netYield ? Number(deal.netYield) : null,
      roi: deal.roi ? Number(deal.roi) : null,
      roce: deal.roce ? Number(deal.roce) : null,
      packPrice: deal.packPrice ? Number(deal.packPrice) : null,
      squareFeet: deal.squareFeet ? Number(deal.squareFeet) : null,
      vendorLead: vl
        ? {
            id: vl.id,
            vendorName: vl.vendorName,
            vendorPhone: vl.vendorPhone,
            pipelineStage: vl.pipelineStage,
            offerAmount: vl.offerAmount ? Number(vl.offerAmount) : null,
            motivationScore: vl.motivationScore,
          }
        : null,
    }
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deals"
        subtitle={`Manage property deals (${deals.length} total)`}
        actions={
          <div className="flex gap-2">
            <Link href="/dashboard/deals/pipeline">
              <Button variant="outline">
                <KanbanSquare className="mr-2 h-4 w-4" />
                Pipeline
              </Button>
            </Link>
            <Link href="/dashboard/deals/new">
              <Button className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />
                New Deal
              </Button>
            </Link>
          </div>
        }
      />

      <DealList deals={dealsForClient as any} teamMembers={teamMembers} />
    </div>
  )
}
