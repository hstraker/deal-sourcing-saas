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
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Loader2, CheckCircle2, XCircle, FileText, Clock, Link as LinkIcon,
  Download, RefreshCw, Mail, AlertTriangle, Package, ChevronRight,
  Banknote, FileCheck, Lock, Trophy, Ban,
} from "lucide-react"
import { format } from "date-fns"
import Link from "next/link"
import { toast } from "sonner"

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackDelivery {
  id: string
  dealId: string
  investorId: string
  partNumber: number | null
  recipientEmail: string | null
  emailStatus: string | null
  emailError: string | null
  sentAt: string
  deliveryMethod: string
}

interface Reservation {
  id: string
  investor: {
    id: string
    user: { id: string; email: string; firstName: string | null; lastName: string | null }
  }
  deal: { id: string; address: string; askingPrice: number; status: string }
  reservationFee: number
  feePaid: boolean
  feePaidAt: string | null
  proofOfFundsProvided: boolean
  proofOfFundsVerified: boolean
  proofOfFundsVerifiedAt: string | null
  lockOutAgreementSent: boolean
  lockOutAgreementSigned: boolean
  lockOutAgreementSignedAt: string | null
  status: string
  createdAt: string
  updatedAt: string
  packDeliveries?: PackDelivery[]
}

interface ReservationOverviewProps {
  initialReservations?: Reservation[]
}

// ─── Workflow config ───────────────────────────────────────────────────────────

const WORKFLOW: {
  status: string
  label: string
  color: string
  icon: React.ReactNode
  description: string
}[] = [
  { status: "pending",                label: "Pending",               color: "bg-gray-100 text-gray-800 border-gray-200",     icon: <Clock className="h-3 w-3" />,        description: "Reservation created, waiting for pack to be sent" },
  { status: "pack_sent",              label: "Pack Sent",             color: "bg-blue-100 text-blue-800 border-blue-200",     icon: <Package className="h-3 w-3" />,      description: "Investor pack has been sent" },
  { status: "fee_pending",            label: "Fee Requested",         color: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: <Banknote className="h-3 w-3" />,   description: "Reservation fee has been requested" },
  { status: "fee_paid",               label: "Fee Paid",              color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: <CheckCircle2 className="h-3 w-3" />, description: "Reservation fee received" },
  { status: "proof_of_funds_pending", label: "POF Requested",         color: "bg-orange-100 text-orange-800 border-orange-200", icon: <FileText className="h-3 w-3" />,   description: "Proof of funds has been requested from investor" },
  { status: "pof_received",           label: "POF Received",          color: "bg-sky-100 text-sky-800 border-sky-200",        icon: <FileCheck className="h-3 w-3" />,    description: "Proof of funds received — assumed verified" },
  { status: "lock_out_sent",          label: "Lock-out Sent",         color: "bg-purple-100 text-purple-800 border-purple-200", icon: <FileText className="h-3 w-3" />,   description: "Lock-out agreement sent to investor" },
  { status: "locked_out",             label: "Lock-out Signed",       color: "bg-violet-100 text-violet-800 border-violet-200", icon: <Lock className="h-3 w-3" />,       description: "Lock-out agreement signed" },
  { status: "completed",              label: "Completed",             color: "bg-teal-100 text-teal-800 border-teal-200",     icon: <Trophy className="h-3 w-3" />,       description: "Deal completed" },
  { status: "cancelled",              label: "Cancelled",             color: "bg-red-100 text-red-800 border-red-200",        icon: <Ban className="h-3 w-3" />,          description: "Reservation cancelled" },
]

