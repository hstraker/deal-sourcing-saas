import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorManagementDashboard } from "@/components/settings/investor-management-dashboard"

export const metadata = {
  title: "Investor Management | Settings",
  description: "Manage investors, view statistics, and track investor activities",
}

export default async function InvestorManagementPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Investor Management</h1>
        <p className="text-muted-foreground mt-2">
          Track investor activities, pipeline stages, and performance metrics
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <InvestorManagementDashboard />
      </Suspense>
    </div>
  )
}
