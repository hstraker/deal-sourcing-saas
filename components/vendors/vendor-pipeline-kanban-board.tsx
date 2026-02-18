"use client"

import { useState, useEffect, useMemo } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PipelineStage } from "@prisma/client"
import { cn } from "@/lib/utils"
import { MessageSquare, Phone, MapPin, Clock, Filter, Download, KeyRound } from "lucide-react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { VendorLeadDetailModal } from "./vendor-lead-detail-modal"
import { PipelineStatsCards } from "./pipeline-stats-cards"
import { formatCurrency } from "@/lib/format"

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
  askingPrice: number | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  estimatedMonthlyRent: number | null
  estimatedAnnualRent: number | null
  condition: string | null
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
  smsMessages: Array<{
    id: string
    direction: string
    messageBody: string
    createdAt: Date
  }>
  _count: {
    smsMessages: number
    pipelineEvents: number
  }
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

const getInvestorName = (user: { firstName: string | null; lastName: string | null; email: string }) =>
  [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email

const PIPELINE_COLUMNS: Array<{
  id: PipelineStage
  title: string
  description: string
  color: string
}> = [
    {
      id: "NEW_LEAD",
      title: "New Leads",
      description: "Fresh leads from ads",
      color: "border-l-slate-400"
    },
    {
      id: "AI_CONVERSATION",
      title: "In Conversation",
      description: "AI gathering details",
      color: "border-l-blue-500"
    },
    {
      id: "DEAL_VALIDATION",
      title: "Validating",
      description: "BMV analysis in progress",
      color: "border-l-amber-500"
    },
    {
      id: "OFFER_MADE",
      title: "Offer Made",
      description: "Waiting for response",
      color: "border-l-yellow-500"
    },
    {
      id: "VIDEO_SENT",
      title: "Video Sent",
      description: "Following up",
      color: "border-l-purple-500"
    },
    {
      id: "RETRY_1",
      title: "Retry 1",
      description: "First retry attempt",
      color: "border-l-orange-500"
    },
    {
      id: "RETRY_2",
      title: "Retry 2",
      description: "Second retry attempt",
      color: "border-l-red-500"
    },
    {
      id: "RETRY_3",
      title: "Retry 3",
      description: "Final retry attempt",
      color: "border-l-rose-500"
    },
    {
      id: "OFFER_ACCEPTED",
      title: "Accepted",
      description: "Offer accepted!",
      color: "border-l-green-600"
    },
    {
      id: "PAPERWORK_SENT",
      title: "Paperwork",
      description: "Lock-out sent",
      color: "border-l-indigo-500"
    },
    {
      id: "READY_FOR_INVESTORS",
      title: "Ready",
      description: "Live for investors",
      color: "border-l-emerald-600"
    },
    {
      id: "DEAD_LEAD",
      title: "Dead",
      description: "No longer active",
      color: "border-l-gray-400"
    },
  ]

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

const motivationBadgeColor = (score: number | null) => {
  if (!score) return "bg-gray-100 text-gray-700"
  if (score >= 8) return "bg-green-100 text-green-700"
  if (score >= 5) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

export function VendorPipelineKanbanBoard() {
  const [leads, setLeads] = useState<VendorLead[]>([])
  const [stats, setStats] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedLead, setSelectedLead] = useState<VendorLead | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  // Filter state
  const [stageFilter, setStageFilter] = useState<string>("all")
  const [motivationFilter, setMotivationFilter] = useState<string>("all")
  const [dateFrom, setDateFrom] = useState<string>("")
  const [dateTo, setDateTo] = useState<string>("")

  const fetchData = async () => {
    try {
      setRefreshing(true)
      const [leadsRes, statsRes] = await Promise.all([
        fetch("/api/vendor-pipeline/leads"),
        fetch("/api/vendor-pipeline/stats"),
      ])

      if (!leadsRes.ok || !statsRes.ok) {
        throw new Error("Failed to fetch data")
      }

      const leadsData = await leadsRes.json()
      const statsData = await statsRes.json()

      // Transform decimal fields to numbers
      const transformedLeads = leadsData.leads.map((lead: any) => ({
        ...lead,
        askingPrice: lead.askingPrice ? Number(lead.askingPrice) : null,
        bmvScore: lead.bmvScore ? Number(lead.bmvScore) : null,
        estimatedMarketValue: lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
        estimatedRefurbCost: lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
        profitPotential: lead.profitPotential ? Number(lead.profitPotential) : null,
        offerAmount: lead.offerAmount ? Number(lead.offerAmount) : null,
        offerPercentage: lead.offerPercentage ? Number(lead.offerPercentage) : null,
        estimatedMonthlyRent: lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
        estimatedAnnualRent: lead.estimatedAnnualRent ? Number(lead.estimatedAnnualRent) : null,
        motivationScore: lead.motivationScore ? Number(lead.motivationScore) : null,
        createdAt: new Date(lead.createdAt),
        updatedAt: new Date(lead.updatedAt),
        lastContactAt: lead.lastContactAt ? new Date(lead.lastContactAt) : null,
        conversationStartedAt: lead.conversationStartedAt ? new Date(lead.conversationStartedAt) : null,
        offerSentAt: lead.offerSentAt ? new Date(lead.offerSentAt) : null,
        offerAcceptedAt: lead.offerAcceptedAt ? new Date(lead.offerAcceptedAt) : null,
        offerRejectedAt: lead.offerRejectedAt ? new Date(lead.offerRejectedAt) : null,
        reservedAt: lead.reservedAt ? new Date(lead.reservedAt) : null,
        reservation: lead.reservation
          ? {
              ...lead.reservation,
              reservationFee: Number(lead.reservation.reservationFee),
              createdAt: new Date(lead.reservation.createdAt),
              updatedAt: new Date(lead.reservation.updatedAt),
            }
          : null,
        smsMessages: lead.smsMessages?.map((msg: any) => ({
          ...msg,
          createdAt: new Date(msg.createdAt),
        })) || [],
      }))

      setLeads(transformedLeads)
      setStats(statsData.stats)
    } catch (error) {
      console.error("Error fetching vendor pipeline data:", error)
    } finally {
      setIsLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchData()
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchData()
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Filter leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (stageFilter !== "all" && lead.pipelineStage !== stageFilter) return false

      if (motivationFilter !== "all") {
        const score = lead.motivationScore
        if (!score) return false
        if (motivationFilter === "high" && score < 8) return false
        if (motivationFilter === "medium" && (score < 5 || score >= 8)) return false
        if (motivationFilter === "low" && score >= 5) return false
      }

      if (dateFrom) {
        const fromDate = new Date(dateFrom)
        if (lead.createdAt < fromDate) return false
      }

      if (dateTo) {
        const toDate = new Date(dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (lead.createdAt > toDate) return false
      }

      return true
    })
  }, [leads, stageFilter, motivationFilter, dateFrom, dateTo])

  const groupLeadsByStage = (leads: VendorLead[]) => {
    return PIPELINE_COLUMNS.reduce<Record<PipelineStage, VendorLead[]>>((acc, column) => {
      acc[column.id] = leads.filter((lead) => lead.pipelineStage === column.id)
      return acc
    }, {} as Record<PipelineStage, VendorLead[]>)
  }

  const leadsByStage = groupLeadsByStage(filteredLeads)

  // Handle drag and drop
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const leadId = result.draggableId
    const newStage = result.destination.droppableId as PipelineStage

    // Optimistic update
    setLeads((prevLeads) =>
      prevLeads.map((lead) =>
        lead.id === leadId ? { ...lead, pipelineStage: newStage } : lead
      )
    )

    try {
      const response = await fetch(`/api/vendor-pipeline/leads/${leadId}/update-stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      })

      if (!response.ok) {
        throw new Error("Failed to update stage")
      }

      // Refresh data to get latest state
      await fetchData()
    } catch (error) {
      console.error("Error updating stage:", error)
      // Revert on error
      await fetchData()
    }
  }

  // Export to CSV
  const handleExport = () => {
    const params = new URLSearchParams()
    if (stageFilter !== "all") params.append("stage", stageFilter)
    if (motivationFilter !== "all") {
      const minScore = motivationFilter === "high" ? "8" : motivationFilter === "medium" ? "5" : "1"
      params.append("motivation_min", minScore)
    }
    if (dateFrom) params.append("date_from", dateFrom)
    if (dateTo) params.append("date_to", dateTo)

    const url = `/api/vendor-pipeline/export?${params.toString()}`
    window.open(url, "_blank")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading vendor pipeline...</div>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <PipelineStatsCards stats={stats} refreshing={refreshing} onRefresh={fetchData} />

        {/* Filters and View Controls */}
        <Card className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters:</span>
            </div>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {PIPELINE_COLUMNS.map((col) => (
                  <SelectItem key={col.id} value={col.id}>
                    {col.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={motivationFilter} onValueChange={setMotivationFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Motivation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Motivation</SelectItem>
                <SelectItem value="high">High (8-10)</SelectItem>
                <SelectItem value="medium">Medium (5-7)</SelectItem>
                <SelectItem value="low">Low (1-4)</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              placeholder="From Date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-[150px]"
            />

            <Input
              type="date"
              placeholder="To Date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-[150px]"
            />

            <div className="flex-1" />

            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </Card>

        {/* Kanban View */}
        <DragDropContext onDragEnd={handleDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4">
              {PIPELINE_COLUMNS.map((column) => {
                const columnLeads = leadsByStage[column.id]

                return (
                  <Droppable key={column.id} droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          "flex-shrink-0 w-80",
                          snapshot.isDraggingOver && "bg-muted/50 rounded-lg p-2"
                        )}
                      >
                        <div className="mb-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-sm">{column.title}</h3>
                            <Badge variant="secondary" className="text-xs">
                              {columnLeads.length}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {column.description}
                          </p>
                        </div>

                        <div className="space-y-3">
                          {columnLeads.map((lead, index) => (
                            <Draggable key={lead.id} draggableId={lead.id} index={index}>
                              {(provided, snapshot) => (
                                <Card
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={cn(
                                    "cursor-pointer hover:shadow-md transition-shadow border-l-4",
                                    column.color,
                                    snapshot.isDragging && "shadow-lg rotate-2"
                                  )}
                                  onClick={() => setSelectedLead(lead)}
                                >
                                  <div className="p-4">
                                    <div className="flex items-start justify-between mb-2">
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm mb-1 truncate">
                                          {lead.vendorName}
                                        </div>
                                        {lead.propertyAddress && (
                                          <div className="text-xs text-muted-foreground mb-2 truncate">
                                            <MapPin className="h-3 w-3 inline mr-1" />
                                            {lead.propertyAddress}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                          <Phone className="h-3 w-3" />
                                          <span className="truncate">{lead.vendorPhone}</span>
                                        </div>
                                      </div>
                                      {lead.motivationScore !== null && (
                                        <Badge
                                          variant="outline"
                                          className={cn(
                                            "ml-2 text-xs",
                                            motivationBadgeColor(lead.motivationScore)
                                          )}
                                        >
                                          {lead.motivationScore}/10
                                        </Badge>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t flex-wrap">
                                      {lead.askingPrice && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Ask: </span>
                                          <span className="font-medium">
                                            {formatCurrency(lead.askingPrice)}
                                          </span>
                                        </div>
                                      )}
                                      {lead.bmvScore !== null && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">BMV: </span>
                                          <span className="font-medium text-green-600">
                                            {lead.bmvScore.toFixed(1)}%
                                          </span>
                                        </div>
                                      )}
                                      {lead.estimatedMonthlyRent && lead.askingPrice && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Yield: </span>
                                          <span className="font-medium text-blue-600">
                                            {((Number(lead.estimatedAnnualRent || lead.estimatedMonthlyRent * 12) / Number(lead.askingPrice)) * 100).toFixed(1)}%
                                          </span>
                                        </div>
                                      )}
                                      {lead.estimatedMonthlyRent && (
                                        <div className="text-xs">
                                          <span className="text-muted-foreground">Rent: </span>
                                          <span className="font-medium">
                                            {formatCurrency(lead.estimatedMonthlyRent)}/mo
                                          </span>
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex items-center justify-between mt-2 pt-2 border-t text-xs text-muted-foreground">
                                      <div className="flex items-center gap-1">
                                        <MessageSquare className="h-3 w-3" />
                                        <span>{lead._count.smsMessages} msgs</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        <span suppressHydrationWarning>{formatTimeAgo(lead.lastContactAt)}</span>
                                      </div>
                                    </div>

                                    {/* Investor reservation chip */}
                                    {lead.reservation && (
                                      <div className="mt-2 pt-2 border-t">
                                        <TooltipProvider delayDuration={200}>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div
                                                className={cn(
                                                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium cursor-default w-full",
                                                  reservationStatusColors[lead.reservation.status] || "bg-gray-100 text-gray-700 border-gray-200"
                                                )}
                                              >
                                                <KeyRound className="h-3 w-3 shrink-0" />
                                                <span className="shrink-0">{reservationStatusLabels[lead.reservation.status] || lead.reservation.status}</span>
                                                <span className="opacity-50 shrink-0">·</span>
                                                <span className="truncate">{getInvestorName(lead.reservation.investor.user)}</span>
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                                              <p className="font-medium mb-1">Investor Reservation</p>
                                              <p>{getInvestorName(lead.reservation.investor.user)}</p>
                                              <p className="text-muted-foreground">{lead.reservation.investor.user.email}</p>
                                              {lead.reservation.investor.user.phone && (
                                                <p className="text-muted-foreground">{lead.reservation.investor.user.phone}</p>
                                              )}
                                              <p className="text-muted-foreground mt-1">
                                                Fee: £{lead.reservation.reservationFee.toLocaleString()}
                                              </p>
                                              {lead.reservedAt && (
                                                <p suppressHydrationWarning className="text-muted-foreground">
                                                  Reserved {formatTimeAgo(lead.reservedAt)}
                                                </p>
                                              )}
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    )}
                                  </div>
                                </Card>
                              )} 
                          </Draggable>
                          ))}
                          {provided.placeholder}
                          {columnLeads.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                              No leads in this stage
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                )
              })}
            </div>
          </DragDropContext>

        {selectedLead && (
          <VendorLeadDetailModal
            lead={selectedLead}
            open={!!selectedLead}
            onOpenChange={(open) => !open && setSelectedLead(null)}
            onUpdate={fetchData}
          />
        )}
      </div>
    </>
  )
}