"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  CheckCircle2,
  XCircle,
  MessageSquare,
  AlertTriangle,
  ArrowDown,
  Loader2,
  TrendingDown,
  Mail,
  Phone,
  PhoneCall,
  Send,
} from "lucide-react"
import { toast } from "sonner"
import { MetricTooltipIcon } from "@/components/deals/metric-tooltip-icon"
import {
  type NegotiationLadder,
  type NegotiationRung,
} from "@/lib/offer-engine/negotiation-ladder"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type RungStatus = "pending" | "sent" | "rejected" | "accepted"

interface RungState {
  rung: NegotiationRung
  status: RungStatus
  sentAt?: Date
  rejectedAt?: Date
  notes?: string
}

interface LadderState {
  strategy: "flip" | "hold"
  currentRound: number
  rounds: RungState[]
  outcome: "in_progress" | "accepted" | "walked_away" | null
}

interface NegotiationLadderPanelProps {
  flipLadder: NegotiationLadder | null
  holdLadder: NegotiationLadder | null
  /** Which strategy tab to open by default (uses whichever ladder exists if omitted) */
  recommendedStrategy?: "flip" | "hold"
  dealId?: string | null
  onOfferSent?: (offerPrice: number, strategy: "flip" | "hold", round: number) => void
  onWalkAway?: (strategy: "flip" | "hold") => void
  readOnly?: boolean
  vendorLeadId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  vendorPhone?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return `£${Math.round(n).toLocaleString("en-GB")}`
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`
}

function initLadderState(ladder: NegotiationLadder): LadderState {
  return {
    strategy: ladder.strategy,
    currentRound: 0,
    rounds: ladder.rungs.map((rung) => ({ rung, status: "pending" })),
    outcome: null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Single rung component
// ─────────────────────────────────────────────────────────────────────────────

function LadderRung({
  rungState,
  isActive,
  isLocked,
  onSend,
  onAccepted,
  onRejected,
  sendingRound,
}: {
  rungState: RungState
  isActive: boolean
  isLocked: boolean
  onSend: () => void
  onAccepted: () => void
  onRejected: () => void
  sendingRound: number | null
}) {
  const { rung, status } = rungState
  const isSending = sendingRound === rung.round

  const borderClass =
    status === "accepted"
      ? "border-green-500 bg-green-50"
      : status === "rejected"
      ? "border-red-300 bg-red-50/50 opacity-70"
      : rung.isAbsoluteMaximum && isActive
      ? "border-amber-500 bg-amber-50"
      : isActive
      ? "border-[#2563EB] bg-[#EFF6FF]"
      : "border-[var(--ds-border)] bg-gray-50/50"

  const returnDisplay =
    rungState.rung.returnLabel === "Profit on Cost"
      ? `${(rung.returnAtThisPrice * 100).toFixed(1)}%`
      : `${rung.returnAtThisPrice.toFixed(2)}x`

  return (
    <div className={`rounded-lg border-2 p-4 transition-all ${borderClass}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Round {rung.round}
            </span>
            <span
              className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                rung.isAbsoluteMaximum
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[#EFF6FF] text-[#2563EB]"
              }`}
            >
              {rung.label}
              {rung.isAbsoluteMaximum && " ⚠️"}
            </span>
            {status === "accepted" && (
              <Badge className="bg-green-100 text-green-700 border-green-300">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Accepted
              </Badge>
            )}
            {status === "rejected" && (
              <Badge variant="destructive" className="opacity-80">
                <XCircle className="h-3 w-3 mr-1" /> Rejected
              </Badge>
            )}
            {status === "sent" && (
              <Badge variant="secondary">Awaiting Response</Badge>
            )}
          </div>
          <p className="text-2xl font-bold mt-1">{fmt(rung.offerPrice)}</p>
        </div>

        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400">Below asking</p>
          <p className="text-sm font-semibold">{pct(rung.discountPercent)}</p>
          <p className="text-xs text-gray-400 mt-1">
            {pct(rung.ceilingPercent * 1)} of ceiling
          </p>
        </div>
      </div>

      {/* Return metrics */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <div
          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded ${
            rung.returnMeetsCriteria
              ? "bg-green-100 text-green-700"
              : "bg-red-100 text-red-700"
          }`}
        >
          {rung.returnMeetsCriteria ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : (
            <XCircle className="h-3 w-3" />
          )}
          {rung.returnLabel}: {returnDisplay}
        </div>

        {rung.headroomRemaining > 0 && (
          <span className="text-xs text-gray-400">
            {fmt(rung.headroomRemaining)} headroom left
          </span>
        )}

        {rung.round > 0 && rung.stepUpFromPrevious > 0 && (
          <span className="text-xs text-gray-400">
            Step: +{fmt(rung.stepUpFromPrevious)}
          </span>
        )}
      </div>

      {/* Tactical note */}
      <div className="rounded bg-gray-100 px-3 py-2 mb-3">
        <p className="text-xs text-gray-400 italic leading-relaxed">
          &ldquo;{rung.negotiatingNote}&rdquo;
        </p>
      </div>

      {/* Best & final warning */}
      {rung.isAbsoluteMaximum && isActive && status !== "accepted" && (
        <div className="flex items-start gap-2 rounded bg-amber-100 px-3 py-2 mb-3">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-medium">
            YOUR CEILING — DO NOT EXCEED. Walk away if rejected.
          </p>
        </div>
      )}

      {/* Action buttons */}
      {!isLocked && isActive && status === "pending" && (
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" onClick={onSend} disabled={isSending}>
            {isSending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            )}
            {rung.isAbsoluteMaximum ? "Send Best & Final" : "Send This Offer"}
          </Button>
        </div>
      )}

      {!isLocked && isActive && status === "sent" && (
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="text-green-700 border-green-300 hover:bg-green-50"
            onClick={onAccepted}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Accepted
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-300 hover:bg-red-50"
            onClick={onRejected}
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            Rejected — Next Counter
          </Button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Step connector
// ─────────────────────────────────────────────────────────────────────────────

function StepConnector({ step, label }: { step: number; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1 pl-4">
      <ArrowDown className="h-4 w-4 text-gray-400 shrink-0" />
      <span className="text-xs text-gray-400">
        +{fmt(step)} ({label})
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Single strategy ladder view
// ─────────────────────────────────────────────────────────────────────────────

function LadderView({
  ladder,
  dealId,
  onOfferSent,
  onWalkAway,
  readOnly,
  vendorLeadId,
  vendorName,
  vendorEmail,
  vendorPhone,
}: {
  ladder: NegotiationLadder
  dealId?: string | null
  onOfferSent?: (offerPrice: number, strategy: "flip" | "hold", round: number) => void
  onWalkAway?: (strategy: "flip" | "hold") => void
  readOnly?: boolean
  vendorLeadId?: string | null
  vendorName?: string | null
  vendorEmail?: string | null
  vendorPhone?: string | null
}) {
  const [state, setState] = useState<LadderState>(() => initLadderState(ladder))
  const [sendingRound, setSendingRound] = useState<number | null>(null)

  // Send Offer dialog state
  const [pendingRound, setPendingRound] = useState<number | null>(null)
  const [sendChannel, setSendChannel] = useState<"email" | "sms" | "phone">("email")
  const [offerMessage, setOfferMessage] = useState("")
  const [isSending, setIsSending] = useState(false)

  const buildMessage = (offerPrice: number) => {
    const name = vendorName?.split(" ")[0] || "there"
    const address = ladder.askingPrice > 0 ? "" : ""
    const offer = `£${Math.round(offerPrice).toLocaleString("en-GB")}`
    const asking = `£${Math.round(ladder.askingPrice).toLocaleString("en-GB")}`
    return `Hi ${name},\n\nThank you for speaking with us. We'd like to make you a formal offer on your property.\n\nOur offer: ${offer}\nAsking price: ${asking}\n\nThis offer reflects the current market and condition of the property. Please let us know if you'd like to discuss further.`
  }

  const handleSendClick = (round: number) => {
    setOfferMessage(buildMessage(ladder.rungs[round].offerPrice))
    setSendChannel("email")
    setPendingRound(round)
  }

  const handleSendSubmit = async () => {
    if (pendingRound === null) return
    setIsSending(true)
    const rung = ladder.rungs[pendingRound]
    try {
      if (vendorLeadId) {
        const res = await fetch(`/api/vendor-pipeline/leads/${vendorLeadId}/send-vendor-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channel: sendChannel,
            message: offerMessage,
            round: pendingRound,
            offerPrice: rung.offerPrice,
            strategy: ladder.strategy,
          }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Failed to send offer")
        if (sendChannel === "phone") {
          toast.success("Call logged")
        } else if (data.noSmtp) {
          toast.warning("Offer logged (SMTP not configured — email not delivered)")
        } else if (sendChannel === "email" && data.emailDelivered === false) {
          toast.warning("Offer logged but email delivery failed — check SMTP settings")
        } else {
          toast.success(`Offer sent via ${sendChannel === "email" ? "email" : "SMS"}`)
        }
      }

      // Mark rung as sent
      setState((prev) => {
        const rounds = [...prev.rounds]
        rounds[pendingRound] = { ...rounds[pendingRound], status: "sent", sentAt: new Date() }
        return { ...prev, rounds }
      })
      onOfferSent?.(rung.offerPrice, ladder.strategy, pendingRound)
      setPendingRound(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to send offer")
    } finally {
      setIsSending(false)
    }
  }

  const handleSend = async (round: number) => {
    setSendingRound(round)
    const rung = ladder.rungs[round]

    // API call if dealId present (non-vendor-lead context)
    if (dealId) {
      try {
        await fetch(`/api/deals/${dealId}/send-offer`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            strategy: ladder.strategy,
            round,
            offerPrice: rung.offerPrice,
          }),
        })
      } catch {
        // Non-fatal — update state locally regardless
      }
    }

    setState((prev) => {
      const rounds = [...prev.rounds]
      rounds[round] = { ...rounds[round], status: "sent", sentAt: new Date() }
      return { ...prev, rounds }
    })

    onOfferSent?.(rung.offerPrice, ladder.strategy, round)
    setSendingRound(null)
  }

  const handleAccepted = async (round: number) => {
    const rung = ladder.rungs[round]

    if (dealId) {
      try {
        await fetch(`/api/deals/${dealId}/offer-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round, response: "accepted" }),
        })
      } catch {
        // Non-fatal
      }
    }

    // Advance pipeline stage to OFFER_ACCEPTED — this triggers the automated vendor thank-you email
    if (vendorLeadId) {
      try {
        await fetch(`/api/vendor-pipeline/leads/${vendorLeadId}/update-stage`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pipelineStage: "OFFER_ACCEPTED" }),
        })
      } catch {
        // Non-fatal
      }
    }

    setState((prev) => {
      const rounds = [...prev.rounds]
      rounds[round] = { ...rounds[round], status: "accepted" }
      return { ...prev, rounds, outcome: "accepted" }
    })
    void rung
  }

  const handleRejected = async (round: number) => {
    if (dealId) {
      try {
        await fetch(`/api/deals/${dealId}/offer-response`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ round, response: "rejected" }),
        })
      } catch {
        // Non-fatal
      }
    }

    setState((prev) => {
      const rounds = [...prev.rounds]
      rounds[round] = { ...rounds[round], status: "rejected", rejectedAt: new Date() }
      const nextRound = round + 1 < rounds.length ? round + 1 : prev.currentRound
      return { ...prev, rounds, currentRound: nextRound }
    })
  }

  const handleWalkAway = async () => {
    if (dealId) {
      try {
        await fetch(`/api/deals/${dealId}/walk-away`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strategy: ladder.strategy }),
        })
      } catch {
        // Non-fatal
      }
    }

    setState((prev) => ({ ...prev, outcome: "walked_away" }))
    onWalkAway?.(ladder.strategy)
  }

  const isWalkedAway = state.outcome === "walked_away"
  const isDealAgreed = state.outcome === "accepted"
  const agreedRound = state.rounds.find((r) => r.status === "accepted")

  // Asking price at top
  const askingDiscountPct =
    ladder.askingPrice > 0
      ? ((ladder.askingPrice - ladder.ceiling) / ladder.askingPrice) * 100
      : 0

  return (
    <div className="space-y-1">
      {/* Asking price bar */}
      <div className="flex items-center justify-between px-1 pb-2 border-b">
        <div>
          <span className="text-xs text-gray-400 uppercase tracking-wide">Asking Price</span>
          <p className="text-lg font-bold">{fmt(ladder.askingPrice)}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-400">Ceiling is</span>
          {askingDiscountPct < 0.05 ? (
            <p className="text-sm font-semibold text-green-700">At asking price</p>
          ) : (
            <p className="text-sm font-semibold text-amber-700">
              {askingDiscountPct.toFixed(1)}% below asking
            </p>
          )}
        </div>
      </div>

      {/* Deal agreed banner */}
      {isDealAgreed && agreedRound && (
        <div className="rounded-xl border-2 border-green-500 bg-green-50 px-4 py-3 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <div>
            <p className="font-bold text-green-800">
              DEAL AGREED at {fmt(agreedRound.rung.offerPrice)}
            </p>
            <p className="text-xs text-green-700">
              {agreedRound.rung.label} accepted —{" "}
              {pct(agreedRound.rung.discountPercent)} below asking price
            </p>
          </div>
        </div>
      )}

      {/* Walk away banner */}
      {isWalkedAway && (
        <div className="rounded-xl border-2 border-red-400 bg-red-50 px-4 py-3 flex items-center gap-3">
          <TrendingDown className="h-6 w-6 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-red-800">WALKED AWAY — Deal Dead</p>
            <p className="text-xs text-red-700">
              Vendor rejected Best &amp; Final at {fmt(ladder.ceiling)}. Numbers don&apos;t work
              above this price.
            </p>
          </div>
        </div>
      )}

      {/* Rungs */}
      {!isDealAgreed && !isWalkedAway && (
        <div className="space-y-0.5">
          {ladder.rungs.map((rung, i) => {
            const rungState = state.rounds[i]
            const isActive = i === state.currentRound
            const isLocked = readOnly || state.outcome !== null || i > state.currentRound

            return (
              <div key={rung.round}>
                {i > 0 && state.rounds[i - 1].status === "rejected" && (
                  <StepConnector
                    step={rung.stepUpFromPrevious}
                    label={`if rejected ↓`}
                  />
                )}
                {i > 0 && state.rounds[i - 1].status !== "rejected" && (
                  <StepConnector
                    step={rung.stepUpFromPrevious}
                    label={`if rejected ↓${i === ladder.rungs.length - 1 ? " (step getting smaller)" : ""}`}
                  />
                )}
                <LadderRung
                  rungState={rungState}
                  isActive={isActive}
                  isLocked={isLocked}
                  onSend={() => vendorLeadId ? handleSendClick(i) : handleSend(i)}
                  onAccepted={() => handleAccepted(i)}
                  onRejected={() => handleRejected(i)}
                  sendingRound={sendingRound}
                />
              </div>
            )
          })}
        </div>
      )}

      {/* Walk away button — shown after final rung is rejected or sent */}
      {!isWalkedAway && !isDealAgreed && !readOnly && (
        (() => {
          const lastRung = state.rounds[state.rounds.length - 1]
          const showWalkAway =
            lastRung.status === "rejected" ||
            (lastRung.status === "sent" && state.currentRound === state.rounds.length - 1)
          return showWalkAway ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-full mt-2"
              onClick={handleWalkAway}
            >
              <TrendingDown className="h-3.5 w-3.5 mr-1.5" />
              Walk Away — Deal Dead
            </Button>
          ) : null
        })()
      )}

      {/* Concession summary */}
      <div className="border-t pt-3 mt-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Concession Summary
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
          {ladder.taperedSteps.map((step, i) => {
            const labels = ["Opening → Counter 1", "Counter 1 → Counter 2", "Counter 2 → Best & Final"]
            return (
              <span key={i}>
                <span className="font-medium text-gray-900">{labels[i]}:</span>{" "}
                +{fmt(step)}
              </span>
            )
          })}
        </div>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-gray-400">
            Total room: {fmt(ladder.totalConcession)}
          </span>
          {ladder.isTaperingCorrectly ? (
            <span className="text-xs text-green-600 flex items-center gap-0.5">
              <CheckCircle2 className="h-3 w-3" /> Steps tapering correctly
            </span>
          ) : (
            <span className="text-xs text-amber-600 flex items-center gap-0.5">
              <AlertTriangle className="h-3 w-3" /> Steps not tapering — review opening buffer
            </span>
          )}
        </div>
      </div>

      {/* Send Offer Dialog */}
      {vendorLeadId && (
        <Dialog open={pendingRound !== null} onOpenChange={(open) => { if (!open) setPendingRound(null) }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Send Offer — {vendorName || "Vendor"}</DialogTitle>
            </DialogHeader>

            {/* Channel selector */}
            <Tabs value={sendChannel} onValueChange={(v) => setSendChannel(v as "email" | "sms" | "phone")}>
              <TabsList className="w-full">
                <TabsTrigger value="email" className="flex-1 gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Email
                </TabsTrigger>
                <TabsTrigger value="sms" className="flex-1 gap-1.5" disabled={!vendorPhone}>
                  <Phone className="h-3.5 w-3.5" /> SMS
                </TabsTrigger>
                <TabsTrigger value="phone" className="flex-1 gap-1.5">
                  <PhoneCall className="h-3.5 w-3.5" /> Phone Call
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {sendChannel === "email" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400">To</Label>
                  <p className="text-sm font-medium mt-0.5">{vendorEmail || <span className="text-red-500">No email on record</span>}</p>
                </div>
                <div>
                  <Label htmlFor="vendor-offer-msg" className="text-xs text-gray-400">Message</Label>
                  <Textarea
                    id="vendor-offer-msg"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    rows={8}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            )}

            {sendChannel === "sms" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400">To</Label>
                  <p className="text-sm font-medium mt-0.5">{vendorPhone || <span className="text-red-500">No phone on record</span>}</p>
                </div>
                <div>
                  <Label htmlFor="vendor-sms-msg" className="text-xs text-gray-400">
                    Message <span className="font-normal">({offerMessage.length}/160)</span>
                  </Label>
                  <Textarea
                    id="vendor-sms-msg"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value.slice(0, 160))}
                    rows={5}
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            )}

            {sendChannel === "phone" && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-gray-400">Vendor Phone</Label>
                  <p className="text-xl font-bold mt-0.5">{vendorPhone || <span className="text-red-500 text-base font-normal">No phone on record</span>}</p>
                </div>
                <div>
                  <Label htmlFor="call-notes" className="text-xs text-gray-400">Call Notes</Label>
                  <Textarea
                    id="call-notes"
                    value={offerMessage}
                    onChange={(e) => setOfferMessage(e.target.value)}
                    rows={4}
                    placeholder="Log what was discussed..."
                    className="mt-1 text-sm"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingRound(null)} disabled={isSending}>
                Cancel
              </Button>
              <Button
                onClick={handleSendSubmit}
                disabled={
                  isSending ||
                  (sendChannel === "email" && !vendorEmail) ||
                  (sendChannel === "sms" && !vendorPhone)
                }
              >
                {isSending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : sendChannel === "phone" ? (
                  <PhoneCall className="h-3.5 w-3.5 mr-1.5" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                )}
                {sendChannel === "phone" ? "Log Call" : "Send Offer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function NegotiationLadderPanel({
  flipLadder,
  holdLadder,
  recommendedStrategy,
  dealId,
  onOfferSent,
  onWalkAway,
  readOnly,
  vendorLeadId,
  vendorName,
  vendorEmail,
  vendorPhone,
}: NegotiationLadderPanelProps) {
  // Default to recommendedStrategy if provided, otherwise whichever ladder exists
  const defaultStrategy =
    recommendedStrategy ?? (flipLadder ? "flip" : holdLadder ? "hold" : null)

  const [activeStrategy, setActiveStrategy] = useState<"flip" | "hold">(
    defaultStrategy ?? "flip"
  )

  if (!flipLadder && !holdLadder) {
    return (
      <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-gray-400">
        No viable strategies found — negotiation ladder unavailable.
      </div>
    )
  }

  const activeLadder = activeStrategy === "flip" ? flipLadder : holdLadder

  return (
    <div className="space-y-4">
      {/* Panel header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">
            Negotiation Ladder
            <MetricTooltipIcon tooltipKey="taperingConcessions" />
          </span>
        </div>

        {/* Strategy selector */}
        {flipLadder && holdLadder && (
          <Tabs
            value={activeStrategy}
            onValueChange={(v) => setActiveStrategy(v as "flip" | "hold")}
          >
            <TabsList className="h-7">
              <TabsTrigger value="flip" className="text-xs h-6 px-2.5">
                🔄 Flip
              </TabsTrigger>
              <TabsTrigger value="hold" className="text-xs h-6 px-2.5">
                🏠 Hold
              </TabsTrigger>
            </TabsList>
          </Tabs>
        )}

        {!flipLadder && holdLadder && (
          <Badge variant="secondary">Hold / BRRR only</Badge>
        )}
        {flipLadder && !holdLadder && (
          <Badge variant="secondary">Flip only</Badge>
        )}
      </div>

      {/* Rationale */}
      {activeLadder && (
        <p className="text-xs text-gray-400 italic leading-relaxed">
          {activeLadder.ladderRationale}
        </p>
      )}

      {/* Ladder */}
      {activeLadder ? (
        <LadderView
          ladder={activeLadder}
          dealId={dealId}
          onOfferSent={onOfferSent}
          onWalkAway={onWalkAway}
          readOnly={readOnly}
          vendorLeadId={vendorLeadId}
          vendorName={vendorName}
          vendorEmail={vendorEmail}
          vendorPhone={vendorPhone}
        />
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-4 text-center text-sm text-gray-400">
          {activeStrategy === "flip"
            ? "Flip strategy not viable — switch to Hold"
            : "Hold strategy not viable — switch to Flip"}
        </div>
      )}
    </div>
  )
}
