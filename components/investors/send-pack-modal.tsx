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
import { Loader2, FileText, Info, User } from "lucide-react"
import { toast } from "sonner"

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
  investorPackSent: boolean
}

interface Investor {
  id: string
  user: {
    firstName: string | null
    lastName: string | null
    email: string
  }
}

const PART_OPTIONS = [
  { value: 0, label: 'Complete Pack (Single Template)', description: 'Send the full investor pack' },
  { value: 1, label: 'Part 1: Company Executive Summary', description: '1 page - Pique interest, no asking for money' },
  { value: 2, label: 'Part 2: Company Profile', description: '3-5 pages - Show credibility and professionalism' },
  { value: 3, label: 'Part 3: Case Studies', description: 'Build authority with track record' },
  { value: 4, label: 'Part 4: Investment Offering', description: '8-15 pages - HNWI/SI only (FCA compliance required)' },
]

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
  const [deals, setDeals] = useState<Deal[]>([])
  const [investors, setInvestors] = useState<Investor[]>([])
  const [selectedDealId, setSelectedDealId] = useState("")
  const [selectedInvestorId, setSelectedInvestorId] = useState(initialInvestorId || "")
  const [selectedPart, setSelectedPart] = useState<number>(0)
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (open) {
      // Always fetch both investors and deals when modal opens
      fetchDeals()
      fetchInvestors()
    }
  }, [open])

  const fetchDeals = async () => {
    setLoadingDeals(true)
    try {
      // Fetch deals that are ready for investor marketing
      const response = await fetch("/api/deals")
      if (response.ok) {
        const data = await response.json()
        // Filter to show deals that can have investor packs generated
        // Show all deals except those that are archived or in very early stages
        const availableDeals = (data.deals || []).filter(
          (deal: any) =>
            deal.status !== "archived" &&
            deal.status !== "new"
        )
        setDeals(availableDeals)
      } else {
        toast.error("Failed to load deals. Please check your permissions.")
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

      const partLabel = selectedPart === 0
        ? 'Complete investor pack'
        : `Part ${selectedPart}`

      const investorName = initialInvestorName ||
        investors.find(i => i.id === selectedInvestorId)?.user.firstName + " " +
        investors.find(i => i.id === selectedInvestorId)?.user.lastName ||
        "investor"

      toast.success(`${partLabel} sent to ${investorName}`)
      onOpenChange(false)
      setSelectedDealId("")
      setSelectedInvestorId(initialInvestorId || "")
      setSelectedPart(0)
      setNotes("")
      if (onSuccess) onSuccess()
    } catch (error: any) {
      console.error("Error sending pack:", error)
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
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
          {/* Investor Selection - always show */}
          <div className="space-y-2">
            <Label htmlFor="investor">
              <User className="h-4 w-4 inline mr-2" />
              Select Investor *
            </Label>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="deal">
              <FileText className="h-4 w-4 inline mr-2" />
              Select Deal *
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
                    No deals with investor packs available. Generate an investor pack first.
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

          <div className="space-y-2">
            <Label htmlFor="part">
              <FileText className="h-4 w-4 inline mr-2" />
              Select Part *
            </Label>
            <Select value={selectedPart.toString()} onValueChange={(v) => setSelectedPart(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PART_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value.toString()}>
                    <div>
                      <div className="font-medium">{option.label}</div>
                      <div className="text-xs text-muted-foreground">{option.description}</div>
                    </div>
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
