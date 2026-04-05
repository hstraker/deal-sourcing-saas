"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Bot,
  Send,
  RefreshCw,
  Brain,
  User,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  Sparkles,
  Edit3,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"

export interface AISMSMessage {
  id: string
  direction: string
  messageBody: string
  createdAt: Date | string
  messageSid?: string | null
  status?: string | null
  aiGenerated?: boolean | null
  intentDetected?: string | null
  aiResponseMetadata?: {
    model?: string
    provider?: string
    responseTime?: number
    tokens?: number
    intent?: string
    conversationQuality?: number
    nextQuestionType?: string
  } | null
  confidenceScore?: number | null
}

interface ConversationState {
  conversationFlow?: string
  messagesExchanged?: number
  conversationComplete?: boolean
  lastIntent?: string
  lastConversationQuality?: number
  nextQuestionType?: string
  extractedData?: Record<string, any>
}

export interface AiConversationTabLead {
  id: string
  vendorName: string
  vendorPhone: string
  propertyAddress: string | null
  pipelineStage: string
  motivationScore: number | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  timelineDays: number | null
  competingOffers: boolean | null
  condition: string | null
  askingPrice: number | null
  conversationState?: ConversationState | null | Record<string, any>
  smsMessages: AISMSMessage[]
  conversationStartedAt?: Date | null
  lastContactAt?: Date | null
}

interface AiConversationTabProps {
  lead: AiConversationTabLead
  onUpdate?: () => void
}

