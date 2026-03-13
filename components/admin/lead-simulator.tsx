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
import { toast } from "sonner"
import {
  Facebook,
  Home,
  Send,
  Shuffle,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  Clock,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  ArrowRight,
} from "lucide-react"

// ── Types ──────────────────────────────────────────────────────────────────

interface TestRun {
  id: string
  vendorName: string
  propertyAddress: string
  pipelineStage: string
  latestCheckRisk: string | null
  createdAt: string
}

interface Props {
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
  propertyType: string
  askingPrice: string
  bedrooms: string
  garden: string
  garage: string
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
  propertyTypes: ["detached", "semi-detached", "terraced", "flat", "bungalow"] as const,
  bedrooms: ["1", "2", "3", "4", "5"] as const,
  yesNo: ["yes", "no"] as const,
  // Realistic asking prices by property type (approximate UK regional ranges)
  askingPrices: [85000, 95000, 110000, 125000, 140000, 165000, 185000, 210000, 240000, 275000] as const,
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateRandomLead(): LeadFormData {
  const name = pick(RANDOM_DATA.names)
  const houseNo = Math.floor(Math.random() * 200) + 1
  const propType = pick(RANDOM_DATA.propertyTypes)
  // Flats/terraced tend to be cheaper; detached more expensive
  const priceIndex = propType === "detached"
    ? Math.floor(Math.random() * 3) + 7
    : propType === "flat"
    ? Math.floor(Math.random() * 3)
    : Math.floor(Math.random() * 5) + 2
  return {
    fullName: name,
    phoneNumber: `+447${Math.floor(Math.random() * 900000000) + 100000000}`,
    propertyAddress: `${houseNo} ${pick(RANDOM_DATA.streets)}, ${pick(RANDOM_DATA.areas)}`,
    propertyPostcode: pick(RANDOM_DATA.postcodes),
    email: name.toLowerCase().replace(" ", ".") + "@example.com",
    urgency: pick(RANDOM_DATA.urgencies),
    reason: pick(RANDOM_DATA.reasons),
    propertyType: propType,
    askingPrice: String(RANDOM_DATA.askingPrices[priceIndex]),
    bedrooms: pick(RANDOM_DATA.bedrooms),
    garden: propType === "flat" ? "no" : pick(RANDOM_DATA.yesNo),
    garage: pick(RANDOM_DATA.yesNo),
  }
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

function PortalBadge({ risk }: { risk: string | null }) {
  if (!risk) return <span className="text-xs text-gray-400">Pending</span>
  if (risk === "red_flag")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600"><ShieldX className="w-3 h-3" />Red Flag</span>
  if (risk === "caution")
    return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600"><ShieldAlert className="w-3 h-3" />Caution</span>
  return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600"><ShieldCheck className="w-3 h-3" />Clear</span>
}

// ── Main component ───────────────────────────────────────────────────────────

export default function LeadSimulator({ recentTestRuns }: Props) {
  const router = useRouter()

  const [formData, setFormData] = useState<LeadFormData>({
    fullName: "", phoneNumber: "", propertyAddress: "",
    propertyPostcode: "", email: "", urgency: "", reason: "",
    propertyType: "", askingPrice: "", bedrooms: "", garden: "", garage: "",
  })
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
          field_data: [
            { name: "full_name",          values: [formData.fullName] },
            { name: "phone_number",       values: [formData.phoneNumber] },
            { name: "property_address",   values: [formData.propertyAddress] },
            { name: "property_postcode",  values: [formData.propertyPostcode] },
            { name: "email",              values: [formData.email] },
            { name: "urgency",            values: [formData.urgency] },
            { name: "selling_reason",     values: [formData.reason] },
            { name: "property_type",      values: [formData.propertyType] },
            { name: "asking_price",       values: [formData.askingPrice] },
            { name: "bedrooms",           values: [formData.bedrooms] },
            { name: "garden",             values: [formData.garden] },
            { name: "garage",             values: [formData.garage] },
          ],
        }),
      })

      const result = await res.json()

      if (result.success) {
        setRuns((prev) => [
          {
            id: result.leadId,
            vendorName: formData.fullName,
            propertyAddress: formData.propertyAddress,
            pipelineStage: "NEW_LEAD",
            latestCheckRisk: null,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 10))
        setSubmitResult({
          success: true,
          message: "Lead successfully submitted to pipeline!",
          leadId: result.leadId,
          leadUrl: result.leadUrl || `/dashboard/vendors?leadId=${result.leadId}`,
        })
        toast.success("Success!", {
          description: "Lead created and added to vendor pipeline. AI conversation will start automatically.",
        })
        setFormData({ fullName: "", phoneNumber: "", propertyAddress: "", propertyPostcode: "", email: "", urgency: "", reason: "", propertyType: "", askingPrice: "", bedrooms: "", garden: "", garage: "" })
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
            <Facebook className="h-6 w-6 text-blue-600" />
            Facebook Lead Ad Simulator
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Test your vendor pipeline by simulating Facebook Lead Ad submissions
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/vendors")}>
          <ExternalLink className="h-4 w-4 mr-2" />
          View Pipeline
        </Button>
      </div>

      {/* Ad preview + Lead form */}
      <div className="grid gap-6 md:grid-cols-2">

        {/* Ad Preview */}
        <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-4">
            <div className="flex items-center gap-2">
              <Facebook className="h-6 w-6" />
              <div>
                <h3 className="text-sm font-semibold text-white">Ad Preview</h3>
                <p className="text-xs text-blue-100 mt-0.5">What vendors see on Facebook</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {/* Mock Ad Creative */}
            <div className="bg-gray-50 border rounded-lg overflow-hidden">
              {/* Mock Image */}
              <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Home className="h-24 w-24 text-white opacity-50" />
              </div>
              {/* Ad Content */}
              <div className="p-4 space-y-3">
                <h3 className="font-bold text-lg">Need To Sell Your Property Quickly?</h3>
                <p className="text-sm text-gray-600">
                  We buy houses in any condition. Get a fair cash offer within 24 hours.
                  No fees, no hassle, no waiting.
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Cash offer within 24 hours</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>No estate agent fees</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>Any property condition</span>
                  </div>
                </div>
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Get Your Free Cash Offer
                </Button>
              </div>
            </div>
            {/* Ad Info */}
            <div className="text-xs text-gray-500 space-y-1">
              <p><strong>Campaign:</strong> Vendor Acquisition - Quick Sale</p>
              <p><strong>Placement:</strong> Facebook Feed, Instagram Feed</p>
              <p><strong>Objective:</strong> Lead Generation</p>
            </div>
          </div>
        </div>

        {/* Lead Form */}
        <div className="rounded-xl border border-blue-200 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-5 py-4">
            <div className="flex items-center gap-2">
              <Send className="h-6 w-6" />
              <div>
                <h3 className="text-sm font-semibold text-white">Lead Form</h3>
                <p className="text-xs text-blue-100 mt-0.5">Submit test leads to pipeline</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName" value={formData.fullName} placeholder="John Smith"
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                />
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  id="phoneNumber" type="tel" value={formData.phoneNumber} placeholder="+447700900123"
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                />
                <p className="text-xs text-gray-400">UK format: +447XXXXXXXXX</p>
              </div>

              {/* Property Address */}
              <div className="space-y-2">
                <Label htmlFor="propertyAddress">Property Address <span className="text-red-500">*</span></Label>
                <Textarea
                  id="propertyAddress" value={formData.propertyAddress} rows={2} placeholder="123 High Street, London"
                  onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                  required
                />
              </div>

              {/* Postcode */}
              <div className="space-y-2">
                <Label htmlFor="propertyPostcode">Property Postcode</Label>
                <Input
                  id="propertyPostcode" value={formData.propertyPostcode} placeholder="SW1A 1AA"
                  onChange={(e) => setFormData({ ...formData, propertyPostcode: e.target.value })}
                />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" type="email" value={formData.email} placeholder="john.smith@example.com"
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>

              {/* Property Type + Asking Price */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Property Type</Label>
                  <Select value={formData.propertyType} onValueChange={(v) => setFormData({ ...formData, propertyType: v })}>
                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="detached">Detached</SelectItem>
                      <SelectItem value="semi-detached">Semi-Detached</SelectItem>
                      <SelectItem value="terraced">Terraced</SelectItem>
                      <SelectItem value="flat">Flat / Apartment</SelectItem>
                      <SelectItem value="bungalow">Bungalow</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="askingPrice">Asking Price (£)</Label>
                  <Input
                    id="askingPrice"
                    type="number"
                    min="0"
                    step="1000"
                    value={formData.askingPrice}
                    placeholder="e.g. 125000"
                    onChange={(e) => setFormData({ ...formData, askingPrice: e.target.value })}
                  />
                </div>
              </div>

              {/* Bedrooms + Garden + Garage */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Bedrooms</Label>
                  <Select value={formData.bedrooms} onValueChange={(v) => setFormData({ ...formData, bedrooms: v })}>
                    <SelectTrigger><SelectValue placeholder="Beds..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                      <SelectItem value="4">4</SelectItem>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="6+">6+</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Garden?</Label>
                  <Select value={formData.garden} onValueChange={(v) => setFormData({ ...formData, garden: v })}>
                    <SelectTrigger><SelectValue placeholder="Yes / No" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Garage?</Label>
                  <Select value={formData.garage} onValueChange={(v) => setFormData({ ...formData, garage: v })}>
                    <SelectTrigger><SelectValue placeholder="Yes / No" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Urgency */}
              <div className="space-y-2">
                <Label>How quickly do you need to sell?</Label>
                <Select value={formData.urgency} onValueChange={(v) => setFormData({ ...formData, urgency: v })}>
                  <SelectTrigger><SelectValue placeholder="Select urgency..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                    <SelectItem value="soon">Soon (1 month)</SelectItem>
                    <SelectItem value="flexible">Flexible (3+ months)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <Label>Why are you selling?</Label>
                <Select value={formData.reason} onValueChange={(v) => setFormData({ ...formData, reason: v })}>
                  <SelectTrigger><SelectValue placeholder="Select reason..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relocation">Relocation</SelectItem>
                    <SelectItem value="financial">Financial reasons</SelectItem>
                    <SelectItem value="inherited">Inherited property</SelectItem>
                    <SelectItem value="downsizing">Downsizing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="border-t border-gray-100" />

              {/* Action buttons */}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleRandom} className="flex-1">
                  <Shuffle className="h-4 w-4 mr-2" />
                  Random Lead
                </Button>
                <Button
                  type="submit" disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                  ) : (
                    <><Send className="h-4 w-4 mr-2" />Submit Lead</>
                  )}
                </Button>
              </div>

              {/* Result */}
              {submitResult && (
                <div className={`rounded-lg border p-3 flex items-start gap-2.5 ${
                  submitResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                }`}>
                  {submitResult.success
                    ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <p className={`text-sm ${submitResult.success ? "text-green-900" : "text-red-900"}`}>
                      {submitResult.message}
                    </p>
                    {submitResult.success && submitResult.leadId && (
                      <button
                        type="button"
                        onClick={() => router.push(submitResult.leadUrl!)}
                        className="mt-1.5 inline-flex items-center gap-1 text-xs text-green-700 hover:text-green-900 font-medium"
                      >
                        View Lead in Pipeline <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>

      {/* Info card */}
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex gap-3">
          <Facebook className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">How this simulator works:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-800">
              <li>Simulates Facebook Lead Ad form submissions</li>
              <li>Sends leads to your vendor pipeline via webhook</li>
              <li>Triggers AI SMS conversation automatically</li>
              <li>Use &quot;Random Lead&quot; for quick testing</li>
              <li>View created leads in the Vendor Pipeline</li>
            </ul>
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
            <Facebook className="w-8 h-8 text-gray-300 mx-auto mb-2" />
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
                        <PortalBadge risk={run.latestCheckRisk} />
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
