import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { UnifiedVendorsView } from "@/components/vendors/unified-vendors-view"

export const dynamic = "force-dynamic"

export default async function VendorsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  return <UnifiedVendorsView />
}

