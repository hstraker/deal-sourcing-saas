import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import LeadSimulator from "@/components/admin/lead-simulator"

export default async function LeadTestPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  const testLeads = await prisma.vendorLead.findMany({
    where: { isTest: true },
    select: {
      id: true,
      vendorName: true,
      propertyAddress: true,
      pipelineStage: true,
      latestCheckRisk: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  })

  return (
    <LeadSimulator
      recentTestRuns={testLeads.map((v) => ({
        id: v.id,
        vendorName: v.vendorName,
        propertyAddress: v.propertyAddress ?? "",
        pipelineStage: v.pipelineStage,
        latestCheckRisk: v.latestCheckRisk,
        createdAt: v.createdAt.toISOString(),
      }))}
    />
  )
}
