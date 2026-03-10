// app/dashboard/vendors/portal-check/page.tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { PortalCheckList } from "@/components/vendors/portal-check-list"
import { ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function PortalCheckPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const leads = await prisma.vendorLead.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Serialize ALL Date objects to ISO strings — Next.js throws "Only plain objects"
  // errors for any Date value that crosses the server→client boundary.
  const serialized = leads.map((lead) => ({
    ...lead,
    createdAt:                    lead.createdAt.toISOString(),
    updatedAt:                    lead.updatedAt.toISOString(),
    latestCheckedAt:              lead.latestCheckedAt?.toISOString() ?? null,
    validatedAt:                  lead.validatedAt?.toISOString() ?? null,
    offerSentAt:                  lead.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:              lead.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:              lead.offerRejectedAt?.toISOString() ?? null,
    nextRetryAt:                  lead.nextRetryAt?.toISOString() ?? null,
    videoSentAt:                  lead.videoSentAt?.toISOString() ?? null,
    lockoutAgreementSentAt:       lead.lockoutAgreementSentAt?.toISOString() ?? null,
    lockoutAgreementSignedAt:     lead.lockoutAgreementSignedAt?.toISOString() ?? null,
    lastInvestorPackGeneratedAt:  lead.lastInvestorPackGeneratedAt?.toISOString() ?? null,
    reservedAt:                   lead.reservedAt?.toISOString() ?? null,
    lastContactAt:                lead.lastContactAt?.toISOString() ?? null,
    conversationStartedAt:        lead.conversationStartedAt?.toISOString() ?? null,
    dealClosedAt:                 lead.dealClosedAt?.toISOString() ?? null,
    comparablesFetchedAt:         lead.comparablesFetchedAt?.toISOString() ?? null,
    // Decimal fields — convert to number for client serialization
    askingPrice:                  lead.askingPrice ? Number(lead.askingPrice) : null,
    estimatedMonthlyRent:         lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
    estimatedAnnualRent:          lead.estimatedAnnualRent ? Number(lead.estimatedAnnualRent) : null,
    rentPerSqFt:                  lead.rentPerSqFt ? Number(lead.rentPerSqFt) : null,
    localAverageRent:             lead.localAverageRent ? Number(lead.localAverageRent) : null,
    bmvScore:                     lead.bmvScore ? Number(lead.bmvScore) : null,
    estimatedMarketValue:         lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
    estimatedRefurbCost:          lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
    profitPotential:              lead.profitPotential ? Number(lead.profitPotential) : null,
    offerAmount:                  lead.offerAmount ? Number(lead.offerAmount) : null,
    offerPercentage:              lead.offerPercentage ? Number(lead.offerPercentage) : null,
    avgComparablePrice:           lead.avgComparablePrice ? Number(lead.avgComparablePrice) : null,
    // Relations not fetched — provide empty arrays to satisfy the VendorLead type
    smsMessages:                  [],
    pipelineEvents:               [],
  }))

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="h-6 w-6 text-gray-400" />
          <h1 className="text-3xl font-bold">Portal Check</h1>
        </div>
        <p className="text-gray-400">
          Portal and ownership risk status across all vendor leads
        </p>
      </div>
      <PortalCheckList leads={serialized as any} />
    </div>
  )
}
