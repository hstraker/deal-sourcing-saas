"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  ArrowLeft, Save, Eye, EyeOff, Plus, Trash2, Copy,
  Loader2, Circle, MonitorPlay, Settings2, Palette,
  ChevronDown, ChevronUp, GripVertical, SlidersHorizontal,
  Undo2, Redo2,
} from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import { cn } from "@/lib/utils"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Branding {
  primaryColor: string
  secondaryColor: string
  accentColor: string
  headingFont: string
  bodyFont: string
}

type SectionType =
  | "cover"
  | "executive_summary"
  | "property_details"
  | "financial_analysis"
  | "market_evidence"
  | "next_steps"

interface PackSection {
  id: string
  type: SectionType
  visible: boolean
  order: number
  config: Record<string, any>
}

interface DesignerTemplate {
  name: string
  description: string
  isActive: boolean
  isDefault: boolean
  branding: Branding
  sections: PackSection[]
  pageHeaderLeft: string
  pageHeaderRight: string
  pageFooterLeft: string
  pageFooterRight: string
}

export interface TemplateRecord {
  id?: string
  name?: string
  description?: string
  colorScheme?: string
  isActive?: boolean
  isDefault?: boolean
  sections?: any
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_BRANDING: Branding = {
  primaryColor: "#0f172a",
  secondaryColor: "#1e3a8a",
  accentColor: "#2563eb",
  headingFont: "inter",
  bodyFont: "inter",
}

interface SectionDef {
  label: string; icon: string; description: string; defaultConfig: Record<string, any>
}

const SECTION_CATALOG: Record<SectionType, SectionDef> = {
  cover: {
    label: "Cover Page", icon: "🏠", description: "Hero photo, headline & key stats",
    defaultConfig: {
      eyebrow: "Confidential Investment Memorandum",
      headline: "Exclusive Investment Opportunity",
      showStats: true,
      stat1Label: "Below Market Value", stat2Label: "Projected ROI", stat3Label: "Market Value",
    },
  },
  executive_summary: {
    label: "Executive Summary", icon: "📋", description: "One-paragraph deal overview",
    defaultConfig: {
      title: "Executive Summary",
      body: "This is an exceptional below-market-value opportunity. The property is currently listed at a significant discount to estimated market value, representing an outstanding investment for the right buyer.",
    },
  },
  property_details: {
    label: "Property Details", icon: "📷", description: "Address, specs, photos & condition",
    defaultConfig: {
      title: "Property Details",
      showPhotos: true, showSpecs: true, showDescription: true, showFeatures: true,
    },
  },
  financial_analysis: {
    label: "Financial Analysis", icon: "📊", description: "Purchase price, ROI & cashflow model",
    defaultConfig: {
      title: "Investment Analysis",
      showHeroMetrics: true, showCostBreakdown: true, showCashflow: true, showScenarios: true, showARV: true,
    },
  },
  market_evidence: {
    label: "Market Evidence", icon: "📈", description: "Comparable sales & area intelligence",
    defaultConfig: {
      title: "Market Evidence",
      showPortalLinks: true, showYieldColumn: true, showDaysOnMarket: true,
      showConfidenceBadges: true, showAdvantageBox: true,
    },
  },
  next_steps: {
    label: "Next Steps", icon: "📞", description: "How to reserve & contact info",
    defaultConfig: {
      title: "Secure This Opportunity", subtitle: "How to proceed with this investment",
      step1Title: "Express Interest", step1Desc: "Contact us today to confirm your interest in this property.",
      step2Title: "Due Diligence",   step2Desc: "Review comparables, arrange a viewing, and conduct your assessment.",
      step3Title: "Reserve & Complete", step3Desc: "Place your reservation and instruct your solicitor to proceed.",
      showUrgencyNote: true, urgencyText: "", showDisclaimer: true,
    },
  },
}

const FONT_OPTIONS = [
  { id: "inter",     label: "Inter",           stack: "Inter, system-ui, sans-serif",                   tag: "Modern" },
  { id: "system",    label: "System Sans",      stack: "system-ui, sans-serif",                          tag: "Clean" },
  { id: "helvetica", label: "Helvetica",        stack: "'Helvetica Neue', Helvetica, Arial, sans-serif", tag: "Corporate" },
  { id: "georgia",   label: "Georgia",          stack: "Georgia, 'Times New Roman', serif",              tag: "Classic" },
  { id: "playfair",  label: "Playfair Display", stack: "'Playfair Display', Georgia, serif",             tag: "Luxury" },
  { id: "lato",      label: "Lato",             stack: "Lato, system-ui, sans-serif",                    tag: "Friendly" },
]

const COLOR_PRESETS = [
  { id: "navy",   label: "Navy Blue",    primary: "#0f172a", secondary: "#1e3a8a", accent: "#2563eb" },
  { id: "slate",  label: "Slate Navy",   primary: "#0f172a", secondary: "#1e40af", accent: "#3b82f6" },
  { id: "forest", label: "Forest",       primary: "#052e16", secondary: "#065f46", accent: "#059669" },
  { id: "purple", label: "Royal Purple", primary: "#1e1b4b", secondary: "#4c1d95", accent: "#7c3aed" },
  { id: "gold",   label: "Premium Gold", primary: "#1c1917", secondary: "#78350f", accent: "#d97706" },
]

const STARTER_PRESETS = [
  {
    label: "Classic Professional", tag: "Traditional authority",
    branding: { primaryColor: "#0f172a", secondaryColor: "#1e3a8a", accentColor: "#2563eb", headingFont: "georgia", bodyFont: "georgia" },
  },
  {
    label: "Modern Minimal", tag: "Clean & contemporary",
    branding: { primaryColor: "#0f172a", secondaryColor: "#1e40af", accentColor: "#3b82f6", headingFont: "inter", bodyFont: "inter" },
  },
  {
    label: "Premium Luxury", tag: "Elegant & exclusive",
    branding: { primaryColor: "#1c1917", secondaryColor: "#78350f", accentColor: "#d97706", headingFont: "playfair", bodyFont: "lato" },
  },
]

const OLD_TO_NEW: Record<string, SectionType> = {
  cover: "cover", property: "property_details", investment: "financial_analysis",
  comparables: "market_evidence", cta: "next_steps",
  executive_summary: "executive_summary", property_details: "property_details",
  financial_analysis: "financial_analysis", market_evidence: "market_evidence", next_steps: "next_steps",
}

const NEW_TO_OLD: Record<SectionType, string> = {
  cover: "cover", property_details: "property", financial_analysis: "investment",
  market_evidence: "comparables", next_steps: "cta", executive_summary: "executive_summary",
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fontStack(id: string): string {
  return FONT_OPTIONS.find(f => f.id === id)?.stack ?? FONT_OPTIONS[0].stack
}

function initTemplate(rec: TemplateRecord | null): DesignerTemplate {
  const rawSections: any[] = Array.isArray(rec?.sections) ? (rec!.sections as any[]) : []
  const meta = rawSections.find((s: any) => s.type === "_meta" || s.type === "_branding") ?? {}

  const presetMap: Record<string, Partial<Branding>> = {
    blue:   { primaryColor: "#0f172a", secondaryColor: "#1e3a8a", accentColor: "#2563eb" },
    slate:  { primaryColor: "#0f172a", secondaryColor: "#1e40af", accentColor: "#3b82f6" },
    green:  { primaryColor: "#052e16", secondaryColor: "#065f46", accentColor: "#059669" },
    purple: { primaryColor: "#1e1b4b", secondaryColor: "#4c1d95", accentColor: "#7c3aed" },
    gold:   { primaryColor: "#1c1917", secondaryColor: "#78350f", accentColor: "#d97706" },
  }
  const preset = presetMap[rec?.colorScheme ?? "blue"] ?? presetMap.blue!

  const branding: Branding = {
    primaryColor:   meta.primaryColor   ?? preset.primaryColor   ?? DEFAULT_BRANDING.primaryColor,
    secondaryColor: meta.secondaryColor ?? preset.secondaryColor ?? DEFAULT_BRANDING.secondaryColor,
    accentColor:    meta.accentColor    ?? preset.accentColor    ?? DEFAULT_BRANDING.accentColor,
    headingFont:    meta.headingFont    ?? meta.fontFamily       ?? "inter",
    bodyFont:       meta.bodyFont       ?? meta.fontFamily       ?? "inter",
  }

  const existing = rawSections
    .filter((s: any) => s.type && !s.type.startsWith("_"))
    .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))

