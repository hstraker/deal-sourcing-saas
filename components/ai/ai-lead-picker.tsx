"use client"

/**
 * AILeadPicker
 *
 * Shared lead-picker component used by all AI hub pages.
 * Renders a searchable, paginated list of recent vendor leads.
 * When the user selects a lead, `onSelect(lead)` is called.
 */

import { useState, useEffect, useCallback } from "react"
import { Search, Loader2, ChevronRight } from "lucide-react"
import { FunnelIcon } from "@heroicons/react/24/outline"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export interface LeadSummary {
  id: string
  propertyAddress: string | null
  propertyPostcode: string | null
  vendorName: string
  askingPrice: number | null
  pipelineStage: string
  latestCheckRisk: string | null
  floodRiskZone: string | null
  tenureType: string | null
  epcRating: string | null
  bedrooms: number | null
  createdAt: string
}

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD:        "New Lead",
  VALIDATED:       "Validated",
  AI_CONVERSATION: "In Conversation",
  OFFER_MADE:      "Offer Made",
  OFFER_ACCEPTED:  "Offer Accepted",
  OFFER_REJECTED:  "Offer Rejected",
  RETRY_1:         "Retry 1",
  RETRY_2:         "Retry 2",
  RETRY_3:         "Retry 3",
  COMPLETED:       "Completed",
}

const RISK_DOT: Record<string, string> = {
  clear:    "bg-green-400",
  caution:  "bg-amber-400",
  red_flag: "bg-red-500",
}

interface Props {
  onSelect: (lead: LeadSummary) => void
  selectedId?: string | null
  label?: string
  description?: string
}

export function AILeadPicker({ onSelect, selectedId, label = "Select a lead", description }: Props) {
  const [leads, setLeads]     = useState<LeadSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState("")
  const [debounced, setDebounced] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300)
    return () => clearTimeout(t)
  }, [search])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/vendor-pipeline/leads?limit=100`)
      if (!res.ok) throw new Error("Failed")
      const data = await res.json()
      setLeads(data.leads ?? [])
    } catch {
      setLeads([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Client-side filtering
  const filtered = debounced
    ? leads.filter(l =>
        [l.propertyAddress, l.propertyPostcode, l.vendorName]
          .some(v => v?.toLowerCase().includes(debounced.toLowerCase()))
      )
    : leads

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <FunnelIcon className="h-4 w-4 text-[#2563EB]" />
          <h3 className="text-sm font-semibold text-gray-900">{label}</h3>
        </div>
        {description && <p className="text-xs text-gray-500 mb-3">{description}</p>}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search address, postcode, or vendor name…"
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* Lead list */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading leads…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <p className="text-sm">No leads found</p>
          </div>
        ) : (
          filtered.map(lead => (
            <button
              key={lead.id}
              onClick={() => onSelect(lead)}
              className={cn(
                "w-full text-left px-4 py-3 hover:bg-blue-50/60 transition-colors flex items-center gap-3 group",
                selectedId === lead.id && "bg-blue-50 border-l-2 border-[#2563EB]"
              )}
            >
              {/* Risk dot */}
              {lead.latestCheckRisk && (
                <span className={cn("h-2 w-2 rounded-full shrink-0", RISK_DOT[lead.latestCheckRisk] ?? "bg-gray-300")} />
              )}

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {lead.propertyAddress ?? lead.propertyPostcode ?? "Address unknown"}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-gray-400">{STAGE_LABELS[lead.pipelineStage] ?? lead.pipelineStage}</span>
                  {lead.bedrooms && <span className="text-xs text-gray-400">· {lead.bedrooms} bed</span>}
                  {lead.tenureType && <span className="text-xs text-gray-400">· {lead.tenureType}</span>}
                  {lead.epcRating && <span className="text-xs text-gray-400">· EPC {lead.epcRating}</span>}
                </div>
              </div>

              {/* Price */}
              {lead.askingPrice && (
                <span className="text-xs font-semibold text-gray-700 shrink-0">
                  £{Number(lead.askingPrice).toLocaleString("en-GB")}
                </span>
              )}

              <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#2563EB] shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  )
}
