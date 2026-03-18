// app/dashboard/settings/appearance/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { DEFAULT_TOKENS } from "@/lib/theme/defaults"
import type { ThemeTokens } from "@/lib/theme/types"
import { StatusBadge } from "@/components/ui/status-badge"
import { Palette, Type, Layout, Monitor, Sidebar, Tag } from "lucide-react"

// ── Shared control primitives ─────────────────────────────────────────────

function ColorRow({
  label,
  varName,
  tokens,
  onChange,
}: {
  label: string
  varName: string
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const value = tokens[varName] ?? DEFAULT_TOKENS[varName] ?? "#000000"
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(varName, e.target.value)}
          className="h-8 w-10 cursor-pointer rounded border border-gray-200 p-0.5"
        />
        <span className="w-20 font-mono text-xs text-gray-500">{value}</span>
      </div>
    </div>
  )
}

function SegmentRow({
  label,
  varName,
  options,
  tokens,
  onChange,
}: {
  label: string
  varName: string
  options: { label: string; value: string }[]
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const current = tokens[varName] ?? DEFAULT_TOKENS[varName]
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex rounded-md border border-gray-200 overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(varName, opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              current === opt.value
                ? "bg-blue-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function ColorPairRow({
  label,
  bgVar,
  textVar,
  tokens,
  onChange,
}: {
  label: string
  bgVar: string
  textVar: string
  tokens: ThemeTokens
  onChange: (varName: string, value: string) => void
}) {
  const bgValue = tokens[bgVar] ?? DEFAULT_TOKENS[bgVar] ?? "#f3f4f6"
  const textValue = tokens[textVar] ?? DEFAULT_TOKENS[textVar] ?? "#1f2937"
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-gray-700 w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">bg</span>
          <input
            type="color"
            value={bgValue}
            onChange={(e) => onChange(bgVar, e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">text</span>
          <input
            type="color"
            value={textValue}
            onChange={(e) => onChange(textVar, e.target.value)}
            className="h-7 w-8 cursor-pointer rounded border border-gray-200 p-0.5"
          />
        </div>
        <span
          className="inline-block rounded-full px-2 py-0.5 text-xs font-medium"
          style={{ backgroundColor: bgValue, color: textValue }}
        >
          {label}
        </span>
      </div>
    </div>
  )
}

// ── Live Preview ──────────────────────────────────────────────────────────

function ThemePreview({ tokens }: { tokens: ThemeTokens }) {
  return (
    <div
      style={tokens as React.CSSProperties}
      className="rounded-xl border border-gray-200 overflow-hidden shadow-sm"
    >
      {/* Sidebar strip */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: "var(--sidebar-bg)" }}
      >
        <div
          className="h-5 w-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: "var(--sidebar-active-bg)", color: "var(--sidebar-bg)" }}
        >
          DS
        </div>
        <span className="text-xs font-medium text-white opacity-80">DealStack</span>
      </div>

      {/* KPI tiles */}
      <div className="flex divide-x divide-gray-100 bg-white">
        <div className="flex-1 px-4 py-3">
          <p className="font-mono text-lg font-bold" style={{ color: "var(--value-positive)" }}>
            18.4%
          </p>
          <p className="text-xs text-gray-500">Avg BMV</p>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="font-mono text-lg font-bold" style={{ color: "var(--value-highlight)" }}>
            £1.2M
          </p>
          <p className="text-xs text-gray-500">Pipeline</p>
        </div>
      </div>

      {/* Badge row */}
      <div className="flex flex-wrap gap-2 px-4 py-3 bg-white border-t border-gray-100">
        <StatusBadge label="In Progress" cssKey="status-deal-in_progress" />
        <StatusBadge label="New Lead" cssKey="status-pipeline-new_lead" />
        <StatusBadge label="Solicitor" cssKey="status-contact-solicitor" />
      </div>

      {/* Card sample */}
      <div className="px-4 py-3 bg-white border-t border-gray-100">
        <h3
          className="text-sm mb-1"
          style={{ fontWeight: "var(--font-weight-heading)" as any, fontSize: "var(--font-size-base)" }}
        >
          Sample Property Card
        </h3>
        <p className="text-xs text-gray-400">
          3-bed terrace · Asking £240,000 · <strong style={{ color: "var(--ds-primary)" }}>15% BMV</strong>
        </p>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function AppearancePage() {
  const [tokens, setTokens] = useState<ThemeTokens>({ ...DEFAULT_TOKENS })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/user/theme")
      .then((r) => r.json())
      .then((data) => {
        setTokens({ ...DEFAULT_TOKENS, ...(data.tokens ?? {}) })
      })
      .catch(() => {/* use defaults */})
      .finally(() => setLoading(false))
  }, [])

  const handleChange = useCallback((varName: string, value: string) => {
    setTokens((prev) => ({ ...prev, [varName]: value }))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      // Send only the values that differ from defaults
      const overrides: ThemeTokens = {}
      for (const [k, v] of Object.entries(tokens)) {
        if (v !== DEFAULT_TOKENS[k]) overrides[k] = v
      }
      const res = await fetch("/api/user/theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokens: overrides }),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Appearance saved")
    } catch {
      toast.error("Failed to save appearance")
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    try {
      await fetch("/api/user/theme", { method: "DELETE" })
      setTokens({ ...DEFAULT_TOKENS })
      toast.success("Reset to defaults")
    } catch {
      toast.error("Failed to reset")
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <PageHeader title="Appearance" subtitle="Customise the look and feel of your dashboard" />
        <div className="flex items-center justify-center h-40 text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Appearance" subtitle="Customise the look and feel of your dashboard" />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
        {/* ── Control Panel ── */}
        <div className="ds-card overflow-hidden">
          <Tabs defaultValue="brand">
            <div className="px-5 pt-4 border-b border-[var(--ds-border)]">
              <TabsList className="grid w-full grid-cols-6 mb-0 h-auto gap-1 bg-transparent p-0">
                <TabsTrigger value="brand" className="flex items-center gap-1 text-xs h-9">
                  <Palette className="h-3.5 w-3.5" />Brand
                </TabsTrigger>
                <TabsTrigger value="sidebar" className="flex items-center gap-1 text-xs h-9">
                  <Sidebar className="h-3.5 w-3.5" />Sidebar
                </TabsTrigger>
                <TabsTrigger value="badges" className="flex items-center gap-1 text-xs h-9">
                  <Tag className="h-3.5 w-3.5" />Badges
                </TabsTrigger>
                <TabsTrigger value="typography" className="flex items-center gap-1 text-xs h-9">
                  <Type className="h-3.5 w-3.5" />Type
                </TabsTrigger>
                <TabsTrigger value="spacing" className="flex items-center gap-1 text-xs h-9">
                  <Layout className="h-3.5 w-3.5" />Spacing
                </TabsTrigger>
                <TabsTrigger value="kpi" className="flex items-center gap-1 text-xs h-9">
                  <Monitor className="h-3.5 w-3.5" />KPI
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Brand */}
            {/* NOTE: The spec lists --value-positive/negative/highlight under both Brand and KPI Colours tabs.
                This plan places them only in the KPI Colours tab to avoid duplication — Brand is limited to
                primary/accent identity colours. */}
            <TabsContent value="brand" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">
                Primary and accent identity colours. KPI value colours are in the KPI tab.
              </p>
              <ColorRow label="Primary colour" varName="--ds-primary" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Accent colour" varName="--ds-accent" tokens={tokens} onChange={handleChange} />
            </TabsContent>

            {/* Sidebar */}
            <TabsContent value="sidebar" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">Sidebar background, active item, and hover state</p>
              <ColorRow label="Background" varName="--sidebar-bg" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Active item" varName="--sidebar-active-bg" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Hover" varName="--sidebar-hover" tokens={tokens} onChange={handleChange} />
              <ColorRow label="Border" varName="--sidebar-border" tokens={tokens} onChange={handleChange} />
            </TabsContent>

            {/* Status Badges */}
            <TabsContent value="badges" className="px-5 py-4">
              <p className="text-xs text-gray-400 mb-3">Background and text colour for each status badge</p>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-3 mb-1">Deal Statuses</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "New",         bgVar: "--status-deal-new-bg",         textVar: "--status-deal-new-text" },
                  { label: "Review",      bgVar: "--status-deal-review-bg",      textVar: "--status-deal-review-text" },
                  { label: "In Progress", bgVar: "--status-deal-in_progress-bg", textVar: "--status-deal-in_progress-text" },
                  { label: "Ready",       bgVar: "--status-deal-ready-bg",       textVar: "--status-deal-ready-text" },
                  { label: "Listed",      bgVar: "--status-deal-listed-bg",      textVar: "--status-deal-listed-text" },
                  { label: "Reserved",    bgVar: "--status-deal-reserved-bg",    textVar: "--status-deal-reserved-text" },
                  { label: "Sold",        bgVar: "--status-deal-sold-bg",        textVar: "--status-deal-sold-text" },
                  { label: "Archived",    bgVar: "--status-deal-archived-bg",    textVar: "--status-deal-archived-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-4 mb-1">Pipeline Stages</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "New Lead",            bgVar: "--status-pipeline-new_lead-bg",            textVar: "--status-pipeline-new_lead-text" },
                  { label: "AI Conversation",     bgVar: "--status-pipeline-ai_conversation-bg",     textVar: "--status-pipeline-ai_conversation-text" },
                  { label: "Deal Validation",     bgVar: "--status-pipeline-deal_validation-bg",     textVar: "--status-pipeline-deal_validation-text" },
                  { label: "Offer Made",          bgVar: "--status-pipeline-offer_made-bg",          textVar: "--status-pipeline-offer_made-text" },
                  { label: "Offer Accepted",      bgVar: "--status-pipeline-offer_accepted-bg",      textVar: "--status-pipeline-offer_accepted-text" },
                  { label: "Offer Rejected",      bgVar: "--status-pipeline-offer_rejected-bg",      textVar: "--status-pipeline-offer_rejected-text" },
                  { label: "Video Sent",          bgVar: "--status-pipeline-video_sent-bg",          textVar: "--status-pipeline-video_sent-text" },
                  { label: "Retry 1",             bgVar: "--status-pipeline-retry_1-bg",             textVar: "--status-pipeline-retry_1-text" },
                  { label: "Retry 2",             bgVar: "--status-pipeline-retry_2-bg",             textVar: "--status-pipeline-retry_2-text" },
                  { label: "Retry 3",             bgVar: "--status-pipeline-retry_3-bg",             textVar: "--status-pipeline-retry_3-text" },
                  { label: "Paperwork Sent",      bgVar: "--status-pipeline-paperwork_sent-bg",      textVar: "--status-pipeline-paperwork_sent-text" },
                  { label: "Ready for Investors", bgVar: "--status-pipeline-ready_for_investors-bg", textVar: "--status-pipeline-ready_for_investors-text" },
                  { label: "Dead Lead",           bgVar: "--status-pipeline-dead_lead-bg",           textVar: "--status-pipeline-dead_lead-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>

              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mt-4 mb-1">Contact Types</p>
              <div className="divide-y divide-gray-100">
                {[
                  { label: "Solicitor",        bgVar: "--status-contact-solicitor-bg",         textVar: "--status-contact-solicitor-text" },
                  { label: "Investor Contact", bgVar: "--status-contact-investor_contact-bg",   textVar: "--status-contact-investor_contact-text" },
                  { label: "Vendor Contact",   bgVar: "--status-contact-vendor_contact-bg",     textVar: "--status-contact-vendor_contact-text" },
                  { label: "Estate Agent",     bgVar: "--status-contact-estate_agent-bg",       textVar: "--status-contact-estate_agent-text" },
                  { label: "Contractor",       bgVar: "--status-contact-contractor-bg",         textVar: "--status-contact-contractor-text" },
                  { label: "Other",            bgVar: "--status-contact-other-bg",              textVar: "--status-contact-other-text" },
                ].map((row) => (
                  <ColorPairRow key={row.bgVar} {...row} tokens={tokens} onChange={handleChange} />
                ))}
              </div>
            </TabsContent>

            {/* Typography */}
            <TabsContent value="typography" className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">Font size and heading weight</p>
              <SegmentRow
                label="Base font size"
                varName="--font-size-base"
                options={[
                  { label: "Small (12px)", value: "12px" },
                  { label: "Normal (14px)", value: "14px" },
                  { label: "Large (16px)", value: "16px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Heading weight"
                varName="--font-weight-heading"
                options={[
                  { label: "Normal (400)", value: "400" },
                  { label: "Medium (600)", value: "600" },
                  { label: "Bold (700)", value: "700" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
            </TabsContent>

            {/* Spacing */}
            <TabsContent value="spacing" className="px-5 py-4 space-y-2">
              <p className="text-xs text-gray-400 mb-3">Page, card, and table density</p>
              <SegmentRow
                label="Page padding"
                varName="--page-padding"
                options={[
                  { label: "Compact (20px)", value: "20px" },
                  { label: "Normal (32px)", value: "32px" },
                  { label: "Spacious (48px)", value: "48px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Card padding"
                varName="--card-padding"
                options={[
                  { label: "Compact (16px)", value: "16px" },
                  { label: "Normal (24px)", value: "24px" },
                  { label: "Spacious (32px)", value: "32px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Section gap"
                varName="--section-gap"
                options={[
                  { label: "Compact (12px)", value: "12px" },
                  { label: "Normal (20px)", value: "20px" },
                  { label: "Spacious (28px)", value: "28px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
              <SegmentRow
                label="Table row height"
                varName="--table-row-height"
                options={[
                  { label: "Compact (40px)", value: "40px" },
                  { label: "Normal (52px)", value: "52px" },
                  { label: "Comfortable (64px)", value: "64px" },
                ]}
                tokens={tokens}
                onChange={handleChange}
              />
            </TabsContent>

            {/* KPI Colours */}
            {/* NOTE: The spec mentions a "Neutral colour" in this tab but defines no CSS variable for it
                in the Token Reference table. It is intentionally omitted here — add if a --value-neutral
                variable is ever formalised. */}
            <TabsContent value="kpi" className="px-5 py-4 space-y-1">
              <p className="text-xs text-gray-400 mb-3">Colours used for KPI values in the dashboard</p>
              <ColorRow label="Positive (gains, yield)" varName="--value-positive"  tokens={tokens} onChange={handleChange} />
              <ColorRow label="Negative (losses)"       varName="--value-negative"  tokens={tokens} onChange={handleChange} />
              <ColorRow label="Highlight (primary KPI)" varName="--value-highlight" tokens={tokens} onChange={handleChange} />
            </TabsContent>
          </Tabs>

          {/* Save / Reset */}
          <div className="flex items-center gap-3 px-5 py-4 border-t border-[var(--ds-border)]">
            <Button onClick={handleSave} disabled={saving} className="btn-primary h-9">
              {saving ? "Saving…" : "Save Appearance"}
            </Button>
            <Button variant="outline" onClick={handleReset} className="h-9">
              Reset to Defaults
            </Button>
          </div>
        </div>

        {/* ── Sticky Live Preview ── */}
        <div className="sticky top-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Preview</p>
          <ThemePreview tokens={tokens} />
          <p className="text-xs text-gray-400 mt-2">
            Changes preview instantly. Click "Save Appearance" to persist.
          </p>
        </div>
      </div>
    </div>
  )
}
