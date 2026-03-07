"use client"
import { toast } from "sonner"

import { useState, useEffect } from "react"
import Link from "next/link"
import { PageHeader } from "@/components/ui/page-header"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import {
  Settings,
  DollarSign,
  Eye,
  TrendingUp,
  Terminal,
  Play,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle,
  XCircle,
  Send,
  Shuffle,
  Facebook,
  FileText,
  Building2,
  Search,
  Calculator,
  Mail,
  AlertTriangle,
  FlaskConical,
} from "lucide-react"
import { MOCK_SCENARIOS, MOCK_SCENARIO_IDS } from "@/lib/vendor-checks/test-mode/mock-scenarios"
import type { MockScenarioId } from "@/lib/vendor-checks/test-mode/mock-scenarios"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Currency = "GBP" | "USD" | "EUR" | "AUD" | "CAD"

interface SettingsState {
  currency: Currency
  showRentalYield: boolean
  showDistanceInMiles: boolean
  showPropertyAge: boolean
  showBMVHighlight: boolean
  showConfidenceScores: boolean
}

const currencies = [
  { value: "GBP", label: "British Pound (£)", symbol: "£" },
  { value: "USD", label: "US Dollar ($)", symbol: "$" },
  { value: "EUR", label: "Euro (€)", symbol: "€" },
  { value: "AUD", label: "Australian Dollar (A$)", symbol: "A$" },
  { value: "CAD", label: "Canadian Dollar (C$)", symbol: "C$" },
]

const STORAGE_KEY = "dealstack_settings"

