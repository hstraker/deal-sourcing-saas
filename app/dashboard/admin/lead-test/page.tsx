import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import LeadSimulator from "@/components/admin/lead-simulator"

export default async function LeadTestPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [totalLeads, newThisWeek, advancedLeads, newLeads, testLeads] = await Promise.all([
    prisma.vendorLead.count({ where: { isTest: false } }),
    prisma.vendorLead.count({ where: { isTest: false, createdAt: { gte: weekAgo } } }),
    // Leads that have moved past NEW_LEAD / AI_CONVERSATION (i.e. validated)
    prisma.vendorLead.count({
      where: {
        isTest: false,
        pipelineStage: {
          in: ["DEAL_VALIDATION", "OFFER_MADE", "OFFER_ACCEPTED", "PAPERWORK_SENT", "READY_FOR_INVESTORS"],
        },
      },
    }),
    prisma.vendorLead.count({ where: { isTest: false, pipelineStage: { in: ["NEW_LEAD", "AI_CONVERSATION"] } } }),
    prisma.vendorLead.findMany({
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
    }),
  ])

  const conversionRate =
    advancedLeads + newLeads > 0
      ? Math.round((advancedLeads / (advancedLeads + newLeads)) * 100)
      : 0

  return (
    <LeadSimulator
      stats={{ totalVendors: totalLeads, newThisWeek, conversionRate }}
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
