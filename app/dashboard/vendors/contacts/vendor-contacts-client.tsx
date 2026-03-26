"use client"

import { useState, useMemo } from "react"
import { Phone, Mail, MapPin, Search, Building2, ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: "New Lead",
  AI_CONVERSATION: "AI Conversation",
  DEAL_VALIDATION: "Deal Validation",
  OFFER_MADE: "Offer Sent",
  VIDEO_SENT: "Video Sent",
  RETRY_1: "Follow-up 1",
  RETRY_2: "Follow-up 2",
  RETRY_3: "Follow-up 3",
  OFFER_ACCEPTED: "Offer Accepted",
  OFFER_REJECTED: "Offer Rejected",
  PAPERWORK_SENT: "Paperwork Sent",
  READY_FOR_INVESTORS: "Ready for Investors",
  DEAD_LEAD: "Dead Lead",
  INITIAL_CONTACT: "Initial Contact",
  VALUATION_PENDING: "Valuation Pending",
}

const STAGE_COLOURS: Record<string, string> = {
  NEW_LEAD: "bg-blue-50 text-blue-700",
  AI_CONVERSATION: "bg-indigo-50 text-indigo-700",
  DEAL_VALIDATION: "bg-yellow-50 text-yellow-700",
  OFFER_MADE: "bg-orange-50 text-orange-700",
  OFFER_ACCEPTED: "bg-green-50 text-green-700",
  OFFER_REJECTED: "bg-red-50 text-red-700",
  READY_FOR_INVESTORS: "bg-purple-50 text-purple-700",
  DEAD_LEAD: "bg-gray-100 text-gray-400",
}

type SortField = "vendorName" | "pipelineStage" | "askingPrice" | "createdAt" | "lastContactAt"

interface Lead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  pipelineStage: string
  motivationScore: number | null
  lastContactAt: string | null
  createdAt: string
}

interface Props {
  leads: Lead[]
}

