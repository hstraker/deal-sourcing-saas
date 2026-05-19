"use client"

import { useState, useEffect, useCallback, type ReactNode } from "react"
import { toast } from "sonner"
import {
  X,
  Brain,
  MessageSquare,
  BookOpen,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
  Send,
  RefreshCw,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ModalShell } from "./modal-shell"
import type { VendorLead } from "./vendor-leads-table"
import type { NegotiationRung } from "@/lib/offer-engine/negotiation-ladder"
import type {
  CoachOutput,
  CoachPlaybookStep,
  CoachRoundScript,
  CoachObjection,
  CopilotResponse,
} from "@/lib/vendor-pipeline/negotiation-coach"

// ─── helpers ─────────────────────────────────────────────────────────────────

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors",
        copied
          ? "bg-green-100 text-green-700"
          : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
        className
      )}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ─── score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circumference = 2 * Math.PI * r
  const progress = (score / 100) * circumference
  const color =
    score >= 70 ? "#4ade80"
    : score >= 45 ? "#fbbf24"
    :               "#f87171"

  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" viewBox="0 0 72 72">
        <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
        <circle
          cx="36" cy="36" r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 36 36)"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-lg font-extrabold leading-none text-white">{score}</span>
        <span className="text-[8px] leading-none text-slate-400">/ 100</span>
      </div>
    </div>
  )
}

// ─── signal bar ───────────────────────────────────────────────────────────────

