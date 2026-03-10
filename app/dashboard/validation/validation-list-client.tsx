"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

type StatusFilter = "all" | "passed" | "failed" | "pending"
type SortField = "vendorName" | "validatedAt" | "bmvScore" | "askingPrice" | "estimatedMarketValue"

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  bmvScore: number | null
  validationPassed: boolean | null
  validatedAt: string | null
  pipelineStage: string
  motivationScore: number | null
}

function StatusBadge({ passed }: { passed: boolean | null }) {
  if (passed === null)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-500">
        <Clock className="h-3 w-3" /> Pending
      </span>
    )
  if (passed)
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
        <CheckCircle2 className="h-3 w-3" /> Passed
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
      <XCircle className="h-3 w-3" /> Failed
    </span>
  )
}

export function ValidationListClient({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [sortField, setSortField] = useState<SortField>("validatedAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        l.vendorName.toLowerCase().includes(q) ||
        (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
        (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "passed" && l.validationPassed === true) ||
        (statusFilter === "failed" && l.validationPassed === false) ||
        (statusFilter === "pending" && l.validationPassed === null)
      return matchSearch && matchStatus
    })

    result.sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null
      if (sortField === "vendorName") { av = a.vendorName; bv = b.vendorName }
      else if (sortField === "validatedAt") { av = a.validatedAt; bv = b.validatedAt }
      else if (sortField === "bmvScore") { av = a.bmvScore; bv = b.bmvScore }
      else if (sortField === "askingPrice") { av = a.askingPrice; bv = b.askingPrice }
      else if (sortField === "estimatedMarketValue") { av = a.estimatedMarketValue; bv = b.estimatedMarketValue }

      if (av === null && bv === null) return 0
      if (av === null) return sortDir === "asc" ? 1 : -1
      if (bv === null) return sortDir === "asc" ? -1 : 1
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return result
  }, [leads, search, statusFilter, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const thCls = "px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none"

  const counts = useMemo(() => ({
    passed: leads.filter((l) => l.validationPassed === true).length,
    failed: leads.filter((l) => l.validationPassed === false).length,
    pending: leads.filter((l) => l.validationPassed === null).length,
  }), [leads])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Deal Validation</h1>
        <p className="text-sm text-gray-400 mt-1">Select a vendor lead to run or review BMV validation</p>
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Passed", count: counts.passed, colour: "bg-green-50 text-green-700 border-green-200", filter: "passed" as StatusFilter },
          { label: "Failed", count: counts.failed, colour: "bg-red-50 text-red-700 border-red-200", filter: "failed" as StatusFilter },
          { label: "Pending", count: counts.pending, colour: "bg-gray-100 text-gray-600 border-gray-200", filter: "pending" as StatusFilter },
        ].map((c) => (
          <button
            key={c.filter}
            onClick={() => setStatusFilter(statusFilter === c.filter ? "all" : c.filter)}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium transition-all",
              c.colour,
              statusFilter === c.filter ? "ring-2 ring-offset-1 ring-current" : "opacity-80 hover:opacity-100"
            )}
          >
            {c.label} <span className="font-bold">{c.count}</span>
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
      <div className="ds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="table-header">
                <th className={thCls} onClick={() => handleSort("vendorName")}>
                  <span className="flex items-center gap-1">Vendor <SortIcon field="vendorName" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                <th className={thCls} onClick={() => handleSort("askingPrice")}>
                  <span className="flex items-center gap-1">Asking Price <SortIcon field="askingPrice" /></span>
                </th>
                <th className={thCls} onClick={() => handleSort("estimatedMarketValue")}>
                  <span className="flex items-center gap-1">Market Value <SortIcon field="estimatedMarketValue" /></span>
                </th>
                <th className={thCls} onClick={() => handleSort("bmvScore")}>
                  <span className="flex items-center gap-1">BMV% <SortIcon field="bmvScore" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className={thCls} onClick={() => handleSort("validatedAt")}>
                  <span className="flex items-center gap-1">Validated <SortIcon field="validatedAt" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No leads match your filter</td>
                </tr>
              )}
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="table-row cursor-pointer hover:bg-blue-50/40 transition-colors"
                  onClick={() => router.push(`/dashboard/vendors/${lead.id}/validation`)}
                >
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold">
                        {lead.vendorName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                    </div>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-600 line-clamp-1">
                      {lead.propertyAddress
                        ? `${lead.propertyAddress}${lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}`
                        : <span className="text-gray-400">—</span>}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm font-medium text-gray-900">
                      {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                    </span>
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-700">
                      {lead.estimatedMarketValue ? formatCurrency(lead.estimatedMarketValue) : <span className="text-gray-400">—</span>}
                    </span>
                  </td>
                  <td className="table-cell">
                    {lead.bmvScore != null ? (
                      <span className={cn(
                        "text-sm font-semibold",
                        lead.bmvScore <= 75 ? "text-green-600" : lead.bmvScore <= 85 ? "text-amber-600" : "text-red-600"
                      )}>
                        {Math.round(lead.bmvScore)}%
                      </span>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </td>
                  <td className="table-cell">
                    <StatusBadge passed={lead.validationPassed} />
                  </td>
                  <td className="table-cell">
                    <span className="text-sm text-gray-500">
                      {lead.validatedAt
                        ? new Date(lead.validatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-gray-400">—</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
