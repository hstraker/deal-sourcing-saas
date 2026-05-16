"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Hammer,
  Plus,
  Trash2,
  Loader2,
  Pencil,
  Check,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RefurbLineItem {
  id: string
  category: string
  description: string
  estimatedCost: number
  notes: string | null
  sortOrder: number
}

interface Props {
  vendorLeadId: string
  photoAnalysisNotes?: string | null   // used by AI generate
  condition?: string | null            // property condition for AI estimate
  bedrooms?: number | null
  propertyType?: string | null
}

// ── Constants ─────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "structural",  label: "🧱 Structural",       description: "Foundations, walls, roof structure" },
  { value: "roof",        label: "🏠 Roof",              description: "Tiles, gutters, felting, chimney" },
  { value: "plumbing",    label: "🚿 Plumbing",          description: "Boiler, radiators, pipes, bathroom" },
  { value: "electrical",  label: "⚡ Electrical",        description: "Consumer unit, rewiring, sockets" },
  { value: "cosmetic",    label: "🎨 Cosmetic",          description: "Plaster, paint, flooring, tiling" },
  { value: "kitchen",     label: "🍳 Kitchen",           description: "Units, worktops, appliances" },
  { value: "bathroom",    label: "🛁 Bathroom",          description: "Suite, tiles, fittings" },
  { value: "windows",     label: "🪟 Windows & Doors",   description: "UPVC, frames, glazing" },
  { value: "external",    label: "🏡 External",          description: "Damp proof, pointing, driveway, garden" },
  { value: "damp",        label: "💧 Damp / Mould",      description: "Treatment, tanking, membranes" },
  { value: "insulation",  label: "🌡️ Insulation",       description: "Loft, cavity wall, underfloor" },
  { value: "other",       label: "📦 Other",             description: "Miscellaneous" },
]

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]))

const CONTINGENCY_PCT = 0.10   // 10% contingency added to total

function formatGBP(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(n)
}

// ── AI Estimate Generator ─────────────────────────────────────────────────────
// Quick rule-based estimate when no AI photo analysis notes are available.
// Returns a sensible starter pack based on condition + bedrooms.

function generateAiEstimate(
  condition: string | null | undefined,
  bedrooms: number | null | undefined,
  propertyType: string | null | undefined
): Array<Omit<RefurbLineItem, "id">> {
  const beds = bedrooms ?? 2
  const isFlat = propertyType?.toLowerCase().includes("flat") || propertyType?.toLowerCase().includes("apartment")

  const items: Array<Omit<RefurbLineItem, "id">> = []
  let i = 0

  const add = (category: string, description: string, cost: number) => {
    items.push({ category, description, estimatedCost: cost, notes: null, sortOrder: i++ })
  }

  if (!condition || condition === "poor" || condition === "needs_modernisation") {
    add("plumbing",   "Full boiler replacement + radiator system",                 3_500)
    add("electrical", "Consumer unit upgrade + partial rewire",                    2_500)
    add("cosmetic",   "Full plaster, paint and décor throughout",                  beds * 800 + 1_200)
    add("kitchen",    "Budget kitchen replacement (units, worktop, sink)",          3_200)
    add("bathroom",   `${beds > 2 ? "Two bathrooms" : "One bathroom"} — full suite replacement`, beds > 2 ? 4_000 : 2_200)
    add("windows",    "UPVC windows replacement (all rooms)",                      beds * 650 + 800)
    if (!isFlat) {
      add("roof",     "Roof inspection, re-pointing, minor repairs",               1_800)
      add("external", "Damp proof course, repointing, garden clearance",           1_500)
    }
    add("damp",       "Damp survey + treatment (precautionary)",                   900)
  } else if (condition === "needs_work") {
    add("plumbing",   "Boiler service + replacement radiators x 3",                1_500)
    add("electrical", "Consumer unit check + socket/lighting update",              1_200)
    add("cosmetic",   "Redecoration + new flooring throughout",                    beds * 600 + 800)
    add("kitchen",    "Kitchen refresh (worktops, tiling, appliances)",            1_800)
    add("bathroom",   "Bathroom re-suite + tiling",                                1_800)
    if (!isFlat) add("roof", "Roof maintenance + gutter replacement",              800)
  } else {
    // good / excellent — light cosmetic
    add("cosmetic",   "Light redecoration + carpet/flooring refresh",              beds * 350 + 500)
    add("kitchen",    "Kitchen cosmetic update (paint, handles, splashback)",      600)
    add("bathroom",   "Bathroom recaulk, taps + accessories",                     400)
  }

  return items
}

