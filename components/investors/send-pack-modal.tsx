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
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Loader2, FileText, Info, User, CheckCircle, XCircle, AlertTriangle, Download, RefreshCw, Mail } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface SendPackModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  investorId?: string
  investorName?: string
  onSuccess?: () => void
}

interface Deal {
  id: string
  address: string
  askingPrice: number
  status: string
  investorPackSent: boolean
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  review: "In Review",
  in_progress: "In Progress",
  ready: "Ready",
  listed: "Listed",
  reserved: "Reserved",
}

interface Investor {
  id: string
  user: {
    firstName: string | null
    lastName: string | null
    email: string
  }
}

interface DeliveryRecord {
  id: string
  dealId: string
  deal: { address: string; askingPrice: number }
  investor: { user: { firstName: string | null; lastName: string | null; email: string } }
  partNumber: number | null
  recipientEmail: string | null
  emailStatus: string | null
  emailError: string | null
  sentAt: string
  deliveryMethod: string
  downloadToken?: string | null
}

const PART_OPTIONS = [
  { value: 0, label: 'Complete Pack (Single Template)', description: 'Send the full investor pack' },
  { value: 1, label: 'Part 1: Company Executive Summary', description: '1 page - Pique interest, no asking for money' },
  { value: 2, label: 'Part 2: Company Profile', description: '3-5 pages - Show credibility and professionalism' },
  { value: 3, label: 'Part 3: Case Studies', description: 'Build authority with track record' },
  { value: 4, label: 'Part 4: Investment Offering', description: '8-15 pages - HNWI/SI only (FCA compliance required)' },
]

function EmailStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") {
    return <Badge variant="outline" className="text-xs gap-1"><Mail className="h-3 w-3" />Pending</Badge>
  }
  if (status === "sent") {
    return <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300 bg-green-50"><CheckCircle className="h-3 w-3" />Email Sent</Badge>
  }
  if (status === "failed") {
    return <Badge variant="outline" className="text-xs gap-1 text-red-700 border-red-300 bg-red-50"><XCircle className="h-3 w-3" />Email Failed</Badge>
  }
  if (status === "no_smtp") {
    return <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-300 bg-amber-50"><AlertTriangle className="h-3 w-3" />SMTP Not Configured</Badge>
  }
  if (status === "not_applicable") {
    return <Badge variant="outline" className="text-xs gap-1 text-gray-500">Manual Delivery</Badge>
  }
  return null
}

