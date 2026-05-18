"use client"

import { useState, useCallback } from "react"
import {
  Users, CheckCircle2, Clock, RefreshCw, ChevronDown, ChevronRight,
  Mail, Phone, Zap, AlertCircle, MessageSquare, Sparkles, Send,
  Edit3, X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface MatchedInvestor {
  investorId: string
  name: string
  score: number
  matched: string[]
  criteriaLine: string
  email: string
  phone: string | null
  pipelineStage: string
  financingStatus: string | null
  notification: { sentAt: string; channel: string } | null
}

interface DealValues {
  price: number
  bmvPct: number | null
  grossYield: number | null          // yield vs offer price (investor's actual return)
  grossYieldVsMarket: number | null  // yield vs market value (industry-standard comparison)
  marketValue: number | null
  recommendedStrategy: string | null
}

interface InvestorMatchPanelProps {
  leadId: string
  validationPassed: boolean | null
}

type PitchState = "idle" | "loading" | "ready" | "error"

// ── Helpers ───────────────────────────────────────────────────────────────────

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n)
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days}d ago`
  if (hrs > 0) return `${hrs}h ago`
  return `${mins}m ago`
}

function scoreColour(pct: number) {
  if (pct >= 80) return { bar: "bg-green-500", text: "text-green-700", badge: "bg-green-100 text-green-700 border-green-200" }
  if (pct >= 60) return { bar: "bg-blue-500", text: "text-blue-700", badge: "bg-blue-100 text-blue-700 border-blue-200" }
  if (pct >= 40) return { bar: "bg-amber-400", text: "text-amber-600", badge: "bg-amber-100 text-amber-700 border-amber-200" }
  return { bar: "bg-gray-300", text: "text-gray-500", badge: "bg-gray-100 text-gray-500 border-gray-200" }
}

const STAGE_LABEL: Record<string, string> = {
  LEAD: "Lead", CONTACTED: "Contacted", QUALIFIED: "Qualified",
  VIEWING_DEALS: "Active", RESERVED: "Reserved", PURCHASED: "Purchased", INACTIVE: "Inactive",
}

// ── Investor row ──────────────────────────────────────────────────────────────

function InvestorRow({
  investor, leadId, channel, onNotified, defaultOfferPrice, defaultMarketValue,
}: {
  investor: MatchedInvestor
  leadId: string
  channel: "email" | "sms" | "both"
  onNotified: (investorId: string, sentAt: string, channel: string) => void
  defaultOfferPrice: number | null
  defaultMarketValue: number | null
}) {
  const matchPct = Math.round(investor.score * 100)
  const col = scoreColour(matchPct)
  const [sending, setSending] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const alreadySent = !!investor.notification

  // Offer editor state — sourcer can change price before sending
  const [offerInput, setOfferInput] = useState(
    defaultOfferPrice ? String(Math.round(defaultOfferPrice)) : ""
  )
  const offerNum = parseFloat(offerInput.replace(/,/g, "")) || null
  const liveOfferBmv =
    offerNum && defaultMarketValue && defaultMarketValue > 0
      ? ((defaultMarketValue - offerNum) / defaultMarketValue) * 100
      : null

  // AI pitch state
  const [pitchState, setPitchState] = useState<PitchState>("idle")
  const [emailPitch, setEmailPitch] = useState("")
  const [smsPitch, setSmsPitch] = useState("")
  const [pitchSubject, setPitchSubject] = useState("")
  const [editingPitch, setEditingPitch] = useState(false)
  const [editedMessage, setEditedMessage] = useState("")

  const NotifyIcon =
    channel === "sms" ? MessageSquare : channel === "both" ? Zap : Mail

  function buildNotifyBody(extraMessage?: string) {
    return {
      investorId: investor.investorId,
      channel,
      ...(offerNum ? { offerAmountOverride: offerNum } : {}),
      ...(extraMessage ? { message: extraMessage } : {}),
    }
  }

  // Generic quick notify — uses current offerInput as override
  async function handleQuickNotify() {
    setSending(true)
    try {
      const res = await fetch(
        `/api/vendor-pipeline/leads/${leadId}/notify-investor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildNotifyBody()),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")

      if (data.noSmtp && channel !== "sms") {
        toast.info(`Notification logged for ${investor.name} (no SMTP configured — email not sent)`)
      } else {
        toast.success(`Deal alert sent to ${investor.name} via ${channel}`)
      }
      onNotified(investor.investorId, new Date().toISOString(), channel)
    } catch (err: any) {
      toast.error(err.message || "Failed to send notification")
    } finally {
      setSending(false)
    }
  }

  // Send with AI-generated (possibly edited) pitch + current offer price override
  async function handleSendPitch() {
    const messageToSend = editingPitch ? editedMessage : (channel === "sms" ? smsPitch : emailPitch)
    setSending(true)
    try {
      const res = await fetch(
        `/api/vendor-pipeline/leads/${leadId}/notify-investor`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildNotifyBody(messageToSend)),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")

      if (data.noSmtp && channel !== "sms") {
        toast.info(`Pitch logged for ${investor.name} (no SMTP configured — email not sent)`)
      } else {
        toast.success(`Personalised pitch sent to ${investor.name} via ${channel}`)
      }
      onNotified(investor.investorId, new Date().toISOString(), channel)
    } catch (err: any) {
      toast.error(err.message || "Failed to send pitch")
    } finally {
      setSending(false)
    }
  }

  // Generate AI pitch on expand
  async function handleExpand() {
    const willExpand = !expanded
    setExpanded(willExpand)
    // Auto-generate on first open
    if (willExpand && pitchState === "idle") {
      await generatePitch()
    }
  }

  async function generatePitch() {
    setPitchState("loading")
    try {
      const res = await fetch(
        `/api/vendor-pipeline/leads/${leadId}/generate-investor-pitch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ investorId: investor.investorId }),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate pitch")

      setEmailPitch(data.email ?? "")
      setSmsPitch(data.sms ?? "")
      setPitchSubject(data.subject ?? "")
      setEditedMessage(data.email ?? "")
      setPitchState("ready")
    } catch (err: any) {
      console.error("[generate-investor-pitch]", err)
      setPitchState("error")
    }
  }

  const activePitch = channel === "sms" ? smsPitch : emailPitch

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Score badge */}
        <div className={cn("rounded-lg border px-2 py-1 text-center shrink-0 w-12", col.badge)}>
          <span className="text-sm font-extrabold">{matchPct}%</span>
        </div>

        {/* Investor info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-gray-900 truncate">{investor.name}</span>
            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
              {STAGE_LABEL[investor.pipelineStage] ?? investor.pipelineStage}
            </span>
            {investor.financingStatus && (
              <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full capitalize">
                {investor.financingStatus}
              </span>
            )}
          </div>
          {investor.criteriaLine && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{investor.criteriaLine}</p>
          )}
          {/* Match criteria pills */}
          <div className="flex gap-1 mt-1 flex-wrap">
            {investor.matched.map((label) => (
              <span key={label} className="text-[10px] bg-green-50 border border-green-200 text-green-700 px-1.5 py-0.5 rounded-full font-medium">
                ✓ {label}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Sent status badge */}
          {alreadySent && (
            <div className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span className="text-[11px] font-semibold">
                Sent{investor.notification!.channel && investor.notification!.channel !== "email"
                  ? ` via ${investor.notification!.channel}`
                  : ""} {timeAgo(investor.notification!.sentAt)}
              </span>
            </div>
          )}

          {/* Quick notify (generic) — only when not yet sent */}
          {!alreadySent && (
            <button
              onClick={handleQuickNotify}
              disabled={sending}
              title="Send generic deal alert"
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {sending
                ? <RefreshCw className="h-3 w-3 animate-spin" />
                : <NotifyIcon className="h-3 w-3" />
              }
              {sending ? "Sending…" : "Quick Notify"}
            </button>
          )}

          {/* Expand toggle (also triggers AI pitch generation) */}
          <button
            onClick={handleExpand}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
            title={expanded ? "Collapse" : "AI pitch & contact details"}
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Match bar */}
      <div className="h-0.5 bg-gray-100">
        <div className={cn("h-0.5 transition-all", col.bar)} style={{ width: `${matchPct}%` }} />
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40">
          {/* Contact details */}
          <div className="flex gap-4 px-4 pt-3 pb-2 text-xs text-gray-500">
            {investor.email && (
              <a href={`mailto:${investor.email}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors">
                <Mail className="h-3 w-3" /> {investor.email}
              </a>
            )}
            {investor.phone && (
              <a href={`tel:${investor.phone}`} className="flex items-center gap-1 hover:text-green-600 transition-colors">
                <Phone className="h-3 w-3" /> {investor.phone}
              </a>
            )}
            {investor.notification && (
              <span className="ml-auto flex items-center gap-1 text-gray-400">
                <Clock className="h-3 w-3" />
                Last notified {new Date(investor.notification.sentAt).toLocaleString("en-GB", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                })}
              </span>
            )}
          </div>

          {/* ── Offer editor ─────────────────────────────────────────── */}
          <div className="px-4 pb-3">
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
                <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">Offer to show investor</span>
                {liveOfferBmv !== null && (
                  <span className={cn(
                    "text-[11px] font-bold px-2 py-0.5 rounded-full",
                    liveOfferBmv >= 20 ? "bg-green-100 text-green-700" :
                    liveOfferBmv >= 10 ? "bg-blue-100 text-blue-700" :
                    liveOfferBmv > 0   ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
                  )}>
                    {liveOfferBmv.toFixed(1)}% BMV
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span className="text-xs text-gray-400 shrink-0">£</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={offerInput}
                  onChange={(e) => setOfferInput(e.target.value.replace(/[^0-9,]/g, ""))}
                  placeholder={defaultOfferPrice ? String(Math.round(defaultOfferPrice)) : "Enter offer price"}
                  className="flex-1 text-sm font-mono font-bold text-gray-800 bg-transparent focus:outline-none placeholder:text-gray-300"
                />
                {defaultMarketValue && (
                  <span className="text-[10px] text-gray-400 shrink-0">
                    of {gbp(defaultMarketValue)} MV
                  </span>
                )}
              </div>
              {offerNum && defaultOfferPrice && offerNum !== Math.round(defaultOfferPrice) && (
                <div className="px-3 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center justify-between">
                  <span className="text-[10px] text-amber-700">
                    Modified from {gbp(defaultOfferPrice)} (original calculated offer)
                  </span>
                  <button
                    onClick={() => setOfferInput(String(Math.round(defaultOfferPrice)))}
                    className="text-[10px] text-amber-600 underline hover:no-underline"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* AI Pitch section */}
          <div className="px-4 pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <span className="text-xs font-semibold text-gray-700">AI Personalised Pitch</span>
                {pitchState === "ready" && (
                  <span className="text-[10px] text-violet-600 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-full font-medium">
                    Claude generated
                  </span>
                )}
              </div>
              {pitchState === "ready" && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { setEditingPitch(!editingPitch); if (!editingPitch) setEditedMessage(activePitch) }}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    {editingPitch ? <><X className="h-2.5 w-2.5" /> Cancel</> : <><Edit3 className="h-2.5 w-2.5" /> Edit</>}
                  </button>
                  <button
                    onClick={generatePitch}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-gray-500 hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw className="h-2.5 w-2.5" /> Regenerate
                  </button>
                </div>
              )}
            </div>

            {/* Pitch state: loading */}
            {pitchState === "loading" && (
              <div className="flex items-center gap-2 rounded-lg border border-violet-100 bg-violet-50 px-3 py-3 text-xs text-violet-600">
                <RefreshCw className="h-3.5 w-3.5 animate-spin shrink-0" />
                <span>Claude is writing a personalised pitch for {investor.name}…</span>
              </div>
            )}

            {/* Pitch state: error */}
            {pitchState === "error" && (
              <div className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-600">
                <span>Could not generate pitch — check API key configuration.</span>
                <button onClick={generatePitch} className="underline hover:no-underline ml-2 shrink-0">Retry</button>
              </div>
            )}

            {/* Pitch state: ready */}
            {pitchState === "ready" && (
              <div className="space-y-2">
                {/* Subject line (email only) */}
                {channel !== "sms" && pitchSubject && (
                  <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">Subject</p>
                    <p className="text-xs text-gray-700 font-medium">{pitchSubject}</p>
                  </div>
                )}

                {/* Message body */}
                <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                  <div className="px-3 pt-2 pb-1 flex items-center justify-between border-b border-gray-100">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                      {channel === "sms" ? "SMS message" : "Email body"}
                    </p>
                    {channel === "sms" && (
                      <p className={cn("text-[10px]", activePitch.length > 140 ? "text-red-500" : "text-gray-400")}>
                        {activePitch.length}/140 chars
                      </p>
                    )}
                  </div>
                  {editingPitch ? (
                    <textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      rows={channel === "sms" ? 3 : 8}
                      className="w-full px-3 py-2 text-xs text-gray-700 leading-relaxed resize-none focus:outline-none focus:ring-0"
                    />
                  ) : (
                    <p className="px-3 py-2 text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {activePitch}
                    </p>
                  )}
                </div>

                {/* SMS preview when in email mode */}
                {channel !== "sms" && smsPitch && (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-white px-3 py-2">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                      SMS preview <span className="normal-case text-gray-300">(if sending "Both")</span>
                    </p>
                    <p className="text-[11px] text-gray-500">{smsPitch}</p>
                  </div>
                )}

                {/* Send pitched message button */}
                <button
                  onClick={handleSendPitch}
                  disabled={sending || (editingPitch && !editedMessage.trim())}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  {sending
                    ? <><RefreshCw className="h-3 w-3 animate-spin" /> Sending…</>
                    : <><Send className="h-3 w-3" /> Send {editingPitch ? "edited" : "AI"} pitch via {channel}</>
                  }
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InvestorMatchPanel({ leadId, validationPassed }: InvestorMatchPanelProps) {
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [matches, setMatches] = useState<MatchedInvestor[]>([])
  const [dealValues, setDealValues] = useState<DealValues | null>(null)
  const [sendingAll, setSendingAll] = useState(false)
  const [filter, setFilter] = useState<"all" | "unsent">("all")
  const [channel, setChannel] = useState<"email" | "sms" | "both">("email")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/matching-investors`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMatches(data.matches ?? [])
      setDealValues(data.dealValues ?? null)
      setLoaded(true)
    } catch (err: any) {
      toast.error(err.message || "Failed to load investors")
    } finally {
      setLoading(false)
    }
  }, [leadId])

  function handleNotified(investorId: string, sentAt: string, notifChannel: string = "email") {
    setMatches((prev) =>
      prev.map((m) =>
        m.investorId === investorId
          ? { ...m, notification: { sentAt, channel: notifChannel } }
          : m
      )
    )
  }

  async function handleSendAll() {
    const unsent = matches.filter((m) => !m.notification && m.score >= 0.6)
    if (unsent.length === 0) {
      toast.info("No unnotified investors with ≥60% match")
      return
    }
    setSendingAll(true)
    let sent = 0
    for (const inv of unsent) {
      try {
        const res = await fetch(
          `/api/vendor-pipeline/leads/${leadId}/notify-investor`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ investorId: inv.investorId, channel }),
          }
        )
        if (res.ok) {
          handleNotified(inv.investorId, new Date().toISOString(), channel)
          sent++
        }
      } catch {}
    }
    setSendingAll(false)
    toast.success(`Notified ${sent} of ${unsent.length} investors via ${channel}`)
  }

  const displayed = filter === "unsent" ? matches.filter((m) => !m.notification) : matches
  const unsentHighMatch = matches.filter((m) => !m.notification && m.score >= 0.6)

  return (
    <div className="ds-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--ds-border)] px-5 py-4">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[#2563EB]" />
          <h3 className="text-sm font-semibold text-gray-900">Matched Investors</h3>
          {loaded && matches.length > 0 && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              {matches.length}
            </span>
          )}
          {loaded && (
            <span className="flex items-center gap-1 text-[10px] text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5" /> AI pitches
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Channel picker */}
          {loaded && matches.length > 0 && (
            <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden text-xs">
              {(["email", "sms", "both"] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setChannel(ch)}
                  className={cn(
                    "px-2.5 py-1.5 font-medium transition-colors border-r border-gray-200 last:border-r-0",
                    channel === ch ? "bg-blue-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                  )}
                >
                  {ch === "email" ? "Email" : ch === "sms" ? "SMS" : "Both"}
                </button>
              ))}
            </div>
          )}
          {loaded && (
            <button
              onClick={load}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Refresh matches"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
          {!loaded ? (
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
              {loading ? "Matching…" : "Find Matches"}
            </button>
          ) : unsentHighMatch.length > 0 ? (
            <button
              onClick={handleSendAll}
              disabled={sendingAll}
              title="Send generic alert to all unnotified ≥60% matches"
              className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {sendingAll ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
              {sendingAll ? "Sending…" : `Notify All (${unsentHighMatch.length})`}
            </button>
          ) : null}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {!loaded && !loading && (
          <div className="text-center py-8">
            <Users className="h-8 w-8 text-gray-200 mx-auto mb-2" />
            {validationPassed ? (
              <>
                <p className="text-sm font-semibold text-gray-600 mb-1">Deal validated — find your investors</p>
                <p className="text-xs text-gray-400">
                  Click "Find Matches" to rank investors by fit and generate personalised AI pitches.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-1">Run validation first</p>
                <p className="text-xs text-gray-400">
                  Investor matching uses the deal's BMV, yield and strategy from the validation report.
                </p>
              </>
            )}
          </div>
        )}

        {loading && (
          <div className="text-center py-8">
            <RefreshCw className="h-6 w-6 text-blue-400 animate-spin mx-auto mb-2" />
            <p className="text-xs text-gray-400">Matching against all investor criteria…</p>
          </div>
        )}

        {loaded && (
          <>
            {/* Deal values summary */}
            {dealValues && (
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 mb-1 space-y-2">
                {/* Row 1: price + BMV */}
                <div className="grid grid-cols-2 gap-2">
                  {dealValues.price > 0 && (
                    <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Offer Price</p>
                      <p className="text-xs font-bold text-gray-800">{gbp(dealValues.price)}</p>
                    </div>
                  )}
                  {dealValues.bmvPct !== null && (
                    <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-center">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">BMV</p>
                      <p className="text-xs font-bold text-green-700">{dealValues.bmvPct.toFixed(1)}%</p>
                    </div>
                  )}
                </div>
                {/* Row 2: both yield figures */}
                {(dealValues.grossYield !== null || dealValues.grossYieldVsMarket !== null) && (
                  <div className="grid grid-cols-2 gap-2">
                    {dealValues.grossYield !== null && (
                      <div className="rounded-lg bg-white border border-blue-100 px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Yield on Price
                        </p>
                        <p className="text-xs font-bold text-blue-700">{dealValues.grossYield.toFixed(1)}%</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">rent ÷ offer price</p>
                      </div>
                    )}
                    {dealValues.grossYieldVsMarket !== null && (
                      <div className="rounded-lg bg-white border border-gray-200 px-3 py-2 text-center">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                          Market Yield
                        </p>
                        <p className="text-xs font-bold text-gray-700">{dealValues.grossYieldVsMarket.toFixed(1)}%</p>
                        <p className="text-[9px] text-gray-400 mt-0.5">rent ÷ market value</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Filter tabs */}
            {matches.length > 0 && (
              <div className="flex gap-1">
                {(["all", "unsent"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "rounded-lg px-3 py-1 text-xs font-semibold transition-colors",
                      filter === f
                        ? "bg-blue-100 text-blue-700"
                        : "text-gray-500 hover:bg-gray-100"
                    )}
                  >
                    {f === "all" ? `All (${matches.length})` : `Not Sent (${matches.filter((m) => !m.notification).length})`}
                  </button>
                ))}
              </div>
            )}

            {/* Investor rows */}
            {displayed.length === 0 ? (
              <div className="text-center py-6">
                {filter === "unsent" ? (
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <p className="text-sm font-semibold">All matched investors have been notified</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <AlertCircle className="h-6 w-6 text-gray-300" />
                    <p className="text-sm text-gray-400">No investors match this deal's criteria</p>
                    <p className="text-xs text-gray-400">
                      Add more investors or broaden their criteria in the Investor section
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {displayed.map((inv) => (
                  <InvestorRow
                    key={inv.investorId}
                    investor={inv}
                    leadId={leadId}
                    channel={channel}
                    onNotified={handleNotified}
                    defaultOfferPrice={dealValues?.price ?? null}
                    defaultMarketValue={dealValues?.marketValue ?? null}
                  />
                ))}
              </div>
            )}

            {/* Legend */}
            {matches.length > 0 && (
              <p className="text-[10px] text-gray-400 pt-1">
                Match score = % of investor's criteria this deal satisfies. Expand any row to generate a personalised AI pitch. "Notify All" sends a generic alert to ≥60% matches not yet contacted.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
