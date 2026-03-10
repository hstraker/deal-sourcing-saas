import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ValidationListClient } from "./validation-list-client"

export const metadata = { title: "Validation — DealStack" }
export const dynamic = "force-dynamic"

export default async function ValidationPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const leads = await prisma.vendorLead.findMany({
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      propertyPostcode: true,
      askingPrice: true,
      estimatedMarketValue: true,
      bmvScore: true,
      validationPassed: true,
      validatedAt: true,
      pipelineStage: true,
      motivationScore: true,
    },
    orderBy: { createdAt: "desc" },
  })

  const serialised = leads.map((l) => ({
    ...l,
    askingPrice: l.askingPrice ? Number(l.askingPrice) : null,
    estimatedMarketValue: l.estimatedMarketValue ? Number(l.estimatedMarketValue) : null,
    bmvScore: l.bmvScore ? Number(l.bmvScore) : null,
    validatedAt: l.validatedAt?.toISOString() ?? null,
  }))

  return <ValidationListClient leads={serialised as any} />
}
