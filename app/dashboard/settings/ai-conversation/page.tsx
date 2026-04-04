"use client"

import { useState, useEffect } from "react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Zap, MessageSquare, Facebook, Pencil, Globe,
  Loader2, Save, AlertTriangle, CheckCircle2, Info,
} from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/ui/page-header"
import { cn } from "@/lib/utils"

interface AIConvSettings {
  id: string
  enabled: boolean
  facebookLeadsEnabled: boolean
  manualLeadsEnabled: boolean
  apiLeadsEnabled: boolean
  sendInitialGreeting: boolean
  maxMessagesPerLead: number
  updatedAt: string
  updatedBy: string | null
}

function SourceRow({
  icon: Icon,
  iconColor,
  label,
  description,
  value,
  onChange,
  disabled,
  recommended,
}: {
  icon: React.ElementType
  iconColor: string
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  recommended?: "on" | "off"
}) {
  return (
    <div className={cn(
      "flex items-start gap-4 rounded-xl border p-4 transition-colors",
      disabled ? "opacity-50 pointer-events-none bg-gray-50" : "bg-white hover:bg-gray-50/60"
    )}>
      <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconColor)}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{label}</span>
          {recommended && (
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] px-1.5 py-0",
                recommended === "on"
                  ? "border-green-200 bg-green-50 text-green-700"
                  : "border-gray-200 bg-gray-50 text-gray-500"
              )}
            >
              Recommended {recommended === "on" ? "ON" : "OFF"}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
      <Switch
        checked={value}
        onCheckedChange={onChange}
        className="mt-1 shrink-0"
      />
    </div>
  )
}

export default function AIConversationSettingsPage() {
  const [settings, setSettings] = useState<AIConvSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/ai-conversation-settings")
        if (res.ok) {
          const data = await res.json()
          setSettings(data.settings)
        } else {
          toast.error("Failed to load settings")
        }
      } catch {
        toast.error("Failed to load settings")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const update = (patch: Partial<AIConvSettings>) => {
    setSettings((prev) => prev ? { ...prev, ...patch } : prev)
    setIsDirty(true)
  }

  const save = async () => {
    if (!settings) return
    setIsSaving(true)
    try {
      const res = await fetch("/api/ai-conversation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled:              settings.enabled,
          facebookLeadsEnabled: settings.facebookLeadsEnabled,
          manualLeadsEnabled:   settings.manualLeadsEnabled,
          apiLeadsEnabled:      settings.apiLeadsEnabled,
          sendInitialGreeting:  settings.sendInitialGreeting,
          maxMessagesPerLead:   settings.maxMessagesPerLead,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSettings(data.settings)
        setIsDirty(false)
        toast.success("AI conversation settings saved")
      } else {
        const err = await res.json()
        toast.error(err.error || "Failed to save")
      }
    } catch {
      toast.error("Failed to save settings")
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!settings) return null

  const activeSourceCount = [
    settings.facebookLeadsEnabled,
    settings.manualLeadsEnabled,
    settings.apiLeadsEnabled,
  ].filter(Boolean).length

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader
        title="AI Conversation"
        subtitle="Control when the AI SMS agent automatically starts conversations with new vendor leads"
      />

      {/* Master switch */}
      <div className={cn(
        "rounded-xl border-2 p-5 transition-colors",
        settings.enabled
          ? "border-blue-200 bg-blue-50/40"
          : "border-gray-200 bg-gray-50"
      )}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 items-center justify-center rounded-xl",
              settings.enabled ? "bg-blue-600" : "bg-gray-300"
            )}>
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-gray-900">AI Auto-Conversation</p>
                <Badge variant={settings.enabled ? "default" : "secondary"} className="text-[10px] px-1.5">
                  {settings.enabled ? "ENABLED" : "DISABLED"}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Master switch — when OFF, AI never auto-starts regardless of source settings
              </p>
            </div>
          </div>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => update({ enabled: v })}
            className="shrink-0"
          />
        </div>

        {settings.enabled && (
          <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              AI will auto-start for{" "}
              <strong>{activeSourceCount}</strong> lead source{activeSourceCount !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {/* Per-source toggles */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Lead Sources</h3>

        <SourceRow
          icon={Facebook}
          iconColor="bg-blue-600"
          label="Facebook Lead Ads"
          description="Vendor fills in your Facebook Lead Ad form. High intent — they've actively raised their hand. AI should respond immediately while interest is hot."
          value={settings.facebookLeadsEnabled}
          onChange={(v) => update({ facebookLeadsEnabled: v })}
          disabled={!settings.enabled}
          recommended="on"
        />

        <SourceRow
          icon={Pencil}
          iconColor="bg-amber-500"
          label="Manual Leads"
          description="Lead entered by a sourcer via the dashboard form. May be a warm referral or an existing relationship — verify suitability before sending an AI message."
          value={settings.manualLeadsEnabled}
          onChange={(v) => update({ manualLeadsEnabled: v })}
          disabled={!settings.enabled}
          recommended="off"
        />

        <SourceRow
          icon={Globe}
          iconColor="bg-purple-600"
          label="API / cURL Leads"
          description="Leads created programmatically via the REST API (webhooks, integrations, scripts). Enable only if your integration pre-qualifies the data quality."
          value={settings.apiLeadsEnabled}
          onChange={(v) => update({ apiLeadsEnabled: v })}
          disabled={!settings.enabled}
          recommended="off"
        />
      </div>

      {/* Behaviour settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Behaviour</h3>

        <div className="rounded-xl border bg-white p-4 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <Label className="text-sm font-medium text-gray-900">Send opening message</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  AI sends the first message to the vendor. When OFF, the AI only responds to incoming messages.
                </p>
              </div>
            </div>
            <Switch
              checked={settings.sendInitialGreeting}
              onCheckedChange={(v) => update({ sendInitialGreeting: v })}
              disabled={!settings.enabled}
              className="mt-1 shrink-0"
            />
          </div>

          <div className="border-t pt-4 flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <Label className="text-sm font-medium text-gray-900">Max messages per lead</Label>
                <p className="text-xs text-gray-500 mt-0.5">
                  Safety cap — AI stops auto-responding after this many messages to prevent runaway conversations.
                </p>
              </div>
            </div>
            <select
              value={settings.maxMessagesPerLead}
              onChange={(e) => update({ maxMessagesPerLead: parseInt(e.target.value) })}
              disabled={!settings.enabled}
              className="w-20 rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[5, 10, 15, 20, 30, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Warning when manual is on */}
      {settings.manualLeadsEnabled && settings.enabled && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Manual leads auto-start is ON.</strong> Every lead created via the dashboard will immediately receive an AI SMS. Make sure the vendor data is verified before saving — invalid phone numbers or warm referrals will receive automated messages.
          </p>
        </div>
      )}

      {/* Save */}
      <div className="flex items-center justify-between border-t pt-6">
        <p className="text-xs text-gray-400">
          {settings.updatedAt
            ? `Last updated ${new Date(settings.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
            : "Not yet saved"}
        </p>
        <Button onClick={save} disabled={!isDirty || isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Changes
        </Button>
      </div>
    </div>
  )
}
