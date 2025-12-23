"use client"

import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle, FileText, Upload } from "lucide-react"
import { z } from "zod"

const reservationSchema = z.object({
  reservationFee: z.number().positive("Reservation fee must be positive"),
  feePaid: z.boolean().optional(),
  feePaymentId: z.string().optional(),
  proofOfFundsProvided: z.boolean().optional(),
  proofOfFundsVerified: z.boolean().optional(),
  solicitorName: z.string().optional(),
  solicitorEmail: z.string().email().optional().or(z.literal("")),
  solicitorPhone: z.string().optional(),
  solicitorFirm: z.string().optional(),
  lockOutAgreementSent: z.boolean().optional(),
  lockOutAgreementSigned: z.boolean().optional(),
  status: z.enum(["pending", "fee_pending", "proof_of_funds_pending", "verified", "locked_out", "completed", "cancelled"]).optional(),
  notes: z.string().optional(),
})

type ReservationFormData = z.infer<typeof reservationSchema>

interface Investor {
  id: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

interface Reservation {
  id: string
  reservationFee: number
  feePaid: boolean
  feePaymentId: string | null
  proofOfFundsProvided: boolean
  proofOfFundsDocumentS3Key: string | null
  proofOfFundsVerified: boolean
  proofOfFundsVerifiedAt: string | null
  solicitorName: string | null
  solicitorEmail: string | null
  solicitorPhone: string | null
  solicitorFirm: string | null
  lockOutAgreementSent: boolean
  lockOutAgreementSigned: boolean
  status: string
  notes: string | null
}

interface ReservationFormProps {
  reservation?: Reservation
  dealId: string
  investorId?: string
  onSuccess: () => void
  onCancel: () => void
}

export function ReservationForm({
  reservation,
  dealId,
  investorId,
  onSuccess,
  onCancel,
}: ReservationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [investors, setInvestors] = useState<Investor[]>([])
  const [selectedInvestorId, setSelectedInvestorId] = useState<string>(investorId || "")

  const isEditMode = !!reservation

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<ReservationFormData>({
    resolver: zodResolver(reservationSchema),
    defaultValues: reservation
      ? {
          reservationFee: Number(reservation.reservationFee),
          feePaid: reservation.feePaid,
          feePaymentId: reservation.feePaymentId || "",
          proofOfFundsProvided: reservation.proofOfFundsProvided,
          proofOfFundsVerified: reservation.proofOfFundsVerified,
          solicitorName: reservation.solicitorName || "",
          solicitorEmail: reservation.solicitorEmail || "",
          solicitorPhone: reservation.solicitorPhone || "",
          solicitorFirm: reservation.solicitorFirm || "",
          lockOutAgreementSent: reservation.lockOutAgreementSent,
          lockOutAgreementSigned: reservation.lockOutAgreementSigned,
          status: reservation.status as any,
          notes: reservation.notes || "",
        }
      : {
          reservationFee: 1000,
          status: "pending",
        },
  })

  useEffect(() => {
    // Fetch investors for dropdown
    fetch("/api/investors")
      .then((res) => res.json())
      .then((investorsData) => {
        const investorsWithUsers = investorsData.map((inv: any) => ({
          id: inv.id,
          user: inv.user,
        }))
        setInvestors(investorsWithUsers)
      })
      .catch(console.error)
  }, [])

  const status = watch("status")
  const feePaid = watch("feePaid")
  const proofOfFundsVerified = watch("proofOfFundsVerified")
  const lockOutAgreementSigned = watch("lockOutAgreementSigned")

  const onSubmit = async (data: ReservationFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditMode) {
        // Update existing reservation
        const response = await fetch(`/api/reservations/${reservation.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            solicitorEmail: data.solicitorEmail || undefined,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to update reservation")
        }
      } else {
        // Create new reservation
        if (!selectedInvestorId) {
          throw new Error("Please select an investor")
        }

        const response = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            investorId: selectedInvestorId,
            dealId,
            reservationFee: data.reservationFee,
            notes: data.notes,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to create reservation")
        }
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Investor Selection (only for new reservations) */}
      {!isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Investor</CardTitle>
            <CardDescription>Select the investor making this reservation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="investorId">Investor *</Label>
              <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId}>
                <SelectTrigger id="investorId">
                  <SelectValue placeholder="Select investor" />
                </SelectTrigger>
                <SelectContent>
                  {investors.map((investor) => {
                    const name = [investor.user.firstName, investor.user.lastName]
                      .filter(Boolean)
                      .join(" ") || investor.user.email
                    return (
                      <SelectItem key={investor.id} value={investor.id}>
                        {name} ({investor.user.email})
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {!selectedInvestorId && (
                <p className="text-sm text-destructive">Please select an investor</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservation Details */}
      <Card>
        <CardHeader>
          <CardTitle>Reservation Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reservationFee">Reservation Fee (£) *</Label>
              <Input
                id="reservationFee"
                type="number"
                step="0.01"
                {...register("reservationFee", { valueAsNumber: true })}
                required
              />
              {errors.reservationFee && (
                <p className="text-sm text-destructive">{errors.reservationFee.message}</p>
              )}
            </div>
            {isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={status} onValueChange={(value) => setValue("status", value as any)}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="fee_pending">Fee Pending</SelectItem>
                    <SelectItem value="proof_of_funds_pending">Proof of Funds Pending</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="locked_out">Locked Out</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {isEditMode && (
            <>
              <div className="space-y-2">
                <Label htmlFor="feePaymentId">Payment ID (Stripe)</Label>
                <Input
                  id="feePaymentId"
                  {...register("feePaymentId")}
                  placeholder="pi_..."
                />
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="feePaid"
                    {...register("feePaid")}
                    checked={feePaid}
                  />
                  <Label htmlFor="feePaid">Fee Paid</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="proofOfFundsProvided"
                    {...register("proofOfFundsProvided")}
                  />
                  <Label htmlFor="proofOfFundsProvided">Proof of Funds Provided</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="proofOfFundsVerified"
                    {...register("proofOfFundsVerified")}
                    checked={proofOfFundsVerified}
                  />
                  <Label htmlFor="proofOfFundsVerified">Proof of Funds Verified</Label>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Legal Details */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Details</CardTitle>
            <CardDescription>Solicitor information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="solicitorName">Solicitor Name</Label>
              <Input
                id="solicitorName"
                {...register("solicitorName")}
                placeholder="Solicitor Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="solicitorEmail">Solicitor Email</Label>
                <Input
                  id="solicitorEmail"
                  type="email"
                  {...register("solicitorEmail")}
                  placeholder="solicitor@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="solicitorPhone">Solicitor Phone</Label>
                <Input
                  id="solicitorPhone"
                  {...register("solicitorPhone")}
                  placeholder="+44 123 456 7890"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="solicitorFirm">Solicitor Firm</Label>
              <Input
                id="solicitorFirm"
                {...register("solicitorFirm")}
                placeholder="Law Firm Name"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lock-out Agreement */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Lock-out Agreement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="lockOutAgreementSent"
                  {...register("lockOutAgreementSent")}
                />
                <Label htmlFor="lockOutAgreementSent">Agreement Sent</Label>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="lockOutAgreementSigned"
                  {...register("lockOutAgreementSigned")}
                  checked={lockOutAgreementSigned}
                />
                <Label htmlFor="lockOutAgreementSigned">Agreement Signed</Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Any additional information about this reservation..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || (!isEditMode && !selectedInvestorId)}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Update Reservation" : "Create Reservation"}
        </Button>
      </div>
    </form>
  )
}

