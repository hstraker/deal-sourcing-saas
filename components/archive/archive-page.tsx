"use client"

import { useState } from "react"
import Link from "next/link"
import { ArchiveRestore, Trash2, Archive } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { toast } from "sonner"

function Tip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-[200px] text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ArchivedLead {
  id: string
  vendorName: string
  vendorPhone: string
  propertyAddress: string | null
  propertyPostcode: string | null
  offerAmount: number | null
  motivationScore: number | null
  archivedAt: string | Date
  dealId: string | null
  createdAt: string | Date
  validationPassed: boolean | null
  bmvScore: number | null
}

interface ArchivedDeal {
  id: string
  address: string
  postcode: string | null
  askingPrice: number
  status: string
  archivedAt: string | Date
  createdAt: string | Date
  bmvPercentage: number | null
  assignedTo: { firstName: string | null; lastName: string | null } | null
  vendorLead: { id: string; vendorName: string } | null
}

interface ArchivePageProps {
  leads: ArchivedLead[]
  deals: ArchivedDeal[]
}

function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatCurrency(value: number): string {
  return "£" + value.toLocaleString("en-GB", { maximumFractionDigits: 0 })
}

export function ArchivePage({ leads: initialLeads, deals: initialDeals }: ArchivePageProps) {
  const [activeTab, setActiveTab] = useState<"leads" | "deals">("leads")
  const [leads, setLeads] = useState<ArchivedLead[]>(initialLeads)
  const [deals, setDeals] = useState<ArchivedDeal[]>(initialDeals)
  const [notification, setNotification] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string;
    variant: "destructive" | "archive" | "warning" | "default";
    confirmLabel: string; onConfirm: () => void;
  }>({ open: false, title: "", description: "", variant: "default", confirmLabel: "Confirm", onConfirm: () => {} })

  function showNotification(message: string) {
    setNotification(message)
    setTimeout(() => setNotification(null), 2000)
  }

  async function handleRestoreLead(id: string) {
    await fetch(`/api/vendor-pipeline/leads/${id}/restore`, { method: "POST" })
    setLeads((prev) => prev.filter((l) => l.id !== id))
    showNotification("Lead restored successfully.")
  }

  async function handleDeleteLead(id: string) {
    setConfirmDialog({
      open: true,
      title: "Delete this lead permanently?",
      description: "This cannot be undone. The vendor lead and all associated data will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        try {
          await fetch(`/api/vendor-leads/${id}`, { method: "DELETE" })
          setLeads((prev) => prev.filter((l) => l.id !== id))
          showNotification("Lead permanently deleted.")
        } catch (err: any) {
          toast.error(err.message || "Failed to delete lead")
        }
      },
    })
  }

  async function handleRestoreDeal(id: string) {
    await fetch(`/api/deals/${id}/restore`, { method: "POST" })
    setDeals((prev) => prev.filter((d) => d.id !== id))
    showNotification("Deal restored successfully.")
  }

  async function handleDeleteDeal(id: string) {
    setConfirmDialog({
      open: true,
      title: "Delete this deal permanently?",
      description: "This cannot be undone. The deal and all associated data will be permanently removed.",
      variant: "destructive",
      confirmLabel: "Delete permanently",
      onConfirm: async () => {
        try {
          await fetch(`/api/deals/${id}`, { method: "DELETE" })
          setDeals((prev) => prev.filter((d) => d.id !== id))
          showNotification("Deal permanently deleted.")
        } catch (err: any) {
          toast.error(err.message || "Failed to delete deal")
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* Toast notification */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 rounded-md bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
          {notification}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("leads")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "leads"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Vendor Leads ({leads.length})
        </button>
        <button
          onClick={() => setActiveTab("deals")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "deals"
              ? "border-b-2 border-gray-900 text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          Deals ({deals.length})
        </button>
      </div>

      {/* Vendor Leads Tab */}
      {activeTab === "leads" && (
        <>
          {leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
              <Archive className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">No archived leads</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Vendor</th>
                    <th className="table-header">Property</th>
                    <th className="table-header">Offer</th>
                    <th className="table-header">
                      <Tip text="Below Market Value % at time of archiving">BMV %</Tip>
                    </th>
                    <th className="table-header">Validation</th>
                    <th className="table-header">
                      <Tip text="Date this item was archived. Items can be restored at any time">ARCHIVED</Tip>
                    </th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="table-cell truncate max-w-[200px]">
                        <div className="font-medium text-gray-900">{lead.vendorName}</div>
                        <div className="text-xs text-gray-400">{lead.vendorPhone}</div>
                      </td>
                      <td className="table-cell truncate max-w-[200px]">
                        <div className="text-gray-900">{lead.propertyAddress ?? "—"}</div>
                        <div className="text-xs text-gray-400">{lead.propertyPostcode ?? ""}</div>
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {lead.offerAmount != null ? formatCurrency(lead.offerAmount) : "—"}
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {lead.bmvScore != null ? `${lead.bmvScore}%` : "—"}
                      </td>
                      <td className="table-cell">
                        {lead.validationPassed === true ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 whitespace-nowrap">
                            Passed
                          </span>
                        ) : lead.validationPassed === false ? (
                          <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 whitespace-nowrap">
                            Failed
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                            —
                          </span>
                        )}
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {lead.archivedAt ? formatDate(lead.archivedAt) : "—"}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Tip text="Restore this item — it will reappear in the active Vendor Leads or Deals page">
                            <button
                              onClick={() => handleRestoreLead(lead.id)}
                              className="inline-flex items-center gap-1 rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                              Restore
                            </button>
                          </Tip>
                          <Tip text="Permanently delete — this cannot be undone. Use only for duplicates or test entries">
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </Tip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Deals Tab */}
      {activeTab === "deals" && (
        <>
          {deals.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
              <Archive className="mb-3 h-10 w-10 text-gray-300" />
              <p className="text-sm text-gray-400">No archived deals</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Property</th>
                    <th className="table-header">Asking Price</th>
                    <th className="table-header">
                      <Tip text="Below Market Value % at time of archiving">BMV %</Tip>
                    </th>
                    <th className="table-header">
                      <Tip text="Pipeline stage at time of archiving">STAGE</Tip>
                    </th>
                    <th className="table-header">Assigned To</th>
                    <th className="table-header">Source Lead</th>
                    <th className="table-header">
                      <Tip text="Date this item was archived. Items can be restored at any time">ARCHIVED</Tip>
                    </th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {deals.map((deal) => (
                    <tr key={deal.id} className="hover:bg-gray-50">
                      <td className="table-cell truncate max-w-[200px]">
                        <div className="font-medium text-gray-900">{deal.address}</div>
                        <div className="text-xs text-gray-400">{deal.postcode ?? ""}</div>
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {formatCurrency(deal.askingPrice)}
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {deal.bmvPercentage != null ? `${deal.bmvPercentage}%` : "—"}
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {deal.status ?? "—"}
                      </td>
                      <td className="table-cell">
                        {deal.assignedTo
                          ? `${deal.assignedTo.firstName ?? ""} ${deal.assignedTo.lastName ?? ""}`.trim() || "Unassigned"
                          : "Unassigned"}
                      </td>
                      <td className="table-cell">
                        {deal.vendorLead ? (
                          <Link
                            href={`/dashboard/vendors?lead=${deal.vendorLead.id}`}
                            className="text-blue-600 hover:underline"
                          >
                            {deal.vendorLead.vendorName}
                          </Link>
                        ) : (
                          <span className="text-gray-400">Manual</span>
                        )}
                      </td>
                      <td className="table-cell whitespace-nowrap">
                        {deal.archivedAt ? formatDate(deal.archivedAt) : "—"}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <Tip text="Restore this item — it will reappear in the active Vendor Leads or Deals page">
                            <button
                              onClick={() => handleRestoreDeal(deal.id)}
                              className="inline-flex items-center gap-1 rounded border border-green-300 px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors"
                            >
                              <ArchiveRestore className="h-3 w-3" />
                              Restore
                            </button>
                          </Tip>
                          <Tip text="Permanently delete — this cannot be undone. Use only for duplicates or test entries">
                            <button
                              onClick={() => handleDeleteDeal(deal.id)}
                              className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </Tip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
      />
    </div>
  )
}
