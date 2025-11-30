"use client"

import { useMemo, useState } from "react"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
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
import { Clock, Kanban, MoreHorizontal, Plus, Sparkles, UserPlus } from "lucide-react"
import { PipelinePhotoViewer } from "./pipeline-photo-viewer"
import { PhotoGallery } from "./photo-gallery"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

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
  { id: "new", title: "To-Do", description: "Fresh leads awaiting triage" },
  { id: "review", title: "Review", description: "Analysts validating data" },
  { id: "in_progress", title: "Working", description: "Pack & analysis in progress" },
  { id: "ready", title: "Ready", description: "Pack complete, pending list" },
  { id: "listed", title: "Listed", description: "Live for investors" },
  { id: "reserved", title: "Reserved", description: "Investor expressed interest" },
  { id: "sold", title: "Done", description: "Purchased by investor" },
  { id: "archived", title: "Archived", description: "On hold / no longer available" },
]

const statusAccent: Record<DealStatusValue, string> = {
  new: "border-l-slate-300",
  review: "border-l-amber-400",
  in_progress: "border-l-indigo-400",
  ready: "border-l-emerald-400",
  listed: "border-l-blue-500",
  reserved: "border-l-orange-400",
  sold: "border-l-green-500",
  archived: "border-l-gray-400",
}

const formatAssignee = (assignedTo: PipelineDeal["assignedTo"]) => {
  if (!assignedTo) return "Unassigned"
  return [assignedTo.firstName, assignedTo.lastName].filter(Boolean).join(" ") || "Unassigned"
}

const calcDaysInStatus = (isoDate: string | null) => {
  if (!isoDate) return "—"
  const updated = new Date(isoDate)
  if (Number.isNaN(updated.getTime())) return "—"
  const diffDays = Math.floor((Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24))
  return diffDays <= 0 ? "<1" : `${diffDays}`
}

const BOARD_BG_IMAGE =
  "https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?auto=format&fit=crop&w=1600&q=60"

const scoreBadgeClasses = (score: number | null) => {
  if (score === null || score === undefined) {
    return "bg-slate-200 text-slate-700"
  }
  if (score >= 85) return "bg-emerald-100 text-emerald-700"
  if (score >= 70) return "bg-blue-100 text-blue-700"
  return "bg-amber-100 text-amber-700"
}

const initials = (first?: string | null, last?: string | null) => {
  const firstInitial = first?.[0] ?? ""
  const lastInitial = last?.[0] ?? ""
  const combined = `${firstInitial}${lastInitial}`
  return combined || "?"
}

const groupDealsByStatus = (deals: PipelineDeal[]) => {
  return STATUS_COLUMNS.reduce<Record<DealStatusValue, PipelineDeal[]>>((acc, column) => {
    acc[column.id] = deals.filter((deal) => deal.status === column.id)
    return acc
  }, {} as Record<DealStatusValue, PipelineDeal[]>)
}

