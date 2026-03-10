"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  TrendingUp,
  Loader2,
  Edit,
  Save,
  X,
  CheckCircle2,
  XCircle,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  estimatedRefurbCost: number | null
  estimatedMonthlyRent: number | null
  estimatedAnnualRent: number | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  condition: string | null
  motivationScore: number | null
  urgencyLevel: string | null
  bmvScore: number | null
  profitPotential: number | null
  validationPassed: boolean | null
  validationNotes: string | null
  validatedAt: string | null
}

interface EditForm {
  estimatedMarketValue: string
  estimatedRefurbCost: string
  estimatedMonthlyRent: string
  estimatedAnnualRent: string
  condition: string
  motivationScore: string
  urgencyLevel: string
}

const numericFields = [
  "estimatedMarketValue",
  "estimatedRefurbCost",
  "estimatedMonthlyRent",
  "estimatedAnnualRent",
  "motivationScore",
]

// ── Parsed notes types ────────────────────────────────────────────────────────

interface Comparable {
  address: string
  price: number
  beds: number
  date: string
  distance: string
}

interface ParsedNotes {
  comparables: Comparable[]
  marketValueSource: { source: string; confidence: string; count?: number } | null
  rentalYield: {
    passed?: boolean
    monthlyRent?: number
    grossYield?: number
    grossYieldRating?: string
    netYield?: number
    cashflow?: number
    dataSource?: string
    confidence?: string
  } | null
  failureReasons: string[]
}

function parseNotes(notes: string | null): ParsedNotes | null {
  if (!notes) return null

  const comparables: Comparable[] = []
  const lines = notes.split("\n")
  for (let i = 0; i < lines.length; i++) {
    const propMatch = lines[i].match(/^\s+(\d+)\.\s+(.+)$/)
    if (propMatch && i + 1 < lines.length) {
      const detailMatch = lines[i + 1].match(/💷 £([\d,]+) \| 🛏️ (\d+) bed \| 📅 (.+?) \| ([\d.]+) mi/)
      if (detailMatch) {
        comparables.push({
          address: propMatch[2].trim(),
          price: parseInt(detailMatch[1].replace(/,/g, "")),
          beds: parseInt(detailMatch[2]),
          date: detailMatch[3],
          distance: detailMatch[4] + " mi",
        })
      }
    }
  }

  let marketValueSource: ParsedNotes["marketValueSource"] = null
  const mvIdx = notes.indexOf("📊 MARKET VALUE ANALYSIS")
  if (mvIdx !== -1) {
    const mvSlice = notes.slice(mvIdx, mvIdx + 400)
    const sourceMatch = mvSlice.match(/Data Source: (.+)/)
    const confMatch = mvSlice.match(/Confidence: (\w+)/)
    const countMatch = mvSlice.match(/\((\d+) properties\)/)
    marketValueSource = {
      source: sourceMatch ? sourceMatch[1].trim() : "Unknown",
      confidence: confMatch ? confMatch[1].trim() : "",
      count: countMatch ? parseInt(countMatch[1]) : undefined,
    }
  }

  let rentalYield: ParsedNotes["rentalYield"] = null
  const yieldIdx = notes.indexOf("🏠 RENTAL YIELD ANALYSIS")
  if (yieldIdx !== -1) {
    const yieldSlice = notes.slice(yieldIdx)
    const monthlyMatch = yieldSlice.match(/Monthly Rent: £([\d,]+)/)
    const grossMatch = yieldSlice.match(/Gross Yield: ([\d.]+)%\s*\((.+?)\)/)
    const netMatch = yieldSlice.match(/Net Yield: ([\d.]+)%/)
    const cashFlowMatch = yieldSlice.match(/Monthly Cash Flow: £([\d,]+)/)
    const sourceMatch = yieldSlice.match(/Data Source: (.+)/)
    const confMatch = yieldSlice.match(/Confidence: (\w+)/)
    rentalYield = {
      passed: yieldSlice.includes("✅"),
      monthlyRent: monthlyMatch ? parseInt(monthlyMatch[1].replace(/,/g, "")) : undefined,
      grossYield: grossMatch ? parseFloat(grossMatch[1]) : undefined,
      grossYieldRating: grossMatch ? grossMatch[2] : undefined,
      netYield: netMatch ? parseFloat(netMatch[1]) : undefined,
      cashflow: cashFlowMatch ? parseInt(cashFlowMatch[1].replace(/,/g, "")) : undefined,
      dataSource: sourceMatch ? sourceMatch[1].trim() : undefined,
      confidence: confMatch ? confMatch[1].trim() : undefined,
    }
  }

  const failureReasons: string[] = []
  const frIdx = notes.indexOf("❌ FAILURE REASONS")
  if (frIdx !== -1) {
    const frSlice = notes.slice(frIdx, frIdx + 600)
    const matches = frSlice.match(/- (.+)/g)
    if (matches) failureReasons.push(...matches.map((m) => m.replace(/^- /, "")))
  }

  return { comparables, marketValueSource, rentalYield, failureReasons }
}