export function SendPackModal({
  open,
  onOpenChange,
  investorId: initialInvestorId,
  investorName: initialInvestorName,
  onSuccess,
}: SendPackModalProps) {
  const [loading, setLoading] = useState(false)
  const [loadingDeals, setLoadingDeals] = useState(false)
  const [loadingInvestors, setLoadingInvestors] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [deals, setDeals] = useState<Deal[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [selectedDealId, setSelectedDealId] = useState("")
  const [selectedInvestorId, setSelectedInvestorId] = useState(initialInvestorId || "")
  const [selectedPart, setSelectedPart] = useState<number>(0)
  const [notes, setNotes] = useState("")
  const [lastDelivery, setLastDelivery] = useState<DeliveryRecord | null>(null)
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryRecord[]>([])
  const [resendingId, setResendingId] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedInvestorId(initialInvestorId || "")
      setSelectedDealId("")
      fetchDeals()
      if (!initialInvestorId) {
        fetchInvestors()
      }
    } else {
      // Reset on close
      setLastDelivery(null)
      setDeliveryHistory([])
    }
  }, [open])

  useEffect(() => {
    if (selectedDealId && selectedInvestorId) {
      fetchDeliveryHistory()
    }
  }, [selectedDealId, selectedInvestorId])

  const fetchDeals = async () => {
    setLoadingDeals(true)
    try {
      if (initialInvestorId) {
        // Only show deals this investor has an active reservation on
        const response = await fetch(`/api/investors/reservations?investorId=${initialInvestorId}`)
        if (response.ok) {
          const data = await response.json()
          const reservedDeals = (data.reservations || [])
            .filter((r: any) => r.status !== "cancelled")
            .map((r: any) => ({
              id: r.dealId,
              address: r.deal.address,
              askingPrice: r.deal.askingPrice,
              status: r.deal.status,
              investorPackSent: false,
            }))
          setDeals(reservedDeals)
        } else {
          toast.error("Failed to load reserved deals.")
        }
      } else {
        const response = await fetch("/api/deals")
        if (response.ok) {
          const data = await response.json()
          const availableDeals = (data.deals || []).filter(
            (deal: any) => deal.status !== "archived" && deal.status !== "sold"
          )
          setDeals(availableDeals)
        } else {
          toast.error("Failed to load deals. Please check your permissions.")
        }
      }
    } catch (error) {
      console.error("Error fetching deals:", error)
      toast.error("Error loading deals. Please try again.")
    } finally {
      setLoadingDeals(false)
    }
  }

  const fetchInvestors = async () => {
    setLoadingInvestors(true)
    try {
      const response = await fetch("/api/investors")
      if (response.ok) {
        const data = await response.json()
        setInvestors(data.investors || [])
      } else {
        toast.error("Failed to load investors. Please check your permissions.")
      }
    } catch (error) {
      console.error("Error fetching investors:", error)
      toast.error("Error loading investors. Please try again.")
    } finally {
      setLoadingInvestors(false)
    }
  }

  const fetchDeliveryHistory = async () => {
    setLoadingHistory(true)
    try {
      const response = await fetch(
        `/api/investors/pack-delivery?investorId=${selectedInvestorId}&dealId=${selectedDealId}`
      )
      if (response.ok) {
        const data = await response.json()
        setDeliveryHistory(data.deliveries || [])
      }
    } catch (error) {
      console.error("Error fetching delivery history:", error)
    } finally {
      setLoadingHistory(false)
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

    setLoading(true)

    try {
      const response = await fetch("/api/investors/pack-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          investorId: selectedInvestorId,
          dealId: selectedDealId,
          partNumber: selectedPart === 0 ? null : selectedPart,
          notes,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send pack")
      }

      const data = await response.json()
      const emailStatus: string = data.emailStatus || "pending"

      // Show delivery result
      setLastDelivery({
        ...data.delivery,
        emailStatus,
        deal: deals.find(d => d.id === selectedDealId) as any,
        investor: investors.find(i => i.id === selectedInvestorId) as any,
      })

      // Refresh history
      await fetchDeliveryHistory()

      const partLabel = selectedPart === 0 ? "Complete investor pack" : `Part ${selectedPart}`
      const investorDisplay =
        initialInvestorName ||
        (() => {
          const inv = investors.find(i => i.id === selectedInvestorId)
          return inv ? `${inv.user.firstName} ${inv.user.lastName}`.trim() : "investor"
        })()

      if (emailStatus === "sent") {
        toast.success(`${partLabel} sent to ${investorDisplay} — email delivered`)
      } else if (emailStatus === "no_smtp") {
        toast.warning(`Pack recorded for ${investorDisplay} — email not sent (SMTP not configured)`)
      } else if (emailStatus === "failed") {
        toast.error(`Pack recorded but email failed. Use the Resend button below.`)
      } else {
        toast.success(`${partLabel} sent to ${investorDisplay}`)
      }

      setNotes("")
      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error("Error sending pack:", error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async (deliveryId: string) => {
    setResendingId(deliveryId)
    try {
      const response = await fetch(`/api/investors/pack-delivery/${deliveryId}/resend`, {
        method: "POST",
      })
      const data = await response.json()

      if (data.success) {
        toast.success("Email resent successfully")
      } else if (data.noSmtp) {
        toast.warning("Cannot resend: SMTP email is not configured. Contact your administrator.")
      } else {
        toast.error(`Resend failed: ${data.error || "Unknown error"}`)
      }

      // Refresh history to show updated status
      await fetchDeliveryHistory()
    } catch (error: any) {
      toast.error("Failed to resend email")
    } finally {
      setResendingId(null)
    }
  }

  const handleViewPdf = (dealId: string, deliveryId: string, downloadToken?: string | null) => {
    // Track the view
    fetch(`/api/investors/pack-delivery/${deliveryId}/track`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "view" }),
    }).catch(() => {})

    // Use token URL if available (allows download without login session)
    const url = downloadToken
      ? `/api/deals/${dealId}/investor-pack?token=${downloadToken}`
      : `/api/deals/${dealId}/investor-pack`
    window.open(url, "_blank")
  }

  const selectedDeal = deals.find((d) => d.id === selectedDealId)
  const selectedInvestor = investors.find((i) => i.id === selectedInvestorId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Investor Pack</DialogTitle>
          <DialogDescription>
            {initialInvestorName
              ? `Send an investor pack to ${initialInvestorName}`
              : "Select investor and deal to send pack"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Investor Selection */}
          <div className="space-y-2">
            <Label>
              <User className="h-4 w-4 inline mr-2" />
              Investor *
            </Label>
            {initialInvestorId ? (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2.5">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-sm font-medium">{initialInvestorName || "Selected Investor"}</span>
              </div>
            ) : (
              <>
                <Select value={selectedInvestorId} onValueChange={setSelectedInvestorId} disabled={loadingInvestors}>
                  <SelectTrigger>
                    <SelectValue placeholder={loadingInvestors ? "Loading investors..." : "Choose an investor"} />
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
                    Email: {selectedInvestor.user.email}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal">
              <FileText className="h-4 w-4 inline mr-2" />
              {initialInvestorId ? "Reserved Deal *" : "Select Deal *"}
            </Label>
            <Select value={selectedDealId} onValueChange={setSelectedDealId} disabled={loadingDeals}>
              <SelectTrigger>
                <SelectValue placeholder={loadingDeals ? "Loading deals..." : "Choose a deal"} />
              </SelectTrigger>
              <SelectContent>
                {loadingDeals ? (
                  <div className="p-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading deals...
                  </div>
                ) : deals.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">
                    {initialInvestorId ? "No reserved deals found." : "No deals available."}
                  </div>
                ) : (
                  deals.map((deal) => (
                    <SelectItem suppressHydrationWarning key={deal.id} value={deal.id}>
                      <span>{deal.address}</span>
                      <span className="ml-1 text-muted-foreground">
                        · £{deal.askingPrice?.toLocaleString() ?? "—"}
                        {deal.status && deal.status !== "ready" && deal.status !== "listed"
                          ? ` · ${STATUS_LABELS[deal.status] ?? deal.status}`
                          : ""}
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedDeal && (
              <p suppressHydrationWarning className="text-sm text-muted-foreground">
                Price: £{selectedDeal.askingPrice.toLocaleString()}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="part">
              <FileText className="h-4 w-4 inline mr-2" />
              Select Part *
            </Label>
            <Select value={selectedPart.toString()} onValueChange={(v) => setSelectedPart(Number(v))}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PART_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPart === 4 && (
            <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-900 dark:text-amber-200">
                <strong>FCA Compliance:</strong> Part 4 is a financial promotion. Ensure the investor is certified as HNWI or Sophisticated before sending.
              </AlertDescription>
            </Alert>
          )}

          {selectedPart === 1 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Remember:</strong> After sending Part 1, PAUSE and wait for their response. Schedule an intro call if they reply.
              </AlertDescription>
            </Alert>
          )}

          {selectedPart === 3 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <strong>Remember:</strong> After Part 3, STOP and qualify the investor (HNWI/Sophisticated) before sending Part 4.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about this pack delivery..."
              rows={3}
            />
          </div>

          {/* Last delivery result */}
          {lastDelivery && (
            <div className="rounded-lg border p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Last delivery</p>
                <EmailStatusBadge status={lastDelivery.emailStatus} />
              </div>
              {(lastDelivery.emailStatus === "failed" || lastDelivery.emailStatus === "no_smtp") && lastDelivery.emailError && (
                <p className="text-xs text-muted-foreground">{lastDelivery.emailError}</p>
              )}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => handleViewPdf(selectedDealId, lastDelivery.id, (lastDelivery as any).downloadToken)}
                >
                  <Download className="h-3 w-3 mr-1" />
                  View / Download PDF
                </Button>
                {(lastDelivery.emailStatus === "failed" || lastDelivery.emailStatus === "no_smtp" || lastDelivery.emailStatus === "pending") && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => handleResend(lastDelivery.id)}
                    disabled={resendingId === lastDelivery.id}
                  >
                    {resendingId === lastDelivery.id ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3 mr-1" />
                    )}
                    Resend Email
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Delivery history */}
          {selectedDealId && selectedInvestorId && deliveryHistory.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Delivery History</p>
                {loadingHistory ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Loading history...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {deliveryHistory.slice(0, 5).map((record) => (
                      <div key={record.id} className="rounded-md border p-2 bg-background space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs text-muted-foreground">
                            {record.partNumber ? `Part ${record.partNumber}` : "Complete Pack"} •{" "}
                            {format(new Date(record.sentAt), "dd MMM yyyy HH:mm")}
                          </span>
                          <EmailStatusBadge status={record.emailStatus} />
                        </div>
                        {record.emailError && (
                          <p className="text-xs text-red-600">{record.emailError}</p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => handleViewPdf(record.dealId, record.id, (record as any).downloadToken)}
                          >
                            <Download className="h-3 w-3 mr-1" />
                            View PDF
                          </Button>
                          {(record.emailStatus === "failed" ||
                            record.emailStatus === "no_smtp" ||
                            record.emailStatus === "pending") && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs px-2"
                              onClick={() => handleResend(record.id)}
                              disabled={resendingId === record.id}
                            >
                              {resendingId === record.id ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3 w-3 mr-1" />
                              )}
                              Resend
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !selectedDealId || !selectedInvestorId}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send Pack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
