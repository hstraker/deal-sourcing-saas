import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { AIToolComingSoon } from "@/components/ai/ai-tool-coming-soon"

export const metadata = { title: "AI Document Reader | DealStack" }

export default async function DocumentReaderPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <AIToolComingSoon
        title="AI Document Reader"
        description="Drop any property document — Land Registry title, lease, management pack, surveyor report, or planning permission — and Claude extracts key dates, covenants, ground rent, charges, break clauses, and red flags. Summarised in plain English and exportable to the investor pack."
        icon="document"
        eta="Coming soon"
        capabilities={[
          "Land Registry title register — ownership history, charges, restrictions",
          "Lease — ground rent review mechanism, service charge cap, break clauses",
          "Management pack — S20 history, reserve fund, major works planned",
          "Surveyor report — defects flagged, cost estimates cross-referenced",
          "Planning permission — conditions, CIL obligations, expiry dates",
        ]}
      />
    </div>
  )
}
