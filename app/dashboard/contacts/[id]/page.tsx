"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Mail, Phone, Building2, Globe, MapPin, Star, Pencil,
  ArrowLeft, Trash2, ShieldCheck, FileText, Users, Loader2,
  Hash,
} from "lucide-react"
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog"
import { ContactSRABadge } from "@/components/contacts/contact-sra-badge"
import type { ContactWithCounts } from "@/types/contacts"
import type { ContactType } from "@prisma/client"
import { toast } from "sonner"
import Link from "next/link"

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

export default function ContactDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [contact, setContact] = useState<ContactWithCounts | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    fetch(`/api/contacts/${id}`)
      .then((r) => r.json())
      .then((data) => setContact(data.contact ?? null))
      .catch(() => setContact(null))
      .finally(() => setIsLoading(false))
  }, [id])

  const handleSave = (updated: ContactWithCounts) => {
    setContact(updated)
    setIsFormOpen(false)
  }

  const handleDelete = async () => {
    if (!contact) return
    if (!confirm(`Delete ${contact.fullName}? This cannot be undone.`)) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      toast.success("Contact deleted")
      router.push("/dashboard/contacts")
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleVerified = (updated: ContactWithCounts) => {
    setContact(updated)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!contact) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Contact not found</p>
        <Button asChild className="mt-4" variant="outline">
          <Link href="/dashboard/contacts">Back to Contacts</Link>
        </Button>
      </div>
    )
  }

  const sraProfileUrl = contact.sraNumber
    ? `https://www.sra.org.uk/consumers/register/organisation/?sraNumber=${encodeURIComponent(contact.sraNumber)}`
    : null

  return (
    <div className="flex-1 space-y-6 p-6 max-w-4xl">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-4">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
          <Link href="/dashboard/contacts">
            <ArrowLeft className="h-4 w-4" />
            Contacts
          </Link>
        </Button>

        <div className="flex items-center gap-2">
          {contact.type === "SOLICITOR" && contact.sraNumber && (
            <ContactSRABadge contact={contact} onVerified={handleVerified} />
          )}
          <Button variant="outline" size="sm" onClick={() => setIsFormOpen(true)}>
            <Pencil className="h-4 w-4 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">{contact.fullName}</h1>
          {contact.isPreferred && <Star className="h-5 w-5 fill-amber-400 text-amber-400" />}
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[contact.type]}`}>
            {TYPE_LABELS[contact.type]}
          </span>
        </div>
        {contact.company && (
          <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
            <Building2 className="h-4 w-4" />
            {contact.company}
          </p>
        )}
        {contact.jobTitle && (
          <p className="text-sm text-muted-foreground mt-0.5">{contact.jobTitle}</p>
        )}
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact details */}
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Contact Details</h2>

          {contact.email && (
            <a href={`mailto:${contact.email}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              {contact.phone}
            </a>
          )}
          {contact.mobilePhone && (
            <a href={`tel:${contact.mobilePhone}`} className="flex items-center gap-2 text-sm hover:text-primary">
              <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
              {contact.mobilePhone} (mobile)
            </a>
          )}
          {contact.website && (
            <a
              href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm hover:text-primary"
            >
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              {contact.website.replace(/^https?:\/\//, "")}
            </a>
          )}
          {(contact.addressLine1 || contact.city || contact.postcode) && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                {contact.addressLine1 && <div>{contact.addressLine1}</div>}
                {contact.addressLine2 && <div>{contact.addressLine2}</div>}
                {contact.city && <div>{contact.city}</div>}
                {contact.county && <div>{contact.county}</div>}
                {contact.postcode && <div className="font-mono">{contact.postcode}</div>}
              </div>
            </div>
          )}

          {(!contact.email && !contact.phone && !contact.website && !contact.addressLine1) && (
            <p className="text-xs text-muted-foreground/60">No contact details recorded</p>
          )}
        </div>

        {/* SRA details (solicitors only) */}
        {contact.type === "SOLICITOR" && (
          <div className="rounded-lg border p-4 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SRA Registration</h2>

            {contact.sraNumber ? (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Hash className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{contact.sraNumber}</span>
                  {sraProfileUrl && (
                    <a href={sraProfileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-auto">
                      View on SRA ↗
                    </a>
                  )}
                </div>

                <ContactSRABadge contact={contact} onVerified={handleVerified} showVerifyButton />

                {contact.sraDisplayName && (
                  <p className="text-sm text-muted-foreground">
                    Registered as: <span className="font-medium text-foreground">{contact.sraDisplayName}</span>
                  </p>
                )}
                {contact.sraStatus && (
                  <p className="text-sm text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{contact.sraStatus}</span>
                  </p>
                )}
                {contact.sraVerifiedAt && (
                  <p className="text-xs text-muted-foreground">
                    Last verified: {new Date(contact.sraVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground/60">No SRA number recorded</p>
            )}

            {contact.practiceAreas.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Practice areas:</p>
                <div className="flex flex-wrap gap-1.5">
                  {contact.practiceAreas.map((area) => (
                    <Badge key={area} variant="secondary" className="text-xs">{area}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Linked records */}
        <div className="rounded-lg border p-4 space-y-3 md:col-span-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Linked Records</h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{contact._count.vendorLeads}</span>
              <span className="text-muted-foreground">vendor lead{contact._count.vendorLeads !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{contact._count.investors}</span>
              <span className="text-muted-foreground">investor{contact._count.investors !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {contact.notes && (
          <div className="rounded-lg border p-4 md:col-span-2">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
          </div>
        )}
      </div>

      <ContactFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        contact={contact}
        onSave={handleSave}
      />
    </div>
  )
}
