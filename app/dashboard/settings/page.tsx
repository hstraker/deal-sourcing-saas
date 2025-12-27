"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Settings, DollarSign, Eye, TrendingUp, Terminal, Play, Trash2, ExternalLink, Loader2, CheckCircle, XCircle, Send, Shuffle, Facebook, FileText, Building2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
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
  const { toast } = useToast()
  const router = useRouter()
  const [settings, setSettings] = useState<SettingsState>({
    currency: "GBP",
    showRentalYield: true,
    showDistanceInMiles: true,
    showPropertyAge: true,
    showBMVHighlight: true,
    showConfidenceScores: true,
  })

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
    conversationMessages: "Hi, yes I'm interested. Need to sell quickly, moving for work.\nThe property is in good condition, just needs some modernisation.\nWe need to move in about 3 weeks if possible. No chain on our side."
  })

  // Facebook Lead Ad simulator state
  const [isFBSubmitting, setIsFBSubmitting] = useState(false)
  const [fbResult, setFBResult] = useState<any>(null)
  const [fbForm, setFBForm] = useState({
    fullName: "John Smith",
    phoneNumber: "+447700900456",
    email: "john.smith@example.com",
    propertyAddress: "45 Park Lane, Manchester",
    propertyPostcode: "M1 2AB",
    urgency: "urgent",
    sellingReason: "relocation"
  })

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem(STORAGE_KEY)
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(parsed)
      } catch (error) {
        console.error("Failed to parse settings:", error)
      }
    }
  }, [])

  // Save settings to localStorage whenever they change
  const updateSettings = (newSettings: Partial<SettingsState>) => {
    const updated = { ...settings, ...newSettings }
    setSettings(updated)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))

    toast({
      title: "Settings saved",
      description: "Your preferences have been updated successfully.",
    })
  }

  // Run AI conversation test
  const runAITest = async () => {
    setIsTestRunning(true)
    setTestResult(null)

    try {
      const messages = testForm.conversationMessages.split("\n").filter(m => m.trim())

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
          conversationMessages: messages
        })
      })

      const data = await response.json()

      if (data.success) {
        setTestResult(data)
        toast({
          title: "Test completed successfully!",
          description: `Created lead with ${data.messageCount} messages. Click "View Lead" to see results.`,
        })
      } else {
        throw new Error(data.error || "Test failed")
      }
    } catch (error: any) {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive"
      })
      setTestResult({ success: false, error: error.message })
    } finally {
      setIsTestRunning(false)
    }
  }

  // Clear test data
  const clearTestData = async () => {
    if (!confirm("Are you sure you want to delete all test vendor leads and associated data?")) {
      return
    }

    setIsClearing(true)

    try {
      const response = await fetch("/api/dev/clear-test-data", {
        method: "DELETE"
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Test data cleared",
          description: `Deleted ${data.deletedCount.leads} test leads, ${data.deletedCount.messages} messages, and ${data.deletedCount.comparables} comparables.`,
        })
      } else {
        throw new Error(data.error || "Failed to clear data")
      }
    } catch (error: any) {
      toast({
        title: "Failed to clear test data",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsClearing(false)
    }
  }

  // Generate random Facebook lead
  const generateRandomFBLead = () => {
    const names = ["James Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson", "David Taylor", "Olivia Davies", "Robert Evans", "Sophie Thomas", "William Roberts", "Emily Williams", "John Anderson", "Lucy Martin"]
    const streets = ["High Street", "Park Road", "Church Lane", "Station Road", "Victoria Street", "Manor Road", "Mill Lane", "Green Lane", "Main Street", "Oak Avenue", "Elm Road", "Cedar Close"]
    const areas = ["London", "Manchester", "Birmingham", "Leeds", "Bristol", "Liverpool", "Sheffield", "Newcastle"]
    const postcodes = ["SW1A 1AA", "M1 1AA", "B1 1AA", "LS1 1AA", "BS1 1AA", "L1 1AA", "S1 1AA", "NE1 1AA", "SW1W 0NY", "W1A 1AA", "EC1A 1BB", "WC2N 5DU"]
    const urgencies = ["urgent", "soon", "flexible"]
    const reasons = ["relocation", "financial", "inherited", "downsizing", "other"]

    const randomName = names[Math.floor(Math.random() * names.length)]
    const randomStreet = streets[Math.floor(Math.random() * streets.length)]
    const randomArea = areas[Math.floor(Math.random() * areas.length)]
    const randomPostcode = postcodes[Math.floor(Math.random() * postcodes.length)]
    const houseNumber = Math.floor(Math.random() * 200) + 1
    const randomUrgency = urgencies[Math.floor(Math.random() * urgencies.length)]
    const randomReason = reasons[Math.floor(Math.random() * reasons.length)]
    const randomPhone = `+447${Math.floor(Math.random() * 900000000) + 100000000}`
    const email = randomName.toLowerCase().replace(" ", ".") + "@example.com"

    setFBForm({
      fullName: randomName,
      phoneNumber: randomPhone,
      email: email,
      propertyAddress: `${houseNumber} ${randomStreet}, ${randomArea}`,
      propertyPostcode: randomPostcode,
      urgency: randomUrgency,
      sellingReason: randomReason
    })

    toast({
      title: "Random lead generated",
      description: "Form filled with random test data",
    })
  }

  // Submit Facebook lead
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
          field_data: [
            { name: "full_name", values: [fbForm.fullName] },
            { name: "phone_number", values: [fbForm.phoneNumber] },
            { name: "property_address", values: [fbForm.propertyAddress] },
            { name: "property_postcode", values: [fbForm.propertyPostcode] },
            { name: "email", values: [fbForm.email] },
            { name: "urgency", values: [fbForm.urgency] },
            { name: "selling_reason", values: [fbForm.sellingReason] }
          ]
        })
      })

      const data = await response.json()

      if (data.success) {
        setFBResult(data)
        toast({
          title: "Lead submitted successfully!",
          description: "Facebook lead has been added to the vendor pipeline.",
        })
      } else {
        throw new Error(data.message || "Failed to submit lead")
      }
    } catch (error: any) {
      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive"
      })
      setFBResult({ success: false, error: error.message })
    } finally {
      setIsFBSubmitting(false)
    }
  }

  const selectedCurrency = currencies.find(c => c.value === settings.currency)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage your application preferences and display settings
        </p>
      </div>

      {/* Company Profile */}
      <Card className="border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-purple-600" />
            Company Profile
          </CardTitle>
          <CardDescription>
            Manage your company information, branding, logo, and social media profiles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Configure your company details, upload your logo, and set brand colors
              </p>
              <p className="text-sm text-muted-foreground">
                Used globally across the platform including dashboard header, investor packs, and email templates
              </p>
            </div>
            <Link href="/dashboard/settings/company-profile">
              <Button>
                <Building2 className="h-4 w-4 mr-2" />
                Manage Profile
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Investor Pack Templates */}
      <Card className="border-blue-200 dark:border-blue-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Investor Pack Templates
          </CardTitle>
          <CardDescription>
            Manage customizable templates for generating professional investor pack PDFs
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Create and customize investor pack templates with different sections, colors, and company branding
              </p>
              <p className="text-sm text-muted-foreground">
                View templates, statistics, and recent generations
              </p>
            </div>
            <Link href="/dashboard/settings/investor-packs">
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Manage Templates
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Currency Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Currency & Regional Settings
          </CardTitle>
          <CardDescription>
            Choose your preferred currency for displaying prices and financial metrics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="currency">Currency</Label>
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
            <p className="text-sm text-muted-foreground">
              Current selection: <strong>{selectedCurrency?.label}</strong> ({selectedCurrency?.symbol})
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Display Metrics Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Display Metrics
          </CardTitle>
          <CardDescription>
            Control which metrics and information are displayed throughout the application
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Rental Yield */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="rental-yield" className="text-base">
                Show Rental Yield
              </Label>
              <p className="text-sm text-muted-foreground">
                Display estimated rental yield percentages on property cards and comparables
              </p>
            </div>
            <Switch
              id="rental-yield"
              checked={settings.showRentalYield}
              onCheckedChange={(checked) => updateSettings({ showRentalYield: checked })}
            />
          </div>

          <Separator />

          {/* Distance in Miles */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="distance-miles" className="text-base">
                Show Distance in Miles
              </Label>
              <p className="text-sm text-muted-foreground">
                Display distance from target property for comparables
              </p>
            </div>
            <Switch
              id="distance-miles"
              checked={settings.showDistanceInMiles}
              onCheckedChange={(checked) => updateSettings({ showDistanceInMiles: checked })}
            />
          </div>

          <Separator />

          {/* Property Age */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="property-age" className="text-base">
                Show Property Age
              </Label>
              <p className="text-sm text-muted-foreground">
                Display estimated property age based on construction year
              </p>
            </div>
            <Switch
              id="property-age"
              checked={settings.showPropertyAge}
              onCheckedChange={(checked) => updateSettings({ showPropertyAge: checked })}
            />
          </div>

          <Separator />

          {/* BMV Highlight */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="bmv-highlight" className="text-base">
                Highlight BMV Reference Properties
              </Label>
              <p className="text-sm text-muted-foreground">
                Highlight properties used for Below Market Value calculations with special badges
              </p>
            </div>
            <Switch
              id="bmv-highlight"
              checked={settings.showBMVHighlight}
              onCheckedChange={(checked) => updateSettings({ showBMVHighlight: checked })}
            />
          </div>

          <Separator />

          {/* Confidence Scores */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="confidence-scores" className="text-base">
                Show Confidence Scores
              </Label>
              <p className="text-sm text-muted-foreground">
                Display confidence level badges on comparable properties (HIGH, MEDIUM, LOW)
              </p>
            </div>
            <Switch
              id="confidence-scores"
              checked={settings.showConfidenceScores}
              onCheckedChange={(checked) => updateSettings({ showConfidenceScores: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Analytics Settings (Future) */}
      <Card className="opacity-60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Analytics & Reporting
            <span className="ml-2 text-xs font-normal text-muted-foreground">(Coming Soon)</span>
          </CardTitle>
          <CardDescription>
            Configure data analysis and reporting preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between opacity-50">
            <div className="space-y-0.5">
              <Label className="text-base">
                Enable Advanced Analytics
              </Label>
              <p className="text-sm text-muted-foreground">
                Access detailed market trends, price predictions, and investment scoring
              </p>
            </div>
            <Switch disabled />
          </div>
        </CardContent>
      </Card>

      {/* Development Mode */}
      <Card className="border-orange-200 dark:border-orange-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-orange-600" />
            Development Tools
            <span className="ml-2 text-xs font-normal px-2 py-0.5 bg-orange-100 text-orange-700 rounded">
              Testing & Debug
            </span>
          </CardTitle>
          <CardDescription>
            Test tools for vendor pipeline, Facebook Lead Ads, and debugging
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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

              {/* AI Conversation Test Tab */}
              <TabsContent value="ai-test" className="space-y-4 mt-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-sm mb-2">Test AI Conversation</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Simulate a vendor conversation with custom data. The AI will process messages and move the lead through the pipeline.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vendorName" className="text-xs">Vendor Name</Label>
                  <Input
                    id="vendorName"
                    value={testForm.vendorName}
                    onChange={(e) => setTestForm({ ...testForm, vendorName: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorPhone" className="text-xs">Phone</Label>
                  <Input
                    id="vendorPhone"
                    value={testForm.vendorPhone}
                    onChange={(e) => setTestForm({ ...testForm, vendorPhone: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vendorEmail" className="text-xs">Email</Label>
                  <Input
                    id="vendorEmail"
                    value={testForm.vendorEmail}
                    onChange={(e) => setTestForm({ ...testForm, vendorEmail: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyType" className="text-xs">Property Type</Label>
                  <Select
                    value={testForm.propertyType}
                    onValueChange={(value) => setTestForm({ ...testForm, propertyType: value })}
                  >
                    <SelectTrigger id="propertyType" className="text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="terraced">Terraced</SelectItem>
                      <SelectItem value="semi-detached">Semi-Detached</SelectItem>
                      <SelectItem value="detached">Detached</SelectItem>
                      <SelectItem value="flat">Flat</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyAddress" className="text-xs">Property Address</Label>
                  <Input
                    id="propertyAddress"
                    value={testForm.propertyAddress}
                    onChange={(e) => setTestForm({ ...testForm, propertyAddress: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="propertyPostcode" className="text-xs">Postcode</Label>
                  <Input
                    id="propertyPostcode"
                    value={testForm.propertyPostcode}
                    onChange={(e) => setTestForm({ ...testForm, propertyPostcode: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="askingPrice" className="text-xs">Asking Price</Label>
                  <Input
                    id="askingPrice"
                    type="number"
                    value={testForm.askingPrice}
                    onChange={(e) => setTestForm({ ...testForm, askingPrice: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bedrooms" className="text-xs">Bedrooms</Label>
                  <Input
                    id="bedrooms"
                    type="number"
                    value={testForm.bedrooms}
                    onChange={(e) => setTestForm({ ...testForm, bedrooms: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="conversationMessages" className="text-xs">
                  Vendor Messages (one per line)
                </Label>
                <Textarea
                  id="conversationMessages"
                  value={testForm.conversationMessages}
                  onChange={(e) => setTestForm({ ...testForm, conversationMessages: e.target.value })}
                  rows={5}
                  className="text-sm font-mono"
                  placeholder="Enter vendor messages, one per line..."
                />
                <p className="text-xs text-muted-foreground">
                  Each line will be sent as a separate message from the vendor. The AI will respond to each message.
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={runAITest}
                  disabled={isTestRunning}
                  className="flex items-center gap-2"
                >
                  {isTestRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Running Test...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Run AI Test
                    </>
                  )}
                </Button>

                {testResult?.success && (
                  <Button
                    variant="outline"
                    onClick={() => router.push(testResult.leadUrl)}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    View Lead
                  </Button>
                )}
              </div>

              {testResult && (
                <div className={`p-4 rounded-lg border ${
                  testResult.success
                    ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                }`}>
                  <div className="flex items-start gap-2">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="flex-1 text-sm">
                      {testResult.success ? (
                        <div className="space-y-2">
                          <p className="font-semibold text-green-900 dark:text-green-100">
                            Test completed successfully!
                          </p>
                          <div className="text-xs space-y-1 text-green-800 dark:text-green-200">
                            <p>Lead ID: {testResult.leadId}</p>
                            <p>Final Stage: {testResult.finalStage}</p>
                            <p>Messages: {testResult.messageCount}</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <p className="font-semibold text-red-900 dark:text-red-100">Test failed</p>
                          <p className="text-xs text-red-800 dark:text-red-200 mt-1">{testResult.error}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
              </TabsContent>

              {/* Facebook Lead Ad Simulator Tab */}
              <TabsContent value="fb-simulator" className="space-y-4 mt-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                      <Facebook className="h-4 w-4 text-blue-600" />
                      Facebook Lead Ad Simulator
                    </h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Test the Facebook Lead Ad integration by simulating lead submissions. Leads are sent directly to the vendor pipeline with AI conversation enabled.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fbFullName" className="text-xs">
                        Full Name <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fbFullName"
                        value={fbForm.fullName}
                        onChange={(e) => setFBForm({ ...fbForm, fullName: e.target.value })}
                        placeholder="John Smith"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fbPhoneNumber" className="text-xs">
                        Phone Number <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fbPhoneNumber"
                        value={fbForm.phoneNumber}
                        onChange={(e) => setFBForm({ ...fbForm, phoneNumber: e.target.value })}
                        placeholder="+447700900123"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fbEmail" className="text-xs">Email</Label>
                      <Input
                        id="fbEmail"
                        type="email"
                        value={fbForm.email}
                        onChange={(e) => setFBForm({ ...fbForm, email: e.target.value })}
                        placeholder="john@example.com"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fbPostcode" className="text-xs">Postcode</Label>
                      <Input
                        id="fbPostcode"
                        value={fbForm.propertyPostcode}
                        onChange={(e) => setFBForm({ ...fbForm, propertyPostcode: e.target.value })}
                        placeholder="SW1A 1AA"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="fbAddress" className="text-xs">
                        Property Address <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="fbAddress"
                        value={fbForm.propertyAddress}
                        onChange={(e) => setFBForm({ ...fbForm, propertyAddress: e.target.value })}
                        placeholder="123 High Street, London"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fbUrgency" className="text-xs">Urgency</Label>
                      <Select
                        value={fbForm.urgency}
                        onValueChange={(value) => setFBForm({ ...fbForm, urgency: value })}
                      >
                        <SelectTrigger id="fbUrgency" className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                          <SelectItem value="soon">Soon (1 month)</SelectItem>
                          <SelectItem value="flexible">Flexible (3+ months)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fbReason" className="text-xs">Selling Reason</Label>
                      <Select
                        value={fbForm.sellingReason}
                        onValueChange={(value) => setFBForm({ ...fbForm, sellingReason: value })}
                      >
                        <SelectTrigger id="fbReason" className="text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="relocation">Relocation</SelectItem>
                          <SelectItem value="financial">Financial reasons</SelectItem>
                          <SelectItem value="inherited">Inherited property</SelectItem>
                          <SelectItem value="downsizing">Downsizing</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={generateRandomFBLead}
                      variant="outline"
                      className="flex items-center gap-2"
                    >
                      <Shuffle className="h-4 w-4" />
                      Random Lead
                    </Button>
                    <Button
                      onClick={submitFacebookLead}
                      disabled={isFBSubmitting}
                      className="flex items-center gap-2"
                    >
                      {isFBSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Lead
                        </>
                      )}
                    </Button>

                    {fbResult?.success && (
                      <Button
                        variant="outline"
                        onClick={() => router.push(fbResult.leadUrl || `/dashboard/vendors/pipeline?leadId=${fbResult.leadId}`)}
                        className="flex items-center gap-2"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View Lead
                      </Button>
                    )}
                  </div>

                  {fbResult && (
                    <div className={`p-4 rounded-lg border ${
                      fbResult.success
                        ? "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800"
                        : "bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800"
                    }`}>
                      <div className="flex items-start gap-2">
                        {fbResult.success ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                        )}
                        <div className="flex-1 text-sm">
                          {fbResult.success ? (
                            <div className="space-y-2">
                              <p className="font-semibold text-green-900 dark:text-green-100">
                                Lead submitted successfully!
                              </p>
                              <div className="text-xs space-y-1 text-green-800 dark:text-green-200">
                                <p>Lead ID: {fbResult.leadId}</p>
                                <p>Stage: {fbResult.pipelineStage}</p>
                                <p className="text-xs opacity-75">AI conversation triggered automatically</p>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-red-900 dark:text-red-100">Submission failed</p>
                              <p className="text-xs text-red-800 dark:text-red-200 mt-1">{fbResult.error}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* Utilities Tab */}
              <TabsContent value="utilities" className="space-y-6 mt-6">
                {/* Clear Test Data */}
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-sm mb-2">Clear Test Data</h3>
                    <p className="text-xs text-muted-foreground">
                      Remove all test vendor leads and associated messages/comparables. Only affects leads with test phone numbers, test emails, or &quot;Test&quot; in the name.
                    </p>
                  </div>

                  <Button
                    onClick={clearTestData}
                    disabled={isClearing}
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    {isClearing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Clearing...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4" />
                        Clear Test Data
                      </>
                    )}
                  </Button>
                </div>

                <Separator />

                {/* Quick Links */}
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm">Quick Links</h3>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/dashboard/vendors/pipeline")}
                      className="text-xs"
                    >
                      Vendor Pipeline
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push("/admin/facebook-ad-simulator")}
                      className="text-xs"
                    >
                      FB Simulator (Standalone)
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      {/* Info Card */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
        <CardContent className="pt-6">
          <p className="text-sm text-blue-900 dark:text-blue-100">
            <strong>Note:</strong> All settings are stored locally in your browser.
            They will not sync across devices unless you are using a browser sync feature.
            Some settings may require a page refresh to take full effect.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
