# Unified Contacts Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the "Contacts" (`/dashboard/contacts`) and "Contact Info" (`/dashboard/vendors/contacts`) pages into a single unified directory at `/dashboard/contacts`, with type-filter chips, a combined table of Contact records and VendorLead contacts, and the correct modal for each row type.

**Architecture:** The contacts page becomes a Next.js Server Component that fetches both `prisma.contact` and `prisma.vendorLead` records, serialises all Dates and Decimals, and passes the results to a new `UnifiedContactsClient` client component. The client normalises both data sources into a flat `UnifiedRow[]` array, handles filter chips and search client-side, and opens either `ContactDetailModal` or `VendorLeadDetailModal` depending on the row kind. Contact CRUD (create/edit/delete) is preserved via existing dialogs that mutate local client state.

**Tech Stack:** Next.js 14 App Router (Server + Client components), Prisma 5, TypeScript, shadcn/ui (Button, Badge, Dialog), Lucide React icons, Sonner toasts, `date-fns`.

---

## File Structure

| Action  | Path |
|---------|------|
| Modify  | `config/navigation.ts` — remove "Contact Info" item from Client Management group |
| Rewrite | `app/dashboard/contacts/page.tsx` — Server Component, fetches both data sources |
| Create  | `components/contacts/unified-contacts-client.tsx` — unified table + filter chips + modals |
| Leave   | `app/dashboard/vendors/contacts/page.tsx` — no longer linked in nav, no changes needed |

---

## Task 1: Remove "Contact Info" from navigation

**Files:**
- Modify: `config/navigation.ts` lines 81–85

The "Client Management" group currently has two items. Remove the second one ("Contact Info") so only "Contacts" remains.

- [ ] **Step 1: Edit `config/navigation.ts`**

Find the Client Management group (lines ~80–85) and delete the "Contact Info" row:

```ts
// BEFORE
{
  label: "Client Management",
  items: [
    { label: "Contacts",     href: "/dashboard/contacts",         icon: UserGroupIcon },
    { label: "Contact Info", href: "/dashboard/vendors/contacts", icon: UserIcon },
  ],
},

// AFTER
{
  label: "Client Management",
  items: [
    { label: "Contacts", href: "/dashboard/contacts", icon: UserGroupIcon },
  ],
},
```

Also remove the now-unused `UserIcon` import unconditionally — it is only used by the "Contact Info" item and nowhere else in the file. Remove the `UserIcon` entry from the import block at the top of the file.

- [ ] **Step 2: Verify no TypeScript errors**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -30
```

Expected: zero errors (or errors unrelated to this file).

- [ ] **Step 3: Commit**

```bash
git add config/navigation.ts
git commit -m "feat: remove Contact Info nav item (merging into unified Contacts page)"
```

---

## Task 2: Create `components/contacts/unified-contacts-client.tsx`

**Files:**
- Create: `components/contacts/unified-contacts-client.tsx`

This is the main new client component. It accepts pre-fetched, serialised contacts and vendor leads from the server, normalises them into a flat list, and renders a unified table with filter chips, search, and modal integration.

### Key types used

```ts
// From @/types/contacts
import type { ContactWithCounts } from "@/types/contacts"
// ContactWithCounts extends Prisma Contact with:
//   _count: { vendorLeads: number; investors: number }
// Contact DateTime fields: createdAt, updatedAt, sraVerifiedAt
// (All passed as ISO strings from server, ContactDetailModal handles with new Date(...))

