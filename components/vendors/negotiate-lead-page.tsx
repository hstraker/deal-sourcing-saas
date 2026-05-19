"use client"

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeftIcon,
  SparklesIcon,
} from "@heroicons/react/24/outline"
import {
  Brain,
  RefreshCw,
  Loader2,
  BookOpen,
  MessageSquare,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  AlertTriangle,
  Send,
  Phone,
  Mail,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OfferAnalysisPanel } from "@/components/deals/offer-analysis-panel"
import type { AssumptionsState } from "@/components/deals/offer-analysis-panel"
import type { OfferCalculationResult } from "@/lib/offer-engine/property-offer-calculator"
import { generateNegotiationLadder } from "@/lib/offer-engine/negotiation-ladder"
import type { NegotiationRung } from "@/lib/offer-engine/negotiation-ladder"
import type {
  CoachOutput,
  CoachPlaybookStep,
  CoachRoundScript,
  CoachObjection,
  CopilotResponse,
} from "@/lib/vendor-pipeline/negotiation-coach"
import type { VendorLead } from "@/components/vendors/vendor-leads-table"

// ─── helpers ─────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v))
  return isNaN(n) ? null : n
}

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        })
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium transition-colors shrink-0",
        copied ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ─── animated progress steps ─────────────────────────────────────────────────

const ENGINE_STEPS = [
  "Running offer engine…",
  "Calculating deal metrics…",
  "Deriving negotiation ceiling…",
]

const COACH_STEPS = [
  { label: "Analysing deal assumptions…",       sub: "Deal metrics, yield, ceiling" },
  { label: "Profiling vendor motivation…",       sub: "Urgency signals & psychology" },
  { label: "Applying Voss framework…",           sub: "Tactical empathy & calibrated questions" },
  { label: "Building Klaff pitch stack…",        sub: "Frame control & prizing strategy" },
  { label: "Crafting Dawson concession tactics…", sub: "Tapering offers & higher authority" },
  { label: "Generating offer round scripts…",    sub: "SMS & call scripts per round" },
  { label: "Calibrating objection handlers…",   sub: "Vendor pushback responses" },
  { label: "Finalising negotiation playbook…",  sub: "Assembling your strategy" },
]

function useProgressCycler(active: boolean, intervalMs = 2600) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    if (!active) { setIdx(0); return }
    // Advance through steps but STOP at the last one — never wrap back to 0
    const id = setInterval(() => setIdx(i => Math.min(i + 1, COACH_STEPS.length - 1)), intervalMs)
    return () => clearInterval(id)
  }, [active, intervalMs])
  return COACH_STEPS[idx]
}

