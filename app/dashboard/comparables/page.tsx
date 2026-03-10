import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ComparablesListClient } from "./comparables-list-client"

export const metadata = { title: "Comparables — DealStack" }

export default async function ComparablesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      propertyPostcode: true,
      propertyType: true,
      bedrooms: true,
      askingPrice: true,
      estimatedMarketValue: true,
      pipelineStage: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const serialised = leads.map((l) => ({
    ...l,
    askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
    estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
  }))

  return <ComparablesListClient leads={serialised} />
}
