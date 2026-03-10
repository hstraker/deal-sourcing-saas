import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorPageShell } from "@/components/vendors/vendor-page-shell"
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"

export default async function VendorOfferAnalysisPage({
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
      vendorEmail: true,
      vendorPhone: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      estimatedMonthlyRent: true,
      estimatedRefurbCost: true,
      offerAmount: true,
      offerPercentage: true,
      offerSentAt: true,
      offerAcceptedAt: true,
      offerRejectedAt: true,
      rejectionReason: true,
      dealId: true,
      validationNotes: true,
    },
  })

  if (!lead) notFound()

  const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : 0
  const gdv = lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null
  const estimatedRent = lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null
  const totalRefurb = lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null

  const missingInputsHint =
    !gdv || !totalRefurb
      ? "Go to the Validation page for this lead to set Market Value and Refurb Cost."
      : !estimatedRent
      ? "Edit the lead and set Monthly Rent to complete the analysis."
      : undefined

  return (
    <VendorPageShell
      leadId={lead.id}
      vendorName={lead.vendorName}
      propertyAddress={lead.propertyAddress}
      propertyPostcode={lead.propertyPostcode}
    >
      {/* Offer status banners */}
      {lead.offerAcceptedAt && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-green-500 bg-green-50 p-4 mb-4">
          <div>
            <p className="font-bold text-green-900">Offer Accepted!</p>
            <p className="text-sm text-green-700">
              Accepted on{" "}
              {new Date(lead.offerAcceptedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
        </div>
      )}
      {lead.offerRejectedAt && (
        <div className="flex items-center gap-3 rounded-xl border-2 border-red-500 bg-red-50 p-4 mb-4">
          <div>
            <p className="font-bold text-red-900">Offer Rejected</p>
            <p className="text-sm text-red-700">
              Rejected on{" "}
              {new Date(lead.offerRejectedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {lead.rejectionReason && <span> — &quot;{lead.rejectionReason}&quot;</span>}
            </p>
          </div>
        </div>
      )}

      <OfferAnalysisPanel
        dealId={lead.dealId}
        askingPrice={askingPrice}
        gdv={gdv}
        estimatedRent={estimatedRent}
        totalRefurbishment={totalRefurb}
        vendorLeadId={lead.id}
        vendorName={lead.vendorName}
        vendorEmail={lead.vendorEmail}
        vendorPhone={lead.vendorPhone}
        missingInputsHint={missingInputsHint}
      />
    </VendorPageShell>
  )
}
