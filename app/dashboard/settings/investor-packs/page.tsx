import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorPackTemplatesManager } from "@/components/settings/investor-pack-templates-manager"

export const metadata = {
  title: "Investor Pack Templates | Settings",
  description: "Manage investor pack templates and view generation statistics",
}

export default async function InvestorPackSettingsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Investor Pack Templates</h1>
        <p className="text-muted-foreground mt-2">
          Manage your investor pack templates and view generation statistics
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <InvestorPackTemplatesManager />
      </Suspense>
    </div>
  )
}
