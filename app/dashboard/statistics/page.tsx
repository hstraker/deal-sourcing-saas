// app/dashboard/statistics/page.tsx
import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { PageHeader } from "@/components/ui/page-header"
import { StatisticsClient } from "./statistics-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "Statistics — DealStack" }

export default async function StatisticsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Statistics"
        subtitle="Vendor & investor performance analytics"
      />
      <Suspense fallback={<div className="py-8 text-center text-sm text-gray-400">Loading statistics…</div>}>
        <StatisticsClient />
      </Suspense>
    </div>
  )
}
