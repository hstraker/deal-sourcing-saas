import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redirect } from "next/navigation"
import { OfferCalculatorSettings } from "@/components/settings/offer-calculator-settings"

export const metadata = { title: "BMV Offer Calculator Settings" }

export default async function OfferCalculatorSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/auth/signin")
  if (session.user.role !== "admin") redirect("/dashboard")

  return (
    <div className="container max-w-3xl py-8">
      <OfferCalculatorSettings />
    </div>
  )
}
