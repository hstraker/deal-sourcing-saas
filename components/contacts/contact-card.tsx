"use client"

import { useState } from "react"
import { Mail, Phone, Building2, Star, Pencil, Copy, Check, Users, FileText, Link2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ContactSRABadge } from "./contact-sra-badge"
import type { ContactWithCounts } from "@/types/contacts"
import type { ContactType } from "@prisma/client"
import { toast } from "sonner"

const TYPE_LABELS: Record<ContactType, string> = {
  SOLICITOR: "Solicitor",
  INVESTOR_CONTACT: "Investor Contact",
  VENDOR_CONTACT: "Vendor Contact",
  ESTATE_AGENT: "Estate Agent",
  CONTRACTOR: "Contractor",
  OTHER: "Other",
}

const TYPE_COLORS: Record<ContactType, string> = {
  SOLICITOR: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  INVESTOR_CONTACT: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400",
  VENDOR_CONTACT: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  ESTATE_AGENT: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  CONTRACTOR: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  OTHER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

interface ContactCardProps {
  contact: ContactWithCounts
  onEdit: (contact: ContactWithCounts) => void
  onUpdated: (contact: ContactWithCounts) => void
  href?: string
}

export function ContactCard({ contact, onEdit, onUpdated, href }: ContactCardProps) {
  const [copied, setCopied] = useState(false)

  const copyDetails = () => {
    const parts = [contact.fullName]
    if (contact.company) parts.push(contact.company)
    if (contact.email) parts.push(contact.email)
    if (contact.phone) parts.push(contact.phone)
    navigator.clipboard.writeText(parts.join("\n"))
    setCopied(true)
    toast.success("Contact details copied")
    setTimeout(() => setCopied(false), 2000)
  }

  const linkedCount = contact._count.vendorLeads + contact._count.investors

  return (
    <div className="rounded-lg border bg-card text-sm divide-y hover:shadow-sm transition-shadow">
      {/* Header */}
      <div className="p-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <a href={href ?? `/dashboard/contacts/${contact.id}`} className="font-semibold hover:underline truncate">
              {contact.fullName}
            </a>
            {contact.isPreferred && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
            )}
          </div>
          {contact.company && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Building2 className="h-3 w-3 shrink-0" />
              {contact.company}
            </p>
          )}
          {contact.jobTitle && !contact.company && (
            <p className="text-xs text-muted-foreground mt-0.5">{contact.jobTitle}</p>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[contact.type]}`}>
            {TYPE_LABELS[contact.type]}
          </span>
        </div>
      </div>

      {/* Contact details */}
      <div className="px-3 py-2 space-y-1">
        {contact.email && (
          <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            {contact.email}
          </a>
        )}
        {contact.phone && (
          <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {contact.phone}
          </a>
        )}
        {contact.type === "SOLICITOR" && (
          <ContactSRABadge contact={contact} onVerified={onUpdated} showVerifyButton={false} />
        )}
      </div>

      {/* Footer: linked counts + actions */}
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {contact._count.vendorLeads > 0 && (
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {contact._count.vendorLeads} lead{contact._count.vendorLeads !== 1 ? "s" : ""}
            </span>
          )}
          {contact._count.investors > 0 && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {contact._count.investors} investor{contact._count.investors !== 1 ? "s" : ""}
            </span>
          )}
          {linkedCount === 0 && <span className="text-muted-foreground/60">No links</span>}
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={copyDetails} title="Copy contact details">
            {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => onEdit(contact)} title="Edit contact">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <a href={`/dashboard/contacts/${contact.id}`} title="View contact details">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
            </Button>
          </a>
        </div>
      </div>
    </div>
  )
}
