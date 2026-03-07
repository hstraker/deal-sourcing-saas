"use client"

import { useState, useEffect } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Mail, Phone, Globe, MapPin, Building2, Star, Pencil, Trash2,
  Loader2, ShieldCheck, ShieldAlert, Hash, FileText, Users,
  Maximize2, Minimize2, Clock, ExternalLink, Copy, Check,
  Scale, Wrench, Home, UserCircle,
} from "lucide-react"
import { ContactFormDialog } from "./contact-form-dialog"
import { ContactSRABadge } from "./contact-sra-badge"
import type { ContactWithCounts } from "@/types/contacts"
import type { ContactType } from "@prisma/client"
import { toast } from "sonner"
import { format } from "date-fns"

// ── Config ────────────────────────────────────────────────────────────────────

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
  ESTATE_AGENT:     "bg-green-100  text-green-700  border-green-200",
  CONTRACTOR:       "bg-yellow-100 text-yellow-700 border-yellow-200",
  OTHER:            "bg-gray-100   text-gray-700   border-gray-200",
}

const TYPE_ICONS: Record<ContactType, React.ReactNode> = {
  SOLICITOR:        <Scale     className="h-3 w-3" />,
  INVESTOR_CONTACT: <Users     className="h-3 w-3" />,
  VENDOR_CONTACT:   <Home      className="h-3 w-3" />,
  ESTATE_AGENT:     <Building2 className="h-3 w-3" />,
  CONTRACTOR:       <Wrench    className="h-3 w-3" />,
  OTHER:            <UserCircle className="h-3 w-3" />,
}

// ── Detail row helper ─────────────────────────────────────────────────────────

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b last:border-b-0">
      <div className="mt-0.5 text-gray-400 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-400 mb-0.5">{label}</p>
        <div className="text-sm">{children}</div>
      </div>
    </div>
  )
}

