"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, Edit, Trash2, CheckCircle2, XCircle, FileText, Clock } from "lucide-react"
import { ReservationForm } from "./reservation-form"
import { format } from "date-fns"

interface Investor {
  id: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
  }
}

interface Deal {
  id: string
  address: string
  askingPrice: number
  status: string
}

interface Reservation {
  id: string
  investor: Investor
  deal: Deal
  reservationFee: number
  feePaid: boolean
  feePaymentId: string | null
  feePaidAt: string | null
  proofOfFundsProvided: boolean
  proofOfFundsDocumentS3Key: string | null
  proofOfFundsVerified: boolean
  proofOfFundsVerifiedAt: string | null
  proofOfFundsVerifiedBy: string | null
  solicitorName: string | null
  solicitorEmail: string | null
  solicitorPhone: string | null
  solicitorFirm: string | null
  lockOutAgreementSent: boolean
  lockOutAgreementSentAt: string | null
  lockOutAgreementSigned: boolean
  lockOutAgreementSignedAt: string | null
  lockOutAgreementDocumentS3Key: string | null
  status: string
  notes: string | null
  createdAt: string
  updatedAt: string
  completedAt: string | null
}

interface ReservationListProps {
  dealId: string
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

export function ReservationList({ dealId, initialReservations = [] }: ReservationListProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [isLoading, setIsLoading] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null)

  const fetchReservations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/reservations?dealId=${dealId}`)
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
  }, [dealId])

  const handleCreate = () => {
    setEditingReservation(null)
    setIsFormOpen(true)
  }

  const handleEdit = (reservation: Reservation) => {
    setEditingReservation(reservation)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this reservation?")) {
      return
    }

    try {
      const response = await fetch(`/api/reservations/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchReservations()
      } else {
        alert("Failed to delete reservation")
      }
    } catch (error) {
      console.error("Error deleting reservation:", error)
      alert("Failed to delete reservation")
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingReservation(null)
    fetchReservations()
  }

  const getInvestorName = (investor: Investor) => {
    const name = [investor.user.firstName, investor.user.lastName]
      .filter(Boolean)
      .join(" ")
    return name || investor.user.email
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Investor Reservations</CardTitle>
            <CardDescription>
              Manage reservations and track proof of funds
            </CardDescription>
          </div>
          <Button onClick={handleCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Reservation
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : reservations.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No reservations yet</p>
            <Button onClick={handleCreate} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Create First Reservation
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Fee Paid</TableHead>
                  <TableHead>Proof of Funds</TableHead>
                  <TableHead>Lock-out</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reservations.map((reservation) => (
                  <TableRow key={reservation.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getInvestorName(reservation.investor)}</div>
                        <div className="text-sm text-muted-foreground">
                          {reservation.investor.user.email}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      £{Number(reservation.reservationFee).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={statusColors[reservation.status] || "bg-gray-100 text-gray-800"}
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
                              ? format(new Date(reservation.feePaidAt), "MMM d, yyyy")
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(reservation)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(reservation.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingReservation ? "Edit Reservation" : "New Reservation"}
            </DialogTitle>
            <DialogDescription>
              {editingReservation
                ? "Update reservation details and status"
                : "Create a new investor reservation for this deal"}
            </DialogDescription>
          </DialogHeader>
          <ReservationForm
            reservation={editingReservation || undefined}
            dealId={dealId}
            onSuccess={handleFormSuccess}
            onCancel={() => {
              setIsFormOpen(false)
              setEditingReservation(null)
            }}
          />
        </DialogContent>
      </Dialog>
    </Card>
  )
}

