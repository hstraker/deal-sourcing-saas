"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Sparkles, Copy, Check, RefreshCw, Loader2,
  Clock, PoundSterling, Percent, Home, TrendingUp,
  BedDouble, Wrench, AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── types ─────────────────────────────────────────────────────────────────────

interface DealSummaryTabProps {
  vendorLeadId: string
  // Metric props for the snapshot cards
  askingPrice: number | null
  estimatedMarketValue: number | null
  bmvScore: number | null
  estimatedMonthlyRent: number | null
  estimatedRefurbCost: number | null
  bedrooms: number | null
  propertyType: string | null
  condition: string | null
}

// ── helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(n)
}

function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  icon: React.ElementType
  accent: string
}) {
  return (
    <div className="ds-card p-3 flex items-center gap-3">
      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">{label}</p>
        <p className="text-sm font-bold text-gray-900 truncate">{value}</p>
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function DealSummaryTab({
  vendorLeadId,
  askingPrice,
  estimatedMarketValue,
  bmvScore,
  estimatedMonthlyRent,
  estimatedRefurbCost,
  bedrooms,
  propertyType,
  condition,
}: DealSummaryTabProps) {
  const [summary, setSummary]           = useState<string>("")
  const [generatedAt, setGeneratedAt]   = useState<string | null>(null)
  const [generating, setGenerating]     = useState(false)
  const [loading, setLoading]           = useState(true)
  const [copied, setCopied]             = useState(false)

  // Load existing summary on mount
  useEffect(() => {
    fetch(`/api/vendor-leads/${vendorLeadId}/deal-summary`)
      .then(r => r.json())
      .then(data => {
        if (data.summary) setSummary(data.summary)
        if (data.generatedAt) setGeneratedAt(data.generatedAt)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [vendorLeadId])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/deal-summary`, {
        method: "POST",
      })
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setSummary(data.summary)
      setGeneratedAt(data.generatedAt)
      toast.success("Deal summary generated")
    } catch {
      toast.error("Failed to generate summary")
    } finally {
      setGenerating(false)
    }
  }

  const copy = async () => {
    if (!summary) return
    await navigator.clipboard.writeText(summary)
    setCopied(true)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const grossYield =
    estimatedMonthlyRent && askingPrice
      ? ((estimatedMonthlyRent * 12) / askingPrice) * 100
      : null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">

      {/* ── Deal snapshot ────────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Deal Snapshot
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <MetricCard
            label="Asking Price"
            value={fmt(askingPrice)}
            icon={PoundSterling}
            accent="bg-gray-100 text-gray-600"
          />
          <MetricCard
            label="Market Value"
            value={fmt(estimatedMarketValue)}
            icon={TrendingUp}
            accent="bg-blue-50 text-blue-600"
          />
          <MetricCard
            label="Discount (BMV)"
            value={bmvScore ? `${Number(bmvScore).toFixed(1)}%` : "—"}
            icon={Percent}
            accent="bg-emerald-50 text-emerald-600"
          />
          <MetricCard
            label="Monthly Rent"
            value={fmt(estimatedMonthlyRent)}
            icon={Home}
            accent="bg-violet-50 text-violet-600"
          />
          <MetricCard
            label="Gross Yield"
            value={grossYield ? `${grossYield.toFixed(1)}%` : "—"}
            icon={Percent}
            accent="bg-indigo-50 text-indigo-600"
          />
          <MetricCard
            label="Refurb Est."
            value={fmt(estimatedRefurbCost)}
            icon={Wrench}
            accent="bg-amber-50 text-amber-600"
          />
        </div>
      </div>

      {/* ── Generate button ──────────────────────────────────────────────────── */}
      <div className="ds-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">AI Investment Case</p>
              {generatedAt && (
                <p className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Generated {new Date(generatedAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {summary && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs gap-1.5 text-gray-500"
                onClick={copy}
              >
                {copied
                  ? <><Check className="h-3.5 w-3.5 text-green-500" /> Copied</>
                  : <><Copy className="h-3.5 w-3.5" /> Copy</>
                }
              </Button>
            )}
            <Button
              size="sm"
              className={cn(
                "h-8 text-xs gap-1.5",
                summary
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "bg-[#2563EB] hover:bg-blue-700 text-white"
              )}
              onClick={generate}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
              ) : summary ? (
                <><RefreshCw className="h-3.5 w-3.5" /> Regenerate</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Generate with AI</>
              )}
            </Button>
          </div>
        </div>

        {/* Empty state */}
        {!summary && !generating && (
          <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <Sparkles className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-500">No summary yet</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs mx-auto">
              Click <strong>Generate with AI</strong> to create a professional 3-paragraph
              investment case from this deal's metrics.
            </p>
          </div>
        )}

        {/* Generating animation */}
        {generating && (
          <div className="rounded-lg border border-violet-100 bg-violet-50 py-8 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="h-2 w-2 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
            <p className="text-sm text-violet-600 font-medium">Writing investment case…</p>
            <p className="text-xs text-violet-400 mt-1">This takes a few seconds</p>
          </div>
        )}

        {/* Result */}
        {summary && !generating && (
          <div className="space-y-2">
            <Textarea
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="min-h-[200px] text-sm leading-relaxed text-gray-700 resize-none border-gray-200 focus:border-violet-300 focus:ring-violet-100"
              placeholder="AI-generated summary will appear here…"
            />
            <p className="text-[10px] text-gray-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              You can edit this text before copying it into your investor pack.
              Changes are not auto-saved — copy the text when ready.
            </p>
          </div>
        )}
      </div>

      {/* ── Usage tip ────────────────────────────────────────────────────────── */}
      <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
        <strong>How to use:</strong> Generate, review, and edit the summary above — then copy it
        into your investor pack as the opening "Why This Deal?" paragraph. The AI writes from
        your deal metrics, so the more data you've entered (yield, refurb cost, EPC), the stronger
        the output.
      </div>

    </div>
  )
}
