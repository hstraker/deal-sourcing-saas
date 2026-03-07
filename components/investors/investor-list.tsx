"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Loader2, Search, Mail, Phone, PoundSterling, Plus, Edit, Trash2, Send, FileCheck,
  UserRound, MessageCircle, BadgeCheck, Eye, KeyRound, Trophy, CircleOff, Layers,
  Clock, TrendingUp, ShoppingBag, Activity,
} from "lucide-react"
import Link from "next/link"
import { format } from "date-fns"
import { InvestorForm } from "./investor-form"
import { SendPackModal } from "./send-pack-modal"
import { ReservationModal } from "./reservation-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SolicitorSelector, type Solicitor as SolicitorType } from "@/components/solicitors/solicitor-selector"
import { toast } from "sonner"

interface Investor {
  id: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
  }
  minBudget: number | null
  maxBudget: number | null
  preferredAreas: string[]
  strategy: string[]
  experienceLevel: string | null
  financingStatus: string | null
  emailAlerts: boolean
  smsAlerts: boolean
  dealsPurchased: number
  totalSpent: number
  pipelineStage?: string
  createdAt: string
  defaultSolicitorId?: string | null
  defaultSolicitor?: SolicitorType | null
  _count?: {
    reservations: number
  }
  // All active reservations (not cancelled/completed), each with deal address
  reservations?: { id: string; status: string; dealId: string; deal?: { address: string } }[]
}

interface InvestorListProps {
  initialInvestors?: Investor[]
}

// Color mappings for labels
const experienceColors: Record<string, string> = {
  beginner: "bg-blue-100 text-blue-800 border-blue-200",
  intermediate: "bg-green-100 text-green-800 border-green-200",
  advanced: "bg-purple-100 text-purple-800 border-purple-200",
}

const financingColors: Record<string, string> = {
  cash: "bg-emerald-100 text-emerald-800 border-emerald-200",
  mortgage: "bg-amber-100 text-amber-800 border-amber-200",
  both: "bg-indigo-100 text-indigo-800 border-indigo-200",
}

const strategyColors: Record<string, string> = {
  BRRRR: "bg-pink-100 text-pink-800 border-pink-200",
  BTL: "bg-cyan-100 text-cyan-800 border-cyan-200",
  Flip: "bg-orange-100 text-orange-800 border-orange-200",
}

const pipelineStageLabels: Record<string, string> = {
  LEAD: "Lead",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  VIEWING_DEALS: "Viewing Deals",
  RESERVED: "Reserved",
  PURCHASED: "Purchased",
  INACTIVE: "Inactive",
}

const pipelineStageColors: Record<string, string> = {
  LEAD: "bg-gray-100 text-gray-700 border-gray-200",
  CONTACTED: "bg-blue-100 text-blue-700 border-blue-200",
  QUALIFIED: "bg-green-100 text-green-700 border-green-200",
  VIEWING_DEALS: "bg-purple-100 text-purple-700 border-purple-200",
  RESERVED: "bg-yellow-100 text-yellow-700 border-yellow-200",
  PURCHASED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-red-100 text-red-700 border-red-200",
}

const pipelineStageIcons: Record<string, React.ReactNode> = {
  LEAD:          <UserRound    className="h-3.5 w-3.5" />,
  CONTACTED:     <MessageCircle className="h-3.5 w-3.5" />,
  QUALIFIED:     <BadgeCheck   className="h-3.5 w-3.5" />,
  VIEWING_DEALS: <Eye          className="h-3.5 w-3.5" />,
  RESERVED:      <KeyRound     className="h-3.5 w-3.5" />,
  PURCHASED:     <Trophy       className="h-3.5 w-3.5" />,
  INACTIVE:      <CircleOff   className="h-3.5 w-3.5" />,
}

// Reservation workflow status labels/colours — mirrors reservation-overview
const reservationStatusLabels: Record<string, string> = {
  pending:                "Pending",
  pack_sent:              "Pack Sent",
  fee_pending:            "Fee Requested",
  fee_paid:               "Fee Paid",
  proof_of_funds_pending: "POF Requested",
  pof_received:           "POF Received",
  lock_out_sent:          "Lock-out Sent",
  locked_out:             "Lock-out Signed",
}

