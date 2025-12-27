"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle,
  XCircle,
  FileText,
  Upload,
  DollarSign,
  User,
  Building,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

interface ReservationModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dealId?: string // Optional now - can be selected in modal
  dealAddress?: string
  investorId?: string // Optional now - can be selected in modal
  reservationId?: string // For editing existing reservation
  onSuccess?: () => void
}

interface Investor {
  id: string
  user: {
    firstName: string | null
    lastName: string | null
    email: string
    phone: string | null
  }
}

interface Deal {
  id: string
  address: string
  askingPrice: number
}

export function ReservationModal({
  open,
  onOpenChange,
  dealId: initialDealId,
  dealAddress,
  investorId: initialInvestorId,
  reservationId,
  onSuccess,
}: ReservationModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingInvestors, setLoadingInvestors] = useState(false)
  const [loadingDeals, setLoadingDeals] = useState(false)
  const [investors, setInvestors] = useState<Investor[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [selectedInvestorId, setSelectedInvestorId] = useState(initialInvestorId || "")
  const [selectedDealId, setSelectedDealId] = useState(initialDealId || "")
  const [reservationFee, setReservationFee] = useState("5000")
  const [solicitorName, setSolicitorName] = useState("")
  const [solicitorEmail, setSolicitorEmail] = useState("")
  const [solicitorPhone, setSolicitorPhone] = useState("")
  const [solicitorFirm, setSolicitorFirm] = useState("")
  const [notes, setNotes] = useState("")

  // Status management (for editing)
  const [status, setStatus] = useState("pending")
  const [feePaid, setFeePaid] = useState(false)
  const [proofOfFundsProvided, setProofOfFundsProvided] = useState(false)
  const [proofOfFundsVerified, setProofOfFundsVerified] = useState(false)
  const [lockOutAgreementSent, setLockOutAgreementSent] = useState(false)
  const [lockOutAgreementSigned, setLockOutAgreementSigned] = useState(false)

  useEffect(() => {
    if (open) {
      // Always fetch both investors and deals when modal opens
      fetchInvestors()
      fetchDeals()

      if (reservationId) {
        fetchReservation()
      }
    }
  }, [open, reservationId])

  const fetchInvestors = async () => {
    setLoadingInvestors(true)
    try {
      const response = await fetch("/api/investors")
      if (response.ok) {
        const data = await response.json()
        setInvestors(data.investors || [])
      } else {
        console.error("Failed to fetch investors:", response.status)
        toast.error("Failed to load investors. Please check your permissions.")
      }
    } catch (error) {
      console.error("Error fetching investors:", error)
      toast.error("Error loading investors. Please try again.")
    } finally {
      setLoadingInvestors(false)
    }
  }

  const fetchDeals = async () => {
    setLoadingDeals(true)
    try {
      const response = await fetch("/api/deals")
      if (response.ok) {
        const data = await response.json()
        setDeals(data.deals || [])
      } else {
        console.error("Failed to fetch deals:", response.status)
        toast.error("Failed to load deals. Please check your permissions.")
      }
    } catch (error) {
      console.error("Error fetching deals:", error)
      toast.error("Error loading deals. Please try again.")
    } finally {
      setLoadingDeals(false)
    }
  }

  const fetchReservation = async () => {
    if (!reservationId) return

    try {
      const response = await fetch(`/api/investors/reservations?dealId=${selectedDealId || initialDealId}`)
      if (response.ok) {
        const data = await response.json()
        const reservation = data.reservations.find((r: any) => r.id === reservationId)
        if (reservation) {
          setSelectedInvestorId(reservation.investorId)
          setSelectedDealId(reservation.dealId)
          setReservationFee(reservation.reservationFee.toString())
          setSolicitorName(reservation.solicitorName || "")
          setSolicitorEmail(reservation.solicitorEmail || "")
          setSolicitorPhone(reservation.solicitorPhone || "")
          setSolicitorFirm(reservation.solicitorFirm || "")
          setNotes(reservation.notes || "")
          setStatus(reservation.status)
          setFeePaid(reservation.feePaid)
          setProofOfFundsProvided(reservation.proofOfFundsProvided)
          setProofOfFundsVerified(reservation.proofOfFundsVerified)
          setLockOutAgreementSent(reservation.lockOutAgreementSent)
          setLockOutAgreementSigned(reservation.lockOutAgreementSigned)
        }
      }
    } catch (error) {
      console.error("Error fetching reservation:", error)
    }
  }

  const handleSubmit = async () => {
    if (!selectedInvestorId) {
      toast.error("Please select an investor")
      return
    }

    if (!selectedDealId) {
      toast.error("Please select a deal")
      return
    }

    if (!reservationFee || Number(reservationFee) <= 0) {
      toast.error("Please enter a valid reservation fee")
      return
    }

    setLoading(true)

    try {
      const url = reservationId
        ? `/api/investors/reservations/${reservationId}`
        : "/api/investors/reservations"

      const method = reservationId ? "PATCH" : "POST"

      const body: any = {
        investorId: selectedInvestorId,
        dealId: selectedDealId,
        reservationFee: Number(reservationFee),
        solicitorName,
        solicitorEmail,
        solicitorPhone,
        solicitorFirm,
        notes,
      }

      if (reservationId) {
        body.status = status
        body.feePaid = feePaid
        body.proofOfFundsProvided = proofOfFundsProvided
        body.proofOfFundsVerified = proofOfFundsVerified
        body.lockOutAgreementSent = lockOutAgreementSent
        body.lockOutAgreementSigned = lockOutAgreementSigned
      }

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to save reservation")
      }

      toast.success(reservationId ? "Reservation updated successfully" : "Reservation created successfully")
      onOpenChange(false)
      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error("Error saving reservation:", error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const selectedInvestor = investors.find((i) => i.id === selectedInvestorId)
  const selectedDeal = deals.find((d) => d.id === selectedDealId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {reservationId ? "Manage Reservation" : "Create Reservation"}
          </DialogTitle>
          <DialogDescription>
            {dealAddress || "Select deal and investor to create reservation"}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="solicitor">Solicitor</TabsTrigger>
            {reservationId && <TabsTrigger value="status">Status</TabsTrigger>}
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <div className="space-y-4">
              {/* Deal Selection - always show */}
              <div className="space-y-2">
                <Label htmlFor="deal">
                  <Building className="h-4 w-4 inline mr-2" />
                  Deal *
                </Label>
                <Select
                  value={selectedDealId}
                  onValueChange={setSelectedDealId}
                  disabled={!!reservationId || loadingDeals}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingDeals ? "Loading deals..." : "Select deal"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingDeals ? (
                      <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading deals...
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No deals available
                      </div>
                    ) : (
                      deals.map((deal) => (
                        <SelectItem key={deal.id} value={deal.id}>
                          {deal.address} - £{deal.askingPrice.toLocaleString()}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedDeal && (
                  <p className="text-sm text-muted-foreground">
                    Price: £{selectedDeal.askingPrice.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Investor Selection - always show */}
              <div className="space-y-2">
                <Label htmlFor="investor">
                  <User className="h-4 w-4 inline mr-2" />
                  Investor *
                </Label>
                <Select
                  value={selectedInvestorId}
                  onValueChange={setSelectedInvestorId}
                  disabled={!!reservationId || loadingInvestors}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={loadingInvestors ? "Loading investors..." : "Select investor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {loadingInvestors ? (
                      <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading investors...
                      </div>
                    ) : investors.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground">
                        No investors available
                      </div>
                    ) : (
                      investors.map((investor) => (
                        <SelectItem key={investor.id} value={investor.id}>
                          {investor.user.firstName} {investor.user.lastName} ({investor.user.email})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedInvestor && (
                  <p className="text-sm text-muted-foreground">
                    Phone: {selectedInvestor.user.phone || "N/A"}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="reservationFee">
                  <DollarSign className="h-4 w-4 inline mr-2" />
                  Reservation Fee (£) *
                </Label>
                <Input
                  id="reservationFee"
                  type="number"
                  value={reservationFee}
                  onChange={(e) => setReservationFee(e.target.value)}
                  placeholder="5000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes about this reservation..."
                  rows={4}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="solicitor" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="solicitorName">
                  <Building className="h-4 w-4 inline mr-2" />
                  Solicitor Name
                </Label>
                <Input
                  id="solicitorName"
                  value={solicitorName}
                  onChange={(e) => setSolicitorName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="solicitorFirm">Solicitor Firm</Label>
                <Input
                  id="solicitorFirm"
                  value={solicitorFirm}
                  onChange={(e) => setSolicitorFirm(e.target.value)}
                  placeholder="Smith & Partners LLP"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="solicitorEmail">Email</Label>
                <Input
                  id="solicitorEmail"
                  type="email"
                  value={solicitorEmail}
                  onChange={(e) => setSolicitorEmail(e.target.value)}
                  placeholder="john.smith@lawfirm.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="solicitorPhone">Phone</Label>
                <Input
                  id="solicitorPhone"
                  type="tel"
                  value={solicitorPhone}
                  onChange={(e) => setSolicitorPhone(e.target.value)}
                  placeholder="+44 20 1234 5678"
                />
              </div>
            </div>
          </TabsContent>

          {reservationId && (
            <TabsContent value="status" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="status">Reservation Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
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

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="feePaid"
                      checked={feePaid}
                      onCheckedChange={(checked) => setFeePaid(checked as boolean)}
                    />
                    <Label htmlFor="feePaid" className="cursor-pointer">
                      <CheckCircle className="h-4 w-4 inline mr-2 text-green-600" />
                      Reservation Fee Paid
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="proofOfFundsProvided"
                      checked={proofOfFundsProvided}
                      onCheckedChange={(checked) => setProofOfFundsProvided(checked as boolean)}
                    />
                    <Label htmlFor="proofOfFundsProvided" className="cursor-pointer">
                      <FileText className="h-4 w-4 inline mr-2 text-blue-600" />
                      Proof of Funds Provided
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="proofOfFundsVerified"
                      checked={proofOfFundsVerified}
                      onCheckedChange={(checked) => setProofOfFundsVerified(checked as boolean)}
                      disabled={!proofOfFundsProvided}
                    />
                    <Label htmlFor="proofOfFundsVerified" className="cursor-pointer">
                      <CheckCircle className="h-4 w-4 inline mr-2 text-green-600" />
                      Proof of Funds Verified
                    </Label>
                  </div>

                  <Separator />

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lockOutAgreementSent"
                      checked={lockOutAgreementSent}
                      onCheckedChange={(checked) => setLockOutAgreementSent(checked as boolean)}
                    />
                    <Label htmlFor="lockOutAgreementSent" className="cursor-pointer">
                      <FileText className="h-4 w-4 inline mr-2 text-purple-600" />
                      Lock-out Agreement Sent
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="lockOutAgreementSigned"
                      checked={lockOutAgreementSigned}
                      onCheckedChange={(checked) => setLockOutAgreementSigned(checked as boolean)}
                      disabled={!lockOutAgreementSent}
                    />
                    <Label htmlFor="lockOutAgreementSigned" className="cursor-pointer">
                      <CheckCircle className="h-4 w-4 inline mr-2 text-green-600" />
                      Lock-out Agreement Signed
                    </Label>
                  </div>
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {reservationId ? "Update" : "Create"} Reservation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