  let sections: PackSection[]
  if (existing.length > 0) {
    sections = existing.map((s: any, i: number) => {
      const type: SectionType = OLD_TO_NEW[s.type] ?? "cover"
      return {
        id: s.id ?? `${type}-${i}`,
        type,
        visible: s.enabled !== false && s.visible !== false,
        order: i,
        config: { ...SECTION_CATALOG[type].defaultConfig, ...s.config },
      }
    })
  } else {
    sections = (Object.keys(SECTION_CATALOG) as SectionType[]).map((type, i) => ({
      id: `${type}-${i}`, type, visible: true, order: i,
      config: { ...SECTION_CATALOG[type].defaultConfig },
    }))
  }

  return {
    name: rec?.name ?? "New Template",
    description: rec?.description ?? "",
    isActive: rec?.isActive ?? true,
    isDefault: rec?.isDefault ?? false,
    branding,
    sections,
    pageHeaderLeft:  meta.pageHeaderLeft  ?? "",
    pageHeaderRight: meta.pageHeaderRight ?? "Confidential",
    pageFooterLeft:  meta.pageFooterLeft  ?? "",
    pageFooterRight: meta.pageFooterRight ?? "",
  }
}

function toApiBody(tmpl: DesignerTemplate): Record<string, any> {
  return {
    name: tmpl.name,
    description: tmpl.description,
    colorScheme: "blue",
    isActive: tmpl.isActive,
    isDefault: tmpl.isDefault,
    templateType: "single",
    sections: [
      {
        type: "_meta",
        fontFamily:      tmpl.branding.headingFont,
        primaryColor:    tmpl.branding.primaryColor,
        secondaryColor:  tmpl.branding.secondaryColor,
        accentColor:     tmpl.branding.accentColor,
        headingFont:     tmpl.branding.headingFont,
        bodyFont:        tmpl.branding.bodyFont,
        pageHeaderLeft:  tmpl.pageHeaderLeft,
        pageHeaderRight: tmpl.pageHeaderRight,
        pageFooterLeft:  tmpl.pageFooterLeft,
        pageFooterRight: tmpl.pageFooterRight,
      },
      ...tmpl.sections.map((s, i) => ({
        id: s.id,
        type: NEW_TO_OLD[s.type],
        enabled: s.visible, visible: s.visible, order: i,
        config: s.config,
      })),
    ],
  }
}

// ─── Cover Page Preview ───────────────────────────────────────────────────────

function CoverPagePreview({
  section, branding, isSelected, onSelect, logoUrl,
}: {
  section: PackSection; branding: Branding; isSelected: boolean; onSelect: () => void; logoUrl?: string | null
}) {
  const cfg = section.config
  const headFont = fontStack(branding.headingFont)
  const bodyFont = fontStack(branding.bodyFont)

  return (
    <div
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all rounded select-none",
        isSelected ? "ring-2 ring-blue-500 ring-offset-2" : "ring-1 ring-zinc-300 hover:ring-zinc-400",
      )}
      style={{ width: "100%", aspectRatio: "1 / 1.414", fontFamily: bodyFont, fontSize: 10 }}
      onClick={onSelect}
    >
      <div className="absolute inset-0" style={{
        background: `linear-gradient(150deg, ${branding.primaryColor} 0%, ${branding.secondaryColor} 55%, ${branding.primaryColor}dd 100%)`,
      }} />
      <div className="absolute inset-0 opacity-10" style={{
        background: `linear-gradient(120deg, transparent 40%, ${branding.accentColor} 100%)`,
      }} />
      <div className="absolute top-0 left-0 bottom-0 w-1" style={{ background: branding.accentColor }} />

      {/* Company logo — top right */}
      {logoUrl && (
        <div className="absolute z-20" style={{ top: "6%", right: "7%", maxHeight: "11%", maxWidth: "28%" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Logo" style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain", filter: "brightness(0) invert(1)", opacity: 0.85 }} />
        </div>
      )}

      <div className="relative z-10 h-full flex flex-col p-[9%]">
        <div>
          <span className="inline-block font-bold tracking-widest uppercase px-[0.8em] py-[0.4em] rounded"
            style={{ fontSize: "0.45em", background: branding.accentColor, color: "#fff", fontFamily: bodyFont }}>
            {cfg.eyebrow || "Confidential Investment Memorandum"}
          </span>
        </div>
        <div className="flex-1 flex flex-col justify-center mt-[6%]">
          <div className="font-bold leading-tight text-white" style={{ fontSize: "1.6em", fontFamily: headFont }}>
            {cfg.headline || "Exclusive Investment Opportunity"}
          </div>
          <div className="font-medium tracking-wide mt-[4%]" style={{ fontSize: "0.65em", color: "rgba(255,255,255,0.6)" }}>
            14 Church Street, Birmingham, B12 8HB
          </div>
        </div>
        {cfg.showStats !== false && (
          <div className="grid grid-cols-3 gap-3 pt-[5%]" style={{ borderTop: "1px solid rgba(255,255,255,0.15)" }}>
            {[
              { label: cfg.stat1Label || "Below Market Value", value: "18%" },
              { label: cfg.stat2Label || "Projected ROI",      value: "15%" },
              { label: cfg.stat3Label || "Market Value",       value: "£250k" },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="font-bold text-white" style={{ fontSize: "0.95em", fontFamily: headFont }}>{stat.value}</div>
                <div className="leading-tight mt-0.5" style={{ fontSize: "0.42em", color: "rgba(255,255,255,0.55)" }}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Section content renderers ────────────────────────────────────────────────

function PropertyDetailsContent({ section, branding }: { section: PackSection; branding: Branding }) {
  return (
    <div className="flex-1 flex flex-col gap-[3%]">
      {/* Hero image placeholder */}
      <div className="rounded-sm flex items-center justify-center" style={{ height: "34%", background: "#e4e7eb" }}>
        <span style={{ fontSize: "2em" }}>📷</span>
      </div>
      {/* Spec chips */}
      <div className="flex gap-[2%] flex-wrap">
        {["🛏 3 bed", "🛁 2 bath", "🏠 Reception", "📐 850 sqft"].map(chip => (
          <div key={chip} className="rounded-full border" style={{ fontSize: "0.42em", padding: "0.3em 0.7em", borderColor: "#d1d5db", color: "#374151" }}>
            {chip}
          </div>
        ))}
      </div>
      {/* Description lines */}
      <div className="flex flex-col gap-[2.5%]">
        {[100, 95, 88, 80, 72, 55].map((w, i) => (
          <div key={i} className="rounded-sm" style={{ height: "0.55em", width: `${w}%`, background: "#f1f5f9" }} />
        ))}
      </div>
      {/* Feature items */}
      <div className="flex flex-col gap-[2%] mt-[1%]">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex items-center gap-[2%]">
            <div className="rounded-full shrink-0" style={{ width: "0.5em", height: "0.5em", background: branding.accentColor }} />
            <div className="rounded-sm" style={{ height: "0.5em", width: "60%", background: "#e5e7eb" }} />
          </div>
        ))}
      </div>
    </div>
  )
}

function FinancialAnalysisContent({ section, branding }: { section: PackSection; branding: Branding }) {
  const headFont = fontStack(branding.headingFont)
  const costRows = [
    { label: "Purchase Price",   value: "£180,000", bold: false },
    { label: "Refurb Estimate",  value: "£15,000",  bold: false },
    { label: "Fees & Legal",     value: "£3,500",   bold: false },
    { label: "Total Investment", value: "£198,500", bold: true  },
  ]
  return (
    <div className="flex-1 flex flex-col gap-[3%]">
      {/* Hero metrics */}
      <div className="grid grid-cols-3 gap-[2.5%]">
        {[{ label: "BMV", value: "18%" }, { label: "ROI", value: "15%" }, { label: "Cash Flow", value: "£450/mo" }].map(m => (
          <div key={m.label} className="rounded-md text-center" style={{ padding: "5%", background: `${branding.secondaryColor}18` }}>
            <div className="font-bold" style={{ fontSize: "0.9em", color: branding.primaryColor, fontFamily: headFont }}>{m.value}</div>
            <div style={{ fontSize: "0.38em", color: "#9ca3af", marginTop: "0.3em" }}>{m.label}</div>
          </div>
        ))}
      </div>
      {/* Cost breakdown */}
      <div style={{ fontSize: "0.42em", color: "#6b7280", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "1%" }}>Cost Breakdown</div>
      <div className="rounded-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
        {costRows.map((row, i) => (
          <div key={i} className="flex items-center justify-between" style={{
            padding: "2.5% 3%",
            background: row.bold ? `${branding.accentColor}12` : i % 2 === 0 ? "#fff" : "#fafafa",
            fontSize: "0.45em",
          }}>
            <span style={{ color: row.bold ? branding.primaryColor : "#4b5563", fontWeight: row.bold ? 700 : 400 }}>{row.label}</span>
            <span style={{ color: row.bold ? branding.primaryColor : "#374151", fontWeight: row.bold ? 700 : 500 }}>{row.value}</span>
          </div>
        ))}
      </div>
      {/* Cashflow bars */}
      <div className="flex items-end gap-[3%] mt-[1%]" style={{ height: "8%" }}>
        {[100, 75, 55].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm" style={{ height: `${h}%`, background: `${branding.accentColor}45` }} />
        ))}
        <div className="text-right flex-1" style={{ fontSize: "0.35em", color: "#9ca3af", alignSelf: "flex-end" }}>Cashflow</div>
      </div>
    </div>
  )
}

