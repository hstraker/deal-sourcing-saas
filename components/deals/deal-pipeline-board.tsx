"use client"

import { useMemo, useState, useEffect } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { type DealStatusValue } from "@/lib/deal-scoring"
import { cn } from "@/lib/utils"
import { Clock, Plus, Sparkles } from "lucide-react"
import { PipelinePhotoViewer } from "./pipeline-photo-viewer"
import { PhotoGallery } from "./photo-gallery"
import { useRouter } from "next/navigation"

type PipelinePhoto = {
  id: string
  s3Url: string
  caption?: string | null
  isCover?: boolean
}

type PipelineDeal = {
  id: string
  address: string
  postcode: string | null
  status: DealStatusValue
  dealScore: number | null
  packTier: string | null
  packPrice: number | null
  statusUpdatedAt: string | null
  photos: PipelinePhoto[]
  assignedTo: {
    id: string
    firstName: string | null
    lastName: string | null
  } | null
}

const STATUS_COLUMNS: Array<{
  id: DealStatusValue
  title: string
  description: string
}> = [
  { id: "new",       title: "To-Do",    description: "Fresh leads awaiting triage" },
  { id: "review",    title: "Review",   description: "Analysts validating data" },
  { id: "in_progress", title: "Working", description: "Pack & analysis in progress" },
  { id: "ready",     title: "Ready",    description: "Pack complete, pending list" },
  { id: "listed",    title: "Listed",   description: "Live for investors" },
  { id: "reserved",  title: "Reserved", description: "Investor expressed interest" },
  { id: "sold",      title: "Done",     description: "Purchased by investor" },
  { id: "archived",  title: "Archived", description: "On hold / no longer available" },
]

// Hex accent colours for column top-border stripes + count pills
const STATUS_ACCENT: Record<DealStatusValue, { hex: string; countBg: string }> = {
  new:         { hex: "#94A3B8", countBg: "bg-slate-100 text-slate-600" },
  review:      { hex: "#F59E0B", countBg: "bg-amber-100 text-amber-700" },
  in_progress: { hex: "#6366F1", countBg: "bg-indigo-100 text-indigo-700" },
  ready:       { hex: "#10B981", countBg: "bg-emerald-100 text-emerald-700" },
  listed:      { hex: "#3B82F6", countBg: "bg-blue-100 text-blue-700" },
  reserved:    { hex: "#F97316", countBg: "bg-orange-100 text-orange-700" },
  sold:        { hex: "#22C55E", countBg: "bg-green-100 text-green-700" },
  archived:    { hex: "#9CA3AF", countBg: "bg-gray-100 text-gray-500" },
}

const scoreBadgeClasses = (score: number | null) => {
  if (score === null) return "bg-gray-100 text-gray-500"
  if (score >= 85)   return "bg-emerald-100 text-emerald-700"
  if (score >= 70)   return "bg-blue-100 text-blue-700"
  return "bg-amber-100 text-amber-700"
}

const formatAssignee = (assignedTo: PipelineDeal["assignedTo"]) =>
  assignedTo ? [assignedTo.firstName, assignedTo.lastName].filter(Boolean).join(" ") || "Unassigned" : "Unassigned"

const initials = (first?: string | null, last?: string | null) =>
  `${first?.[0] ?? ""}${last?.[0] ?? ""}` || "?"

const calcDaysInStatus = (isoDate: string | null) => {
  if (!isoDate) return "—"
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return "—"
  const days = Math.floor((Date.now() - d.getTime()) / 86400000)
  return days <= 0 ? "<1" : `${days}`
}

const groupDealsByStatus = (deals: PipelineDeal[]) =>
  STATUS_COLUMNS.reduce<Record<DealStatusValue, PipelineDeal[]>>((acc, col) => {
    acc[col.id] = deals.filter((d) => d.status === col.id)
    return acc
  }, {} as Record<DealStatusValue, PipelineDeal[]>)

const mapDealFromApi = (deal: any): PipelineDeal => ({
  id: deal.id,
  address: deal.address,
  postcode: deal.postcode ?? null,
  status: deal.status,
  dealScore: deal.dealScore ?? null,
  packTier: deal.packTier ?? null,
  packPrice: deal.packPrice ?? null,
  statusUpdatedAt: deal.statusUpdatedAt ?? deal.updatedAt ?? null,
  photos: deal.photos?.map((p: any) => ({ id: p.id, s3Url: p.s3Url, caption: p.caption, isCover: p.isCover })) ?? [],
  assignedTo: deal.assignedTo ? { id: deal.assignedTo.id, firstName: deal.assignedTo.firstName, lastName: deal.assignedTo.lastName } : null,
})

export interface DealPipelineBoardProps {
  deals: PipelineDeal[]
  currentUserId: string
}

