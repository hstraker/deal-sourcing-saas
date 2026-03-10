import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { SourcingAlertsClient } from "./sourcing-alerts-client"

export const dynamic = "force-dynamic"
export const metadata = { title: "Sourcing Alerts — DealStack" }

export default async function SourcingAlertsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const [alerts, prefs] = await Promise.all([
    prisma.sourcingAlert.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.notificationPreference.findUnique({
      where: { userId: session.user.id },
    }),
  ])

  const defaultPrefs = {
    priceIncrease: true,
    priceDecrease: true,
    auctionReminder7Days: true,
    auctionReminder3Days: true,
    auctionReminder1Day: true,
    newPropertyMatch: true,
    deliveryEmail: true,
    deliverySms: false,
    deliveryInApp: true,
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Sourcing Alerts</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Get notified when new properties matching your criteria are listed
        </p>
      </div>

      <SourcingAlertsClient
        initialAlerts={alerts.map((a) => ({
          ...a,
          minPrice: a.minPrice,
          maxPrice: a.maxPrice,
          minBedrooms: a.minBedrooms,
          maxBedrooms: a.maxBedrooms,
        }))}
        initialPrefs={prefs ?? defaultPrefs}
      />
    </div>
  )
}