// Mirrors CONVERSATION_SYSTEM_PROMPT in lib/vendor-pipeline/ai-sms-agent.ts
const SYSTEM_PROMPT_DISPLAY = `You are a property buyer's representative conducting SMS conversations with potential sellers. Be friendly, professional, warm, and concise.

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

const INTENT_LABELS: Record<string, { label: string; color: string }> = {
  question:          { label: "Question",   color: "bg-blue-100 text-blue-700" },
  providing_info:    { label: "Info",       color: "bg-green-100 text-green-700" },
  showing_interest:  { label: "Interested", color: "bg-emerald-100 text-emerald-700" },
  hesitation:        { label: "Hesitant",   color: "bg-amber-100 text-amber-700" },
  objection:         { label: "Objection",  color: "bg-red-100 text-red-700" },
  ready_to_proceed:  { label: "Ready!",     color: "bg-purple-100 text-purple-700" },
}

const NEXT_Q_LABELS: Record<string, string> = {
  address:          "Property address",
  price:            "Asking price",
  condition:        "Property condition",
  reason:           "Reason for selling",
  timeline:         "Timeline",
  competing_offers: "Competing offers",
  wrap_up:          "Wrapping up",
  none:             "Complete",
}

function ScoreBar({ score, max = 10 }: { score: number; max?: number }) {
  const pct = (score / max) * 100
  const color =
    score >= 8 ? "bg-green-500" :
    score >= 6 ? "bg-amber-400" :
    score >= 4 ? "bg-orange-400" :
    "bg-red-400"
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-semibold w-10 text-right tabular-nums">{score}/{max}</span>
    </div>
  )
}

function formatTime(date: Date | string) {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function AiConversationTab({ lead, onUpdate }: AiConversationTabProps) {
  const [messages, setMessages] = useState<AISMSMessage[]>(lead.smsMessages || [])
  const [manualMessage, setManualMessage] = useState("")
  const [simulateMessage, setSimulateMessage] = useState("")
  const [sendMode, setSendMode] = useState<"manual" | "simulate">("manual")
  const [isSending, setIsSending] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const [promptCopied, setPromptCopied] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastMessageCountRef = useRef(lead.smsMessages?.length ?? 0)

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Sync when lead prop updates (parent refresh)
  useEffect(() => {
    setMessages(lead.smsMessages || [])
  }, [lead.smsMessages])

  const convState = (lead.conversationState || {}) as ConversationState
  const isComplete = convState.conversationComplete

  // Silent background refresh — no spinner, just update messages if count changed
  const silentRefresh = useCallback(async () => {
    if (document.hidden) return // pause when tab is not visible
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
      if (!res.ok) return
      const data = await res.json()
      const incoming: AISMSMessage[] = data.lead?.smsMessages || []
      if (incoming.length !== lastMessageCountRef.current) {
        lastMessageCountRef.current = incoming.length
        setMessages(incoming)
        onUpdate?.()
      }
    } catch {
      // silent — don't show errors during auto-poll
    }
  }, [lead.id, onUpdate])

  // Start live polling when conversation is not yet complete; stop when done
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

  const refreshMessages = async () => {
    setIsRefreshing(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}`)
      if (!res.ok) throw new Error("Failed to refresh")
      const data = await res.json()
      const incoming = data.lead?.smsMessages || []
      lastMessageCountRef.current = incoming.length
      setMessages(incoming)
      onUpdate?.()
    } catch {
      toast.error("Failed to refresh messages")
    } finally {
      setIsRefreshing(false)
    }
  }

  const startAIConversation = async () => {
    setIsStarting(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/start-conversation`, {
        method: "POST",
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Failed to start conversation")
      toast.success("AI conversation started — initial SMS sent to vendor")
      await refreshMessages()
      onUpdate?.()
    } catch (e: any) {
      toast.error(e.message || "Failed to start AI conversation")
    } finally {
      setIsStarting(false)
    }
  }

  const sendManualMessage = async () => {
    if (!manualMessage.trim()) return
    setIsSending(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: manualMessage.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Send failed")
      }
      toast.success("Message sent to vendor")
      setManualMessage("")
      await refreshMessages()
    } catch (e: any) {
      toast.error(e.message || "Failed to send message")
    } finally {
      setIsSending(false)
    }
  }

  const simulateVendorReply = async () => {
    if (!simulateMessage.trim()) return
    setIsSending(true)
    try {
      const res = await fetch("/api/vendor-pipeline/test/simulate-sms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorLeadId: lead.id, message: simulateMessage.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Simulation failed")
      }
      toast.success("Vendor reply simulated — AI responded")
      setSimulateMessage("")
      await refreshMessages()
    } catch (e: any) {
      toast.error(e.message || "Failed to simulate reply")
    } finally {
      setIsSending(false)
    }
  }

  const copyPrompt = () => {
    navigator.clipboard.writeText(SYSTEM_PROMPT_DISPLAY)
    setPromptCopied(true)
    setTimeout(() => setPromptCopied(false), 2000)
  }

  const inboundCount  = messages.filter(m => m.direction === "inbound").length
  const outboundCount = messages.filter(m => m.direction === "outbound").length
  const nextQ         = convState.nextQuestionType

  return (
    <div className="space-y-4">

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-3">
        <div className="ds-card p-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Messages</div>
          <div className="text-lg font-bold text-gray-900">{messages.length}</div>
          <div className="text-xs text-gray-400">{inboundCount} in · {outboundCount} out</div>
        </div>

        <div className="ds-card p-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Motivation</div>
          <div className={cn("text-lg font-bold",
            !lead.motivationScore ? "text-gray-300" :
            lead.motivationScore >= 8 ? "text-green-600" :
            lead.motivationScore >= 6 ? "text-amber-500" :
            lead.motivationScore >= 4 ? "text-orange-500" : "text-red-500"
          )}>
            {lead.motivationScore ? `${lead.motivationScore}/10` : "—"}
          </div>
          <div className="text-xs text-gray-400">seller score</div>
        </div>

        <div className="ds-card p-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Next Question</div>
          <div className="text-xs font-semibold text-gray-700 mt-1 leading-tight">
            {isComplete ? (
              <span className="text-green-600">Complete ✓</span>
            ) : nextQ ? (
              NEXT_Q_LABELS[nextQ] || nextQ
            ) : (
              <span className="text-gray-300">—</span>
            )}
          </div>
        </div>

        <div className="ds-card p-3 text-center">
          <div className="text-xs text-gray-400 mb-0.5">Conv. State</div>
          <div className="mt-1 flex justify-center">
            <Badge className={cn("text-xs capitalize",
              isComplete
                ? "bg-green-100 text-green-700 border-green-200"
                : "bg-blue-100 text-blue-700 border-blue-200"
            )}>
              {isComplete
                ? "Done"
                : (convState.conversationFlow?.replace(/_/g, " ") || "Active")}
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Main 2-col layout ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">

        {/* LEFT: Chat thread (3/5 width) */}
        <div
          className="col-span-3 ds-card overflow-hidden flex flex-col"
          style={{ minHeight: "500px", maxHeight: "620px" }}
        >
          {/* Thread header */}
          <div className="px-4 py-3 border-b border-[var(--ds-border)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#2563EB]" />
              <span className="text-sm font-semibold text-gray-900">SMS Thread</span>
              <span className="text-xs text-gray-400">{lead.vendorPhone}</span>
            </div>
            <div className="flex items-center gap-2">
              {/* Live indicator when polling is active */}
              {isLive ? (
                <div className="flex items-center gap-1.5" title="Auto-updating every 3s">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                  <span className="text-xs text-green-600 font-medium">Live</span>
                </div>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={refreshMessages}
                disabled={isRefreshing}
                className="h-7 w-7 p-0"
                title="Refresh now"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
              </Button>
            </div>
          </div>

          {/* Bubbles */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/30">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-10 px-6">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 mb-3">
                  <Sparkles className="h-6 w-6 text-[#2563EB]" />
                </div>
                <p className="text-sm font-semibold text-gray-700 mb-1">No conversation started yet</p>
                <p className="text-xs text-gray-400 mb-5 max-w-[220px] leading-relaxed">
                  Auto-start may be off for this lead source. Click below to send the AI opening message now.
                </p>
                <Button
                  onClick={startAIConversation}
                  disabled={isStarting}
                  className="gap-2 text-sm"
                  size="sm"
                >
                  {isStarting
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Starting…</>
                    : <><Zap className="h-4 w-4" /> Start AI Conversation</>}
                </Button>
                <p className="mt-3 text-[11px] text-gray-300">
                  Sends to {lead.vendorPhone}
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isOutbound = msg.direction === "outbound"
                const intentInfo = msg.intentDetected ? INTENT_LABELS[msg.intentDetected] : null
                const meta = msg.aiResponseMetadata as any

                return (
                  <div key={msg.id} className={cn("flex flex-col gap-1", isOutbound ? "items-end" : "items-start")}>

                    {/* Sender label row */}
                    <div className={cn("flex items-center gap-1.5", isOutbound ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center shrink-0",
                        isOutbound
                          ? msg.aiGenerated ? "bg-[#2563EB]" : "bg-gray-500"
                          : "bg-gray-200"
                      )}>
                        {isOutbound
                          ? msg.aiGenerated
                            ? <Bot className="h-3 w-3 text-white" />
                            : <User className="h-3 w-3 text-white" />
                          : <User className="h-3 w-3 text-gray-600" />
                        }
                      </div>
                      <span className="text-xs text-gray-400">
                        {isOutbound
                          ? msg.aiGenerated ? "AI" : "Manual"
                          : lead.vendorName}
                      </span>
                      {intentInfo && (
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", intentInfo.color)}>
                          {intentInfo.label}
                        </span>
                      )}
                    </div>

                    {/* Bubble */}
                    <div className={cn(
                      "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      isOutbound
                        ? "bg-[#2563EB] text-white rounded-tr-sm"
                        : "bg-white border border-gray-200 text-gray-900 rounded-tl-sm shadow-sm"
                    )}>
                      {msg.messageBody}
                    </div>

                    {/* Timestamp + meta */}
                    <div className={cn(
                      "flex items-center gap-2 text-xs text-gray-400",
                      isOutbound ? "flex-row-reverse" : "flex-row"
                    )}>
                      <span>{formatTime(msg.createdAt)}</span>
                      {msg.status && msg.status !== "delivered" && msg.status !== "sent" && (
                        <span className={msg.status === "failed" ? "text-red-400" : "text-gray-300"}>
                          {msg.status}
                        </span>
                      )}
                      {meta?.tokens && (
                        <span className="text-gray-300">{meta.tokens} tok</span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Send panel */}
          <div className="border-t border-[var(--ds-border)] p-3 shrink-0 space-y-2 bg-white">
            {/* Mode toggle */}
            <div className="flex gap-0.5 p-0.5 bg-gray-100 rounded-lg w-fit">
              <button
                onClick={() => setSendMode("manual")}
                className={cn(
                  "text-xs px-3 py-1 rounded-md font-medium transition-all",
                  sendMode === "manual"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                Send SMS
              </button>
              <button
                onClick={() => setSendMode("simulate")}
                className={cn(
                  "text-xs px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1",
                  sendMode === "simulate"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Zap className="h-3 w-3" />
                Simulate Reply
              </button>
            </div>

            {sendMode === "manual" ? (
              <div className="flex gap-2">
                <Textarea
                  value={manualMessage}
                  onChange={(e) => setManualMessage(e.target.value)}
                  placeholder={`Message ${lead.vendorName}...`}
                  className="text-sm resize-none"
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendManualMessage()
                    }
                  }}
                />
                <Button
                  onClick={sendManualMessage}
                  disabled={isSending || !manualMessage.trim()}
                  size="sm"
                  className="self-end h-9 px-3"
                >
                  {isSending
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </Button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Simulate a vendor reply — AI will process and respond automatically
                </p>
                <div className="flex gap-2">
                  <Textarea
                    value={simulateMessage}
                    onChange={(e) => setSimulateMessage(e.target.value)}
                    placeholder={`e.g. "Yes, we need to sell within the next month..."`}
                    className="text-sm resize-none"
                    rows={2}
                  />
                  <Button
                    onClick={simulateVendorReply}
                    disabled={isSending || !simulateMessage.trim()}
                    size="sm"
                    className="self-end h-9 px-3 bg-amber-500 hover:bg-amber-600 border-0"
                  >
                    {isSending
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <Bot className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Insights (2/5 width) */}
        <div className="col-span-2 space-y-3">

          {/* Motivation + quality scores */}
          <div className="ds-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="h-4 w-4 text-[#2563EB]" />
              <span className="text-sm font-semibold text-gray-900">AI Insights</span>
            </div>
            {lead.motivationScore ? (
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Motivation Score</p>
                  <ScoreBar score={lead.motivationScore} />
                </div>
                {convState.lastConversationQuality && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Conversation Quality</p>
                    <ScoreBar score={convState.lastConversationQuality} />
                  </div>
                )}
                {convState.messagesExchanged && (
                  <p className="text-xs text-gray-400">
                    {convState.messagesExchanged} messages exchanged
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-400">
                Scores will appear once the AI has analysed the conversation.
              </p>
            )}
          </div>

          {/* Extracted data */}
          <div className="ds-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-gray-900">Extracted Data</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Address",          value: lead.propertyAddress },
                { label: "Asking Price",     value: lead.askingPrice ? formatCurrency(lead.askingPrice) : null },
                { label: "Condition",        value: lead.condition?.replace(/_/g, " ") },
                { label: "Reason",           value: lead.reasonForSelling?.replace(/_/g, " ") },
                { label: "Timeline",         value: lead.timelineDays ? `${lead.timelineDays} days` : lead.urgencyLevel?.replace(/_/g, " ") },
                { label: "Competing Offers", value: lead.competingOffers === null ? null : lead.competingOffers ? "Yes" : "No" },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-start gap-2">
                  <span className="text-xs text-gray-400 shrink-0">{label}</span>
                  <span className={cn(
                    "text-xs font-medium text-right capitalize",
                    value ? "text-gray-900" : "text-gray-300"
                  )}>
                    {value || "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* System prompt viewer */}
          <div className="ds-card overflow-hidden">
            <button
              onClick={() => setShowPrompt(!showPrompt)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Edit3 className="h-3.5 w-3.5 text-gray-400" />
                <span>AI System Prompt</span>
              </div>
              {showPrompt
                ? <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
                : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              }
            </button>
            {showPrompt && (
              <div className="px-4 pb-4 border-t border-[var(--ds-border)] space-y-2">
                <div className="flex justify-end pt-2">
                  <Button variant="ghost" size="sm" onClick={copyPrompt} className="h-7 text-xs gap-1">
                    <Copy className="h-3 w-3" />
                    {promptCopied ? "Copied!" : "Copy"}
                  </Button>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 max-h-52 overflow-y-auto">
                  <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono leading-relaxed">
                    {SYSTEM_PROMPT_DISPLAY}
                  </pre>
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Per-lead prompt overrides — coming soon
                </p>
              </div>
            )}
          </div>

          {/* Train AI */}
          <div className="ds-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <ThumbsUp className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-sm font-semibold text-gray-900">Train AI</span>
            </div>
            <p className="text-xs text-gray-400 mb-3">
              If this conversation went well, mark it as a positive example to improve the AI over time.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs"
              disabled={messages.length === 0}
              onClick={() => toast.success("Marked as a positive training example")}
            >
              <ThumbsUp className="h-3 w-3 mr-1.5" />
              Mark as Good Conversation
            </Button>
          </div>

        </div>
      </div>
    </div>
  )
}
