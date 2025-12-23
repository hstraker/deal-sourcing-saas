import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { WorkflowAnalytics } from "@/components/analytics/workflow-analytics"

export const dynamic = "force-dynamic"

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Workflow Analytics</h1>
        <p className="text-muted-foreground">
          Track conversion rates, time in stages, and pipeline performance
        </p>
      </div>

      <WorkflowAnalytics />
    </div>
  )
}