const NEXT_ACTIONS: Record<string, { label: string; nextStatus: string; description: string; icon: React.ReactNode; color: string }> = {
  pending:                { label: "Request Fee",        nextStatus: "fee_pending",            description: "Request the reservation fee from investor", icon: <Banknote className="h-3.5 w-3.5" />,    color: "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" },
  pack_sent:              { label: "Request Fee",        nextStatus: "fee_pending",            description: "Request the reservation fee from investor", icon: <Banknote className="h-3.5 w-3.5" />,    color: "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50" },
  fee_pending:            { label: "Mark Fee Paid",      nextStatus: "fee_paid",               description: "Mark reservation fee as received",          icon: <CheckCircle2 className="h-3.5 w-3.5" />, color: "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50" },
  fee_paid:               { label: "Request POF",        nextStatus: "proof_of_funds_pending", description: "Request proof of funds from investor",       icon: <FileText className="h-3.5 w-3.5" />,    color: "text-orange-600 hover:text-orange-700 hover:bg-orange-50" },
  proof_of_funds_pending: { label: "Mark POF Received",  nextStatus: "pof_received",           description: "Mark proof of funds documents as received",  icon: <FileCheck className="h-3.5 w-3.5" />,   color: "text-sky-600 hover:text-sky-700 hover:bg-sky-50" },
  pof_received:           { label: "Send Lock-out",      nextStatus: "lock_out_sent",          description: "Send the lock-out agreement to investor",    icon: <FileText className="h-3.5 w-3.5" />,    color: "text-purple-600 hover:text-purple-700 hover:bg-purple-50" },
  lock_out_sent:          { label: "Mark Signed",        nextStatus: "locked_out",             description: "Mark lock-out agreement as signed",          icon: <Lock className="h-3.5 w-3.5" />,        color: "text-violet-600 hover:text-violet-700 hover:bg-violet-50" },
  locked_out:             { label: "Complete Deal",      nextStatus: "completed",              description: "Mark the deal as completed",                 icon: <Trophy className="h-3.5 w-3.5" />,      color: "text-teal-600 hover:text-teal-700 hover:bg-teal-50" },
}

function getWorkflowItem(status: string) {
  return WORKFLOW.find((w) => w.status === status) ?? WORKFLOW[0]
}

// ─── Email badge ──────────────────────────────────────────────────────────────

function EmailStatusBadge({ status }: { status: string | null }) {
  if (!status || status === "pending") return <Badge variant="outline" className="text-xs gap-1"><Mail className="h-3 w-3" />Pending</Badge>
  if (status === "sent") return <Badge variant="outline" className="text-xs gap-1 text-green-700 border-green-300 bg-green-50"><CheckCircle2 className="h-3 w-3" />Sent</Badge>
  if (status === "failed") return <Badge variant="outline" className="text-xs gap-1 text-red-700 border-red-300 bg-red-50"><XCircle className="h-3 w-3" />Failed</Badge>
  if (status === "no_smtp") return <Badge variant="outline" className="text-xs gap-1 text-amber-700 border-amber-300 bg-amber-50"><AlertTriangle className="h-3 w-3" />No SMTP</Badge>
  if (status === "not_applicable") return <Badge variant="outline" className="text-xs gap-1 text-gray-500">Manual</Badge>
  return null
}

// ─── Pack cell ────────────────────────────────────────────────────────────────