// From @/components/vendors/vendor-lead-detail-modal
import type { VendorLead } from "@/components/vendors/vendor-lead-detail-modal"
// VendorLead DateTime fields are Date|null in type but strings at runtime (same pattern as portal-check page)
```

### UnifiedRow normalisation

The component normalises both types into a flat display row:

```ts
interface UnifiedRow {
  id: string
  kind: "contact" | "vendor"
  name: string
  phone: string | null
  email: string | null
  typeKey: string      // filter chip key, e.g. "SOLICITOR" | "VENDOR" | "ESTATE_AGENT" etc.
  typeLabel: string    // display label
  typeColor: string    // Tailwind badge classes
  associated: string | null  // company for contacts, propertyAddress for vendors
  stage: string | null       // pipeline stage label for vendors; null for contacts
  lastContact: string | null // ISO date string
}
```

### Filter chip options

```ts
const CHIPS = [
  { key: "ALL",              label: "All"              },
  { key: "VENDOR",           label: "Vendor Leads"     },
  { key: "SOLICITOR",        label: "Solicitors"       },
  { key: "ESTATE_AGENT",     label: "Estate Agents"    },
  { key: "INVESTOR_CONTACT", label: "Investor Contacts"},
  { key: "CONTRACTOR",       label: "Contractors"      },
  { key: "OTHER",            label: "Other"            },
]
```

### Stage labels (copy from vendor-contacts-client.tsx)

```ts
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
```

### Type colours

```ts
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
```

### Steps

- [ ] **Step 1: Create the file with the complete implementation**

Create `/mnt/c/Users/henry/Projects/deal-sourcing-saas/components/contacts/unified-contacts-client.tsx`:

```tsx
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
import { Plus, Search, Phone, Mail, Building2, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { formatDistanceToNow } from "date-fns"

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
    stage: STAGE_LABELS[v.pipelineStage] ?? String(v.pipelineStage),
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

  // Modal state
  const [selectedContact, setSelectedContact] = useState<ContactWithCounts | null>(null)
  const [selectedVendor, setSelectedVendor] = useState<VendorLead | null>(null)
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<ContactWithCounts | null>(null)

  // Normalise all rows
  const allRows = useMemo<UnifiedRow[]>(() => {
    const contactRows = contacts.map(normaliseContact)
    const vendorRows = vendorLeads.map(normaliseVendor)
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

  // Contact CRUD handlers
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
    setSelectedContact(null)
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Contacts"
        subtitle={`${allRows.length} contacts — solicitors, estate agents, vendors and more`}
        actions={
          <Button
            size="sm"
            className="btn-primary h-9"
            onClick={() => {
              setEditingContact(null)
              setNewContactOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Button>
        }
      />

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2">
        {CHIPS.map(({ key, label }) => {
          const count = chipCounts[key] ?? 0
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
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search name, phone, email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-sm text-gray-400">No contacts match your search.</p>
        </div>
      ) : (
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="table-header">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Associated</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Last Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((row) => (
                  <tr
                    key={`${row.kind}-${row.id}`}
                    className="table-row group cursor-pointer"
                    onClick={() => handleRowClick(row)}
                  >
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
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
                          TYPE_COLORS[row.typeKey] ?? "bg-gray-100 text-gray-600 border-gray-200"
                        )}
                      >
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
                        {!row.phone && !row.email && (
                          <span className="text-gray-300">—</span>
                        )}
                      </div>
                    </td>

                    {/* Associated */}
                    <td className="table-cell">
                      {row.associated ? (
                        <div className="flex items-start gap-1.5 text-gray-600">
                          {row.kind === "vendor" ? (
                            <MapPin className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          ) : (
                            <Building2 className="h-3.5 w-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                          )}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
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
          if (!open) {
            setNewContactOpen(false)
            setEditingContact(null)
          }
        }}
        onSave={handleContactSave}
      />
    </div>
  )
}
```

- [ ] **Step 2: Check TypeScript compiles**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors. If there are type errors related to `ContactFormDialog` props (e.g. `contact` vs `initialValues`), read `components/contacts/contact-form-dialog.tsx` to find the correct prop name and adjust.

If `PageHeader` is not available at `@/components/ui/page-header`, replace with:
```tsx
<div className="flex items-center justify-between">
  <div>
    <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
    <p className="text-sm text-gray-400 mt-0.5">{allRows.length} contacts — solicitors, estate agents, vendors and more</p>
  </div>
  <Button size="sm" className="btn-primary h-9" onClick={() => { setEditingContact(null); setNewContactOpen(true) }}>
    <Plus className="mr-2 h-4 w-4" />Add Contact
  </Button>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add components/contacts/unified-contacts-client.tsx
git commit -m "feat: add UnifiedContactsClient — combined contacts + vendor leads table"
```

---

## Task 3: Rewrite `app/dashboard/contacts/page.tsx` as a Server Component

**Files:**
- Rewrite: `app/dashboard/contacts/page.tsx`

The existing file is a very large client component (`"use client"` at top). Replace it entirely with a server component that:
1. Checks auth (redirect to `/login` if no session)
2. Fetches `prisma.contact.findMany()` with `_count`
3. Fetches `prisma.vendorLead.findMany()` (all scalar fields, no relations)
4. Serialises all DateTime and Decimal values to primitives
5. Renders `<UnifiedContactsClient initialContacts={...} vendorLeads={...} />`

### Contact serialisation

Contact model DateTime fields (from schema):
- `createdAt` — required
- `updatedAt` — required
- `sraVerifiedAt` — optional

### VendorLead serialisation

Copy the same serialisation block used in `app/dashboard/vendors/portal-check/page.tsx` exactly. It covers all 14 DateTime fields and all Decimal fields, and adds `smsMessages: []` and `pipelineEvents: []`.

- [ ] **Step 1: Replace `app/dashboard/contacts/page.tsx` with the server component**

```tsx
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/db"
import { UnifiedContactsClient } from "@/components/contacts/unified-contacts-client"

export const metadata = { title: "Contacts — DealStack" }
export const dynamic = "force-dynamic"

export default async function ContactsPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  // ── Fetch contacts (all types) with link counts ──────────────────────────
  const rawContacts = await prisma.contact.findMany({
    include: {
      _count: { select: { vendorLeads: true, investors: true } },
    },
    orderBy: { createdAt: "desc" },
  })

  // Serialise DateTime fields to ISO strings for the client boundary
  const contacts = rawContacts.map((c) => ({
    ...c,
    createdAt:    c.createdAt.toISOString(),
    updatedAt:    c.updatedAt.toISOString(),
    sraVerifiedAt: c.sraVerifiedAt?.toISOString() ?? null,
  }))

  // ── Fetch vendor leads (all scalar fields) ────────────────────────────────
  const rawLeads = await prisma.vendorLead.findMany({
    orderBy: { createdAt: "desc" },
  })

  // Serialise ALL DateTime and Decimal fields (matches portal-check page pattern)
  const vendorLeads = rawLeads.map((lead) => ({
    ...lead,
    createdAt:                   lead.createdAt.toISOString(),
    updatedAt:                   lead.updatedAt.toISOString(),
    latestCheckedAt:             lead.latestCheckedAt?.toISOString() ?? null,
    validatedAt:                 lead.validatedAt?.toISOString() ?? null,
    offerSentAt:                 lead.offerSentAt?.toISOString() ?? null,
    offerAcceptedAt:             lead.offerAcceptedAt?.toISOString() ?? null,
    offerRejectedAt:             lead.offerRejectedAt?.toISOString() ?? null,
    nextRetryAt:                 lead.nextRetryAt?.toISOString() ?? null,
    videoSentAt:                 lead.videoSentAt?.toISOString() ?? null,
    lockoutAgreementSentAt:      lead.lockoutAgreementSentAt?.toISOString() ?? null,
    lockoutAgreementSignedAt:    lead.lockoutAgreementSignedAt?.toISOString() ?? null,
    lastInvestorPackGeneratedAt: lead.lastInvestorPackGeneratedAt?.toISOString() ?? null,
    reservedAt:                  lead.reservedAt?.toISOString() ?? null,
    lastContactAt:               lead.lastContactAt?.toISOString() ?? null,
    conversationStartedAt:       lead.conversationStartedAt?.toISOString() ?? null,
    dealClosedAt:                lead.dealClosedAt?.toISOString() ?? null,
    comparablesFetchedAt:        lead.comparablesFetchedAt?.toISOString() ?? null,
    // Decimal → number
    askingPrice:               lead.askingPrice ? Number(lead.askingPrice) : null,
    estimatedMonthlyRent:      lead.estimatedMonthlyRent ? Number(lead.estimatedMonthlyRent) : null,
    estimatedAnnualRent:       lead.estimatedAnnualRent ? Number(lead.estimatedAnnualRent) : null,
    rentPerSqFt:               lead.rentPerSqFt ? Number(lead.rentPerSqFt) : null,
    localAverageRent:          lead.localAverageRent ? Number(lead.localAverageRent) : null,
    bmvScore:                  lead.bmvScore ? Number(lead.bmvScore) : null,
    estimatedMarketValue:      lead.estimatedMarketValue ? Number(lead.estimatedMarketValue) : null,
    estimatedRefurbCost:       lead.estimatedRefurbCost ? Number(lead.estimatedRefurbCost) : null,
    profitPotential:           lead.profitPotential ? Number(lead.profitPotential) : null,
    offerAmount:               lead.offerAmount ? Number(lead.offerAmount) : null,
    offerPercentage:           lead.offerPercentage ? Number(lead.offerPercentage) : null,
    avgComparablePrice:        lead.avgComparablePrice ? Number(lead.avgComparablePrice) : null,
    // Relations not fetched — satisfy VendorLead type
    smsMessages:    [],
    pipelineEvents: [],
  }))

  return (
    <UnifiedContactsClient
      initialContacts={contacts as any}
      vendorLeads={vendorLeads as any}
    />
  )
}
```

> **Note on `as any` casts:** The serialised objects have string dates where the TypeScript types say `Date`. This is the same runtime pattern used throughout the codebase (the existing contacts page fetched JSON from `/api/contacts` and got strings too). The modals call `new Date(value)` internally which handles both. The `as any` cast is intentional and matches the portal-check page pattern.

- [ ] **Step 2: Verify TypeScript**

```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npx tsc --noEmit 2>&1 | head -40
```

Expected: zero new errors.

If you see an error like `Property 'X' does not exist on type 'VendorLead'` for a Decimal field like `rentPerSqFt`, `localAverageRent`, `avgComparablePrice`, or `dealClosedAt`, `comparablesFetchedAt`, `videoSentAt` — these fields may not exist yet in the schema. Remove those lines from the serialisation block (the TypeScript error will tell you the field name).

If `_count` relation errors appear for contacts, check if the `prisma.contact` model has `vendorLeads` and `investors` relations in `prisma/schema.prisma`. If not, remove the `_count` include and pass `contacts` with `_count: { vendorLeads: 0, investors: 0 }` via `.map((c) => ({ ...c, _count: { vendorLeads: 0, investors: 0 } }))`.

- [ ] **Step 3: Verify the page renders in the browser**

Start the dev server if not already running:
```bash
cd /mnt/c/Users/henry/Projects/deal-sourcing-saas && npm run dev
```

Navigate to `http://localhost:3000/dashboard/contacts`. Verify:
- Page loads without errors
- Filter chips show correct counts
- Clicking a Contact row opens ContactDetailModal
- Clicking a Vendor Lead row opens VendorLeadDetailModal
- "Add Contact" button opens ContactFormDialog

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/contacts/page.tsx
git commit -m "feat: unify contacts page — server-fetches contacts + vendor leads, renders unified table"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] Nav: "Client Management" group shows only "Contacts" (no "Contact Info" item)
- [ ] `/dashboard/contacts` loads the unified table with both Contact records and VendorLead contacts
- [ ] Filter chip "All" shows the total count (contacts + vendor leads)
- [ ] Filter chip "Vendor Leads" shows only vendor lead rows
- [ ] Filter chip "Solicitors" shows only contacts with type=SOLICITOR
- [ ] Search filters across name, phone, email, and associated columns
- [ ] Clicking a Contact row opens the ContactDetailModal (with edit/delete)
- [ ] Clicking a Vendor Lead row opens the full VendorLeadDetailModal (all tabs)
- [ ] "Add Contact" button opens ContactFormDialog; saving a new contact adds it to the list
- [ ] Editing a contact from ContactDetailModal updates the row in the table
- [ ] Deleting a contact from ContactDetailModal removes the row from the table
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] `/dashboard/vendors/contacts` still works (old page, no longer linked in nav)
