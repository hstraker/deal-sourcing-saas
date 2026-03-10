import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { UnifiedContactsClient } from "@/components/contacts/unified-contacts-client"

export const metadata = { title: "Contacts — DealStack" }
export const dynamic = "force-dynamic"

export default async function ContactsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // ── Fetch contacts (all types) with link counts ──────────────────────────
  const rawContacts = await prisma.contact.findMany({
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Serialise DateTime fields to ISO strings for the client boundary
  const contacts = rawContacts.map((c) => ({
    ...c,
    createdAt:     c.createdAt.toISOString(),
    updatedAt:     c.updatedAt.toISOString(),
    sraVerifiedAt: c.sraVerifiedAt?.toISOString() ?? null,
  }))

  // ── Fetch vendor leads (all scalar fields) ────────────────────────────────
  const rawLeads = await prisma.vendorLead.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Serialise ALL DateTime and Decimal fields (matches portal-check page pattern)
  const vendorLeads = rawLeads.map((lead) => ({
    ...lead,
    createdAt:                   lead.createdAt.toISOString(),
    updatedAt:                   lead.updatedAt.toISOString(),
    latestCheckedAt:             lead.latestCheckedAt?.toISOString() ?? null,
    validatedAt:                 lead.validatedAt?.toISOString() ?? null,
    offerSentAt:                 lead.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:             lead.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:             lead.offerRejectedAt?.toISOString() ?? null,
    nextRetryAt:                 lead.nextRetryAt?.toISOString() ?? null,
    videoSentAt:                 lead.videoSentAt?.toISOString() ?? null,
    lockoutAgreementSentAt:      lead.lockoutAgreementSentAt?.toISOString() ?? null,
    lockoutAgreementSignedAt:    lead.lockoutAgreementSignedAt?.toISOString() ?? null,
    lastInvestorPackGeneratedAt: lead.lastInvestorPackGeneratedAt?.toISOString() ?? null,
    reservedAt:                  lead.reservedAt?.toISOString() ?? null,
    lastContactAt:               lead.lastContactAt?.toISOString() ?? null,
    conversationStartedAt:       lead.conversationStartedAt?.toISOString() ?? null,
    dealClosedAt:                lead.dealClosedAt?.toISOString() ?? null,
    comparablesFetchedAt:        lead.comparablesFetchedAt?.toISOString() ?? null,
    // Decimal → number
    askingPrice:               lead.askingPrice ? Number(lead.askingPrice) : null,
    estimatedMonthlyRent:      lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
    estimatedAnnualRent:       lead.estimatedAnnualRent ? Number(lead.estimatedAnnualRent) : null,
    rentPerSqFt:               lead.rentPerSqFt ? Number(lead.rentPerSqFt) : null,
    localAverageRent:          lead.localAverageRent ? Number(lead.localAverageRent) : null,
    bmvScore:                  lead.bmvScore ? Number(lead.bmvScore) : null,
    estimatedMarketValue:      lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
    estimatedRefurbCost:       lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
    profitPotential:           lead.profitPotential ? Number(lead.profitPotential) : null,
    offerAmount:               lead.offerAmount ? Number(lead.offerAmount) : null,
    offerPercentage:           lead.offerPercentage ? Number(lead.offerPercentage) : null,
    avgComparablePrice:        lead.avgComparablePrice ? Number(lead.avgComparablePrice) : null,
    // Relations not fetched — satisfy VendorLead type
    smsMessages:    [],
    pipelineEvents: [],
  }))

  return (
    <UnifiedContactsClient
      initialContacts={contacts as any}
      vendorLeads={vendorLeads as any}
    />
  )
}
