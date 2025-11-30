import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { UserList } from "@/components/users/user-list"
import { PropertyDataUsageDisplay } from "@/components/propertydata/usage-display"

export default async function SettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  // Only admin can access user management
  if (session.user.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage users, roles, and system settings
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <UserList />
        </div>
        <div className="space-y-6">
          <PropertyDataUsageDisplay />
        </div>
      </div>
    </div>
  )
}

