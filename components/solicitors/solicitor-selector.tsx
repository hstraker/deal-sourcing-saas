"use client"

import { useState, useEffect, useRef } from "react"
import {
  Command, CommandEmpty, CommandGroup, CommandInput,
  CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Check, Plus, Mail, Phone, Building2, X, Loader2, Search, ShieldCheck, ShieldAlert, Globe, MapPin, Hash, Calendar, ChevronDown, ChevronUp, ExternalLink, Tag } from "lucide-react"
import { Input } from "@/components/ui/input"
import { SRABadge } from "./sra-badge"
import { SolicitorFormDialog, type Solicitor } from "./solicitor-form-dialog"
import { type SolicitorForBadge } from "./sra-badge"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

export type { Solicitor } from "./solicitor-form-dialog"

interface SolicitorSelectorProps {
  value: string | null          // solicitor ID
  onChange: (id: string | null, solicitor: Solicitor | null) => void
  initialSolicitor?: Solicitor | null  // pre-populate without requiring a list fetch
  label?: string
  readOnly?: boolean
  className?: string
}

export function SolicitorSelector({
  value,
  onChange,
  initialSolicitor = null,
  label = "Solicitor",
  readOnly = false,
  className,
}: SolicitorSelectorProps) {
  const [open, setOpen] = useState(false)
  const [solicitors, setSolicitors] = useState<Solicitor[]>([])
  const [isLoading, setIsLoading] = useState(false)
  // Seed `selected` from initialSolicitor so the card shows immediately on mount
  const [selected, setSelected] = useState<Solicitor | null>(initialSolicitor ?? null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const hasFetched = useRef(false)

  // Fetch solicitor list when popover opens (once)
  useEffect(() => {
    if (open && !hasFetched.current) {
      hasFetched.current = true
      setIsLoading(true)
      fetch("/api/solicitors")
        .then((r) => r.json())
        .then((data) => {
          const list: Solicitor[] = data.solicitors ?? []
          setSolicitors(list)
          if (value) {
            setSelected(list.find((s) => s.id === value) ?? selected)
          }
        })
        .catch(() => {})
        .finally(() => setIsLoading(false))
    }
  }, [open, value])

  // Sync selected when value changes externally (e.g. fullLead loads asynchronously)
  useEffect(() => {
    if (!value) {
      setSelected(null)
    } else if (solicitors.length > 0) {
      setSelected(solicitors.find((s) => s.id === value) ?? selected)
    } else if (initialSolicitor?.id === value) {
      // List not yet loaded but we have the initial solicitor object
      setSelected(initialSolicitor)
    }
  }, [value, solicitors, initialSolicitor])

  const handleSelect = (solicitor: Solicitor) => {
    setSelected(solicitor)
    onChange(solicitor.id, solicitor)
    setOpen(false)
  }

  const handleRemove = () => {
    setSelected(null)
    onChange(null, null)
  }

  const handleNewSolicitor = (solicitor: Solicitor) => {
    setSolicitors((prev) => [...prev, solicitor])
    handleSelect(solicitor)
    setIsFormOpen(false)
  }

  const handleBadgeUpdate = (updated: SolicitorForBadge) => {
    setSolicitors((prev) =>
      prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
    )
    if (selected?.id === updated.id) setSelected((prev) => prev ? { ...prev, ...updated } : prev)
  }

  if (readOnly && selected) {
    return <SolicitorCard solicitor={selected} onBadgeUpdate={handleBadgeUpdate} />
  }

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-9 text-left font-normal"
            disabled={readOnly}
          >
            {selected ? (
              <span className="truncate">
                {selected.name} — {selected.firmName}
              </span>
            ) : (
              <span className="text-gray-400">Search solicitors…</span>
            )}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search by name, firm, or SRA number…" />
            <CommandList>
              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Loading…
                </div>
              ) : (
                <CommandEmpty>No solicitors found.</CommandEmpty>
              )}
              <CommandGroup>
                {solicitors.map((s) => (
                  <CommandItem
                    key={s.id}
                    value={`${s.name} ${s.firmName} ${s.sraNumber}`}
                    onSelect={() => handleSelect(s)}
                    className="flex items-start gap-2 py-2"
                  >
                    <Check
                      className={cn(
                        "h-4 w-4 mt-0.5 shrink-0",
                        selected?.id === s.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-gray-400 truncate">{s.firmName}</p>
                      <div className="mt-0.5">
                        <SRABadge
                          solicitor={s}
                          showVerifyButton={false}
                          onVerified={handleBadgeUpdate}
                        />
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setIsFormOpen(true)
                  }}
                  className="text-[#2563EB]"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add new solicitor…
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected solicitor card */}
      {selected && (
        <SolicitorCard
          solicitor={selected}
          onBadgeUpdate={handleBadgeUpdate}
          onFullUpdate={(updated) => {
            setSelected(updated)
            setSolicitors((prev) =>
              prev.map((s) => (s.id === updated.id ? updated : s))
            )
          }}
          onRemove={readOnly ? undefined : handleRemove}
        />
      )}

      <SolicitorFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleNewSolicitor}
      />
    </div>
  )
}

