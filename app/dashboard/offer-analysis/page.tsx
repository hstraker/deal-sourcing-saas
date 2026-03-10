import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { OfferListClient } from "./offer-list-client"

export const metadata = { title: "Offer Analysis — DealStack" }
export const dynamic = "force-dynamic"

export default async function OfferAnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      vendorEmail: true,
      vendorPhone: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedMonthlyRent: true,
      estimatedRefurbCost: true,
      bmvScore: true,
      offerAmount: true,
      offerPercentage: true,
      offerSentAt: true,
      offerAcceptedAt: true,
      offerRejectedAt: true,
      dealId: true,
      validationNotes: true,
      pipelineStage: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const serialised = leads.map((l) => ({
    ...l,
    askingPrice:          l.askingPrice ? Number(l.askingPrice) : null,
    estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
    estimatedMonthlyRent: l.estimatedMonthlyRent ? Number(l.estimatedMonthlyRent) : null,
    estimatedRefurbCost:  l.estimatedRefurbCost ? Number(l.estimatedRefurbCost) : null,
    bmvScore:             l.bmvScore ? Number(l.bmvScore) : null,
    offerAmount:          l.offerAmount ? Number(l.offerAmount) : null,
    offerPercentage:      l.offerPercentage ? Number(l.offerPercentage) : null,
    offerSentAt:          l.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:      l.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:      l.offerRejectedAt?.toISOString() ?? null,
  }))

  return <OfferListClient leads={serialised as any} />
}