// PacksCell — no TooltipProvider (caller wraps)
function PacksCell({ deliveries, onResend }: { deliveries: PackDelivery[]; onResend: (id: string) => Promise<void> }) {
  const [resendingId, setResendingId] = useState<string | null>(null)

  if (!deliveries?.length) {
    return <span className="text-xs text-muted-foreground">No pack sent</span>
  }

  const latest = deliveries[0]
  const canResend = ["failed", "no_smtp", "pending"].includes(latest.emailStatus ?? "")

  const handleResend = async (id: string) => {
    setResendingId(id)
    await onResend(id)
    setResendingId(null)
  }

  return (
    <div className="flex items-center gap-1.5">
      <EmailStatusBadge status={latest.emailStatus} />
      {/* View PDF */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
            onClick={() => {
              fetch(`/api/investors/pack-delivery/${latest.id}/track`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view" }) }).catch(() => {})
              window.open(`/api/deals/${latest.dealId}/investor-pack`, "_blank")
            }}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <p className="font-medium">View / Download PDF</p>
          <p className="text-muted-foreground font-normal">
            {latest.partNumber ? `Part ${latest.partNumber}` : "Complete pack"} · {format(new Date(latest.sentAt), "dd MMM yyyy")}
          </p>
        </TooltipContent>
      </Tooltip>
      {/* Resend email */}
      {canResend && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
              onClick={() => handleResend(latest.id)}
              disabled={resendingId === latest.id}
            >
              {resendingId === latest.id
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />
              }
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">Resend Email</p>
            <p className="text-muted-foreground font-normal">Retry sending the pack to {latest.recipientEmail || "investor"}</p>
          </TooltipContent>
        </Tooltip>
      )}
      {deliveries.length > 1 && (
        <span className="text-xs text-muted-foreground">+{deliveries.length - 1}</span>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReservationOverview({ initialReservations = [] }: ReservationOverviewProps) {
  const [reservations, setReservations] = useState<Reservation[]>(initialReservations)
  const [isLoading, setIsLoading] = useState(false)
  const [advancingId, setAdvancingId] = useState<string | null>(null)

  // showSpinner=true for initial load; false for background refresh after mutations
  const fetchReservations = async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true)
    try {
      const response = await fetch("/api/reservations", { cache: "no-store" })
      if (response.ok) {
        const data = await response.json()
        setReservations(data)
      }
    } catch (error) {
      console.error("Error fetching reservations:", error)
    } finally {
      if (showSpinner) setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchReservations(true) // show spinner on initial load
  }, [])

  const advanceStatus = async (reservationId: string, nextStatus: string, label: string) => {
    setAdvancingId(reservationId)
    // Optimistic update — show new status immediately
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: nextStatus } : r))
    )
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (response.ok) {
        toast.success(`Status updated: ${label}`)
        window.dispatchEvent(new CustomEvent("reservationUpdated"))
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || "Failed to update status")
      }
    } catch {
      toast.error("Failed to update status")
    } finally {
      setAdvancingId(null)
      fetchReservations() // background refresh, no spinner
    }
  }

  const handleResend = async (deliveryId: string) => {
    try {
      const response = await fetch(`/api/investors/pack-delivery/${deliveryId}/resend`, { method: "POST" })
      const data = await response.json()
      if (data.success) {
        toast.success("Email resent successfully")
      } else if (data.noSmtp) {
        toast.warning("SMTP not configured — cannot send email")
      } else {
        toast.error(`Resend failed: ${data.error || "Unknown error"}`)
      }
      fetchReservations() // background refresh
    } catch {
      toast.error("Failed to resend email")
    }
  }

  const cancelReservation = async (reservationId: string) => {
    if (!confirm("Cancel this reservation?")) return
    setAdvancingId(reservationId)
    // Optimistic update
    setReservations((prev) =>
      prev.map((r) => (r.id === reservationId ? { ...r, status: "cancelled" } : r))
    )
    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      if (response.ok) {
        toast.success("Reservation cancelled")
        window.dispatchEvent(new CustomEvent("reservationUpdated"))
      } else {
        const err = await response.json().catch(() => ({}))
        toast.error(err.error || "Failed to cancel reservation")
      }
    } catch {
      toast.error("Failed to cancel reservation")
    } finally {
      setAdvancingId(null)
      fetchReservations() // background refresh, no spinner
    }
  }

  const getInvestorName = (investor: Reservation["investor"]) => {
    const name = [investor.user.firstName, investor.user.lastName].filter(Boolean).join(" ")
    return name || investor.user.email
  }

  // Count per workflow stage for pipeline tiles
  const stageCounts = Object.fromEntries(
    WORKFLOW.map((w) => [w.status, reservations.filter((r) => r.status === w.status).length])
  )
  const pipelineStages = WORKFLOW.filter((w) => w.status !== "cancelled")

  // How many reservations each investor has (total, including completed/cancelled)
  const reservationCountByInvestor = reservations.reduce<Record<string, number>>((acc, r) => {
    acc[r.investor.id] = (acc[r.investor.id] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">

      {/* ── Reservation Pipeline ───────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Reservation Pipeline</CardTitle>
          <CardDescription>Live count of reservations at each workflow stage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-1 overflow-x-auto pb-1">
            {pipelineStages.map((w, i) => (
              <div key={w.status} className="flex items-center gap-1 shrink-0">
                <div
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border px-3 py-2 min-w-[82px] ${w.color}`}
                >
                  <div className="text-xl font-bold leading-none">{stageCounts[w.status] ?? 0}</div>
                  <div className="flex items-center gap-1 text-[10px] font-medium whitespace-nowrap">
                    {w.icon}
                    {w.label}
                  </div>
                </div>
                {i < pipelineStages.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Reservations</CardTitle>
          <CardDescription>Manage reservations through the workflow — click "Next Step" to advance each reservation</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reservations.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No reservations found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Investor</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Workflow</TableHead>
                    <TableHead>Investor Pack</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Sort so same investor's reservations appear together */}
                  {[...reservations]
                    .sort((a, b) => a.investor.id.localeCompare(b.investor.id))
                    .map((r, idx, arr) => {
                    const wf = getWorkflowItem(r.status)
                    const nextAction = r.status !== "completed" && r.status !== "cancelled" ? NEXT_ACTIONS[r.status] : null
                    const isAdvancing = advancingId === r.id
                    const totalForInvestor = reservationCountByInvestor[r.investor.id] ?? 1
                    // Index of this row within the investor's group (1-based)
                    const investorGroupIndex = arr.slice(0, idx).filter((x) => x.investor.id === r.investor.id).length + 1
                    // First row of a new investor group → add a subtle top border separator
                    const isFirstInGroup = idx === 0 || arr[idx - 1].investor.id !== r.investor.id

                    return (
                      <TableRow
                        key={r.id}
                        className={isFirstInGroup && idx > 0 ? "border-t-2 border-t-muted" : ""}
                      >
                        {/* Investor */}
                        <TableCell>
                          <div className="font-medium">{getInvestorName(r.investor)}</div>
                          <div className="text-xs text-muted-foreground">{r.investor.user.email}</div>
                          {totalForInvestor > 1 && (
                            <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0 h-4 text-muted-foreground border-muted-foreground/30">
                              Deal {investorGroupIndex} of {totalForInvestor}
                            </Badge>
                          )}
                        </TableCell>

                        {/* Deal */}
                        <TableCell>
                          <Link href={`/dashboard/deals/${r.deal.id}`}
                            className="text-sm font-medium text-primary hover:underline flex items-center gap-1">
                            <LinkIcon className="h-3 w-3" />{r.deal.address}
                          </Link>
                          <div suppressHydrationWarning className="text-xs text-muted-foreground">
                            £{Number(r.deal.askingPrice).toLocaleString()}
                          </div>
                        </TableCell>

                        {/* Fee */}
                        <TableCell>
                          <div suppressHydrationWarning className="font-medium text-sm">
                            £{Number(r.reservationFee).toLocaleString()}
                          </div>
                          {r.feePaid ? (
                            <div className="flex items-center gap-1 text-green-600 text-xs">
                              <CheckCircle2 className="h-3 w-3" />
                              Paid{r.feePaidAt ? ` ${format(new Date(r.feePaidAt), "dd MMM")}` : ""}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">Not paid</div>
                          )}
                        </TableCell>

                        {/* Workflow */}
                        <TableCell>
                          <TooltipProvider delayDuration={200}>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`gap-1 text-xs shrink-0 ${wf.color}`}>
                                {wf.icon}{wf.label}
                              </Badge>
                              {nextAction && (
                                <>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className={`h-6 w-6 ${nextAction.color}`}
                                        disabled={isAdvancing}
                                        onClick={() => advanceStatus(r.id, nextAction.nextStatus, nextAction.label)}
                                      >
                                        {isAdvancing
                                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          : nextAction.icon
                                        }
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      <p className="font-medium">{nextAction.label}</p>
                                      <p className="text-muted-foreground font-normal">{nextAction.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold"
                                        disabled={isAdvancing}
                                        onClick={() => cancelReservation(r.id)}
                                      >
                                        <Ban className="h-3.5 w-3.5 stroke-[2.5]" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs text-red-600">Cancel reservation</TooltipContent>
                                  </Tooltip>
                                </>
                              )}
                            </div>
                          </TooltipProvider>
                        </TableCell>

                        {/* Investor Pack */}
                        <TableCell>
                          <TooltipProvider delayDuration={200}>
                            <PacksCell
                              deliveries={r.packDeliveries || []}
                              onResend={handleResend}
                            />
                          </TooltipProvider>
                        </TableCell>

                        {/* Created */}
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {format(new Date(r.createdAt), "dd MMM yyyy")}
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
    </div>
  )
}