const reservationStatusColors: Record<string, string> = {
  pending:                "bg-gray-100 text-gray-700 border-gray-200",
  pack_sent:              "bg-blue-100 text-blue-700 border-blue-200",
  fee_pending:            "bg-yellow-100 text-yellow-700 border-yellow-200",
  fee_paid:               "bg-emerald-100 text-emerald-700 border-emerald-200",
  proof_of_funds_pending: "bg-orange-100 text-orange-700 border-orange-200",
  pof_received:           "bg-sky-100 text-sky-700 border-sky-200",
  lock_out_sent:          "bg-purple-100 text-purple-700 border-purple-200",
  locked_out:             "bg-violet-100 text-violet-700 border-violet-200",
}

export function InvestorList({ initialInvestors = [] }: InvestorListProps) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Send pack modal state
  const [isSendPackOpen, setIsSendPackOpen] = useState(false)
  const [selectedInvestorForPack, setSelectedInvestorForPack] = useState<Investor | null>(null)

  // Reservation modal state
  const [isReservationOpen, setIsReservationOpen] = useState(false)
  const [selectedInvestorForReservation, setSelectedInvestorForReservation] = useState<Investor | null>(null)

  // Activity timeline state
  const [activities, setActivities] = useState<Array<{ id: string; activityType: string; description: string | null; createdAt: string; dealId?: string | null }>>([])
  const [loadingActivities, setLoadingActivities] = useState(false)

  const fetchActivities = async (investorId: string) => {
    setLoadingActivities(true)
    try {
      const res = await fetch(`/api/investors/activities?investorId=${investorId}&limit=20`)
      if (res.ok) {
        const data = await res.json()
        setActivities(data.activities ?? [])
      }
    } catch {
      // ignore
    } finally {
      setLoadingActivities(false)
    }
  }

  const fetchInvestors = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/investors")
      if (response.ok) {
        const data = await response.json()
        setInvestors(data.investors || [])
      }
    } catch (error) {
      console.error("Error fetching investors:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setIsMounted(true)
    fetchInvestors()

    // Re-fetch when a reservation status changes (dispatched by ReservationOverview)
    window.addEventListener("reservationUpdated", fetchInvestors)
    return () => window.removeEventListener("reservationUpdated", fetchInvestors)
  }, [])

  const filteredInvestors = investors.filter((investor) => {
    const name = [
      investor.user.firstName,
      investor.user.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
    const email = investor.user.email.toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || email.includes(query)
  })

  const getInvestorName = (investor: Investor) => {
    const name = [investor.user.firstName, investor.user.lastName]
      .filter(Boolean)
      .join(" ")
    return name || investor.user.email
  }

  const handleCreate = () => {
    setEditingInvestor(null)
    setIsFormOpen(true)
  }

  const handleEdit = (investor: Investor) => {
    setEditingInvestor(investor)
    setIsFormOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this investor? This will also delete their user account.")) {
      return
    }

    try {
      const response = await fetch(`/api/investors/${id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        fetchInvestors()
      } else {
        const errorData = await response.json()
        alert(errorData.error || "Failed to delete investor")
      }
    } catch (error) {
      console.error("Error deleting investor:", error)
      alert("Failed to delete investor")
    }
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingInvestor(null)
    fetchInvestors()
  }

  const handleSendPack = (investor: Investor) => {
    setSelectedInvestorForPack(investor)
    setIsSendPackOpen(true)
  }

  const handleCreateReservation = (investor: Investor) => {
    setSelectedInvestorForReservation(investor)
    setIsReservationOpen(true)
  }

  const handlePackSent = () => {
    fetchInvestors()
  }

  const handleReservationCreated = () => {
    fetchInvestors()
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Investors</CardTitle>
            <CardDescription>
              Manage investor profiles and track reservations
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search investors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
            <Button onClick={handleCreate} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Investor
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filteredInvestors.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No investors found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investor</TableHead>
                  <TableHead>Pipeline Stage</TableHead>
                  <TableHead>Budget</TableHead>
                  <TableHead>Strategy</TableHead>
                  <TableHead>Stats</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvestors.map((investor) => (
                  <TableRow key={investor.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{getInvestorName(investor)}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {investor.user.email}
                        </div>
                        {investor.user.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <Phone className="h-3 w-3" />
                            {investor.user.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const stage = investor.pipelineStage || "LEAD"
                        const activeReservations = investor.reservations?.filter(
                          (r) => reservationStatusLabels[r.status]
                        ) ?? []
                        return (
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1.5">
                              {/* Stage icon — color matches stage, hover shows stage name */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div
                                    className={`h-6 w-6 rounded flex items-center justify-center border cursor-default shrink-0 ${pipelineStageColors[stage] || "bg-gray-100 text-gray-700 border-gray-200"}`}
                                  >
                                    {pipelineStageIcons[stage] ?? <UserRound className="h-3.5 w-3.5" />}
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-medium">{pipelineStageLabels[stage] || stage}</p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Reservation count — hover lists each deal + status */}
                              {activeReservations.length > 0 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="h-6 min-w-[24px] px-1.5 rounded flex items-center justify-center gap-1 border cursor-default shrink-0 bg-background border-border text-xs font-semibold tabular-nums">
                                      <Layers className="h-3 w-3 text-muted-foreground" />
                                      {activeReservations.length}
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="text-xs max-w-[220px]">
                                    <p className="font-medium mb-1.5">
                                      {activeReservations.length} active reservation{activeReservations.length !== 1 ? "s" : ""}
                                    </p>
                                    <div className="space-y-1">
                                      {activeReservations.map((res) => (
                                        <div key={res.id} className="flex items-start gap-1.5">
                                          <span className="text-muted-foreground leading-tight truncate max-w-[140px]">
                                            {res.deal?.address ?? "—"}
                                          </span>
                                          <span className={`shrink-0 px-1 py-px rounded text-[10px] font-medium ${reservationStatusColors[res.status]}`}>
                                            {reservationStatusLabels[res.status]}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </TooltipProvider>
                        )
                      })()}
                    </TableCell>
                    <TableCell>
                      {investor.minBudget || investor.maxBudget ? (
                        <div suppressHydrationWarning className="text-sm">
                          £{investor.minBudget ? investor.minBudget.toLocaleString() : "—"}
                          {" - "}
                          £{investor.maxBudget ? investor.maxBudget.toLocaleString() : "—"}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {investor.strategy && investor.strategy.length > 0 ? (
                          investor.strategy.slice(0, 2).map((s) => (
                            <Badge
                              key={s}
                              variant="outline"
                              className={`text-xs ${
                                strategyColors[s] || "bg-gray-100 text-gray-800 border-gray-200"
                              }`}
                            >
                              {s}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                        {investor.strategy && investor.strategy.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{investor.strategy.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-1">
                          <PoundSterling className="h-3 w-3 text-muted-foreground" />
                          <span suppressHydrationWarning className="font-medium">{Number(investor.totalSpent).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {investor.dealsPurchased} deals
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(investor.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendPack(investor)}
                          title="Send Investor Pack"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCreateReservation(investor)}
                          title="Create Reservation"
                        >
                          <FileCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(investor)}
                          title="Edit Investor"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(investor.id)}
                          title="Delete Investor"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInvestor ? "Edit Investor" : "New Investor"}
            </DialogTitle>
            <DialogDescription>
              {editingInvestor
                ? "Update investor details and preferences"
                : "Create a new investor profile"}
            </DialogDescription>
          </DialogHeader>

          {editingInvestor ? (() => {
            const investorName = [editingInvestor.user.firstName, editingInvestor.user.lastName].filter(Boolean).join(" ") || editingInvestor.user.email
            const initials = [editingInvestor.user.firstName?.[0], editingInvestor.user.lastName?.[0]].filter(Boolean).join("").toUpperCase() || editingInvestor.user.email[0].toUpperCase()
            const activeReservations = editingInvestor.reservations?.filter(r => r.status !== "cancelled" && r.status !== "completed").length ?? 0
            const stage = editingInvestor.pipelineStage ?? "LEAD"
            return (
            <>
              {/* ── Investor header: avatar + stats ── */}
              <div className="flex items-center gap-4 rounded-xl border bg-muted/30 px-4 py-3 mb-2">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg select-none">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{investorName}</p>
                  <p className="text-xs text-muted-foreground truncate">{editingInvestor.user.email}</p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${pipelineStageColors[stage] ?? "bg-gray-100 text-gray-700 border-gray-200"}`}>
                    {pipelineStageIcons[stage]}
                    {pipelineStageLabels[stage] ?? stage}
                  </span>
                </div>
              </div>

              {/* ── Quick stats row ── */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg border bg-card px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Purchased</span>
                  </div>
                  <p className="text-xl font-bold">{editingInvestor.dealsPurchased}</p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <KeyRound className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Active</span>
                  </div>
                  <p className="text-xl font-bold">{activeReservations}</p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-medium uppercase tracking-wide">Spent</span>
                  </div>
                  <p className="text-xl font-bold">£{Number(editingInvestor.totalSpent).toLocaleString()}</p>
                </div>
              </div>

              <Tabs defaultValue="profile">
                <TabsList className="mb-2 w-full grid grid-cols-3">
                  <TabsTrigger value="profile">Profile</TabsTrigger>
                  <TabsTrigger value="solicitor">Solicitor</TabsTrigger>
                  <TabsTrigger value="activity" onClick={() => fetchActivities(editingInvestor.id)}>Activity</TabsTrigger>
                </TabsList>
                <TabsContent value="profile">
                  <InvestorForm
                    investor={editingInvestor}
                    onSuccess={handleFormSuccess}
                    onCancel={() => {
                      setIsFormOpen(false)
                      setEditingInvestor(null)
                    }}
                  />
                </TabsContent>
                <TabsContent value="solicitor">
                  <div className="space-y-3 pt-2">
                    <div>
                      <h3 className="text-sm font-semibold">Default Solicitor</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        This solicitor will be used as the default for all deals with this investor. It can be overridden per deal.
                      </p>
                    </div>
                    <SolicitorSelector
                      value={editingInvestor.defaultSolicitorId ?? null}
                      initialSolicitor={editingInvestor.defaultSolicitor ?? null}
                      onChange={async (id, sol) => {
                        try {
                          const res = await fetch(`/api/investors/${editingInvestor.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ defaultSolicitorId: id }),
                          })
                          if (!res.ok) throw new Error("Failed to update")
                          setEditingInvestor({
                            ...editingInvestor,
                            defaultSolicitorId: id,
                            defaultSolicitor: sol,
                          })
                          fetchInvestors()
                          toast.success(id ? "Default solicitor assigned" : "Default solicitor removed")
                        } catch {
                          toast.error("Failed to update solicitor")
                        }
                      }}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="activity">
                  <div className="pt-1 space-y-1">
                    {loadingActivities ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Loading activity…</span>
                      </div>
                    ) : activities.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground gap-2">
                        <Activity className="h-8 w-8 opacity-30" />
                        <p className="text-sm">No activity recorded yet</p>
                      </div>
                    ) : (
                      <div className="relative pl-4">
                        {/* Timeline line */}
                        <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
                        <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                          {activities.map((act) => (
                            <div key={act.id} className="relative flex gap-3 items-start">
                              <div className="absolute -left-4 mt-1.5 h-2.5 w-2.5 rounded-full bg-primary/70 border-2 border-background ring-1 ring-primary/30 shrink-0" />
                              <div className="flex-1 rounded-lg border bg-card px-3 py-2 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="text-xs font-medium leading-tight">
                                    {act.activityType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                    {new Date(act.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                  </span>
                                </div>
                                {act.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{act.description}</p>
                                )}
                                {act.dealId && (
                                  <p className="text-[10px] text-muted-foreground mt-1">Deal linked</p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
            )
          })() : (
            <InvestorForm
              onSuccess={handleFormSuccess}
              onCancel={() => {
                setIsFormOpen(false)
                setEditingInvestor(null)
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Send Pack Modal */}
      <SendPackModal
        open={isSendPackOpen && !!selectedInvestorForPack}
        onOpenChange={(open) => {
          setIsSendPackOpen(open)
          if (!open) {
            setSelectedInvestorForPack(null)
          }
        }}
        investorId={selectedInvestorForPack?.id || ""}
        investorName={selectedInvestorForPack ? getInvestorName(selectedInvestorForPack) : ""}
        onSuccess={handlePackSent}
      />

      {/* Reservation Modal */}
      <ReservationModal
        open={isReservationOpen && !!selectedInvestorForReservation}
        onOpenChange={(open) => {
          setIsReservationOpen(open)
          if (!open) {
            setSelectedInvestorForReservation(null)
          }
        }}
        investorId={selectedInvestorForReservation?.id}
        onSuccess={handleReservationCreated}
      />
    </Card>
  )
}

