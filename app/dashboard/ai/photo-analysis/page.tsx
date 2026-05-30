import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolHubClient } from "@/components/ai/ai-tool-hub-client"

export const metadata = { title: "AI Photo Analysis | DealStack" }

export default async function PhotoAnalysisPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <AIToolHubClient
        title="AI Photo Analysis"
        description="Claude Vision scores each property photo for condition (0–10), kerb appeal, and specific issues — damp staining, structural cracks, finish quality, outdated fittings. Outputs an overall photo condition score used in the Deal Scorer. Select a lead to run or view its photo analysis."
        icon="camera"
        leadLinkPattern="/dashboard/vendors?leadId={id}&tab=photos"
        leadLinkLabel="Open Photo Analysis"
        badge="Powered by Claude Vision"
        badgeColor="blue"
      />
    </div>
  )
}
