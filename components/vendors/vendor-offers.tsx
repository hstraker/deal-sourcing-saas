"use client"

import { useState, useEffect } from "react"
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
import { Loader2, Plus, Edit2, CheckCircle2, XCircle, Clock, MessageSquare } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"

interface VendorOffer {
  id: string
  offerAmount: number
  offerDate: string
  status: string
  vendorDecision: string | null
  vendorDecisionDate: string | null
  vendorNotes: string | null
  moreInfoRequested: boolean
  videoSent: boolean
  counterOfferAmount: number | null
  createdBy: {
    id: string
    firstName: string | null
    lastName: string | null
    email: string
  } | null
  deal: {
    id: string
    address: string
  } | null
}

interface VendorOffersProps {
  vendorId: string
  dealId?: string | null
}

export function VendorOffers({ vendorId, dealId }: VendorOffersProps) {
  const [offers, setOffers] = useState<VendorOffer[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingOffer, setEditingOffer] = useState<VendorOffer | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [offerAmount, setOfferAmount] = useState("")
  const [status, setStatus] = useState("pending")
  const [vendorDecision, setVendorDecision] = useState<string>("")
  const [vendorNotes, setVendorNotes] = useState("")
  const [moreInfoRequested, setMoreInfoRequested] = useState(false)
  const [videoSent, setVideoSent] = useState(false)
  const [counterOfferAmount, setCounterOfferAmount] = useState("")

  const fetchOffers = async () => {
    try {
      const response = await fetch(`/api/vendors/${vendorId}/offers`)
      if (!response.ok) throw new Error("Failed to fetch offers")
      const data = await response.json()
      setOffers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOffers()
  }, [vendorId])

  const handleCreateOffer = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendors/${vendorId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerAmount: parseFloat(offerAmount),
          dealId: dealId || undefined,
          vendorNotes: vendorNotes || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to create offer")
      }

      await fetchOffers()
      setIsDialogOpen(false)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create offer")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdateOffer = async () => {
    if (!editingOffer) return

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/vendors/${vendorId}/offers/${editingOffer.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          vendorDecision: vendorDecision || undefined,
          vendorNotes: vendorNotes || undefined,
          moreInfoRequested,
          videoSent,
          counterOfferAmount: counterOfferAmount ? parseFloat(counterOfferAmount) : undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to update offer")
      }

      await fetchOffers()
      setIsDialogOpen(false)
      setEditingOffer(null)
      resetForm()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update offer")
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetForm = () => {
    setOfferAmount("")
    setStatus("pending")
    setVendorDecision("")
    setVendorNotes("")
    setMoreInfoRequested(false)
    setVideoSent(false)
    setCounterOfferAmount("")
  }

  const openEditDialog = (offer: VendorOffer) => {
    setEditingOffer(offer)
    setOfferAmount(offer.offerAmount.toString())
    setStatus(offer.status)
    setVendorDecision(offer.vendorDecision || "")
    setVendorNotes(offer.vendorNotes || "")
    setMoreInfoRequested(offer.moreInfoRequested)
    setVideoSent(offer.videoSent)
    setCounterOfferAmount(offer.counterOfferAmount?.toString() || "")
    setIsDialogOpen(true)
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />
      default:
        return <MessageSquare className="h-4 w-4 text-gray-500" />
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Vendor Offers</CardTitle>
          <CardDescription>Track all offers made to this vendor</CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => {
              resetForm()
              setEditingOffer(null)
            }}>
              <Plus className="mr-2 h-4 w-4" />
              New Offer
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingOffer ? "Update Offer" : "Create New Offer"}
              </DialogTitle>
              <DialogDescription>
                {editingOffer
                  ? "Update offer status and vendor decision"
                  : "Make a new offer to this vendor"}
              </DialogDescription>
            </DialogHeader>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-4">
              {!editingOffer && (
                <div className="space-y-2">
                  <Label htmlFor="offerAmount">Offer Amount (£) *</Label>
                  <Input
                    id="offerAmount"
                    type="number"
                    step="0.01"
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    placeholder="65000"
                    required
                  />
                </div>
              )}

              {editingOffer && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger id="status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="more_info_sent">More Info Sent</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="counter_offered">Counter Offered</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="withdrawn">Withdrawn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="vendorDecision">Vendor Decision</Label>
                    <Select value={vendorDecision} onValueChange={setVendorDecision}>
                      <SelectTrigger id="vendorDecision">
                        <SelectValue placeholder="Select decision" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        <SelectItem value="accepted">Accepted</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="more_info_requested">More Info Requested</SelectItem>
                        <SelectItem value="counter_offer">Counter Offer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="counterOfferAmount">Counter Offer Amount (£)</Label>
                    <Input
                      id="counterOfferAmount"
                      type="number"
                      step="0.01"
                      value={counterOfferAmount}
                      onChange={(e) => setCounterOfferAmount(e.target.value)}
                      placeholder="67000"
                    />
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="moreInfoRequested"
                        checked={moreInfoRequested}
                        onChange={(e) => setMoreInfoRequested(e.target.checked)}
                      />
                      <Label htmlFor="moreInfoRequested">More Info Requested</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="videoSent"
                        checked={videoSent}
                        onChange={(e) => setVideoSent(e.target.checked)}
                      />
                      <Label htmlFor="videoSent">Video Sent</Label>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="vendorNotes">Vendor Notes</Label>
                <Textarea
                  id="vendorNotes"
                  value={vendorNotes}
                  onChange={(e) => setVendorNotes(e.target.value)}
                  placeholder="Vendor's response or notes..."
                  rows={4}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false)
                    setEditingOffer(null)
                    resetForm()
                  }}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={editingOffer ? handleUpdateOffer : handleCreateOffer}
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingOffer ? "Update Offer" : "Create Offer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {offers.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No offers made yet. Click "New Offer" to create one.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Offer Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {offers.map((offer) => (
                <TableRow key={offer.id}>
                  <TableCell className="font-medium">
                    {formatCurrency(offer.offerAmount)}
                  </TableCell>
                  <TableCell>{formatDate(offer.offerDate)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(offer.status)}
                      <span className="capitalize">{offer.status.replace("_", " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {offer.vendorDecision ? (
                      <span className="capitalize">{offer.vendorDecision.replace("_", " ")}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {offer.vendorNotes || <span className="text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditDialog(offer)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

