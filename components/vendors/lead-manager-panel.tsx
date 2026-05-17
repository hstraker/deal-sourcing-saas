"use client"

import {
  Phone, Mail, MapPin, PoundSterling, TrendingUp,
  Home, BedDouble, Bath, Maximize2, X, Save, Loader2,
  Search, AlertTriangle, Clock, User, Layers,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

interface LeadManagerPanelProps {
  lead: {
    vendorName: string
    vendorPhone: string
    vendorEmail: string | null
    propertyAddress: string | null
    propertyPostcode: string | null
    pipelineStage: string
    askingPrice: number | null
    bmvScore: number | null
    estimatedMonthlyRent: number | null
    estimatedMarketValue: number | null
    bedrooms: number | null
    bathrooms: number | null
    condition: string | null
  }
  editForm: Record<string, any>
  setEditForm: (form: Record<string, any>) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
  onFixPostcode?: () => void
  isFixingPostcode?: boolean
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined) {
  if (n == null) return "—"
  return new Intl.NumberFormat("en-GB", {
    style: "currency", currency: "GBP", maximumFractionDigits: 0,
  }).format(n)
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
}

function stageLabel(stage: string) {
  return stage.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

function stageColour(stage: string) {
  if (stage.includes("COMPLETED")) return "bg-green-500"
  if (stage.includes("OFFER")) return "bg-violet-500"
  if (stage.includes("CONVERSATION")) return "bg-blue-500"
  if (stage.includes("VALIDATION") || stage.includes("VALUATION")) return "bg-amber-500"
  if (stage.includes("NEGOTIATION")) return "bg-orange-500"
  if (stage.includes("SOLICITOR") || stage.includes("LOCKOUT")) return "bg-teal-500"
  return "bg-gray-500"
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-3 mt-1">
      {label}
    </p>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-600">{label}</Label>
      {children}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadManagerPanel({
  lead,
  editForm,
  setEditForm,
  onSave,
  onCancel,
  isSaving,
  onFixPostcode,
  isFixingPostcode,
}: LeadManagerPanelProps) {
  const set = (key: string, value: any) => setEditForm({ ...editForm, [key]: value })

  const grossYield =
    lead.estimatedMonthlyRent && lead.askingPrice
      ? ((lead.estimatedMonthlyRent * 12) / lead.askingPrice) * 100
      : null

  return (
    // Full overlay that sits inside the dialog content
    <div className="absolute inset-0 z-50 flex rounded-lg overflow-hidden">

      {/* ── Dark left identity panel ──────────────────────────────────────── */}
      <div className="w-64 shrink-0 bg-[#0f172a] flex flex-col text-white">

        {/* Top: avatar + name */}
        <div className="px-5 pt-6 pb-5 border-b border-white/10">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-violet-600
            flex items-center justify-center text-white text-lg font-bold mb-3 shadow-lg">
            {initials(lead.vendorName)}
          </div>
          <p className="font-semibold text-sm leading-snug">{lead.vendorName}</p>
          <a
            href={`tel:${lead.vendorPhone}`}
            className="text-xs text-blue-300 hover:text-blue-200 transition-colors mt-0.5 block"
          >
            {lead.vendorPhone}
          </a>
          {lead.vendorEmail && (
            <a
              href={`mailto:${lead.vendorEmail}`}
              className="text-xs text-slate-400 hover:text-slate-300 transition-colors mt-0.5 block truncate"
            >
              {lead.vendorEmail}
            </a>
          )}
        </div>

        {/* Pipeline stage */}
        <div className="px-5 py-4 border-b border-white/10">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2">Pipeline Stage</p>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", stageColour(lead.pipelineStage))} />
            <span className="text-xs font-medium text-slate-200">{stageLabel(lead.pipelineStage)}</span>
          </div>
        </div>

        {/* Key metrics */}
        <div className="px-5 py-4 border-b border-white/10 space-y-3">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Deal Metrics</p>

          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <PoundSterling className="h-3.5 w-3.5" />
                <span className="text-xs">Asking</span>
              </div>
              <span className="text-xs font-semibold text-white">{fmt(lead.askingPrice)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">Market Val.</span>
              </div>
              <span className="text-xs font-semibold text-white">{fmt(lead.estimatedMarketValue)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-xs">BMV</span>
              </div>
              <span className={cn(
                "text-xs font-bold",
                (lead.bmvScore ?? 0) >= 15 ? "text-emerald-400" : "text-amber-400"
              )}>
                {lead.bmvScore ? `${Number(lead.bmvScore).toFixed(1)}%` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-400">
                <Home className="h-3.5 w-3.5" />
                <span className="text-xs">Rent</span>
              </div>
              <span className="text-xs font-semibold text-white">{fmt(lead.estimatedMonthlyRent)}/mo</span>
            </div>
            {grossYield && (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <Layers className="h-3.5 w-3.5" />
                  <span className="text-xs">Gross Yield</span>
                </div>
                <span className="text-xs font-bold text-emerald-400">
                  {grossYield.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Property summary */}
        {(lead.propertyAddress || lead.bedrooms) && (
          <div className="px-5 py-4 border-b border-white/10 space-y-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">Property</p>
            {lead.propertyAddress && (
              <div className="flex items-start gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-500 mt-0.5 shrink-0" />
                <p className="text-xs text-slate-300 leading-snug">{lead.propertyAddress}</p>
              </div>
            )}
            <div className="flex items-center gap-3 text-slate-400 text-xs">
              {lead.bedrooms && (
                <span className="flex items-center gap-1">
                  <BedDouble className="h-3 w-3" /> {lead.bedrooms} bed
                </span>
              )}
              {lead.bathrooms && (
                <span className="flex items-center gap-1">
                  <Bath className="h-3 w-3" /> {lead.bathrooms} bath
                </span>
              )}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="px-5 py-4 mt-auto space-y-2">
          <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">Quick Actions</p>
          <a
            href={`tel:${lead.vendorPhone}`}
            className="flex items-center gap-2 w-full rounded-lg bg-white/5 hover:bg-white/10
              border border-white/10 px-3 py-2 text-xs font-medium text-slate-300
              hover:text-white transition-all"
          >
            <Phone className="h-3.5 w-3.5 text-green-400" />
            Call vendor
          </a>
          {lead.vendorEmail && (
            <a
              href={`mailto:${lead.vendorEmail}`}
              className="flex items-center gap-2 w-full rounded-lg bg-white/5 hover:bg-white/10
                border border-white/10 px-3 py-2 text-xs font-medium text-slate-300
                hover:text-white transition-all"
            >
              <Mail className="h-3.5 w-3.5 text-blue-400" />
              Send email
            </a>
          )}
        </div>
      </div>

      {/* ── Right: edit form ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col bg-gray-50 min-h-0">

        {/* Form header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Manage Lead</h2>
            <p className="text-xs text-gray-400 mt-0.5">Update vendor and property details</p>
          </div>
          <button
            onClick={onCancel}
            className="h-8 w-8 flex items-center justify-center rounded-md text-gray-400
              hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable form */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 min-h-0">

          {/* ── Vendor Contact ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <SectionHeader label="Vendor Contact" />
            <Field label="Full Name *">
              <Input
                value={editForm.vendorName || ""}
                onChange={e => set("vendorName", e.target.value)}
                placeholder="e.g. John Smith"
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Phone *">
              <Input
                value={editForm.vendorPhone || ""}
                onChange={e => set("vendorPhone", e.target.value)}
                placeholder="+44..."
                className="h-9 text-sm"
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={editForm.vendorEmail || ""}
                onChange={e => set("vendorEmail", e.target.value)}
                placeholder="vendor@email.com"
                className="h-9 text-sm"
              />
            </Field>
          </div>

          {/* ── Property Details ───────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <SectionHeader label="Property Details" />
            <Field label="Address">
              <Textarea
                value={editForm.propertyAddress || ""}
                onChange={e => set("propertyAddress", e.target.value)}
                rows={2}
                placeholder="Full property address"
                className="text-sm resize-none"
              />
            </Field>
            <Field label="Postcode">
              <div className="flex gap-2">
                <Input
                  value={editForm.propertyPostcode || ""}
                  onChange={e => set("propertyPostcode", e.target.value)}
                  placeholder="e.g. SA11 1PB"
                  className="h-9 text-sm"
                />
                {onFixPostcode && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 shrink-0"
                    onClick={onFixPostcode}
                    disabled={isFixingPostcode || !editForm.propertyAddress}
                    title="Look up postcode from address"
                  >
                    {isFixingPostcode
                      ? <Loader2 className="h-4 w-4 animate-spin" />
                      : <Search className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Type">
                <Input
                  value={editForm.propertyType || ""}
                  onChange={e => set("propertyType", e.target.value)}
                  placeholder="Terraced"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Bedrooms">
                <Input
                  type="number"
                  value={editForm.bedrooms || ""}
                  onChange={e => set("bedrooms", e.target.value)}
                  placeholder="2"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Bathrooms">
                <Input
                  type="number"
                  value={editForm.bathrooms || ""}
                  onChange={e => set("bathrooms", e.target.value)}
                  placeholder="1"
                  className="h-9 text-sm"
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Sq Footage">
                <Input
                  type="number"
                  value={editForm.squareFeet || ""}
                  onChange={e => set("squareFeet", e.target.value)}
                  placeholder="675"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Condition">
                <Select
                  value={editForm.condition || ""}
                  onValueChange={v => set("condition", v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excellent">Excellent</SelectItem>
                    <SelectItem value="good">Good</SelectItem>
                    <SelectItem value="fair">Fair</SelectItem>
                    <SelectItem value="needs_work">Needs Work</SelectItem>
                    <SelectItem value="needs_modernisation">Needs Modernisation</SelectItem>
                    <SelectItem value="poor">Poor</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          {/* ── Pricing & Metrics ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <SectionHeader label="Pricing & Metrics" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Asking Price (£)">
                <Input
                  type="number"
                  value={editForm.askingPrice || ""}
                  onChange={e => set("askingPrice", e.target.value)}
                  placeholder="86000"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Market Value (£)">
                <Input
                  type="number"
                  value={editForm.estimatedMarketValue || ""}
                  onChange={e => set("estimatedMarketValue", e.target.value)}
                  placeholder="Auto-calculated"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Monthly Rent (£)">
                <Input
                  type="number"
                  value={editForm.estimatedMonthlyRent || ""}
                  onChange={e => {
                    const monthly = e.target.value
                    setEditForm({
                      ...editForm,
                      estimatedMonthlyRent: monthly,
                      estimatedAnnualRent: monthly ? String(Number(monthly) * 12) : "",
                    })
                  }}
                  placeholder="877"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Annual Rent (£)">
                <Input
                  type="number"
                  value={editForm.estimatedAnnualRent || ""}
                  onChange={e => set("estimatedAnnualRent", e.target.value)}
                  placeholder="Auto-calculated"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Refurb Est. (£)">
                <Input
                  type="number"
                  value={editForm.estimatedRefurbCost || ""}
                  onChange={e => set("estimatedRefurbCost", e.target.value)}
                  placeholder="20500"
                  className="h-9 text-sm"
                />
              </Field>
            </div>
          </div>

          {/* ── Pipeline Stage ─────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <SectionHeader label="Pipeline Stage" />
            <Select
              value={editForm.pipelineStage || ""}
              onValueChange={v => set("pipelineStage", v)}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                <SelectItem value="INITIAL_CONTACT">Initial Contact</SelectItem>
                <SelectItem value="AI_CONVERSATION">AI Conversation</SelectItem>
                <SelectItem value="DEAL_VALIDATION">Deal Validation</SelectItem>
                <SelectItem value="VALUATION_PENDING">Valuation Pending</SelectItem>
                <SelectItem value="VALUATION_COMPLETE">Valuation Complete</SelectItem>
                <SelectItem value="OFFER_PREPARATION">Offer Preparation</SelectItem>
                <SelectItem value="OFFER_SENT">Offer Sent</SelectItem>
                <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                <SelectItem value="OFFER_ACCEPTED">Offer Accepted</SelectItem>
                <SelectItem value="SOLICITOR_INSTRUCTED">Solicitor Instructed</SelectItem>
                <SelectItem value="LOCKOUT_SIGNED">Lockout Signed</SelectItem>
                <SelectItem value="COMPLETION_PENDING">Completion Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ── Seller Intelligence ────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <SectionHeader label="Seller Intelligence" />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Motivation Score (1–10)">
                <Input
                  type="number"
                  min="1"
                  max="10"
                  value={editForm.motivationScore || ""}
                  onChange={e => set("motivationScore", e.target.value)}
                  placeholder="7"
                  className="h-9 text-sm"
                />
              </Field>
              <Field label="Urgency Level">
                <Select
                  value={editForm.urgencyLevel || ""}
                  onValueChange={v => set("urgencyLevel", v)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="quick">Quick</SelectItem>
                    <SelectItem value="moderate">Moderate</SelectItem>
                    <SelectItem value="flexible">Flexible</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Reason for Selling">
              <Select
                value={editForm.reasonForSelling || ""}
                onValueChange={v => set("reasonForSelling", v)}
              >
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relocation">Relocation</SelectItem>
                  <SelectItem value="financial">Financial Difficulty</SelectItem>
                  <SelectItem value="divorce">Divorce / Separation</SelectItem>
                  <SelectItem value="inheritance">Inheritance</SelectItem>
                  <SelectItem value="downsize">Downsizing</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timeline (days)">
              <Input
                type="number"
                value={editForm.timelineDays || ""}
                onChange={e => set("timelineDays", e.target.value)}
                placeholder="e.g. 60"
                className="h-9 text-sm"
              />
            </Field>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={editForm.competingOffers || false}
                onChange={e => set("competingOffers", e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-[#2563EB] cursor-pointer"
              />
              <span className="text-sm text-gray-700 group-hover:text-gray-900 transition-colors">
                Vendor has competing offers
              </span>
            </label>
          </div>

        </div>

        {/* ── Sticky footer ──────────────────────────────────────────────────── */}
        <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 bg-white border-t border-gray-200">
          <Button
            variant="outline"
            size="sm"
            className="h-9 text-sm gap-1.5"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-9 text-sm gap-1.5 bg-[#2563EB] hover:bg-blue-700"
            onClick={onSave}
            disabled={isSaving}
          >
            {isSaving
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Save className="h-3.5 w-3.5" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  )
}
