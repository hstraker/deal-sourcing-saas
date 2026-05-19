import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { NegotiatePage } from "@/components/vendors/negotiate-page"

export const dynamic = "force-dynamic"

export default async function NegotiationCoachPage() {
  const session = await getServerSession(authOptions)

  if (!session) redirect("/login")
  if (session.user.role !== "admin" && session.user.role !== "sourcer") redirect("/dashboard")

  return (
    <div className="p-6">
      <NegotiatePage />
    </div>
  )
}
