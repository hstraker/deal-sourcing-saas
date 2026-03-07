"use client"

import { useState, useEffect, useMemo } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
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
import { PortalCheckBadge } from "./portal-check-badge"

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
  latestCheckRisk: string | null
  latestCheckedAt: Date | null
  isTest: boolean
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

// accent = Tailwind colour for the column's top-border and count badge
const PIPELINE_COLUMNS: Array<{
  id: PipelineStage
  title: string
  description: string
  accent: string        // top-border colour (Tailwind arbitrary)
  countBg: string       // count pill background
}> = [
  { id: "NEW_LEAD",          title: "New Leads",      description: "Fresh leads from ads",        accent: "#94A3B8", countBg: "bg-slate-100 text-slate-600" },
  { id: "AI_CONVERSATION",   title: "In Conversation", description: "AI gathering details",        accent: "#3B82F6", countBg: "bg-blue-100 text-blue-700" },
  { id: "DEAL_VALIDATION",   title: "Validating",     description: "BMV analysis in progress",    accent: "#F59E0B", countBg: "bg-amber-100 text-amber-700" },
  { id: "OFFER_MADE",        title: "Offer Made",     description: "Waiting for response",        accent: "#EAB308", countBg: "bg-yellow-100 text-yellow-700" },
  { id: "VIDEO_SENT",        title: "Video Sent",     description: "Following up",                accent: "#A855F7", countBg: "bg-purple-100 text-purple-700" },
  { id: "RETRY_1",           title: "Retry 1",        description: "First retry attempt",         accent: "#F97316", countBg: "bg-orange-100 text-orange-700" },
  { id: "RETRY_2",           title: "Retry 2",        description: "Second retry attempt",        accent: "#EF4444", countBg: "bg-red-100 text-red-700" },
  { id: "RETRY_3",           title: "Retry 3",        description: "Final retry attempt",         accent: "#F43F5E", countBg: "bg-rose-100 text-rose-700" },
  { id: "OFFER_ACCEPTED",    title: "Accepted",       description: "Offer accepted!",             accent: "#16A34A", countBg: "bg-green-100 text-green-700" },
  { id: "PAPERWORK_SENT",    title: "Paperwork",      description: "Lock-out sent",               accent: "#6366F1", countBg: "bg-indigo-100 text-indigo-700" },
  { id: "READY_FOR_INVESTORS", title: "Ready",        description: "Live for investors",          accent: "#059669", countBg: "bg-emerald-100 text-emerald-700" },
  { id: "DEAD_LEAD",         title: "Dead",           description: "No longer active",            accent: "#9CA3AF", countBg: "bg-gray-100 text-gray-500" },
]

const formatTimeAgo = (date: Date | null) => {
  if (!date) return "Never"
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "Just now"
}