export default function SettingsPage() {
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsState>({
    currency: "GBP",
    showRentalYield: true,
    showDistanceInMiles: true,
    showPropertyAge: true,
    showBMVHighlight: true,
    showConfidenceScores: true,
  })

  // Email settings state
  const [emailStatus, setEmailStatus] = useState<{
    configured: boolean
    host: string | null
    port: string | null
    user: string | null
    fromName: string | null
    connected: boolean
    error: string | null
  } | null>(null)
  const [emailStatusLoading, setEmailStatusLoading] = useState(false)
  const [testEmailTo, setTestEmailTo] = useState("")
  const [sendingTestEmail, setSendingTestEmail] = useState(false)
  const [testEmailResult, setTestEmailResult] = useState<{ success: boolean; error?: string } | null>(null)

  const checkEmailStatus = async () => {
    setEmailStatusLoading(true)
    try {
      const res = await fetch("/api/settings/email-test")
      if (res.ok) setEmailStatus(await res.json())
    } catch {
      // ignore
    } finally {
      setEmailStatusLoading(false)
    }
  }

  const sendTestEmail = async () => {
    if (!testEmailTo) {
      toast.error("Enter an email address")
      return
    }
    setSendingTestEmail(true)
    setTestEmailResult(null)
    try {
      const res = await fetch("/api/settings/email-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo }),
      })
      const data = await res.json()
      setTestEmailResult(data)
      if (data.success) {
        toast.success("Test email sent!", { description: `Delivered to ${testEmailTo}` })
      } else {
        toast.error("Failed to send", { description: data.error })
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message })
    } finally {
      setSendingTestEmail(false)
    }
  }

  // Development mode state
  const [isTestRunning, setIsTestRunning] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [testForm, setTestForm] = useState({
    vendorName: "Test Vendor",
    vendorPhone: "+447700900123",
    vendorEmail: "test@example.com",
    propertyAddress: "123 High Street, London",
    propertyPostcode: "SW1A 1AA",
    askingPrice: "250000",
    propertyType: "terraced",
    bedrooms: "3",
    conversationMessages:
      "Hi, yes I'm interested. Need to sell quickly, moving for work.\nThe property is in good condition, just needs some modernisation.\nWe need to move in about 3 weeks if possible. No chain on our side.",
  })

  // Facebook Lead Ad simulator state
  const [isFBSubmitting, setIsFBSubmitting] = useState(false)
  const [fbResult, setFBResult] = useState<any>(null)
  const [fbTestScenario, setFBTestScenario] = useState<MockScenarioId>("CLEAR_NEVER_LISTED")
  const [fbForm, setFBForm] = useState({
    fullName: "John Smith",
    phoneNumber: "+447700900456",
    email: "john.smith@example.com",
    propertyAddress: "45 Park Lane, Manchester",
    propertyPostcode: "M1 2AB",
    urgency: "urgent",
    sellingReason: "relocation",
  })

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings))
      } catch (error) {
        console.error("Failed to parse settings:", error)
      }
    }
  }, [])

  const updateSettings = (newSettings: Partial<SettingsState>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    toast.success("Settings saved", { description: "Your preferences have been updated successfully." })
  }

  const runAITest = async () => {
    setIsTestRunning(true)
    setTestResult(null)
    try {
      const messages = testForm.conversationMessages.split("\n").filter((m) => m.trim())
      const response = await fetch("/api/dev/test-ai-conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorName: testForm.vendorName,
          vendorPhone: testForm.vendorPhone,
          vendorEmail: testForm.vendorEmail,
          propertyAddress: testForm.propertyAddress,
          propertyPostcode: testForm.propertyPostcode,
          askingPrice: parseInt(testForm.askingPrice),
          propertyType: testForm.propertyType,
          bedrooms: parseInt(testForm.bedrooms),
          conversationMessages: messages,
        }),
      })
      const data = await response.json()
      if (data.success) {
        setTestResult(data)
        toast.success("Test completed successfully!", {
          description: `Created lead with ${data.messageCount} messages. Click "View Lead" to see results.`,
        })
      } else {
        throw new Error(data.error || "Test failed")
      }
    } catch (error: any) {
      toast.error("Test failed", { description: error.message })
      setTestResult({ success: false, error: error.message })
    } finally {
      setIsTestRunning(false)
    }
  }

  const clearTestData = async () => {
    if (!confirm("Are you sure you want to delete all test vendor leads and associated data?")) return
    setIsClearing(true)
    try {
      const response = await fetch("/api/dev/clear-test-data", { method: "DELETE" })
      const data = await response.json()
      if (data.success) {
        toast.success("Test data cleared", {
          description: `Deleted ${data.deletedCount.leads} test leads, ${data.deletedCount.messages} messages, and ${data.deletedCount.comparables} comparables.`,
        })
      } else {
        throw new Error(data.error || "Failed to clear data")
      }
    } catch (error: any) {
      toast.error("Failed to clear test data", { description: error.message })
    } finally {
      setIsClearing(false)
    }
  }

  const generateRandomFBLead = () => {
    const names = ["James Smith","Sarah Johnson","Michael Brown","Emma Wilson","David Taylor","Olivia Davies","Robert Evans","Sophie Thomas","William Roberts","Emily Williams","John Anderson","Lucy Martin"]
    const streets = ["High Street","Park Road","Church Lane","Station Road","Victoria Street","Manor Road","Mill Lane","Green Lane","Main Street","Oak Avenue","Elm Road","Cedar Close"]
    const areas = ["London","Manchester","Birmingham","Leeds","Bristol","Liverpool","Sheffield","Newcastle"]
    const postcodes = ["SW1A 1AA","M1 1AA","B1 1AA","LS1 1AA","BS1 1AA","L1 1AA","S1 1AA","NE1 1AA","SW1W 0NY","W1A 1AA","EC1A 1BB","WC2N 5DU"]
    const urgencies = ["urgent","soon","flexible"]
    const reasons = ["relocation","financial","inherited","downsizing","other"]
    const n = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)]
    const randomName = n(names)
    setFBForm({
      fullName: randomName,
      phoneNumber: `+447${Math.floor(Math.random() * 900000000) + 100000000}`,
      email: randomName.toLowerCase().replace(" ", ".") + "@example.com",
      propertyAddress: `${Math.floor(Math.random() * 200) + 1} ${n(streets)}, ${n(areas)}`,
      propertyPostcode: n(postcodes),
      urgency: n(urgencies),
      sellingReason: n(reasons),
    })
    toast.success("Random lead generated", { description: "Form filled with random test data" })
  }

  const submitFacebookLead = async () => {
    setIsFBSubmitting(true)
    setFBResult(null)
    try {
      if (!fbForm.fullName || !fbForm.phoneNumber || !fbForm.propertyAddress) {
        throw new Error("Please fill in all required fields")
      }
      const response = await fetch("/api/facebook-leads/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadgen_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_time: new Date().toISOString(),
          isTest: true,
          testScenario: fbTestScenario,
          field_data: [
            { name: "full_name", values: [fbForm.fullName] },
            { name: "phone_number", values: [fbForm.phoneNumber] },
            { name: "property_address", values: [fbForm.propertyAddress] },
            { name: "property_postcode", values: [fbForm.propertyPostcode] },
            { name: "email", values: [fbForm.email] },
            { name: "urgency", values: [fbForm.urgency] },
            { name: "selling_reason", values: [fbForm.sellingReason] },
          ],
        }),
      })
      const data = await response.json()
      if (data.success) {
        setFBResult(data)
        toast.success("Lead submitted successfully!", { description: "Facebook lead has been added to the vendor pipeline." })
      } else {
        throw new Error(data.message || "Failed to submit lead")
      }
    } catch (error: any) {
      toast.error("Submission failed", { description: error.message })
      setFBResult({ success: false, error: error.message })
    } finally {
      setIsFBSubmitting(false)
    }
  }

  const selectedCurrency = currencies.find((c) => c.value === settings.currency)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Manage your application preferences and display settings"
      />

      {/* ── Navigation Cards ── */}

      {/* Company Profile */}
      <div className="ds-card p-5 flex items-center gap-4">
        <div className="shrink-0 p-2 rounded-lg bg-purple-50">
          <Building2 className="h-5 w-5 text-purple-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Company Profile</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage your company information, branding, logo, and social media profiles
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Used globally across the platform including dashboard header, investor packs, and email templates
          </p>
        </div>
        <Link href="/dashboard/settings/company-profile" className="shrink-0">
          <Button className="btn-primary h-9">
            <Building2 className="h-4 w-4 mr-2" />
            Manage Profile
          </Button>
        </Link>
      </div>

      {/* Investor Pack Templates */}
      <div className="ds-card p-5 flex items-center gap-4">
        <div className="shrink-0 p-2 rounded-lg bg-blue-50">
          <FileText className="h-5 w-5 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Investor Pack Templates</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Manage customizable templates for generating professional investor pack PDFs
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Create and customize templates with different sections, colors, and company branding
          </p>
        </div>
        <Link href="/dashboard/settings/investor-packs" className="shrink-0">
          <Button className="btn-primary h-9">
            <FileText className="h-4 w-4 mr-2" />
            Manage Templates
          </Button>
        </Link>
      </div>

      {/* Scraper Settings */}
      <div className="ds-card p-5 flex items-center gap-4">
        <div className="shrink-0 p-2 rounded-lg bg-green-50">
          <Search className="h-5 w-5 text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Scraper Settings</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure property scraping sources, schedules, and review behavior
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Controls how properties are scraped from Rightmove, Zoopla, and OnTheMarket
          </p>
        </div>
        <Link href="/dashboard/settings/scraper" className="shrink-0">
          <Button className="btn-primary h-9">
            <Search className="h-4 w-4 mr-2" />
            Manage Scraper
          </Button>
        </Link>
      </div>

      {/* Land Registry */}
      <div className="ds-card p-5 flex items-center gap-4">
        <div className="shrink-0 p-2 rounded-lg bg-indigo-50">
          <Building2 className="h-5 w-5 text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">HM Land Registry</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Import CCOD/OCOD ownership datasets to boost BMV scores with corporate and overseas ownership intelligence
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Corporate owner: +10 pts · Overseas owner: +7 pts · Portfolio owner: +5 pts
          </p>
        </div>
        <Link href="/dashboard/settings/land-registry" className="shrink-0">
          <Button className="btn-primary h-9">
            <Building2 className="h-4 w-4 mr-2" />
            Manage
          </Button>
        </Link>
      </div>

      {/* Underwriting Engine */}
      <div className="ds-card p-5 flex items-center gap-4">
        <div className="shrink-0 p-2 rounded-lg bg-emerald-50">
          <Calculator className="h-5 w-5 text-emerald-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">Underwriting Engine (BMV & Capital Allocator)</p>
          <p className="text-xs text-gray-400 mt-0.5">
            BMV screening and capital allocation: configure offer formulae and validation thresholds
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Screening plus strategy-specific pricing (Flip, BRR, BuyHold, BTL) and test workflow
          </p>
        </div>
        <Link href="/dashboard/settings/offer-calculator" className="shrink-0">
          <Button className="btn-primary h-9">
            <Calculator className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </Link>
      </div>

      {/* ── Email / SMTP ── */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center gap-2">
          <Mail className="h-4 w-4 text-sky-600" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Email Settings (SMTP)</h2>
            <p className="text-xs text-gray-400">Configure Hostinger SMTP for sending investor packs and communications</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {/* Connection status */}
          {emailStatus ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 text-sm font-medium ${emailStatus.connected ? "text-green-700" : "text-red-600"}`}>
                {emailStatus.connected
                  ? <><CheckCircle className="h-4 w-4" /> Connected to {emailStatus.host}</>
                  : <><XCircle className="h-4 w-4" /> {emailStatus.error || "Connection failed"}</>}
              </div>
              {emailStatus.configured && (
                <div className="bg-gray-50 rounded-md p-3 text-xs space-y-1 font-mono border border-[var(--ds-border)]">
                  <div><span className="text-gray-400">Host:</span> {emailStatus.host}:{emailStatus.port}</div>
                  <div><span className="text-gray-400">User:</span> {emailStatus.user}</div>
                  {emailStatus.fromName && <div><span className="text-gray-400">From:</span> {emailStatus.fromName}</div>}
                </div>
              )}
              {!emailStatus.configured && (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">SMTP not configured</p>
                    <p className="text-xs mt-1">
                      Add <code>SMTP_HOST</code>, <code>SMTP_USER</code>, and <code>SMTP_PASSWORD</code> to your <code>.env</code> file.
                    </p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Click &quot;Check Connection&quot; to verify your SMTP settings.</p>
          )}

          <Button variant="outline" size="sm" onClick={checkEmailStatus} disabled={emailStatusLoading}>
            {emailStatusLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
            Check Connection
          </Button>

          {/* Send test email */}
          {emailStatus?.configured && (
            <div className="space-y-2 pt-3 border-t border-[var(--ds-border)]">
              <p className="text-sm font-medium text-gray-900">Send Test Email</p>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={testEmailTo}
                  onChange={(e) => setTestEmailTo(e.target.value)}
                  className="max-w-xs"
                />
                <Button size="sm" onClick={sendTestEmail} disabled={sendingTestEmail}>
                  {sendingTestEmail ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                  Send Test
                </Button>
              </div>
              {testEmailResult && (
                <p className={`text-xs font-medium ${testEmailResult.success ? "text-green-700" : "text-red-600"}`}>
                  {testEmailResult.success ? "✓ Test email delivered successfully" : `✗ ${testEmailResult.error}`}
                </p>
              )}
            </div>
          )}

          {/* Hostinger setup instructions */}
          <div className="bg-sky-50 border border-sky-200 rounded-md p-4 text-sm space-y-2">
            <p className="font-semibold text-sky-900">Hostinger Setup Instructions</p>
            <ol className="list-decimal list-inside space-y-1.5 text-sky-800 text-xs">
              <li>Log into <strong>hPanel</strong> → <strong>Emails</strong> → <strong>Email Accounts</strong></li>
              <li>Create an email address e.g. <code>deals@yourdomain.com</code></li>
              <li>Set a strong password for it</li>
              <li>In your <code>.env</code> file set these values:</li>
            </ol>
            <pre className="bg-sky-100 rounded p-2 text-xs font-mono text-sky-900 mt-2 overflow-x-auto">{`SMTP_HOST="smtp.hostinger.com"
SMTP_PORT=465
SMTP_USER="deals@yourdomain.com"
SMTP_PASSWORD="your-email-password"
SMTP_FROM_NAME="Your Company Name"`}</pre>
            <p className="text-xs text-sky-700">
              After editing <code>.env</code>, restart the dev server and click <strong>Check Connection</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* ── Currency & Regional ── */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Currency & Regional Settings</h2>
            <p className="text-xs text-gray-400">Choose your preferred currency for displaying prices and financial metrics</p>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <Label htmlFor="currency" className="text-sm font-medium text-gray-700">Currency</Label>
          <Select
            value={settings.currency}
            onValueChange={(value: Currency) => updateSettings({ currency: value })}
          >
            <SelectTrigger id="currency" className="w-full md:w-[300px]">
              <SelectValue placeholder="Select currency" />
            </SelectTrigger>
            <SelectContent>
              {currencies.map((currency) => (
                <SelectItem key={currency.value} value={currency.value}>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{currency.symbol}</span>
                    <span>{currency.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-gray-400">
            Current selection: <strong className="text-gray-700">{selectedCurrency?.label}</strong> ({selectedCurrency?.symbol})
          </p>
        </div>
      </div>

      {/* ── Display Metrics ── */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center gap-2">
          <Eye className="h-4 w-4 text-gray-500" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Display Metrics</h2>
            <p className="text-xs text-gray-400">Control which metrics and information are displayed throughout the application</p>
          </div>
        </div>
        <div className="p-5 divide-y divide-[var(--ds-border)]">
          <div className="flex items-center justify-between py-4 first:pt-0">
            <div>
              <Label htmlFor="rental-yield" className="text-sm font-medium text-gray-900">Show Rental Yield</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Display estimated rental yield percentages on property cards and comparables
              </p>
            </div>
            <Switch
              id="rental-yield"
              checked={settings.showRentalYield}
              onCheckedChange={(checked) => updateSettings({ showRentalYield: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <Label htmlFor="distance-miles" className="text-sm font-medium text-gray-900">Show Distance in Miles</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Display distance from target property for comparables
              </p>
            </div>
            <Switch
              id="distance-miles"
              checked={settings.showDistanceInMiles}
              onCheckedChange={(checked) => updateSettings({ showDistanceInMiles: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <Label htmlFor="property-age" className="text-sm font-medium text-gray-900">Show Property Age</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Display estimated property age based on construction year
              </p>
            </div>
            <Switch
              id="property-age"
              checked={settings.showPropertyAge}
              onCheckedChange={(checked) => updateSettings({ showPropertyAge: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-4">
            <div>
              <Label htmlFor="bmv-highlight" className="text-sm font-medium text-gray-900">Highlight BMV Reference Properties</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Highlight properties used for Below Market Value calculations with special badges
              </p>
            </div>
            <Switch
              id="bmv-highlight"
              checked={settings.showBMVHighlight}
              onCheckedChange={(checked) => updateSettings({ showBMVHighlight: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-4 last:pb-0">
            <div>
              <Label htmlFor="confidence-scores" className="text-sm font-medium text-gray-900">Show Confidence Scores</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Display confidence level badges on comparable properties (HIGH, MEDIUM, LOW)
              </p>
            </div>
            <Switch
              id="confidence-scores"
              checked={settings.showConfidenceScores}
              onCheckedChange={(checked) => updateSettings({ showConfidenceScores: checked })}
            />
          </div>
        </div>
      </div>

      {/* ── Analytics (Coming Soon) ── */}
      <div className="ds-card overflow-hidden opacity-60">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-400" />
          <div>
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              Analytics & Reporting
              <span className="text-xs font-normal text-gray-400">(Coming Soon)</span>
            </h2>
            <p className="text-xs text-gray-400">Configure data analysis and reporting preferences</p>
          </div>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between opacity-50">
            <div>
              <Label className="text-sm font-medium text-gray-900">Enable Advanced Analytics</Label>
              <p className="text-xs text-gray-400 mt-0.5">
                Access detailed market trends, price predictions, and investment scoring
              </p>
            </div>
            <Switch disabled />
          </div>
        </div>
      </div>

      {/* ── Development Tools ── */}
      <div className="ds-card overflow-hidden">
        <div className="px-5 py-4 border-b border-[var(--ds-border)] flex items-center gap-2">
          <Terminal className="h-4 w-4 text-orange-600" />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Development Tools</h2>
            <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full font-medium">
              Testing & Debug
            </span>
          </div>
        </div>
        <div className="p-5">
          <Tabs defaultValue="ai-test" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai-test" className="flex items-center gap-2">
                <Play className="h-4 w-4" />
                AI Test
              </TabsTrigger>
              <TabsTrigger value="fb-simulator" className="flex items-center gap-2">
                <Facebook className="h-4 w-4" />
                FB Leads
              </TabsTrigger>
              <TabsTrigger value="utilities" className="flex items-center gap-2">
                <Trash2 className="h-4 w-4" />
                Utilities
              </TabsTrigger>
            </TabsList>

            {/* AI Conversation Test */}
            <TabsContent value="ai-test" className="space-y-4 mt-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Test AI Conversation</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Simulate a vendor conversation with custom data. The AI will process messages and move the lead through the pipeline.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="vendorName" className="text-xs text-gray-500">Vendor Name</Label>
                  <Input id="vendorName" value={testForm.vendorName} onChange={(e) => setTestForm({ ...testForm, vendorName: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vendorPhone" className="text-xs text-gray-500">Phone</Label>
                  <Input id="vendorPhone" value={testForm.vendorPhone} onChange={(e) => setTestForm({ ...testForm, vendorPhone: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vendorEmail" className="text-xs text-gray-500">Email</Label>
                  <Input id="vendorEmail" value={testForm.vendorEmail} onChange={(e) => setTestForm({ ...testForm, vendorEmail: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propertyType" className="text-xs text-gray-500">Property Type</Label>
                  <Select value={testForm.propertyType} onValueChange={(v) => setTestForm({ ...testForm, propertyType: v })}>
                    <SelectTrigger id="propertyType" className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terraced">Terraced</SelectItem>
                      <SelectItem value="semi-detached">Semi-Detached</SelectItem>
                      <SelectItem value="detached">Detached</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="maisonette">Maisonette</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propertyAddress" className="text-xs text-gray-500">Property Address</Label>
                  <Input id="propertyAddress" value={testForm.propertyAddress} onChange={(e) => setTestForm({ ...testForm, propertyAddress: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="propertyPostcode" className="text-xs text-gray-500">Postcode</Label>
                  <Input id="propertyPostcode" value={testForm.propertyPostcode} onChange={(e) => setTestForm({ ...testForm, propertyPostcode: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="askingPrice" className="text-xs text-gray-500">Asking Price</Label>
                  <Input id="askingPrice" type="number" value={testForm.askingPrice} onChange={(e) => setTestForm({ ...testForm, askingPrice: e.target.value })} className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bedrooms" className="text-xs text-gray-500">Bedrooms</Label>
                  <Input id="bedrooms" type="number" value={testForm.bedrooms} onChange={(e) => setTestForm({ ...testForm, bedrooms: e.target.value })} className="text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="conversationMessages" className="text-xs text-gray-500">Vendor Messages (one per line)</Label>
                <Textarea
                  id="conversationMessages"
                  value={testForm.conversationMessages}
                  onChange={(e) => setTestForm({ ...testForm, conversationMessages: e.target.value })}
                  rows={5}
                  className="text-sm font-mono"
                  placeholder="Enter vendor messages, one per line..."
                />
                <p className="text-xs text-gray-400">Each line will be sent as a separate message from the vendor.</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={runAITest} disabled={isTestRunning} className="btn-primary h-9">
                  {isTestRunning ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Running Test...</> : <><Play className="h-4 w-4 mr-2" />Run AI Test</>}
                </Button>
                {testResult?.success && (
                  <Button variant="outline" onClick={() => router.push(testResult.leadUrl)} className="h-9">
                    <ExternalLink className="h-4 w-4 mr-2" />View Lead
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border ${testResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-start gap-2">
                    {testResult.success
                      ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      : <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
                    <div className="flex-1 text-sm">
                      {testResult.success ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-green-900">Test completed successfully!</p>
                          <div className="text-xs text-green-800 space-y-0.5">
                            <p>Lead ID: {testResult.leadId}</p>
                            <p>Final Stage: {testResult.finalStage}</p>
                            <p>Messages: {testResult.messageCount}</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-red-900">Test failed</p>
                          <p className="text-xs text-red-700 mt-1">{testResult.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Facebook Lead Ad Simulator */}
            <TabsContent value="fb-simulator" className="space-y-4 mt-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                  <Facebook className="h-4 w-4 text-blue-600" />
                  Facebook Lead Ad Simulator
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Test the Facebook Lead Ad integration by simulating lead submissions. Leads are sent directly to the vendor pipeline with AI conversation enabled.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fbFullName" className="text-xs text-gray-500">Full Name <span className="text-red-500">*</span></Label>
                  <Input id="fbFullName" value={fbForm.fullName} onChange={(e) => setFBForm({ ...fbForm, fullName: e.target.value })} placeholder="John Smith" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fbPhoneNumber" className="text-xs text-gray-500">Phone Number <span className="text-red-500">*</span></Label>
                  <Input id="fbPhoneNumber" value={fbForm.phoneNumber} onChange={(e) => setFBForm({ ...fbForm, phoneNumber: e.target.value })} placeholder="+447700900123" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fbEmail" className="text-xs text-gray-500">Email</Label>
                  <Input id="fbEmail" type="email" value={fbForm.email} onChange={(e) => setFBForm({ ...fbForm, email: e.target.value })} placeholder="john@example.com" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fbPostcode" className="text-xs text-gray-500">Postcode</Label>
                  <Input id="fbPostcode" value={fbForm.propertyPostcode} onChange={(e) => setFBForm({ ...fbForm, propertyPostcode: e.target.value })} placeholder="SW1A 1AA" className="text-sm" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="fbAddress" className="text-xs text-gray-500">Property Address <span className="text-red-500">*</span></Label>
                  <Input id="fbAddress" value={fbForm.propertyAddress} onChange={(e) => setFBForm({ ...fbForm, propertyAddress: e.target.value })} placeholder="123 High Street, London" className="text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fbUrgency" className="text-xs text-gray-500">Urgency</Label>
                  <Select value={fbForm.urgency} onValueChange={(v) => setFBForm({ ...fbForm, urgency: v })}>
                    <SelectTrigger id="fbUrgency" className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                      <SelectItem value="soon">Soon (1 month)</SelectItem>
                      <SelectItem value="flexible">Flexible (3+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fbReason" className="text-xs text-gray-500">Selling Reason</Label>
                  <Select value={fbForm.sellingReason} onValueChange={(v) => setFBForm({ ...fbForm, sellingReason: v })}>
                    <SelectTrigger id="fbReason" className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="relocation">Relocation</SelectItem>
                      <SelectItem value="financial">Financial reasons</SelectItem>
                      <SelectItem value="inherited">Inherited property</SelectItem>
                      <SelectItem value="downsizing">Downsizing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="fbTestScenario" className="text-xs text-gray-500 flex items-center gap-1">
                    <FlaskConical className="h-3 w-3 text-purple-500" />
                    Portal Check Test Scenario
                  </Label>
                  <Select value={fbTestScenario} onValueChange={(v) => setFBTestScenario(v as MockScenarioId)}>
                    <SelectTrigger id="fbTestScenario" className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MOCK_SCENARIO_IDS.map((id) => (
                        <SelectItem key={id} value={id}>{MOCK_SCENARIOS[id].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-400">{MOCK_SCENARIOS[fbTestScenario].description}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={generateRandomFBLead} variant="outline" className="h-9">
                  <Shuffle className="h-4 w-4 mr-2" />Random Lead
                </Button>
                <Button onClick={submitFacebookLead} disabled={isFBSubmitting} className="btn-primary h-9">
                  {isFBSubmitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</> : <><Send className="h-4 w-4 mr-2" />Submit Lead</>}
                </Button>
                {fbResult?.success && (
                  <Button variant="outline" onClick={() => router.push(fbResult.leadUrl || `/dashboard/vendors/pipeline?leadId=${fbResult.leadId}`)} className="h-9">
                    <ExternalLink className="h-4 w-4 mr-2" />View Lead
                  </Button>
                )}
              </div>

              {fbResult && (
                <div className={`p-4 rounded-lg border ${fbResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
                  <div className="flex items-start gap-2">
                    {fbResult.success
                      ? <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                      : <XCircle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />}
                    <div className="flex-1 text-sm">
                      {fbResult.success ? (
                        <div className="space-y-1">
                          <p className="font-semibold text-green-900">Lead submitted successfully!</p>
                          <div className="text-xs text-green-800 space-y-0.5">
                            <p>Lead ID: {fbResult.leadId}</p>
                            <p>Stage: {fbResult.pipelineStage}</p>
                            <p className="opacity-75">AI conversation triggered automatically</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-red-900">Submission failed</p>
                          <p className="text-xs text-red-700 mt-1">{fbResult.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Utilities */}
            <TabsContent value="utilities" className="space-y-6 mt-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Clear Test Data</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Remove all test vendor leads and associated messages/comparables. Only affects leads with test phone numbers, test emails, or &quot;Test&quot; in the name.
                </p>
                <Button onClick={clearTestData} disabled={isClearing} variant="destructive" className="h-9">
                  {isClearing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Clearing...</> : <><Trash2 className="h-4 w-4 mr-2" />Clear Test Data</>}
                </Button>
              </div>

              <div className="pt-4 border-t border-[var(--ds-border)]">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Links</h3>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/vendors/pipeline")} className="text-xs h-8">
                    Vendor Pipeline
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => router.push("/admin/facebook-ad-simulator")} className="text-xs h-8">
                    FB Simulator (Standalone)
                  </Button>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* ── Info note ── */}
      <div className="ds-card p-4 bg-blue-50 border-blue-200">
        <p className="text-sm text-blue-900">
          <strong>Note:</strong> All settings are stored locally in your browser.
          They will not sync across devices unless you are using a browser sync feature.
          Some settings may require a page refresh to take full effect.
        </p>
      </div>
    </div>
  )
}
