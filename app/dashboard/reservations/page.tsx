import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { ReservationOverview } from "@/components/investors/reservation-overview"

export const dynamic = "force-dynamic"
export const metadata = { title: "Reservations — DealStack" }

export default async function ReservationsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  if (session.user.role !== "admin" && session.user.role !== "sourcer") {
    redirect("/dashboard")
  }

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

  const packDeliveries =
    reservations.length > 0
      ? await prisma.investorPackDelivery.findMany({
          where: {
            OR: reservations.map((r) => ({
              investorId: r.investorId,
              dealId: r.dealId,
            })),
          },
          orderBy: { sentAt: "desc" },
          select: {
            id: true,
            dealId: true,
            investorId: true,
            partNumber: true,
            recipientEmail: true,
            emailStatus: true,
            emailError: true,
            sentAt: true,
            deliveryMethod: true,
          },
        })
      : []

  const reservationsForClient = reservations.map((reservation) => ({
    ...reservation,
    reservationFee: Number(reservation.reservationFee),
    deal: {
      ...reservation.deal,
      askingPrice: Number(reservation.deal.askingPrice),
    },
    packDeliveries: packDeliveries.filter(
      (d) =>
        d.investorId === reservation.investorId &&
        d.dealId === reservation.dealId
    ),
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reservations</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage reservations through the workflow pipeline
        </p>
      </div>
      <ReservationOverview initialReservations={reservationsForClient as any} />
    </div>
  )
}
