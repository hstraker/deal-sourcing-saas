import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolHubClient } from "@/components/ai/ai-tool-hub-client"

export const metadata = { title: "AI Investor Matching | DealStack" }

export default async function InvestorMatchingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AIToolHubClient
        title="AI Investor Matching"
        description="Claude ranks your investor database by buy-box fit for each deal and writes personalised email and SMS pitches — referencing the investor's target strategy, yield requirements, and previous deal history. Edit before sending. Select a lead to match and pitch investors."
        icon="user-plus"
        leadLinkPattern="/dashboard/vendors?leadId={id}&tab=investors"
        leadLinkLabel="Match Investors"
        badge="Powered by Claude"
        badgeColor="blue"
      />
    </div>
  )
}
