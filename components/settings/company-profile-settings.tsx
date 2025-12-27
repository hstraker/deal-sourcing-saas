"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Building2,
  Globe,
  Palette,
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  Image as ImageIcon,
  Info,
} from "lucide-react"
import { toast } from "sonner"
import Image from "next/image"

interface CompanyProfile {
  id?: string
  companyName: string
  companyEmail: string | null
  companyPhone: string | null
  companyWebsite: string | null
  companyAddress: string | null
  logoUrl: string | null
  logoS3Key: string | null
  primaryColor: string
  secondaryColor: string
  description: string | null
  tagline: string | null
  linkedinUrl: string | null
  facebookUrl: string | null
  twitterUrl: string | null
  instagramUrl: string | null
  companyNumber: string | null
  vatNumber: string | null
  fcaNumber: string | null
}

export function CompanyProfileSettings() {
  const [profile, setProfile] = useState<CompanyProfile>({
    companyName: "DealStack",
    companyEmail: null,
    companyPhone: null,
    companyWebsite: null,
    companyAddress: null,
    logoUrl: null,
    logoS3Key: null,
    primaryColor: "#3b82f6",
    secondaryColor: "#10b981",
    description: null,
    tagline: null,
    linkedinUrl: null,
    facebookUrl: null,
    twitterUrl: null,
    instagramUrl: null,
    companyNumber: null,
    vatNumber: null,
    fcaNumber: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchProfile()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/company-profile")
      if (response.ok) {
        const data = await response.json()
        if (data.profile) {
          setProfile(data.profile)
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error)
      toast.error("Failed to load company profile")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!profile.companyName.trim()) {
      toast.error("Company name is required")
      return
    }

    setSaving(true)
    try {
      const response = await fetch("/api/company-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })

      if (!response.ok) {
        throw new Error("Failed to save profile")
      }

      const data = await response.json()
      setProfile(data.profile)
      toast.success("Company profile updated successfully")

      // Trigger a refresh of any components using the profile
      window.dispatchEvent(new Event("company-profile-updated"))
    } catch (error) {
      console.error("Error saving profile:", error)
      toast.error("Failed to save company profile")
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB")
      return
    }

    setUploadingLogo(true)
    try {
      // Convert to base64 for now (in production, you'd upload to S3)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setProfile({ ...profile, logoUrl: base64 })
        toast.success("Logo uploaded successfully. Click Save to apply.")
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Error uploading logo:", error)
      toast.error("Failed to upload logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  const updateField = (field: keyof CompanyProfile, value: any) => {
    setProfile({ ...profile, [field]: value })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          This company profile is used globally across the platform including investor packs, dashboard header, and email templates.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">
            <Building2 className="h-4 w-4 mr-2" />
            Basic
          </TabsTrigger>
          <TabsTrigger value="branding">
            <Palette className="h-4 w-4 mr-2" />
            Branding
          </TabsTrigger>
          <TabsTrigger value="about">
            <FileText className="h-4 w-4 mr-2" />
            About
          </TabsTrigger>
          <TabsTrigger value="social">
            <Globe className="h-4 w-4 mr-2" />
            Social
          </TabsTrigger>
          <TabsTrigger value="legal">
            <FileText className="h-4 w-4 mr-2" />
            Legal
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Information</CardTitle>
              <CardDescription>Basic details about your company</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name *</Label>
                <Input
                  id="companyName"
                  value={profile.companyName}
                  onChange={(e) => updateField("companyName", e.target.value)}
                  placeholder="Your Company Name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={profile.companyEmail || ""}
                  onChange={(e) => updateField("companyEmail", e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone</Label>
                <Input
                  id="companyPhone"
                  type="tel"
                  value={profile.companyPhone || ""}
                  onChange={(e) => updateField("companyPhone", e.target.value)}
                  placeholder="+44 20 1234 5678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyWebsite">Website</Label>
                <Input
                  id="companyWebsite"
                  type="url"
                  value={profile.companyWebsite || ""}
                  onChange={(e) => updateField("companyWebsite", e.target.value)}
                  placeholder="https://www.company.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="companyAddress">Address</Label>
                <Textarea
                  id="companyAddress"
                  value={profile.companyAddress || ""}
                  onChange={(e) => updateField("companyAddress", e.target.value)}
                  placeholder="Your company address..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Logo</CardTitle>
              <CardDescription>
                Upload your company logo. Recommended size: 200x200px, max 5MB
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                {profile.logoUrl ? (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden bg-white">
                    <Image
                      src={profile.logoUrl}
                      alt="Company Logo"
                      fill
                      className="object-contain p-2"
                    />
                  </div>
                ) : (
                  <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center bg-muted">
                    <ImageIcon className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Logo
                      </>
                    )}
                  </Button>
                  {profile.logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => updateField("logoUrl", null)}
                    >
                      Remove Logo
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Brand Colors</CardTitle>
              <CardDescription>
                Primary and secondary colors for your brand
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Primary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={profile.primaryColor}
                      onChange={(e) => updateField("primaryColor", e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      value={profile.primaryColor}
                      onChange={(e) => updateField("primaryColor", e.target.value)}
                      placeholder="#3b82f6"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">Secondary Color</Label>
                  <div className="flex gap-2">
                    <Input
                      id="secondaryColor"
                      type="color"
                      value={profile.secondaryColor}
                      onChange={(e) => updateField("secondaryColor", e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      value={profile.secondaryColor}
                      onChange={(e) => updateField("secondaryColor", e.target.value)}
                      placeholder="#10b981"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>About Your Company</CardTitle>
              <CardDescription>
                Tell investors and partners about your business
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tagline">Tagline</Label>
                <Input
                  id="tagline"
                  value={profile.tagline || ""}
                  onChange={(e) => updateField("tagline", e.target.value)}
                  placeholder="A short, catchy tagline..."
                  maxLength={100}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Company Description</Label>
                <Textarea
                  id="description"
                  value={profile.description || ""}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Describe your company, mission, and what you do..."
                  rows={6}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social Media Tab */}
        <TabsContent value="social" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Social Media Links</CardTitle>
              <CardDescription>
                Connect your social media profiles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="linkedinUrl">LinkedIn</Label>
                <Input
                  id="linkedinUrl"
                  type="url"
                  value={profile.linkedinUrl || ""}
                  onChange={(e) => updateField("linkedinUrl", e.target.value)}
                  placeholder="https://linkedin.com/company/yourcompany"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebookUrl">Facebook</Label>
                <Input
                  id="facebookUrl"
                  type="url"
                  value={profile.facebookUrl || ""}
                  onChange={(e) => updateField("facebookUrl", e.target.value)}
                  placeholder="https://facebook.com/yourcompany"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="twitterUrl">Twitter / X</Label>
                <Input
                  id="twitterUrl"
                  type="url"
                  value={profile.twitterUrl || ""}
                  onChange={(e) => updateField("twitterUrl", e.target.value)}
                  placeholder="https://twitter.com/yourcompany"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagramUrl">Instagram</Label>
                <Input
                  id="instagramUrl"
                  type="url"
                  value={profile.instagramUrl || ""}
                  onChange={(e) => updateField("instagramUrl", e.target.value)}
                  placeholder="https://instagram.com/yourcompany"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Legal Tab */}
        <TabsContent value="legal" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Legal & Registration</CardTitle>
              <CardDescription>
                Company registration and legal information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyNumber">Company Registration Number</Label>
                <Input
                  id="companyNumber"
                  value={profile.companyNumber || ""}
                  onChange={(e) => updateField("companyNumber", e.target.value)}
                  placeholder="12345678"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vatNumber">VAT Number</Label>
                <Input
                  id="vatNumber"
                  value={profile.vatNumber || ""}
                  onChange={(e) => updateField("vatNumber", e.target.value)}
                  placeholder="GB123456789"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fcaNumber">FCA Registration Number</Label>
                <Input
                  id="fcaNumber"
                  value={profile.fcaNumber || ""}
                  onChange={(e) => updateField("fcaNumber", e.target.value)}
                  placeholder="123456"
                />
                <p className="text-sm text-muted-foreground">
                  If your company is FCA registered
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button onClick={fetchProfile} variant="outline" disabled={saving}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
