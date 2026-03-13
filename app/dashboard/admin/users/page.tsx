import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UserManagement } from "@/components/admin/user-management"
import { PageHeader } from "@/components/ui/page-header"

export const metadata = {
  title: "User Management | Admin",
}

export const dynamic = "force-dynamic"

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (session.user.role !== "admin") redirect("/dashboard")

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Manage team members and their access levels"
      />
      <UserManagement currentUserId={session.user.id} />
    </div>
  )
}
