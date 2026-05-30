import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolHubClient } from "@/components/ai/ai-tool-hub-client"

export const metadata = { title: "AI Deal Scorer | DealStack" }

export default async function DealScorerPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AIToolHubClient
        title="AI Deal Scorer"
        description="Every vendor lead is automatically scored 0–100 across 9 signals: BMV%, gross yield, flood zone, EPC rating, lease years, vendor motivation, photo condition score, comparable confidence, and portal risk. Select a lead to view its score breakdown."
        icon="star"
        leadLinkPattern="/dashboard/vendors?leadId={id}&tab=risk-check"
        leadLinkLabel="View Deal Score"
        badge="Live in Vendor Leads table"
        badgeColor="green"
      />
    </div>
  )
}
