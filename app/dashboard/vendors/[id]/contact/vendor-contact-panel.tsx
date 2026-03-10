"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  User,
  Phone,
  Mail,
  Home,
  TrendingUp,
  Clock,
  Edit,
  Save,
  X,
  Loader2,
  AlertTriangle,
  MessageSquare,
  BedDouble,
  Bath,
  Maximize2,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/format"

interface Lead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  vendorAddress: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  propertyType: string | null
  bedrooms: number | null
  bathrooms: number | null
  squareFeet: number | null
  condition: string | null
  askingPrice: number | null
  estimatedMonthlyRent: number | null
  pipelineStage: string
  motivationScore: number | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  timelineDays: number | null
  competingOffers: boolean | null
  lastContactAt: string | null
  conversationStartedAt: string | null
  retryCount: number
}

interface EditForm {
  vendorName: string
  vendorPhone: string
  vendorEmail: string
  vendorAddress: string
  propertyAddress: string
  propertyPostcode: string
  propertyType: string
  bedrooms: string
  bathrooms: string
  squareFeet: string
  condition: string
  askingPrice: string
  estimatedMonthlyRent: string
  pipelineStage: string
  motivationScore: string
  urgencyLevel: string
  reasonForSelling: string
  timelineDays: string
  competingOffers: boolean
}

