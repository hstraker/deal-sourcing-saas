import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { VendorContactsClient } from "./vendor-contacts-client"

export const metadata = { title: "Vendor Contacts — DealStack" }

export default async function VendorContactsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      vendorPhone: true,
      vendorEmail: true,
      vendorAddress: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      propertyType: true,
      bedrooms: true,
      bathrooms: true,
      pipelineStage: true,
      motivationScore: true,
      lastContactAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  })

  // Serialise Decimal/Date for the client
  const serialised = leads.map((l) => ({
    ...l,
    askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
    lastContactAt: l.lastContactAt?.toISOString() ?? null,
    createdAt: l.createdAt.toISOString(),
  }))

  return <VendorContactsClient leads={serialised} />
}
