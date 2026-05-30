import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolHubClient } from "@/components/ai/ai-tool-hub-client"

export const metadata = { title: "AI Refurb Estimator | DealStack" }

export default async function RefurbEstimatorPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AIToolHubClient
        title="AI Refurb Estimator"
        description="Claude Vision analyses property photos room by room and estimates refurb costs across 12 categories: kitchen, bathrooms, damp, roof, windows, structural, plumbing, electrical, cosmetic, external, insulation, and other. Includes confidence bands and 10% contingency. Select a lead to open its refurb cost breakdown."
        icon="wrench"
        leadLinkPattern="/dashboard/vendors?leadId={id}&tab=photos"
        leadLinkLabel="Open Refurb Estimator"
        badge="Powered by Claude Vision"
        badgeColor="blue"
      />
    </div>
  )
}
