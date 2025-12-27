import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { CompanyProfileSettings } from "@/components/settings/company-profile-settings"

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
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Company Profile</h1>
        <p className="text-muted-foreground mt-2">
          Manage your company information, branding, and logo
        </p>
      </div>

      <Suspense fallback={<div>Loading...</div>}>
        <CompanyProfileSettings />
      </Suspense>
    </div>
  )
}
