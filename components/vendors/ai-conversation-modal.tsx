"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  X, Bot, Send, RefreshCw, User, Zap, Brain,
  MessageSquare, Sparkles, ChevronDown, ChevronUp,
  Copy, ThumbsUp, AlertTriangle, Loader2,
} from "lucide-react"

// WhatsApp green icon
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  )
}
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { ModalShell } from "./modal-shell"
import { getPipelineStageVarKey } from "@/lib/theme/status-colors"
import { StatusBadge } from "@/components/ui/status-badge"
import type { VendorLead } from "./vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtCurrency(v: string | number | null | undefined): string {
  if (v === null || v === undefined || v === "") return "—"
  const n = typeof v === "number" ? v : parseFloat(String(v))
  if (isNaN(n)) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n)
}

function formatTime(date: string | Date) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  })
}

function InfoRow({ label, value, valueClass }: {
  label: string
  value: React.ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="flex-shrink-0 text-slate-400">{label}</span>
      <span className={cn("text-right font-semibold text-slate-100 truncate capitalize", valueClass)}>
        {value}
      </span>
    </div>
  )
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color =
    score >= 8 ? "bg-green-500" :
    score >= 6 ? "bg-amber-400" :
    score >= 4 ? "bg-orange-400" : "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-slate-200 w-8 text-right tabular-nums">{score}/10</span>
    </div>
  )
}

// Mirrors CONVERSATION_SYSTEM_PROMPT in lib/vendor-pipeline/ai-sms-agent.ts
const SYSTEM_PROMPT = `You are a property buyer's representative conducting SMS conversations with potential sellers. Be friendly, professional, warm, and concise.

YOUR GOALS:
1. Build rapport quickly
2. Extract: address (w/postcode), asking price, condition, reason for selling, timeline, competing offers
3. Assess motivation (1-10)
4. Keep natural - avoid interrogation

STRATEGY:
- SMS: 1-2 sentences max, <160 chars ideal
- ONE question at a time
- Acknowledge their info before next question
- Get address early, then condition, price, reason, timeline, competing offers
- If hesitant: "No obligation, just exploring options"
- Don't repeat questions

COMPLETE when you have: address, price, condition, reason, timeline (or after 8+ questions if vendor impatient)

MOTIVATION SCORING:
9-10: Urgent (<2 weeks), financial/divorce, no competition
7-8: Quick (<1 month), relocation/inheritance
5-6: Moderate (<3 months), downsize
3-4: Exploring, has viewings/offers
1-2: Casual, unlikely to proceed`

const INTENT_LABELS: Record<string, { label: string; dot: string }> = {
  question:         { label: "Question",   dot: "bg-blue-400" },
  providing_info:   { label: "Info",       dot: "bg-green-400" },
  showing_interest: { label: "Interested", dot: "bg-emerald-400" },
  hesitation:       { label: "Hesitant",   dot: "bg-amber-400" },
  objection:        { label: "Objection",  dot: "bg-red-400" },
  ready_to_proceed: { label: "Ready!",     dot: "bg-purple-400" },
}

const REASON_LABELS: Record<string, string> = {
  relocation: "Relocation", financial: "Financial", divorce: "Divorce",
  inheritance: "Inheritance", downsize: "Downsize", other: "Other",
}

const URGENCY_LABELS: Record<string, string> = {
  urgent: "< 2 weeks", quick: "1–2 months", moderate: "~3 months", flexible: "Flexible",
}

// ─── types ───────────────────────────────────────────────────────────────────

interface FullSMSMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: string
  status?: string | null
  aiGenerated?: boolean | null
  intentDetected?: string | null
  channel?: string | null   // "sms" | "whatsapp"
  aiResponseMetadata?: Record<string, any> | null
}

// ─── component ───────────────────────────────────────────────────────────────

