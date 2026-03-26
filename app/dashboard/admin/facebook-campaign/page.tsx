import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import FacebookCampaignContent from "@/components/admin/facebook-campaign-content"

export const metadata = {
  title: "Facebook Campaign Kit",
}

export default async function FacebookCampaignPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  return <FacebookCampaignContent />
}
