import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { VendorList } from "@/components/vendors/vendor-list"

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
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Vendors</h1>
        <p className="text-muted-foreground">
          Manage vendors and track offers
        </p>
      </div>

      <VendorList />
    </div>
  )
}

