import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { InvestorManagementDashboard } from "@/components/settings/investor-management-dashboard"

export const dynamic = "force-dynamic"
export const metadata = { title: "Statistics — DealStack" }

export default async function StatisticsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistics</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Investor performance metrics and pipeline analytics
        </p>
      </div>
      <Suspense fallback={<div className="text-sm text-gray-400 py-8 text-center">Loading statistics…</div>}>
        <InvestorManagementDashboard />
      </Suspense>
    </div>
  )
}