// ── Row component ─────────────────────────────────────────────────────────────

function LineItemRow({
  item,
  vendorLeadId,
  onDelete,
  onUpdate,
}: {
  item: RefurbLineItem
  vendorLeadId: string
  onDelete: (id: string) => void
  onUpdate: (id: string, patch: Partial<RefurbLineItem>) => void
}) {
  const [editing, setEditing] = useState(false)
  const [desc, setDesc]  = useState(item.description)
  const [cost, setCost]  = useState(String(item.estimatedCost))
  const [cat, setCat]    = useState(item.category)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/refurb-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: cat,
          description: desc,
          estimatedCost: Number(cost) || 0,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      onUpdate(item.id, { category: cat, description: desc, estimatedCost: Number(cost) || 0 })
      setEditing(false)
    } catch {
      toast.error("Failed to save item")
    } finally {
      setSaving(false)
    }
  }

  const del = async () => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/refurb-items/${item.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      onDelete(item.id)
    } catch {
      toast.error("Failed to delete item")
    } finally {
      setDeleting(false)
    }
  }

  if (editing) {
    return (
      <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-2">
        <div className="flex gap-2">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="h-8 text-xs w-44 shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map(c => (
                <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={desc}
            onChange={e => setDesc(e.target.value)}
            className="h-8 text-xs flex-1"
            placeholder="Description"
          />
          <div className="relative shrink-0 w-28">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">£</span>
            <Input
              value={cost}
              onChange={e => setCost(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-8 text-xs pl-6"
              placeholder="0"
            />
          </div>
        </div>
        <div className="flex gap-1.5 justify-end">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
            <X className="h-3 w-3 mr-1" /> Cancel
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Save
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group">
      <span className="text-xs text-gray-400 w-36 shrink-0 truncate">
        {CATEGORY_MAP[item.category] ?? item.category}
      </span>
      <span className="text-xs text-gray-700 flex-1 min-w-0 truncate">{item.description}</span>
      <span className="text-xs font-semibold tabular-nums text-gray-900 w-20 text-right shrink-0">
        {formatGBP(item.estimatedCost)}
      </span>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
          title="Edit"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={del}
          disabled={deleting}
          className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-500"
          title="Delete"
        >
          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function RefurbLineItemsTab({
  vendorLeadId,
  photoAnalysisNotes,
  condition,
  bedrooms,
  propertyType,
}: Props) {
  const [items, setItems] = useState<RefurbLineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  // New item form state
  const [newCat, setNewCat]    = useState("cosmetic")
  const [newDesc, setNewDesc]  = useState("")
  const [newCost, setNewCost]  = useState("")
  const [adding, setAdding]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/refurb-items`)
      if (!res.ok) throw new Error("load failed")
      const data = await res.json()
      setItems(data.items)
    } catch {
      toast.error("Failed to load refurb items")
    } finally {
      setLoading(false)
    }
  }, [vendorLeadId])

  useEffect(() => { load() }, [load])

  const addItem = async () => {
    if (!newDesc.trim()) { toast.error("Please enter a description"); return }
    setAdding(true)
    try {
      const res = await fetch(`/api/vendor-leads/${vendorLeadId}/refurb-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newCat,
          description: newDesc.trim(),
          estimatedCost: Number(newCost) || 0,
          sortOrder: items.length,
        }),
      })
      if (!res.ok) throw new Error("Add failed")
      const data = await res.json()
      setItems(prev => [...prev, data.item])
      setNewDesc("")
      setNewCost("")
      setShowAdd(false)
      toast.success("Line item added")
    } catch {
      toast.error("Failed to add item")
    } finally {
      setAdding(false)
    }
  }

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const updateItem = (id: string, patch: Partial<RefurbLineItem>) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
  }

  const generateFromAI = async () => {
    setGenerating(true)
    try {
      const estimated = generateAiEstimate(condition, bedrooms, propertyType)

      // Batch add all items
      const results: RefurbLineItem[] = []
      for (const item of estimated) {
        const res = await fetch(`/api/vendor-leads/${vendorLeadId}/refurb-items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: item.category,
            description: item.description,
            estimatedCost: item.estimatedCost,
            sortOrder: items.length + results.length,
          }),
        })
        if (res.ok) {
          const data = await res.json()
          results.push(data.item)
        }
      }

      setItems(prev => [...prev, ...results])
      toast.success(`${results.length} line items generated from property assessment`)
    } catch {
      toast.error("Failed to generate estimate")
    } finally {
      setGenerating(false)
    }
  }

  const total        = items.reduce((s, i) => s + i.estimatedCost, 0)
  const contingency  = Math.round(total * CONTINGENCY_PCT)
  const grandTotal   = total + contingency

  // Group by category for summary
  const byCategory = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + item.estimatedCost
    return acc
  }, {})

  return (
    <div className="space-y-4">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Hammer className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-gray-900">Refurb Cost Breakdown</span>
          {items.length > 0 && (
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              {items.length} items
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {items.length === 0 && !loading && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={generateFromAI}
              disabled={generating}
            >
              {generating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Generate from Assessment</>
              }
            </Button>
          )}
          <Button
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Item
          </Button>
        </div>
      </div>

      {/* ── Add form ────────────────────────────────────────────────────────── */}
      {showAdd && (
        <div className="ds-card p-3 space-y-2 border-blue-200">
          <p className="text-xs font-semibold text-gray-600">New line item</p>
          <div className="flex gap-2 flex-wrap">
            <Select value={newCat} onValueChange={setNewCat}>
              <SelectTrigger className="h-8 text-xs w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              className="h-8 text-xs flex-1 min-w-48"
              placeholder="Description (e.g. Full bathroom replacement)"
              onKeyDown={e => { if (e.key === "Enter") addItem() }}
            />
            <div className="relative w-28">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">£</span>
              <Input
                value={newCost}
                onChange={e => setNewCost(e.target.value.replace(/[^0-9.]/g, ""))}
                className="h-8 text-xs pl-6"
                placeholder="0"
                onKeyDown={e => { if (e.key === "Enter") addItem() }}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs gap-1" onClick={addItem} disabled={adding}>
              {adding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Add
            </Button>
          </div>
        </div>
      )}

      {/* ── Line items list ──────────────────────────────────────────────────── */}
      <div className="ds-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-24 gap-2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-xs">Loading…</span>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Hammer className="h-10 w-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500 mb-1">No refurb items yet</p>
            <p className="text-xs text-gray-400 mb-4 max-w-[260px]">
              Add line items manually or click "Generate from Assessment" to get an AI-powered
              estimate based on property condition.
            </p>
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
              onClick={generateFromAI}
              disabled={generating}
            >
              {generating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                : <><Sparkles className="h-3.5 w-3.5" /> Generate from Assessment</>
              }
            </Button>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-[var(--ds-border)] text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
              <span className="w-36 shrink-0">Category</span>
              <span className="flex-1">Description</span>
              <span className="w-20 text-right shrink-0">Cost</span>
              <span className="w-12 shrink-0" />
            </div>

            <div className="divide-y divide-gray-50">
              {items.map(item => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  vendorLeadId={vendorLeadId}
                  onDelete={() => deleteItem(item.id)}
                  onUpdate={(_, patch) => updateItem(item.id, patch)}
                />
              ))}
            </div>

            {/* Totals */}
            <div className="border-t border-[var(--ds-border)] bg-gray-50 px-3 py-2 space-y-1">
              <div className="flex justify-between text-xs text-gray-500">
                <span>Subtotal ({items.length} items)</span>
                <span className="font-medium tabular-nums">{formatGBP(total)}</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400">
                <span>Contingency (10%)</span>
                <span className="tabular-nums">+ {formatGBP(contingency)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-gray-200">
                <span>Total Refurb Estimate</span>
                <span className="tabular-nums text-amber-700">{formatGBP(grandTotal)}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Category summary ─────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <div className="ds-card p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Cost by Category</p>
          <div className="space-y-2">
            {Object.entries(byCategory)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, cost]) => {
                const pct = total > 0 ? (cost / total) * 100 : 0
                return (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-32 shrink-0 truncate">
                      {CATEGORY_MAP[cat] ?? cat}
                    </span>
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 tabular-nums w-20 text-right shrink-0">
                      {formatGBP(cost)}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Tips ─────────────────────────────────────────────────────────────── */}
      {items.length > 0 && (
        <p className="text-[11px] text-gray-400 text-center">
          These are estimates only. Obtain 2–3 contractor quotes before committing.
          The 10% contingency covers unexpected costs.
        </p>
      )}
    </div>
  )
}
