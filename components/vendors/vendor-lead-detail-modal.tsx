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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Phone,
  Mail,
  MapPin,
  TrendingUp,
  Clock,
  MessageSquare,
  CheckCircle2,
  XCircle,
  PoundSterling,
  Edit,
  Save,
  X,
  Trash2,
  Loader2,
  FileDown,
  Calculator,
  Percent,
  Home,
  ArrowDownRight,
  Target,
  Wallet
} from "lucide-react"
import { PipelineStage } from "@prisma/client"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { VendorComparablesTab } from "./vendor-comparables-tab"
import { formatCurrency } from "@/lib/format"

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
  squareFeet: number | null
  condition: string | null
  estimatedMonthlyRent: number | null
  estimatedAnnualRent: number | null
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
  investorPackGenerationCount?: number
  lastInvestorPackGeneratedAt?: Date | null
  dealId: string | null
  smsMessages: SMSMessage[]
}

interface VendorLeadDetailModalProps {
  lead: VendorLead
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate?: () => void
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
  const [fullLead, setFullLead] = useState<VendorLead | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isGeneratingPack, setIsGeneratingPack] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")

  // Transform initial lead prop to ensure Decimal types are converted to numbers
  const transformLead = (leadData: any) => ({
    ...leadData,
    askingPrice: leadData.askingPrice ? Number(leadData.askingPrice) : null,
    bmvScore: leadData.bmvScore ? Number(leadData.bmvScore) : null,
    estimatedMarketValue: leadData.estimatedMarketValue ? Number(leadData.estimatedMarketValue) : null,
    estimatedRefurbCost: leadData.estimatedRefurbCost ? Number(leadData.estimatedRefurbCost) : null,
    profitPotential: leadData.profitPotential ? Number(leadData.profitPotential) : null,
    offerAmount: leadData.offerAmount ? Number(leadData.offerAmount) : null,
    offerPercentage: leadData.offerPercentage ? Number(leadData.offerPercentage) : null,
    motivationScore: leadData.motivationScore ? Number(leadData.motivationScore) : null,
    estimatedMonthlyRent: leadData.estimatedMonthlyRent ? Number(leadData.estimatedMonthlyRent) : null,
    estimatedAnnualRent: leadData.estimatedAnnualRent ? Number(leadData.estimatedAnnualRent) : null,
  })

  useEffect(() => {
    if (open && lead.id) {
      // Fetch full lead details with all messages
      fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.lead) {
            // Transform dates and Decimal types
            const transformed = {
              ...transformLead(data.lead),
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

  // Fetch available templates
  useEffect(() => {
    if (open) {
      fetch('/api/investor-pack-templates')
        .then(res => res.json())
        .then(data => {
          if (data.templates) {
            setTemplates(data.templates)
            // Auto-select the default template
            const defaultTemplate = data.templates.find((t: any) => t.isDefault)
            if (defaultTemplate) {
              setSelectedTemplateId(defaultTemplate.id)
            } else if (data.templates.length > 0) {
              setSelectedTemplateId(data.templates[0].id)
            }
          }
        })
        .catch(error => {
          console.error('Error fetching templates:', error)
        })
    }
  }, [open])

  const currentLead = fullLead || transformLead(lead)

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
              ...transformLead(leadData.lead),
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
      toast.success("Message sent successfully")
    } catch (error: any) {
      console.error("Error sending message:", error)
      toast.error(error.message || "Failed to send message")
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

  const handleEdit = () => {
    // Initialize edit form with current values
    setEditForm({
      vendorName: currentLead.vendorName || "",
      vendorPhone: currentLead.vendorPhone || "",
      vendorEmail: currentLead.vendorEmail || "",
      propertyAddress: currentLead.propertyAddress || "",
      propertyPostcode: currentLead.propertyPostcode || "",
      askingPrice: currentLead.askingPrice || "",
      propertyType: currentLead.propertyType || "",
      bedrooms: currentLead.bedrooms || "",
      bathrooms: currentLead.bathrooms || "",
      squareFeet: currentLead.squareFeet || "",
      condition: currentLead.condition || "",
      estimatedMonthlyRent: currentLead.estimatedMonthlyRent || "",
      estimatedAnnualRent: currentLead.estimatedAnnualRent || "",
      motivationScore: currentLead.motivationScore || "",
      urgencyLevel: currentLead.urgencyLevel || "",
      reasonForSelling: currentLead.reasonForSelling || "",
      timelineDays: currentLead.timelineDays || "",
      competingOffers: currentLead.competingOffers || false,
      estimatedMarketValue: currentLead.estimatedMarketValue || "",
      estimatedRefurbCost: currentLead.estimatedRefurbCost || "",
      pipelineStage: currentLead.pipelineStage || "",
    })
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditForm({})
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      // Convert empty strings to null and numbers
      const dataToSave = Object.entries(editForm).reduce((acc, [key, value]) => {
        if (value === "") {
          acc[key] = null
        } else if (["askingPrice", "bedrooms", "bathrooms", "squareFeet", "estimatedMonthlyRent", "estimatedAnnualRent", "motivationScore", "timelineDays", "estimatedMarketValue", "estimatedRefurbCost"].includes(key)) {
          acc[key] = value ? Number(value) : null
        } else {
          acc[key] = value
        }
        return acc
      }, {} as any)

      const response = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to update vendor lead")
      }

      const updatedLead = await response.json()

      // Transform and update fullLead state
      const transformed = {
        ...transformLead(updatedLead),
        validatedAt: updatedLead.validatedAt ? new Date(updatedLead.validatedAt) : null,
        offerSentAt: updatedLead.offerSentAt ? new Date(updatedLead.offerSentAt) : null,
        offerAcceptedAt: updatedLead.offerAcceptedAt ? new Date(updatedLead.offerAcceptedAt) : null,
        offerRejectedAt: updatedLead.offerRejectedAt ? new Date(updatedLead.offerRejectedAt) : null,
        conversationStartedAt: updatedLead.conversationStartedAt ? new Date(updatedLead.conversationStartedAt) : null,
        lastContactAt: updatedLead.lastContactAt ? new Date(updatedLead.lastContactAt) : null,
        smsMessages: fullLead?.smsMessages || [],
      }

      setFullLead(transformed)
      setIsEditing(false)

      if (onUpdate) {
        onUpdate()
      }

      // Check if BMV-affecting fields were changed
      const bmvFieldsChanged = ["askingPrice", "estimatedMarketValue", "estimatedRefurbCost", "condition", "motivationScore", "urgencyLevel"]
        .some(field => editForm[field] !== undefined && editForm[field] !== "")

      if (bmvFieldsChanged) {
        toast.success("Vendor updated - Click 'Calculate BMV' to refresh metrics", { duration: 5000 })
      } else {
        toast.success("Vendor updated successfully")
      }
    } catch (error: any) {
      console.error("Error updating vendor lead:", error)
      toast.error(error.message || "Failed to update vendor")
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete ${currentLead.vendorName}? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete vendor lead")
      }

      toast.success(`${currentLead.vendorName} deleted successfully`)

      if (onUpdate) {
        onUpdate()
      }

      onOpenChange(false)
    } catch (error: any) {
      console.error("Error deleting vendor lead:", error)
      toast.error(error.message || "Failed to delete vendor")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleGenerateInvestorPack = async () => {
    if (!currentLead.propertyAddress) {
      toast.error("Property address is required to generate investor pack")
      return
    }

    if (!currentLead.askingPrice) {
      toast.error("Asking price is required to generate investor pack")
      return
    }

    if (!selectedTemplateId) {
      toast.error("Please select a template")
      return
    }

    setIsGeneratingPack(true)

    try {
      const response = await fetch(`/api/vendor-leads/${lead.id}/investor-pack?templateId=${selectedTemplateId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))

        // Handle the specific "Deal Not Ready" error with helpful guidance
        if (response.status === 400 && errorData.error === "Deal Not Ready for Investor Marketing") {
          const stage = currentLead.pipelineStage
          let helpMessage = errorData.message || "This vendor lead must complete the pipeline process first."

          if (stage === "OFFER_ACCEPTED") {
            helpMessage += "\n\nNext Step: Request solicitor details from the vendor to create the deal."
          } else if (stage === "READY_FOR_INVESTORS") {
            helpMessage += "\n\nThe deal should be created. Please check the vendor pipeline status."
          } else if (stage === "NEW_LEAD" || stage === "AI_CONVERSATION") {
            helpMessage += "\n\nThe AI is still qualifying this lead. Wait for validation and offer stages."
          } else {
            helpMessage += `\n\nCurrent Stage: ${stage}. Continue the vendor negotiation process.`
          }

          toast.error(helpMessage, { duration: 8000 })
          return
        }

        throw new Error(errorData.error || "Failed to generate investor pack")
      }

      // Get the PDF blob
      const blob = await response.blob()

      // Create a download link and trigger it
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      const fileName = currentLead.propertyAddress.replace(/[^a-z0-9]/gi, "-").toLowerCase()
      a.download = `investor-pack-${fileName}.pdf`
      document.body.appendChild(a)
      a.click()

      // Cleanup
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success("Investor pack generated successfully")

      // Refresh lead data
      if (onUpdate) {
        onUpdate()
      }
    } catch (error: any) {
      console.error("Error generating investor pack:", error)
      toast.error(error.message || "Failed to generate investor pack")
    } finally {
      setIsGeneratingPack(false)
    }
  }

  const handleCalculateBMV = async () => {
    if (!currentLead.askingPrice) {
      toast.error("Please add an asking price before calculating BMV")
      return
    }

    setIsCalculating(true)
    try {
      const response = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, {
        method: "POST",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to calculate BMV")
      }

      const result = await response.json()

      // Fetch the updated lead from the database to ensure consistency
      const freshLead = await fetch(`/api/vendor-leads/${lead.id}`)
      if (freshLead.ok) {
        const freshData = await freshLead.json()
        const transformed = {
          ...transformLead(freshData),
          validatedAt: freshData.validatedAt ? new Date(freshData.validatedAt) : null,
          offerSentAt: freshData.offerSentAt ? new Date(freshData.offerSentAt) : null,
          offerAcceptedAt: freshData.offerAcceptedAt ? new Date(freshData.offerAcceptedAt) : null,
          offerRejectedAt: freshData.offerRejectedAt ? new Date(freshData.offerRejectedAt) : null,
          conversationStartedAt: freshData.conversationStartedAt ? new Date(freshData.conversationStartedAt) : null,
          lastContactAt: freshData.lastContactAt ? new Date(freshData.lastContactAt) : null,
          smsMessages: currentLead.smsMessages, // Keep existing messages
        }
        setFullLead(transformed)
      }

      if (onUpdate) {
        onUpdate()
      }

      if (result.data.validationPassed) {
        toast.success(`Deal validated! ${Number(result.data.bmvScore).toFixed(1)}% BMV with £${Number(result.data.profitPotential).toLocaleString()} profit`)
      } else {
        toast.warning("Deal calculated but failed validation criteria")
      }
    } catch (error: any) {
      console.error("Error calculating BMV:", error)
      toast.error(error.message || "Failed to calculate BMV")
    } finally {
      setIsCalculating(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <DialogTitle>Vendor Lead Details</DialogTitle>
                <div className="mt-2 flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <span className="font-medium text-primary">{currentLead.propertyAddress || "No Address"}</span>
                  </div>
                  {currentLead.vendorName && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                      {currentLead.vendorName}
                    </Badge>
                  )}
                  {currentLead.askingPrice && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      {formatCurrency(currentLead.askingPrice)}
                    </Badge>
                  )}
                  {currentLead.dealId ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                      ✓ Deal Created
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                      Vendor Pipeline
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {!isEditing ? (
                  <>
                    {templates.length > 0 && (
                      <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Select template" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.filter((t: any) => t.isActive).map((template: any) => (
                            <SelectItem key={template.id} value={template.id}>
                              {template.name} {template.isDefault && "(Default)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative">
                            <Button
                              variant="default"
                              size="sm"
                              onClick={handleGenerateInvestorPack}
                              disabled={isGeneratingPack || !currentLead.propertyAddress || !currentLead.askingPrice || !selectedTemplateId}
                            >
                              {isGeneratingPack ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <FileDown className="h-4 w-4 mr-2" />
                                  Investor Pack
                                </>
                              )}
                            </Button>
                            {currentLead.investorPackGenerationCount && currentLead.investorPackGenerationCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-green-500 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
                                {currentLead.investorPackGenerationCount}
                              </span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            {currentLead.investorPackGenerationCount && currentLead.investorPackGenerationCount > 0
                              ? `Generated ${currentLead.investorPackGenerationCount} time${currentLead.investorPackGenerationCount > 1 ? "s" : ""}${
                                  currentLead.lastInvestorPackGeneratedAt
                                    ? ` • Last: ${formatTimeAgo(currentLead.lastInvestorPackGeneratedAt)}`
                                    : ""
                                }`
                              : "Generate professional investor pack PDF"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button variant="outline" size="sm" onClick={handleEdit} disabled={isSaving}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDelete}
                      disabled={isSaving || isDeleting}
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 mr-2" />
                      )}
                      Delete
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={isSaving}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave} disabled={isSaving}>
                      {isSaving ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

        <Tabs defaultValue="details" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="comparables">Comparables</TabsTrigger>
            <TabsTrigger value="offer">Offer</TabsTrigger>
            <TabsTrigger value="conversation">Conversation</TabsTrigger>
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
                    currentLead.smsMessages.map((message: any) => {
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
                  <CardTitle>Contact Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="vendorName">Name *</Label>
                        <Input
                          id="vendorName"
                          value={editForm.vendorName || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="vendorPhone">Phone *</Label>
                        <Input
                          id="vendorPhone"
                          value={editForm.vendorPhone || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorPhone: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="vendorEmail">Email</Label>
                        <Input
                          id="vendorEmail"
                          type="email"
                          value={editForm.vendorEmail || ""}
                          onChange={(e) => setEditForm({ ...editForm, vendorEmail: e.target.value })}
                        />
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Property Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="propertyAddress">Address</Label>
                        <Textarea
                          id="propertyAddress"
                          value={editForm.propertyAddress || ""}
                          onChange={(e) => setEditForm({ ...editForm, propertyAddress: e.target.value })}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="propertyPostcode">Postcode</Label>
                        <Input
                          id="propertyPostcode"
                          value={editForm.propertyPostcode || ""}
                          onChange={(e) => setEditForm({ ...editForm, propertyPostcode: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="propertyType">Type</Label>
                        <Input
                          id="propertyType"
                          value={editForm.propertyType || ""}
                          onChange={(e) => setEditForm({ ...editForm, propertyType: e.target.value })}
                          placeholder="e.g., terraced, semi-detached"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="bedrooms">Bedrooms</Label>
                          <Input
                            id="bedrooms"
                            type="number"
                            value={editForm.bedrooms || ""}
                            onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })}
                          />
                        </div>
                        <div>
                          <Label htmlFor="bathrooms">Bathrooms</Label>
                          <Input
                            id="bathrooms"
                            type="number"
                            value={editForm.bathrooms || ""}
                            onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="squareFeet">Square Footage</Label>
                        <Input
                          id="squareFeet"
                          type="number"
                          value={editForm.squareFeet || ""}
                          onChange={(e) => setEditForm({ ...editForm, squareFeet: e.target.value })}
                          placeholder="Total sq ft"
                        />
                      </div>
                      <div>
                        <Label htmlFor="askingPrice">Asking Price (£)</Label>
                        <Input
                          id="askingPrice"
                          type="number"
                          value={editForm.askingPrice || ""}
                          onChange={(e) => setEditForm({ ...editForm, askingPrice: e.target.value })}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label htmlFor="estimatedMonthlyRent">Monthly Rent (£)</Label>
                          <Input
                            id="estimatedMonthlyRent"
                            type="number"
                            value={editForm.estimatedMonthlyRent || ""}
                            onChange={(e) => {
                              const monthly = e.target.value
                              setEditForm({
                                ...editForm,
                                estimatedMonthlyRent: monthly,
                                estimatedAnnualRent: monthly ? String(Number(monthly) * 12) : ""
                              })
                            }}
                            placeholder="Est. monthly rent"
                          />
                        </div>
                        <div>
                          <Label htmlFor="estimatedAnnualRent">Annual Rent (£)</Label>
                          <Input
                            id="estimatedAnnualRent"
                            type="number"
                            value={editForm.estimatedAnnualRent || ""}
                            onChange={(e) => setEditForm({ ...editForm, estimatedAnnualRent: e.target.value })}
                            placeholder="Auto-calculated"
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="condition">Property Condition</Label>
                        <Select
                          value={editForm.condition || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, condition: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="excellent">Excellent</SelectItem>
                            <SelectItem value="good">Good</SelectItem>
                            <SelectItem value="needs_work">Needs Work</SelectItem>
                            <SelectItem value="needs_modernisation">Needs Modernisation</SelectItem>
                            <SelectItem value="poor">Poor</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  ) : (
                    <>
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
                      {currentLead.condition && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Condition</p>
                          <p className="text-base capitalize">{currentLead.condition.replace(/_/g, " ")}</p>
                        </div>
                      )}
                      {currentLead.squareFeet && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Square Footage</p>
                          <p className="text-base">{currentLead.squareFeet.toLocaleString()} sq ft</p>
                        </div>
                      )}
                      {currentLead.askingPrice && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Asking Price</p>
                          <p className="text-base font-semibold text-green-700">{formatCurrency(currentLead.askingPrice)}</p>
                        </div>
                      )}
                      {currentLead.estimatedMonthlyRent && (
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">Rental Income</p>
                          <p className="text-base font-semibold">
                            {formatCurrency(currentLead.estimatedMonthlyRent)}/mo
                            {currentLead.estimatedAnnualRent && (
                              <span className="text-sm text-muted-foreground font-normal">
                                {" "}({formatCurrency(currentLead.estimatedAnnualRent)}/yr)
                              </span>
                            )}
                          </p>
                          {currentLead.askingPrice && currentLead.estimatedAnnualRent && (
                            <p className="text-sm text-green-600 font-medium mt-1">
                              {((Number(currentLead.estimatedAnnualRent) / Number(currentLead.askingPrice)) * 100).toFixed(2)}% gross yield
                            </p>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Motivation & Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <>
                      <div>
                        <Label htmlFor="motivationScore">Motivation Score (1-10)</Label>
                        <Input
                          id="motivationScore"
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.motivationScore || ""}
                          onChange={(e) => setEditForm({ ...editForm, motivationScore: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="urgencyLevel">Urgency Level</Label>
                        <Select
                          value={editForm.urgencyLevel || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, urgencyLevel: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select urgency" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="quick">Quick</SelectItem>
                            <SelectItem value="moderate">Moderate</SelectItem>
                            <SelectItem value="flexible">Flexible</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="timelineDays">Timeline (days)</Label>
                        <Input
                          id="timelineDays"
                          type="number"
                          value={editForm.timelineDays || ""}
                          onChange={(e) => setEditForm({ ...editForm, timelineDays: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="reasonForSelling">Reason for Selling</Label>
                        <Select
                          value={editForm.reasonForSelling || ""}
                          onValueChange={(value) => setEditForm({ ...editForm, reasonForSelling: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select reason" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="relocation">Relocation</SelectItem>
                            <SelectItem value="financial">Financial</SelectItem>
                            <SelectItem value="divorce">Divorce</SelectItem>
                            <SelectItem value="inheritance">Inheritance</SelectItem>
                            <SelectItem value="downsize">Downsize</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="competingOffers"
                          checked={editForm.competingOffers || false}
                          onChange={(e) => setEditForm({ ...editForm, competingOffers: e.target.checked })}
                          className="h-4 w-4"
                        />
                        <Label htmlFor="competingOffers" className="cursor-pointer">
                          Has Competing Offers
                        </Label>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {isEditing ? (
                    <div>
                      <Label htmlFor="pipelineStage">Stage</Label>
                      <Select
                        value={editForm.pipelineStage || ""}
                        onValueChange={(value) => setEditForm({ ...editForm, pipelineStage: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                          <SelectItem value="INITIAL_CONTACT">Initial Contact</SelectItem>
                          <SelectItem value="AI_CONVERSATION">AI Conversation</SelectItem>
                          <SelectItem value="DEAL_VALIDATION">Deal Validation</SelectItem>
                          <SelectItem value="VALUATION_PENDING">Valuation Pending</SelectItem>
                          <SelectItem value="VALUATION_COMPLETE">Valuation Complete</SelectItem>
                          <SelectItem value="OFFER_PREPARATION">Offer Preparation</SelectItem>
                          <SelectItem value="OFFER_SENT">Offer Sent</SelectItem>
                          <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                          <SelectItem value="OFFER_ACCEPTED">Offer Accepted</SelectItem>
                          <SelectItem value="SOLICITOR_INSTRUCTED">Solicitor Instructed</SelectItem>
                          <SelectItem value="LOCKOUT_SIGNED">Lockout Signed</SelectItem>
                          <SelectItem value="COMPLETION_PENDING">Completion Pending</SelectItem>
                          <SelectItem value="COMPLETED">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Stage</p>
                      <Badge className="mt-1">{currentLead.pipelineStage}</Badge>
                    </div>
                  )}
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>BMV Analysis Results</CardTitle>
                    <CardDescription>
                      {currentLead.validatedAt ? `Validated on ${formatDate(currentLead.validatedAt)}` : "Not yet validated"}
                    </CardDescription>
                  </div>
                  <Button
                    onClick={handleCalculateBMV}
                    disabled={isCalculating || !currentLead.askingPrice}
                    size="sm"
                    variant="outline"
                  >
                    {isCalculating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <TrendingUp className="h-4 w-4 mr-2" />
                    )}
                    {isCalculating ? "Calculating..." : "Calculate BMV"}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="estimatedMarketValue">Estimated Market Value (£)</Label>
                          <Input
                            id="estimatedMarketValue"
                            type="number"
                            value={editForm.estimatedMarketValue || ""}
                            onChange={(e) => setEditForm({ ...editForm, estimatedMarketValue: e.target.value })}
                            placeholder="Auto-estimated if blank"
                          />
                        </div>
                        <div>
                          <Label htmlFor="estimatedRefurbCost">Estimated Refurb Cost (£)</Label>
                          <Input
                            id="estimatedRefurbCost"
                            type="number"
                            value={editForm.estimatedRefurbCost || ""}
                            onChange={(e) => setEditForm({ ...editForm, estimatedRefurbCost: e.target.value })}
                            placeholder="0"
                          />
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-400 p-4 rounded-lg text-sm text-amber-900">
                        <p className="font-bold mb-1">⚠️ Important: After Saving Edits</p>
                        <p className="mb-2">
                          If you change asking price, market value, condition, motivation, or refurb costs, you must click <strong>&quot;Calculate BMV&quot;</strong> button in the Validation tab to recalculate the deal metrics.
                        </p>
                        <p className="text-xs">
                          BMV calculations are not automatic to give you full control over when they&apos;re performed.
                        </p>
                      </div>
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-700">
                        <p className="font-medium mb-1">How BMV Calculation Works</p>
                        <p className="mb-2">
                          The system calculates BMV (Below Market Value) percentage and offer amount based on:
                        </p>
                        <ul className="list-disc list-inside space-y-1 text-xs">
                          <li><strong>Market Value:</strong> Estimated from asking price if not provided</li>
                          <li><strong>BMV %:</strong> (Market Value - Asking Price) / Market Value × 100</li>
                          <li><strong>Offer Amount:</strong> 70-85% of market value (adjusted by motivation, condition, urgency)</li>
                          <li><strong>Profit:</strong> Market Value - Offer Amount - Refurb Cost</li>
                        </ul>
                        <p className="mt-2 font-medium">
                          To pass validation: BMV ≥ 15% AND Profit ≥ £10,000
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {currentLead.bmvScore === null && currentLead.askingPrice !== null && (
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg text-sm text-amber-800 mb-4">
                        <p className="font-medium mb-1">📊 BMV Not Calculated</p>
                        <p>
                          Click &quot;Calculate BMV&quot; above to analyze this deal. The system will estimate market value based on asking price, motivation, and property condition if not already provided.
                        </p>
                      </div>
                    )}
                    {currentLead.bmvScore !== null && currentLead.validatedAt && (
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg text-sm text-blue-800 mb-4">
                        <p className="font-medium mb-1">ℹ️ Last Calculated: {formatDate(currentLead.validatedAt)}</p>
                        <p>
                          If you&apos;ve edited asking price, market value, condition, motivation, or refurb costs since this time, click &quot;Calculate BMV&quot; above to refresh these metrics.
                        </p>
                      </div>
                    )}
                    {!currentLead.askingPrice && (
                      <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-sm text-red-800 mb-4">
                        <p className="font-medium mb-1">Missing Asking Price</p>
                        <p>
                          Add an asking price in the Details tab before calculating BMV.
                        </p>
                      </div>
                    )}
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-4">
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
                            <p className={`text-2xl font-bold flex items-center gap-2 ${Number(currentLead.bmvScore) >= 15 ? "text-green-600" : "text-red-600"}`}>
                              <TrendingUp className="h-5 w-5" />
                              {Number(currentLead.bmvScore).toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {Number(currentLead.bmvScore) >= 15 ? "Meets 15% threshold ✓" : "Below 15% threshold ✗"}
                            </p>
                          </div>
                        )}
                      </div>

                      {currentLead.offerAmount !== null && (
                        <div className="border-t pt-4">
                          <p className="text-sm font-medium text-muted-foreground mb-3">Offer Calculation Breakdown</p>
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <p className="text-sm font-medium text-muted-foreground">Calculated Offer</p>
                              <p className="text-xl font-bold">{formatCurrency(currentLead.offerAmount)}</p>
                              {currentLead.offerPercentage && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {Number(currentLead.offerPercentage).toFixed(1)}% of market value
                                </p>
                              )}
                            </div>
                            {currentLead.estimatedRefurbCost !== null && currentLead.estimatedRefurbCost > 0 && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Less: Refurb Cost</p>
                                <p className="text-xl font-bold text-red-600">-{formatCurrency(currentLead.estimatedRefurbCost)}</p>
                              </div>
                            )}
                            {currentLead.profitPotential !== null && (
                              <div>
                                <p className="text-sm font-medium text-muted-foreground">Net Profit Potential</p>
                                <p className={`text-xl font-bold ${Number(currentLead.profitPotential) >= 10000 ? "text-green-600" : "text-red-600"}`}>
                                  {formatCurrency(currentLead.profitPotential)}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {Number(currentLead.profitPotential) >= 10000 ? "Meets £10k threshold ✓" : "Below £10k threshold ✗"}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

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
            {/* Offer Status Banner */}
            {currentLead.offerAcceptedAt && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-900">Offer Accepted!</p>
                    <p className="text-sm text-green-700">Accepted on {formatDate(currentLead.offerAcceptedAt)}</p>
                  </div>
                </div>
              </div>
            )}

            {currentLead.offerRejectedAt && (
              <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <XCircle className="h-6 w-6 text-red-600" />
                  <div className="flex-1">
                    <p className="font-bold text-red-900">Offer Rejected</p>
                    <p className="text-sm text-red-700">Rejected on {formatDate(currentLead.offerRejectedAt)}</p>
                    {currentLead.rejectionReason && (
                      <p className="text-sm text-red-800 mt-2 italic">&quot;{currentLead.rejectionReason}&quot;</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {currentLead.offerAmount === null ? (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p className="text-lg font-medium">No Offer Calculated Yet</p>
                    <p className="text-sm mt-2">Run &quot;Calculate BMV&quot; in the Validation tab to generate an offer</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Key Metrics Overview */}
                <div className="grid grid-cols-3 gap-4">
                  <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-blue-700 mb-1">Our Offer</p>
                          <p className="text-3xl font-bold text-blue-900">{formatCurrency(currentLead.offerAmount)}</p>
                          {currentLead.offerPercentage && (
                            <Badge className="mt-2 bg-blue-600 text-white border-0">
                              {Number(currentLead.offerPercentage).toFixed(1)}% of market value
                            </Badge>
                          )}
                        </div>
                        <Wallet className="h-8 w-8 text-blue-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-amber-700 mb-1">Asking Price</p>
                          <p className="text-3xl font-bold text-amber-900">{formatCurrency(currentLead.askingPrice)}</p>
                          {currentLead.estimatedMarketValue && currentLead.askingPrice && (
                            <Badge className="mt-2 bg-amber-600 text-white border-0">
                              {((Number(currentLead.askingPrice) / Number(currentLead.estimatedMarketValue)) * 100).toFixed(1)}% of market value
                            </Badge>
                          )}
                        </div>
                        <Home className="h-8 w-8 text-amber-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium text-purple-700 mb-1">Market Value</p>
                          <p className="text-3xl font-bold text-purple-900">
                            {currentLead.estimatedMarketValue ? formatCurrency(currentLead.estimatedMarketValue) : "—"}
                          </p>
                          {currentLead.bmvScore && (
                            <Badge className="mt-2 bg-purple-600 text-white border-0">
                              {Number(currentLead.bmvScore).toFixed(1)}% BMV
                            </Badge>
                          )}
                        </div>
                        <Target className="h-8 w-8 text-purple-600 opacity-80" />
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Investment Returns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Investment Returns
                    </CardTitle>
                    <CardDescription>Key metrics for this deal</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {currentLead.bmvScore && (
                        <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                          <p className="text-xs font-medium text-purple-700 mb-1">BMV %</p>
                          <p className="text-2xl font-bold text-purple-900">{Number(currentLead.bmvScore).toFixed(1)}%</p>
                        </div>
                      )}

                      {currentLead.estimatedAnnualRent && currentLead.offerAmount && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                          <p className="text-xs font-medium text-green-700 mb-1">Gross Yield</p>
                          <p className="text-2xl font-bold text-green-900">
                            {((Number(currentLead.estimatedAnnualRent) / Number(currentLead.offerAmount)) * 100).toFixed(2)}%
                          </p>
                        </div>
                      )}

                      {currentLead.profitPotential && currentLead.offerAmount && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-blue-700 mb-1">ROI</p>
                          <p className="text-2xl font-bold text-blue-900">
                            {((Number(currentLead.profitPotential) / Number(currentLead.offerAmount)) * 100).toFixed(1)}%
                          </p>
                        </div>
                      )}

                      {currentLead.profitPotential && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                          <p className="text-xs font-medium text-emerald-700 mb-1">Profit £</p>
                          <p className="text-2xl font-bold text-emerald-900">
                            {(Number(currentLead.profitPotential) / 1000).toFixed(0)}k
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Offer Strategy */}
                <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
                  <CardHeader>
                    <CardTitle className="text-slate-800">Offer Strategy</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      {currentLead.offerPercentage && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Offer set at {Number(currentLead.offerPercentage).toFixed(1)}% of market value</p>
                            <p className="text-slate-600 mt-1">
                              Adjusted based on vendor motivation
                              {currentLead.motivationScore && ` (${currentLead.motivationScore}/10)`}
                              {currentLead.urgencyLevel && `, urgency (${currentLead.urgencyLevel})`}
                              {currentLead.condition && `, and property condition (${currentLead.condition.replace(/_/g, ' ')})`}
                            </p>
                          </div>
                        </div>
                      )}

                      {currentLead.bmvScore && Number(currentLead.bmvScore) >= 15 && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Deal meets {Number(currentLead.bmvScore).toFixed(1)}% BMV threshold</p>
                            <p className="text-slate-600 mt-1">Target is 15%+ BMV for profitable investment opportunity</p>
                          </div>
                        </div>
                      )}

                      {currentLead.profitPotential && Number(currentLead.profitPotential) >= 10000 && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Profit potential exceeds £10,000 minimum</p>
                            <p className="text-slate-600 mt-1">
                              Net profit of {formatCurrency(currentLead.profitPotential)} after purchase and refurb
                            </p>
                          </div>
                        </div>
                      )}

                      {currentLead.estimatedMonthlyRent && (
                        <div className="flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-slate-900">Rental income of {formatCurrency(currentLead.estimatedMonthlyRent)}/month</p>
                            <p className="text-slate-600 mt-1">
                              Provides cash flow and
                              {currentLead.offerAmount && currentLead.estimatedAnnualRent && (
                                <> {((Number(currentLead.estimatedAnnualRent) / Number(currentLead.offerAmount)) * 100).toFixed(2)}% gross yield</>
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Additional Info */}
                {(currentLead.offerSentAt || currentLead.retryCount > 0) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Offer History</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {currentLead.offerSentAt && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Offer Sent</span>
                          <span className="font-medium">{formatDate(currentLead.offerSentAt)}</span>
                        </div>
                      )}
                      {currentLead.retryCount > 0 && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Follow-up Attempts</span>
                          <Badge variant="outline">{currentLead.retryCount}</Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="comparables" className="space-y-4">
            <VendorComparablesTab
              vendorLeadId={lead.id}
              askingPrice={typeof currentLead.askingPrice === 'number' ? currentLead.askingPrice : (currentLead.askingPrice ? Number(currentLead.askingPrice) : undefined)}
              propertyPostcode={currentLead.propertyPostcode}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  </>
  )
}