export function VendorContactsClient({ leads }: Props) {
  const [search, setSearch] = useState("")
  const [sortField, setSortField] = useState<SortField>("createdAt")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")
  const [stageFilter, setStageFilter] = useState<string>("all")

  const stages = useMemo(() => {
    const set = new Set(leads.map((l) => l.pipelineStage))
    return Array.from(set).sort()
  }, [leads])

  const filtered = useMemo(() => {
    let result = leads.filter((l) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        l.vendorName.toLowerCase().includes(q) ||
        l.vendorPhone.includes(q) ||
        (l.vendorEmail?.toLowerCase().includes(q) ?? false) ||
        (l.propertyAddress?.toLowerCase().includes(q) ?? false) ||
        (l.propertyPostcode?.toLowerCase().includes(q) ?? false)
      const matchStage = stageFilter === "all" || l.pipelineStage === stageFilter
      return matchSearch && matchStage
    })

    result.sort((a, b) => {
      let av: string | number | null = null
      let bv: string | number | null = null
      if (sortField === "vendorName") { av = a.vendorName; bv = b.vendorName }
      else if (sortField === "pipelineStage") { av = a.pipelineStage; bv = b.pipelineStage }
      else if (sortField === "askingPrice") { av = a.askingPrice; bv = b.askingPrice }
      else if (sortField === "createdAt") { av = a.createdAt; bv = b.createdAt }
      else if (sortField === "lastContactAt") { av = a.lastContactAt; bv = b.lastContactAt }

      if (av === null && bv === null) return 0
      if (av === null) return sortDir === "asc" ? 1 : -1
      if (bv === null) return sortDir === "asc" ? -1 : 1
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return result
  }, [leads, search, stageFilter, sortField, sortDir])

  const handleSort = (field: SortField) => {
    if (field === sortField) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortField(field); setSortDir("asc") }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
  }

  const thCls = "table-header text-left cursor-pointer hover:text-gray-900 select-none"

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vendor Contacts</h1>
        <p className="text-sm text-gray-400 mt-1">
          Contact details for all {leads.length} vendor leads
        </p>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, phone, email, address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="rounded-md border border-[var(--ds-border)] bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
        >
          <option value="all">All stages</option>
          {stages.map((s) => (
            <option key={s} value={s}>{STAGE_LABELS[s] ?? s}</option>
          ))}
        </select>
        <span className="text-sm text-gray-400 ml-auto">{filtered.length} contacts</span>
      </div>

      {/* Table */}
      <div className="ds-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="table-header">
                <th className={thCls} onClick={() => handleSort("vendorName")}>
                  <span className="flex items-center gap-1">Name <SortIcon field="vendorName" /></span>
                </th>
                <th className="table-header text-left">Contact</th>
                <th className="table-header text-left">Property</th>
                <th className={thCls} onClick={() => handleSort("askingPrice")}>
                  <span className="flex items-center gap-1">Asking Price <SortIcon field="askingPrice" /></span>
                </th>
                <th className={thCls} onClick={() => handleSort("pipelineStage")}>
                  <span className="flex items-center gap-1">Stage <SortIcon field="pipelineStage" /></span>
                </th>
                <th className={thCls} onClick={() => handleSort("lastContactAt")}>
                  <span className="flex items-center gap-1">Last Contact <SortIcon field="lastContactAt" /></span>
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">
                    No contacts match your search
                  </td>
                </tr>
              )}
              {filtered.map((lead) => (
                <tr key={lead.id} className="table-row group">
                  {/* Name */}
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold">
                        {lead.vendorName.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900 text-sm">{lead.vendorName}</span>
                    </div>
                  </td>

                  {/* Contact */}
                  <td className="table-cell">
                    <div className="space-y-1">
                      <a
                        href={`tel:${lead.vendorPhone}`}
                        className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-[#2563EB] transition-colors"
                      >
                        <Phone className="h-3.5 w-3.5 text-gray-400" />
                        {lead.vendorPhone}
                      </a>
                      {lead.vendorEmail && (
                        <a
                          href={`mailto:${lead.vendorEmail}`}
                          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#2563EB] transition-colors"
                        >
                          <Mail className="h-3.5 w-3.5 text-gray-400" />
                          {lead.vendorEmail}
                        </a>
                      )}
                    </div>
                  </td>

                  {/* Property */}
                  <td className="table-cell">
                    <div className="space-y-0.5">
                      {lead.propertyAddress ? (
                        <div className="flex items-start gap-1.5 text-sm text-gray-700">
                          <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-2">{lead.propertyAddress}{lead.propertyPostcode ? `, ${lead.propertyPostcode}` : ""}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">—</span>
                      )}
                      {(lead.propertyType || lead.bedrooms) && (
                        <div className="flex items-center gap-2 text-xs text-gray-400 pl-5">
                          {lead.propertyType && <span>{lead.propertyType}</span>}
                          {lead.bedrooms && <span>{lead.bedrooms} bed</span>}
                          {lead.bathrooms && <span>{lead.bathrooms} bath</span>}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Asking Price */}
                  <td className="table-cell">
                    <span className="text-sm font-medium text-gray-900">
                      {lead.askingPrice ? formatCurrency(lead.askingPrice) : <span className="text-gray-400">—</span>}
                    </span>
                  </td>

                  {/* Stage */}
                  <td className="table-cell">
                    <span className={cn(
                      "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                      STAGE_COLOURS[lead.pipelineStage] ?? "bg-gray-100 text-gray-600"
                    )}>
                      {STAGE_LABELS[lead.pipelineStage] ?? lead.pipelineStage}
                    </span>
                  </td>

                  {/* Last Contact */}
                  <td className="table-cell">
                    <span className="text-sm text-gray-500">
                      {lead.lastContactAt
                        ? new Date(lead.lastContactAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
                        : <span className="text-gray-400">Never</span>}
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
