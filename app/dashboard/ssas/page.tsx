import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { PageHeader } from "@/components/ui/page-header"
import { SsasScanner } from "@/components/ssas/ssas-scanner"

export const dynamic = "force-dynamic"

export default async function SsasPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")
  if (!["admin", "sourcer"].includes(session.user.role)) redirect("/dashboard")

  return (
    <div className="space-y-4 h-full">
      <PageHeader
        title="SSAS Analyser"
        description="Analyse commercial property listings for SSAS pension fund investment — yield, DSCR, loan-back viability, and risk scoring."
      />
      <SsasScanner />
    </div>
  )
}