export function AiConversationModal({
  lead,
  onClose,
}: {
  lead: VendorLead
  onClose: () => void
}) {
  const initialMsgs = (lead.smsMessages ?? []) as FullSMSMessage[]
  const [messages, setMessages] = useState<FullSMSMessage[]>(initialMsgs)
  const [manualMsg, setManualMsg]   = useState("")
  const [simMsg, setSimMsg]         = useState("")
  const [sendMode, setSendMode]     = useState<"manual" | "simulate">("manual")
  const [isSending, setIsSending]   = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [isLive, setIsLive] = useState(false)

  // Detect channel from existing messages or lead preference
  const activeChannel = (
    initialMsgs.find(m => m.channel)?.channel ||
    (lead as any).preferredChannel ||
    "sms"
  ) as "sms" | "whatsapp"
  const [selectedChannel, setSelectedChannel] = useState<"sms" | "whatsapp">(activeChannel)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastCountRef = useRef(messages.length)

  const convState = (lead.conversationState ?? {}) as Record<string, any>
  const isComplete = !!convState.conversationComplete
  const messageCount = lead._count?.smsMessages ?? messages.length

  // Fetch full message history on mount (table only loads last 5)
  useEffect(() => {
    const fetchFull = async () => {
      try {
        const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
        if (res.ok) {
          const data = await res.json()
          const msgs = data.lead?.smsMessages ?? []
          lastCountRef.current = msgs.length
          setMessages(msgs)
        }
      } catch { /* silent — table messages shown as fallback */ }
    }
    fetchFull()
  }, [lead.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Silent auto-refresh — only fetches if message count changed
  const silentRefresh = useCallback(async () => {
    if (document.hidden) return
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
      if (!res.ok) return
      const data = await res.json()
      const incoming: FullSMSMessage[] = data.lead?.smsMessages ?? []
      if (incoming.length !== lastCountRef.current) {
        lastCountRef.current = incoming.length
        setMessages(incoming)
      }
    } catch { /* silent */ }
  }, [lead.id])

  // Start live polling when conversation is active; stop when complete
  useEffect(() => {
    if (!isComplete) {
      setIsLive(true)
      pollRef.current = setInterval(silentRefresh, 3000)
    } else {
      setIsLive(false)
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [isComplete, silentRefresh])

  const refresh = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
      if (res.ok) {
        const data = await res.json()
        const msgs = data.lead?.smsMessages ?? []
        lastCountRef.current = msgs.length
        setMessages(msgs)
      }
    } catch { toast.error("Refresh failed") }
    finally { setIsRefreshing(false) }
  }

  const startConversation = async (channel: "sms" | "whatsapp" = selectedChannel) => {
    setIsStarting(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/start-conversation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to start conversation")
      const label = channel === "whatsapp" ? "WhatsApp" : "SMS"
      toast.success(`AI conversation started — initial ${label} sent`)
      setSelectedChannel(channel)
      await refresh()
    } catch (e: any) {
      toast.error(e.message || "Failed to start conversation")
    } finally {
      setIsStarting(false)
    }
  }

  const sendManual = async () => {
    if (!manualMsg.trim()) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: manualMsg.trim(), channel: selectedChannel }),
      })
      let json: any = {}
      try { json = await res.json() } catch {
        throw new Error(`HTTP ${res.status} — server returned non-JSON (check terminal logs)`)
      }
      if (!res.ok) throw new Error(json.error || `Error ${res.status}`)
      toast.success("Message sent to vendor")
      setManualMsg("")
      await refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setIsSending(false) }
  }

  const simulateReply = async () => {
    if (!simMsg.trim()) return
    setIsSending(true)
    try {
      const res = await fetch("/api/vendor-pipeline/test/simulate-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorLeadId: lead.id, message: simMsg.trim() }),
      })
      if (!res.ok) {
        const j = await res.json()
        throw new Error(j.details || j.error || "Simulation failed")
      }
      toast.success("Vendor reply simulated — AI responded")
      setSimMsg("")
      await refresh()
    } catch (e: any) { toast.error(e.message) }
    finally { setIsSending(false) }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  // ── Left panel (dark sidebar) ───────────────────────────────────────────────
  const leftPanel = (
    <div className="flex flex-col gap-0 p-5 h-full overflow-y-auto">

      {/* Property address */}
      <div className="mb-4">
        <p className="text-sm font-bold leading-snug text-slate-100">
          {lead.propertyAddress ?? "No address"}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">{lead.propertyPostcode ?? ""}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {lead.bedrooms != null && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">
              {lead.bedrooms}bd
            </span>
          )}
          {lead.propertyType && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.propertyType}
            </span>
          )}
          {lead.condition && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">
              {lead.condition.replace(/_/g, " ")}
            </span>
          )}
        </div>
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* Vendor */}
      <div className="mb-4 space-y-2">
        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
        <InfoRow label="Name"  value={lead.vendorName} />
        <InfoRow label="Phone" value={lead.vendorPhone} />
        <InfoRow label="Asking" value={fmtCurrency(lead.askingPrice)} />
      </div>

      <div className="mb-4 h-px bg-white/10" />

      {/* AI Insights */}
      <div className="mb-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <Brain className="h-3 w-3 text-slate-500" />
          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">AI Insights</p>
        </div>

        {lead.motivationScore !== null && (
          <div>
            <p className="text-[10px] text-slate-500 mb-1">Motivation</p>
            <ScoreBar score={lead.motivationScore} />
          </div>
        )}

        <div className="space-y-2">
          <InfoRow
            label="Messages"
            value={`${messageCount} total`}
            valueClass={messageCount > 0 ? "text-blue-300" : "text-slate-400"}
          />
          <InfoRow
            label="Reason"
            value={lead.reasonForSelling ? (REASON_LABELS[lead.reasonForSelling] ?? lead.reasonForSelling) : "—"}
          />
          <InfoRow
            label="Timeline"
            value={lead.urgencyLevel ? (URGENCY_LABELS[lead.urgencyLevel] ?? lead.urgencyLevel) : lead.timelineDays ? `${lead.timelineDays} days` : "—"}
          />
          <InfoRow
            label="Competing"
            value={lead.competingOffers === null ? "—" : lead.competingOffers ? "Yes" : "No"}
            valueClass={lead.competingOffers ? "text-red-300" : "text-green-300"}
          />
          <InfoRow
            label="Conv. Status"
            value={isComplete ? "Complete ✓" : messages.length > 0 ? "In Progress" : "Not Started"}
            valueClass={isComplete ? "text-green-300" : "text-amber-300"}
          />
        </div>
      </div>

      {/* Pipeline stage pinned to bottom */}
      <div className="mt-auto border-t border-white/10 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-slate-500">Pipeline Stage</span>
          <StatusBadge
            label={lead.pipelineStage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}
            cssKey={getPipelineStageVarKey(lead.pipelineStage)}
          />
        </div>
      </div>
    </div>
  )

  // ── Right panel ─────────────────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="5xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-gray-900">AI Conversation</span>
          <span className="text-xs text-gray-400">· {lead.vendorName}</span>
          {isLive && (
            <div className="flex items-center gap-1.5 ml-1" title="Auto-updating every 3s">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
              </span>
              <span className="text-xs text-green-600 font-medium">Live</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body — chat + extras */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Chat bubbles */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-3 bg-gray-50/40">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
              <Sparkles className="h-10 w-10 text-blue-200 mb-3" />
              <p className="text-sm font-semibold text-gray-600 mb-1">No conversation started yet</p>
              <p className="text-xs text-gray-400 mb-5 max-w-[220px] leading-relaxed">
                Choose a channel and send the AI opening message to this vendor.
              </p>

              {/* Channel selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSelectedChannel("sms")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    selectedChannel === "sms"
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <MessageSquare className="h-3.5 w-3.5" /> SMS
                </button>
                <button
                  onClick={() => setSelectedChannel("whatsapp")}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors",
                    selectedChannel === "whatsapp"
                      ? "bg-[#25D366] text-white border-[#25D366]"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  )}
                >
                  <WhatsAppIcon className="h-3.5 w-3.5" /> WhatsApp
                </button>
              </div>

              <button
                onClick={() => startConversation(selectedChannel)}
                disabled={isStarting}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors disabled:opacity-60",
                  selectedChannel === "whatsapp"
                    ? "bg-[#25D366] hover:bg-[#128C7E]"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isStarting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
                  : selectedChannel === "whatsapp"
                  ? <><WhatsAppIcon className="h-4 w-4" /> Start via WhatsApp</>
                  : <><Zap className="h-4 w-4" /> Start via SMS</>
                }
              </button>

              {selectedChannel === "whatsapp" && (
                <p className="mt-3 text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 max-w-[230px]">
                  ⚠ Requires TWILIO_WHATSAPP_NUMBER in env + vendor joined sandbox
                </p>
              )}
            </div>
          ) : (
            messages.map((msg) => {
              const isOut = msg.direction === "outbound"
              const intentInfo = msg.intentDetected ? INTENT_LABELS[msg.intentDetected] : null
              const meta = msg.aiResponseMetadata as any

              return (
                <div key={msg.id} className={cn("flex flex-col gap-1", isOut ? "items-end" : "items-start")}>

                  {/* Sender row */}
                  <div className={cn("flex items-center gap-1.5", isOut ? "flex-row-reverse" : "flex-row")}>
                    <div className={cn(
                      "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                      isOut
                        ? (msg.aiGenerated ? "bg-blue-600" : "bg-gray-500")
                        : msg.channel === "whatsapp" ? "bg-[#25D366]" : "bg-gray-300"
                    )}>
                      {isOut
                        ? msg.aiGenerated ? <Bot className="h-3 w-3 text-white" /> : <User className="h-3 w-3 text-white" />
                        : msg.channel === "whatsapp"
                        ? <WhatsAppIcon className="h-3 w-3 text-white" />
                        : <User className="h-3 w-3 text-gray-600" />
                      }
                    </div>
                    {msg.channel === "whatsapp" && (
                      <span className="text-[9px] font-bold text-[#128C7E]">WA</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {isOut ? (msg.aiGenerated ? "AI" : "Manual") : lead.vendorName}
                    </span>
                    {intentInfo && (
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className={cn("h-1.5 w-1.5 rounded-full", intentInfo.dot)} />
                        {intentInfo.label}
                      </span>
                    )}
                  </div>

                  {/* Bubble */}
                  <div className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                    isOut
                      ? "bg-blue-600 text-white rounded-tr-sm"
                      : "bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm"
                  )}>
                    {msg.messageBody}
                  </div>

                  {/* Timestamp */}
                  <div className={cn("flex items-center gap-2 text-xs text-gray-400", isOut ? "flex-row-reverse" : "flex-row")}>
                    <span>{formatTime(msg.createdAt)}</span>
                    {meta?.tokens && <span className="text-gray-300">{meta.tokens} tok</span>}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Send / Simulate panel */}
        <div className="border-t border-gray-100 bg-white p-4 space-y-3 shrink-0">

          {/* WhatsApp active banner */}
          {selectedChannel === "whatsapp" && (
            <div className="flex items-center gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-1.5">
              <WhatsAppIcon className="h-3.5 w-3.5 text-[#25D366] shrink-0" />
              <p className="text-xs font-semibold text-[#128C7E] flex-1">WhatsApp channel active</p>
              <button
                onClick={() => setSelectedChannel("sms")}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                Switch to SMS
              </button>
            </div>
          )}

          {/* Mode toggle + channel pill + refresh */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg">
              <button
                onClick={() => setSendMode("manual")}
                className={cn(
                  "text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                  sendMode === "manual" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {selectedChannel === "whatsapp"
                  ? <><WhatsAppIcon className="h-3 w-3 text-[#25D366]" /> Send WhatsApp</>
                  : <>Send SMS</>
                }
              </button>
              <button
                onClick={() => setSendMode("simulate")}
                className={cn(
                  "text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                  sendMode === "simulate" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Zap className="h-3 w-3" />
                Simulate Vendor Reply
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {/* SMS / WA toggle pill — manual mode only */}
              {sendMode === "manual" && (
                <div className="flex items-center gap-1 rounded-lg border border-gray-200 p-0.5 bg-gray-50">
                  <button
                    onClick={() => setSelectedChannel("sms")}
                    title="Send via SMS"
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                      selectedChannel === "sms"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-600 hover:bg-white"
                    )}
                  >
                    <MessageSquare className="h-3 w-3" /> SMS
                  </button>
                  <button
                    onClick={() => setSelectedChannel("whatsapp")}
                    title="Send via WhatsApp"
                    className={cn(
                      "flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors",
                      selectedChannel === "whatsapp"
                        ? "bg-[#25D366] text-white shadow-sm"
                        : "text-gray-400 hover:text-gray-600 hover:bg-white"
                    )}
                  >
                    <WhatsAppIcon className="h-3 w-3" /> WA
                  </button>
                </div>
              )}

              <button
                onClick={refresh}
                disabled={isRefreshing}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                <RefreshCw className={cn("h-3 w-3", isRefreshing && "animate-spin")} />
                Refresh
              </button>
            </div>
          </div>

          {sendMode === "manual" ? (
            <div className="flex gap-2">
              <textarea
                value={manualMsg}
                onChange={(e) => setManualMsg(e.target.value)}
                placeholder={`Message ${lead.vendorName} via ${selectedChannel === "whatsapp" ? "WhatsApp" : "SMS"}…`}
                rows={2}
                className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendManual() } }}
              />
              <button
                onClick={sendManual}
                disabled={isSending || !manualMsg.trim()}
                className={cn(
                  "self-end flex h-9 w-9 items-center justify-center rounded-lg text-white disabled:opacity-40 transition-colors",
                  selectedChannel === "whatsapp"
                    ? "bg-[#25D366] hover:bg-[#128C7E]"
                    : "bg-blue-600 hover:bg-blue-700"
                )}
              >
                {isSending
                  ? <RefreshCw className="h-4 w-4 animate-spin" />
                  : selectedChannel === "whatsapp"
                  ? <WhatsAppIcon className="h-4 w-4" />
                  : <Send className="h-4 w-4" />
                }
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Type what the vendor would say — the AI will process it and reply automatically
              </p>
              <div className="flex gap-2">
                <textarea
                  value={simMsg}
                  onChange={(e) => setSimMsg(e.target.value)}
                  placeholder={`e.g. "Yes, we need to sell within the next month…"`}
                  rows={2}
                  className="flex-1 resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200"
                />
                <button
                  onClick={simulateReply}
                  disabled={isSending || !simMsg.trim()}
                  className="self-end flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
                >
                  {isSending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Prompt viewer + train AI — collapsed row */}
          <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {showPrompt ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              AI Prompt
            </button>
            <button
              disabled={messages.length === 0}
              onClick={() => toast.success("Marked as a positive training example")}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-green-600 disabled:opacity-40 transition-colors"
            >
              <ThumbsUp className="h-3 w-3" />
              Mark as Good Conversation
            </button>
          </div>

          {showPrompt && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 relative">
              <button
                onClick={copyPrompt}
                className="absolute top-2 right-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
              >
                <Copy className="h-3 w-3" />
                {promptCopied ? "Copied!" : "Copy"}
              </button>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto pr-12">
                {SYSTEM_PROMPT}
              </pre>
              <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Per-lead prompt overrides — coming soon
              </p>
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  )
}
