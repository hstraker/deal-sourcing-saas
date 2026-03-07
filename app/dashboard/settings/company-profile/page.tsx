import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CompanyProfileSettings } from "@/components/settings/company-profile-settings"
import { PageHeader } from "@/components/ui/page-header"

export const metadata = {
  title: "Company Profile | Settings",
  description: "Manage your company profile, branding, and information",
}

export default async function CompanyProfilePage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Company Profile"
        subtitle="Manage your company information, branding, and logo"
      />

      <Suspense fallback={<div>Loading...</div>}>
        <CompanyProfileSettings />
      </Suspense>
    </div>
  )
}