const mapDealFromApi = (deal: any): PipelineDeal => ({
  id: deal.id,
  address: deal.address,
  postcode: deal.postcode ?? null,
  status: deal.status,
  dealScore: deal.dealScore ?? null,
  packTier: deal.packTier ?? null,
  packPrice: deal.packPrice ?? null,
  statusUpdatedAt: deal.statusUpdatedAt ?? deal.updatedAt ?? null,
  photos: deal.photos?.map((photo: any) => ({
    id: photo.id,
    s3Url: photo.s3Url,
    caption: photo.caption,
    isCover: photo.isCover,
  })) ?? [],
  assignedTo: deal.assignedTo
    ? {
        id: deal.assignedTo.id,
        firstName: deal.assignedTo.firstName,
        lastName: deal.assignedTo.lastName,
      }
    : null,
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
    address: "",
    postcode: "",
    askingPrice: "",
    propertyType: "terraced",
    bedrooms: "",
    bathrooms: "",
  })
  const [creatingCard, setCreatingCard] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [galleryOpen, setGalleryOpen] = useState<{ dealId: string; photoIndex: number } | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [assigningDealId, setAssigningDealId] = useState<string | null>(null)

  // Fetch team members on mount
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/users/team")
        if (response.ok) {
          const members = await response.json()
          setTeamMembers(members)
        }
      } catch (error) {
        console.error("Failed to fetch team members:", error)
      }
    }
    fetchTeamMembers()
  }, [])

  const assigneeOptions = useMemo(() => {
    const map = new Map<string, string>()
    deals.forEach((deal) => {
      if (deal.assignedTo) {
        map.set(deal.assignedTo.id, formatAssignee(deal.assignedTo))
      }
    })
    // Also include all team members
    teamMembers.forEach((member) => {
      if (!map.has(member.id)) {
        const name = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email
        map.set(member.id, name)
      }
    })
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [deals, teamMembers])

  const filteredColumns = useMemo(() => {
    const nextState: Record<DealStatusValue, PipelineDeal[]> = {} as Record<DealStatusValue, PipelineDeal[]>
    Object.entries(columns).forEach(([status, statusDeals]) => {
      nextState[status as DealStatusValue] = statusDeals.filter((deal) => {
        const matchesAssignee =
          assignedFilter === "all" ||
          (assignedFilter === "unassigned" && !deal.assignedTo) ||
          deal.assignedTo?.id === assignedFilter
        const matchesPostcode =
          postcodeFilter.trim() === "" ||
          (deal.postcode ?? "").toLowerCase().includes(postcodeFilter.trim().toLowerCase())
        return matchesAssignee && matchesPostcode
      })
    })
    return nextState
  }, [columns, assignedFilter, postcodeFilter])

  const resetQuickAdd = () => {
    setQuickAddColumn(null)
    setQuickAddForm({
      address: "",
      postcode: "",
      askingPrice: "",
      propertyType: "terraced",
      bedrooms: "",
      bathrooms: "",
    })
    setFormError(null)
    setCreatingCard(false)
  }

  const handleQuickAddSubmit = async (columnId: DealStatusValue) => {
    if (creatingCard) return
    const trimmedAddress = quickAddForm.address.trim()
    if (!trimmedAddress) {
      setFormError("Address is required.")
      return
    }
    const priceValue = Number(quickAddForm.askingPrice)
    if (Number.isNaN(priceValue) || priceValue <= 0) {
      setFormError("Enter a valid asking price.")
      return
    }

    const bedroomsValue = quickAddForm.bedrooms ? Number(quickAddForm.bedrooms) : null
    const bathroomsValue = quickAddForm.bathrooms ? Number(quickAddForm.bathrooms) : null
    if (quickAddForm.bedrooms && (Number.isNaN(bedroomsValue) || bedroomsValue < 0)) {
      setFormError("Bedrooms must be a positive number.")
      return
    }
    if (quickAddForm.bathrooms && (Number.isNaN(bathroomsValue) || bathroomsValue < 0)) {
      setFormError("Bathrooms must be a positive number.")
      return
    }

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

      const createdDeal: PipelineDeal = mapDealFromApi(await response.json())

      setColumns((prev) => {
        const next = { ...prev }
        next[columnId] = [createdDeal, ...(next[columnId] ?? [])]
        return next
      })

      resetQuickAdd()
    } catch (error) {
      console.error(error)
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
        body: JSON.stringify({
          assignedToId,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update assignment")
      }

      const updatedDeal: PipelineDeal = mapDealFromApi(await response.json())

      setColumns((prev) => {
        const next = { ...prev }
        STATUS_COLUMNS.forEach((col) => {
          next[col.id] = next[col.id].map((deal) =>
            deal.id === dealId ? updatedDeal : deal
          )
        })
        return next
      })
    } catch (error) {
      console.error("Failed to update assignment:", error)
      // Could add toast notification here
    } finally {
      setAssigningDealId(null)
    }
  }

  const handleOpenGallery = (dealId: string, photoIndex: number = 0) => {
    setGalleryOpen({ dealId, photoIndex })
  }

  const handleCloseGallery = () => {
    setGalleryOpen(null)
  }

  const handleCardClick = (dealId: string, e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive controls
    const target = e.target as HTMLElement
    if (
      target.closest('[role="combobox"]') ||
      target.closest("button") ||
      target.closest("select")
    ) {
      return
    }
    router.push(`/dashboard/deals/${dealId}`)
  }

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return
    }

    const sourceColumn = source.droppableId as DealStatusValue
    const destinationColumn = destination.droppableId as DealStatusValue
    const previousState = columns

    setColumns((prev) => {
      const next = { ...prev }
      const sourceDeals = Array.from(next[sourceColumn])
      const [movedDeal] = sourceDeals.splice(source.index, 1)
      if (!movedDeal) {
        return prev
      }
      const destinationDeals = Array.from(next[destinationColumn])
      destinationDeals.splice(destination.index, 0, { ...movedDeal, status: destinationColumn })
      next[sourceColumn] = sourceDeals
      next[destinationColumn] = destinationDeals
      return next
    })

    try {
      setSavingStatusId(draggableId)
      const response = await fetch(`/api/deals/${draggableId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: destinationColumn }),
      })

      if (!response.ok) {
        throw new Error("Failed to persist status update")
      }

      const updatedDeal: PipelineDeal = mapDealFromApi(await response.json())

      setColumns((prev) => {
        const next = { ...prev }
        STATUS_COLUMNS.forEach((col) => {
          next[col.id] = next[col.id].map((deal) =>
            deal.id === updatedDeal.id ? { ...deal, ...updatedDeal } : deal
          )
        })
        return next
      })
    } catch (error) {
      console.error(error)
      setColumns(previousState)
    } finally {
      setSavingStatusId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-2 z-20 flex flex-col gap-4 rounded-2xl border bg-card/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Kanban className="h-4 w-4" />
            Deal Pipeline Board
          </div>
          {savingStatusId && (
            <div className="text-xs text-muted-foreground">
              Syncing change…
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex gap-3">
            <Select value={assignedFilter} onValueChange={setAssignedFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {assigneeOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              placeholder="Filter by postcode"
              value={postcodeFilter}
              onChange={(event) => setPostcodeFilter(event.target.value)}
              className="w-[180px]"
            />
          </div>
          <div className="text-xs text-muted-foreground">
            Drag cards between lists to update workflow.
          </div>
        </div>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((column) => (
            <Droppable droppableId={column.id} key={column.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex w-[18rem] flex-shrink-0 flex-col rounded-2xl border border-border bg-card shadow-sm"
                >
                  <div className="flex items-center justify-between rounded-t-2xl border-b border-border px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold">{column.title}</div>
                      <p className="text-xs text-muted-foreground">{column.description}</p>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold">
                        {filteredColumns[column.id]?.length ?? 0}
                      </span>
                      <MoreHorizontal className="h-4 w-4" />
                    </div>
                  </div>

                  <div className={cn("flex-1 space-y-3 px-3 py-3", statusAccent[column.id])}>
                    {filteredColumns[column.id]?.map((deal, index) => (
                      <Draggable key={deal.id} draggableId={deal.id} index={index}>
                        {(dragProvided, snapshot) => (
                          <Card
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              "overflow-hidden border border-border bg-card shadow-sm transition cursor-pointer",
                              snapshot.isDragging && "ring-2 ring-primary/50"
                            )}
                            onClick={(e) => handleCardClick(deal.id, e)}
                          >
                            <div onClick={(e) => e.stopPropagation()}>
                              <PipelinePhotoViewer
                                photos={deal.photos || []}
                                onPhotoClick={
                                  deal.photos && deal.photos.length > 0
                                    ? () => handleOpenGallery(deal.id, 0)
                                    : undefined
                                }
                              />
                            </div>
                            <div className="space-y-3 p-3" onClick={(e) => e.stopPropagation()}>
                              <div>
                                <p className="font-semibold leading-tight">{deal.address}</p>
                                {deal.postcode && (
                                  <p className="text-xs text-muted-foreground">{deal.postcode}</p>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 font-semibold",
                                    scoreBadgeClasses(deal.dealScore)
                                  )}
                                >
                                  {deal.dealScore ? `${deal.dealScore}/100` : "Score—"}
                                </span>
                                {deal.packTier && (
                                  <span className="rounded-full bg-purple-100 px-2 py-0.5 font-semibold text-purple-700 dark:bg-purple-900/40 dark:text-purple-100 capitalize">
                                    {deal.packTier}
                                  </span>
                                )}
                                {deal.packPrice && (
                                  <span className="rounded-full bg-muted px-2 py-0.5 font-semibold text-muted-foreground">
                                    £{Number(deal.packPrice).toLocaleString()}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                <Select
                                  value={deal.assignedTo?.id || "unassigned"}
                                  onValueChange={(value) =>
                                    handleAssignDeal(deal.id, value === "unassigned" ? null : value)
                                  }
                                  disabled={assigningDealId === deal.id}
                                >
                                  <SelectTrigger className="h-7 w-[140px] text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">
                                      <div className="flex items-center gap-2">
                                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px]">
                                          ?
                                        </div>
                                        <span>Unassigned</span>
                                      </div>
                                    </SelectItem>
                                    {teamMembers.map((member) => {
                                      const name = [member.firstName, member.lastName]
                                        .filter(Boolean)
                                        .join(" ") || member.email
                                      return (
                                        <SelectItem key={member.id} value={member.id}>
                                          <div className="flex items-center gap-2">
                                            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                                              {initials(member.firstName, member.lastName)}
                                            </div>
                                            <span>{name}</span>
                                          </div>
                                        </SelectItem>
                                      )
                                    })}
                                  </SelectContent>
                                </Select>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  <span>
                                    {(() => {
                                      const days = calcDaysInStatus(deal.statusUpdatedAt)
                                      return days === "—" ? "—" : `${days}d`
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </Card>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>

                  <div className="border-t border-border px-3 py-3">
                    {quickAddColumn === column.id ? (
                      <div className="space-y-2 rounded-xl border border-border bg-card p-3 shadow-sm">
                          <Textarea
                            placeholder="Deal address"
                            value={quickAddForm.address}
                            onChange={(event) =>
                              setQuickAddForm((prev) => ({ ...prev, address: event.target.value }))
                            }
                            className="min-h-[70px]"
                          />
                          <div className="flex flex-col gap-2 md:flex-row">
                            <Input
                              placeholder="Postcode"
                              value={quickAddForm.postcode}
                              onChange={(event) =>
                                setQuickAddForm((prev) => ({
                                  ...prev,
                                  postcode: event.target.value,
                                }))
                              }
                            />
                            <Input
                              placeholder="Asking £"
                              type="number"
                              value={quickAddForm.askingPrice}
                              onChange={(event) =>
                                setQuickAddForm((prev) => ({
                                  ...prev,
                                  askingPrice: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex flex-col gap-2 md:flex-row">
                            <Select
                              value={quickAddForm.propertyType}
                              onValueChange={(value) =>
                                setQuickAddForm((prev) => ({ ...prev, propertyType: value }))
                              }
                            >
                              <SelectTrigger className="md:w-[160px]">
                                <SelectValue placeholder="Property type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="terraced">Terraced</SelectItem>
                                <SelectItem value="semi">Semi-Detached</SelectItem>
                                <SelectItem value="detached">Detached</SelectItem>
                                <SelectItem value="flat">Flat</SelectItem>
                              </SelectContent>
                            </Select>
                            <Input
                              placeholder="Bedrooms"
                              title="Bedrooms"
                              type="number"
                              value={quickAddForm.bedrooms}
                              onChange={(event) =>
                                setQuickAddForm((prev) => ({
                                  ...prev,
                                  bedrooms: event.target.value,
                                }))
                              }
                            />
                            <Input
                              placeholder="Bathrooms"
                              title="Bathrooms"
                              type="number"
                              value={quickAddForm.bathrooms}
                              onChange={(event) =>
                                setQuickAddForm((prev) => ({
                                  ...prev,
                                  bathrooms: event.target.value,
                                }))
                              }
                            />
                          </div>
                          {formError && (
                            <p className="text-xs text-red-600">{formError}</p>
                          )}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleQuickAddSubmit(column.id)}
                              disabled={creatingCard}
                              type="button"
                            >
                              {creatingCard ? "Adding…" : "Add Deal"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={resetQuickAdd}
                              type="button"
                              disabled={creatingCard}
                            >
                              Cancel
                            </Button>
                          </div>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                        type="button"
                        onClick={() => {
                          setQuickAddColumn(column.id)
                          setQuickAddForm({
                            address: "",
                            postcode: "",
                            askingPrice: "",
                            propertyType: "terraced",
                            bedrooms: "",
                            bathrooms: "",
                          })
                          setFormError(null)
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        Add deal
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>

      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-warning" />
        Tip: use filters to focus on postcode or assign deals to teammates for faster triage.
      </div>

      {/* Photo Gallery Modal */}
      {galleryOpen && (() => {
        const deal = Object.values(columns)
          .flat()
          .find((d) => d.id === galleryOpen.dealId)
        if (!deal || !deal.photos || deal.photos.length === 0) return null

        return (
          <PhotoGallery
            photos={deal.photos}
            initialIndex={galleryOpen.photoIndex}
            hideThumbnails={false}
            onClose={handleCloseGallery}
          />
        )
      })()}
    </div>
  )
}

