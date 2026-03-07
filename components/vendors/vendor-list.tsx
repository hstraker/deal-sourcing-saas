"use client"

import { useState, useEffect, useMemo } from "react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
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
  Building2,
  Trash2,
  Loader2,
  TrendingUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  KeyRound,
  FileDown,
  Filter,
  Eye,
  MapPin,
  MapPinOff,
  Shield,
  Globe,
  Clock,
  Zap,
} from "lucide-react"
import { VendorLeadDetailModal } from "./vendor-lead-detail-modal"
import { PortalCheckBadge } from "./portal-check-badge"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface VendorLead {
  id: string
  facebookLeadId: string | null
  leadSource: string
  campaignId: string | null
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyPostcodeSource: string | null
  propertyPostcodeFixed: boolean
  askingPrice: number | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  estimatedMonthlyRent: number | null
  estimatedAnnualRent: number | null
  condition: string | null
  pipelineStage: string
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
  createdAt: Date
  updatedAt: Date
  lastContactAt: Date | null
  conversationStartedAt: Date | null
  dealId: string | null
  reservedByInvestorId: string | null
  reservedAt: Date | null
  reservation?: {
    id: string
    dealId: string
    investorId: string
    status: string
    reservationFee: number
    createdAt: Date
    updatedAt: Date
    investor: {
      id: string
      user: { firstName: string | null; lastName: string | null; email: string; phone: string | null }
    }
  } | null
  reservedByInvestor?: {
    id: string
    user: { firstName: string | null; lastName: string | null; email: string; phone: string | null }
  } | null
  latestCheckRisk: string | null
  latestCheckedAt: Date | null
  isTest: boolean
  smsMessages: Array<{
    id: string
    direction: string
    messageBody: string
    createdAt: Date
    aiGenerated: boolean
  }>
  _count: {
    smsMessages: number
    pipelineEvents?: number
  }
}

const PIPELINE_STAGES = [
  { id: "NEW_LEAD",             title: "New Lead" },
  { id: "AI_CONVERSATION",      title: "AI Conversation" },
  { id: "DEAL_VALIDATION",      title: "Deal Validation" },
  { id: "OFFER_MADE",           title: "Email Offer Sent" },
  { id: "VIDEO_SENT",           title: "Video Sent" },
  { id: "RETRY_1",              title: "Follow-up 1" },
  { id: "RETRY_2",              title: "Follow-up 2" },
  { id: "RETRY_3",              title: "Follow-up 3" },
  { id: "OFFER_ACCEPTED",       title: "Offer Accepted" },
  { id: "PAPERWORK_SENT",       title: "Paperwork Sent" },
  { id: "READY_FOR_INVESTORS",  title: "Ready for Investors" },
  { id: "DEAD_LEAD",            title: "Dead Lead" },
]

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD:             "bg-slate-100 text-slate-800 border-slate-300",
  AI_CONVERSATION:      "bg-cyan-100 text-cyan-800 border-cyan-300",
  DEAL_VALIDATION:      "bg-indigo-100 text-indigo-800 border-indigo-300",
  OFFER_MADE:           "bg-yellow-100 text-yellow-800 border-yellow-300",
  VIDEO_SENT:           "bg-purple-100 text-purple-800 border-purple-300",
  RETRY_1:              "bg-orange-100 text-orange-800 border-orange-300",
  RETRY_2:              "bg-red-100 text-red-800 border-red-300",
  RETRY_3:              "bg-rose-100 text-rose-800 border-rose-300",
  OFFER_ACCEPTED:       "bg-lime-100 text-lime-800 border-lime-300",
  PAPERWORK_SENT:       "bg-indigo-100 text-indigo-800 border-indigo-300",
  READY_FOR_INVESTORS:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  DEAD_LEAD:            "bg-gray-100 text-gray-800 border-gray-300",
  // Legacy stages kept for backward compat
  INITIAL_CONTACT:      "bg-blue-100 text-blue-800 border-blue-300",
  VALUATION_PENDING:    "bg-violet-100 text-violet-800 border-violet-300",
  VALUATION_COMPLETE:   "bg-purple-100 text-purple-800 border-purple-300",
  OFFER_PREPARATION:    "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
  OFFER_SENT:           "bg-pink-100 text-pink-800 border-pink-300",
  NEGOTIATION:          "bg-amber-100 text-amber-800 border-amber-300",
  SOLICITOR_INSTRUCTED: "bg-green-100 text-green-800 border-green-300",
  LOCKOUT_SIGNED:       "bg-emerald-100 text-emerald-800 border-emerald-300",
  COMPLETION_PENDING:   "bg-teal-100 text-teal-800 border-teal-300",
  COMPLETED:            "bg-green-200 text-green-900 border-green-400 font-bold",
  REJECTED:             "bg-red-100 text-red-800 border-red-300",
  WITHDRAWN:            "bg-gray-100 text-gray-800 border-gray-300",
  UNQUALIFIED:          "bg-orange-100 text-orange-800 border-orange-300",
}

