"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Loader2, CheckCircle2, XCircle, FileText, Clock, Link as LinkIcon } from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"

interface Reservation {
  id: string
  investor: {
    id: string
    user: {
      id: string
      email: string
      firstName: string | null
      lastName: string | null
    }
  }
  deal: {
    id: string
    address: string
    askingPrice: number
    status: string
  }
  reservationFee: number
  feePaid: boolean
  feePaidAt: string | null
  proofOfFundsProvided: boolean
  proofOfFundsVerified: boolean
  proofOfFundsVerifiedAt: string | null
  lockOutAgreementSent: boolean
  lockOutAgreementSigned: boolean
  lockOutAgreementSignedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
}

interface ReservationOverviewProps {
  initialReservations?: Reservation[]
}

const statusColors: Record<string, string> = {
  pending: "bg-gray-100 text-gray-800",
  fee_pending: "bg-yellow-100 text-yellow-800",
  proof_of_funds_pending: "bg-blue-100 text-blue-800",
  verified: "bg-green-100 text-green-800",
  locked_out: "bg-purple-100 text-purple-800",
  completed: "bg-emerald-100 text-emerald-800",
  cancelled: "bg-red-100 text-red-800",
}

const statusLabels: Record<string, string> = {
  pending: "Pending",
  fee_pending: "Fee Pending",
  proof_of_funds_pending: "Proof of Funds Pending",
  verified: "Verified",
  locked_out: "Locked Out",
  completed: "Completed",
  cancelled: "Cancelled",
}

export function ReservationOverview({ initialReservations = [] }: ReservationOverviewProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [isLoading, setIsLoading] = useState(false)

  const fetchReservations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/reservations")
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
      }
    } catch (error) {
      console.error("Error fetching reservations:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (initialReservations.length === 0) {
      fetchReservations()
    }
  }, [])

  const getInvestorName = (investor: Reservation["investor"]) => {
    const name = [investor.user.firstName, investor.user.lastName]
      .filter(Boolean)
      .join(" ")
    return name || investor.user.email
  }

  // Calculate stats
  const stats = {
    total: reservations.length,
    pending: reservations.filter((r) => r.status === "pending").length,
    feePending: reservations.filter((r) => r.status === "fee_pending").length,
    verified: reservations.filter((r) => r.proofOfFundsVerified).length,
    lockedOut: reservations.filter((r) => r.status === "locked_out").length,
    completed: reservations.filter((r) => r.status === "completed").length,
    totalFees: reservations.reduce((sum, r) => sum + Number(r.reservationFee), 0),
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending + stats.feePending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Verified</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.verified}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Fees</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalFees.toLocaleString()}</div>
          </CardContent>
        </Card>
      </div>

      {/* Reservations Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
          <CardDescription>
            View and manage all investor reservations across all deals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No reservations found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fee Paid</TableHead>
                    <TableHead>Proof of Funds</TableHead>
                    <TableHead>Lock-out</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {getInvestorName(reservation.investor)}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {reservation.investor.user.email}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/dashboard/deals/${reservation.deal.id}`}
                          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                        >
                          <LinkIcon className="h-3 w-3" />
                          {reservation.deal.address}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          £{Number(reservation.deal.askingPrice).toLocaleString()}
                        </div>
                      </TableCell>
                      <TableCell>
                        £{Number(reservation.reservationFee).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            statusColors[reservation.status] || "bg-gray-100 text-gray-800"
                          }
                        >
                          {statusLabels[reservation.status] || reservation.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {reservation.feePaid ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">
                              {reservation.feePaidAt
                                ? format(new Date(reservation.feePaidAt), "MMM d")
                                : "Yes"}
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-4 w-4" />
                            <span className="text-xs">No</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reservation.proofOfFundsVerified ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Verified</span>
                          </div>
                        ) : reservation.proofOfFundsProvided ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">Pending</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs">Not provided</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reservation.lockOutAgreementSigned ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            <span className="text-xs">Signed</span>
                          </div>
                        ) : reservation.lockOutAgreementSent ? (
                          <div className="flex items-center gap-1 text-blue-600">
                            <FileText className="h-4 w-4" />
                            <span className="text-xs">Sent</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            <span className="text-xs">Not sent</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(reservation.createdAt), "MMM d, yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