function MarketEvidenceContent({ section, branding }: { section: PackSection; branding: Branding }) {
  const rows = [
    { badge: "#22c55e" },
    { badge: "#f59e0b" },
    { badge: "#22c55e" },
  ]
  return (
    <div className="flex-1 flex flex-col gap-[3%]">
      {/* Table */}
      <div className="rounded-sm overflow-hidden" style={{ border: "1px solid #f1f5f9" }}>
        {/* Header */}
        <div className="grid grid-cols-4 gap-[2%] items-center" style={{ padding: "2% 3%", background: "#f8fafc", fontSize: "0.4em", fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div className="col-span-2">Address</div><div>Price</div><div>Days</div>
        </div>
        {/* Rows */}
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-4 gap-[2%] items-center" style={{ padding: "2.5% 3%", background: i % 2 === 0 ? "#fff" : "#fafafa", borderTop: "1px solid #f1f5f9" }}>
            <div className="col-span-2 flex items-center gap-[4%]">
              <div className="rounded-full shrink-0" style={{ width: "0.55em", height: "0.55em", background: row.badge }} />
              <div className="rounded-sm" style={{ height: "0.5em", flex: 1, background: "#e5e7eb" }} />
            </div>
            <div style={{ fontSize: "0.45em", fontWeight: 600, color: branding.primaryColor }}>£{185 + i * 12}k</div>
            <div style={{ fontSize: "0.42em", color: "#6b7280" }}>{14 + i * 8}d</div>
          </div>
        ))}
      </div>
      {/* Advantage box */}
      <div className="rounded-sm" style={{ padding: "4% 5%", background: `${branding.accentColor}0d`, borderLeft: `2px solid ${branding.accentColor}` }}>
        <div style={{ fontSize: "0.45em", fontWeight: 700, color: branding.primaryColor, marginBottom: "3%" }}>Market Advantage</div>
        {[70, 50].map((w, i) => (
          <div key={i} className="rounded-sm" style={{ height: "0.45em", width: `${w}%`, background: "#d1d5db", marginBottom: i === 0 ? "2%" : 0 }} />
        ))}
      </div>
    </div>
  )
}

function NextStepsContent({ section, branding }: { section: PackSection; branding: Branding }) {
  const cfg = section.config
  const steps = [
    { title: cfg.step1Title || "Express Interest",    n: 1 },
    { title: cfg.step2Title || "Due Diligence",       n: 2 },
    { title: cfg.step3Title || "Reserve & Complete",  n: 3 },
  ]
  return (
    <div className="flex-1 flex flex-col gap-[3%]">
      {/* Steps */}
      {steps.map((step) => (
        <div key={step.n} className="flex gap-[3%]">
          <div className="rounded-full shrink-0 flex items-center justify-center font-bold text-white" style={{
            width: "1.6em", height: "1.6em", background: branding.accentColor, fontSize: "0.6em",
          }}>
            {step.n}
          </div>
          <div className="flex flex-col gap-[10%]" style={{ flex: 1 }}>
            <div className="rounded-sm" style={{ height: "0.6em", width: "65%", background: "#374151" }} />
            <div className="rounded-sm" style={{ height: "0.45em", width: "85%", background: "#e5e7eb" }} />
            <div className="rounded-sm" style={{ height: "0.45em", width: "70%", background: "#e5e7eb" }} />
          </div>
        </div>
      ))}
      {/* Urgency strip */}
      {cfg.showUrgencyNote !== false && (
        <div className="rounded-sm mt-[2%]" style={{ padding: "3% 4%", background: "#fef3c7", display: "flex", alignItems: "center", gap: "3%" }}>
          <span style={{ fontSize: "0.7em" }}>⚡</span>
          <div className="flex-1 flex flex-col gap-[10%]">
            <div className="rounded-sm" style={{ height: "0.45em", width: "80%", background: "#d97706" }} />
            <div className="rounded-sm" style={{ height: "0.4em", width: "60%", background: "#fbbf24" }} />
          </div>
        </div>
      )}
      {/* Disclaimer */}
      {cfg.showDisclaimer !== false && (
        <div className="flex flex-col gap-[6%] mt-[1%]">
          {[55, 45].map((w, i) => (
            <div key={i} className="rounded-sm" style={{ height: "0.4em", width: `${w}%`, background: "#e5e7eb" }} />
          ))}
        </div>
      )}
    </div>
  )
}