const reservationStatusLabels: Record<string, string> = {
  pending:                "Pending",
  pack_sent:              "Pack Sent",
  fee_pending:            "Fee Requested",
  fee_paid:               "Fee Paid",
  proof_of_funds_pending: "POF Requested",
  pof_received:           "POF Received",
  verified:               "POF Verified",
  lock_out_sent:          "Lock-out Sent",
  locked_out:             "Lock-out Signed",
  completed:              "Completed",
}

const reservationStatusColors: Record<string, string> = {
  pending:                "bg-gray-100 text-gray-700 border-gray-200",
  pack_sent:              "bg-blue-100 text-blue-700 border-blue-200",
  fee_pending:            "bg-yellow-100 text-yellow-700 border-yellow-200",
  fee_paid:               "bg-emerald-100 text-emerald-700 border-emerald-200",
  proof_of_funds_pending: "bg-orange-100 text-orange-700 border-orange-200",
  pof_received:           "bg-sky-100 text-sky-700 border-sky-200",
  verified:               "bg-green-100 text-green-700 border-green-200",
  lock_out_sent:          "bg-purple-100 text-purple-700 border-purple-200",
  locked_out:             "bg-violet-100 text-violet-700 border-violet-200",
  completed:              "bg-emerald-100 text-emerald-700 border-emerald-200",
}

const formatTimeAgo = (date: Date | null) => {
  if (!date) return "Never"
  const now = new Date()
  const diff = now.getTime() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "Just now"
}

