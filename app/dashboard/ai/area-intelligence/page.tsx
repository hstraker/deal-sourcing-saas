import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolHubClient } from "@/components/ai/ai-tool-hub-client"

export const metadata = { title: "AI Area Intelligence | DealStack" }

export default async function AreaIntelligencePage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AIToolHubClient
        title="AI Area Intelligence"
        description="AI generates an investor-ready area brief for any postcode — rental demand, average yields, regeneration signals, crime trends, school catchments, and HMO licensing context. Select a lead to generate or view its area brief."
        icon="map-pin"
        leadLinkPattern="/dashboard/vendors?leadId={id}&tab=area-intelligence"
        leadLinkLabel="Open Area Brief"
        badge="Powered by Claude"
        badgeColor="blue"
      />
    </div>
  )
}
