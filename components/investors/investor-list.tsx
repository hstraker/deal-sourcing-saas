"use client"

import { useState, useEffect } from "react"
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
import { format } from "date-fns"
import { InvestorForm } from "./investor-form"
import { SendPackModal } from "./send-pack-modal"
import { ReservationModal } from "./reservation-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SolicitorSelector, type Solicitor as SolicitorType } from "@/components/solicitors/solicitor-selector"
import { toast } from "sonner"
import {
  getInvestorStrategyStyle,
  getInvestorExperienceStyle, // imported for completeness; no JSX call site yet
  getInvestorPipelineStageStyle,
  getReservationStatusStyle,
} from "@/lib/theme/status-colors"

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
  _count?: { reservations: number }
  reservations?: { id: string; status: string; dealId: string; deal?: { address: string } }[]
}

interface InvestorListProps {
  initialInvestors?: Investor[]
}



const pipelineStageLabels: Record<string, string> = {
  LEAD:          "Lead",
  CONTACTED:     "Contacted",
  QUALIFIED:     "Qualified",
  VIEWING_DEALS: "Viewing Deals",
  RESERVED:      "Reserved",
  PURCHASED:     "Purchased",
  INACTIVE:      "Inactive",
}


const pipelineStageIcons: Record<string, React.ReactNode> = {
  LEAD:          <UserRound     className="h-3.5 w-3.5" />,
  CONTACTED:     <MessageCircle className="h-3.5 w-3.5" />,
  QUALIFIED:     <BadgeCheck    className="h-3.5 w-3.5" />,
  VIEWING_DEALS: <Eye           className="h-3.5 w-3.5" />,
  RESERVED:      <KeyRound      className="h-3.5 w-3.5" />,
  PURCHASED:     <Trophy        className="h-3.5 w-3.5" />,
  INACTIVE:      <CircleOff     className="h-3.5 w-3.5" />,
}

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


