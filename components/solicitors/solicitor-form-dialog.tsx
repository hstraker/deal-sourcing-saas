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
import { Loader2, ExternalLink, Search, ShieldCheck, ShieldAlert } from "lucide-react"
import { toast } from "sonner"
import { SRABadge } from "./sra-badge"
import { cn } from "@/lib/utils"

export interface Solicitor {
  id: string
  name: string
  firmName: string
  sraNumber: string | null
  email: string | null
  phone: string | null
  website: string | null
  address: string | null
  specialisation: string | null
  notes: string | null
  sraVerified: boolean
  sraVerifiedAt: string | null
  sraStatus: string | null
  sraDisplayName: string | null
}

interface SRAMatch {
  sraNumber: string
  displayName: string
  firmName: string | null
  status: string | null
}

interface SolicitorFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  solicitor?: Solicitor | null   // if provided → edit mode
  onSave: (solicitor: Solicitor) => void
}

export function SolicitorFormDialog({
  open,
  onOpenChange,
  solicitor,
  onSave,
}: SolicitorFormDialogProps) {
  const isEditing = !!solicitor

  const [name, setName] = useState(solicitor?.name ?? "")
  const [firmName, setFirmName] = useState(solicitor?.firmName ?? "")
  const [sraNumber, setSraNumber] = useState(solicitor?.sraNumber ?? "")
  const [email, setEmail] = useState(solicitor?.email ?? "")
  const [phone, setPhone] = useState(solicitor?.phone ?? "")
  const [website, setWebsite] = useState(solicitor?.website ?? "")
  const [address, setAddress] = useState(solicitor?.address ?? "")
  const [specialisation, setSpecialisation] = useState(solicitor?.specialisation ?? "")
  const [notes, setNotes] = useState(solicitor?.notes ?? "")
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState<Solicitor | null>(null)

  // Pre-save SRA lookup state
  const [isSraSearching, setIsSraSearching] = useState(false)
  const [sraMatches, setSraMatches] = useState<SRAMatch[] | null>(null)
  const [sraSearchEmpty, setSraSearchEmpty] = useState(false)

  // Reset form state when dialog opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setName(solicitor?.name ?? "")
      setFirmName(solicitor?.firmName ?? "")
      setSraNumber(solicitor?.sraNumber ?? "")
      setEmail(solicitor?.email ?? "")
      setPhone(solicitor?.phone ?? "")
      setWebsite(solicitor?.website ?? "")
      setAddress(solicitor?.address ?? "")
      setSpecialisation(solicitor?.specialisation ?? "")
      setNotes(solicitor?.notes ?? "")
      setSaved(null)
      setSraMatches(null)
      setSraSearchEmpty(false)
    }
    onOpenChange(v)
  }

  // Search SRA register by firm name (pre-save — just populates dropdown)
  const handleSraSearch = async () => {
    const term = firmName.trim()
    if (!term) {
      toast.error("Enter a firm name first")
      return
    }
    setIsSraSearching(true)
    setSraMatches(null)
    setSraSearchEmpty(false)
    try {
      const res = await fetch(`/api/solicitors/search-sra?q=${encodeURIComponent(term)}`)
      const data = await res.json()
      const matches: SRAMatch[] = data.results ?? []
      if (matches.length === 0) {
        setSraSearchEmpty(true)
      } else {
        setSraMatches(matches)
      }
    } catch {
      toast.error("Could not reach SRA register — try again")
    } finally {
      setIsSraSearching(false)
    }
  }

  // Select a match from the dropdown — just pre-fills the SRA number field
  const handleSelectMatch = (match: SRAMatch) => {
    setSraNumber(match.sraNumber)
    setSraMatches(null)
    setSraSearchEmpty(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !firmName.trim()) {
      toast.error("Name and firm name are required")
      return
    }

    setIsSaving(true)
    try {
      const url = isEditing ? `/api/solicitors/${solicitor!.id}` : "/api/solicitors"
      const method = isEditing ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, firmName, sraNumber, email, phone, website, address, specialisation, notes }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409) {
          toast.error("A solicitor with this SRA number already exists")
          return
        }
        throw new Error(data.error ?? "Failed to save solicitor")
      }

      const result = data.solicitor as Solicitor
      setSaved(result)
      onSave(result)
      toast.success(isEditing ? "Solicitor updated" : "Solicitor added")

      // Auto-verify if we have an SRA number
      if (sraNumber.trim()) {
        verifySaved(result.id)
      }
    } catch (err: any) {
      toast.error(err.message ?? "Failed to save solicitor")
    } finally {
      setIsSaving(false)
    }
  }

  // Run SRA verification on the saved record
  const verifySaved = async (solicitorId: string) => {
    try {
      const verifyRes = await fetch(`/api/solicitors/${solicitorId}/verify-sra`, { method: "POST" })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) return
      const updated = verifyData.solicitor as Solicitor
      setSaved(updated)
      onSave(updated)
    } catch {
      // verification is best-effort
    }
  }

  const sraProfileUrl = sraNumber.trim()
    ? `https://www.sra.org.uk/consumers/register/individual/?id=${encodeURIComponent(sraNumber.trim())}`
    : null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Solicitor" : "Add Solicitor"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update solicitor details in the shared registry."
              : "Add a solicitor to the shared registry."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sol-name">Full Name *</Label>
              <Input
                id="sol-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-firm">Firm Name *</Label>
              <Input
                id="sol-firm"
                value={firmName}
                onChange={(e) => {
                  setFirmName(e.target.value)
                  // Clear previous search results when firm name changes
                  setSraMatches(null)
                  setSraSearchEmpty(false)
                }}
                placeholder="Smith & Co Solicitors"
                required
              />
            </div>
          </div>

          {/* SRA Number with inline search */}
          <div className="space-y-1.5">
            <Label htmlFor="sol-sra" className="flex items-center gap-2">
              SRA Number
              <span className="text-xs font-normal text-gray-400">(optional)</span>
              {sraProfileUrl && (
                <a
                  href={sraProfileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-xs text-gray-400 hover:text-gray-900 font-normal ml-auto"
                >
                  View on SRA register <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </Label>

            <div className="flex gap-2">
              <Input
                id="sol-sra"
                value={sraNumber}
                onChange={(e) => setSraNumber(e.target.value)}
                placeholder="e.g. 561444"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={handleSraSearch}
                disabled={!firmName.trim() || isSraSearching}
                title="Search SRA register by firm name"
              >
                {isSraSearching
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Search className="h-3.5 w-3.5" />
                }
                Find
              </Button>
            </div>

            {/* Search results dropdown */}
            {sraMatches !== null && sraMatches.length > 0 && (
              <div className="rounded-md border shadow-sm divide-y overflow-hidden">
                <p className="px-3 py-1.5 text-xs text-gray-400 bg-gray-50">
                  {sraMatches.length} match{sraMatches.length > 1 ? "es" : ""} found — select the correct firm:
                </p>
                <div className="max-h-52 overflow-y-auto divide-y">
                  {sraMatches.map((match) => (
                    <button
                      key={match.sraNumber}
                      type="button"
                      onClick={() => handleSelectMatch(match)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{match.displayName}</p>
                          <p className="text-xs text-gray-400">SRA: {match.sraNumber}</p>
                        </div>
                        {match.status && (
                          <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                            /authoris/i.test(match.status)
                              ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                          )}>
                            {/authoris/i.test(match.status)
                              ? <ShieldCheck className="h-3 w-3" />
                              : <ShieldAlert className="h-3 w-3" />
                            }
                            {match.status}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setSraMatches(null)}
                  className="w-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-900 text-left bg-gray-50 hover:bg-gray-50 transition-colors"
                >
                  None of these — I'll enter the SRA number manually
                </button>
              </div>
            )}

            {/* No matches found */}
            {sraSearchEmpty && !isSraSearching && (
              <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 px-3 py-2">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  No results found for &ldquo;{firmName}&rdquo;. You can enter the SRA number manually above — look it up at{" "}
                  <a
                    href="https://www.sra.org.uk/consumers/register/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-900"
                  >
                    sra.org.uk/consumers/register
                  </a>
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sol-email">Email</Label>
              <Input
                id="sol-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@smithco.co.uk"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sol-phone">Phone</Label>
              <Input
                id="sol-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="020 7123 4567"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-website">Website</Label>
            <Input
              id="sol-website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.firmname.co.uk"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-address">Office Address</Label>
            <Textarea
              id="sol-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={"12 High Street\nLondon\nSW1A 1AA"}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-spec">Specialisation</Label>
            <Input
              id="sol-spec"
              value={specialisation}
              onChange={(e) => setSpecialisation(e.target.value)}
              placeholder="Conveyancing, Residential Property"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sol-notes">Notes</Label>
            <Textarea
              id="sol-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes…"
              rows={2}
            />
          </div>

          {/* Post-save SRA badge */}
          {saved?.sraVerified && (
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-800 dark:bg-green-900/20">
              <SRABadge
                solicitor={saved}
                onVerified={(updated) => setSaved((prev) => prev ? { ...prev, ...updated } : prev)}
              />
            </div>
          )}

          {saved && !saved.sraVerified && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-900/20">
              <p className="text-amber-800 dark:text-amber-300 mb-1.5 font-medium">
                Solicitor saved — SRA authorisation not yet verified
              </p>
              <SRABadge
                solicitor={saved}
                onVerified={(updated) => setSaved((prev) => prev ? { ...prev, ...updated } : prev)}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {saved ? "Close" : "Cancel"}
            </Button>
            {!saved && (
              <Button type="submit" disabled={isSaving}>
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {isEditing ? "Save Changes" : "Add Solicitor"}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