function ExecutiveSummaryContent({ section, branding }: { section: PackSection; branding: Branding }) {
  return (
    <div className="flex-1 flex flex-col gap-[3%]">
      {/* Highlight box */}
      <div className="rounded-sm flex items-center gap-[4%]" style={{
        padding: "4% 5%", background: `${branding.accentColor}12`, borderLeft: `3px solid ${branding.accentColor}`,
      }}>
        <div className="flex flex-col items-center shrink-0" style={{ minWidth: "15%" }}>
          <div className="font-bold" style={{ fontSize: "1.1em", color: branding.primaryColor }}>18%</div>
          <div style={{ fontSize: "0.38em", color: "#6b7280", textAlign: "center" }}>BMV</div>
        </div>
        <div className="flex flex-col gap-[12%]" style={{ flex: 1 }}>
          <div className="rounded-sm" style={{ height: "0.45em", width: "85%", background: `${branding.secondaryColor}30` }} />
          <div className="rounded-sm" style={{ height: "0.45em", width: "65%", background: `${branding.secondaryColor}20` }} />
        </div>
      </div>
      {/* Body text lines */}
      <div className="flex flex-col gap-[2%]">
        {[100, 94, 88, 76, 60, 80, 45].map((w, i) => (
          <div key={i} className="rounded-sm" style={{ height: "0.5em", width: `${w}%`, background: i < 4 ? "#e5e7eb" : "#f1f5f9" }} />
        ))}
      </div>
      {/* Quote box */}
      <div className="rounded-sm mt-[1%]" style={{
        padding: "3% 4%", background: "#f8fafc", borderLeft: `2px solid ${branding.secondaryColor}40`,
      }}>
        {[80, 60].map((w, i) => (
          <div key={i} className="rounded-sm" style={{ height: "0.45em", width: `${w}%`, background: "#d1d5db", marginBottom: i === 0 ? "2%" : 0 }} />
        ))}
      </div>
    </div>
  )
}

// ─── Unified section page preview ────────────────────────────────────────────

function SectionPagePreview({
  section, branding, isSelected, onSelect, logoUrl,
}: {
  section: PackSection; branding: Branding; isSelected: boolean; onSelect: () => void; logoUrl?: string | null
}) {
  const def = SECTION_CATALOG[section.type]
  const cfg = section.config
  const headFont = fontStack(branding.headingFont)
  const bodyFont = fontStack(branding.bodyFont)

  const contentMap: Partial<Record<SectionType, React.FC<{ section: PackSection; branding: Branding }>>> = {
    property_details:   PropertyDetailsContent,
    financial_analysis: FinancialAnalysisContent,
    market_evidence:    MarketEvidenceContent,
    next_steps:         NextStepsContent,
    executive_summary:  ExecutiveSummaryContent,
  }
  const ContentComponent = contentMap[section.type]

  return (
    <div
      className={cn(
        "relative overflow-hidden cursor-pointer transition-all rounded select-none bg-white",
        isSelected ? "ring-2 ring-blue-500 ring-offset-2" : "ring-1 ring-zinc-300 hover:ring-zinc-400",
      )}
      style={{ width: "100%", aspectRatio: "1 / 1.414", fontFamily: bodyFont, fontSize: 10 }}
      onClick={onSelect}
    >
      {/* Top accent bar */}
      <div className="absolute top-0 inset-x-0" style={{ height: 2, background: branding.secondaryColor }} />

      <div className="absolute inset-0 flex flex-col" style={{ padding: "9%", paddingTop: "9.5%" }}>
        {/* Section header */}
        <div className="shrink-0 mb-[4%]">
          <div className="font-semibold tracking-widest uppercase mb-[1.5%]"
            style={{ fontSize: "0.48em", color: branding.accentColor }}>
            {def.icon} {def.label}
          </div>
          <div className="font-bold leading-tight" style={{ fontSize: "0.95em", color: branding.primaryColor, fontFamily: headFont }}>
            {cfg.title || def.label}
          </div>
          {cfg.subtitle && (
            <div className="mt-[1%]" style={{ fontSize: "0.48em", color: `${branding.secondaryColor}99` }}>{cfg.subtitle}</div>
          )}
          <div className="rounded-full mt-[2%]" style={{ width: "2em", height: 2, background: branding.accentColor }} />
        </div>

        {/* Section-specific content */}
        {ContentComponent && (
          <ContentComponent section={section} branding={branding} />
        )}
      </div>

      {/* Footer mock */}
      <div className="absolute bottom-0 inset-x-0 flex items-center justify-between" style={{
        height: "4%", borderTop: "1px solid #f1f5f9", padding: "0 9%",
      }}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="Logo" style={{ maxHeight: "70%", maxWidth: "20%", objectFit: "contain", opacity: 0.5 }} />
        ) : (
          <div className="rounded-sm" style={{ height: "40%", width: "18%", background: "#f1f5f9" }} />
        )}
        <div className="rounded-sm" style={{ height: "40%", width: "6%", background: "#f1f5f9" }} />
      </div>
    </div>
  )
}

// ─── Section block wrapper ────────────────────────────────────────────────────

function SectionBlock({
  section, index, total, branding, isSelected, logoUrl,
  onSelect, onToggle, onDelete, onDuplicate, onMove,
}: {
  section: PackSection; index: number; total: number; branding: Branding
  isSelected: boolean; logoUrl?: string | null; onSelect: () => void; onToggle: () => void
  onDelete: () => void; onDuplicate: () => void; onMove: (dir: -1 | 1) => void
}) {
  const [hovered, setHovered] = useState(false)
  const def = SECTION_CATALOG[section.type]

  return (
    <div className="relative" onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="absolute -left-7 top-3 text-[11px] text-zinc-400 font-medium select-none tabular-nums">{index + 1}</div>

      {hovered && (
        <div className="absolute -top-9 right-0 z-20 flex items-center gap-0.5 bg-zinc-900/95 backdrop-blur-sm text-white rounded-lg px-2 py-1.5 shadow-xl">
          <span className="text-[10px] text-zinc-400 pr-2 border-r border-zinc-700 mr-1.5">{def.icon} {def.label}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(-1) }} disabled={index === 0}
            className="p-1 hover:text-blue-400 disabled:opacity-25 transition-colors rounded" title="Move up">
            <ChevronUp className="h-3 w-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMove(1) }} disabled={index === total - 1}
            className="p-1 hover:text-blue-400 disabled:opacity-25 transition-colors rounded" title="Move down">
            <ChevronDown className="h-3 w-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle() }}
            className={cn("p-1 transition-colors rounded", section.visible ? "hover:text-yellow-400" : "text-zinc-500 hover:text-yellow-300")}
            title={section.visible ? "Hide from PDF" : "Show in PDF"}>
            {section.visible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onDuplicate() }}
            className="p-1 hover:text-green-400 transition-colors rounded" title="Duplicate">
            <Copy className="h-3 w-3" />
          </button>
          <div className="w-px h-3 bg-zinc-700 mx-1" />
          <button type="button" onClick={(e) => { e.stopPropagation(); onDelete() }}
            className="p-1 hover:text-red-400 transition-colors rounded" title="Delete section">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      {!section.visible && (
        <div className="absolute inset-0 z-10 bg-white/75 rounded flex items-center justify-center pointer-events-none">
          <div className="flex items-center gap-2 text-zinc-400">
            <EyeOff className="h-5 w-5" /><span className="text-sm font-medium">Hidden in PDF</span>
          </div>
        </div>
      )}

      {section.type === "cover" ? (
        <CoverPagePreview section={section} branding={branding} isSelected={isSelected} onSelect={onSelect} logoUrl={logoUrl} />
      ) : (
        <SectionPagePreview section={section} branding={branding} isSelected={isSelected} onSelect={onSelect} logoUrl={logoUrl} />
      )}
    </div>
  )
}

