"use client"

import { useState, useEffect, useRef } from "react"
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
  Search,
  X,
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
  isReserved?: boolean
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

  // Solicitor search
  const [solicitorSearch, setSolicitorSearch] = useState("")
  const [solicitorResults, setSolicitorResults] = useState<Array<{ id: string; fullName: string; company: string | null; email: string | null; phone: string | null; mobilePhone: string | null }>>([])
  const [searchingContacts, setSearchingContacts] = useState(false)
  const [showSolicitorDropdown, setShowSolicitorDropdown] = useState(false)
  const solicitorSearchRef = useRef<HTMLDivElement>(null)

  // Status management (for editing)
  const [status, setStatus] = useState("pending")
  const [feePaid, setFeePaid] = useState(false)
  const [proofOfFundsProvided, setProofOfFundsProvided] = useState(false)
  const [proofOfFundsVerified, setProofOfFundsVerified] = useState(false)
  const [lockOutAgreementSent, setLockOutAgreementSent] = useState(false)
  const [lockOutAgreementSigned, setLockOutAgreementSigned] = useState(false)

  useEffect(() => {
    if (open) {
      // Re-sync pre-selected IDs each time the modal opens (props may have changed since mount)
      setSelectedInvestorId(initialInvestorId || "")
      setSelectedDealId(initialDealId || "")

      // Always fetch both investors and deals when modal opens
      fetchInvestors()
      fetchDeals()

      if (reservationId) {
        fetchReservation()
      }
    }
  }, [open, reservationId, initialInvestorId, initialDealId])

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
      const response = await fetch("/api/deals?forReservation=true")
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

  // Close solicitor dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (solicitorSearchRef.current && !solicitorSearchRef.current.contains(e.target as Node)) {
        setShowSolicitorDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Search solicitor contacts with debounce
  useEffect(() => {
    if (!solicitorSearch.trim()) {
      setSolicitorResults([])
      setShowSolicitorDropdown(false)
      return
    }
    const timeout = setTimeout(async () => {
      setSearchingContacts(true)
      try {
        const res = await fetch(`/api/contacts?type=SOLICITOR&search=${encodeURIComponent(solicitorSearch)}&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setSolicitorResults(data.contacts ?? [])
          setShowSolicitorDropdown(true)
        }
      } catch {
        // silently ignore search errors
      } finally {
        setSearchingContacts(false)
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [solicitorSearch])

  const applySolicitorContact = (contact: { fullName: string; company: string | null; email: string | null; phone: string | null; mobilePhone: string | null }) => {
    setSolicitorName(contact.fullName)
    setSolicitorFirm(contact.company ?? "")
    setSolicitorEmail(contact.email ?? "")
    setSolicitorPhone(contact.phone ?? contact.mobilePhone ?? "")
    setSolicitorSearch("")
    setSolicitorResults([])
    setShowSolicitorDropdown(false)
  }

  const clearSolicitorFields = () => {
    setSolicitorName("")
    setSolicitorFirm("")
    setSolicitorEmail("")
    setSolicitorPhone("")
    setSolicitorSearch("")
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
                      <div className="p-2 text-sm text-gray-400 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading deals...
                      </div>
                    ) : deals.length === 0 ? (
                      <div className="p-2 text-sm text-gray-400">
                        No deals available
                      </div>
                    ) : (
                      deals.map((deal) => (
                        <SelectItem
                          suppressHydrationWarning
                          key={deal.id}
                          value={deal.id}
                          disabled={!!deal.isReserved}
                        >
                          {deal.address} - £{deal.askingPrice.toLocaleString()}
                          {deal.isReserved && (
                            <span className="ml-2 text-xs text-gray-400">(Reserved)</span>
                          )}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedDeal && (
                  <p suppressHydrationWarning className="text-sm text-gray-400">
                    Price: £{selectedDeal.askingPrice.toLocaleString()}
                  </p>
                )}
              </div>

              {/* Investor Selection — read-only when pre-selected from investor row */}
              <div className="space-y-2">
                <Label htmlFor="investor">
                  <User className="h-4 w-4 inline mr-2" />
                  Investor *
                </Label>
                {initialInvestorId ? (
                  <div className="flex items-center gap-2 rounded-md border border-[var(--ds-border)] bg-gray-100 px-3 py-2.5">
                    <User className="h-4 w-4 shrink-0 text-gray-400" />
                    {loadingInvestors ? (
                      <span className="flex items-center gap-1.5 text-sm text-gray-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Loading…
                      </span>
                    ) : selectedInvestor ? (
                      <span className="text-sm">
                        <span className="font-medium">
                          {selectedInvestor.user.firstName} {selectedInvestor.user.lastName}
                        </span>
                        <span className="ml-2 text-gray-400 text-xs">
                          {selectedInvestor.user.email}
                        </span>
                      </span>
                    ) : (
                      <span className="text-sm text-gray-400">Investor not found</span>
                    )}
                  </div>
                ) : (
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
                        <div className="p-2 text-sm text-gray-400 flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading investors...
                        </div>
                      ) : investors.length === 0 ? (
                        <div className="p-2 text-sm text-gray-400">
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
                )}
                {selectedInvestor && (
                  <p className="text-sm text-gray-400">
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
              {/* Solicitor search from Contacts registry */}
              <div className="space-y-2" ref={solicitorSearchRef}>
                <Label>
                  <Search className="h-4 w-4 inline mr-2" />
                  Search Contacts
                </Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    value={solicitorSearch}
                    onChange={(e) => setSolicitorSearch(e.target.value)}
                    placeholder="Type to search solicitors (e.g. TMI)…"
                    className="pl-8"
                    onFocus={() => solicitorResults.length > 0 && setShowSolicitorDropdown(true)}
                  />
                  {searchingContacts && (
                    <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {showSolicitorDropdown && solicitorResults.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--ds-border)] bg-white shadow-md">
                      {solicitorResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          className="flex w-full flex-col gap-0.5 px-3 py-2 text-left text-sm hover:bg-gray-50 focus:bg-accent focus:outline-none"
                          onClick={() => applySolicitorContact(c)}
                        >
                          <span className="font-medium">{c.fullName}</span>
                          {c.company && <span className="text-xs text-gray-400">{c.company}</span>}
                          {c.email && <span className="text-xs text-gray-400">{c.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {showSolicitorDropdown && solicitorResults.length === 0 && !searchingContacts && solicitorSearch.trim() && (
                    <div className="absolute z-50 mt-1 w-full rounded-md border border-[var(--ds-border)] bg-white px-3 py-2 text-sm text-gray-400 shadow-md">
                      No solicitor contacts found for "{solicitorSearch}"
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-400">Select a contact to auto-fill the fields below, or fill them in manually.</p>
              </div>

              <div className="border-t border-[var(--ds-border)]" />

              {/* Manual fields — pre-filled when a contact is selected */}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Solicitor Details</span>
                {(solicitorName || solicitorFirm || solicitorEmail || solicitorPhone) && (
                  <button type="button" onClick={clearSolicitorFields} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
                    <X className="h-3 w-3" />Clear
                  </button>
                )}
              </div>

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
                      <SelectItem value="pack_sent">Pack Sent</SelectItem>
                      <SelectItem value="fee_pending">Fee Requested</SelectItem>
                      <SelectItem value="fee_paid">Fee Paid</SelectItem>
                      <SelectItem value="proof_of_funds_pending">POF Requested</SelectItem>
                      <SelectItem value="pof_received">POF Received</SelectItem>
                      <SelectItem value="lock_out_sent">Lock-out Sent</SelectItem>
                      <SelectItem value="locked_out">Lock-out Signed</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="border-t border-[var(--ds-border)]" />

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
                      onCheckedChange={(checked) => {
                        const val = checked as boolean
                        setProofOfFundsProvided(val)
                        setProofOfFundsVerified(val)
                      }}
                    />
                    <Label htmlFor="proofOfFundsProvided" className="cursor-pointer">
                      <FileText className="h-4 w-4 inline mr-2 text-blue-600" />
                      Proof of Funds Received
                    </Label>
                  </div>

                  <div className="border-t border-[var(--ds-border)]" />

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
