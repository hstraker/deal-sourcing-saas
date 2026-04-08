"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog"
import { ContactDetailModal } from "@/components/contacts/contact-detail-modal"
import { VendorLeadDetailModal } from "@/components/vendors/vendor-lead-detail-modal"
import { PageHeader } from "@/components/ui/page-header"
import type { ContactWithCounts } from "@/types/contacts"
import type { VendorLead } from "@/components/vendors/vendor-lead-detail-modal"
import {
  Plus, Search, Phone, Mail, Building2, MapPin,
  Pencil, Trash2, Eye, AlertTriangle, Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// ── Constants ─────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD:             "New Lead",
  AI_CONVERSATION:      "AI Conversation",
  DEAL_VALIDATION:      "Deal Validation",
  OFFER_MADE:           "Offer Sent",
  VIDEO_SENT:           "Video Sent",
  RETRY_1:              "Follow-up 1",
  RETRY_2:              "Follow-up 2",
  RETRY_3:              "Follow-up 3",
  OFFER_ACCEPTED:       "Offer Accepted",
  OFFER_REJECTED:       "Offer Rejected",
  PAPERWORK_SENT:       "Paperwork Sent",
  READY_FOR_INVESTORS:  "Ready for Investors",
  DEAD_LEAD:            "Dead Lead",
  INITIAL_CONTACT:      "Initial Contact",
  VALUATION_PENDING:    "Valuation Pending",
}

const TYPE_COLORS: Record<string, string> = {
  SOLICITOR:        "bg-blue-100   text-blue-700   border-blue-200",
  INVESTOR_CONTACT: "bg-purple-100 text-purple-700 border-purple-200",
  VENDOR_CONTACT:   "bg-orange-100 text-orange-700 border-orange-200",
  ESTATE_AGENT:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONTRACTOR:       "bg-amber-100  text-amber-700  border-amber-200",
  OTHER:            "bg-slate-100  text-slate-600  border-slate-200",
  VENDOR:           "bg-sky-100    text-sky-700    border-sky-200",
}

const TYPE_LABELS: Record<string, string> = {
  SOLICITOR:        "Solicitor",
  INVESTOR_CONTACT: "Investor Contact",
  VENDOR_CONTACT:   "Vendor Contact",
  ESTATE_AGENT:     "Estate Agent",
  CONTRACTOR:       "Contractor",
  OTHER:            "Other",
  VENDOR:           "Vendor Lead",
}

const CHIPS = [
  { key: "ALL",              label: "All"               },
  { key: "VENDOR",           label: "Vendor Leads"      },
  { key: "SOLICITOR",        label: "Solicitors"        },
  { key: "ESTATE_AGENT",     label: "Estate Agents"     },
  { key: "INVESTOR_CONTACT", label: "Investor Contacts" },
  { key: "CONTRACTOR",       label: "Contractors"       },
  { key: "OTHER",            label: "Other"             },
]

// ── Unified row type ──────────────────────────────────────────────────────────

interface UnifiedRow {
  id: string
  kind: "contact" | "vendor"
  name: string
  phone: string | null
  email: string | null
  typeKey: string
  associated: string | null
  stage: string | null
  lastContact: string | null
}

// ── Normalisers ───────────────────────────────────────────────────────────────

function normaliseContact(c: ContactWithCounts): UnifiedRow {
  const name =
    c.fullName ||
    [c.firstName, c.lastName].filter(Boolean).join(" ") ||
    "Unknown"
  return {
    id: c.id,
    kind: "contact",
    name,
    phone: c.phone ?? null,
    email: c.email ?? null,
    typeKey: c.type,
    associated: c.company ?? null,
    stage: null,
    lastContact: null,
  }
}

function normaliseVendor(v: VendorLead): UnifiedRow {
  return {
    id: v.id,
    kind: "vendor",
    name: v.vendorName,
    phone: v.vendorPhone,
    email: v.vendorEmail,
    typeKey: "VENDOR",
    associated: v.propertyAddress,
    stage: STAGE_LABELS[v.pipelineStage as string] ?? String(v.pipelineStage),
    lastContact: v.lastContactAt ? new Date(v.lastContactAt as any).toISOString() : null,
  }
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  initialContacts: ContactWithCounts[]
  vendorLeads: VendorLead[]
}

// ── Component ─────────────────────────────────────────────────────────────────

