import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { VendorLeadsTable } from "@/components/vendors/vendor-leads-table"

export const dynamic = "force-dynamic"

export default async function VendorsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Vendor Leads</h1>
        <p className="mt-1 text-sm text-gray-500">
          Track and manage all vendor leads through the acquisition pipeline.
        </p>
      </div>
      <VendorLeadsTable />
    </div>
  )
}
