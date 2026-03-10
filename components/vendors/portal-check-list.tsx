"use client"

import { useState } from "react"
import type { VendorLead } from "./vendor-lead-detail-modal"
import { PortalCheckDetailPanel } from "./portal-check-detail-panel"
import { PortalCheckBadge } from "./portal-check-badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { formatDistanceToNow } from "date-fns"
import { ShieldCheck, Eye } from "lucide-react"

const RISK_ORDER: Record<string, number> = {
  red_flag: 0,
  caution: 1,
  clear: 2,
  pending: 3,
  running: 3,
}

function riskSortValue(risk: string | null): number {
  if (!risk) return 4
  return RISK_ORDER[risk] ?? 4
}

interface PortalCheckListProps {
  leads: VendorLead[]
}

export function PortalCheckList({ leads }: PortalCheckListProps) {
  const [selectedLead, setSelectedLead] = useState<VendorLead | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const sorted = [...leads].sort(
    (a, b) =>
      riskSortValue(a.latestCheckRisk ?? null) -
      riskSortValue(b.latestCheckRisk ?? null)
  )

  const handleView = (lead: VendorLead) => {
    setSelectedLead(lead)
    setModalOpen(true)
  }

  return (
    <>
      {leads.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-gray-300 mb-3" />
          <p className="text-sm text-gray-400">No vendor leads found.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Address
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Stage
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Last Checked
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((lead) => (
                <tr
                  key={lead.id}
                  className="bg-white hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                    {lead.propertyAddress || "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 capitalize">
                    {lead.pipelineStage?.toLowerCase().replace(/_/g, " ") || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <PortalCheckBadge
                      risk={lead.latestCheckRisk as any}
                      isMockData={lead.isTest}
                    />
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {lead.latestCheckedAt
                      ? formatDistanceToNow(new Date(lead.latestCheckedAt as any), {
                          addSuffix: true,
                        })
                      : "Never"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleView(lead)}
                      className="gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-400" />
              Portal Check
            </DialogTitle>
            {selectedLead && (
              <p className="text-sm text-gray-500 font-normal mt-0.5">
                {selectedLead.propertyAddress || "Unknown address"}
              </p>
            )}
          </DialogHeader>

          {selectedLead && (
            <PortalCheckDetailPanel
              leadId={selectedLead.id}
              latestCheckRisk={selectedLead.latestCheckRisk ?? null}
              latestCheckedAt={
                selectedLead.latestCheckedAt
                  ? new Date(selectedLead.latestCheckedAt as any).toISOString()
                  : null
              }
              onRiskUpdated={() => {
                // Refresh will happen on next page load; close is enough for now
                setModalOpen(false)
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
