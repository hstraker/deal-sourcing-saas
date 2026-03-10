"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Search, BarChart3 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { formatCurrency } from "@/lib/format"

interface Lead {
  id: string
  vendorName: string
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyType: string | null
  bedrooms: number | null
  askingPrice: number | null
  estimatedMarketValue: number | null
  pipelineStage: string
}

export function ComparablesListClient({ leads }: { leads: Lead[] }) {
  const router = useRouter()
  const [search, setSearch] = useState("")

  const filtered = useMemo(() => {
    if (!search) return leads
    const q = search.toLowerCase()
    return leads.filter(
      (l) =>
        l.vendorName.toLowerCase().includes(q) ||
        (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
        (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
    )
  }, [leads, search])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Comparables</h1>
        <p className="text-sm text-gray-400 mt-1">Select a vendor lead to view or fetch comparable properties</p>
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
          <table className="w-full min-w-[600px]">
            <thead>
              <tr className="table-header">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Property</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asking Price</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Market Value</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-gray-400">No leads match your search</td>
                </tr>
              )}
              {filtered.map((lead) => (
                <tr
                  key={lead.id}
                  className="table-row cursor-pointer hover:bg-blue-50/40 transition-colors"
                  onClick={() => router.push(`/dashboard/vendors/${lead.id}/comparables`)}
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
                    <span className="text-sm text-gray-600">{lead.propertyType ?? <span className="text-gray-400">—</span>}</span>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
