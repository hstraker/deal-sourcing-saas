import { getServerSession } from "next-auth"
import { redirect, notFound } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorPageShell } from "@/components/vendors/vendor-page-shell"
import { VendorComparablesTab } from "@/components/vendors/vendor-comparables-tab"

export default async function VendorComparablesPage({
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
    },
  })

  if (!lead) notFound()

  const askingPrice = lead.askingPrice ? Number(lead.askingPrice) : undefined

  return (
    <VendorPageShell
      leadId={lead.id}
      vendorName={lead.vendorName}
      propertyAddress={lead.propertyAddress}
      propertyPostcode={lead.propertyPostcode}
    >
      <VendorComparablesTab
        vendorLeadId={lead.id}
        askingPrice={askingPrice}
        propertyPostcode={lead.propertyPostcode}
      />
    </VendorPageShell>
  )
}
