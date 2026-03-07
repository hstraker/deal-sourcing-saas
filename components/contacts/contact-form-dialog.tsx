"use client"

import { useState } from "react"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Loader2, Search, ShieldCheck, ShieldAlert, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import type { ContactWithCounts } from "@/types/contacts"
import type { ContactType } from "@prisma/client"

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  SOLICITOR: "Solicitor",
  INVESTOR_CONTACT: "Investor Contact",
  VENDOR_CONTACT: "Vendor Contact",
  ESTATE_AGENT: "Estate Agent",
  CONTRACTOR: "Contractor",
  OTHER: "Other",
}

interface SRAMatch {
  sraNumber: string
  displayName: string
  firmName: string | null
  status: string | null
}

interface ContactFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: ContactWithCounts | null
  defaultType?: ContactType
  onSave: (contact: ContactWithCounts) => void
}

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  defaultType = "SOLICITOR",
  onSave,
}: ContactFormDialogProps) {
  const isEditing = !!contact

  const [type, setType] = useState<ContactType>(contact?.type ?? defaultType)
  const [firstName, setFirstName] = useState(contact?.firstName ?? "")
  const [lastName, setLastName] = useState(contact?.lastName ?? "")
  const [company, setCompany] = useState(contact?.company ?? "")
  const [jobTitle, setJobTitle] = useState(contact?.jobTitle ?? "")
  const [email, setEmail] = useState(contact?.email ?? "")
  const [phone, setPhone] = useState(contact?.phone ?? "")
  const [mobilePhone, setMobilePhone] = useState(contact?.mobilePhone ?? "")
  const [addressLine1, setAddressLine1] = useState(contact?.addressLine1 ?? "")
  const [city, setCity] = useState(contact?.city ?? "")
  const [postcode, setPostcode] = useState(contact?.postcode ?? "")
  const [website, setWebsite] = useState(contact?.website ?? "")
  const [sraNumber, setSraNumber] = useState(contact?.sraNumber ?? "")
  const [notes, setNotes] = useState(contact?.notes ?? "")
  const [isPreferred, setIsPreferred] = useState(contact?.isPreferred ?? false)
  const [isSaving, setIsSaving] = useState(false)

  // SRA search state (solicitors only)
  const [isSraSearching, setIsSraSearching] = useState(false)
  const [sraMatches, setSraMatches] = useState<SRAMatch[] | null>(null)
  const [sraSearchEmpty, setSraSearchEmpty] = useState(false)

  const handleOpenChange = (v: boolean) => {
    if (v) {
      setType(contact?.type ?? defaultType)
      setFirstName(contact?.firstName ?? "")
      setLastName(contact?.lastName ?? "")
      setCompany(contact?.company ?? "")
      setJobTitle(contact?.jobTitle ?? "")
      setEmail(contact?.email ?? "")
      setPhone(contact?.phone ?? "")
      setMobilePhone(contact?.mobilePhone ?? "")
      setAddressLine1(contact?.addressLine1 ?? "")
      setCity(contact?.city ?? "")
      setPostcode(contact?.postcode ?? "")
      setWebsite(contact?.website ?? "")
      setSraNumber(contact?.sraNumber ?? "")
      setNotes(contact?.notes ?? "")
      setIsPreferred(contact?.isPreferred ?? false)
      setSraMatches(null)
      setSraSearchEmpty(false)
    }
    onOpenChange(v)
  }

  const handleSraSearch = async () => {
    const term = company.trim()
    if (!term) { toast.error("Enter a firm name first"); return }
    setIsSraSearching(true)
    setSraMatches(null)
    setSraSearchEmpty(false)
    try {
      const res = await fetch(`/api/solicitors/search-sra?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      const matches: SRAMatch[] = data.results ?? []
      if (matches.length === 0) setSraSearchEmpty(true)
      else setSraMatches(matches)
    } catch {
      toast.error("Could not reach SRA register — try again")
    } finally {
      setIsSraSearching(false)
    }
  }

  const handleSelectMatch = (match: SRAMatch) => {
    setSraNumber(match.sraNumber)
    setSraMatches(null)
    setSraSearchEmpty(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required")
      return
    }

    setIsSaving(true)
    try {
      const url = isEditing ? `/api/contacts/${contact!.id}` : "/api/contacts"
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          company: company || null,
          jobTitle: jobTitle || null,
          email: email || null,
          phone: phone || null,
          mobilePhone: mobilePhone || null,
          addressLine1: addressLine1 || null,
          city: city || null,
          postcode: postcode || null,
          website: website || null,
          sraNumber: sraNumber || null,
          notes: notes || null,
          isPreferred,
        }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("A contact with this SRA number already exists")
          return
        }
        throw new Error(data.error ?? "Failed to save contact")
      }

      const result = data.contact as ContactWithCounts

      // Auto-verify SRA if we have a number (solicitors only)
      if (type === "SOLICITOR" && sraNumber.trim()) {
        try {
          const verifyRes = await fetch(`/api/contacts/${result.id}/verify-sra`, { method: "POST" })
          const verifyData = await verifyRes.json()
          if (verifyRes.ok) {
            onSave(verifyData.contact as ContactWithCounts)
            toast.success(isEditing ? "Contact updated" : "Contact added")
            onOpenChange(false)
            return
          }
        } catch {
          // verification is best-effort
        }
      }

      onSave(result)
      toast.success(isEditing ? "Contact updated" : "Contact added")
      onOpenChange(false)
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save contact")
    } finally {
      setIsSaving(false)
    }
  }

  const sraProfileUrl = sraNumber.trim()
    ? `https://www.sra.org.uk/consumers/register/individual/?id=${encodeURIComponent(sraNumber.trim())}`
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Contact" : "Add Contact"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Update contact details." : "Add a new contact to the registry."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type */}
          <div className="space-y-1.5">
            <Label>Contact Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ContactType)} disabled={isEditing}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((t) => (
                  <SelectItem key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="con-first">First Name *</Label>
              <Input id="con-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="con-last">Last Name *</Label>
              <Input id="con-last" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" required />
            </div>
          </div>

          {/* Company / Firm */}
          <div className="space-y-1.5">
            <Label htmlFor="con-company">{type === "SOLICITOR" ? "Firm Name" : "Company"}</Label>
            <Input
              id="con-company"
              value={company}
              onChange={(e) => {
                setCompany(e.target.value)
                setSraMatches(null)
                setSraSearchEmpty(false)
              }}
              placeholder={type === "SOLICITOR" ? "Smith & Co Solicitors" : "Company name"}
            />
          </div>

          {/* Job Title (non-solicitors) */}
          {type !== "SOLICITOR" && (
            <div className="space-y-1.5">
              <Label htmlFor="con-title">Job Title</Label>
              <Input id="con-title" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Agent" />
            </div>
          )}

          {/* SRA Number (solicitors only) */}
          {type === "SOLICITOR" && (
            <div className="space-y-1.5">
              <Label htmlFor="con-sra" className="flex items-center gap-2">
                SRA Number
                <span className="text-xs font-normal text-gray-400">(optional)</span>
                {sraProfileUrl && (
                  <a href={sraProfileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-900 font-normal ml-auto">
                    View on SRA register <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Label>
              <div className="flex gap-2">
                <Input id="con-sra" value={sraNumber} onChange={(e) => setSraNumber(e.target.value)} placeholder="e.g. 561444" className="flex-1" />
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handleSraSearch} disabled={!company.trim() || isSraSearching} title="Search SRA register by firm name">
                  {isSraSearching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                  Find
                </Button>
              </div>

              {sraMatches !== null && sraMatches.length > 0 && (
                <div className="rounded-md border shadow-sm divide-y overflow-hidden">
                  <p className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50">
                    {sraMatches.length} match{sraMatches.length > 1 ? "es" : ""} found — select the correct firm:
                  </p>
                  <div className="max-h-52 overflow-y-auto divide-y">
                    {sraMatches.map((match) => (
                      <button key={match.sraNumber} type="button" onClick={() => handleSelectMatch(match)} className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{match.displayName}</p>
                            <p className="text-xs text-gray-400">SRA: {match.sraNumber}</p>
                          </div>
                          {match.status && (
                            <span className={cn(
                              "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                              /authoris/i.test(match.status)
                                ? "bg-green-100 text-green-700"
                                : "bg-amber-100 text-amber-700"
                            )}>
                              {/authoris/i.test(match.status) ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                              {match.status}
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setSraMatches(null)} className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-900 text-left bg-gray-50 hover:bg-gray-50 transition-colors">
                    None of these — I&apos;ll enter the SRA number manually
                  </button>
                </div>
              )}

              {sraSearchEmpty && !isSraSearching && (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                  <p className="text-xs text-amber-700">
                    No results found for &ldquo;{company}&rdquo;. Enter the SRA number manually above — look it up at{" "}
                    <a href="https://www.sra.org.uk/consumers/register/" target="_blank" rel="noopener noreferrer" className="underline hover:text-amber-900">
                      sra.org.uk/consumers/register
                    </a>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Website (solicitors only) */}
          {type === "SOLICITOR" && (
            <div className="space-y-1.5">
              <Label htmlFor="con-website">Website</Label>
              <Input id="con-website" type="text" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="www.firmname.co.uk" />
            </div>
          )}

          {/* Contact details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="con-email">Email</Label>
              <Input id="con-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.co.uk" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="con-phone">Phone</Label>
              <Input id="con-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="020 7123 4567" />
            </div>
          </div>

          {/* Address */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="con-addr">Address</Label>
              <Input id="con-addr" value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} placeholder="12 High Street" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="con-city">City</Label>
              <Input id="con-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="London" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="con-postcode">Postcode</Label>
              <Input id="con-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} placeholder="SW1A 1AA" />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="con-notes">Notes</Label>
            <Textarea id="con-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional notes…" rows={2} />
          </div>

          {/* Preferred toggle */}
          <div className="flex items-center gap-2">
            <input
              id="con-preferred"
              type="checkbox"
              checked={isPreferred}
              onChange={(e) => setIsPreferred(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="con-preferred" className="font-normal cursor-pointer">Mark as preferred contact</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEditing ? "Save Changes" : "Add Contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
