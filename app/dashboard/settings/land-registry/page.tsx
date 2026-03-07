import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LandRegistrySettings } from "@/components/settings/land-registry-settings"
import { PageHeader } from "@/components/ui/page-header"

export default async function LandRegistryPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="HM Land Registry"
        subtitle="Import CCOD/OCOD ownership datasets to enhance BMV scoring with corporate and overseas ownership intelligence."
      />
      <LandRegistrySettings />
    </div>
  )
}