export function UnifiedContactsClient({ initialContacts, vendorLeads }: Props) {
  const [contacts, setContacts] = useState<ContactWithCounts[]>(initialContacts)
  const [chip, setChip] = useState("ALL")
  const [search, setSearch] = useState("")

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // Modal state
  const [selectedContact, setSelectedContact] = useState<ContactWithCounts | null>(null)
  const [selectedVendor, setSelectedVendor]   = useState<VendorLead | null>(null)
  const [newContactOpen, setNewContactOpen]   = useState(false)
  const [editingContact, setEditingContact]   = useState<ContactWithCounts | null>(null)

  // Delete state
  const [deleteTarget, setDeleteTarget]       = useState<UnifiedRow | null>(null)
  const [isDeleting, setIsDeleting]           = useState(false)
  const [isBulkDeleting, setIsBulkDeleting]   = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen]   = useState(false)

  // Normalise all rows
  const allRows = useMemo<UnifiedRow[]>(() => {
    const contactRows = contacts.map(normaliseContact)
    const vendorRows  = vendorLeads.map(normaliseVendor)
    return [...contactRows, ...vendorRows]
  }, [contacts, vendorLeads])

  // Chip counts
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allRows.length }
    for (const row of allRows) {
      counts[row.typeKey] = (counts[row.typeKey] ?? 0) + 1
    }
    return counts
  }, [allRows])

  // Filter + search
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return allRows.filter((row) => {
      if (chip !== "ALL" && row.typeKey !== chip) return false
      if (!q) return true
      return (
        row.name.toLowerCase().includes(q) ||
        row.phone?.toLowerCase().includes(q) ||
        row.email?.toLowerCase().includes(q) ||
        row.associated?.toLowerCase().includes(q)
      )
    })
  }, [allRows, chip, search])

  // Only contact-kind rows can be bulk deleted (vendor leads managed in their own page)
  const selectedContactIds = [...selected].filter((id) =>
    filtered.find((r) => r.id === id && r.kind === "contact")
  )
  const allContactsInView  = filtered.filter((r) => r.kind === "contact")
  const allFilteredSelected =
    allContactsInView.length > 0 &&
    allContactsInView.every((r) => selected.has(r.id))

  // ── Selection helpers ──────────────────────────────────────────────────────

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        allContactsInView.forEach((r) => next.delete(r.id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        allContactsInView.forEach((r) => next.add(r.id))
        return next
      })
    }
  }

  // ── CRUD handlers ──────────────────────────────────────────────────────────

  const handleContactSave = (saved: ContactWithCounts) => {
    setContacts((prev) => {
      const exists = prev.find((c) => c.id === saved.id)
      return exists
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...prev]
    })
    setNewContactOpen(false)
    setEditingContact(null)
  }

  const handleContactUpdated = (updated: ContactWithCounts) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setSelectedContact(updated)
  }

  const handleContactDeleted = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
    setSelectedContact(null)
  }

  // Single delete
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      const endpoint =
        deleteTarget.kind === "contact"
          ? `/api/contacts/${deleteTarget.id}`
          : `/api/vendor-pipeline/leads/${deleteTarget.id}`
      const res = await fetch(endpoint, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Delete failed")
      }
      if (deleteTarget.kind === "contact") {
        setContacts((prev) => prev.filter((c) => c.id !== deleteTarget.id))
      }
      setSelected((prev) => { const n = new Set(prev); n.delete(deleteTarget.id); return n })
      toast.success(`${deleteTarget.name} deleted`)
    } catch (err: any) {
      toast.error(err.message ?? "Failed to delete")
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Bulk delete (contacts only)
  const handleBulkDelete = async () => {
    setIsBulkDeleting(true)
    const ids = [...selectedContactIds]
    let deleted = 0
    for (const id of ids) {
      try {
        const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" })
        if (res.ok) {
          deleted++
          setContacts((prev) => prev.filter((c) => c.id !== id))
          setSelected((prev) => { const n = new Set(prev); n.delete(id); return n })
        }
      } catch {}
    }
    setIsBulkDeleting(false)
    setBulkDeleteOpen(false)
    toast.success(`${deleted} contact${deleted !== 1 ? "s" : ""} deleted`)
  }

  // Row click
  const handleRowClick = (row: UnifiedRow) => {
    if (row.kind === "contact") {
      const contact = contacts.find((c) => c.id === row.id)
      if (contact) setSelectedContact(contact)
    } else {
      const vendor = vendorLeads.find((v) => v.id === row.id)
      if (vendor) setSelectedVendor(vendor)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        subtitle={`${allRows.length} contacts — solicitors, estate agents, vendors and more`}
        actions={
          <Button
            size="sm"
            className="btn-primary h-9"
            onClick={() => { setEditingContact(null); setNewContactOpen(true) }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(({ key, label }) => {
          const count  = chipCounts[key] ?? 0
          const active = chip === key
          return (
            <button
              key={key}
              onClick={() => setChip(key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-all",
                active
                  ? "bg-gray-900 border-gray-900 text-white shadow-sm"
                  : "bg-white border-gray-200 text-gray-600 hover:border-gray-400 hover:text-gray-900"
              )}
            >
              {label}
              <span className={cn(
                "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search + bulk toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Bulk actions bar */}
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5">
            <span className="text-xs font-medium text-red-700">
              {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? "s" : ""} selected
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={() => setBulkDeleteOpen(true)}
              disabled={selectedContactIds.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              Delete selected
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No contacts match your search.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr>
                  {/* Select-all checkbox — only selects contacts, not vendor leads */}
                  <th className="table-header w-10 px-3">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                      checked={allFilteredSelected}
                      onChange={toggleAll}
                      title="Select all contacts"
                    />
                  </th>
                  <th className="table-header text-left">Name</th>
                  <th className="table-header text-left">Type</th>
                  <th className="table-header text-left">Contact</th>
                  <th className="table-header text-left">Associated</th>
                  <th className="table-header text-left">Stage</th>
                  <th className="table-header text-left">Last Contact</th>
                  <th className="table-header w-24 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => {
                  const isSelected = selected.has(row.id)
                  const isContact  = row.kind === "contact"
                  return (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className={cn(
                        "group cursor-pointer transition-colors",
                        isSelected ? "bg-blue-50 hover:bg-blue-100" : "hover:bg-gray-50"
                      )}
                      onClick={() => handleRowClick(row)}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-[11px]" onClick={(e) => e.stopPropagation()}>
                        {isContact ? (
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 cursor-pointer accent-blue-600"
                            checked={isSelected}
                            onChange={() => toggleRow(row.id)}
                          />
                        ) : (
                          <span className="block h-3.5 w-3.5" />
                        )}
                      </td>

                      {/* Name */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 flex-shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600">
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-gray-900">{row.name}</span>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="table-cell">
                        <span className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          TYPE_COLORS[row.typeKey] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}>
                          {TYPE_LABELS[row.typeKey] ?? row.typeKey}
                        </span>
                      </td>

                      {/* Phone + Email */}
                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {row.phone && (
                            <a
                              href={`tel:${row.phone}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-gray-600 hover:text-blue-600 transition-colors"
                            >
                              <Phone className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              {row.phone}
                            </a>
                          )}
                          {row.email && (
                            <a
                              href={`mailto:${row.email}`}
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1.5 text-gray-500 hover:text-blue-600 transition-colors truncate max-w-[180px]"
                            >
                              <Mail className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              <span className="truncate">{row.email}</span>
                            </a>
                          )}
                          {!row.phone && !row.email && <span className="text-gray-300">—</span>}
                        </div>
                      </td>

                      {/* Associated */}
                      <td className="table-cell">
                        {row.associated ? (
                          <div className="flex items-start gap-1.5 text-gray-600">
                            {row.kind === "vendor"
                              ? <MapPin    className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                              : <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                            }
                            <span className="line-clamp-2">{row.associated}</span>
                          </div>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Stage */}
                      <td className="table-cell">
                        {row.stage ? (
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                            {row.stage}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* Last Contact */}
                      <td className="table-cell text-gray-500">
                        {row.lastContact
                          ? formatDistanceToNow(new Date(row.lastContact), { addSuffix: true })
                          : <span className="text-gray-300">—</span>
                        }
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {/* View */}
                          <button
                            onClick={() => handleRowClick(row)}
                            title="View"
                            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Edit — contacts only */}
                          {isContact && (
                            <button
                              onClick={() => {
                                const c = contacts.find((c) => c.id === row.id)
                                if (c) setEditingContact(c)
                              }}
                              title="Edit"
                              className="rounded p-1.5 text-gray-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            onClick={() => setDeleteTarget(row)}
                            title="Delete"
                            className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {selectedContact && (
        <ContactDetailModal
          contact={selectedContact}
          open={!!selectedContact}
          onOpenChange={(open) => { if (!open) setSelectedContact(null) }}
          onUpdated={handleContactUpdated}
          onDeleted={handleContactDeleted}
        />
      )}

      {selectedVendor && (
        <VendorLeadDetailModal
          lead={selectedVendor}
          open={!!selectedVendor}
          onOpenChange={(open) => { if (!open) setSelectedVendor(null) }}
        />
      )}

      <ContactFormDialog
        open={newContactOpen || !!editingContact}
        contact={editingContact ?? undefined}
        onOpenChange={(open) => {
          if (!open) { setNewContactOpen(false); setEditingContact(null) }
        }}
        onSave={handleContactSave}
      />

      {/* Single delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {deleteTarget?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.kind === "contact"
                ? "This will permanently delete the contact. This cannot be undone."
                : "This will permanently delete this vendor lead and all associated data. This cannot be undone."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk delete confirm */}
      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? "s" : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected contacts. Vendor leads are not affected.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {isBulkDeleting
                ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                : <Trash2 className="h-4 w-4 mr-2" />
              }
              Delete {selectedContactIds.length} contact{selectedContactIds.length !== 1 ? "s" : ""}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