function SignalBar({
  label,
  value,
  levels,
  colours,
}: {
  label: string
  value: string
  levels: string[]
  colours: Record<string, string>
}) {
  const idx = levels.indexOf(value)
  const filled = idx + 1
  const colour = colours[value] ?? "bg-slate-400"

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className={cn("text-[10px] font-semibold capitalize", {
          "text-green-400": value === "low" || value === "none",
          "text-amber-400": value === "medium",
          "text-red-400": value === "high" || value === "very_high",
        })}>
          {value.replace(/_/g, " ")}
        </span>
      </div>
      <div className="flex gap-0.5">
        {levels.map((_, i) => (
          <div
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-sm transition-all",
              i < filled ? colour : "bg-white/10"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── playbook step ────────────────────────────────────────────────────────────

function PlaybookCard({ step }: { step: CoachPlaybookStep }) {
  const borderColour =
    step.colour === "blue"  ? "border-blue-500/40 bg-blue-500/5"
    : step.colour === "amber" ? "border-amber-500/40 bg-amber-500/5"
    :                           "border-red-500/40 bg-red-500/5"
  const numColour =
    step.colour === "blue"  ? "bg-blue-600 text-white"
    : step.colour === "amber" ? "bg-amber-500 text-white"
    :                           "bg-red-600 text-white"
  const badgeColour =
    step.colour === "blue"  ? "bg-blue-100 text-blue-700"
    : step.colour === "amber" ? "bg-amber-100 text-amber-700"
    :                           "bg-red-100 text-red-700"

  return (
    <div className={cn("rounded-xl border p-4", borderColour)}>
      <div className="mb-2 flex items-start gap-3">
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold", numColour)}>
          {step.step}
        </span>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-slate-800">{step.title}</h4>
            <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium capitalize", badgeColour)}>
              {step.colour}
            </span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.body}</p>
        </div>
      </div>
      {step.script && (
        <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-white/60 px-3 py-2 border border-slate-200">
          <p className={cn("text-xs italic leading-relaxed text-slate-700 flex-1", {
            "text-amber-700": step.scriptType === "warning",
          })}>
            {step.scriptType === "warning" ? "⚠ " : ""}"{step.script}"
          </p>
          <CopyButton text={step.script} className="shrink-0 self-start" />
        </div>
      )}
    </div>
  )
}

// ─── round script card ────────────────────────────────────────────────────────

function RoundScriptCard({
  script,
  rung,
}: {
  script: CoachRoundScript
  rung?: NegotiationRung
}) {
  const [expanded, setExpanded] = useState(script.round === 0)

  const roundLabel = rung?.label ?? `Round ${script.round}`
  const roundPrice = rung ? gbp(rung.offerPrice) : null

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            script.round === 0 ? "bg-blue-600"
            : script.round === 1 ? "bg-indigo-600"
            : script.round === 2 ? "bg-amber-500"
            :                      "bg-red-600"
          )}>
            {script.round === 0 ? "↓" : script.round === 3 ? "✓" : `↑${script.round}`}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800">{roundLabel}</p>
            {roundPrice && <p className="text-xs text-slate-500">{roundPrice}</p>}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
          {/* SMS Script */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> SMS Script
              </p>
              <CopyButton text={script.smsScript} />
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{script.smsScript}</p>
            </div>
          </div>

          {/* Call Script */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">📞 Call Script</p>
              <CopyButton text={script.callScript} />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{script.callScript}</p>
            </div>
          </div>

          {/* Urgency lever + Evidence pack — 2 col */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">⚡ Urgency Lever</p>
              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-xs leading-relaxed text-amber-800">{script.urgencyLever}</p>
              </div>
            </div>
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">📋 Evidence Pack</p>
              <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
                <p className="text-xs leading-relaxed text-green-800">{script.evidencePack}</p>
              </div>
            </div>
          </div>

          {/* Coach tip */}
          {script.coachTip && (
            <div className="flex items-start gap-2 rounded-lg bg-purple-50 border border-purple-100 px-3 py-2">
              <Brain className="h-3.5 w-3.5 shrink-0 text-purple-500 mt-0.5" />
              <p className="text-xs leading-relaxed text-purple-800">{script.coachTip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── objection card ───────────────────────────────────────────────────────────

function ObjectionCard({ objection }: { objection: CoachObjection }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{objection.emoji}</span>
          <p className="text-sm font-medium text-slate-800 italic">"{objection.title}"</p>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          {/* Why they say it */}
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              🧠 Why they say this
            </p>
            <p className="text-xs leading-relaxed text-slate-600">{objection.whyTheySayIt}</p>
          </div>

          {/* Response */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                💬 Your response
              </p>
              <CopyButton text={objection.response} />
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-xs leading-relaxed text-green-900 italic">"{objection.response}"</p>
            </div>
          </div>

          {/* Tags */}
          {objection.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {objection.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600"
                >
                  {tag.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── live copilot ─────────────────────────────────────────────────────────────

function LiveCopilot({
  leadId,
  rungs,
  ceiling,
  vendorMotivation,
  currentRound,
}: {
  leadId: string
  rungs: NegotiationRung[]
  ceiling: number
  vendorMotivation: string
  currentRound: number
}) {
  const [round, setRound] = useState(currentRound)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CopilotResponse | null>(null)

  const analyse = async () => {
    if (!message.trim()) return
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/negotiation-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "copilot",
          vendorMessage: message,
          currentRound: round,
          rungs,
          ceiling,
          vendorMotivation,
        }),
      })
      if (!res.ok) throw new Error("Failed to analyse")
      setResult(await res.json())
    } catch {
      toast.error("Copilot analysis failed — please try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Round selector */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
          Current negotiation round
        </label>
        <div className="flex gap-1.5 flex-wrap">
          {rungs.map((r) => (
            <button
              key={r.round}
              type="button"
              onClick={() => setRound(r.round)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                round === r.round
                  ? "border-blue-600 bg-blue-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              )}
            >
              {r.label}
              <span className="ml-1 text-[10px] opacity-70">{gbp(r.offerPrice)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Message input */}
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">
          Paste the vendor's reply
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="e.g. 'I'm not going lower than £85,000. I've had another offer from someone else already...'"
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none transition-colors"
        />
      </div>

      <button
        type="button"
        onClick={analyse}
        disabled={loading || !message.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</>
        ) : (
          <><Brain className="h-4 w-4" /> Analyse &amp; Get Next Move</>
        )}
      </button>

      {/* Result */}
      {result && (
        <div className="space-y-4 pt-2 border-t border-slate-100">
          {/* Psychological read */}
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1.5">
              🧠 Psychological Read
            </p>
            <p className="text-sm leading-relaxed text-purple-900">{result.psychologicalRead}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Counter offer detected */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Counter Offer Detected
              </p>
              <p className="text-base font-extrabold text-slate-800">
                {result.detectedCounterOffer != null ? gbp(result.detectedCounterOffer) : "None stated"}
              </p>
            </div>

            {/* Urgency update */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">
                Urgency Update
              </p>
              <p className="text-xs leading-relaxed text-slate-700">{result.urgencyUpdate}</p>
            </div>
          </div>

          {/* Next move */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Send className="h-3 w-3" /> Recommended Next Message
              </p>
              <div className="flex items-center gap-2">
                {result.recommendedNextRound !== null && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    Move to Round {result.recommendedNextRound}
                  </span>
                )}
                <CopyButton text={result.nextMoveScript} />
              </div>
            </div>
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm leading-relaxed text-green-900 italic">"{result.nextMoveScript}"</p>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              ⏰ {result.timingAdvice}
            </p>
          </div>

          {/* Warning flags */}
          {result.warningFlags.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Warning Flags
              </p>
              <ul className="space-y-1">
                {result.warningFlags.map((flag, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="mt-0.5 text-amber-500">⚠</span>
                    {flag}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── main modal ──────────────────────────────────────────────────────────────

type Tab = "playbook" | "rounds" | "objections" | "copilot"

export interface NegotiationCoachModalProps {
  lead: VendorLead
  strategy: "flip" | "hold" | "both"
  ceiling: number
  rungs: NegotiationRung[]
  refurbCost?: number | null
  gdv?: number | null
  monthlyRent?: number | null
  grossYield?: number | null
  onClose: () => void
}

export function NegotiationCoachModal({
  lead,
  strategy,
  ceiling,
  rungs,
  refurbCost,
  gdv,
  monthlyRent,
  grossYield,
  onClose,
}: NegotiationCoachModalProps) {
  const [coach, setCoach] = useState<CoachOutput | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("playbook")

  // ── Fetch playbook on mount ───────────────────────────────────────────────
  const fetchCoach = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/negotiation-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "playbook",
          strategy,
          ceiling,
          rungs,
          refurbCost: refurbCost ?? null,
          gdv: gdv ?? null,
          monthlyRent: monthlyRent ?? null,
          grossYield: grossYield ?? null,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      setCoach(await res.json())
    } catch (e: any) {
      setError(e.message || "Failed to generate negotiation coach playbook")
    } finally {
      setLoading(false)
    }
  }, [lead.id, strategy, ceiling, rungs, refurbCost, gdv, monthlyRent, grossYield])

  useEffect(() => { fetchCoach() }, [fetchCoach])

  // ── Derived: which round is current (last rung we've offered at) ──────────
  const currentRound = 0  // default to opening — copilot can override

  // ── Left panel ────────────────────────────────────────────────────────────
  const leftPanel = (
    <div className="flex h-full flex-col gap-0 overflow-y-auto p-5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20">
          <Brain className="h-4 w-4 text-purple-400" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Negotiation Coach</p>
          <p className="text-[10px] text-slate-400">Voss · Klaff · Dawson</p>
        </div>
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12">
          <div className="relative flex h-12 w-12 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <Brain className="absolute h-4 w-4 text-purple-300" />
          </div>
          <p className="text-center text-xs text-slate-400">
            Analysing deal &amp; building your strategy…
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <p className="text-xs text-red-300">{error}</p>
          <button
            onClick={fetchCoach}
            className="mt-2 flex items-center gap-1 text-[10px] font-medium text-red-400 hover:text-red-300"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {coach && (
        <>
          {/* Strategy name */}
          <div className="mb-3 rounded-lg bg-purple-600/20 border border-purple-500/30 px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-purple-400 mb-0.5">
              Strategy
            </p>
            <p className="text-sm font-bold text-white leading-snug">{coach.strategyName}</p>
          </div>

          {/* Score ring + vendor profile */}
          <div className="mb-4 flex items-center gap-3">
            <ScoreRing score={coach.negotiationScore} />
            <div className="flex-1">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-0.5">
                Position Strength
              </p>
              <p className="text-xs font-semibold text-white leading-snug">
                {coach.vendorProfile.motivationEmoji} {coach.vendorProfile.motivationLabel}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                {coach.vendorProfile.scoringRationale}
              </p>
            </div>
          </div>

          <div className="mb-3 h-px bg-white/10" />

          {/* Signal bars */}
          <div className="mb-4 space-y-2.5">
            <SignalBar
              label="Urgency"
              value={coach.vendorProfile.urgencySignal}
              levels={["low", "medium", "high", "very_high"]}
              colours={{
                low: "bg-green-500",
                medium: "bg-amber-400",
                high: "bg-red-400",
                very_high: "bg-red-600",
              }}
            />
            <SignalBar
              label="Price Flexibility"
              value={coach.vendorProfile.priceFlexibility}
              levels={["low", "medium", "high"]}
              colours={{
                low: "bg-red-400",
                medium: "bg-amber-400",
                high: "bg-green-500",
              }}
            />
            <SignalBar
              label="Competing Offers Risk"
              value={coach.vendorProfile.competingOffersRisk}
              levels={["none", "low", "medium", "high"]}
              colours={{
                none: "bg-green-500",
                low: "bg-green-400",
                medium: "bg-amber-400",
                high: "bg-red-500",
              }}
            />
          </div>

          <div className="mb-3 h-px bg-white/10" />

          {/* Key intel */}
          <div className="mb-4">
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Key Intel
            </p>
            <ul className="space-y-1.5">
              {coach.vendorProfile.keyIntel.map((point, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-purple-400">·</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-3 h-px bg-white/10" />

          {/* Walk-away triggers */}
          <div>
            <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-slate-500">
              Walk-Away Triggers
            </p>
            <ul className="space-y-1.5">
              {coach.walkAwayTriggers.map((trigger, i) => (
                <li key={i} className="flex items-start gap-1.5 text-[11px] text-slate-300 leading-relaxed">
                  <span className="mt-0.5 shrink-0 text-red-400">✕</span>
                  {trigger}
                </li>
              ))}
            </ul>
          </div>

          {/* Copilot state summary */}
          {coach.copilot && (
            <>
              <div className="mt-3 mb-3 h-px bg-white/10" />
              <div className="rounded-lg bg-white/5 border border-white/10 px-3 py-2.5">
                <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                  Current State
                </p>
                <p className="text-xs font-semibold text-white mb-1.5">
                  {coach.copilot.currentRoundLabel}
                </p>
                <ul className="space-y-1">
                  {coach.copilot.analysisPoints.map((pt, i) => (
                    <li key={i} className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-1">
                      <span className="shrink-0 text-blue-400 mt-0.5">·</span>
                      {pt}
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 text-[10px] text-amber-400">{coach.copilot.waitAdvice}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: "playbook", label: "Playbook", icon: <BookOpen className="h-3.5 w-3.5" /> },
    { key: "rounds",   label: "Round Scripts", icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: "objections", label: "Objections", icon: <Shield className="h-3.5 w-3.5" /> },
    { key: "copilot",  label: "Live Copilot", icon: <Zap className="h-3.5 w-3.5" /> },
  ]

  return (
    <ModalShell onClose={onClose} leftPanel={leftPanel} maxWidth="6xl">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex items-center gap-3">
          <Brain className="h-4 w-4 text-purple-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {lead.propertyAddress ?? lead.vendorName}
            </h2>
            <p className="text-[10px] text-slate-400">
              {coach?.strategyRationale ?? "Generating negotiation strategy…"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-slate-100">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-medium transition-colors border-b-2",
              tab === t.key
                ? "border-purple-600 bg-purple-50 text-purple-700"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-5">
        {loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="relative flex h-16 w-16 items-center justify-center">
              <div className="absolute inset-0 animate-ping rounded-full bg-purple-200 opacity-30" />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
                <Brain className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Building your negotiation strategy…</p>
              <p className="mt-1 text-xs text-slate-400">
                Applying Voss, Klaff &amp; Dawson frameworks to this deal
              </p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <AlertTriangle className="h-10 w-10 text-red-400" />
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">Failed to generate playbook</p>
              <p className="mt-1 text-xs text-slate-500">{error}</p>
            </div>
            <button
              onClick={fetchCoach}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Try Again
            </button>
          </div>
        )}

        {coach && !loading && (
          <>
            {/* ── PLAYBOOK TAB ─────────────────────────────────────────────── */}
            {tab === "playbook" && (
              <div className="space-y-5">
                {/* Principles */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Core Principles for This Deal
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {coach.principles.map((p, i) => (
                      <div
                        key={i}
                        className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4"
                      >
                        <div className="mb-2 text-2xl">{p.emoji}</div>
                        <p className="mb-1 text-xs font-bold text-slate-800">{p.title}</p>
                        <p className="text-[11px] leading-relaxed text-slate-500">{p.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Playbook steps */}
                <div>
                  <h3 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    Tactical Playbook
                  </h3>
                  <div className="space-y-3">
                    {coach.playbook.map((step) => (
                      <PlaybookCard key={step.step} step={step} />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── ROUND SCRIPTS TAB ────────────────────────────────────────── */}
            {tab === "rounds" && (
              <div className="space-y-3">
                <div className="mb-1">
                  <p className="text-[10px] text-slate-400">
                    Scripts for each negotiation round. Opening is expanded by default.
                  </p>
                </div>
                {coach.roundScripts.map((script) => (
                  <RoundScriptCard
                    key={script.round}
                    script={script}
                    rung={rungs.find((r) => r.round === script.round)}
                  />
                ))}
              </div>
            )}

            {/* ── OBJECTIONS TAB ───────────────────────────────────────────── */}
            {tab === "objections" && (
              <div className="space-y-3">
                <div className="mb-1">
                  <p className="text-[10px] text-slate-400">
                    {coach.objections.length} objections calibrated to this vendor's motivation.
                    Click to expand each with your exact response.
                  </p>
                </div>
                {coach.objections.map((obj, i) => (
                  <ObjectionCard key={i} objection={obj} />
                ))}
              </div>
            )}

            {/* ── LIVE COPILOT TAB ─────────────────────────────────────────── */}
            {tab === "copilot" && (
              <div>
                <div className="mb-4 rounded-xl bg-purple-50 border border-purple-100 px-4 py-3">
                  <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    Live Copilot — vendor replied?
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-purple-600">
                    Paste their message below and get an instant psychological read, counter-offer
                    detection, and the exact reply to send.
                  </p>
                </div>
                <LiveCopilot
                  leadId={lead.id}
                  rungs={rungs}
                  ceiling={ceiling}
                  vendorMotivation={coach.vendorProfile.motivationType}
                  currentRound={currentRound}
                />
              </div>
            )}
          </>
        )}
      </div>
    </ModalShell>
  )
}
