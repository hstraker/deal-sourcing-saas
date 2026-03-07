"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Plus, Search, Loader2, Mail, Phone, Globe, MapPin,
  Building2, Star, Edit, Trash2, FileText, Users,
  ShieldCheck, ShieldAlert, Scale, Wrench, Home, UserCircle,
  LayoutList, LayoutGrid, Clock, ExternalLink, Copy, Check,
  ChevronDown, ChevronUp, ChevronsUpDown,
} from "lucide-react"
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog"
import { ContactDetailModal } from "@/components/contacts/contact-detail-modal"
import { PageHeader } from "@/components/ui/page-header"
import type { ContactWithCounts } from "@/types/contacts"
import type { ContactType } from "@prisma/client"
import { toast } from "sonner"
import { format } from "date-fns"

// ── Type config ──────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<ContactType, string> = {
  SOLICITOR:        "Solicitor",
  INVESTOR_CONTACT: "Investor Contact",
  VENDOR_CONTACT:   "Vendor Contact",
  ESTATE_AGENT:     "Estate Agent",
  CONTRACTOR:       "Contractor",
  OTHER:            "Other",
}

const TYPE_COLORS: Record<ContactType, string> = {
  SOLICITOR:        "bg-blue-100   text-blue-700   border-blue-200",
  INVESTOR_CONTACT: "bg-purple-100 text-purple-700 border-purple-200",
  VENDOR_CONTACT:   "bg-orange-100 text-orange-700 border-orange-200",
  ESTATE_AGENT:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  CONTRACTOR:       "bg-amber-100  text-amber-700  border-amber-200",
  OTHER:            "bg-slate-100  text-slate-600  border-slate-200",
}

const TYPE_ICONS: Record<ContactType, React.ReactNode> = {
  SOLICITOR:        <Scale      className="h-3.5 w-3.5" />,
  INVESTOR_CONTACT: <Users      className="h-3.5 w-3.5" />,
  VENDOR_CONTACT:   <Home       className="h-3.5 w-3.5" />,
  ESTATE_AGENT:     <Building2  className="h-3.5 w-3.5" />,
  CONTRACTOR:       <Wrench     className="h-3.5 w-3.5" />,
  OTHER:            <UserCircle className="h-3.5 w-3.5" />,
}

const TYPE_AVATAR_GRADIENT: Record<ContactType, string> = {
  SOLICITOR:        "from-blue-500    to-blue-700",
  INVESTOR_CONTACT: "from-purple-500  to-purple-700",
  VENDOR_CONTACT:   "from-orange-400  to-orange-600",
  ESTATE_AGENT:     "from-emerald-500 to-emerald-700",
  CONTRACTOR:       "from-amber-400   to-amber-600",
  OTHER:            "from-slate-400   to-slate-600",
}

const TYPE_HEADER_BG: Record<ContactType, string> = {
  SOLICITOR:        "from-blue-50 to-blue-100/40",
  INVESTOR_CONTACT: "from-purple-50 to-purple-100/40",
  VENDOR_CONTACT:   "from-orange-50 to-orange-100/40",
  ESTATE_AGENT:     "from-emerald-50 to-emerald-100/40",
  CONTRACTOR:       "from-amber-50 to-amber-100/40",
  OTHER:            "from-slate-50 to-slate-100/40",
}

const TYPE_ORDER: ContactType[] = [
  "SOLICITOR", "ESTATE_AGENT", "CONTRACTOR",
  "INVESTOR_CONTACT", "VENDOR_CONTACT", "OTHER",
]

// ── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(c: ContactWithCounts): string {
  const f = c.firstName?.[0]?.toUpperCase() ?? ""
  const l = c.lastName?.[0]?.toUpperCase() ?? ""
  return f || l ? f + l : c.fullName?.[0]?.toUpperCase() ?? "?"
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SraBadge({ contact }: { contact: ContactWithCounts }) {
  if (contact.type !== "SOLICITOR") return <span className="text-gray-300 text-xs">—</span>
  if (!contact.sraNumber) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <ShieldAlert className="h-3 w-3" />No SRA
      </span>
    )
  }
  if (contact.sraVerified) {
    const days = contact.sraVerifiedAt
      ? Math.floor((Date.now() - new Date(contact.sraVerifiedAt).getTime()) / 86400000)
      : null
    const stale = days !== null && days > 30
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center gap-1 text-xs font-medium cursor-default ${
              stale ? "text-amber-600" : "text-emerald-600"
            }`}>
              {stale ? <Clock className="h-3 w-3" /> : <ShieldCheck className="h-3 w-3" />}
              {stale ? `Stale (${days}d)` : "Verified"}
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {contact.sraStatus}
            {contact.sraVerifiedAt && ` · ${format(new Date(contact.sraVerifiedAt), "d MMM yyyy")}`}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
      <ShieldAlert className="h-3 w-3" />Unverified
    </span>
  )
}

function CopyBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 shrink-0"
      onClick={(e) => {
        e.stopPropagation()
        navigator.clipboard.writeText(value).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      title="Copy to clipboard"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

type SortField = "fullName" | "type" | "createdAt"
type SortDir   = "asc" | "desc"

function SortableHead({
  label, field, currentField, currentDir, onSort,
}: {
  label: string
  field: SortField
  currentField: SortField | null
  currentDir: SortDir
  onSort: (f: SortField) => void
}) {
  const active = currentField === field
  return (
    <th
      className="table-header cursor-pointer select-none hover:text-gray-600 whitespace-nowrap"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? currentDir === "asc"
            ? <ChevronUp   className="h-3.5 w-3.5" />
            : <ChevronDown className="h-3.5 w-3.5" />
          : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
        }
      </div>
    </th>
  )
}

function ContactCard({
  contact, onOpen, onEdit, onDelete, deletingId,
}: {
  contact: ContactWithCounts
  onOpen: (c: ContactWithCounts) => void
  onEdit: (c: ContactWithCounts) => void
  onDelete: (c: ContactWithCounts, e: React.MouseEvent) => void
  deletingId: string | null
}) {
  const ini        = getInitials(contact)
  const addressParts = [contact.addressLine1, contact.city, contact.postcode].filter(Boolean)
  const linked       = contact._count.vendorLeads + contact._count.investors

  return (
    <div
      className="group/card ds-card ds-card-hover overflow-hidden cursor-pointer"
      onClick={() => onOpen(contact)}
    >
      {/* Gradient header */}
      <div className={`bg-gradient-to-br ${TYPE_HEADER_BG[contact.type]} p-4 pb-3`}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 h-10 w-10 rounded-full bg-gradient-to-br ${TYPE_AVATAR_GRADIENT[contact.type]} flex items-center justify-center text-white text-sm font-bold shadow-md ring-2 ring-white/20`}>
            {ini}
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex items-center gap-1.5">
              <p className="font-semibold text-sm leading-tight truncate text-gray-800">{contact.fullName}</p>
              {contact.isPreferred && <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />}
            </div>
            {contact.company && (
              <p className="text-xs text-gray-400 truncate mt-0.5 flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />{contact.company}
              </p>
            )}
            {contact.jobTitle && !contact.company && (
              <p className="text-xs text-gray-400 truncate mt-0.5">{contact.jobTitle}</p>
            )}
          </div>
        </div>
        <div className="mt-2.5">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[contact.type]}`}>
            {TYPE_ICONS[contact.type]}{TYPE_LABELS[contact.type]}
          </span>
        </div>
      </div>

      {/* Contact details */}
      <div className="px-4 py-3 space-y-1.5 border-t border-[var(--ds-border)]">
        {contact.email && (
          <div className="group/row flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-700 truncate flex-1">{contact.email}</a>
            <CopyBtn value={contact.email} />
          </div>
        )}
        {contact.phone && (
          <div className="group/row flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-700 flex-1">{contact.phone}</a>
            <CopyBtn value={contact.phone} />
          </div>
        )}
        {contact.website && (
          <div className="flex items-center gap-2">
            <Globe className="h-3.5 w-3.5 text-gray-400 shrink-0" />
            <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
              target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
              className="text-xs text-gray-400 hover:text-gray-700 truncate flex-1">
              {contact.website.replace(/^https?:\/\//, "")}
            </a>
            <ExternalLink className="h-3 w-3 text-gray-300 shrink-0" />
          </div>
        )}
        {addressParts.length > 0 && (
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-400 leading-relaxed">{addressParts.join(", ")}</p>
          </div>
        )}
        {!contact.email && !contact.phone && !contact.website && addressParts.length === 0 && (
          <p className="text-xs text-gray-300 italic">No contact details recorded</p>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--ds-border)] bg-gray-50/50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-gray-400 min-w-0">
          {contact.type === "SOLICITOR" && <SraBadge contact={contact} />}
          {linked > 0 && (
            <span className="flex items-center gap-1 shrink-0">
              <FileText className="h-3 w-3" />
              {linked} link{linked !== 1 ? "s" : ""}
            </span>
          )}
          {linked === 0 && contact.type !== "SOLICITOR" && (
            <span className="text-gray-200">No links</span>
          )}
        </div>
        <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7"
            onClick={(e) => { e.stopPropagation(); onEdit(contact) }} title="Edit">
            <Edit className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-red-500"
            disabled={deletingId === contact.id}
            onClick={(e) => { e.stopPropagation(); onDelete(contact, e) }} title="Delete">
            {deletingId === contact.id
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Trash2  className="h-3.5 w-3.5" />
            }
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

type ViewMode = "list" | "cards"

export default function ContactsPage() {
  const [contacts,      setContacts]      = useState<ContactWithCounts[]>([])
  const [total,         setTotal]         = useState(0)
  const [isLoading,     setIsLoading]     = useState(true)
  const [search,        setSearch]        = useState("")
  const [typeFilter,    setTypeFilter]    = useState<ContactType | "ALL">("ALL")
  const [viewMode,      setViewMode]      = useState<ViewMode>("list")
  const [showPreferred, setShowPreferred] = useState(false)
  const [sortField,     setSortField]     = useState<SortField | null>(null)
  const [sortDir,       setSortDir]       = useState<SortDir>("asc")

  const [isFormOpen,     setIsFormOpen]     = useState(false)
  const [editingContact, setEditingContact] = useState<ContactWithCounts | null>(null)
  const [viewingContact, setViewingContact] = useState<ContactWithCounts | null>(null)
  const [deletingId,     setDeletingId]     = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams()
      if (typeFilter !== "ALL") params.set("type", typeFilter)
      if (search.trim()) params.set("search", search.trim())
      params.set("limit", "200")
      const res  = await fetch(`/api/contacts?${params}`)
      const data = await res.json()
      setContacts(data.contacts ?? [])
      setTotal(data.total ?? 0)
    } finally {
      setIsLoading(false)
    }
  }, [typeFilter, search])

  useEffect(() => {
    const t = setTimeout(fetchContacts, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [fetchContacts, search])

  const handleSave = (saved: ContactWithCounts) => {
    setContacts((prev) => {
      const exists = prev.find((c) => c.id === saved.id)
      return exists ? prev.map((c) => (c.id === saved.id ? saved : c)) : [saved, ...prev]
    })
    if (!contacts.find((c) => c.id === saved.id)) setTotal((t) => t + 1)
    setEditingContact(null)
    setIsFormOpen(false)
  }

  const handleUpdated = (updated: ContactWithCounts) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    if (viewingContact?.id === updated.id) setViewingContact(updated)
  }

  const handleDeleted = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => t - 1)
    if (viewingContact?.id === id) setViewingContact(null)
  }

  const handleOpenForm = (contact?: ContactWithCounts) => {
    setEditingContact(contact ?? null)
    setIsFormOpen(true)
  }

  const handleDelete = async (contact: ContactWithCounts, e: React.MouseEvent) => {
    e.stopPropagation()
    const linked = contact._count.vendorLeads + contact._count.investors
    if (linked > 0) {
      toast.error(`Cannot delete: ${contact.fullName} is linked to ${linked} record(s).`)
      return
    }
    if (!confirm(`Delete ${contact.fullName}?`)) return
    setDeletingId(contact.id)
    try {
      const res  = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      handleDeleted(contact.id)
      toast.success("Contact deleted")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    else { setSortField(field); setSortDir("asc") }
  }

  const sorted = useMemo(() => {
    let list = showPreferred ? contacts.filter((c) => c.isPreferred) : [...contacts]
    list.sort((a, b) => {
      if (!sortField) {
        if (a.isPreferred && !b.isPreferred) return -1
        if (!a.isPreferred && b.isPreferred) return 1
        return a.fullName.localeCompare(b.fullName)
      }
      const dir = sortDir === "asc" ? 1 : -1
      switch (sortField) {
        case "fullName":  return a.fullName.localeCompare(b.fullName) * dir
        case "type":      return a.type.localeCompare(b.type) * dir
        case "createdAt": return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir
        default:          return 0
      }
    })
    return list
  }, [contacts, sortField, sortDir, showPreferred])

  const grouped = useMemo(() => {
    return TYPE_ORDER.reduce<Partial<Record<ContactType, ContactWithCounts[]>>>((acc, type) => {
      const group = sorted.filter((c) => c.type === type)
      if (group.length > 0) acc[type] = group
      return acc
    }, {})
  }, [sorted])

  const preferredCount = contacts.filter((c) => c.isPreferred).length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        subtitle="Solicitors, estate agents, contractors and other contacts"
        actions={
          <Button size="sm" className="btn-primary h-9" onClick={() => handleOpenForm()}>
            <Plus className="mr-2 h-4 w-4" />Add Contact
          </Button>
        }
      />

      {/* Toolbar */}
      <div className="ds-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, firm, email…"
              className="pl-8 h-9 text-sm"
            />
          </div>

          {/* Type filter */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as ContactType | "ALL")}>
            <SelectTrigger className="h-9 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              {(Object.keys(TYPE_LABELS) as ContactType[]).map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Preferred toggle */}
          <button
            type="button"
            className={`flex items-center gap-1.5 h-9 rounded-lg border px-3 text-sm transition-colors ${
              showPreferred
                ? "border-[#F5A623] bg-[#FEF3C7] text-amber-700 font-medium"
                : "border-[var(--ds-border)] bg-white text-gray-500 hover:bg-gray-50"
            }`}
            onClick={() => setShowPreferred((p) => !p)}
          >
            <Star className={`h-3.5 w-3.5 ${showPreferred ? "fill-amber-500 text-amber-500" : "text-amber-400"}`} />
            {showPreferred ? `Preferred · ${preferredCount}` : "Preferred"}
          </button>

          {/* View toggle */}
          <div className="flex rounded-lg border border-[var(--ds-border)] overflow-hidden ml-auto">
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors ${
                viewMode === "list" ? "bg-[#1A1A1F] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => setViewMode("list")}
            >
              <LayoutList className="h-3.5 w-3.5" /> List
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs transition-colors border-l border-[var(--ds-border)] ${
                viewMode === "cards" ? "bg-[#1A1A1F] text-white" : "bg-white text-gray-500 hover:bg-gray-50"
              }`}
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
          </div>
        </div>

        {/* Result summary */}
        {!isLoading && (
          <p className="text-xs text-gray-400 mt-2">
            {sorted.length} contact{sorted.length !== 1 ? "s" : ""}
            {showPreferred ? " (preferred)" : ""}
            {typeFilter !== "ALL" ? ` · ${TYPE_LABELS[typeFilter as ContactType]}` : ""}
            {search ? ` matching "${search}"` : ""}
          </p>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>

      ) : sorted.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <UserCircle className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="font-medium text-gray-500">No contacts found</p>
          {(search || typeFilter !== "ALL" || showPreferred) && (
            <p className="text-sm mt-1">Try adjusting your filters</p>
          )}
        </div>

      ) : viewMode === "cards" ? (
        /* ── Grouped card grid ── */
        <div className="space-y-8">
          {(Object.keys(grouped) as ContactType[]).map((type) => {
            const group = grouped[type]!
            return (
              <div key={type}>
                <div className="flex items-center gap-2.5 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${TYPE_COLORS[type]}`}>
                    {TYPE_ICONS[type]}{TYPE_LABELS[type]}
                  </span>
                  <span className="text-xs text-gray-400 font-medium">
                    {group.length} contact{group.length !== 1 ? "s" : ""}
                  </span>
                  <div className="flex-1 h-px bg-[var(--ds-border)]" />
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((contact) => (
                    <ContactCard
                      key={contact.id}
                      contact={contact}
                      onOpen={setViewingContact}
                      onEdit={handleOpenForm}
                      onDelete={handleDelete}
                      deletingId={deletingId}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        /* ── Sortable list table ── */
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <SortableHead label="Name"  field="fullName"  currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  <SortableHead label="Type"  field="type"      currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  <th className="table-header">Contact</th>
                  <th className="table-header">Website / Address</th>
                  <th className="table-header">SRA</th>
                  <th className="table-header">Links</th>
                  <SortableHead label="Added" field="createdAt" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((contact) => {
                  const addressParts = [contact.addressLine1, contact.city, contact.postcode].filter(Boolean)
                  return (
                    <tr
                      key={contact.id}
                      className="table-row"
                      onClick={() => setViewingContact(contact)}
                    >
                      {/* Name + avatar */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2.5">
                          <div className={`flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br ${TYPE_AVATAR_GRADIENT[contact.type]} flex items-center justify-center text-white text-xs font-bold shadow-sm`}>
                            {getInitials(contact)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-sm text-gray-800 truncate">{contact.fullName}</span>
                              {contact.isPreferred && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                            </div>
                            {contact.company && (
                              <div className="text-xs text-gray-400 truncate max-w-[180px]">{contact.company}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="table-cell">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[contact.type]}`}>
                          {TYPE_ICONS[contact.type]}{TYPE_LABELS[contact.type]}
                        </span>
                      </td>

                      {/* Email / Phone */}
                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {contact.email && (
                            <div className="group/row flex items-center gap-1">
                              <a href={`mailto:${contact.email}`} onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 truncate max-w-[170px]">
                                <Mail className="h-3 w-3 shrink-0" />{contact.email}
                              </a>
                              <CopyBtn value={contact.email} />
                            </div>
                          )}
                          {contact.phone && (
                            <div className="group/row flex items-center gap-1">
                              <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700">
                                <Phone className="h-3 w-3 shrink-0" />{contact.phone}
                              </a>
                              <CopyBtn value={contact.phone} />
                            </div>
                          )}
                          {!contact.email && !contact.phone && <span className="text-gray-300 text-xs">—</span>}
                        </div>
                      </td>

                      {/* Website / Address */}
                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {contact.website && (
                            <a href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                              target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-700 truncate max-w-[190px]">
                              <Globe className="h-3 w-3 shrink-0" />
                              {contact.website.replace(/^https?:\/\//, "")}
                              <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-50" />
                            </a>
                          )}
                          {addressParts.length > 0 && (
                            <p className="flex items-center gap-1 text-xs text-gray-400 truncate max-w-[190px]">
                              <MapPin className="h-3 w-3 shrink-0" />{addressParts.join(", ")}
                            </p>
                          )}
                          {!contact.website && addressParts.length === 0 && (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </div>
                      </td>

                      {/* SRA */}
                      <td className="table-cell"><SraBadge contact={contact} /></td>

                      {/* Links */}
                      <td className="table-cell">
                        <div className="flex items-center gap-2 text-xs text-gray-400">
                          {contact._count.vendorLeads > 0 && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 cursor-default">
                                    <FileText className="h-3 w-3" />{contact._count.vendorLeads}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {contact._count.vendorLeads} vendor lead{contact._count.vendorLeads !== 1 ? "s" : ""}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {contact._count.investors > 0 && (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="flex items-center gap-1 cursor-default">
                                    <Users className="h-3 w-3" />{contact._count.investors}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="text-xs">
                                  {contact._count.investors} investor{contact._count.investors !== 1 ? "s" : ""}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {contact._count.vendorLeads === 0 && contact._count.investors === 0 && (
                            <span className="text-gray-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Added date */}
                      <td className="table-cell text-xs text-gray-400 whitespace-nowrap">
                        {format(new Date(contact.createdAt), "d MMM yyyy")}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                                  onClick={(e) => { e.stopPropagation(); handleOpenForm(contact) }}>
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">Edit</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:text-red-500"
                                  disabled={deletingId === contact.id}
                                  onClick={(e) => handleDelete(contact, e)}>
                                  {deletingId === contact.id
                                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    : <Trash2  className="h-3.5 w-3.5" />
                                  }
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">Delete</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {total > sorted.length && (
              <p className="text-xs text-gray-400 text-center py-3 border-t border-[var(--ds-border)]">
                Showing {sorted.length} of {total} contacts
              </p>
            )}
          </div>
        </div>
      )}

      {/* Detail modal */}
      {viewingContact && (
        <ContactDetailModal
          contact={viewingContact}
          open={!!viewingContact}
          onOpenChange={(v) => { if (!v) setViewingContact(null) }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}

      <ContactFormDialog
        key={editingContact?.id ?? "new"}
        open={isFormOpen}
        onOpenChange={(v) => { setIsFormOpen(v); if (!v) setEditingContact(null) }}
        contact={editingContact}
        onSave={handleSave}
      />
    </div>
  )
}
