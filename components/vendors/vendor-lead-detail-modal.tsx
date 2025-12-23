"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { 
  Phone, 
  Mail, 
  MapPin, 
  TrendingUp, 
  Clock, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  DollarSign
} from "lucide-react"
import { PipelineStage } from "@prisma/client"
import { cn } from "@/lib/utils"

interface SMSMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: Date
  messageSid?: string | null
  status?: string | null
}

interface VendorLead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  pipelineStage: PipelineStage
  motivationScore: number | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  timelineDays: number | null
  competingOffers: boolean | null
  bmvScore: number | null
  estimatedMarketValue: number | null
  estimatedRefurbCost: number | null
  profitPotential: number | null
  validationPassed: boolean | null
  validationNotes: string | null
  validatedAt: Date | null
  offerAmount: number | null
  offerPercentage: number | null
  offerSentAt: Date | null
  offerAcceptedAt: Date | null
  offerRejectedAt: Date | null
  rejectionReason: string | null
  retryCount: number
  videoSent: boolean
  videoUrl: string | null
  conversationStartedAt: Date | null
  lastContactAt: Date | null
  smsMessages: SMSMessage[]
}

interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
}

const formatCurrency = (amount: number | null) => {
  if (!amount) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

const formatDate = (date: Date | null) => {
  if (!date) return "—"
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatTimeAgo = (date: Date | null) => {
  if (!date) return "Never"
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`
  return "Just now"
}

export function VendorLeadDetailModal({
  lead,
  open,
  onOpenChange,
  onUpdate,
}: VendorLeadDetailModalProps) {
  const [manualMessage, setManualMessage] = useState("")
  const [sendingMessage, setSendingMessage] = useState(false)
  const [fullLead, setFullLead] = useState<VendorLead | null>(lead)

  useEffect(() => {
    if (open && lead.id) {
      // Fetch full lead details with all messages
      fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lead) {
            // Transform dates
            const transformed = {
              ...data.lead,
              askingPrice: data.lead.askingPrice ? Number(data.lead.askingPrice) : null,
              bmvScore: data.lead.bmvScore ? Number(data.lead.bmvScore) : null,
              estimatedMarketValue: data.lead.estimatedMarketValue ? Number(data.lead.estimatedMarketValue) : null,
              estimatedRefurbCost: data.lead.estimatedRefurbCost ? Number(data.lead.estimatedRefurbCost) : null,
              profitPotential: data.lead.profitPotential ? Number(data.lead.profitPotential) : null,
              offerAmount: data.lead.offerAmount ? Number(data.lead.offerAmount) : null,
              offerPercentage: data.lead.offerPercentage ? Number(data.lead.offerPercentage) : null,
              motivationScore: data.lead.motivationScore ? Number(data.lead.motivationScore) : null,
              validatedAt: data.lead.validatedAt ? new Date(data.lead.validatedAt) : null,
              offerSentAt: data.lead.offerSentAt ? new Date(data.lead.offerSentAt) : null,
              offerAcceptedAt: data.lead.offerAcceptedAt ? new Date(data.lead.offerAcceptedAt) : null,
              offerRejectedAt: data.lead.offerRejectedAt ? new Date(data.lead.offerRejectedAt) : null,
              conversationStartedAt: data.lead.conversationStartedAt ? new Date(data.lead.conversationStartedAt) : null,
              lastContactAt: data.lead.lastContactAt ? new Date(data.lead.lastContactAt) : null,
              smsMessages: (data.lead.smsMessages || []).map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              })),
            }
            setFullLead(transformed)
          }
        })
        .catch((error) => {
          console.error("Error fetching lead details:", error)
        })
    }
  }, [open, lead.id])

  const currentLead = fullLead || lead

  const handleSendManualMessage = async () => {
    if (!manualMessage.trim()) return

    setSendingMessage(true)
    try {
      const response = await fetch(`/api/vendor-pipeline/leads/${lead.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: manualMessage }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to send message")
      }

      const data = await response.json()
      
      // Refresh lead data to show new message
      if (onUpdate) {
        onUpdate()
      } else {
        // Fallback: refetch lead details
        const leadResponse = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        if (leadResponse.ok) {
          const leadData = await leadResponse.json()
          if (leadData.lead) {
            const transformed = {
              ...leadData.lead,
              askingPrice: leadData.lead.askingPrice ? Number(leadData.lead.askingPrice) : null,
              bmvScore: leadData.lead.bmvScore ? Number(leadData.lead.bmvScore) : null,
              estimatedMarketValue: leadData.lead.estimatedMarketValue ? Number(leadData.lead.estimatedMarketValue) : null,
              estimatedRefurbCost: leadData.lead.estimatedRefurbCost ? Number(leadData.lead.estimatedRefurbCost) : null,
              profitPotential: leadData.lead.profitPotential ? Number(leadData.lead.profitPotential) : null,
              offerAmount: leadData.lead.offerAmount ? Number(leadData.lead.offerAmount) : null,
              offerPercentage: leadData.lead.offerPercentage ? Number(leadData.lead.offerPercentage) : null,
              motivationScore: leadData.lead.motivationScore ? Number(leadData.lead.motivationScore) : null,
              validatedAt: leadData.lead.validatedAt ? new Date(leadData.lead.validatedAt) : null,
              offerSentAt: leadData.lead.offerSentAt ? new Date(leadData.lead.offerSentAt) : null,
              offerAcceptedAt: leadData.lead.offerAcceptedAt ? new Date(leadData.lead.offerAcceptedAt) : null,
              offerRejectedAt: leadData.lead.offerRejectedAt ? new Date(leadData.lead.offerRejectedAt) : null,
              conversationStartedAt: leadData.lead.conversationStartedAt ? new Date(leadData.lead.conversationStartedAt) : null,
              lastContactAt: leadData.lead.lastContactAt ? new Date(leadData.lead.lastContactAt) : null,
              smsMessages: (leadData.lead.smsMessages || []).map((msg: any) => ({
                ...msg,
                createdAt: new Date(msg.createdAt),
              })),
            }
            setFullLead(transformed)
          }
        }
      }

      setManualMessage("")
    } catch (error: any) {
      console.error("Error sending message:", error)
      alert(error.message || "Failed to send message")
    } finally {
      setSendingMessage(false)
    }
  }

  const motivationBadgeColor = (score: number | null) => {
    if (!score) return "bg-gray-100 text-gray-700"
    if (score >= 8) return "bg-green-100 text-green-700"
    if (score >= 5) return "bg-yellow-100 text-yellow-700"
    return "bg-red-100 text-red-700"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {currentLead.vendorName} - {currentLead.propertyAddress || "No Address"}
          </DialogTitle>
          <DialogDescription>
            Pipeline Stage: <Badge>{currentLead.pipelineStage}</Badge>
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="conversation" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="offer">Offer</TabsTrigger>
          </TabsList>

          <TabsContent value="conversation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>SMS Conversation History</CardTitle>
                <CardDescription>
                  {currentLead.smsMessages.length} message{currentLead.smsMessages.length !== 1 ? "s" : ""} exchanged
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto p-4 bg-muted/30 rounded-lg">
                  {currentLead.smsMessages.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No messages yet
                    </p>
                  ) : (
                    currentLead.smsMessages.map((message) => {
                      const isOutbound = message.direction === "outbound"
                      return (
                        <div
                          key={message.id}
                          className={cn(
                            "flex",
                            isOutbound ? "justify-end" : "justify-start"
                          )}
                        >
                          <div
                            className={cn(
                              "max-w-[75%] rounded-lg px-4 py-2",
                              isOutbound
                                ? "bg-blue-500 text-white"
                                : "bg-white border"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap">{message.messageBody}</p>
                            <p
                              className={cn(
                                "text-xs mt-1",
                                isOutbound ? "text-blue-100" : "text-muted-foreground"
                              )}
                            >
                              {formatTimeAgo(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  <Textarea
                    placeholder="Send a manual message to the vendor..."
                    value={manualMessage}
                    onChange={(e) => setManualMessage(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleSendManualMessage}
                    disabled={!manualMessage.trim() || sendingMessage}
                    className="w-full"
                  >
                    {sendingMessage ? "Sending..." : "Send Message"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="details" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Vendor Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Name</p>
                    <p className="text-base">{currentLead.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Phone</p>
                    <p className="text-base flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      {currentLead.vendorPhone}
                    </p>
                  </div>
                  {currentLead.vendorEmail && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Email</p>
                      <p className="text-base flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        {currentLead.vendorEmail}
                      </p>
                    </div>
                  )}
                  {currentLead.vendorAddress && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Address</p>
                      <p className="text-base">{currentLead.vendorAddress}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Property Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentLead.propertyAddress && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Address</p>
                      <p className="text-base flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        {currentLead.propertyAddress}
                      </p>
                    </div>
                  )}
                  {currentLead.propertyPostcode && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Postcode</p>
                      <p className="text-base">{currentLead.propertyPostcode}</p>
                    </div>
                  )}
                  {currentLead.propertyType && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Type</p>
                      <p className="text-base capitalize">{currentLead.propertyType}</p>
                    </div>
                  )}
                  {(currentLead.bedrooms || currentLead.bathrooms) && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Size</p>
                      <p className="text-base">
                        {currentLead.bedrooms && `${currentLead.bedrooms} bed${currentLead.bedrooms > 1 ? "s" : ""}`}
                        {currentLead.bedrooms && currentLead.bathrooms && ", "}
                        {currentLead.bathrooms && `${currentLead.bathrooms} bath${currentLead.bathrooms > 1 ? "s" : ""}`}
                      </p>
                    </div>
                  )}
                  {currentLead.askingPrice && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Asking Price</p>
                      <p className="text-base font-semibold">{formatCurrency(currentLead.askingPrice)}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Motivation & Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentLead.motivationScore !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium text-muted-foreground">Motivation Score</p>
                        <Badge className={motivationBadgeColor(currentLead.motivationScore)}>
                          {currentLead.motivationScore}/10
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={cn(
                            "h-2 rounded-full",
                            currentLead.motivationScore >= 8
                              ? "bg-green-500"
                              : currentLead.motivationScore >= 5
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          )}
                          style={{ width: `${(currentLead.motivationScore / 10) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}
                  {currentLead.urgencyLevel && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Urgency</p>
                      <p className="text-base capitalize">{currentLead.urgencyLevel}</p>
                    </div>
                  )}
                  {currentLead.timelineDays && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Timeline</p>
                      <p className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        {currentLead.timelineDays} day{currentLead.timelineDays > 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  {currentLead.reasonForSelling && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Reason for Selling</p>
                      <p className="text-base capitalize">{currentLead.reasonForSelling.replace("_", " ")}</p>
                    </div>
                  )}
                  {currentLead.competingOffers !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Competing Offers</p>
                      <p className="text-base">{currentLead.competingOffers ? "Yes" : "No"}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pipeline Stage</p>
                    <Badge className="mt-1">{currentLead.pipelineStage}</Badge>
                  </div>
                  {currentLead.conversationStartedAt && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Conversation Started</p>
                      <p className="text-base">{formatDate(currentLead.conversationStartedAt)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Last Contact</p>
                    <p className="text-base">{formatTimeAgo(currentLead.lastContactAt)}</p>
                  </div>
                  {currentLead.retryCount > 0 && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Retry Count</p>
                      <p className="text-base">{currentLead.retryCount}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="validation" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>BMV Analysis Results</CardTitle>
                <CardDescription>
                  {currentLead.validatedAt ? `Validated on ${formatDate(currentLead.validatedAt)}` : "Not yet validated"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {currentLead.estimatedMarketValue !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Estimated Market Value</p>
                      <p className="text-2xl font-bold">{formatCurrency(currentLead.estimatedMarketValue)}</p>
                    </div>
                  )}
                  {currentLead.askingPrice !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Asking Price</p>
                      <p className="text-2xl font-bold">{formatCurrency(currentLead.askingPrice)}</p>
                    </div>
                  )}
                  {currentLead.bmvScore !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">BMV Percentage</p>
                      <p className="text-2xl font-bold text-green-600 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5" />
                        {currentLead.bmvScore.toFixed(1)}%
                      </p>
                    </div>
                  )}
                  {currentLead.profitPotential !== null && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Profit Potential</p>
                      <p className="text-2xl font-bold">{formatCurrency(currentLead.profitPotential)}</p>
                    </div>
                  )}
                </div>

                {currentLead.validationPassed !== null && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2">
                      {currentLead.validationPassed ? (
                        <>
                          <CheckCircle2 className="h-5 w-5 text-green-600" />
                          <span className="font-semibold text-green-600">Validation Passed</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-5 w-5 text-red-600" />
                          <span className="font-semibold text-red-600">Validation Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {currentLead.validationNotes && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground mb-2">Validation Notes</p>
                    <p className="text-sm whitespace-pre-wrap bg-muted p-3 rounded-lg">
                      {currentLead.validationNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="offer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Offer Details</CardTitle>
                <CardDescription>
                  {currentLead.offerSentAt ? `Offer sent on ${formatDate(currentLead.offerSentAt)}` : "No offer sent yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {currentLead.offerAmount !== null && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Offer Amount</p>
                      <p className="text-2xl font-bold flex items-center gap-2">
                        <DollarSign className="h-6 w-6" />
                        {formatCurrency(currentLead.offerAmount)}
                      </p>
                    </div>
                    {currentLead.offerPercentage !== null && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Offer Percentage</p>
                        <p className="text-2xl font-bold">{currentLead.offerPercentage.toFixed(1)}%</p>
                      </div>
                    )}
                  </div>
                )}

                {currentLead.offerAcceptedAt && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle2 className="h-5 w-5" />
                      <span className="font-semibold">Offer Accepted</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Accepted on {formatDate(currentLead.offerAcceptedAt)}
                    </p>
                  </div>
                )}

                {currentLead.offerRejectedAt && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 text-red-600">
                      <XCircle className="h-5 w-5" />
                      <span className="font-semibold">Offer Rejected</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Rejected on {formatDate(currentLead.offerRejectedAt)}
                    </p>
                    {currentLead.rejectionReason && (
                      <p className="text-sm bg-muted p-3 rounded-lg mt-2 whitespace-pre-wrap">
                        {currentLead.rejectionReason}
                      </p>
                    )}
                  </div>
                )}

                {currentLead.retryCount > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium text-muted-foreground">Retry Attempts</p>
                    <p className="text-base">{currentLead.retryCount}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

