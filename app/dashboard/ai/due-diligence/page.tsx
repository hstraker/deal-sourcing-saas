import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DDChecklistHubClient } from "@/components/ai/dd-checklist-hub-client"

export const metadata = { title: "AI Due Diligence Checklist | DealStack" }

export default async function DDChecklistPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <DDChecklistHubClient />
    </div>
  )
}