const motivationColors = (score: number | null) => {
  if (!score) return "bg-gray-100 text-gray-600"
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

      if (!leadsRes.ok || !statsRes.ok) throw new Error("Failed to fetch data")

      const leadsData = await leadsRes.json()
      const statsData = await statsRes.json()

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
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      if (dateFrom && lead.createdAt < new Date(dateFrom)) return false
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (lead.createdAt > to) return false
      }
      return true
    })
  }, [leads, stageFilter, motivationFilter, dateFrom, dateTo])

  const leadsByStage = useMemo(() => {
    return PIPELINE_COLUMNS.reduce<Record<PipelineStage, VendorLead[]>>((acc, col) => {
      acc[col.id] = filteredLeads.filter((l) => l.pipelineStage === col.id)
      return acc
    }, {} as Record<PipelineStage, VendorLead[]>)
  }, [filteredLeads])

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return
    const leadId = result.draggableId
    const newStage = result.destination.droppableId as PipelineStage

    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, pipelineStage: newStage } : l))

    try {
      const response = await fetch(`/api/vendor-pipeline/leads/${leadId}/update-stage`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineStage: newStage }),
      })
      if (!response.ok) throw new Error("Failed to update stage")
      await fetchData()
    } catch {
      await fetchData()
    }
  }

  const handleExport = () => {
    const params = new URLSearchParams()
    if (stageFilter !== "all") params.append("stage", stageFilter)
    if (motivationFilter !== "all") {
      const minScore = motivationFilter === "high" ? "8" : motivationFilter === "medium" ? "5" : "1"
      params.append("motivation_min", minScore)
    }
    if (dateFrom) params.append("date_from", dateFrom)
    if (dateTo) params.append("date_to", dateTo)
    window.open(`/api/vendor-pipeline/export?${params.toString()}`, "_blank")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-gray-400">Loading vendor pipeline…</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-5">
        <PipelineStatsCards stats={stats} refreshing={refreshing} onRefresh={fetchData} />

        {/* Filters */}
        <div className="ds-card p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
              <Filter className="h-4 w-4" />
              Filters
            </div>

            <Select value={stageFilter} onValueChange={setStageFilter}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
                <SelectValue placeholder="All Stages" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                {PIPELINE_COLUMNS.map((col) => (
                  <SelectItem key={col.id} value={col.id}>{col.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={motivationFilter} onValueChange={setMotivationFilter}>
              <SelectTrigger className="h-8 w-[160px] text-sm">
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
              className="h-8 w-[140px] text-sm"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-[140px] text-sm"
            />

            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={handleExport} className="h-8 text-sm">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Kanban */}
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {PIPELINE_COLUMNS.map((column) => {
              const columnLeads = leadsByStage[column.id]

              return (
                <Droppable key={column.id} droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={cn(
                        "flex-shrink-0 w-72 rounded-xl transition-colors duration-150",
                        snapshot.isDraggingOver ? "bg-[#EFF6FF]" : "bg-[#F4F5F7]"
                      )}
                    >
                      {/* Column header */}
                      <div
                        className="rounded-t-xl px-3 pt-3 pb-2"
                        style={{ borderTop: `3px solid ${column.accent}` }}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {column.title}
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", column.countBg)}>
                            {columnLeads.length}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-gray-400">{column.description}</p>
                      </div>

                      {/* Cards */}
                      <div className="space-y-2 px-2 pb-3 min-h-[80px]">
                        {columnLeads.map((lead, index) => (
                          <Draggable key={lead.id} draggableId={lead.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => setSelectedLead(lead)}
                                className={cn(
                                  "ds-card ds-card-hover cursor-pointer border-l-[3px] p-3",
                                  snapshot.isDragging && "shadow-dropdown rotate-1 opacity-95"
                                )}
                                style={{
                                  ...(provided.draggableProps.style as React.CSSProperties),
                                  borderLeftColor: column.accent,
                                }}
                              >
                                {/* Vendor name + address */}
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-semibold text-gray-800 truncate">
                                      {lead.vendorName}
                                    </p>
                                    {lead.propertyAddress && (
                                      <p className="flex items-center gap-1 text-[11px] text-gray-400 truncate mt-0.5">
                                        <MapPin className="h-2.5 w-2.5 shrink-0" />
                                        {lead.propertyAddress}
                                      </p>
                                    )}
                                    <p className="flex items-center gap-1 text-[11px] text-gray-400 truncate mt-0.5">
                                      <Phone className="h-2.5 w-2.5 shrink-0" />
                                      {lead.vendorPhone}
                                    </p>
                                  </div>
                                  {lead.motivationScore !== null && (
                                    <span className={cn(
                                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                                      motivationColors(lead.motivationScore)
                                    )}>
                                      {lead.motivationScore}/10
                                    </span>
                                  )}
                                </div>

                                {/* Financial metrics */}
                                {(lead.askingPrice || lead.bmvScore !== null || lead.estimatedMonthlyRent) && (
                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--ds-border)] pt-2 mt-2">
                                    {lead.askingPrice && (
                                      <p className="text-[11px] text-gray-500">
                                        Ask <span className="font-semibold text-gray-700">{formatCurrency(lead.askingPrice)}</span>
                                      </p>
                                    )}
                                    {lead.bmvScore !== null && (
                                      <p className="text-[11px] text-gray-500">
                                        BMV <span className="font-semibold text-green-600">{lead.bmvScore.toFixed(1)}%</span>
                                      </p>
                                    )}
                                    {lead.estimatedMonthlyRent && lead.askingPrice && (
                                      <p className="text-[11px] text-gray-500">
                                        Yield <span className="font-semibold text-[#2563EB]">
                                          {((Number(lead.estimatedAnnualRent || lead.estimatedMonthlyRent * 12) / Number(lead.askingPrice)) * 100).toFixed(1)}%
                                        </span>
                                      </p>
                                    )}
                                    {lead.estimatedMonthlyRent && (
                                      <p className="text-[11px] text-gray-500">
                                        Rent <span className="font-semibold text-gray-700">{formatCurrency(lead.estimatedMonthlyRent)}/mo</span>
                                      </p>
                                    )}
                                  </div>
                                )}

                                {/* Footer: messages + time */}
                                <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--ds-border)] text-[11px] text-gray-400">
                                  <span className="flex items-center gap-1">
                                    <MessageSquare className="h-3 w-3" />
                                    {lead._count.smsMessages}
                                  </span>
                                  <span className="flex items-center gap-1" suppressHydrationWarning>
                                    <Clock className="h-3 w-3" />
                                    {formatTimeAgo(lead.lastContactAt)}
                                  </span>
                                </div>

                                {/* Portal check badge */}
                                {(lead.latestCheckRisk || lead.isTest) && (
                                  <div className="mt-2 pt-2 border-t border-[var(--ds-border)]">
                                    <PortalCheckBadge risk={lead.latestCheckRisk as any} isMockData={lead.isTest} />
                                  </div>
                                )}

                                {/* Investor reservation chip */}
                                {lead.reservation && (
                                  <div className="mt-2 pt-2 border-t border-[var(--ds-border)]">
                                    <TooltipProvider delayDuration={200}>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className={cn(
                                            "inline-flex w-full items-center gap-1.5 rounded border px-2 py-1 text-[11px] font-medium cursor-default",
                                            reservationStatusColors[lead.reservation.status] || "bg-gray-100 text-gray-700 border-gray-200"
                                          )}>
                                            <KeyRound className="h-3 w-3 shrink-0" />
                                            <span className="shrink-0">
                                              {reservationStatusLabels[lead.reservation.status] || lead.reservation.status}
                                            </span>
                                            <span className="opacity-40 shrink-0">·</span>
                                            <span className="truncate">
                                              {getInvestorName(lead.reservation.investor.user)}
                                            </span>
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                                          <p className="font-medium mb-1">Investor Reservation</p>
                                          <p>{getInvestorName(lead.reservation.investor.user)}</p>
                                          <p className="text-gray-400">{lead.reservation.investor.user.email}</p>
                                          {lead.reservation.investor.user.phone && (
                                            <p className="text-gray-400">{lead.reservation.investor.user.phone}</p>
                                          )}
                                          <p className="text-gray-400 mt-1">
                                            Fee: £{lead.reservation.reservationFee.toLocaleString()}
                                          </p>
                                          {lead.reservedAt && (
                                            <p suppressHydrationWarning className="text-gray-400">
                                              Reserved {formatTimeAgo(lead.reservedAt)}
                                            </p>
                                          )}
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                )}
                              </div>
                            )}
                          </Draggable>
                        ))}

                        {provided.placeholder}

                        {columnLeads.length === 0 && (
                          <div className="rounded-lg border-2 border-dashed border-gray-200 py-6 text-center text-xs text-gray-300">
                            No leads
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
      </div>

      {selectedLead && (
        <VendorLeadDetailModal
          lead={selectedLead}
          open={!!selectedLead}
          onOpenChange={(open) => !open && setSelectedLead(null)}
          onUpdate={fetchData}
        />
      )}
    </>
  )
}