// ── Copy button ───────────────────────────────────────────────────────────────

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={copy} className="ml-1.5 text-gray-400 hover:text-gray-900 transition-colors" title="Copy">
      {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ContactDetailModalProps {
  contact: ContactWithCounts
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdated: (contact: ContactWithCounts) => void
  onDeleted: (id: string) => void
}

export function ContactDetailModal({
  contact: initialContact,
  open,
  onOpenChange,
  onUpdated,
  onDeleted,
}: ContactDetailModalProps) {
  const [contact, setContact] = useState<ContactWithCounts>(initialContact)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [activeTab, setActiveTab] = useState("details")

  // Sync when the parent re-passes a different contact
  useEffect(() => {
    setContact(initialContact)
    setActiveTab("details")
  }, [initialContact.id, open])

  const handleSaved = (updated: ContactWithCounts) => {
    setContact(updated)
    onUpdated(updated)
    setIsFormOpen(false)
    toast.success("Contact updated")
  }

  const handleDelete = async () => {
    const linked = contact._count.vendorLeads + contact._count.investors
    if (linked > 0) {
      toast.error(`Cannot delete: linked to ${linked} record(s). Unlink them first.`)
      return
    }
    if (!confirm(`Delete ${contact.fullName}? This cannot be undone.`)) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to delete")
      toast.success(`${contact.fullName} deleted`)
      onDeleted(contact.id)
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleVerifySRA = async () => {
    setIsVerifying(true)
    try {
      const res = await fetch(`/api/contacts/${contact.id}/verify-sra`, { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Verification failed")
      const updated: ContactWithCounts = data.contact
      setContact(updated)
      onUpdated(updated)
      if (updated.sraVerified) {
        toast.success(`SRA Verified: ${updated.sraStatus ?? "Authorised"}`)
      } else {
        toast.warning(`SRA check: ${updated.sraStatus ?? "Could not confirm"}`)
      }
    } catch (err: any) {
      toast.error(err.message ?? "SRA verification failed")
    } finally {
      setIsVerifying(false)
    }
  }

  const handleTogglePreferred = async () => {
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPreferred: !contact.isPreferred }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setContact(data.contact)
      onUpdated(data.contact)
      toast.success(data.contact.isPreferred ? "Marked as preferred" : "Removed from preferred")
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const sraProfileUrl = contact.sraNumber
    ? `https://www.sra.org.uk/consumers/register/organisation/?sraNumber=${encodeURIComponent(contact.sraNumber)}`
    : null

  const addressParts = [contact.addressLine1, contact.addressLine2, contact.city, contact.county, contact.postcode].filter(Boolean)

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={
            isFullscreen
              ? "!fixed !left-2 !top-2 !right-2 !bottom-2 !translate-x-0 !translate-y-0 !max-w-none !w-auto !max-h-none !h-auto rounded-xl overflow-y-auto"
              : "max-w-2xl w-[95vw] max-h-[88vh] overflow-y-auto"
          }
        >
          {/* ── Header ────────────────────────────────────────────────── */}
          <DialogHeader className="pb-3 border-b pr-10">
            <div className="flex items-start justify-between gap-3">
              {/* Left: name + badges */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <DialogTitle className="text-lg leading-tight">{contact.fullName}</DialogTitle>
                  {contact.isPreferred && (
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${TYPE_COLORS[contact.type]}`}>
                    {TYPE_ICONS[contact.type]}
                    {TYPE_LABELS[contact.type]}
                  </span>
                </div>
                {contact.company && (
                  <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 shrink-0" />
                    {contact.company}
                  </p>
                )}
                {contact.jobTitle && !contact.company && (
                  <p className="text-sm text-gray-400 mt-0.5">{contact.jobTitle}</p>
                )}
              </div>

              {/* Right: action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <TooltipProvider delayDuration={200}>
                  {/* Preferred star toggle */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleTogglePreferred}>
                        <Star className={`h-4 w-4 ${contact.isPreferred ? "fill-amber-400 text-amber-400" : "text-gray-400"}`} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{contact.isPreferred ? "Remove from preferred" : "Mark as preferred"}</TooltipContent>
                  </Tooltip>

                  {/* SRA verify (solicitors only) */}
                  {contact.type === "SOLICITOR" && contact.sraNumber && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={handleVerifySRA} disabled={isVerifying}>
                          {isVerifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                          Verify SRA
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs">Re-verify with SRA register</TooltipContent>
                    </Tooltip>
                  )}

                  {/* Edit */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setIsFormOpen(true)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Edit contact</TooltipContent>
                  </Tooltip>

                  {/* Delete */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-500 border-destructive/30 hover:bg-red-50"
                        onClick={handleDelete}
                        disabled={isDeleting}
                      >
                        {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Delete contact</TooltipContent>
                  </Tooltip>

                  {/* Fullscreen */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setIsFullscreen((f) => !f)}>
                        {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          </DialogHeader>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="mb-4">
              <TabsTrigger value="details">Contact Details</TabsTrigger>
              {contact.type === "SOLICITOR" && <TabsTrigger value="sra">SRA Registration</TabsTrigger>}
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="links">
                Links
                {(contact._count.vendorLeads + contact._count.investors) > 0 && (
                  <span className="ml-1.5 bg-[#2563EB]/10 text-[#2563EB] rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                    {contact._count.vendorLeads + contact._count.investors}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Contact Details tab ───────────────────────────────── */}
            <TabsContent value="details" className="mt-0 space-y-0">
              <div className="rounded-lg border divide-y">
                {contact.email && (
                  <DetailRow icon={<Mail className="h-4 w-4" />} label="Email">
                    <div className="flex items-center gap-1">
                      <a href={`mailto:${contact.email}`} className="hover:text-[#2563EB] hover:underline">{contact.email}</a>
                      <CopyButton value={contact.email} />
                    </div>
                  </DetailRow>
                )}

                {contact.phone && (
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone">
                    <div className="flex items-center gap-1">
                      <a href={`tel:${contact.phone}`} className="hover:text-[#2563EB] hover:underline">{contact.phone}</a>
                      <CopyButton value={contact.phone} />
                    </div>
                  </DetailRow>
                )}

                {contact.mobilePhone && (
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="Mobile">
                    <div className="flex items-center gap-1">
                      <a href={`tel:${contact.mobilePhone}`} className="hover:text-[#2563EB] hover:underline">{contact.mobilePhone}</a>
                      <CopyButton value={contact.mobilePhone} />
                    </div>
                  </DetailRow>
                )}

                {contact.website && (
                  <DetailRow icon={<Globe className="h-4 w-4" />} label="Website">
                    <a
                      href={contact.website.startsWith("http") ? contact.website : `https://${contact.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 hover:text-[#2563EB] hover:underline"
                    >
                      {contact.website.replace(/^https?:\/\//, "")}
                      <ExternalLink className="h-3 w-3 shrink-0" />
                    </a>
                  </DetailRow>
                )}

                {addressParts.length > 0 && (
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="Address">
                    <div className="space-y-0.5">
                      {contact.addressLine1 && <p>{contact.addressLine1}</p>}
                      {contact.addressLine2 && <p>{contact.addressLine2}</p>}
                      {contact.city && <p>{contact.city}</p>}
                      {contact.county && <p>{contact.county}</p>}
                      {contact.postcode && <p className="font-mono font-medium">{contact.postcode}</p>}
                    </div>
                  </DetailRow>
                )}

                {contact.company && (
                  <DetailRow icon={<Building2 className="h-4 w-4" />} label="Organisation">
                    <p>{contact.company}</p>
                    {contact.jobTitle && <p className="text-xs text-gray-400">{contact.jobTitle}</p>}
                  </DetailRow>
                )}

                {(!contact.email && !contact.phone && !contact.website && addressParts.length === 0) && (
                  <div className="p-6 text-center text-sm text-gray-400/60">No contact details recorded</div>
                )}
              </div>

              {/* Tags */}
              {contact.tags.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Tags</p>
                  <div className="flex flex-wrap gap-1.5">
                    {contact.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates footer */}
              <p className="text-xs text-gray-400 mt-4">
                Added {format(new Date(contact.createdAt), "d MMM yyyy")}
                {contact.updatedAt && contact.updatedAt !== contact.createdAt && (
                  <> · Updated {format(new Date(contact.updatedAt), "d MMM yyyy")}</>
                )}
              </p>
            </TabsContent>

            {/* ── SRA tab ───────────────────────────────────────────── */}
            {contact.type === "SOLICITOR" && (
              <TabsContent value="sra" className="mt-0">
                <div className="rounded-lg border divide-y">
                  {contact.sraNumber ? (
                    <>
                      <DetailRow icon={<Hash className="h-4 w-4" />} label="SRA Number">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{contact.sraNumber}</span>
                          <CopyButton value={contact.sraNumber} />
                          {sraProfileUrl && (
                            <a href={sraProfileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#2563EB] hover:underline flex items-center gap-0.5">
                              SRA Register <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </DetailRow>

                      <DetailRow
                        icon={contact.sraVerified ? <ShieldCheck className="h-4 w-4 text-green-600" /> : <ShieldAlert className="h-4 w-4 text-amber-500" />}
                        label="Verification Status"
                      >
                        <div className="flex items-center gap-2 flex-wrap">
                          {contact.sraVerified ? (
                            <span className="font-medium text-green-700">{contact.sraStatus ?? "Authorised"}</span>
                          ) : (
                            <span className="font-medium text-amber-600">{contact.sraStatus ?? "Not verified"}</span>
                          )}
                          {contact.sraVerifiedAt && (() => {
                            const days = Math.floor((Date.now() - new Date(contact.sraVerifiedAt).getTime()) / 86400000)
                            return (
                              <span className={`inline-flex items-center gap-1 text-xs ${days > 30 ? "text-amber-600" : "text-gray-400"}`}>
                                <Clock className="h-3 w-3" />
                                {days === 0 ? "Today" : `${days}d ago`}
                                {days > 30 && " — re-verify recommended"}
                              </span>
                            )
                          })()}
                        </div>
                      </DetailRow>

                      {contact.sraDisplayName && (
                        <DetailRow icon={<Building2 className="h-4 w-4" />} label="Registered Name">
                          <span className="font-medium">{contact.sraDisplayName}</span>
                        </DetailRow>
                      )}

                      {contact.sraVerifiedAt && (
                        <DetailRow icon={<Clock className="h-4 w-4" />} label="Last Verified">
                          {format(new Date(contact.sraVerifiedAt), "d MMMM yyyy 'at' HH:mm")}
                        </DetailRow>
                      )}
                    </>
                  ) : (
                    <div className="p-6 text-center text-sm text-gray-400/60">
                      No SRA number recorded.
                      <button onClick={() => setIsFormOpen(true)} className="ml-1 text-[#2563EB] hover:underline">Add one?</button>
                    </div>
                  )}

                  {contact.practiceAreas.length > 0 && (
                    <DetailRow icon={<Scale className="h-4 w-4" />} label="Practice Areas">
                      <div className="flex flex-wrap gap-1.5">
                        {contact.practiceAreas.map((area) => (
                          <Badge key={area} variant="outline" className="text-xs">{area}</Badge>
                        ))}
                      </div>
                    </DetailRow>
                  )}
                </div>
              </TabsContent>
            )}

            {/* ── Notes tab ─────────────────────────────────────────── */}
            <TabsContent value="notes" className="mt-0">
              {contact.notes ? (
                <div className="rounded-lg border p-4 text-sm whitespace-pre-wrap">{contact.notes}</div>
              ) : (
                <div className="rounded-lg border p-8 text-center text-sm text-gray-400/60">
                  No notes recorded.
                  <button onClick={() => setIsFormOpen(true)} className="ml-1 text-[#2563EB] hover:underline">Add notes?</button>
                </div>
              )}
            </TabsContent>

            {/* ── Links tab ─────────────────────────────────────────── */}
            <TabsContent value="links" className="mt-0">
              <div className="rounded-lg border divide-y">
                <div className="p-4 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium">{contact._count.vendorLeads} Vendor Lead{contact._count.vendorLeads !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-gray-400">This contact is assigned as solicitor on these leads</p>
                  </div>
                </div>
                <div className="p-4 flex items-center gap-3">
                  <Users className="h-5 w-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="font-medium">{contact._count.investors} Investor{contact._count.investors !== 1 ? "s" : ""}</p>
                    <p className="text-xs text-gray-400">This contact is the default solicitor for these investors</p>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Edit form dialog */}
      <ContactFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        contact={contact}
        onSave={handleSaved}
      />
    </>
  )
}