function CoachProgressLoader({ phase }: { phase: "engine" | "coach" }) {
  const step = useProgressCycler(phase === "coach")
  const [engineStep, setEngineStep] = useState(0)

  useEffect(() => {
    if (phase !== "engine") { setEngineStep(0); return }
    const id = setInterval(() => setEngineStep(i => Math.min(i + 1, ENGINE_STEPS.length - 1)), 1800)
    return () => clearInterval(id)
  }, [phase])

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      {/* Pulsing brain orb */}
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-ping rounded-full bg-purple-200 opacity-25" style={{ animationDuration: "1.5s" }} />
        <div className="absolute inset-2 animate-pulse rounded-full bg-purple-100 opacity-50" style={{ animationDuration: "2s" }} />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-purple-100">
          <Brain className="h-7 w-7 text-purple-600" />
        </div>
      </div>

      {phase === "engine" ? (
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-700 transition-all duration-500">
            {ENGINE_STEPS[engineStep]}
          </p>
          <p className="mt-1 text-xs text-slate-400">Preparing deal data for AI Coach</p>
        </div>
      ) : (
        <div className="text-center space-y-1">
          <p key={step.label} className="text-sm font-semibold text-slate-700 animate-fade-in">
            {step.label}
          </p>
          <p key={step.sub} className="text-xs text-slate-400 animate-fade-in">
            {step.sub}
          </p>
        </div>
      )}

      {/* Progress trail */}
      {phase === "coach" && (
        <div className="w-64 space-y-1.5">
          {COACH_STEPS.map((s, i) => {
            const current = COACH_STEPS.indexOf(step)
            const done = i < current
            const active = i === current
            return (
              <div key={s.label} className="flex items-center gap-2">
                <div className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full transition-all duration-500",
                  done ? "bg-purple-500" : active ? "bg-purple-400 animate-pulse" : "bg-slate-200"
                )} />
                <span className={cn(
                  "text-[10px] truncate transition-all duration-500",
                  done ? "text-purple-500" : active ? "text-slate-600 font-medium" : "text-slate-300"
                )}>
                  {s.label}
                </span>
                {done && <span className="text-[10px] text-purple-400 ml-auto shrink-0">✓</span>}
              </div>
            )
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-300 mt-2">Applying Voss · Klaff · Dawson frameworks</p>
    </div>
  )
}

// ─── motivation pill ─────────────────────────────────────────────────────────

const UNKNOWN_MOTIVATION_PATTERNS = [
  /unknown/i,
  /diagnostic/i,
  /unclear/i,
  /not (yet )?known/i,
  /insufficient/i,
  /no (data|info|information)/i,
]

function normaliseMotivation(emoji: string, label: string): { emoji: string; label: string; unknown: boolean } {
  const isUnknown = !label || UNKNOWN_MOTIVATION_PATTERNS.some(re => re.test(label))
  if (isUnknown) return { emoji: "🔍", label: "Motivation unclear", unknown: true }
  return { emoji: emoji || "💬", label, unknown: false }
}

function MotivationPill({ emoji, label }: { emoji: string; label: string }) {
  const { emoji: e, label: l, unknown } = normaliseMotivation(emoji, label)
  return (
    <div className="relative group">
      <div className={cn(
        "flex items-center gap-2 rounded-full border px-3 py-1.5",
        unknown
          ? "border-slate-200 bg-slate-50"
          : "border-purple-200 bg-purple-50"
      )}>
        <span className="text-base">{e}</span>
        <span className={cn("text-xs font-semibold", unknown ? "text-slate-500" : "text-purple-800")}>
          {l}
        </span>
      </div>
      {unknown && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10 w-56">
          <div className="rounded-lg bg-slate-800 px-3 py-2 text-center shadow-lg">
            <p className="text-[11px] text-slate-200 leading-relaxed">
              Not enough vendor intel yet. Ask why they&apos;re selling to unlock a sharper strategy.
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── score ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r = 32
  const circumference = 2 * Math.PI * r
  const progress = (score / 100) * circumference
  const color = score >= 70 ? "#4ade80" : score >= 45 ? "#fbbf24" : "#f87171"
  return (
    <div className="relative flex items-center justify-center">
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="7" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          transform="rotate(-90 40 40)" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-extrabold text-white leading-none">{score}</span>
        <span className="text-[9px] text-slate-400">/100</span>
      </div>
    </div>
  )
}

function SignalBar({ label, value, levels, colours }: {
  label: string; value: string; levels: string[]; colours: Record<string, string>
}) {
  const idx = levels.indexOf(value)
  const colour = colours[value] ?? "bg-slate-400"
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between">
        <span className="text-[10px] text-slate-400">{label}</span>
        <span className={cn("text-[10px] font-semibold capitalize", {
          "text-green-400": value === "low" || value === "none",
          "text-amber-400": value === "medium",
          "text-red-400": value === "high" || value === "very_high",
        })}>{value.replace(/_/g, " ")}</span>
      </div>
      <div className="flex gap-0.5">
        {levels.map((_, i) => (
          <div key={i} className={cn("h-1.5 flex-1 rounded-sm", i <= idx ? colour : "bg-white/10")} />
        ))}
      </div>
    </div>
  )
}

// ─── playbook step ────────────────────────────────────────────────────────────

function PlaybookCard({ step }: { step: CoachPlaybookStep }) {
  const border = step.colour === "blue" ? "border-blue-500/40 bg-blue-500/5"
    : step.colour === "amber" ? "border-amber-500/40 bg-amber-500/5"
    : "border-red-500/40 bg-red-500/5"
  const num = step.colour === "blue" ? "bg-blue-600" : step.colour === "amber" ? "bg-amber-500" : "bg-red-600"
  return (
    <div className={cn("rounded-xl border p-4", border)}>
      <div className="flex items-start gap-3 mb-2">
        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white", num)}>
          {step.step}
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-800">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{step.body}</p>
        </div>
      </div>
      {step.script && (
        <div className="flex items-start justify-between gap-2 rounded-lg bg-white/60 border border-slate-200 px-3 py-2">
          <p className="text-xs italic text-slate-700 leading-relaxed flex-1">"{step.script}"</p>
          <CopyButton text={step.script} />
        </div>
      )}
    </div>
  )
}

function RoundScriptCard({ script, rung }: { script: CoachRoundScript; rung?: NegotiationRung }) {
  const [open, setOpen] = useState(script.round === 0)
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
            script.round === 0 ? "bg-blue-600" : script.round === 1 ? "bg-indigo-600" : script.round === 2 ? "bg-amber-500" : "bg-red-600")}>
            {script.round === 0 ? "↓" : script.round === 3 ? "✓" : `↑${script.round}`}
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-800 text-left">{rung?.label ?? `Round ${script.round}`}</p>
            {rung && <p className="text-xs text-slate-500">{gbp(rung.offerPrice)}</p>}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-4">
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
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">📞 Call Script</p>
              <CopyButton text={script.callScript} />
            </div>
            <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
              <p className="text-xs leading-relaxed text-slate-700 whitespace-pre-wrap">{script.callScript}</p>
            </div>
          </div>
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

function ObjectionCard({ objection }: { objection: CoachObjection }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <button type="button" onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors">
        <div className="flex items-center gap-2">
          <span className="text-lg">{objection.emoji}</span>
          <p className="text-sm font-medium text-slate-800 italic text-left">"{objection.title}"</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
      </button>
      {open && (
        <div className="border-t border-slate-100 px-4 pb-4 pt-3 space-y-3">
          <div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">🧠 Why they say this</p>
            <p className="text-xs leading-relaxed text-slate-600">{objection.whyTheySayIt}</p>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">💬 Your response</p>
              <CopyButton text={objection.response} />
            </div>
            <div className="rounded-lg bg-green-50 border border-green-100 px-3 py-2">
              <p className="text-xs leading-relaxed text-green-900 italic">"{objection.response}"</p>
            </div>
          </div>
          {objection.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {objection.tags.map(tag => (
                <span key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-medium text-slate-600">
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

function LiveCopilotPanel({ leadId, rungs, ceiling, vendorMotivation }: {
  leadId: string; rungs: NegotiationRung[]; ceiling: number; vendorMotivation: string
}) {
  const [round, setRound] = useState(0)
  const [message, setMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CopilotResponse | null>(null)

  const analyse = async () => {
    if (!message.trim()) return
    setLoading(true); setResult(null)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${leadId}/negotiation-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "copilot", vendorMessage: message, currentRound: round, rungs, ceiling, vendorMotivation }),
      })
      if (!res.ok) throw new Error("Failed")
      setResult(await res.json())
    } catch {
      toast.error("Copilot analysis failed — please try again")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-purple-50 border border-purple-100 px-4 py-3">
        <p className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5" /> Live Copilot — vendor replied?
        </p>
        <p className="mt-0.5 text-[11px] text-purple-600 leading-relaxed">
          Paste their message, select the current round, and get an instant psychological read + exact reply to send.
        </p>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Current round</label>
        <div className="flex gap-1.5 flex-wrap">
          {rungs.map(r => (
            <button key={r.round} type="button" onClick={() => setRound(r.round)}
              className={cn("rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                round === r.round ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300")}>
              {r.label} <span className="ml-1 text-[10px] opacity-70">{gbp(r.offerPrice)}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2 block">Paste the vendor's reply</label>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="e.g. 'I'm not going lower than £85,000. I've had another offer already...'"
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none" />
      </div>
      <button type="button" onClick={analyse} disabled={loading || !message.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50 transition-colors">
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Analysing…</> : <><Brain className="h-4 w-4" /> Analyse &amp; Get Next Move</>}
      </button>
      {result && (
        <div className="space-y-4 border-t border-slate-100 pt-4">
          <div className="rounded-xl bg-purple-50 border border-purple-100 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-purple-500 mb-1.5">🧠 Psychological Read</p>
            <p className="text-sm leading-relaxed text-purple-900">{result.psychologicalRead}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Counter Offer</p>
              <p className="text-base font-extrabold text-slate-800">
                {result.detectedCounterOffer != null ? gbp(result.detectedCounterOffer) : "None stated"}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Urgency Update</p>
              <p className="text-xs leading-relaxed text-slate-700">{result.urgencyUpdate}</p>
            </div>
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center gap-1">
                <Send className="h-3 w-3" /> Send This Next
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
            <p className="mt-1.5 text-[10px] text-slate-500">⏰ {result.timingAdvice}</p>
          </div>
          {result.warningFlags.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500 mb-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Warning Flags
              </p>
              <ul className="space-y-1">
                {result.warningFlags.map((f, i) => (
                  <li key={i} className="text-xs text-amber-800 flex items-start gap-1.5">
                    <span className="mt-0.5 text-amber-500 shrink-0">⚠</span>{f}
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

// ─── main page component ──────────────────────────────────────────────────────

type Tab = "playbook" | "rounds" | "objections" | "copilot"

const TABS: { key: Tab; label: string; description: string; icon: ReactNode }[] = [
  {
    key: "playbook",
    label: "Playbook",
    description: "Strategy, vendor intel & tactics",
    icon: <BookOpen className="h-3.5 w-3.5" />,
  },
  {
    key: "rounds",
    label: "Offer Scripts",
    description: "Word-for-word SMS & call scripts",
    icon: <MessageSquare className="h-3.5 w-3.5" />,
  },
  {
    key: "objections",
    label: "Objections",
    description: "Handle vendor pushback",
    icon: <Shield className="h-3.5 w-3.5" />,
  },
  {
    key: "copilot",
    label: "Live Copilot",
    description: "Paste a reply → get next move",
    icon: <Zap className="h-3.5 w-3.5" />,
  },
]

export function NegotiateLeadPage({
  lead,
  savedCoach = null,
  savedCoachAt = null,
}: {
  lead: VendorLead
  savedCoach?: CoachOutput | null
  savedCoachAt?: string | null
}) {
  const router = useRouter()

  // ── Offer engine state ───────────────────────────────────────────────────
  const [offerResult, setOfferResult] = useState<OfferCalculationResult | null>(null)
  const [assumptionLoading, setAssumptionLoading] = useState(false)
  const recalcFnRef = useRef<((o: AssumptionsState) => void) | null>(null)
  const assumptionsRef = useRef<AssumptionsState | null>(null)

  const saved = lead.calculatorAssumptions as Record<string, string> | null | undefined
  const [assumptions, setAssumptions] = useState<AssumptionsState>({
    gdv: saved?.gdv ?? (lead.estimatedMarketValue ? String(Math.round(Number(lead.estimatedMarketValue))) : ""),
    estimatedRent: saved?.estimatedRent ?? (lead.estimatedMonthlyRent ? String(Math.round(Number(lead.estimatedMonthlyRent))) : lead.localAverageRent ? String(Math.round(Number(lead.localAverageRent))) : ""),
    totalRefurbishment: saved?.totalRefurbishment ?? (lead.estimatedRefurbCost ? String(Math.round(Number(lead.estimatedRefurbCost))) : lead.estimatedMarketValue ? String(Math.round(Number(lead.estimatedMarketValue) * 0.1)) : ""),
    bridgingMonths: saved?.bridgingMonths ?? "12",
    mortgageRate: saved?.mortgageRate ?? "4.59",
  })

  const handleRecalculate = useCallback(() => {
    if (!recalcFnRef.current) return
    setAssumptionLoading(true)
    assumptionsRef.current = assumptions
    recalcFnRef.current(assumptions)
  }, [assumptions])

  const handleResult = useCallback((r: OfferCalculationResult) => {
    setOfferResult(r)
    setAssumptionLoading(false)
    const snap = assumptionsRef.current
    if (snap) {
      toast.success("Deal recalculated", { description: "Assumptions saved." })
      assumptionsRef.current = null
    }
    if (r.recommendedStrategy === "pass") return
    const isHold = r.recommendedStrategy === "hold"
    const recCeiling = isHold
      ? (r.hold.maxPurchasePrice > 0 ? r.hold.maxPurchasePrice : r.flip.maxPurchasePrice)
      : (r.flip.maxPurchasePrice > 0 ? r.flip.maxPurchasePrice : r.hold.maxPurchasePrice)
    const opening = recCeiling > 0 ? Math.round((recCeiling * 0.88) / 50) * 50 : 0
    if (opening <= 0) return
    const gdvNum = r.inputs.gdv
    const offerPercentage = gdvNum > 0 ? ((gdvNum - opening) / gdvNum) * 100 : null
    fetch(`/api/vendor-pipeline/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        offerAmount: opening,
        ...(offerPercentage !== null ? { offerPercentage } : {}),
        ...(snap ? { calculatorAssumptions: snap } : {}),
      }),
    }).catch(() => {})
  }, [lead.id])

  // ── Coach state ───────────────────────────────────────────────────────────
  const [coach, setCoach] = useState<CoachOutput | null>(savedCoach)
  const [coachLoading, setCoachLoading] = useState(false)
  const [coachError, setCoachError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("playbook")

  // Derive coach inputs from offer result
  const coachInputs = useCallback(() => {
    if (!offerResult || offerResult.recommendedStrategy === "pass") return null
    const isHold = offerResult.recommendedStrategy === "hold"
    const strategy: "flip" | "hold" | "both" = offerResult.recommendedStrategy === "both" ? "both" : offerResult.recommendedStrategy
    const ceiling = isHold
      ? (offerResult.hold.maxPurchasePrice > 0 ? offerResult.hold.maxPurchasePrice : offerResult.flip.maxPurchasePrice)
      : (offerResult.flip.maxPurchasePrice > 0 ? offerResult.flip.maxPurchasePrice : offerResult.hold.maxPurchasePrice)
    const ladderStrategy: "flip" | "hold" = isHold ? "hold" : "flip"
    const ladder = generateNegotiationLadder(offerResult, ladderStrategy)
    return {
      strategy,
      ceiling,
      rungs: ladder?.rungs ?? [],
      gdv: offerResult.inputs.gdv > 0 ? offerResult.inputs.gdv : null,
      monthlyRent: offerResult.inputs.estimatedRent > 0 ? offerResult.inputs.estimatedRent : null,
      grossYield: offerResult.hold.grossYield ?? null,
      refurbCost: offerResult.inputs.totalRefurbishment > 0 ? offerResult.inputs.totalRefurbishment : null,
    }
  }, [offerResult])

  const fetchCoach = useCallback(async (force = false) => {
    const inputs = coachInputs()
    if (!inputs) return
    setCoachLoading(true); setCoachError(null)
    if (force) setCoach(null)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads/${lead.id}/negotiation-coach`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "playbook", force, ...inputs }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      // The playbook endpoint streams plain text — accumulate all chunks then parse JSON
      if (!res.body) throw new Error("No response body")
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
      }
      // Strip any markdown code fences Claude may emit
      const clean = accumulated
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim()
      setCoach(JSON.parse(clean))
    } catch (e: any) {
      setCoachError(e.message || "Failed to generate playbook")
    } finally {
      setCoachLoading(false)
    }
  }, [lead.id, coachInputs])

  // Auto-fetch coach once we have a viable offer result.
  // Pre-set to true if we loaded a cached coach from the server (no need to call AI).
  const coachFetchedRef = useRef(!!savedCoach)
  useEffect(() => {
    if (offerResult && offerResult.recommendedStrategy !== "pass" && !coachFetchedRef.current && !coach) {
      coachFetchedRef.current = true
      fetchCoach()
    }
  }, [offerResult, coach, fetchCoach])

  // ── Derived display values ────────────────────────────────────────────────
  const askingPrice   = toNum(lead.askingPrice) ?? 0
  const gdv           = toNum(lead.estimatedMarketValue)
  const estimatedRent = toNum(lead.estimatedMonthlyRent) ?? toNum(lead.localAverageRent)
  const totalRefurb   = toNum(lead.estimatedRefurbCost)

  // Price stats derived from offer engine result
  const offerCeiling = offerResult && offerResult.recommendedStrategy !== "pass"
    ? (offerResult.recommendedStrategy === "hold"
        ? (offerResult.hold.maxPurchasePrice > 0 ? offerResult.hold.maxPurchasePrice : offerResult.flip.maxPurchasePrice)
        : (offerResult.flip.maxPurchasePrice > 0 ? offerResult.flip.maxPurchasePrice : offerResult.hold.maxPurchasePrice))
    : null
  const openingBid = offerCeiling ? Math.round((offerCeiling * 0.88) / 50) * 50 : null
  const discountPct = openingBid && askingPrice > 0
    ? Math.round(((askingPrice - openingBid) / askingPrice) * 100)
    : null

  const inputs = coachInputs()

  return (
    // Escape the AppShell p-4 md:p-8 padding so this page fills the full viewport
    <div className="-m-4 md:-m-8 flex overflow-hidden" style={{ height: "100vh" }}>

      {/* ── LEFT: Offer engine sidebar (dark) ────────────────────────────── */}
      <aside className="w-[300px] shrink-0 overflow-y-auto bg-[#1e293b] text-white flex flex-col">
        {/* Back */}
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
          <button onClick={() => router.push("/dashboard/negotiate")}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
            <ArrowLeftIcon className="h-3.5 w-3.5" />
            All Negotiations
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Lead header */}
          <div>
            <p className="text-sm font-bold text-white leading-snug">
              {lead.propertyAddress ?? lead.vendorName}
            </p>
            {lead.propertyPostcode && (
              <p className="text-[11px] text-slate-400">{lead.propertyPostcode}</p>
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              {lead.bedrooms != null && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-slate-200">{lead.bedrooms} bed</span>
              )}
              {lead.propertyType && (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] capitalize text-slate-200">{lead.propertyType}</span>
              )}
            </div>
          </div>

          {/* Vendor */}
          <div className="space-y-2">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500">Vendor</p>
            <p className="text-sm font-semibold text-white">{lead.vendorName}</p>
            {lead.vendorPhone && (
              <a href={`tel:${lead.vendorPhone}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition-colors">
                <Phone className="h-3 w-3 shrink-0 text-blue-400" />{lead.vendorPhone}
              </a>
            )}
            {lead.vendorEmail && (
              <a href={`mailto:${lead.vendorEmail}`}
                className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-slate-200 hover:bg-white/10 transition-colors truncate">
                <Mail className="h-3 w-3 shrink-0 text-blue-400" />
                <span className="truncate">{lead.vendorEmail}</span>
              </a>
            )}
            {lead.motivationScore != null && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Motivation</span>
                <span className={cn("font-bold", Number(lead.motivationScore) >= 8 ? "text-green-400" : Number(lead.motivationScore) >= 5 ? "text-amber-400" : "text-slate-300")}>
                  {lead.motivationScore}/10
                </span>
              </div>
            )}
            {lead.urgencyLevel && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Urgency</span>
                <span className={cn("font-semibold capitalize", lead.urgencyLevel === "high" ? "text-red-400" : lead.urgencyLevel === "medium" ? "text-amber-400" : "text-slate-300")}>
                  {lead.urgencyLevel}
                </span>
              </div>
            )}
          </div>

          <div className="h-px bg-white/10" />

          {/* Price overview */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-2">Prices</p>
            <div className="space-y-1">
              {/* Asking price — always visible */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Asking price</span>
                <span className="text-[11px] font-semibold text-white">
                  {askingPrice > 0 ? gbp(askingPrice) : "—"}
                </span>
              </div>
              {/* Max offer ceiling — shows once offer engine has run */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Max offer</span>
                <span className="text-[11px] font-semibold text-amber-400">
                  {offerCeiling ? gbp(offerCeiling) : <span className="text-slate-600 italic">calculating…</span>}
                </span>
              </div>
              {/* Opening bid */}
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Opening bid</span>
                <span className="text-[11px] font-bold text-green-400">
                  {openingBid ? gbp(openingBid) : <span className="text-slate-600 italic">calculating…</span>}
                </span>
              </div>
              {/* Discount % badge */}
              {discountPct != null && (
                <div className="mt-1.5 flex items-center justify-between rounded-lg bg-white/5 px-2.5 py-1.5">
                  <span className="text-[10px] text-slate-400">Discount from asking</span>
                  <span className="text-[11px] font-bold text-red-400">-{discountPct}%</span>
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-white/10" />

          {/* Assumptions form */}
          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-500 mb-3">Deal Assumptions</p>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { key: "gdv" as const, label: "GDV (£)" },
                { key: "estimatedRent" as const, label: "Rent PCM (£)" },
                { key: "totalRefurbishment" as const, label: "Refurb (£)" },
                { key: "bridgingMonths" as const, label: "Bridge (mo)" },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 block mb-0.5">{label}</label>
                  <input
                    type="number"
                    value={assumptions[key]}
                    onChange={e => setAssumptions(a => ({ ...a, [key]: e.target.value }))}
                    className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              ))}
              <div className="col-span-2">
                <label className="text-[9px] font-semibold uppercase tracking-wide text-slate-500 block mb-0.5">Mortgage Rate (%)</label>
                <input
                  type="number" step="0.01"
                  value={assumptions.mortgageRate}
                  onChange={e => setAssumptions(a => ({ ...a, mortgageRate: e.target.value }))}
                  className="w-full rounded border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
            <button
              onClick={handleRecalculate}
              disabled={assumptionLoading || !recalcFnRef.current}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {assumptionLoading
                ? <><Loader2 className="h-3 w-3 animate-spin" /> Calculating…</>
                : <><RefreshCw className="h-3 w-3" /> Recalculate</>}
            </button>
          </div>
        </div>

        {/* Hidden offer engine panel — runs the calculation, we only use the onResult callback */}
        <div className="hidden">
          <OfferAnalysisPanel
            vendorLeadId={lead.id}
            dealId={lead.dealId}
            askingPrice={askingPrice}
            gdv={gdv}
            estimatedRent={estimatedRent}
            totalRefurbishment={totalRefurb}
            vendorName={lead.vendorName}
            vendorEmail={lead.vendorEmail}
            vendorPhone={lead.vendorPhone}
            onResult={handleResult}
            onAssumptionsReady={fn => { recalcFnRef.current = fn }}
            hideAssumptionsPanel
            hideControls
          />
        </div>
      </aside>

      {/* ── RIGHT: Negotiation coach ──────────────────────────────────────── */}
      <main className="flex flex-1 flex-col overflow-hidden bg-white">

        {/* Coach header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100">
              <SparklesIcon className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900">AI Negotiation Coach</h1>
              {coach && (
                <p className="text-xs text-slate-400 mt-0.5">{coach.strategyName}</p>
              )}
            </div>
          </div>

          {/* Right side: cache badge + profile pill + score + regenerate */}
          <div className="flex items-center gap-3">
            {/* Cached badge */}
            {coach && savedCoachAt && !coachLoading && (
              <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-400">
                <Check className="h-3 w-3 text-green-500" />
                Saved {new Date(savedCoachAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
            )}
            {/* Regenerate button */}
            {coach && !coachLoading && offerResult && offerResult.recommendedStrategy !== "pass" && (
              <button
                onClick={() => { coachFetchedRef.current = true; fetchCoach(true) }}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-500 hover:border-purple-300 hover:text-purple-600 transition-colors"
                title="Regenerate strategy"
              >
                <RefreshCw className="h-3 w-3" /> Regenerate
              </button>
            )}
            {/* Coach profile pill */}
            {coach && (
              <div className="flex items-center gap-3">
                <MotivationPill
                  emoji={coach.vendorProfile.motivationEmoji}
                  label={coach.vendorProfile.motivationLabel}
                />
                <ScoreRing score={coach.negotiationScore} />
              </div>
            )}
          </div>
        </div>

        {/* Signal bars row — shown once loaded */}
        {coach && (
          <div className="flex gap-6 border-b border-slate-100 bg-slate-50 px-6 py-3 shrink-0">
            <div className="flex-1">
              <SignalBar label="Vendor Urgency" value={coach.vendorProfile.urgencySignal}
                levels={["low","medium","high","very_high"]}
                colours={{ low:"bg-green-500", medium:"bg-amber-400", high:"bg-red-400", very_high:"bg-red-600" }} />
            </div>
            <div className="flex-1">
              <SignalBar label="Price Flexibility" value={coach.vendorProfile.priceFlexibility}
                levels={["low","medium","high"]}
                colours={{ low:"bg-red-400", medium:"bg-amber-400", high:"bg-green-500" }} />
            </div>
            <div className="flex-1">
              <SignalBar label="Competing Offers Risk" value={coach.vendorProfile.competingOffersRisk}
                levels={["none","low","medium","high"]}
                colours={{ none:"bg-green-500", low:"bg-green-400", medium:"bg-amber-400", high:"bg-red-500" }} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-slate-400 mb-1">Strategy</p>
              <p className="text-xs font-bold text-slate-700 truncate">{coach.strategyRationale.split(" ").slice(0, 6).join(" ")}…</p>
            </div>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex border-b border-slate-100 shrink-0">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 px-3 py-3 transition-colors border-b-2",
                tab === t.key ? "border-purple-600 bg-purple-50 text-purple-700" : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              )}>
              <div className="flex items-center gap-1.5">
                {t.icon}
                <span className="text-xs font-semibold">{t.label}</span>
              </div>
              <span className={cn("text-[10px] leading-tight", tab === t.key ? "text-purple-500" : "text-slate-400")}>
                {t.description}
              </span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Loading state */}
          {(coachLoading || (!offerResult && !coachError)) && (
            <CoachProgressLoader phase={!offerResult ? "engine" : "coach"} />
          )}

          {/* Engine ran but no viable strategy */}
          {offerResult && offerResult.recommendedStrategy === "pass" && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">No viable strategy at this asking price</p>
                <p className="mt-1 text-xs text-slate-500">Adjust the assumptions in the left panel and recalculate.</p>
              </div>
            </div>
          )}

          {/* Error */}
          {coachError && !coachLoading && (
            <div className="flex flex-col items-center justify-center gap-4 py-24">
              <AlertTriangle className="h-10 w-10 text-red-400" />
              <div className="text-center">
                <p className="text-sm font-semibold text-slate-700">Failed to generate playbook</p>
                <p className="mt-1 text-xs text-slate-500">{coachError}</p>
              </div>
              <button onClick={fetchCoach}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                <RefreshCw className="h-4 w-4" /> Try Again
              </button>
            </div>
          )}

          {/* Coach content */}
          {coach && !coachLoading && inputs && (
            <>
              {tab === "playbook" && (
                <div className="space-y-6">
                  {/* Key intel + walk-away side by side */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-xl border border-slate-200 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">🔍 Key Intel</p>
                      <ul className="space-y-2">
                        {coach.vendorProfile.keyIntel.map((pt, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600 leading-relaxed">
                            <span className="text-purple-400 mt-0.5 shrink-0">·</span>{pt}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-red-400 mb-3">✕ Walk-Away Triggers</p>
                      <ul className="space-y-2">
                        {coach.walkAwayTriggers.map((t, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs text-red-700 leading-relaxed">
                            <span className="shrink-0 mt-0.5">✕</span>{t}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {/* Principles */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Core Principles</p>
                    <div className="grid grid-cols-3 gap-3">
                      {coach.principles.map((p, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 bg-gradient-to-b from-slate-50 to-white p-4">
                          <div className="mb-2 text-2xl">{p.emoji}</div>
                          <p className="mb-1 text-xs font-bold text-slate-800">{p.title}</p>
                          <p className="text-[11px] leading-relaxed text-slate-500">{p.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Playbook steps */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">Tactical Playbook</p>
                    <div className="space-y-3">
                      {coach.playbook.map(step => <PlaybookCard key={step.step} step={step} />)}
                    </div>
                  </div>
                  {/* Follow-up prompt */}
                  {coach.copilot && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-1.5">📬 Suggested Follow-Up (if no reply in 6h)</p>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs leading-relaxed text-blue-800 italic flex-1">"{coach.copilot.suggestedFollowUp}"</p>
                        <CopyButton text={coach.copilot.suggestedFollowUp} />
                      </div>
                      <p className="mt-2 text-[10px] text-blue-600">{coach.copilot.waitAdvice}</p>
                    </div>
                  )}
                </div>
              )}

              {tab === "rounds" && (
                <div className="space-y-3">
                  {coach.roundScripts.map(s => (
                    <RoundScriptCard key={s.round} script={s} rung={inputs.rungs.find(r => r.round === s.round)} />
                  ))}
                </div>
              )}

              {tab === "objections" && (
                <div className="space-y-3">
                  <p className="text-[10px] text-slate-400 mb-1">
                    {coach.objections.length} objections calibrated to this vendor's motivation. Click to expand.
                  </p>
                  {coach.objections.map((o, i) => <ObjectionCard key={i} objection={o} />)}
                </div>
              )}

              {tab === "copilot" && (
                <LiveCopilotPanel
                  leadId={lead.id}
                  rungs={inputs.rungs}
                  ceiling={inputs.ceiling}
                  vendorMotivation={coach.vendorProfile.motivationType}
                />
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
