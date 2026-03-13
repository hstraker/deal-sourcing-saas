"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  FlaskConical,
  Shuffle,
  Send,
  Loader2,
  CheckCircle,
  XCircle,
  ExternalLink,
  Activity,
  Users,
  TrendingUp,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
} from "lucide-react"
import { MOCK_SCENARIOS, MOCK_SCENARIO_IDS } from "@/lib/vendor-checks/test-mode/mock-scenarios"
import type { MockScenarioId } from "@/lib/vendor-checks/test-mode/mock-scenarios"

// ── Types ──────────────────────────────────────────────────────────────────

interface PipelineStats {
  totalVendors: number
  newThisWeek: number
  conversionRate: number
}

interface TestRun {
  id: string
  vendorName: string
  propertyAddress: string
  pipelineStage: string
  latestCheckRisk: string | null
  createdAt: string
}

interface Props {
  stats: PipelineStats
  recentTestRuns: TestRun[]
}

interface LeadFormData {
  fullName: string
  phoneNumber: string
  propertyAddress: string
  propertyPostcode: string
  email: string
  urgency: string
  reason: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const RANDOM_DATA = {
  names: [
    "James Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson",
    "David Taylor", "Olivia Davies", "Robert Evans", "Sophie Thomas",
    "William Roberts", "Emily Williams", "John Anderson", "Lucy Martin",
  ],
  streets: [
    "High Street", "Park Road", "Church Lane", "Station Road",
    "Victoria Street", "Manor Road", "Mill Lane", "Green Lane",
    "Main Street", "Oak Avenue", "Elm Road", "Cedar Close",
  ],
  areas: ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool", "Sheffield", "Newcastle"],
  postcodes: [
    "SW1A 1AA", "M1 1AA", "B1 1AA", "LS1 1AA",
    "BS1 1AA", "L1 1AA", "S1 1AA", "NE1 1AA",
  ],
  urgencies: ["urgent", "soon", "flexible"] as const,
  reasons: ["relocation", "financial", "inherited", "downsizing", "other"] as const,
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRandomLead(): LeadFormData {
  const name = pick(RANDOM_DATA.names)
  const houseNo = Math.floor(Math.random() * 200) + 1
  return {
    fullName: name,
    phoneNumber: `+447${Math.floor(Math.random() * 900000000) + 100000000}`,
    propertyAddress: `${houseNo} ${pick(RANDOM_DATA.streets)}, ${pick(RANDOM_DATA.areas)}`,
    propertyPostcode: pick(RANDOM_DATA.postcodes),
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    urgency: pick(RANDOM_DATA.urgencies),
    reason: pick(RANDOM_DATA.reasons),
  }
}

const RISK_CONFIG = {
  clear: {
    label: "Clear",
    icon: ShieldCheck,
    bg: "bg-green-50",
    border: "border-green-200",
    text: "text-green-700",
    iconColor: "text-green-500",
    ring: "ring-green-300",
  },
  caution: {
    label: "Caution",
    icon: ShieldAlert,
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-700",
    iconColor: "text-amber-500",
    ring: "ring-amber-300",
  },
  red_flag: {
    label: "Red Flag",
    icon: ShieldX,
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-700",
    iconColor: "text-red-500",
    ring: "ring-red-300",
  },
}

const STAGE_LABELS: Record<string, { label: string; colour: string }> = {
  NEW_LEAD:            { label: "New Lead",            colour: "bg-blue-100 text-blue-700" },
  AI_CONVERSATION:     { label: "AI Conversation",     colour: "bg-purple-100 text-purple-700" },
  DEAL_VALIDATION:     { label: "Deal Validation",     colour: "bg-amber-100 text-amber-700" },
  OFFER_MADE:          { label: "Offer Made",          colour: "bg-indigo-100 text-indigo-700" },
  OFFER_ACCEPTED:      { label: "Offer Accepted",      colour: "bg-green-100 text-green-700" },
  OFFER_REJECTED:      { label: "Offer Rejected",      colour: "bg-red-100 text-red-700" },
  VIDEO_SENT:          { label: "Video Sent",          colour: "bg-teal-100 text-teal-700" },
  RETRY_1:             { label: "Retry 1",             colour: "bg-orange-100 text-orange-700" },
  RETRY_2:             { label: "Retry 2",             colour: "bg-orange-100 text-orange-700" },
  RETRY_3:             { label: "Retry 3",             colour: "bg-orange-100 text-orange-700" },
  PAPERWORK_SENT:      { label: "Paperwork Sent",      colour: "bg-cyan-100 text-cyan-700" },
  READY_FOR_INVESTORS: { label: "Ready for Investors", colour: "bg-emerald-100 text-emerald-700" },
  DEAD_LEAD:           { label: "Dead Lead",           colour: "bg-gray-100 text-gray-500" },
}

function portalBadge(risk: string | null) {
  if (!risk) return <span className="text-xs text-gray-400">Pending</span>
  if (risk === "red_flag")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><ShieldX className="w-3 h-3" />Red Flag</span>
  if (risk === "caution")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><ShieldAlert className="w-3 h-3" />Caution</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><ShieldCheck className="w-3 h-3" />Clear</span>
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LeadSimulator({ stats, recentTestRuns }: Props) {
  const router = useRouter()

  const [formData, setFormData] = useState<LeadFormData>({
    fullName: "", phoneNumber: "", propertyAddress: "",
    propertyPostcode: "", email: "", urgency: "", reason: "",
  })
  const [selectedScenario, setSelectedScenario] = useState<MockScenarioId>("CLEAR_NEVER_LISTED")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    message: string
    leadId?: string
    leadUrl?: string
  } | null>(null)
  const [runs, setRuns] = useState<TestRun[]>(recentTestRuns)

  const handleRandom = () => {
    setFormData(generateRandomLead())
    toast.success("Random lead generated", { description: "Click Submit Lead to send to pipeline." })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.fullName || !formData.phoneNumber || !formData.propertyAddress) {
      toast.error("Required fields missing", { description: "Fill in Name, Phone and Address." })
      return
    }
    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      const res = await fetch("/api/facebook-leads/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadgen_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_time: new Date().toISOString(),
          isTest: true,
          testScenario: selectedScenario,
          field_data: [
            { name: "full_name",          values: [formData.fullName] },
            { name: "phone_number",       values: [formData.phoneNumber] },
            { name: "property_address",   values: [formData.propertyAddress] },
            { name: "property_postcode",  values: [formData.propertyPostcode] },
            { name: "email",              values: [formData.email] },
            { name: "urgency",            values: [formData.urgency] },
            { name: "selling_reason",     values: [formData.reason] },
          ],
        }),
      })

      const result = await res.json()

      if (result.success) {
        const newRun: TestRun = {
          id: result.leadId,
          vendorName: formData.fullName,
          propertyAddress: formData.propertyAddress,
          pipelineStage: "NEW_LEAD",
          latestCheckRisk: null,
          createdAt: new Date().toISOString(),
        }
        setRuns((prev) => [newRun, ...prev].slice(0, 10))
        setSubmitResult({
          success: true,
          message: "Lead added to pipeline! AI conversation starting.",
          leadId: result.leadId,
          leadUrl: result.leadUrl || `/dashboard/vendors?leadId=${result.leadId}`,
        })
        toast.success("Lead submitted!", { description: "Check the pipeline to follow progress." })
        setFormData({ fullName: "", phoneNumber: "", propertyAddress: "", propertyPostcode: "", email: "", urgency: "", reason: "" })
      } else {
        throw new Error(result.message || "Failed to submit lead")
      }
    } catch (err: any) {
      setSubmitResult({ success: false, message: err.message || "Submission failed" })
      toast.error("Submission failed", { description: err.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-purple-600" />
            Lead Simulator
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Test the full lead pipeline — Facebook Ad → Portal Check → AI SMS → Vendor Lead
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/vendors")}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View Pipeline
        </Button>
      </div>

      {/* Pipeline stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total in Pipeline", value: stats.totalVendors, icon: Users, colour: "text-blue-600" },
          { label: "New This Week",     value: stats.newThisWeek,  icon: Activity, colour: "text-green-600" },
          { label: "Lead → Validated",  value: `${stats.conversionRate}%`, icon: TrendingUp, colour: "text-amber-600" },
          { label: "Test Runs",         value: runs.length,        icon: FlaskConical, colour: "text-purple-600" },
        ].map(({ label, value, icon: Icon, colour }) => (
          <div key={label} className="rounded-xl border border-gray-200 bg-white p-4 flex items-center gap-3">
            <div className={`${colour} flex-shrink-0`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900 leading-none">{value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main grid: scenario picker + lead form */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Scenario picker */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-purple-600" />
            <h2 className="text-sm font-semibold text-gray-900">Portal Check Scenario</h2>
          </div>
          <div className="p-4 space-y-2">
            {MOCK_SCENARIO_IDS.map((id) => {
              const scenario = MOCK_SCENARIOS[id]
              const risk = RISK_CONFIG[scenario.expectedRisk]
              const RiskIcon = risk.icon
              const isSelected = selectedScenario === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedScenario(id)}
                  className={`
                    w-full text-left rounded-lg border px-4 py-3 transition-all duration-100
                    ${isSelected
                      ? `${risk.bg} ${risk.border} ring-2 ${risk.ring}`
                      : "border-gray-100 bg-gray-50 hover:border-gray-200 hover:bg-white"}
                  `}
                >
                  <div className="flex items-start gap-3">
                    <RiskIcon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${isSelected ? risk.iconColor : "text-gray-400"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${isSelected ? risk.text : "text-gray-700"}`}>
                        {scenario.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {scenario.description}
                      </p>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {scenario.expectedFlags.map((flag) => (
                          <span
                            key={flag}
                            className="inline-block text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded"
                          >
                            {flag}
                          </span>
                        ))}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${risk.iconColor}`} />
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Lead form */}
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
            <Send className="h-4 w-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Lead Form</h2>
          </div>
          <div className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                  <Input
                    id="fullName" value={formData.fullName} placeholder="John Smith"
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-xs">Phone <span className="text-red-500">*</span></Label>
                  <Input
                    id="phoneNumber" type="tel" value={formData.phoneNumber} placeholder="+447700900123"
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="propertyAddress" className="text-xs">Property Address <span className="text-red-500">*</span></Label>
                <Textarea
                  id="propertyAddress" value={formData.propertyAddress} rows={2} placeholder="123 High Street, London"
                  onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="propertyPostcode" className="text-xs">Postcode</Label>
                  <Input
                    id="propertyPostcode" value={formData.propertyPostcode} placeholder="SW1A 1AA"
                    onChange={(e) => setFormData({ ...formData, propertyPostcode: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs">Email</Label>
                  <Input
                    id="email" type="email" value={formData.email} placeholder="john@example.com"
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Urgency</Label>
                  <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                      <SelectItem value="soon">Soon (1 month)</SelectItem>
                      <SelectItem value="flexible">Flexible (3+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason</Label>
                  <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relocation">Relocation</SelectItem>
                      <SelectItem value="financial">Financial</SelectItem>
                      <SelectItem value="inherited">Inherited</SelectItem>
                      <SelectItem value="downsizing">Downsizing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-3.5 flex gap-2">
                <Button type="button" variant="outline" onClick={handleRandom} className="flex-1">
                  <Shuffle className="h-4 w-4 mr-2" />
                  Random
                </Button>
                <Button
                  type="submit" disabled={isSubmitting}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Submit Lead</>
                  )}
                </Button>
              </div>

              {/* Inline result */}
              {submitResult && (
                <div className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                  submitResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}>
                  {submitResult.success
                    ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${submitResult.success ? "text-green-900" : "text-red-900"}`}>
                      {submitResult.message}
                    </p>
                    {submitResult.success && submitResult.leadId && (
                      <button
                        type="button"
                        onClick={() => router.push(submitResult.leadUrl!)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium"
                      >
                        View in pipeline <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Recent test runs */}
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Recent Test Runs</h2>
          </div>
          <span className="text-xs text-gray-400">{runs.length} run{runs.length !== 1 ? "s" : ""}</span>
        </div>

        {runs.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <FlaskConical className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">No test leads yet — submit one above to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50">
                  <th className="text-left px-5 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">Name</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">Address</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">Pipeline Stage</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">Portal Check</th>
                  <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 whitespace-nowrap">Created</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {runs.map((run) => {
                  const stage = STAGE_LABELS[run.pipelineStage] ?? { label: run.pipelineStage, colour: "bg-gray-100 text-gray-500" }
                  return (
                    <tr key={run.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3 font-medium text-gray-900 whitespace-nowrap">{run.vendorName}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate">{run.propertyAddress}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${stage.colour}`}>
                          {stage.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {portalBadge(run.latestCheckRisk)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-gray-400 text-xs">
                        {new Date(run.createdAt).toLocaleString("en-GB", {
                          day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <button
                          onClick={() => router.push(`/dashboard/vendors/${run.id}`)}
                          className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1"
                        >
                          View <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
