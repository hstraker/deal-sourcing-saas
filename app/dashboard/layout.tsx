import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Only allow admin and sourcer roles in Phase 1
  if (session.user.role === "investor") {
    redirect("/")
  }

  return <DashboardLayout>{children}</DashboardLayout>
}

