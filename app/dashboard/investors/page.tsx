import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { InvestorList } from "@/components/investors/investor-list"

export const dynamic = "force-dynamic"
export const metadata = { title: "Investors — DealStack" }

export default async function InvestorsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const investors = await prisma.investor.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      _count: {
        select: {
          reservations: true,
        },
      },
    },
    orderBy: {
      lastActivityAt: "desc",
    },
  })

  const investorsForClient = investors.map((investor) => ({
    ...investor,
    minBudget: investor.minBudget ? Number(investor.minBudget) : null,
    maxBudget: investor.maxBudget ? Number(investor.maxBudget) : null,
    totalSpent: Number(investor.totalSpent),
    pipelineStage: investor.pipelineStage,
    _count: investor._count,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Investors</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage investor profiles and track pipeline stages
        </p>
      </div>
      <InvestorList initialInvestors={investorsForClient as any} />
    </div>
  )
}