export function InvestorList({ initialInvestors = [] }: InvestorListProps) {
  const [investors, setInvestors] = useState<Investor[]>(initialInvestors)
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null)

  const [isSendPackOpen, setIsSendPackOpen] = useState(false)
  const [selectedInvestorForPack, setSelectedInvestorForPack] = useState<Investor | null>(null)

  const [isReservationOpen, setIsReservationOpen] = useState(false)
  const [selectedInvestorForReservation, setSelectedInvestorForReservation] = useState<Investor | null>(null)

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
    } catch { /* ignore */ } finally {
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
    fetchInvestors()
    window.addEventListener("reservationUpdated", fetchInvestors)
    return () => window.removeEventListener("reservationUpdated", fetchInvestors)
  }, [])

  const filteredInvestors = investors.filter((investor) => {
    const name = [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ").toLowerCase()
    const email = investor.user.email.toLowerCase()
    const query = searchQuery.toLowerCase()
    return name.includes(query) || email.includes(query)
  })

  const getInvestorName = (investor: Investor) =>
    [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ") || investor.user.email

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this investor? This will also delete their user account.")) return
    try {
      const response = await fetch(`/api/investors/${id}`, { method: "DELETE" })
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

  return (
    <div className="ds-card overflow-hidden">
      {/* Toolbar */}
      <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Investors</h2>
          <p className="text-xs text-gray-400">Manage investor profiles and track reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search investors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-56 h-9 text-sm"
            />
          </div>
          <Button onClick={() => { setEditingInvestor(null); setIsFormOpen(true) }} className="btn-primary h-9">
            <Plus className="mr-2 h-4 w-4" />
            New Investor
          </Button>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : filteredInvestors.length === 0 ? (
        <div className="py-10 text-center text-sm text-gray-400">No investors found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="table-header text-left">Investor</th>
                <th className="table-header text-left">Pipeline Stage</th>
                <th className="table-header text-left">Budget</th>
                <th className="table-header text-left">Strategy</th>
                <th className="table-header text-left">Stats</th>
                <th className="table-header text-left">Joined</th>
                <th className="table-header text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvestors.map((investor) => (
                <tr key={investor.id} className="table-row">
                  <td className="table-cell">
                    <div className="font-medium text-gray-900">{getInvestorName(investor)}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                      <Mail className="h-3 w-3" />
                      {investor.user.email}
                    </div>
                    {investor.user.phone && (
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {investor.user.phone}
                      </div>
                    )}
                  </td>

                  <td className="table-cell">
                    {(() => {
                      const stage = investor.pipelineStage || "LEAD"
                      const activeReservations = investor.reservations?.filter(
                        (r) => reservationStatusLabels[r.status]
                      ) ?? []
                      return (
                        <TooltipProvider delayDuration={200}>
                          <div className="flex items-center gap-1.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={`h-6 w-6 rounded flex items-center justify-center border cursor-default shrink-0 ${getInvestorPipelineStageStyle(stage)}`}>
                                  {pipelineStageIcons[stage] ?? <UserRound className="h-3.5 w-3.5" />}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="text-xs">
                                <p className="font-medium">{pipelineStageLabels[stage] || stage}</p>
                              </TooltipContent>
                            </Tooltip>

                            {activeReservations.length > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="h-6 min-w-[24px] px-1.5 rounded flex items-center justify-center gap-1 border border-[var(--ds-border)] cursor-default shrink-0 text-xs font-semibold tabular-nums bg-white">
                                    <Layers className="h-3 w-3 text-gray-400" />
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
                                        <span className="text-gray-400 leading-tight truncate max-w-[140px]">
                                          {res.deal?.address ?? "—"}
                                        </span>
                                        <span className={`shrink-0 px-1 py-px rounded text-[10px] font-medium ${getReservationStatusStyle(res.status)}`}>
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
                  </td>

                  <td className="table-cell">
                    {investor.minBudget || investor.maxBudget ? (
                      <div suppressHydrationWarning className="text-sm text-gray-700">
                        £{investor.minBudget ? investor.minBudget.toLocaleString() : "—"}
                        {" – "}
                        £{investor.maxBudget ? investor.maxBudget.toLocaleString() : "—"}
                      </div>
                    ) : (
                      <span className="text-gray-400 text-sm">—</span>
                    )}
                  </td>

                  <td className="table-cell">
                    <div className="flex flex-wrap gap-1">
                      {investor.strategy && investor.strategy.length > 0 ? (
                        investor.strategy.slice(0, 2).map((s) => (
                          <Badge key={s} variant="outline" className={`text-xs ${getInvestorStrategyStyle(s)}`}>
                            {s}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                      {investor.strategy && investor.strategy.length > 2 && (
                        <Badge variant="outline" className="text-xs">+{investor.strategy.length - 2}</Badge>
                      )}
                    </div>
                  </td>

                  <td className="table-cell">
                    <div className="flex items-center gap-1 text-sm">
                      <PoundSterling className="h-3 w-3 text-gray-400" />
                      <span suppressHydrationWarning className="font-medium">{Number(investor.totalSpent).toLocaleString()}</span>
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{investor.dealsPurchased} deals</div>
                  </td>

                  <td className="table-cell text-sm text-gray-400">
                    {format(new Date(investor.createdAt), "MMM d, yyyy")}
                  </td>

                  <td className="table-cell">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedInvestorForPack(investor); setIsSendPackOpen(true) }} title="Send Investor Pack">
                        <Send className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setSelectedInvestorForReservation(investor); setIsReservationOpen(true) }} title="Create Reservation">
                        <FileCheck className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingInvestor(investor); setIsFormOpen(true) }} title="Edit Investor">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(investor.id)} title="Delete Investor">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit / Create Dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvestor ? "Edit Investor" : "New Investor"}</DialogTitle>
            <DialogDescription>
              {editingInvestor ? "Update investor details and preferences" : "Create a new investor profile"}
            </DialogDescription>
          </DialogHeader>

          {editingInvestor ? (() => {
            const investorName = [editingInvestor.user.firstName, editingInvestor.user.lastName].filter(Boolean).join(" ") || editingInvestor.user.email
            const initials = [editingInvestor.user.firstName?.[0], editingInvestor.user.lastName?.[0]].filter(Boolean).join("").toUpperCase() || editingInvestor.user.email[0].toUpperCase()
            const activeReservations = editingInvestor.reservations?.filter(r => r.status !== "cancelled" && r.status !== "completed").length ?? 0
            const stage = editingInvestor.pipelineStage ?? "LEAD"
            return (
              <>
                {/* Investor header */}
                <div className="flex items-center gap-4 rounded-xl border border-[var(--ds-border)] bg-gray-50 px-4 py-3 mb-2">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-white font-bold text-lg select-none">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate text-gray-900">{investorName}</p>
                    <p className="text-xs text-gray-400 truncate">{editingInvestor.user.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${getInvestorPipelineStageStyle(stage)}`}>
                      {pipelineStageIcons[stage]}
                      {pipelineStageLabels[stage] ?? stage}
                    </span>
                  </div>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { icon: <ShoppingBag className="h-3.5 w-3.5" />, label: "Purchased", value: editingInvestor.dealsPurchased },
                    { icon: <KeyRound    className="h-3.5 w-3.5" />, label: "Active",    value: activeReservations },
                    { icon: <TrendingUp  className="h-3.5 w-3.5" />, label: "Spent",     value: `£${Number(editingInvestor.totalSpent).toLocaleString()}` },
                  ].map(({ icon, label, value }) => (
                    <div key={label} className="rounded-lg border border-[var(--ds-border)] bg-gray-50 px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                        {icon}
                        <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
                      </div>
                      <p className="text-xl font-bold text-gray-900">{value}</p>
                    </div>
                  ))}
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
                      onSuccess={() => { setIsFormOpen(false); setEditingInvestor(null); fetchInvestors() }}
                      onCancel={() => { setIsFormOpen(false); setEditingInvestor(null) }}
                    />
                  </TabsContent>

                  <TabsContent value="solicitor">
                    <div className="space-y-3 pt-2">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">Default Solicitor</h3>
                        <p className="text-xs text-gray-400 mt-0.5">
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
                            setEditingInvestor({ ...editingInvestor, defaultSolicitorId: id, defaultSolicitor: sol })
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
                        <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="text-sm">Loading activity…</span>
                        </div>
                      ) : activities.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-gray-400 gap-2">
                          <Activity className="h-8 w-8 opacity-30" />
                          <p className="text-sm">No activity recorded yet</p>
                        </div>
                      ) : (
                        <div className="relative pl-4">
                          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-[var(--ds-border)]" />
                          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                            {activities.map((act) => (
                              <div key={act.id} className="relative flex gap-3 items-start">
                                <div className="absolute -left-4 mt-1.5 h-2.5 w-2.5 rounded-full bg-[#2563EB]/70 border-2 border-white ring-1 ring-[#2563EB]/30 shrink-0" />
                                <div className="flex-1 rounded-lg border border-[var(--ds-border)] bg-white px-3 py-2 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className="text-xs font-medium leading-tight text-gray-900">
                                      {act.activityType.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                                    </p>
                                    <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                                      {new Date(act.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                                    </span>
                                  </div>
                                  {act.description && (
                                    <p className="text-xs text-gray-400 mt-0.5">{act.description}</p>
                                  )}
                                  {act.dealId && (
                                    <p className="text-[10px] text-gray-400 mt-1">Deal linked</p>
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
              onSuccess={() => { setIsFormOpen(false); setEditingInvestor(null); fetchInvestors() }}
              onCancel={() => { setIsFormOpen(false); setEditingInvestor(null) }}
            />
          )}
        </DialogContent>
      </Dialog>

      <SendPackModal
        open={isSendPackOpen && !!selectedInvestorForPack}
        onOpenChange={(open) => { setIsSendPackOpen(open); if (!open) setSelectedInvestorForPack(null) }}
        investorId={selectedInvestorForPack?.id || ""}
        investorName={selectedInvestorForPack ? getInvestorName(selectedInvestorForPack) : ""}
        onSuccess={fetchInvestors}
      />

      <ReservationModal
        open={isReservationOpen && !!selectedInvestorForReservation}
        onOpenChange={(open) => { setIsReservationOpen(open); if (!open) setSelectedInvestorForReservation(null) }}
        investorId={selectedInvestorForReservation?.id}
        onSuccess={fetchInvestors}
      />
    </div>
  )
}
