import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InvestorPackTemplatesManager } from "@/components/settings/investor-pack-templates-manager"
import { PageHeader } from "@/components/ui/page-header"

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
    <div className="space-y-6">
      <PageHeader
        title="Investor Pack Templates"
        subtitle="Manage your investor pack templates and view generation statistics"
      />

      <Suspense fallback={<div>Loading...</div>}>
        <InvestorPackTemplatesManager />
      </Suspense>
    </div>
  )
}