const formatDate = (d: string | null) => {
  if (!d) return "—"
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatTimeAgo = (d: string | null) => {
  if (!d) return "Never"
  const diff = Date.now() - new Date(d).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return "Just now"
}

const motivationColour = (score: number) =>
  score >= 8 ? "bg-green-100 text-green-800" : score >= 5 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"

export function VendorContactPanel({ initialLead }: { initialLead: Lead }) {
  const [lead, setLead] = useState<Lead>(initialLead)
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editForm, setEditForm] = useState<EditForm>({
    vendorName: lead.vendorName,
    vendorPhone: lead.vendorPhone,
    vendorEmail: lead.vendorEmail ?? "",
    vendorAddress: lead.vendorAddress ?? "",
    propertyAddress: lead.propertyAddress ?? "",
    propertyPostcode: lead.propertyPostcode ?? "",
    propertyType: lead.propertyType ?? "",
    bedrooms: lead.bedrooms != null ? String(lead.bedrooms) : "",
    bathrooms: lead.bathrooms != null ? String(lead.bathrooms) : "",
    squareFeet: lead.squareFeet != null ? String(lead.squareFeet) : "",
    condition: lead.condition ?? "",
    askingPrice: lead.askingPrice != null ? String(lead.askingPrice) : "",
    estimatedMonthlyRent: lead.estimatedMonthlyRent != null ? String(lead.estimatedMonthlyRent) : "",
    pipelineStage: lead.pipelineStage,
    motivationScore: lead.motivationScore != null ? String(lead.motivationScore) : "",
    urgencyLevel: lead.urgencyLevel ?? "",
    reasonForSelling: lead.reasonForSelling ?? "",
    timelineDays: lead.timelineDays != null ? String(lead.timelineDays) : "",
    competingOffers: lead.competingOffers ?? false,
  })

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const res = await fetch(`/api/vendor-leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: editForm.vendorName,
          vendorPhone: editForm.vendorPhone,
          vendorEmail: editForm.vendorEmail || null,
          vendorAddress: editForm.vendorAddress || null,
          propertyAddress: editForm.propertyAddress || null,
          propertyPostcode: editForm.propertyPostcode || null,
          propertyType: editForm.propertyType || null,
          bedrooms: editForm.bedrooms ? parseInt(editForm.bedrooms) : null,
          bathrooms: editForm.bathrooms ? parseFloat(editForm.bathrooms) : null,
          squareFeet: editForm.squareFeet ? parseInt(editForm.squareFeet) : null,
          condition: editForm.condition || null,
          askingPrice: editForm.askingPrice ? parseFloat(editForm.askingPrice) : null,
          estimatedMonthlyRent: editForm.estimatedMonthlyRent ? parseFloat(editForm.estimatedMonthlyRent) : null,
          pipelineStage: editForm.pipelineStage,
          motivationScore: editForm.motivationScore ? parseInt(editForm.motivationScore) : null,
          urgencyLevel: editForm.urgencyLevel || null,
          reasonForSelling: editForm.reasonForSelling || null,
          timelineDays: editForm.timelineDays ? parseInt(editForm.timelineDays) : null,
          competingOffers: editForm.competingOffers,
        }),
      })
      if (!res.ok) throw new Error("Save failed")
      const updated = await res.json()
      setLead((prev) => ({
        ...prev,
        ...updated,
        askingPrice: updated.askingPrice != null ? Number(updated.askingPrice) : null,
        estimatedMonthlyRent: updated.estimatedMonthlyRent != null ? Number(updated.estimatedMonthlyRent) : null,
      }))
      setIsEditing(false)
      toast.success("Lead updated")
    } catch {
      toast.error("Failed to save changes")
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditForm({
      vendorName: lead.vendorName,
      vendorPhone: lead.vendorPhone,
      vendorEmail: lead.vendorEmail ?? "",
      vendorAddress: lead.vendorAddress ?? "",
      propertyAddress: lead.propertyAddress ?? "",
      propertyPostcode: lead.propertyPostcode ?? "",
      propertyType: lead.propertyType ?? "",
      bedrooms: lead.bedrooms != null ? String(lead.bedrooms) : "",
      bathrooms: lead.bathrooms != null ? String(lead.bathrooms) : "",
      squareFeet: lead.squareFeet != null ? String(lead.squareFeet) : "",
      condition: lead.condition ?? "",
      askingPrice: lead.askingPrice != null ? String(lead.askingPrice) : "",
      estimatedMonthlyRent: lead.estimatedMonthlyRent != null ? String(lead.estimatedMonthlyRent) : "",
      pipelineStage: lead.pipelineStage,
      motivationScore: lead.motivationScore != null ? String(lead.motivationScore) : "",
      urgencyLevel: lead.urgencyLevel ?? "",
      reasonForSelling: lead.reasonForSelling ?? "",
      timelineDays: lead.timelineDays != null ? String(lead.timelineDays) : "",
      competingOffers: lead.competingOffers ?? false,
    })
    setIsEditing(false)
  }

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-end gap-2">
        {isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
              <X className="h-3.5 w-3.5 mr-1.5" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Save changes
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
        )}
      </div>

      {/* Row 1: Contact + Property */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Contact */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <User className="h-4 w-4 text-[#2563EB]" />
              Vendor Contact
            </h3>
          </div>
          <div className="p-5 space-y-2">
            {isEditing ? (
              <>
                <div>
                  <Label>Name *</Label>
                  <Input value={editForm.vendorName} onChange={(e) => setEditForm({ ...editForm, vendorName: e.target.value })} />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input value={editForm.vendorPhone} onChange={(e) => setEditForm({ ...editForm, vendorPhone: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={editForm.vendorEmail} onChange={(e) => setEditForm({ ...editForm, vendorEmail: e.target.value })} />
                </div>
                <div>
                  <Label>Vendor Address</Label>
                  <Textarea value={editForm.vendorAddress} onChange={(e) => setEditForm({ ...editForm, vendorAddress: e.target.value })} rows={2} />
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <User className="h-4 w-4 text-gray-400 shrink-0" />
                  <span className="font-semibold text-sm">{lead.vendorName}</span>
                </div>
                <a href={`tel:${lead.vendorPhone}`} className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 hover:bg-green-100 transition-colors">
                  <Phone className="h-4 w-4 text-green-700 shrink-0" />
                  <span className="font-medium text-sm text-green-800">{lead.vendorPhone}</span>
                </a>
                {lead.vendorEmail && (
                  <a href={`mailto:${lead.vendorEmail}`} className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 hover:bg-blue-100 transition-colors">
                    <Mail className="h-4 w-4 text-blue-700 shrink-0" />
                    <span className="font-medium text-sm text-blue-800 truncate">{lead.vendorEmail}</span>
                  </a>
                )}
                {lead.vendorAddress && (
                  <p className="text-sm text-gray-500 px-1">{lead.vendorAddress}</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Property */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Home className="h-4 w-4 text-[#2563EB]" />
              Property
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {isEditing ? (
              <>
                <div>
                  <Label>Address</Label>
                  <Textarea value={editForm.propertyAddress} onChange={(e) => setEditForm({ ...editForm, propertyAddress: e.target.value })} rows={2} />
                </div>
                <div>
                  <Label>Postcode</Label>
                  <Input value={editForm.propertyPostcode} onChange={(e) => setEditForm({ ...editForm, propertyPostcode: e.target.value })} placeholder="e.g. SA5 7AB" />
                </div>
                <div>
                  <Label>Property Type</Label>
                  <Select value={editForm.propertyType} onValueChange={(v) => setEditForm({ ...editForm, propertyType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>
                      {["Terraced", "Semi-Detached", "Detached", "Flat", "Bungalow", "HMO", "Commercial"].map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Bedrooms</Label>
                    <Input type="number" value={editForm.bedrooms} onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })} />
                  </div>
                  <div>
                    <Label>Bathrooms</Label>
                    <Input type="number" step="0.5" value={editForm.bathrooms} onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Sq ft</Label>
                    <Input type="number" value={editForm.squareFeet} onChange={(e) => setEditForm({ ...editForm, squareFeet: e.target.value })} />
                  </div>
                  <div>
                    <Label>Condition</Label>
                    <Select value={editForm.condition} onValueChange={(v) => setEditForm({ ...editForm, condition: v })}>
                      <SelectTrigger><SelectValue placeholder="Condition" /></SelectTrigger>
                      <SelectContent>
                        {["Excellent", "Good", "Fair", "Poor", "Derelict"].map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Asking Price (£)</Label>
                    <Input type="number" value={editForm.askingPrice} onChange={(e) => setEditForm({ ...editForm, askingPrice: e.target.value })} />
                  </div>
                  <div>
                    <Label>Monthly Rent (£)</Label>
                    <Input type="number" value={editForm.estimatedMonthlyRent} onChange={(e) => setEditForm({ ...editForm, estimatedMonthlyRent: e.target.value })} />
                  </div>
                </div>
              </>
            ) : (
              <>
                {lead.propertyAddress && (
                  <p className="text-sm text-gray-700">{lead.propertyAddress}{lead.propertyPostcode && `, ${lead.propertyPostcode}`}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm">
                  {lead.propertyType && (
                    <span className="flex items-center gap-1 text-gray-600"><Home className="h-3.5 w-3.5 text-gray-400" />{lead.propertyType}</span>
                  )}
                  {lead.bedrooms != null && (
                    <span className="flex items-center gap-1 text-gray-600"><BedDouble className="h-3.5 w-3.5 text-gray-400" />{lead.bedrooms} bed</span>
                  )}
                  {lead.bathrooms != null && (
                    <span className="flex items-center gap-1 text-gray-600"><Bath className="h-3.5 w-3.5 text-gray-400" />{lead.bathrooms} bath</span>
                  )}
                  {lead.squareFeet != null && (
                    <span className="flex items-center gap-1 text-gray-600"><Maximize2 className="h-3.5 w-3.5 text-gray-400" />{lead.squareFeet.toLocaleString()} sq ft</span>
                  )}
                </div>
                {lead.condition && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">Condition</span>
                    <span className="text-xs font-medium text-gray-700">{lead.condition}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 border-t border-[var(--ds-border)] pt-3">
                  <div>
                    <p className="text-xs text-gray-400">Asking Price</p>
                    <p className="text-sm font-semibold text-gray-900">{lead.askingPrice ? formatCurrency(lead.askingPrice) : "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Est. Monthly Rent</p>
                    <p className="text-sm font-semibold text-gray-900">{lead.estimatedMonthlyRent ? formatCurrency(lead.estimatedMonthlyRent) : "—"}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Seller Intel + Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Seller Intelligence */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#2563EB]" />
              Seller Intelligence
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {isEditing ? (
              <>
                <div>
                  <Label>Motivation Score (1-10)</Label>
                  <Input type="number" min="1" max="10" value={editForm.motivationScore} onChange={(e) => setEditForm({ ...editForm, motivationScore: e.target.value })} />
                </div>
                <div>
                  <Label>Urgency Level</Label>
                  <Select value={editForm.urgencyLevel} onValueChange={(v) => setEditForm({ ...editForm, urgencyLevel: v })}>
                    <SelectTrigger><SelectValue placeholder="Select urgency" /></SelectTrigger>
                    <SelectContent>
                      {["urgent", "quick", "moderate", "flexible"].map((u) => (
                        <SelectItem key={u} value={u} className="capitalize">{u}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Timeline (days)</Label>
                  <Input type="number" value={editForm.timelineDays} onChange={(e) => setEditForm({ ...editForm, timelineDays: e.target.value })} />
                </div>
                <div>
                  <Label>Reason for Selling</Label>
                  <Select value={editForm.reasonForSelling} onValueChange={(v) => setEditForm({ ...editForm, reasonForSelling: v })}>
                    <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                    <SelectContent>
                      {["relocation", "financial", "divorce", "inheritance", "downsize", "other"].map((r) => (
                        <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="competingOffers" checked={editForm.competingOffers} onChange={(e) => setEditForm({ ...editForm, competingOffers: e.target.checked })} className="h-4 w-4" />
                  <Label htmlFor="competingOffers" className="cursor-pointer">Has Competing Offers</Label>
                </div>
              </>
            ) : (
              <>
                {lead.motivationScore != null && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-400">Motivation</span>
                      <Badge className={motivationColour(lead.motivationScore)}>{lead.motivationScore}/10</Badge>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div
                        className={cn("h-1.5 rounded-full", lead.motivationScore >= 8 ? "bg-green-500" : lead.motivationScore >= 5 ? "bg-yellow-500" : "bg-red-500")}
                        style={{ width: `${(lead.motivationScore / 10) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1.5">
                  {lead.urgencyLevel && (
                    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
                      lead.urgencyLevel === "urgent" ? "bg-red-100 text-red-800"
                        : lead.urgencyLevel === "quick" ? "bg-orange-100 text-orange-800"
                        : lead.urgencyLevel === "moderate" ? "bg-yellow-100 text-yellow-800"
                        : "bg-gray-100 text-gray-500")}>
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {lead.urgencyLevel}
                    </span>
                  )}
                  {lead.timelineDays != null && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      <Clock className="h-2.5 w-2.5" />
                      {lead.timelineDays}d timeline
                    </span>
                  )}
                  {lead.reasonForSelling && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full capitalize">
                      {lead.reasonForSelling.replace(/_/g, " ")}
                    </span>
                  )}
                  {lead.competingOffers && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                      ⚠ Competing offers
                    </span>
                  )}
                </div>
                {lead.motivationScore === null && !lead.urgencyLevel && !lead.reasonForSelling && (
                  <p className="text-xs text-gray-400 italic">No seller intelligence gathered yet</p>
                )}
              </>
            )}
          </div>
        </div>

        {/* Pipeline Status */}
        <div className="ds-card overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--ds-border)]">
            <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#2563EB]" />
              Pipeline Status
            </h3>
          </div>
          <div className="p-5 space-y-3">
            {isEditing ? (
              <div>
                <Label>Stage</Label>
                <Select value={editForm.pipelineStage} onValueChange={(v) => setEditForm({ ...editForm, pipelineStage: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[
                      ["NEW_LEAD", "New Lead"],
                      ["INITIAL_CONTACT", "Initial Contact"],
                      ["AI_CONVERSATION", "AI Conversation"],
                      ["DEAL_VALIDATION", "Deal Validation"],
                      ["VALUATION_PENDING", "Valuation Pending"],
                      ["VALUATION_COMPLETE", "Valuation Complete"],
                      ["OFFER_PREPARATION", "Offer Preparation"],
                      ["OFFER_SENT", "Offer Sent"],
                      ["NEGOTIATION", "Negotiation"],
                      ["OFFER_ACCEPTED", "Offer Accepted"],
                      ["SOLICITOR_INSTRUCTED", "Solicitor Instructed"],
                      ["LOCKOUT_SIGNED", "Lockout Signed"],
                      ["COMPLETION_PENDING", "Completion Pending"],
                      ["COMPLETED", "Completed"],
                    ].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400">Stage</span>
                  <Badge className="text-xs">{lead.pipelineStage.replace(/_/g, " ")}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    Last contact
                  </span>
                  <span suppressHydrationWarning className="text-xs font-medium">{formatTimeAgo(lead.lastContactAt)}</span>
                </div>
                {lead.conversationStartedAt && (
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-gray-400">
                      <MessageSquare className="h-3.5 w-3.5" />
                      Conv. started
                    </span>
                    <span className="text-xs">{formatDate(lead.conversationStartedAt)}</span>
                  </div>
                )}
                {lead.retryCount > 0 && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">Follow-ups sent</span>
                    <span className="text-xs font-medium">{lead.retryCount}</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