const motivationColor = (score: number | null) => {
  if (!score) return "bg-gray-100 text-gray-700"
  if (score >= 8) return "bg-green-100 text-green-700"
  if (score >= 5) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

const getInvestorName = (user: { firstName: string | null; lastName: string | null; email: string }) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

const transformLead = (lead: any): VendorLead => ({
  ...lead,
  askingPrice:           lead.askingPrice           ? Number(lead.askingPrice)           : null,
  bmvScore:              lead.bmvScore              ? Number(lead.bmvScore)              : null,
  estimatedMarketValue:  lead.estimatedMarketValue  ? Number(lead.estimatedMarketValue)  : null,
  estimatedRefurbCost:   lead.estimatedRefurbCost   ? Number(lead.estimatedRefurbCost)   : null,
  profitPotential:       lead.profitPotential       ? Number(lead.profitPotential)       : null,
  offerAmount:           lead.offerAmount           ? Number(lead.offerAmount)           : null,
  offerPercentage:       lead.offerPercentage       ? Number(lead.offerPercentage)       : null,
  estimatedMonthlyRent:  lead.estimatedMonthlyRent  ? Number(lead.estimatedMonthlyRent)  : null,
  estimatedAnnualRent:   lead.estimatedAnnualRent   ? Number(lead.estimatedAnnualRent)   : null,
  motivationScore:       lead.motivationScore       ? Number(lead.motivationScore)       : null,
  createdAt:             new Date(lead.createdAt),
  updatedAt:             new Date(lead.updatedAt),
  lastContactAt:         lead.lastContactAt         ? new Date(lead.lastContactAt)         : null,
  conversationStartedAt: lead.conversationStartedAt ? new Date(lead.conversationStartedAt) : null,
  offerSentAt:           lead.offerSentAt           ? new Date(lead.offerSentAt)           : null,
  offerAcceptedAt:       lead.offerAcceptedAt       ? new Date(lead.offerAcceptedAt)       : null,
  offerRejectedAt:       lead.offerRejectedAt       ? new Date(lead.offerRejectedAt)       : null,
  validatedAt:           lead.validatedAt           ? new Date(lead.validatedAt)           : null,
  reservedAt:            lead.reservedAt            ? new Date(lead.reservedAt)            : null,
  reservation: lead.reservation
    ? {
        ...lead.reservation,
        reservationFee: Number(lead.reservation.reservationFee),
        createdAt:      new Date(lead.reservation.createdAt),
        updatedAt:      new Date(lead.reservation.updatedAt),
      }
    : null,
  smsMessages: (lead.smsMessages ?? []).map((msg: any) => ({
    ...msg,
    createdAt: new Date(msg.createdAt),
  })),
})

export function VendorList() {
  const [vendors, setVendors] = useState<VendorLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [motivationFilter, setMotivationFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")
  const [selectedVendor, setSelectedVendor] = useState<VendorLead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [generatingPackId, setGeneratingPackId] = useState<string | null>(null)

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendor-pipeline/leads")
      if (!response.ok) throw new Error("Failed to fetch vendors")
      const data = await response.json()
      setVendors((data.leads ?? []).map(transformLead))
    } catch (error) {
      console.error("Error fetching vendors:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [])

  const filteredVendors = useMemo(() => {
    return vendors.filter((v) => {
      if (stageFilter !== "all" && v.pipelineStage !== stageFilter) return false
      if (motivationFilter !== "all") {
        const score = v.motivationScore
        if (!score) return false
        if (motivationFilter === "high"   && score < 8)          return false
        if (motivationFilter === "medium" && (score < 5 || score >= 8)) return false
        if (motivationFilter === "low"    && score >= 5)         return false
      }
      if (dateFrom) {
        if (v.createdAt < new Date(dateFrom)) return false
      }
      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (v.createdAt > toDate) return false
      }
      return true
    })
  }, [vendors, stageFilter, motivationFilter, dateFrom, dateTo])

  const handleViewDetails = (vendor: VendorLead) => {
    setSelectedVendor(vendor)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedVendor(null)
  }

  const handleUpdate = () => {
    fetchVendors()
    setSelectedIds(new Set())
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredVendors.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredVendors.map((v) => v.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const handleDeleteSingle = async (vendor: VendorLead) => {
    if (!confirm(`Delete ${vendor.vendorName}? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendor.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`${vendor.vendorName} deleted successfully`)
      fetchVendors()
    } catch {
      toast.error("Failed to delete vendor")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return
    if (!confirm(`Delete ${selectedIds.size} vendor${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) return
    setIsDeleting(true)
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) => fetch(`/api/vendor-leads/${id}`, { method: "DELETE" }))
      )
      const failedCount = results.filter((r) => !r.ok).length
      if (failedCount > 0) {
        toast.error(`Failed to delete ${failedCount} vendor${failedCount > 1 ? "s" : ""}`)
      } else {
        toast.success(`${selectedIds.size} vendor${selectedIds.size > 1 ? "s" : ""} deleted successfully`)
      }
      setSelectedIds(new Set())
      fetchVendors()
    } catch {
      toast.error("Failed to delete vendors")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkCalculateBMV = async () => {
    if (selectedIds.size === 0) return
    setIsCalculating(true)
    try {
      const results = await Promise.all(
        Array.from(selectedIds).map((id) =>
          fetch(`/api/vendor-leads/${id}/calculate-bmv`, { method: "POST" })
        )
      )
      const failedCount = results.filter((r) => !r.ok).length
      const successCount = results.length - failedCount
      if (failedCount > 0) {
        toast.warning(`Calculated ${successCount}, ${failedCount} failed`)
      } else {
        toast.success(`BMV calculated for ${successCount} vendor${successCount !== 1 ? "s" : ""}`)
      }
      fetchVendors()
    } catch {
      toast.error("Failed to calculate BMV")
    } finally {
      setIsCalculating(false)
    }
  }

  const handleGenerateInvestorPack = async (vendor: VendorLead, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!vendor.propertyAddress) {
      toast.error("Property address is required to generate investor pack")
      return
    }
    if (!vendor.askingPrice) {
      toast.error("Asking price is required to generate investor pack")
      return
    }
    setGeneratingPackId(vendor.id)
    try {
      const res = await fetch(`/api/vendor-leads/${vendor.id}/investor-pack`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Failed to generate investor pack")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `investor-pack-${vendor.propertyAddress.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Investor pack generated successfully")
      fetchVendors()
    } catch (error: any) {
      toast.error(error.message || "Failed to generate investor pack")
    } finally {
      setGeneratingPackId(null)
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading vendors...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between py-3">
            <span className="text-sm font-medium">
              {selectedIds.size} vendor{selectedIds.size > 1 ? "s" : ""} selected
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                Clear Selection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkCalculateBMV}
                disabled={isCalculating}
                className="border-green-300 bg-green-50 hover:bg-green-100"
              >
                {isCalculating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Calculate BMV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <CardTitle>Vendor Pipeline</CardTitle>
              <CardDescription>
                Track vendor leads through the acquisition pipeline ({filteredVendors.length} of {vendors.length})
              </CardDescription>
            </div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[175px]">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={motivationFilter} onValueChange={setMotivationFilter}>
                <SelectTrigger className="w-[165px]">
                  <SelectValue placeholder="All Motivation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Motivation</SelectItem>
                  <SelectItem value="high">High (8–10)</SelectItem>
                  <SelectItem value="medium">Medium (5–7)</SelectItem>
                  <SelectItem value="low">Low (1–4)</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[140px]"
                placeholder="From"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[140px]"
                placeholder="To"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredVendors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No vendor leads found</p>
              <p className="text-sm mt-2">
                {stageFilter !== "all"
                  ? `No vendor leads in the selected stage`
                  : "Vendor leads from the pipeline will appear here"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] pl-4">
                      <Checkbox
                        checked={selectedIds.size === filteredVendors.length && filteredVendors.length > 0}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Property</TableHead>
                    <TableHead>Asking / BMV</TableHead>
                    <TableHead>Yield</TableHead>
                    <TableHead>Offer</TableHead>
                    <TableHead>Investor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVendors.map((vendor) => {
                    const annualRent = vendor.estimatedAnnualRent ?? (vendor.estimatedMonthlyRent ? vendor.estimatedMonthlyRent * 12 : null)
                    const grossYield = annualRent && vendor.askingPrice
                      ? (annualRent / vendor.askingPrice) * 100
                      : null

                    return (
                      <TableRow key={vendor.id} className="cursor-pointer hover:bg-muted/40" onClick={() => handleViewDetails(vendor)}>
                        {/* Checkbox */}
                        <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(vendor.id)}
                            onCheckedChange={() => toggleSelect(vendor.id)}
                            aria-label={`Select ${vendor.vendorName}`}
                          />
                        </TableCell>

                        {/* Vendor */}
                        <TableCell>
                          <div className="font-medium whitespace-nowrap">{vendor.vendorName}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {vendor.leadSource ? vendor.leadSource.replace(/_/g, " ") : "Direct"}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {vendor._count.smsMessages > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {vendor._count.smsMessages} msg{vendor._count.smsMessages !== 1 ? "s" : ""}
                              </span>
                            )}
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span suppressHydrationWarning className="inline-flex items-center gap-0.5 text-xs text-muted-foreground cursor-default">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    {formatTimeAgo(vendor.lastContactAt)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Last contact: {vendor.lastContactAt
                                    ? new Date(vendor.lastContactAt).toLocaleString("en-GB")
                                    : "Never"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>

                        {/* Contact */}
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
                              <Phone className="h-3 w-3 shrink-0" />
                              {vendor.vendorPhone}
                            </div>
                            {vendor.vendorEmail && (
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap max-w-[180px] overflow-hidden">
                                <Mail className="h-3 w-3 shrink-0" />
                                <span className="truncate">{vendor.vendorEmail}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Stage */}
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium border whitespace-nowrap self-start",
                              STAGE_COLORS[vendor.pipelineStage] ?? "bg-gray-100 text-gray-800 border-gray-300"
                            )}>
                              {PIPELINE_STAGES.find((s) => s.id === vendor.pipelineStage)?.title
                                ?? vendor.pipelineStage.replace(/_/g, " ")}
                            </span>
                            {vendor.motivationScore !== null && (
                              <TooltipProvider delayDuration={150}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className={cn(
                                      "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium self-start cursor-default",
                                      motivationColor(vendor.motivationScore)
                                    )}>
                                      <Zap className="h-2.5 w-2.5 shrink-0" />
                                      {vendor.motivationScore}/10
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs">
                                    Motivation: {vendor.motivationScore}/10
                                    {vendor.urgencyLevel && ` · ${vendor.urgencyLevel}`}
                                    {vendor.timelineDays && ` (${vendor.timelineDays}d)`}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        </TableCell>

                        {/* Property */}
                        <TableCell>
                          {vendor.propertyAddress ? (
                            <div>
                              <div className="text-sm font-medium max-w-[180px] truncate">{vendor.propertyAddress}</div>
                              <VendorPostcodeBadge
                                postcode={vendor.propertyPostcode}
                                source={vendor.propertyPostcodeSource}
                                fixed={vendor.propertyPostcodeFixed}
                              />
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {[
                                  vendor.bedrooms && `${vendor.bedrooms}bd`,
                                  vendor.propertyType && vendor.propertyType.replace(/_/g, " "),
                                  vendor.condition && vendor.condition.replace(/_/g, " "),
                                ].filter(Boolean).join(" · ")}
                              </div>
                              {(vendor.latestCheckRisk || vendor.isTest) && (
                                <div className="mt-1">
                                  <PortalCheckBadge
                                    risk={vendor.latestCheckRisk as any}
                                    isMockData={vendor.isTest}
                                  />
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>

                        {/* Asking / BMV */}
                        <TableCell>
                          <div className="font-medium whitespace-nowrap">{formatCurrency(vendor.askingPrice)}</div>
                          {vendor.estimatedMarketValue && (
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              MV {formatCurrency(vendor.estimatedMarketValue)}
                            </div>
                          )}
                          <TooltipProvider delayDuration={150}>
                            <div className="flex items-center gap-0.5 mt-1">
                              {/* BMV score */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className={cn(
                                    "inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-semibold cursor-default",
                                    vendor.bmvScore === null
                                      ? "text-muted-foreground/40"
                                      : vendor.bmvScore >= 25
                                      ? "bg-green-100 text-green-700"
                                      : vendor.bmvScore >= 15
                                      ? "bg-blue-100 text-blue-700"
                                      : "bg-gray-100 text-gray-500"
                                  )}>
                                    <TrendingUp className="h-3 w-3 shrink-0" />
                                    {vendor.bmvScore !== null ? `${vendor.bmvScore.toFixed(1)}%` : "—"}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {vendor.bmvScore === null
                                    ? "BMV not yet calculated"
                                    : `${vendor.bmvScore.toFixed(1)}% below market value`}
                                </TooltipContent>
                              </Tooltip>

                              {/* Validation icon */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex items-center justify-center h-6 w-6 rounded cursor-default">
                                    {vendor.bmvScore === null ? (
                                      <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
                                    ) : vendor.validationPassed ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                                    ) : (
                                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {vendor.bmvScore === null
                                    ? "BMV not calculated — run analysis first"
                                    : vendor.validationPassed
                                    ? "Deal passed validation criteria"
                                    : "Deal failed validation criteria"}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </TooltipProvider>
                        </TableCell>

                        {/* Yield */}
                        <TableCell>
                          {grossYield !== null ? (
                            <div>
                              <span className="text-blue-600 font-medium">
                                {grossYield.toFixed(1)}%
                              </span>
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatCurrency(vendor.estimatedMonthlyRent)}/mo
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>

                        {/* Offer */}
                        <TableCell>
                          {vendor.offerAmount ? (
                            <div className="text-sm space-y-0.5">
                              <div className="font-medium whitespace-nowrap">{formatCurrency(vendor.offerAmount)}</div>
                              {vendor.offerPercentage !== null && (
                                <div className="text-xs text-muted-foreground">
                                  {vendor.offerPercentage.toFixed(1)}% BMV
                                </div>
                              )}
                              {vendor.offerSentAt && (
                                <div suppressHydrationWarning className="text-xs text-muted-foreground whitespace-nowrap">
                                  Sent {new Date(vendor.offerSentAt).toLocaleDateString("en-GB")}
                                </div>
                              )}
                              {vendor.offerAcceptedAt && (
                                <div suppressHydrationWarning className="text-xs text-green-600 whitespace-nowrap">
                                  Accepted {new Date(vendor.offerAcceptedAt).toLocaleDateString("en-GB")}
                                </div>
                              )}
                              {vendor.offerRejectedAt && (
                                <div suppressHydrationWarning className="text-xs text-red-600 whitespace-nowrap">
                                  Rejected {new Date(vendor.offerRejectedAt).toLocaleDateString("en-GB")}
                                </div>
                              )}
                              {vendor.retryCount > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {vendor.retryCount} retr{vendor.retryCount === 1 ? "y" : "ies"}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No offer</span>
                          )}
                        </TableCell>

                        {/* Investor reservation */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className={cn(
                                    "h-8 w-8 p-0",
                                    vendor.reservation
                                      ? cn(reservationStatusColors[vendor.reservation.status], "border hover:opacity-80")
                                      : "text-muted-foreground/30 cursor-default hover:bg-transparent"
                                  )}
                                  onClick={vendor.reservation ? () => handleViewDetails(vendor) : undefined}
                                  tabIndex={vendor.reservation ? 0 : -1}
                                >
                                  <KeyRound className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              {vendor.reservation ? (
                                <TooltipContent side="left" className="text-xs max-w-[220px] space-y-1 p-3">
                                  <div className="flex items-center gap-1.5 mb-2">
                                    <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-semibold border", reservationStatusColors[vendor.reservation.status])}>
                                      {reservationStatusLabels[vendor.reservation.status] || vendor.reservation.status}
                                    </span>
                                  </div>
                                  <p className="font-semibold">{getInvestorName(vendor.reservation.investor.user)}</p>
                                  <p className="text-muted-foreground">{vendor.reservation.investor.user.email}</p>
                                  {vendor.reservation.investor.user.phone && (
                                    <p className="text-muted-foreground">{vendor.reservation.investor.user.phone}</p>
                                  )}
                                  <div className="border-t pt-1 mt-1">
                                    <p className="text-muted-foreground">
                                      Fee: <span className="text-foreground font-medium">£{vendor.reservation.reservationFee.toLocaleString()}</span>
                                    </p>
                                    {vendor.reservedAt && (
                                      <p suppressHydrationWarning className="text-muted-foreground">
                                        Reserved {formatTimeAgo(vendor.reservedAt)}
                                      </p>
                                    )}
                                  </div>
                                </TooltipContent>
                              ) : (
                                <TooltipContent side="left" className="text-xs">
                                  No investor reservation
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>

                        {/* Actions */}
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1">
                            <TooltipProvider delayDuration={300}>
                              {/* Generate investor pack */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => handleGenerateInvestorPack(vendor, e)}
                                    disabled={generatingPackId === vendor.id || !vendor.propertyAddress || !vendor.askingPrice}
                                  >
                                    {generatingPackId === vendor.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <FileDown className="h-4 w-4" />
                                    )}
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  {!vendor.propertyAddress || !vendor.askingPrice
                                    ? "Address & price required"
                                    : "Generate investor pack"}
                                </TooltipContent>
                              </Tooltip>

                              {/* View details */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewDetails(vendor)}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  View details
                                </TooltipContent>
                              </Tooltip>

                              {/* Delete */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDeleteSingle(vendor)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  Delete vendor
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedVendor && (
        <VendorLeadDetailModal
          lead={selectedVendor as any}
          open={isModalOpen}
          onOpenChange={handleModalClose}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}

// ── Vendor lead postcode badge ─────────────────────────────────────────────────

function VendorPostcodeBadge({
  postcode,
  source,
  fixed,
}: {
  postcode: string | null
  source: string | null
  fixed: boolean
}) {
  const pc = postcode?.trim().toUpperCase() ?? null
  const isFullPostcode = pc ? /^[A-Z]{1,2}\d{1,2}[A-Z]?\s\d[A-Z]{2}$/.test(pc) : false
  const isOutcodeOnly = pc && !isFullPostcode && /^[A-Z]{1,2}\d{1,2}[A-Z]?$/.test(pc)

  if (!pc || (!isFullPostcode && !isOutcodeOnly)) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-red-600 mt-0.5">
        <MapPinOff className="h-2.5 w-2.5 shrink-0" />
        No postcode
      </span>
    )
  }

  if (isOutcodeOnly) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-amber-600 mt-0.5">
        <MapPin className="h-2.5 w-2.5 shrink-0" />
        {pc} (outcode only)
      </span>
    )
  }

  if (fixed && source === "land_registry") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 mt-0.5 cursor-default">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {pc}
              <Shield className="h-2.5 w-2.5 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Resolved via Land Registry / Price Paid Data
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (fixed && source === "postcodes_io") {
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-teal-700 mt-0.5 cursor-default">
              <MapPin className="h-2.5 w-2.5 shrink-0" />
              {pc}
              <Globe className="h-2.5 w-2.5 shrink-0" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            Resolved via postcodes.io (representative for area)
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground mt-0.5">
      <MapPin className="h-2.5 w-2.5 shrink-0" />
      {pc}
    </span>
  )
}