// ─── Right panel: Cover section editor ───────────────────────────────────────

function CoverEditPanel({ section, updateCfg }: { section: PackSection; updateCfg: (k: string, v: any) => void }) {
  const cfg = section.config
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Cover Text</h3>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Eyebrow label</Label>
          <Input className="h-8 text-sm" value={cfg.eyebrow ?? ""} placeholder="Confidential Investment Memorandum"
            onChange={(e) => updateCfg("eyebrow", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Main headline</Label>
          <Input className="h-8 text-sm" value={cfg.headline ?? ""} placeholder="Exclusive Investment Opportunity"
            onChange={(e) => updateCfg("headline", e.target.value)} />
        </div>
      </div>
      <div className="space-y-3 pt-3 border-t">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Key Stats Strip</h3>
          <Switch checked={cfg.showStats !== false} onCheckedChange={(v) => updateCfg("showStats", v)} />
        </div>
        {cfg.showStats !== false && (
          <div className="space-y-2.5">
            {[
              { key: "stat1Label", placeholder: "Below Market Value" },
              { key: "stat2Label", placeholder: "Projected ROI" },
              { key: "stat3Label", placeholder: "Market Value" },
            ].map((s, i) => (
              <div key={s.key} className="space-y-1">
                <Label className="text-xs text-zinc-500">Stat {i + 1} label</Label>
                <Input className="h-7 text-sm" value={cfg[s.key] ?? ""} placeholder={s.placeholder}
                  onChange={(e) => updateCfg(s.key, e.target.value)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Right panel: Text/generic section editor ─────────────────────────────────

function TextSectionEditPanel({ section, updateCfg }: { section: PackSection; updateCfg: (k: string, v: any) => void }) {
  const cfg = section.config
  const def = SECTION_CATALOG[section.type]
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs text-zinc-500">Section title</Label>
        <Input className="h-8 text-sm" value={cfg.title ?? ""} placeholder={def.label}
          onChange={(e) => updateCfg("title", e.target.value)} />
      </div>
      {"subtitle" in def.defaultConfig && (
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Subtitle</Label>
          <Input className="h-8 text-sm" value={cfg.subtitle ?? ""} placeholder={String(def.defaultConfig.subtitle ?? "")}
            onChange={(e) => updateCfg("subtitle", e.target.value)} />
        </div>
      )}
      {"body" in def.defaultConfig && (
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Body text</Label>
          <Textarea className="text-sm min-h-[100px] resize-none" value={cfg.body ?? ""}
            placeholder="Write your section content…" onChange={(e) => updateCfg("body", e.target.value)} />
          <p className="text-[10px] text-zinc-400 leading-relaxed">
            Use <code className="bg-zinc-100 px-0.5 rounded">{"{{propertyAddress}}"}</code>, <code className="bg-zinc-100 px-0.5 rounded">{"{{bmvPercentage}}"}</code> etc.
          </p>
        </div>
      )}
      {section.type === "next_steps" && (
        <div className="space-y-4 pt-3 border-t">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Process Steps</h3>
          {[1, 2, 3].map(n => (
            <div key={n} className="space-y-1.5">
              <Label className="text-xs font-medium text-zinc-600">Step {n}</Label>
              <Input className="h-7 text-sm" value={cfg[`step${n}Title`] ?? ""}
                placeholder={String(def.defaultConfig[`step${n}Title`] ?? "")}
                onChange={(e) => updateCfg(`step${n}Title`, e.target.value)} />
              <Textarea className="text-sm min-h-[52px] resize-none" value={cfg[`step${n}Desc`] ?? ""}
                placeholder={String(def.defaultConfig[`step${n}Desc`] ?? "")}
                onChange={(e) => updateCfg(`step${n}Desc`, e.target.value)} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Right panel: Visibility toggles ─────────────────────────────────────────

function VisibilityPanel({ section, updateCfg }: { section: PackSection; updateCfg: (k: string, v: any) => void }) {
  type T = { key: string; label: string }
  const toggleMap: Partial<Record<SectionType, T[]>> = {
    cover:             [{ key: "showStats",           label: "Key stats strip" }],
    property_details:  [{ key: "showPhotos",           label: "Property photos" }, { key: "showSpecs", label: "Specification chips" },
                        { key: "showDescription",      label: "Listing description" }, { key: "showFeatures", label: "Features list" }],
    financial_analysis:[{ key: "showHeroMetrics",      label: "Hero metric strip" }, { key: "showCostBreakdown", label: "Cost breakdown table" },
                        { key: "showCashflow",          label: "Cashflow waterfall" }, { key: "showScenarios", label: "Yield scenarios" }, { key: "showARV", label: "ARV section" }],
    market_evidence:   [{ key: "showPortalLinks",      label: "Portal research links" }, { key: "showYieldColumn", label: "Rental yield column" },
                        { key: "showDaysOnMarket",      label: "Days on market" }, { key: "showConfidenceBadges", label: "Confidence badges" }, { key: "showAdvantageBox", label: "Market advantage box" }],
    next_steps:        [{ key: "showUrgencyNote",      label: "Urgency note" }, { key: "showDisclaimer", label: "Legal disclaimer" }],
  }
  const toggles = toggleMap[section.type] ?? []
  if (toggles.length === 0) return null
  return (
    <div className="pt-4 border-t space-y-1.5">
      <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Show / Hide Elements</p>
      {toggles.map(({ key, label }) => (
        <div key={key} className="flex items-center justify-between py-0.5">
          <span className="text-sm text-zinc-600">{label}</span>
          <Switch checked={section.config[key] !== false} onCheckedChange={(v) => updateCfg(key, v)} className="scale-90" />
        </div>
      ))}
    </div>
  )
}

// ─── Right panel: Global design ───────────────────────────────────────────────

function GlobalDesignPanel({ branding, onUpdate }: { branding: Branding; onUpdate: (b: Partial<Branding>) => void }) {
  return (
    <div className="space-y-6">
      {/* Starter presets */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2.5">Start from a Preset</h3>
        <div className="grid grid-cols-3 gap-2">
          {STARTER_PRESETS.map(preset => {
            const isActive = branding.primaryColor === preset.branding.primaryColor && branding.headingFont === preset.branding.headingFont
            const fontLabel = FONT_OPTIONS.find(f => f.id === preset.branding.headingFont)?.label ?? preset.branding.headingFont
            return (
              <button key={preset.label} type="button"
                onClick={() => onUpdate(preset.branding)}
                className={cn(
                  "rounded-lg overflow-hidden border-2 transition-all text-left hover:scale-105",
                  isActive ? "border-blue-500 shadow-md" : "border-transparent hover:border-zinc-300",
                )}>
                <div className="h-5 grid grid-cols-3">
                  {[preset.branding.primaryColor, preset.branding.secondaryColor, preset.branding.accentColor].map((c, i) => (
                    <div key={i} style={{ background: c }} />
                  ))}
                </div>
                <div className="bg-zinc-50 px-1.5 py-1.5">
                  <p className="text-[9px] font-semibold text-zinc-700 leading-tight truncate">{preset.label}</p>
                  <p className="text-[8px] text-zinc-400 leading-tight truncate">{fontLabel}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Colour presets */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Colour Palette</h3>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {COLOR_PRESETS.map(preset => {
            const isActive = branding.primaryColor === preset.primary && branding.accentColor === preset.accent
            return (
              <button key={preset.id} type="button"
                onClick={() => onUpdate({ primaryColor: preset.primary, secondaryColor: preset.secondary, accentColor: preset.accent })}
                className={cn("rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
                  isActive ? "border-blue-500 shadow-md" : "border-transparent hover:border-zinc-300")}>
                <div className="h-7 grid grid-cols-3">
                  {[preset.primary, preset.secondary, preset.accent].map((c, i) => (<div key={i} style={{ background: c }} />))}
                </div>
                <div className="text-[9px] py-1 text-zinc-500 bg-zinc-50 text-center leading-none">{preset.label}</div>
              </button>
            )
          })}
        </div>
        <div className="space-y-2.5">
          {[
            { key: "primaryColor",   label: "Primary (dark)",  value: branding.primaryColor },
            { key: "secondaryColor", label: "Secondary (mid)", value: branding.secondaryColor },
            { key: "accentColor",    label: "Accent (bright)", value: branding.accentColor },
          ].map(({ key, label, value }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="relative cursor-pointer shrink-0">
                <div className="w-8 h-8 rounded-md border border-zinc-200 shadow-sm" style={{ background: value }} />
                <input type="color" value={value} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  onChange={(e) => onUpdate({ [key]: e.target.value })} />
              </label>
              <div className="flex-1 text-sm text-zinc-700">{label}</div>
              <div className="text-[11px] font-mono text-zinc-400 tabular-nums">{value.toUpperCase()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Font selector */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-3">Typography</h3>
        <div className="space-y-1.5">
          {FONT_OPTIONS.map(f => (
            <button key={f.id} type="button"
              onClick={() => onUpdate({ headingFont: f.id, bodyFont: f.id })}
              className={cn("w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all",
                branding.headingFont === f.id ? "border-blue-500 bg-blue-50/70 shadow-sm" : "border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300")}>
              <span className="text-lg font-bold w-9 text-center shrink-0" style={{ fontFamily: f.stack }}>Aa</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium leading-tight" style={{ fontFamily: f.stack }}>{f.label}</p>
                <p className="text-[10px] text-zinc-400">{f.tag}</p>
              </div>
              {branding.headingFont === f.id && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Right panel: Settings ────────────────────────────────────────────────────

function SettingsPanel({ tmpl, update, companyLogo }: {
  tmpl: DesignerTemplate
  update: (fn: (t: DesignerTemplate) => DesignerTemplate) => void
  companyLogo: string | null
}) {
  const set = (key: keyof DesignerTemplate, value: any) => update(t => ({ ...t, [key]: value }))
  return (
    <div className="space-y-6">
      {/* Logo */}
      <div className="space-y-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Company Logo</h3>
        <div className="flex items-center gap-3 p-2.5 rounded-lg border border-zinc-200 bg-zinc-50">
          {companyLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={companyLogo} alt="Company logo" className="h-8 w-16 object-contain rounded" />
          ) : (
            <div className="h-8 w-16 rounded bg-zinc-200 flex items-center justify-center">
              <span className="text-[9px] text-zinc-400 text-center leading-tight">No logo</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-zinc-600 leading-tight">
              {companyLogo ? "Using company logo" : "No company logo set"}
            </p>
            <Link href="/dashboard/settings/company" className="text-[10px] text-blue-500 hover:text-blue-700 hover:underline">
              Edit in Company Settings →
            </Link>
          </div>
        </div>
      </div>

      {/* Active / Default */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Template Status</h3>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700">Active</p>
            <p className="text-xs text-zinc-400">Available for generating packs</p>
          </div>
          <Switch checked={tmpl.isActive} onCheckedChange={(v) => set("isActive", v)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-700">Set as default</p>
            <p className="text-xs text-zinc-400">Used when no template is specified</p>
          </div>
          <Switch checked={tmpl.isDefault} onCheckedChange={(v) => set("isDefault", v)} />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2 pt-3 border-t">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Description</h3>
        <Textarea className="text-sm min-h-[72px] resize-none" value={tmpl.description}
          placeholder="Optional description of this template…"
          onChange={(e) => set("description", e.target.value)} />
      </div>

      {/* Page Header */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Page Header</h3>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Left text</Label>
          <Input className="h-7 text-sm" value={tmpl.pageHeaderLeft}
            placeholder="e.g. Company name or blank"
            onChange={(e) => set("pageHeaderLeft", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Right text</Label>
          <Input className="h-7 text-sm" value={tmpl.pageHeaderRight}
            placeholder="Confidential"
            onChange={(e) => set("pageHeaderRight", e.target.value)} />
        </div>
        <p className="text-[10px] text-zinc-400 leading-relaxed">Leave both blank to hide the header strip on all pages.</p>
      </div>

      {/* Page Footer */}
      <div className="space-y-3 pt-3 border-t">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Page Footer</h3>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Left text override</Label>
          <Input className="h-7 text-sm" value={tmpl.pageFooterLeft}
            placeholder="Default: property address"
            onChange={(e) => set("pageFooterLeft", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-zinc-500">Right text override</Label>
          <Input className="h-7 text-sm" value={tmpl.pageFooterRight}
            placeholder="Default: Section · Page N"
            onChange={(e) => set("pageFooterRight", e.target.value)} />
        </div>
        <p className="text-[10px] text-zinc-400 leading-relaxed">Leave blank to use the default footer content.</p>
      </div>
    </div>
  )
}

// ─── Right panel: Add section ─────────────────────────────────────────────────

function AddSectionPanel({ existingTypes, onAdd }: { existingTypes: SectionType[]; onAdd: (t: SectionType) => void }) {
  const available = (Object.keys(SECTION_CATALOG) as SectionType[]).filter(t => !existingTypes.includes(t))
  if (available.length === 0) {
    return (
      <div className="text-center py-8 text-zinc-400">
        <Plus className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">All sections are already in your template.</p>
      </div>
    )
  }
  return (
    <div className="space-y-2">
      {available.map(type => {
        const def = SECTION_CATALOG[type]
        return (
          <button key={type} type="button" onClick={() => onAdd(type)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg border border-zinc-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition-all group">
            <span className="text-xl">{def.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-zinc-800">{def.label}</p>
              <p className="text-xs text-zinc-400 truncate">{def.description}</p>
            </div>
            <Plus className="h-4 w-4 text-zinc-300 group-hover:text-blue-400 transition-colors shrink-0" />
          </button>
        )
      })}
    </div>
  )
}

// ─── Right panel container ────────────────────────────────────────────────────

type PanelMode = "section" | "design" | "settings" | "add"

function EditingPanel({
  selectedSection, tmpl, mode, setMode,
  updateSectionCfg, updateBranding, update,
  existingTypes, onAddSection, companyLogo,
}: {
  selectedSection: PackSection | null
  tmpl: DesignerTemplate
  mode: PanelMode
  setMode: (m: PanelMode) => void
  updateSectionCfg: (k: string, v: any) => void
  updateBranding: (b: Partial<Branding>) => void
  update: (fn: (t: DesignerTemplate) => DesignerTemplate) => void
  existingTypes: SectionType[]
  onAddSection: (t: SectionType) => void
  companyLogo: string | null
}) {
  const def = selectedSection ? SECTION_CATALOG[selectedSection.type] : null
  const tabs = [
    { mode: "section"  as PanelMode, icon: <Settings2        className="h-3.5 w-3.5" />, label: "Section"  },
    { mode: "design"   as PanelMode, icon: <Palette          className="h-3.5 w-3.5" />, label: "Design"   },
    { mode: "settings" as PanelMode, icon: <SlidersHorizontal className="h-3.5 w-3.5" />, label: "Settings" },
    { mode: "add"      as PanelMode, icon: <Plus             className="h-3.5 w-3.5" />, label: "Add"      },
  ]
  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b shrink-0">
        {tabs.map(tab => (
          <button key={tab.mode} type="button" onClick={() => setMode(tab.mode)}
            className={cn("flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
              mode === tab.mode ? "border-b-2 border-blue-500 text-blue-600" : "text-zinc-500 hover:text-zinc-800")}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {mode === "section" && (
          selectedSection ? (
            <div>
              <div className="flex items-center gap-2.5 mb-5 pb-4 border-b">
                <span className="text-2xl">{def?.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-zinc-800">{def?.label}</p>
                  <p className="text-xs text-zinc-400">{def?.description}</p>
                </div>
              </div>
              {selectedSection.type === "cover" ? (
                <CoverEditPanel section={selectedSection} updateCfg={updateSectionCfg} />
              ) : (
                <TextSectionEditPanel section={selectedSection} updateCfg={updateSectionCfg} />
              )}
              <VisibilityPanel section={selectedSection} updateCfg={updateSectionCfg} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
              <Settings2 className="h-10 w-10 mb-3 opacity-25" />
              <p className="text-sm text-center leading-relaxed">Click any page on the left<br />to edit its content</p>
            </div>
          )
        )}
        {mode === "design" && <GlobalDesignPanel branding={tmpl.branding} onUpdate={updateBranding} />}
        {mode === "settings" && <SettingsPanel tmpl={tmpl} update={update} companyLogo={companyLogo} />}
        {mode === "add" && (
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-3">Add Section</p>
            <AddSectionPanel existingTypes={existingTypes} onAdd={type => { onAddSection(type); setMode("section") }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface PackTemplateDesignerProps { template: TemplateRecord | null }

export function PackTemplateDesigner({ template: rec }: PackTemplateDesignerProps) {
  const router = useRouter()
  const [tmpl, setTmpl] = useState<DesignerTemplate>(() => initTemplate(rec))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [panelMode, setPanelMode] = useState<PanelMode>("design")
  const [isDirty, setDirty] = useState(false)
  const [isSaving, setSaving] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [isDuplicating, setDuplicating] = useState(false)
  const [companyLogo, setCompanyLogo] = useState<string | null>(null)

  // ── Undo/Redo history ──
  const historyRef      = useRef<DesignerTemplate[]>([initTemplate(rec)])
  const historyIndexRef = useRef(0)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  // ── Fetch company logo on mount ──
  useEffect(() => {
    fetch("/api/company-profile")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        const logo = data?.companyProfile?.logoUrl ?? data?.logoUrl ?? null
        if (logo) setCompanyLogo(logo)
      })
      .catch(() => {})
  }, [])

  const update = useCallback((fn: (t: DesignerTemplate) => DesignerTemplate) => {
    setTmpl(current => {
      const next = fn(current)
      const history = historyRef.current.slice(0, historyIndexRef.current + 1)
      historyRef.current = [...history, next].slice(-50)
      historyIndexRef.current = historyRef.current.length - 1
      setCanUndo(historyIndexRef.current > 0)
      setCanRedo(false)
      return next
    })
    setDirty(true)
  }, [])

  const undo = useCallback(() => {
    if (historyIndexRef.current <= 0) return
    historyIndexRef.current -= 1
    setTmpl(historyRef.current[historyIndexRef.current])
    setCanUndo(historyIndexRef.current > 0)
    setCanRedo(true)
    setDirty(true)
  }, [])

  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return
    historyIndexRef.current += 1
    setTmpl(historyRef.current[historyIndexRef.current])
    setCanUndo(true)
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1)
    setDirty(true)
  }, [])

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo() }
      if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo() }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [undo, redo])

  const selectedSection = tmpl.sections.find(s => s.id === selectedId) ?? null

  const selectSection = (id: string) => { setSelectedId(id); setPanelMode("section") }

  const updateSectionCfg = useCallback((key: string, value: any) => {
    if (!selectedId) return
    update(t => ({ ...t, sections: t.sections.map(s => s.id === selectedId ? { ...s, config: { ...s.config, [key]: value } } : s) }))
  }, [selectedId, update])

  const updateBranding = useCallback((b: Partial<Branding>) => {
    update(t => ({ ...t, branding: { ...t.branding, ...b } }))
  }, [update])

  const toggleSection = (id: string) =>
    update(t => ({ ...t, sections: t.sections.map(s => s.id === id ? { ...s, visible: !s.visible } : s) }))

  const deleteSection = (id: string) => {
    update(t => ({ ...t, sections: t.sections.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i })) }))
    if (selectedId === id) setSelectedId(null)
  }

  const duplicateSection = (id: string) =>
    update(t => {
      const idx = t.sections.findIndex(s => s.id === id)
      if (idx < 0) return t
      const orig = t.sections[idx]
      const clone: PackSection = { ...orig, id: `${orig.type}-${Date.now()}`, order: idx + 1 }
      const next = [...t.sections.slice(0, idx + 1), clone, ...t.sections.slice(idx + 1)]
      return { ...t, sections: next.map((s, i) => ({ ...s, order: i })) }
    })

  const moveSection = (id: string, dir: -1 | 1) =>
    update(t => {
      const arr = [...t.sections]
      const idx = arr.findIndex(s => s.id === id)
      const to = idx + dir
      if (to < 0 || to >= arr.length) return t
      ;[arr[idx], arr[to]] = [arr[to], arr[idx]]
      return { ...t, sections: arr.map((s, i) => ({ ...s, order: i })) }
    })

  const addSection = (type: SectionType) => {
    const def = SECTION_CATALOG[type]
    const ns: PackSection = { id: `${type}-${Date.now()}`, type, visible: true, order: tmpl.sections.length, config: { ...def.defaultConfig } }
    update(t => ({ ...t, sections: [...t.sections, ns] }))
    setSelectedId(ns.id)
  }

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    update(t => {
      const arr = [...t.sections]
      const [moved] = arr.splice(from, 1)
      arr.splice(to, 0, moved)
      return { ...t, sections: arr.map((s, i) => ({ ...s, order: i })) }
    })
  }

  const handleDuplicate = async () => {
    if (!rec?.id) return
    setDuplicating(true)
    try {
      const res = await fetch(`/api/investor-pack-templates/${rec.id}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error("Duplicate failed")
      const data = await res.json()
      const newId = data.template?.id ?? data.id
      if (newId) {
        toast.success("Template duplicated")
        router.push(`/dashboard/settings/investor-packs/${newId}`)
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to duplicate")
    } finally { setDuplicating(false) }
  }

  const handleSave = async () => {
    if (!tmpl.name.trim()) { toast.error("Template name is required"); return }
    setSaving(true)
    try {
      const body = toApiBody(tmpl)
      if (rec?.id) {
        const res = await fetch(`/api/investor-pack-templates/${rec.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error || "Save failed")
        if (tmpl.isDefault) await fetch(`/api/investor-pack-templates/${rec.id}/set-default`, { method: "POST" })
      } else {
        const res = await fetch("/api/investor-pack-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json()).error || "Save failed")
        const data = await res.json()
        const savedId = data.template?.id ?? data.id
        if (tmpl.isDefault && savedId) await fetch(`/api/investor-pack-templates/${savedId}/set-default`, { method: "POST" })
        if (savedId) router.replace(`/dashboard/settings/investor-packs/${savedId}`)
      }
      setDirty(false)
      toast.success("Template saved")
    } catch (err: any) {
      toast.error(err.message || "Failed to save template")
    } finally { setSaving(false) }
  }

  const handlePreview = async () => {
    setPreviewLoading(true)
    try {
      const res = await fetch("/api/investor-pack-templates/preview-html", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toApiBody(tmpl)),
      })
      if (res.ok) {
        const html = await res.text()
        const blob = new Blob([html], { type: "text/html" })
        const url = URL.createObjectURL(blob)
        window.open(url, "_blank")
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      } else { toast.error("Failed to generate preview") }
    } catch { toast.error("Preview failed") }
    finally { setPreviewLoading(false) }
  }

  const sorted = [...tmpl.sections].sort((a, b) => a.order - b.order)

  return (
    <div className="h-screen flex flex-col bg-zinc-50 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-white shadow-sm shrink-0 z-10">
        <Link href="/dashboard/settings/investor-packs" className="text-zinc-400 hover:text-zinc-700 transition-colors shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="w-px h-5 bg-zinc-200 shrink-0" />

        {/* Undo / Redo */}
        <Button variant="ghost" size="sm" onClick={undo} disabled={!canUndo}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-25 h-7 w-7 p-0 shrink-0" title="Undo (Ctrl+Z)">
          <Undo2 className="h-3.5 w-3.5" />
        </Button>
        <Button variant="ghost" size="sm" onClick={redo} disabled={!canRedo}
          className="text-zinc-400 hover:text-zinc-700 disabled:opacity-25 h-7 w-7 p-0 shrink-0" title="Redo (Ctrl+Shift+Z)">
          <Redo2 className="h-3.5 w-3.5" />
        </Button>
        <div className="w-px h-5 bg-zinc-200 shrink-0" />

        {/* Template name */}
        <input
          className="text-sm font-semibold bg-transparent border-0 outline-none min-w-0 flex-1 max-w-[200px] focus:ring-1 focus:ring-blue-400 rounded px-1.5 -ml-1.5 py-0.5"
          value={tmpl.name}
          onChange={(e) => update(t => ({ ...t, name: e.target.value }))}
          placeholder="Template name"
        />

        {/* Status badges */}
        <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
          tmpl.isActive ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-500")}>
          {tmpl.isActive ? "Active" : "Inactive"}
        </span>
        {tmpl.isDefault && (
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 shrink-0">
            Default
          </span>
        )}

        {isDirty && (
          <div className="flex items-center gap-1 text-xs text-amber-600 shrink-0">
            <Circle className="h-2 w-2 fill-amber-500" /><span>Unsaved</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {rec?.id && (
            <Button variant="ghost" size="sm" onClick={handleDuplicate} disabled={isDuplicating} className="text-xs gap-1.5 text-zinc-500">
              {isDuplicating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              Duplicate
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handlePreview} disabled={previewLoading} className="text-xs gap-1.5">
            {previewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MonitorPlay className="h-3.5 w-3.5" />}
            Preview PDF
          </Button>
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="text-xs gap-1.5">
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {isSaving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Canvas ── */}
        <div className="flex-1 overflow-y-auto bg-zinc-100">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="sections">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps}
                  className="max-w-[520px] mx-auto py-10 px-12 space-y-7">
                  {sorted.map((section, i) => (
                    <Draggable key={section.id} draggableId={section.id} index={i}>
                      {(drag, snapshot) => (
                        <div ref={drag.innerRef} {...drag.draggableProps}
                          className={cn(snapshot.isDragging && "opacity-80 shadow-2xl")}>
                          <div className="flex items-center justify-between mb-1.5 px-0.5">
                            <div {...drag.dragHandleProps}
                              className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-600 cursor-grab active:cursor-grabbing transition-colors">
                              <GripVertical className="h-4 w-4" />
                              <span className="text-[11px] font-medium">
                                {SECTION_CATALOG[section.type].icon} {SECTION_CATALOG[section.type].label}
                              </span>
                            </div>
                            {!section.visible && (
                              <span className="text-[10px] text-zinc-400 flex items-center gap-1">
                                <EyeOff className="h-3 w-3" /> Hidden
                              </span>
                            )}
                          </div>
                          <SectionBlock
                            section={section} index={i} total={sorted.length}
                            branding={tmpl.branding} isSelected={selectedId === section.id}
                            logoUrl={companyLogo}
                            onSelect={() => selectSection(section.id)}
                            onToggle={() => toggleSection(section.id)}
                            onDelete={() => deleteSection(section.id)}
                            onDuplicate={() => duplicateSection(section.id)}
                            onMove={(dir) => moveSection(section.id, dir)}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                  <button type="button" onClick={() => setPanelMode("add")}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-zinc-300 rounded-lg text-zinc-400 hover:text-blue-500 hover:border-blue-400 transition-all text-sm font-medium">
                    <Plus className="h-4 w-4" /> Add Section
                  </button>
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>

        {/* ── Editing panel ── */}
        <div className="w-80 bg-white border-l flex flex-col overflow-hidden shrink-0 shadow-xl">
          <EditingPanel
            selectedSection={selectedSection}
            tmpl={tmpl}
            mode={panelMode}
            setMode={setPanelMode}
            updateSectionCfg={updateSectionCfg}
            updateBranding={updateBranding}
            update={update}
            existingTypes={tmpl.sections.map(s => s.type)}
            onAddSection={addSection}
            companyLogo={companyLogo}
          />
        </div>
      </div>
    </div>
  )
}