interface SRAMatch {
  sraNumber: string
  displayName: string
  firmName: string | null
  status: string | null
}

// ---- Card shown when a solicitor is selected / assigned ----
export function SolicitorCard({
  solicitor,
  onBadgeUpdate,
  onFullUpdate,
  onRemove,
  inherited,
  inheritedLabel,
}: {
  solicitor: Solicitor
  onBadgeUpdate?: (updated: SolicitorForBadge) => void
  onFullUpdate?: (updated: Solicitor) => void
  onRemove?: () => void
  inherited?: boolean
  inheritedLabel?: string
}) {
  const [isFindingSra, setIsFindingSra] = useState(false)
  const [sraMatches, setSraMatches] = useState<SRAMatch[] | null>(null)
  const [isApplying, setIsApplying] = useState(false)
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualSraNumber, setManualSraNumber] = useState("")
  const [showContactDetails, setShowContactDetails] = useState(false)
  const [showSraDetails, setShowSraDetails] = useState(false)
  const [showPracticeAreas, setShowPracticeAreas] = useState(false)

  const handleFindOnSRA = async () => {
    setIsFindingSra(true)
    setSraMatches(null)
    setShowManualInput(false)
    try {
      const res = await fetch(
        `/api/solicitors/search-sra?q=${encodeURIComponent(solicitor.firmName)}`
      )
      const data = await res.json()
      const matches: SRAMatch[] = data.results ?? []
      if (matches.length === 0) {
        // Auto-search failed — show inline manual entry
        setShowManualInput(true)
        return
      }
      if (matches.length === 1) {
        await applyMatch(matches[0])
      } else {
        setSraMatches(matches)
      }
    } catch {
      setShowManualInput(true)
    } finally {
      setIsFindingSra(false)
    }
  }

  const handleApplyManual = async () => {
    const trimmed = manualSraNumber.trim()
    if (!trimmed) return
    setIsApplying(true)
    try {
      // Patch SRA number
      const patchRes = await fetch(`/api/solicitors/${solicitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sraNumber: trimmed }),
      })
      if (!patchRes.ok) throw new Error("Failed to save SRA number")

      // Run verification
      const verifyRes = await fetch(`/api/solicitors/${solicitor.id}/verify-sra`, { method: "POST" })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error("Verification failed")

      const updated = verifyData.solicitor as Solicitor
      onFullUpdate?.(updated)
      setShowManualInput(false)
      setManualSraNumber("")
      toast.success(
        updated.sraVerified
          ? `SRA verified: ${updated.sraStatus}`
          : `SRA number saved — status: ${updated.sraStatus ?? "Unknown"}`
      )
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply SRA number")
    } finally {
      setIsApplying(false)
    }
  }

  const applyMatch = async (match: SRAMatch) => {
    setIsApplying(true)
    try {
      // 1. Patch the SRA number onto the solicitor record
      const patchRes = await fetch(`/api/solicitors/${solicitor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sraNumber: match.sraNumber }),
      })
      if (!patchRes.ok) throw new Error("Failed to save SRA number")

      // 2. Run verification
      const verifyRes = await fetch(`/api/solicitors/${solicitor.id}/verify-sra`, {
        method: "POST",
      })
      const verifyData = await verifyRes.json()
      if (!verifyRes.ok) throw new Error("Verification failed")

      const updated = verifyData.solicitor as Solicitor
      onFullUpdate?.(updated)
      setSraMatches(null)
      toast.success(
        updated.sraVerified
          ? `SRA verified: ${updated.sraStatus}`
          : `SRA number saved — status: ${updated.sraStatus ?? "Unknown"}`
      )
    } catch (err: any) {
      toast.error(err.message ?? "Failed to apply SRA match")
    } finally {
      setIsApplying(false)
    }
  }

  const sraProfileUrl = solicitor.sraNumber
    ? `https://www.sra.org.uk/consumers/register/organisation/?sraNumber=${encodeURIComponent(solicitor.sraNumber)}`
    : null

  const verifiedDateStr = solicitor.sraVerifiedAt
    ? new Date(solicitor.sraVerifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null

  const hasContactDetails = !!(solicitor.email || solicitor.phone || solicitor.website || solicitor.address)
  const hasSraData = !!(solicitor.sraNumber || solicitor.sraStatus || verifiedDateStr)
  const hasPracticeAreas = !!(solicitor.specialisation)
  const contactPageUrl = `/dashboard/contacts/${solicitor.id}`

  return (
    <div className="rounded-xl border bg-card text-sm shadow-sm overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 flex items-center gap-3 bg-gray-50">
        {/* Avatar */}
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/10 text-[#2563EB] font-semibold text-sm select-none">
          {solicitor.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate leading-tight">{solicitor.name}</p>
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5 truncate">
            <Building2 className="h-3 w-3 shrink-0" />
            {solicitor.firmName}
          </p>
        </div>
        {/* SRA badge summary — always visible */}
        <div className="shrink-0">
          <SRABadge solicitor={solicitor} onVerified={onBadgeUpdate} />
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={contactPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-6 w-6 items-center justify-center rounded text-gray-400 hover:text-[#2563EB] hover:bg-accent transition-colors"
            title="Open contact page"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {onRemove && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-gray-400 hover:text-red-500"
              onClick={onRemove}
              title="Remove solicitor"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Collapsible: Contact Details ────────────────────────────────── */}
      {hasContactDetails && (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setShowContactDetails((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-400 hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" />
              Contact Details
            </span>
            {showContactDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showContactDetails && (
            <div className="px-4 pb-3 space-y-2 pt-1">
              {solicitor.email && (
                <a href={`mailto:${solicitor.email}`} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-900 transition-colors">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-gray-400/60" />
                  {solicitor.email}
                </a>
              )}
              {solicitor.phone && (
                <a href={`tel:${solicitor.phone}`} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-900 transition-colors">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-gray-400/60" />
                  {solicitor.phone}
                </a>
              )}
              {solicitor.website && (
                <a
                  href={solicitor.website.startsWith("http") ? solicitor.website : `https://${solicitor.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-900 transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 shrink-0 text-gray-400/60" />
                  {solicitor.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              {solicitor.address && (
                <div className="flex items-start gap-2 text-xs text-gray-400">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400/60 mt-0.5" />
                  <span className="whitespace-pre-line">{solicitor.address}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Collapsible: Practice Areas ──────────────────────────────────── */}
      {hasPracticeAreas && (
        <div className="border-t">
          <button
            type="button"
            onClick={() => setShowPracticeAreas((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-400 hover:bg-accent/50 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Tag className="h-3.5 w-3.5" />
              Practice Areas
            </span>
            {showPracticeAreas ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
          {showPracticeAreas && (
            <div className="px-4 pb-3 pt-1 flex flex-wrap gap-1.5">
              {solicitor.specialisation?.split(/,\s*/).map((area) => (
                <span key={area} className="inline-flex items-center rounded-full bg-[#2563EB]/10 px-2 py-0.5 text-xs font-medium text-[#2563EB]">
                  {area.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Collapsible: SRA Registration ────────────────────────────────── */}
      <div className="border-t">
        <button
          type="button"
          onClick={() => setShowSraDetails((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-gray-400 hover:bg-accent/50 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            SRA Registration
          </span>
          {showSraDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {showSraDetails && (
          <div className="px-4 pb-3 pt-1 space-y-2">
            {/* Find SRA button */}
            {!solicitor.sraNumber && onFullUpdate && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={handleFindOnSRA}
                disabled={isFindingSra || isApplying}
              >
                {isFindingSra ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Search className="h-3 w-3 mr-1" />}
                Find on SRA register
              </Button>
            )}

            {hasSraData && (
              <div className="space-y-1 text-xs">
                {solicitor.sraNumber && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Hash className="h-3 w-3 shrink-0" />
                    <span className="font-mono">{solicitor.sraNumber}</span>
                    {sraProfileUrl && (
                      <a href={sraProfileUrl} target="_blank" rel="noopener noreferrer" className="text-[#2563EB] hover:underline ml-auto">
                        View on SRA ↗
                      </a>
                    )}
                  </div>
                )}
                {solicitor.sraStatus && (
                  <div className="flex items-center gap-2 text-gray-400">
                    {solicitor.sraVerified
                      ? <ShieldCheck className="h-3 w-3 shrink-0 text-green-600" />
                      : <ShieldAlert className="h-3 w-3 shrink-0 text-amber-500" />
                    }
                    <span>{solicitor.sraStatus}</span>
                  </div>
                )}
                {verifiedDateStr && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>Verified {verifiedDateStr}</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual SRA entry */}
            {showManualInput && onFullUpdate && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-2 space-y-2">
                <p className="text-xs text-amber-700">
                  Not found automatically. Enter the SRA number — look it up at{" "}
                  <a href="https://www.sra.org.uk/consumers/register/" target="_blank" rel="noopener noreferrer" className="underline">
                    sra.org.uk/consumers/register
                  </a>
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="e.g. 561444"
                    value={manualSraNumber}
                    onChange={(e) => setManualSraNumber(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleApplyManual()}
                    className="h-7 text-xs"
                  />
                  <Button size="sm" className="h-7 px-2 text-xs shrink-0" onClick={handleApplyManual} disabled={!manualSraNumber.trim() || isApplying}>
                    {isApplying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Apply"}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0" onClick={() => { setShowManualInput(false); setManualSraNumber("") }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* SRA match picker */}
            {sraMatches && sraMatches.length > 1 && (
              <div className="rounded-md border p-2 space-y-1.5">
                <p className="text-xs font-medium text-gray-400">
                  {sraMatches.length} matches — select the correct firm:
                </p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sraMatches.map((match) => (
                    <button
                      key={match.sraNumber}
                      type="button"
                      onClick={() => applyMatch(match)}
                      disabled={isApplying}
                      className="w-full text-left rounded border px-2 py-1.5 text-xs hover:bg-accent transition-colors disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{match.displayName}</p>
                          <p className="text-gray-400">SRA: {match.sraNumber}</p>
                        </div>
                        {match.status && (
                          <span className={cn(
                            "shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium",
                            /authoris|regulated/i.test(match.status) ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                          )}>
                            {/authoris|regulated/i.test(match.status) ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                            {match.status}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setSraMatches(null)} className="text-xs text-gray-400 hover:text-gray-900">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Inherited label ──────────────────────────────────────────────── */}
      {inherited && inheritedLabel && (
        <div className="border-t px-4 py-2">
          <p className="text-xs text-gray-400">{inheritedLabel}</p>
        </div>
      )}
    </div>
  )
}
