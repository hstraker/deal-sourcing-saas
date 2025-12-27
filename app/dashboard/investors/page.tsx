import { Suspense } from "react"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { InvestorList } from "@/components/investors/investor-list"
import { ReservationOverview } from "@/components/investors/reservation-overview"
import { InvestorManagementDashboard } from "@/components/settings/investor-management-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export const dynamic = "force-dynamic"

export default async function InvestorsPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect("/login")
  }

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

  // Fetch investors with reservation counts and pipeline info
  const investors = await prisma.investor.findMany({
    include: {
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
        },
      },
      _count: {
        select: {
          reservations: true,
        },
      },
    },
    orderBy: {
      lastActivityAt: "desc",
    },
  })

  // Fetch all reservations
  const reservations = await prisma.investorReservation.findMany({
    include: {
      investor: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      deal: {
        select: {
          id: true,
          address: true,
          askingPrice: true,
          status: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Convert Decimal fields to numbers and include all fields
  const investorsForClient = investors.map((investor) => ({
    ...investor,
    minBudget: investor.minBudget ? Number(investor.minBudget) : null,
    maxBudget: investor.maxBudget ? Number(investor.maxBudget) : null,
    totalSpent: Number(investor.totalSpent),
    pipelineStage: investor.pipelineStage,
    _count: investor._count,
  }))

  const reservationsForClient = reservations.map((reservation) => ({
    ...reservation,
    reservationFee: Number(reservation.reservationFee),
    deal: {
      ...reservation.deal,
      askingPrice: Number(reservation.deal.askingPrice),
    },
  }))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Investor Management</h1>
        <p className="text-muted-foreground">
          Track investor activities, pipeline stages, and performance metrics
        </p>
      </div>

      <Tabs defaultValue="investors" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="investors">Investors</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>
        <TabsContent value="investors" className="mt-6">
          <InvestorList initialInvestors={investorsForClient as any} />
        </TabsContent>
        <TabsContent value="reservations" className="mt-6">
          <ReservationOverview initialReservations={reservationsForClient as any} />
        </TabsContent>
        <TabsContent value="statistics" className="mt-6">
          <Suspense fallback={<div>Loading statistics...</div>}>
            <InvestorManagementDashboard />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  )
}
