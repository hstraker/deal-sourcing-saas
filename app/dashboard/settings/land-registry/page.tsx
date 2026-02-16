import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { LandRegistrySettings } from "@/components/settings/land-registry-settings"

export default async function LandRegistryPage() {
  const session = await getServerSession(authOptions)

  if (!session || session.user.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">HM Land Registry</h1>
        <p className="text-muted-foreground mt-1">
          Import CCOD/OCOD ownership datasets to enhance BMV scoring with corporate and overseas
          ownership intelligence.
        </p>
      </div>
      <LandRegistrySettings />
    </div>
  )
}
