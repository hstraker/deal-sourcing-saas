"use client"

/**
 * DDChecklistPanel
 *
 * Renders the AI-generated due diligence checklist for a vendor lead.
 * Items are grouped by category, prioritised (critical → important → standard),
 * and can be checked off locally by the user.
 *
 * Props:
 *   leadId — the VendorLead UUID
 *   propertyAddress — shown in the header
 *   onClose? — optional close handler (used when embedded in a modal)
 */

import { useState, useEffect, useCallback } from "react"
import {
  ClipboardDocumentCheckIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from "@heroicons/react/24/outline"
import {
  CheckCircleIcon,
  XCircleIcon,
} from "@heroicons/react/24/solid"
import { Loader2, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import type { DDChecklistItem, DDChecklistResponse } from "@/app/api/vendor-leads/[id]/due-diligence/route"

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  critical: {
    label: "Critical",
    color: "text-red-700 bg-red-50 border-red-200",
    badge: "bg-red-100 text-red-700",
    dot: "bg-red-500",
    icon: XCircleIcon,
    iconClass: "text-red-500",
  },
  important: {
    label: "Important",
    color: "text-amber-700 bg-amber-50 border-amber-200",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-400",
    icon: ExclamationTriangleIcon,
    iconClass: "text-amber-500",
  },
  standard: {
    label: "Standard",
    color: "text-blue-700 bg-blue-50 border-blue-200",
    badge: "bg-blue-100 text-blue-700",
    dot: "bg-blue-400",
    icon: InformationCircleIcon,
    iconClass: "text-blue-400",
  },
}

const WHO_LABELS: Record<string, string> = {
  solicitor:           "👨‍⚖️ Solicitor",
  surveyor:            "🔍 Surveyor",
  buyer:               "👤 Buyer",
  agent:               "🏠 Agent",
  "solicitor + buyer": "👨‍⚖️ Solicitor + Buyer",
}

const TIMEFRAME_COLOR: Record<string, string> = {
  "Before offer":    "bg-purple-100 text-purple-700",
  "Before bidding":  "bg-purple-100 text-purple-700",
  "ASAP":            "bg-red-100 text-red-700",
  "Before exchange": "bg-amber-100 text-amber-700",
  "Before completion": "bg-blue-100 text-blue-700",
}

// ─── Checklist item ───────────────────────────────────────────────────────────

function ChecklistItem({
  item,
  checked,
  onToggle,
}: {
  item: DDChecklistItem
  checked: boolean
  onToggle: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = PRIORITY_CONFIG[item.priority]

  return (
    <div
      className={cn(
        "rounded-lg border transition-all duration-150",
        checked ? "opacity-60 bg-gray-50 border-gray-200" : cfg.color
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          className="mt-0.5 shrink-0 focus:outline-none"
          aria-label={checked ? "Mark incomplete" : "Mark complete"}
        >
          {checked ? (
            <CheckCircleIcon className="h-5 w-5 text-green-500" />
          ) : (
            <div className={cn("h-5 w-5 rounded-full border-2 border-current opacity-40")} />
          )}
        </button>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("text-sm font-medium leading-snug", checked && "line-through text-gray-400")}>
              {item.task}
            </p>
            <button
              onClick={() => setExpanded(v => !v)}
              className="shrink-0 text-current opacity-50 hover:opacity-80"
            >
              {expanded
                ? <ChevronUp className="h-4 w-4" />
                : <ChevronDown className="h-4 w-4" />
              }
            </button>
          </div>

          {/* Tags row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded", cfg.badge)}>
              {cfg.label}
            </span>
            <span className={cn(
              "text-[10px] font-medium px-1.5 py-0.5 rounded",
              TIMEFRAME_COLOR[item.timeframe] ?? "bg-gray-100 text-gray-600"
            )}>
              {item.timeframe}
            </span>
            <span className="text-[10px] text-current opacity-70">
              {WHO_LABELS[item.who] ?? item.who}
            </span>
          </div>

          {/* Expanded rationale */}
          {expanded && (
            <p className="text-xs leading-relaxed mt-2 opacity-80">{item.rationale}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  label,
  items,
  checked,
  onToggle,
}: {
  label: string
  items: DDChecklistItem[]
  checked: Set<string>
  onToggle: (id: string) => void
}) {
  const doneCount = items.filter(i => checked.has(i.id)).length

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</h3>
        <span className="text-xs text-gray-400">{doneCount}/{items.length}</span>
      </div>
      <div className="space-y-2">
        {items.map(item => (
          <ChecklistItem
            key={item.id}
            item={item}
            checked={checked.has(item.id)}
            onToggle={() => onToggle(item.id)}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DDChecklistPanelProps {
  leadId: string
  propertyAddress?: string | null
  /** If true, auto-generates on mount */
  autoGenerate?: boolean
}

export function DDChecklistPanel({ leadId, propertyAddress, autoGenerate = false }: DDChecklistPanelProps) {
  const [loading, setLoading]       = useState(autoGenerate)
  const [data, setData]             = useState<DDChecklistResponse | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [checked, setChecked]       = useState<Set<string>>(new Set())

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vendor-leads/${leadId}/due-diligence`, { method: "POST" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const result: DDChecklistResponse = await res.json()
      setData(result)
      setChecked(new Set()) // reset on regenerate
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate checklist"
      setError(msg)
      toast.error("DD checklist generation failed", { description: msg })
    } finally {
      setLoading(false)
    }
  }, [leadId])

  // Auto-generate on first render if prop is set
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (autoGenerate) generate() }, [])

  const toggleItem = (id: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group items by categoryLabel
  const grouped: Record<string, DDChecklistItem[]> = {}
  if (data?.items) {
    for (const item of data.items) {
      if (!grouped[item.categoryLabel]) grouped[item.categoryLabel] = []
      grouped[item.categoryLabel].push(item)
    }
  }

  const totalItems   = data?.items.length ?? 0
  const doneItems    = checked.size
  const progress     = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0
  const allDone      = totalItems > 0 && doneItems === totalItems

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardDocumentCheckIcon className="h-5 w-5 text-[#2563EB] shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">AI Due Diligence Checklist</h2>
            {propertyAddress && (
              <p className="text-xs text-gray-400 truncate max-w-xs">{propertyAddress}</p>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant={data ? "outline" : "default"}
          onClick={generate}
          disabled={loading}
          className="gap-1.5 h-8 text-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ArrowPathIcon className="h-3.5 w-3.5" />
          )}
          {data ? "Regenerate" : "Generate Checklist"}
        </Button>
      </div>

      {/* ── Flag badges ─────────────────────────────────────────────────────── */}
      {data && data.flags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.flags.map(f => (
            <span key={f} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-200">
              ⚠ {f}
            </span>
          ))}
        </div>
      )}

      {/* ── Progress bar ────────────────────────────────────────────────────── */}
      {data && totalItems > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{doneItems} of {totalItems} completed</span>
            <span className="font-semibold text-gray-700">{progress}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-300",
                allDone ? "bg-green-500" : "bg-[#2563EB]"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
          {allDone && (
            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
              <CheckCircleIcon className="h-3.5 w-3.5" /> All items completed — ready to proceed
            </p>
          )}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
          <Loader2 className="h-7 w-7 animate-spin text-[#2563EB]" />
          <p className="text-sm">Analysing property flags and generating checklist…</p>
          <p className="text-xs">This takes 5–10 seconds</p>
        </div>
      )}

      {/* ── Error ────────────────────────────────────────────────────────────── */}
      {error && !loading && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 p-3">
          <XCircleIcon className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Generation failed</p>
            <p className="text-xs text-red-600 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ── Checklist ────────────────────────────────────────────────────────── */}
      {data && !loading && (
        <div className="space-y-5">
          {Object.entries(grouped).map(([label, items]) => (
            <CategorySection
              key={label}
              label={label}
              items={items}
              checked={checked}
              onToggle={toggleItem}
            />
          ))}

          <p className="text-[10px] text-gray-400 text-center pt-2">
            Generated {new Date(data.generatedAt).toLocaleString("en-GB")} · Click items to expand rationale · Check off as completed
          </p>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────────── */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
          <ClipboardDocumentCheckIcon className="h-10 w-10 text-gray-200" />
          <p className="text-sm text-center">
            Click <span className="font-semibold text-gray-600">Generate Checklist</span> to create a tailored
            due diligence list from this deal&apos;s risk flags.
          </p>
          <p className="text-xs text-center max-w-xs">
            The AI reads flood zone, tenure, EPC, ownership, and portal checks to write specific, actionable tasks — not generic boilerplate.
          </p>
        </div>
      )}
    </div>
  )
}
