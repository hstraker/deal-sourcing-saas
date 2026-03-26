"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VendorValidationPanel } from "@/app/dashboard/vendors/[id]/validation/vendor-validation-panel"
import { Search, ClipboardCheck, Calculator, Loader2 } from "lucide-react"
import { formatCurrency } from "@/lib/format"
import { formatDistanceToNow } from "date-fns"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  bmvScore: number | null
  validationPassed: boolean | null
  validatedAt: string | null   // ISO string
  pipelineStage: string
  motivationScore: number | null
}

// ── Validation badge ──────────────────────────────────────────────────────────

function ValidationBadge({ passed }: { passed: boolean | null }) {
  if (passed === true) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-emerald-100 text-emerald-700 border-emerald-200 whitespace-nowrap">
        Passed
      </span>
    )
  }
  if (passed === false) {
    return (
      <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 border-red-200 whitespace-nowrap">
        Failed
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-500 border-gray-200 whitespace-nowrap">
      Pending
    </span>
  )
}

// ── Filter chips ──────────────────────────────────────────────────────────────

const STATUS_CHIPS = ["All", "Passed", "Failed", "Pending"] as const
type StatusChip = typeof STATUS_CHIPS[number]

// ── Component ─────────────────────────────────────────────────────────────────

export function ValidationListClient({ leads: initialLeads }: { leads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusChip>("All")
  const [calcingId, setCalcingId] = useState<string | null>(null)
  const [popupLeadId, setPopupLeadId] = useState<string | null>(null)
  const [popupLeadData, setPopupLeadData] = useState<any>(null)
  const [popupLoading, setPopupLoading] = useState(false)

  // ── Filter ─────────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return leads.filter((l) => {
      if (q) {
        const match =
          l.vendorName.toLowerCase().includes(q) ||
          (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
          (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
        if (!match) return false
      }
      switch (statusFilter) {
        case "Passed":  return l.validationPassed === true
        case "Failed":  return l.validationPassed === false
        case "Pending": return l.validationPassed === null
        default:        return true
      }
    })
  }, [leads, search, statusFilter])

  // ── Popup open ─────────────────────────────────────────────────────────────
  const handleOpenValidate = async (lead: Lead) => {
    setPopupLeadId(lead.id)
    setPopupLeadData(null)
    setPopupLoading(true)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}`)
      if (!res.ok) throw new Error(`Failed to load lead (${res.status})`)
      const data = await res.json()
      setPopupLeadData(data)
    } catch {
      toast.error("Failed to load lead data")
      setPopupLeadId(null)
    } finally {
      setPopupLoading(false)
    }
  }

  // ── Calc BMV ───────────────────────────────────────────────────────────────
  const handleCalcBMV = async (lead: Lead) => {
    setCalcingId(lead.id)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}/calculate-bmv`, {
        method: "POST",
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error ?? "Calculation failed")
      // Response shape: { success: true, data: { bmvScore, validationPassed, ... } }
      // validatedAt is NOT returned — synthesise it
      setLeads((prev) =>
        prev.map((l) =>
          l.id === lead.id
            ? {
                ...l,
                bmvScore:         data.data?.bmvScore ?? l.bmvScore,
                validationPassed: data.data?.validationPassed ?? l.validationPassed,
                validatedAt:      new Date().toISOString(),
              }
            : l
        )
      )
      toast.success("BMV calculated successfully")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setCalcingId(null)
    }
  }

  const popupMeta = popupLeadId ? leads.find((l) => l.id === popupLeadId) : null

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Validation</h1>
        <p className="text-sm text-gray-400 mt-1">
          Review and manage property deal validation for all vendor leads
        </p>
      </div>

      {/* Status filter chips */}
      <div className="flex flex-wrap gap-2">
        {STATUS_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setStatusFilter(chip)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              statusFilter === chip
                ? "bg-gray-900 border-gray-900 text-white"
                : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
            )}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} leads</span>
      </div>

      {/* Table */}
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-10 text-center">
          <p className="text-sm text-gray-400">No leads match your filters.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr>
                  <th className="table-header text-left">Vendor</th>
                  <th className="table-header text-left">Property</th>
                  <th className="table-header text-left whitespace-nowrap">Asking Price</th>
                  <th className="table-header text-left whitespace-nowrap">Market Value</th>
                  <th className="table-header text-left">BMV</th>
                  <th className="table-header text-left">Status</th>
                  <th className="table-header text-left whitespace-nowrap">Last Validated</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead) => (
                  <tr key={lead.id} className="table-row group">
                    {/* Vendor */}
                    <td className="table-cell">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600 text-xs font-semibold">
                          {lead.vendorName.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                      </div>
                    </td>

                    {/* Property */}
                    <td className="table-cell">
                      <p className="text-sm text-gray-700 line-clamp-1">
                        {lead.propertyAddress
                          ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                          : <span className="text-gray-400">—</span>}
                      </p>
                    </td>

                    {/* Asking Price */}
                    <td className="table-cell whitespace-nowrap">
                      <span className="text-sm font-semibold text-gray-900">
                        {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Market Value */}
                    <td className="table-cell whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {lead.estimatedMarketValue ? formatCurrency(lead.estimatedMarketValue) : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* BMV */}
                    <td className="table-cell whitespace-nowrap">
                      <span className="text-sm text-gray-700">
                        {lead.bmvScore != null ? `${lead.bmvScore}%` : <span className="text-gray-400">—</span>}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="table-cell">
                      <ValidationBadge passed={lead.validationPassed} />
                    </td>

                    {/* Last Validated */}
                    <td className="table-cell">
                      <span className="text-sm text-gray-500">
                        {lead.validatedAt
                          ? formatDistanceToNow(new Date(lead.validatedAt), { addSuffix: true })
                          : <span className="text-gray-400">Never</span>}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenValidate(lead)}
                          className="gap-1.5"
                        >
                          <ClipboardCheck className="h-3.5 w-3.5" />
                          Validate
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCalcBMV(lead)}
                          disabled={calcingId === lead.id}
                          className="gap-1.5"
                        >
                          {calcingId === lead.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Calculator className="h-3.5 w-3.5" />}
                          Calc BMV
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Validation popup */}
      <Dialog
        open={!!popupLeadId}
        onOpenChange={(open) => {
          if (!open) { setPopupLeadId(null); setPopupLeadData(null) }
        }}
      >
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Validation — {popupMeta?.propertyAddress ?? popupMeta?.vendorName}
            </DialogTitle>
          </DialogHeader>
          {popupLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}
          {!popupLoading && popupLeadData && (
            <VendorValidationPanel initialLead={popupLeadData as any} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