type TeamMember = {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
}

export function DealPipelineBoard({ deals, currentUserId }: DealPipelineBoardProps) {
  const router = useRouter()
  const [columns, setColumns] = useState(() => groupDealsByStatus(deals))
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null)
  const [assignedFilter, setAssignedFilter] = useState<string>("all")
  const [postcodeFilter, setPostcodeFilter] = useState("")
  const [quickAddColumn, setQuickAddColumn] = useState<DealStatusValue | null>(null)
  const [quickAddForm, setQuickAddForm] = useState({
    address: "", postcode: "", askingPrice: "", propertyType: "terraced", bedrooms: "", bathrooms: "",
  })
  const [creatingCard, setCreatingCard] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [galleryOpen, setGalleryOpen] = useState<{ dealId: string; photoIndex: number } | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assigningDealId, setAssigningDealId] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/users/team")
      .then((r) => r.ok ? r.json() : [])
      .then(setTeamMembers)
      .catch(() => {})
  }, [])

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    deals.forEach((d) => {
      if (d.assignedTo) map.set(d.assignedTo.id, formatAssignee(d.assignedTo))
    })
    teamMembers.forEach((m) => {
      if (!map.has(m.id)) map.set(m.id, [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email)
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [deals, teamMembers])

  const filteredColumns = useMemo(() => {
    const next = {} as Record<DealStatusValue, PipelineDeal[]>
    Object.entries(columns).forEach(([status, statusDeals]) => {
      next[status as DealStatusValue] = statusDeals.filter((deal) => {
        const matchAssignee =
          assignedFilter === "all" ||
          (assignedFilter === "unassigned" && !deal.assignedTo) ||
          deal.assignedTo?.id === assignedFilter
        const matchPostcode =
          postcodeFilter.trim() === "" ||
          (deal.postcode ?? "").toLowerCase().includes(postcodeFilter.trim().toLowerCase())
        return matchAssignee && matchPostcode
      })
    })
    return next
  }, [columns, assignedFilter, postcodeFilter])

  const resetQuickAdd = () => {
    setQuickAddColumn(null)
    setQuickAddForm({ address: "", postcode: "", askingPrice: "", propertyType: "terraced", bedrooms: "", bathrooms: "" })
    setFormError(null)
    setCreatingCard(false)
  }

  const handleQuickAddSubmit = async (columnId: DealStatusValue) => {
    if (creatingCard) return
    const trimmedAddress = quickAddForm.address.trim()
    if (!trimmedAddress) { setFormError("Address is required."); return }
    const priceValue = Number(quickAddForm.askingPrice)
    if (Number.isNaN(priceValue) || priceValue <= 0) { setFormError("Enter a valid asking price."); return }
    const bedroomsValue = quickAddForm.bedrooms ? Number(quickAddForm.bedrooms) : null
    const bathroomsValue = quickAddForm.bathrooms ? Number(quickAddForm.bathrooms) : null
    try {
      setCreatingCard(true)
      setFormError(null)
      const response = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: trimmedAddress,
          postcode: quickAddForm.postcode.trim() || null,
          askingPrice: priceValue,
          propertyType: quickAddForm.propertyType || null,
          bedrooms: bedroomsValue,
          bathrooms: bathroomsValue,
          status: columnId,
        }),
      })
      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error?.error ?? "Unable to create deal")
      }
      const created: PipelineDeal = mapDealFromApi(await response.json())
      setColumns((prev) => ({ ...prev, [columnId]: [created, ...(prev[columnId] ?? [])] }))
      resetQuickAdd()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create deal")
      setCreatingCard(false)
    }
  }

  const handleAssignDeal = async (dealId: string, assignedToId: string | null) => {
    if (assigningDealId === dealId) return
    try {
      setAssigningDealId(dealId)
      const response = await fetch(`/api/deals/${dealId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId }),
      })
      if (!response.ok) throw new Error("Failed to update assignment")
      const updated: PipelineDeal = mapDealFromApi(await response.json())
      setColumns((prev) => {
        const next = { ...prev }
        STATUS_COLUMNS.forEach((col) => {
          next[col.id] = next[col.id].map((d) => d.id === dealId ? updated : d)
        })
        return next
      })
    } catch (error) {
      console.error("Failed to update assignment:", error)
    } finally {
      setAssigningDealId(null)
    }
  }

  const handleCardClick = (dealId: string, e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (target.closest('[role="combobox"]') || target.closest("button") || target.closest("select")) return
    router.push(`/dashboard/deals/${dealId}`)
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const srcCol = source.droppableId as DealStatusValue
    const dstCol = destination.droppableId as DealStatusValue
    const previousState = columns

    setColumns((prev) => {
      const next = { ...prev }
      const srcDeals = Array.from(next[srcCol])
      const [moved] = srcDeals.splice(source.index, 1)
      if (!moved) return prev
      const dstDeals = Array.from(next[dstCol])
      dstDeals.splice(destination.index, 0, { ...moved, status: dstCol })
      next[srcCol] = srcDeals
      next[dstCol] = dstDeals
      return next
    })

    try {
      setSavingStatusId(draggableId)
      const response = await fetch(`/api/deals/${draggableId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: dstCol }),
      })
      if (!response.ok) throw new Error("Failed to persist status update")
      const updated: PipelineDeal = mapDealFromApi(await response.json())
      setColumns((prev) => {
        const next = { ...prev }
        STATUS_COLUMNS.forEach((col) => {
          next[col.id] = next[col.id].map((d) => d.id === updated.id ? { ...d, ...updated } : d)
        })
        return next
      })
    } catch {
      setColumns(previousState)
    } finally {
      setSavingStatusId(null)
    }
  }

  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="ds-card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3 flex-wrap">
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="h-8 w-[180px] text-sm">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assigneeOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Filter by postcode"
              value={postcodeFilter}
              onChange={(e) => setPostcodeFilter(e.target.value)}
              className="h-8 w-[160px] text-sm"
            />
          </div>
          {savingStatusId && (
            <p className="text-xs text-gray-400">Syncing…</p>
          )}
          <p className="text-xs text-gray-400 hidden sm:block">
            Drag cards between columns to update workflow
          </p>
        </div>
      </div>

      {/* Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-3 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((column) => {
            const accent = STATUS_ACCENT[column.id]
            const colDeals = filteredColumns[column.id] ?? []

            return (
              <Droppable droppableId={column.id} key={column.id}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      "flex-shrink-0 w-[17rem] rounded-xl transition-colors duration-150",
                      snapshot.isDraggingOver ? "bg-[#EFF6FF]" : "bg-[#F4F5F7]"
                    )}
                  >
                    {/* Column header */}
                    <div
                      className="rounded-t-xl px-3 pt-3 pb-2"
                      style={{ borderTop: `3px solid ${accent.hex}` }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          {column.title}
                        </span>
                        <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", accent.countBg)}>
                          {colDeals.length}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-gray-400">{column.description}</p>
                    </div>

                    {/* Cards */}
                    <div className="space-y-2 px-2 pb-2 min-h-[60px]">
                      {colDeals.map((deal, index) => (
                        <Draggable key={deal.id} draggableId={deal.id} index={index}>
                          {(dragProvided, snapshot) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={(e) => handleCardClick(deal.id, e)}
                              className={cn(
                                "ds-card ds-card-hover cursor-pointer overflow-hidden border-l-[3px]",
                                snapshot.isDragging && "shadow-dropdown rotate-1 opacity-95"
                              )}
                              style={{
                                ...(dragProvided.draggableProps.style as React.CSSProperties),
                                borderLeftColor: accent.hex,
                              }}
                            >
                              {/* Photo */}
                              <div onClick={(e) => e.stopPropagation()}>
                                <PipelinePhotoViewer
                                  photos={deal.photos || []}
                                  onPhotoClick={
                                    deal.photos?.length > 0
                                      ? () => setGalleryOpen({ dealId: deal.id, photoIndex: 0 })
                                      : undefined
                                  }
                                />
                              </div>

                              <div className="p-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                                {/* Address */}
                                <div>
                                  <p className="font-semibold text-sm text-gray-800 leading-tight">
                                    {deal.address}
                                  </p>
                                  {deal.postcode && (
                                    <p className="text-xs text-gray-400 mt-0.5">{deal.postcode}</p>
                                  )}
                                </div>

                                {/* Badges */}
                                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                                  <span className={cn("rounded-full px-2 py-0.5 font-semibold", scoreBadgeClasses(deal.dealScore))}>
                                    {deal.dealScore ? `${deal.dealScore}/100` : "No score"}
                                  </span>
                                  {deal.packTier && (
                                    <span className="rounded-full bg-purple-100 text-purple-700 px-2 py-0.5 font-semibold capitalize">
                                      {deal.packTier}
                                    </span>
                                  )}
                                  {deal.packPrice && (
                                    <span suppressHydrationWarning className="rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 font-semibold">
                                      £{Number(deal.packPrice).toLocaleString()}
                                    </span>
                                  )}
                                </div>

                                {/* Assignee + days */}
                                <div className="flex items-center justify-between gap-2 border-t border-[var(--ds-border)] pt-2">
                                  <Select
                                    value={deal.assignedTo?.id || "unassigned"}
                                    onValueChange={(v) => handleAssignDeal(deal.id, v === "unassigned" ? null : v)}
                                    disabled={assigningDealId === deal.id}
                                  >
                                    <SelectTrigger className="h-7 w-[130px] text-xs border-0 bg-transparent p-0 shadow-none focus:ring-0">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="unassigned">
                                        <div className="flex items-center gap-2">
                                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-[10px] text-gray-500">?</div>
                                          <span>Unassigned</span>
                                        </div>
                                      </SelectItem>
                                      {teamMembers.map((m) => {
                                        const name = [m.firstName, m.lastName].filter(Boolean).join(" ") || m.email
                                        return (
                                          <SelectItem key={m.id} value={m.id}>
                                            <div className="flex items-center gap-2">
                                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#EFF6FF] text-[10px] font-semibold text-[#2563EB]">
                                                {initials(m.firstName, m.lastName)}
                                              </div>
                                              <span>{name}</span>
                                            </div>
                                          </SelectItem>
                                        )
                                      })}
                                    </SelectContent>
                                  </Select>

                                  <span suppressHydrationWarning className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {(() => {
                                      const d = calcDaysInStatus(deal.statusUpdatedAt)
                                      return d === "—" ? "—" : `${d}d`
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}

                      {provided.placeholder}
                    </div>

                    {/* Quick-add */}
                    <div className="border-t border-[var(--ds-border)] px-2 py-2">
                      {quickAddColumn === column.id ? (
                        <div className="ds-card p-3 space-y-2">
                          <Textarea
                            placeholder="Deal address"
                            value={quickAddForm.address}
                            onChange={(e) => setQuickAddForm((p) => ({ ...p, address: e.target.value }))}
                            className="min-h-[60px] text-sm"
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <Input placeholder="Postcode" value={quickAddForm.postcode}
                              onChange={(e) => setQuickAddForm((p) => ({ ...p, postcode: e.target.value }))}
                              className="text-sm h-8" />
                            <Input placeholder="Asking £" type="number" value={quickAddForm.askingPrice}
                              onChange={(e) => setQuickAddForm((p) => ({ ...p, askingPrice: e.target.value }))}
                              className="text-sm h-8" />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <Select value={quickAddForm.propertyType}
                              onValueChange={(v) => setQuickAddForm((p) => ({ ...p, propertyType: v }))}>
                              <SelectTrigger className="h-8 text-xs col-span-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="terraced">Terraced</SelectItem>
                                <SelectItem value="semi">Semi-Detached</SelectItem>
                                <SelectItem value="detached">Detached</SelectItem>
                                <SelectItem value="flat">Flat</SelectItem>
                                <SelectItem value="maisonette">Maisonette</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input placeholder="Beds" type="number" value={quickAddForm.bedrooms}
                              onChange={(e) => setQuickAddForm((p) => ({ ...p, bedrooms: e.target.value }))}
                              className="text-sm h-8" />
                            <Input placeholder="Baths" type="number" value={quickAddForm.bathrooms}
                              onChange={(e) => setQuickAddForm((p) => ({ ...p, bathrooms: e.target.value }))}
                              className="text-sm h-8" />
                          </div>
                          {formError && <p className="text-xs text-red-500">{formError}</p>}
                          <div className="flex gap-2">
                            <Button size="sm" className="h-7 text-xs btn-primary"
                              onClick={() => handleQuickAddSubmit(column.id)} disabled={creatingCard} type="button">
                              {creatingCard ? "Adding…" : "Add Deal"}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 text-xs"
                              onClick={resetQuickAdd} type="button" disabled={creatingCard}>
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-gray-400 transition-colors hover:bg-white hover:text-gray-600"
                          onClick={() => {
                            setQuickAddColumn(column.id)
                            setQuickAddForm({ address: "", postcode: "", askingPrice: "", propertyType: "terraced", bedrooms: "", bathrooms: "" })
                            setFormError(null)
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add deal
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Droppable>
            )
          })}
        </div>
      </DragDropContext>

      {/* Tip */}
      <div className="ds-card flex items-center gap-2 px-4 py-2.5 text-xs text-gray-400">
        <Sparkles className="h-3.5 w-3.5 text-[#F5A623] shrink-0" />
        Tip: use filters to focus on postcode or assign deals to teammates for faster triage.
      </div>

      {/* Photo Gallery */}
      {galleryOpen && (() => {
        const deal = Object.values(columns).flat().find((d) => d.id === galleryOpen.dealId)
        if (!deal?.photos?.length) return null
        return (
          <PhotoGallery
            photos={deal.photos}
            initialIndex={galleryOpen.photoIndex}
            hideThumbnails={false}
            onClose={() => setGalleryOpen(null)}
          />
        )
      })()}
    </div>
  )
}
