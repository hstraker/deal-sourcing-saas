"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  Star,
  FileText,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

// ── Types ──────────────────────────────────────────────────────────────────

interface Template {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  colorScheme: string
  sections: any
  usageCount: number
  lastUsedAt: string | null
  createdAt: string
}

interface TemplateStats {
  totalGenerated: number
  last30Days: number
  last7Days: number
  mostUsedTemplate: { name: string; count: number } | null
}

// ── Color scheme definitions (mirrors designer) ────────────────────────────

const SCHEME_COLORS: Record<string, string[]> = {
  blue:   ["#0f172a", "#1e3a8a", "#2563eb"],
  slate:  ["#0f172a", "#1e40af", "#3b82f6"],
  green:  ["#052e16", "#065f46", "#059669"],
  purple: ["#1e1b4b", "#4c1d95", "#7c3aed"],
  gold:   ["#1c1917", "#78350f", "#d97706"],
}

const SCHEME_LABELS: Record<string, string> = {
  blue: "Classic Blue", slate: "Slate Navy", green: "Forest Green",
  purple: "Royal Purple", gold: "Premium Gold",
}

const SECTION_ORDER = ["cover", "property", "investment", "comparables", "cta"]
const SECTION_LABELS: Record<string, string> = {
  cover: "Cover", property: "Property", investment: "Analysis",
  comparables: "Evidence", cta: "CTA",
}
const BLOCK_HEIGHTS: Record<string, number> = {
  cover: 20, property: 14, investment: 17, comparables: 14, cta: 12,
}

// ── TemplateCard ───────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onDuplicate,
  onDelete,
  onSetDefault,
}: {
  template: Template
  onDuplicate: () => void
  onDelete: () => void
  onSetDefault: () => void
}) {
  const router = useRouter()
  const colors = SCHEME_COLORS[template.colorScheme] ?? SCHEME_COLORS.blue

  // Parse sections for mini preview
  const sections: Array<{ type: string; enabled: boolean }> = (() => {
    try {
      const raw = Array.isArray(template.sections) ? template.sections : []
      const sorted = [...raw].sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0))
      const types = sorted.map((s: any) => s.type)
      // Fill any missing from SECTION_ORDER
      const extra = SECTION_ORDER.filter((t) => !types.includes(t)).map((t) => ({ type: t, enabled: true }))
      return [...sorted.map((s: any) => ({ type: s.type, enabled: s.enabled !== false })), ...extra]
    } catch {
      return SECTION_ORDER.map((t) => ({ type: t, enabled: true }))
    }
  })()

  const lastUsed = template.lastUsedAt
    ? new Date(template.lastUsedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "Never used"

  return (
    <Card className="relative overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* 3-stripe colour bar */}
      <div className="flex h-2 shrink-0">
        {colors.map((c, i) => (
          <div key={i} className="flex-1" style={{ background: c }} />
        ))}
      </div>

      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-sm leading-tight truncate">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{template.description}</p>
            )}
          </div>
          {/* Mini A4 preview (80×113) */}
          <div
            className="shrink-0 rounded border shadow-sm overflow-hidden"
            style={{ width: 64, height: 90, background: "#fff" }}
          >
            <div style={{ background: colors[0], height: 5, width: "100%" }} />
            <div className="p-1 space-y-0.5">
              {sections.slice(0, 5).map((s) => (
                <div
                  key={s.type}
                  className="rounded-[2px]"
                  style={{
                    height: BLOCK_HEIGHTS[s.type] ?? 10,
                    background: s.enabled ? colors[1] : "#e5e7eb",
                    opacity: s.enabled ? 1 : 0.35,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 flex-1 flex flex-col justify-between gap-3">
        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          {template.isDefault && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 gap-0.5 bg-blue-600 hover:bg-blue-600">
              <Star className="h-2.5 w-2.5" /> Default
            </Badge>
          )}
          {!template.isActive && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-gray-400">
              Inactive
            </Badge>
          )}
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 capitalize">
            {SCHEME_LABELS[template.colorScheme] ?? template.colorScheme}
          </Badge>
        </div>

        {/* Stats */}
        <div className="text-xs text-gray-400 flex items-center gap-3">
          <span>{template.usageCount} generated</span>
          <span>·</span>
          <span>Last: {lastUsed}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1 border-t">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs"
            onClick={() => router.push(`/dashboard/settings/investor-packs/${template.id}`)}
          >
            <Edit className="h-3 w-3 mr-1" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs px-2"
            title="Duplicate"
            onClick={onDuplicate}
          >
            <Copy className="h-3 w-3" />
          </Button>
          {!template.isDefault && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2"
              title="Set as default"
              onClick={onSetDefault}
            >
              <Star className="h-3 w-3" />
            </Button>
          )}
          {!template.isDefault && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs px-2 text-red-500 hover:bg-red-50"
              title="Delete"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function InvestorPackTemplatesManager() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Template[]>([])
  const [stats, setStats] = useState<TemplateStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTemplates()
    fetchStats()
  }, [])

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/investor-pack-templates")
      if (!res.ok) throw new Error()
      const data = await res.json()
      setTemplates(data.templates ?? [])
    } catch {
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/investor-pack-templates/stats")
      if (!res.ok) return
      const data = await res.json()
      setStats(data)
    } catch {}
  }

  const handleDuplicate = async (template: Template) => {
    try {
      const res = await fetch(`/api/investor-pack-templates/${template.id}/duplicate`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success(`"${template.name}" duplicated`)
      fetchTemplates()
    } catch {
      toast.error("Failed to duplicate template")
    }
  }

  const handleDelete = async (template: Template) => {
    if (!confirm(`Delete "${template.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/investor-pack-templates/${template.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      toast.success(`"${template.name}" deleted`)
      fetchTemplates()
    } catch {
      toast.error("Failed to delete template")
    }
  }

  const handleSetDefault = async (template: Template) => {
    try {
      const res = await fetch(`/api/investor-pack-templates/${template.id}/set-default`, { method: "POST" })
      if (!res.ok) throw new Error()
      toast.success(`"${template.name}" is now the default`)
      fetchTemplates()
    } catch {
      toast.error("Failed to set as default")
    }
  }

  return (
    <div className="space-y-6">

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Generated", value: stats.totalGenerated, icon: FileText },
            { label: "Last 30 Days",    value: stats.last30Days,    icon: TrendingUp },
            { label: "Last 7 Days",     value: stats.last7Days,     icon: BarChart3 },
            {
              label: "Most Used",
              value: stats.mostUsedTemplate?.count ?? 0,
              sub: stats.mostUsedTemplate?.name ?? "—",
              icon: Star,
            },
          ].map(({ label, value, sub, icon: Icon }) => (
            <div key={label} className="rounded-lg border bg-card px-4 py-3 flex items-center gap-3">
              <Icon className="h-4 w-4 text-gray-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs text-gray-400">{label}</p>
                <p className="text-xl font-bold leading-tight">{value}</p>
                {sub && <p className="text-[10px] text-gray-400 truncate">{sub}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Templates</h2>
          <p className="text-xs text-gray-400">
            {templates.length} template{templates.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => router.push("/dashboard/settings/investor-packs/new")}>
          <Plus className="h-4 w-4 mr-2" /> New Template
        </Button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-gray-400 gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 text-gray-400 border rounded-lg">
          <FileText className="h-8 w-8 opacity-30" />
          <p className="text-sm">No templates yet</p>
          <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/settings/investor-packs/new")}>
            Create your first template
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onDuplicate={() => handleDuplicate(t)}
              onDelete={() => handleDelete(t)}
              onSetDefault={() => handleSetDefault(t)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
