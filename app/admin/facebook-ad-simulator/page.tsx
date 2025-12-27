"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { useToast } from "@/hooks/use-toast"
import {
  Facebook,
  Home,
  Send,
  Shuffle,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink
} from "lucide-react"
import { useRouter } from "next/navigation"

interface LeadFormData {
  fullName: string
  phoneNumber: string
  propertyAddress: string
  propertyPostcode: string
  email: string
  urgency: string
  reason: string
}

export default function FacebookAdSimulatorPage() {
  const { toast } = useToast()
  const router = useRouter()

  const [formData, setFormData] = useState<LeadFormData>({
    fullName: "",
    phoneNumber: "",
    propertyAddress: "",
    propertyPostcode: "",
    email: "",
    urgency: "",
    reason: ""
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitResult, setSubmitResult] = useState<{
    success: boolean
    message: string
    leadId?: string
    leadUrl?: string
  } | null>(null)

  // Random UK names, addresses, and postcodes for testing
  const randomData = {
    names: [
      "James Smith", "Sarah Johnson", "Michael Brown", "Emma Wilson",
      "David Taylor", "Olivia Davies", "Robert Evans", "Sophie Thomas",
      "William Roberts", "Emily Williams", "John Anderson", "Lucy Martin"
    ],
    streets: [
      "High Street", "Park Road", "Church Lane", "Station Road",
      "Victoria Street", "Manor Road", "Mill Lane", "Green Lane",
      "Main Street", "Oak Avenue", "Elm Road", "Cedar Close"
    ],
    areas: [
      "London", "Manchester", "Birmingham", "Leeds",
      "Bristol", "Liverpool", "Sheffield", "Newcastle"
    ],
    postcodes: [
      "SW1A 1AA", "M1 1AA", "B1 1AA", "LS1 1AA",
      "BS1 1AA", "L1 1AA", "S1 1AA", "NE1 1AA",
      "SW1W 0NY", "W1A 1AA", "EC1A 1BB", "WC2N 5DU"
    ],
    urgencies: ["urgent", "soon", "flexible"],
    reasons: ["relocation", "financial", "inherited", "downsizing", "other"]
  }

  const generateRandomLead = () => {
    const randomName = randomData.names[Math.floor(Math.random() * randomData.names.length)]
    const randomStreet = randomData.streets[Math.floor(Math.random() * randomData.streets.length)]
    const randomArea = randomData.areas[Math.floor(Math.random() * randomData.areas.length)]
    const randomPostcode = randomData.postcodes[Math.floor(Math.random() * randomData.postcodes.length)]
    const houseNumber = Math.floor(Math.random() * 200) + 1
    const randomUrgency = randomData.urgencies[Math.floor(Math.random() * randomData.urgencies.length)]
    const randomReason = randomData.reasons[Math.floor(Math.random() * randomData.reasons.length)]

    // Generate UK mobile number
    const randomPhone = `+447${Math.floor(Math.random() * 900000000) + 100000000}`
    const email = randomName.toLowerCase().replace(" ", ".") + "@example.com"

    setFormData({
      fullName: randomName,
      phoneNumber: randomPhone,
      propertyAddress: `${houseNumber} ${randomStreet}, ${randomArea}`,
      propertyPostcode: randomPostcode,
      email: email,
      urgency: randomUrgency,
      reason: randomReason
    })

    toast({
      title: "Random lead generated",
      description: "Form filled with test data. Click Submit to send to pipeline.",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitResult(null)

    try {
      // Validate required fields
      if (!formData.fullName || !formData.phoneNumber || !formData.propertyAddress) {
        throw new Error("Please fill in all required fields")
      }

      // Submit to API
      const response = await fetch("/api/facebook-leads/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          leadgen_id: `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          created_time: new Date().toISOString(),
          field_data: [
            { name: "full_name", values: [formData.fullName] },
            { name: "phone_number", values: [formData.phoneNumber] },
            { name: "property_address", values: [formData.propertyAddress] },
            { name: "property_postcode", values: [formData.propertyPostcode] },
            { name: "email", values: [formData.email] },
            { name: "urgency", values: [formData.urgency] },
            { name: "selling_reason", values: [formData.reason] }
          ]
        })
      })

      const result = await response.json()

      if (result.success) {
        setSubmitResult({
          success: true,
          message: "Lead successfully submitted to pipeline!",
          leadId: result.leadId,
          leadUrl: result.leadUrl || `/dashboard/vendors/pipeline?leadId=${result.leadId}`
        })

        toast({
          title: "Success!",
          description: `Lead created and added to vendor pipeline. AI conversation will start automatically.`,
        })

        // Reset form
        setFormData({
          fullName: "",
          phoneNumber: "",
          propertyAddress: "",
          propertyPostcode: "",
          email: "",
          urgency: "",
          reason: ""
        })
      } else {
        throw new Error(result.message || "Failed to submit lead")
      }
    } catch (error: any) {
      setSubmitResult({
        success: false,
        message: error.message || "Failed to submit lead"
      })

      toast({
        title: "Submission failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Facebook className="h-8 w-8 text-blue-600" />
              Facebook Lead Ad Simulator
            </h1>
            <p className="text-muted-foreground mt-2">
              Test your vendor pipeline by simulating Facebook Lead Ads submissions
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => router.push("/dashboard/vendors/pipeline")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Pipeline
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Ad Preview */}
          <Card className="border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-2">
                <Facebook className="h-6 w-6" />
                <div>
                  <CardTitle>Ad Preview</CardTitle>
                  <CardDescription className="text-blue-100">
                    What vendors see on Facebook
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {/* Mock Ad Creative */}
              <div className="bg-gray-50 border rounded-lg overflow-hidden">
                {/* Mock Image */}
                <div className="h-48 bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                  <Home className="h-24 w-24 text-white opacity-50" />
                </div>

                {/* Ad Content */}
                <div className="p-4 space-y-3">
                  <h3 className="font-bold text-lg">
                    Need To Sell Your Property Quickly?
                  </h3>
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
            </CardContent>
          </Card>

          {/* Lead Form */}
          <Card className="border-blue-200">
            <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
              <div className="flex items-center gap-2">
                <Send className="h-6 w-6" />
                <div>
                  <CardTitle>Lead Form</CardTitle>
                  <CardDescription className="text-blue-100">
                    Submit test leads to pipeline
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-2">
                  <Label htmlFor="fullName">
                    Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="John Smith"
                    required
                  />
                </div>

                {/* Phone Number */}
                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">
                    Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    value={formData.phoneNumber}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="+447700900123"
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    UK format: +447XXXXXXXXX
                  </p>
                </div>

                {/* Property Address */}
                <div className="space-y-2">
                  <Label htmlFor="propertyAddress">
                    Property Address <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="propertyAddress"
                    value={formData.propertyAddress}
                    onChange={(e) => setFormData({ ...formData, propertyAddress: e.target.value })}
                    placeholder="123 High Street, London"
                    rows={2}
                    required
                  />
                </div>

                {/* Property Postcode */}
                <div className="space-y-2">
                  <Label htmlFor="propertyPostcode">Property Postcode</Label>
                  <Input
                    id="propertyPostcode"
                    value={formData.propertyPostcode}
                    onChange={(e) => setFormData({ ...formData, propertyPostcode: e.target.value })}
                    placeholder="SW1A 1AA"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="john.smith@example.com"
                  />
                </div>

                {/* Urgency */}
                <div className="space-y-2">
                  <Label htmlFor="urgency">How quickly do you need to sell?</Label>
                  <Select
                    value={formData.urgency}
                    onValueChange={(value) => setFormData({ ...formData, urgency: value })}
                  >
                    <SelectTrigger id="urgency">
                      <SelectValue placeholder="Select urgency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent">Urgent (1-2 weeks)</SelectItem>
                      <SelectItem value="soon">Soon (1 month)</SelectItem>
                      <SelectItem value="flexible">Flexible (3+ months)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Reason */}
                <div className="space-y-2">
                  <Label htmlFor="reason">Why are you selling?</Label>
                  <Select
                    value={formData.reason}
                    onValueChange={(value) => setFormData({ ...formData, reason: value })}
                  >
                    <SelectTrigger id="reason">
                      <SelectValue placeholder="Select reason..." />
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

                <Separator />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateRandomLead}
                    className="flex-1"
                  >
                    <Shuffle className="h-4 w-4 mr-2" />
                    Random Lead
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Lead
                      </>
                    )}
                  </Button>
                </div>

                {/* Result Display */}
                {submitResult && (
                  <Alert
                    className={
                      submitResult.success
                        ? "bg-green-50 border-green-200"
                        : "bg-red-50 border-red-200"
                    }
                  >
                    <div className="flex items-start gap-2">
                      {submitResult.success ? (
                        <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <AlertDescription>
                          <p className={submitResult.success ? "text-green-900" : "text-red-900"}>
                            {submitResult.message}
                          </p>
                          {submitResult.success && submitResult.leadId && (
                            <div className="mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(submitResult.leadUrl!)}
                                className="text-xs"
                              >
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Lead in Pipeline
                              </Button>
                            </div>
                          )}
                        </AlertDescription>
                      </div>
                    </div>
                  </Alert>
                )}
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Info Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
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
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
