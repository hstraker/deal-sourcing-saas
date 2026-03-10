import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { InvestorPacksClient } from "@/components/investors/investor-packs-client"

export const metadata = { title: "Investor Packs — DealStack" }
export const dynamic = "force-dynamic"

export default async function InvestorPacksPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  const raw = await prisma.investorPackDelivery.findMany({
    include: {
      investor: {
        include: {
          user: {
            select: { firstName: true, lastName: true, email: true },
          },
        },
      },
      generation: {
        include: {
          template: { select: { name: true } },
        },
      },
    },
    orderBy: { sentAt: "desc" },
  })

  const deliveries = raw.map((d) => ({
    ...d,
    sentAt:       d.sentAt.toISOString(),
    viewedAt:     d.viewedAt?.toISOString() ?? null,
    downloadedAt: d.downloadedAt?.toISOString() ?? null,
    generation: d.generation
      ? {
          ...d.generation,
          createdAt:    d.generation.createdAt.toISOString(),
          sentAt:       d.generation.sentAt?.toISOString() ?? null,
          viewedAt:     d.generation.viewedAt?.toISOString() ?? null,
          downloadedAt: d.generation.downloadedAt?.toISOString() ?? null,
          askingPrice:  d.generation.askingPrice ? Number(d.generation.askingPrice) : null,
        }
      : null,
  }))

  return <InvestorPacksClient deliveries={deliveries as any} />
}