// ── Main component ────────────────────────────────────────────────────────────

export function VendorValidationPanel({ initialLead }: { initialLead: Lead }) {
  const [lead, setLead] = useState<Lead>(initialLead)
  const [isEditing, setIsEditing] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    estimatedMarketValue: initialLead.estimatedMarketValue?.toString() ?? "",
    estimatedRefurbCost: initialLead.estimatedRefurbCost?.toString() ?? "",
    estimatedMonthlyRent: initialLead.estimatedMonthlyRent?.toString() ?? "",
    estimatedAnnualRent: initialLead.estimatedAnnualRent?.toString() ?? "",
    condition: initialLead.condition ?? "",
    motivationScore: initialLead.motivationScore?.toString() ?? "",
    urgencyLevel: initialLead.urgencyLevel ?? "",
  })

  const parsedNotes = parseNotes(lead.validationNotes)

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const dataToSave = Object.entries(editForm).reduce((acc, [key, value]) => {
        if (value === "") { acc[key] = null }
        else if (numericFields.includes(key)) { acc[key] = value ? Number(value) : null }
        else { acc[key] = value }
        return acc
      }, {} as Record<string, unknown>)

      const res = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Save failed")

      const updated = await res.json()
      setLead((prev) => ({
        ...prev,
        estimatedMarketValue: updated.estimatedMarketValue ? Number(updated.estimatedMarketValue) : null,
        estimatedRefurbCost: updated.estimatedRefurbCost ? Number(updated.estimatedRefurbCost) : null,
        estimatedMonthlyRent: updated.estimatedMonthlyRent ? Number(updated.estimatedMonthlyRent) : null,
        estimatedAnnualRent: updated.estimatedAnnualRent ? Number(updated.estimatedAnnualRent) : null,
        condition: updated.condition,
        motivationScore: updated.motivationScore,
        urgencyLevel: updated.urgencyLevel,
      }))
      setIsEditing(false)
      toast.success("Lead updated")
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCalculateBMV = async () => {
    if (!lead.askingPrice) {
      toast.error("Please add an asking price before calculating BMV")
      return
    }
    setIsCalculating(true)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, { method: "POST" })
      if (!res.ok) throw new Error((await res.json()).error || "BMV calculation failed")
      const result = await res.json()

      // Refresh lead
      const freshRes = await fetch(`/api/vendor-leads/${lead.id}`)
      if (freshRes.ok) {
        const fresh = await freshRes.json()
        setLead((prev) => ({
          ...prev,
          bmvScore: fresh.bmvScore ? Number(fresh.bmvScore) : null,
          profitPotential: fresh.profitPotential ? Number(fresh.profitPotential) : null,
          estimatedMarketValue: fresh.estimatedMarketValue ? Number(fresh.estimatedMarketValue) : null,
          validationPassed: fresh.validationPassed,
          validationNotes: fresh.validationNotes,
          validatedAt: fresh.validatedAt,
        }))
        setEditForm((f) => ({
          ...f,
          estimatedMarketValue: fresh.estimatedMarketValue ? String(Number(fresh.estimatedMarketValue)) : f.estimatedMarketValue,
        }))
      }

      if (result.data?.validationPassed) {
        toast.success(`Deal validated! ${Number(result.data.bmvScore).toFixed(1)}% BMV with £${Number(result.data.profitPotential).toLocaleString()} profit`)
      } else {
        toast.warning("Deal calculated but failed validation criteria")
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "BMV calculation failed")
    } finally {
      setIsCalculating(false)
    }
  }

  const pct = lead.bmvScore != null ? Math.round(lead.bmvScore) : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard/validation" className="hover:text-gray-700 transition-colors flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" />
          Validation
        </Link>
        <span>/</span>
        <span className="text-gray-700">{lead.vendorName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{lead.vendorName}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {lead.propertyAddress ?? "No address"}
            {lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}
          </p>
          {lead.validatedAt && (
            <p className="text-xs text-gray-400 mt-1">
              Validated {new Date(lead.validatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {lead.validationPassed != null && (
            lead.validationPassed ? (
              <Badge className="bg-green-100 text-green-800 border-green-300 gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Passed
              </Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 border-red-300 gap-1">
                <XCircle className="h-3.5 w-3.5" /> Failed
              </Badge>
            )
          )}
        </div>
      </div>

      {/* BMV Analysis card */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">BMV Analysis</h2>
            {parsedNotes?.marketValueSource && (
              <p className="text-xs text-gray-400 mt-0.5">
                Source: {parsedNotes.marketValueSource.source} · {parsedNotes.marketValueSource.confidence} confidence
                {parsedNotes.marketValueSource.count && ` · ${parsedNotes.marketValueSource.count} properties`}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={isSaving} className="btn-primary">
                  {isSaving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
                  <Edit className="h-4 w-4 mr-1" /> Edit
                </Button>
                <Button
                  size="sm"
                  onClick={handleCalculateBMV}
                  disabled={isCalculating || !lead.askingPrice}
                  variant="outline"
                >
                  {isCalculating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <TrendingUp className="h-4 w-4 mr-1" />}
                  {isCalculating ? "Calculating…" : "Calculate BMV"}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-2 gap-px bg-[var(--ds-border)] sm:grid-cols-4">
          {[
            { label: "Asking Price", value: lead.askingPrice ? formatCurrency(lead.askingPrice) : "—" },
            { label: "Market Value", value: lead.estimatedMarketValue ? formatCurrency(lead.estimatedMarketValue) : "—" },
            { label: "Refurb Cost", value: lead.estimatedRefurbCost ? formatCurrency(lead.estimatedRefurbCost) : "—" },
            {
              label: "BMV",
              value: pct != null ? `${pct}%` : "—",
              colour: pct != null ? (pct <= 75 ? "text-green-600" : pct <= 85 ? "text-amber-600" : "text-red-600") : "text-gray-400",
            },
          ].map((m) => (
            <div key={m.label} className="bg-white p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">{m.label}</p>
              <p className={cn("text-xl font-bold", m.colour ?? "text-gray-900")}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Edit form */}
        {isEditing && (
          <div className="p-5 border-t border-[var(--ds-border)] grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <Label htmlFor="estimatedMarketValue">Market Value (£)</Label>
              <Input
                id="estimatedMarketValue"
                type="number"
                value={editForm.estimatedMarketValue}
                onChange={(e) => setEditForm({ ...editForm, estimatedMarketValue: e.target.value })}
                placeholder="Auto-estimated if blank"
              />
            </div>
            <div>
              <Label htmlFor="estimatedRefurbCost">Refurb Cost (£)</Label>
              <Input
                id="estimatedRefurbCost"
                type="number"
                value={editForm.estimatedRefurbCost}
                onChange={(e) => setEditForm({ ...editForm, estimatedRefurbCost: e.target.value })}
                placeholder="0"
              />
            </div>
            <div>
              <Label htmlFor="estimatedMonthlyRent">Monthly Rent (£)</Label>
              <Input
                id="estimatedMonthlyRent"
                type="number"
                value={editForm.estimatedMonthlyRent}
                onChange={(e) => setEditForm({ ...editForm, estimatedMonthlyRent: e.target.value })}
                placeholder="Auto-estimated if blank"
              />
            </div>
            <div>
              <Label htmlFor="condition">Condition</Label>
              <select
                id="condition"
                value={editForm.condition}
                onChange={(e) => setEditForm({ ...editForm, condition: e.target.value })}
                className="w-full rounded-md border border-[var(--ds-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {["POOR", "FAIR", "GOOD", "EXCELLENT"].map((v) => (
                  <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="motivationScore">Motivation Score (1-10)</Label>
              <Input
                id="motivationScore"
                type="number"
                min={1}
                max={10}
                value={editForm.motivationScore}
                onChange={(e) => setEditForm({ ...editForm, motivationScore: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="urgencyLevel">Urgency Level</Label>
              <select
                id="urgencyLevel"
                value={editForm.urgencyLevel}
                onChange={(e) => setEditForm({ ...editForm, urgencyLevel: e.target.value })}
                className="w-full rounded-md border border-[var(--ds-border)] bg-white px-3 py-2 text-sm"
              >
                <option value="">Select…</option>
                {["LOW", "MEDIUM", "HIGH", "URGENT"].map((v) => (
                  <option key={v} value={v}>{v.charAt(0) + v.slice(1).toLowerCase()}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Rental yield card */}
      {parsedNotes?.rentalYield && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h2 className="text-sm font-semibold text-gray-900">Rental Yield Analysis</h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[var(--ds-border)] sm:grid-cols-4">
            {[
              { label: "Monthly Rent", value: parsedNotes.rentalYield.monthlyRent ? `£${parsedNotes.rentalYield.monthlyRent.toLocaleString()}` : "—" },
              { label: "Gross Yield", value: parsedNotes.rentalYield.grossYield ? `${parsedNotes.rentalYield.grossYield}%` : "—" },
              { label: "Net Yield", value: parsedNotes.rentalYield.netYield ? `${parsedNotes.rentalYield.netYield}%` : "—" },
              { label: "Monthly Cash Flow", value: parsedNotes.rentalYield.cashflow ? `£${parsedNotes.rentalYield.cashflow.toLocaleString()}` : "—" },
            ].map((m) => (
              <div key={m.label} className="bg-white p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1">{m.label}</p>
                <p className="text-xl font-bold text-gray-900">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comparables */}
      {parsedNotes?.comparables && parsedNotes.comparables.length > 0 && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h2 className="text-sm font-semibold text-gray-900">
              Comparable Properties
              <span className="ml-2 text-xs font-normal text-gray-400">({parsedNotes.comparables.length} found)</span>
            </h2>
          </div>
          <div className="divide-y divide-[var(--ds-border)]">
            {parsedNotes.comparables.map((comp, i) => (
              <div key={i} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">{comp.address}</p>
                  <p className="text-xs text-gray-400">{comp.beds} bed · {comp.date} · {comp.distance}</p>
                </div>
                <span className="text-sm font-semibold text-gray-900 flex-shrink-0">
                  £{comp.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failure reasons */}
      {parsedNotes?.failureReasons && parsedNotes.failureReasons.length > 0 && (
        <div className="ds-card overflow-hidden border-red-200">
          <div className="px-5 py-4 border-b border-red-200 bg-red-50">
            <h2 className="text-sm font-semibold text-red-900">Failure Reasons</h2>
          </div>
          <ul className="p-5 space-y-2">
            {parsedNotes.failureReasons.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Raw notes fallback */}
      {lead.validationNotes && !parsedNotes && (
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#2563EB]" /> Validation Notes
            </h2>
          </div>
          <div className="p-5">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans">{lead.validationNotes}</pre>
          </div>
        </div>
      )}

      {!lead.validationNotes && (
        <div className="ds-card p-8 text-center">
          <TrendingUp className="h-10 w-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600 mb-1">No validation run yet</p>
          <p className="text-xs text-gray-400 mb-4">Click Calculate BMV above to validate this deal</p>
        </div>
      )}
    </div>
  )
}
