"use client"

import { useState, useEffect } from "react"
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
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { toast } from "sonner"
import {
  FileText,
  Building2,
  TrendingUp,
  Target,
  Info,
  CheckCircle2,
  Eye,
  EyeOff,
  GripVertical,
  Lightbulb,
  ExternalLink
} from "lucide-react"
import Link from "next/link"

interface FourPartTemplateEditorProps {
  template: any | null
  onSave: () => void
  onCancel: () => void
}

// Part 1: Company Executive Summary (1 page)
const PART1_SECTIONS = [
  { type: 'executive_intro', title: 'Introduction', description: 'Who you are and what you do' },
  { type: 'executive_headshot', title: 'Headshot & Bio', description: 'Your photo and brief bio' },
  { type: 'executive_digital', title: 'Digital Presence', description: 'Website, LinkedIn, social links' },
  { type: 'executive_value', title: 'Value Proposition', description: 'What you offer investors' },
]

// Part 2: Company Profile (3-5 pages)
const PART2_SECTIONS = [
  { type: 'company_overview', title: 'Company Overview', description: 'Detailed business description' },
  { type: 'company_team', title: 'Team', description: 'Key team members and roles' },
  { type: 'company_values', title: 'Values & Principles', description: 'Your business philosophy' },
  { type: 'company_process', title: 'Investment Process', description: 'How you work with investors' },
  { type: 'company_continuity', title: 'Business Continuity', description: 'Risk management and contingencies' },
  { type: 'company_credentials', title: 'Credentials & Accreditation', description: 'Qualifications and memberships' },
]

// Part 3: Case Studies (1-2 pages per study, max 3)
const PART3_SECTIONS = [
  { type: 'case_study_header', title: 'Case Study Header', description: 'Project title and summary' },
  { type: 'case_study_overview', title: 'Project Overview', description: 'Property details and strategy' },
  { type: 'case_study_financials', title: 'Financial Analysis', description: 'Actual costs and returns achieved' },
  { type: 'case_study_photos', title: 'Before & After Photos', description: 'Visual transformation' },
  { type: 'case_study_timeline', title: 'Project Timeline', description: 'Key milestones and duration' },
  { type: 'case_study_lessons', title: 'Key Learnings', description: 'What worked and challenges overcome' },
]

// Part 4: Investment Offering (8-15 pages)
const PART4_SECTIONS = [
  { type: 'deal_cover', title: 'Deal Cover', description: 'Property investment opportunity headline' },
  { type: 'deal_overview', title: 'Deal Overview', description: 'Property details and opportunity summary' },
  { type: 'deal_metrics', title: 'Key Metrics', description: 'Financial highlights at a glance' },
  { type: 'deal_property', title: 'Property Details', description: 'Full property specifications' },
  { type: 'deal_photos', title: 'Property Photos', description: 'Current condition photos' },
  { type: 'deal_financial', title: 'Financial Breakdown', description: 'Detailed cost analysis' },
  { type: 'deal_returns', title: 'Investment Returns', description: 'Projected income and yields' },
  { type: 'deal_market', title: 'Market Analysis', description: 'Comparables and area stats' },
  { type: 'deal_strategy', title: 'Exit Strategy', description: 'How investors will realize returns' },
  { type: 'deal_risks', title: 'Risk Analysis', description: 'Potential risks and mitigation' },
  { type: 'deal_terms', title: 'Investment Terms', description: 'Deal structure and conditions' },
  { type: 'deal_cta', title: 'Next Steps', description: 'How to proceed with investment' },
]

interface CompanyProfile {
  companyName: string
  companyEmail: string | null
  companyPhone: string | null
  companyWebsite: string | null
  logoUrl: string | null
}

export function FourPartTemplateEditor({ template, onSave, onCancel }: FourPartTemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    colorScheme: 'blue',
    part1Enabled: true,
    part1Sections: [] as any[],
    part2Enabled: true,
    part2Sections: [] as any[],
    part3Enabled: true,
    part3Sections: [] as any[],
    part4Enabled: true,
    part4Sections: [] as any[],
    includeRiskWarnings: true,
    orientation: 'landscape',
    isActive: true,
  })
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [saving, setSaving] = useState(false)

  // Fetch company profile on mount
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/company-profile")
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setCompanyProfile(data.profile)
          }
        }
      } catch (error) {
        console.error("Error fetching company profile:", error)
      }
    }
    fetchProfile()
  }, [])

  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        colorScheme: template.colorScheme || 'blue',
        part1Enabled: template.part1Enabled !== false,
        part1Sections: Array.isArray(template.part1Sections) ? template.part1Sections : initializeSections(PART1_SECTIONS),
        part2Enabled: template.part2Enabled !== false,
        part2Sections: Array.isArray(template.part2Sections) ? template.part2Sections : initializeSections(PART2_SECTIONS),
        part3Enabled: template.part3Enabled !== false,
        part3Sections: Array.isArray(template.part3Sections) ? template.part3Sections : initializeSections(PART3_SECTIONS),
        part4Enabled: template.part4Enabled !== false,
        part4Sections: Array.isArray(template.part4Sections) ? template.part4Sections : initializeSections(PART4_SECTIONS),
        includeRiskWarnings: template.includeRiskWarnings !== false,
        orientation: template.orientation || 'landscape',
        isActive: template.isActive !== false,
      })
    } else {
      // Initialize new template with default sections
      setFormData(prev => ({
        ...prev,
        part1Sections: initializeSections(PART1_SECTIONS),
        part2Sections: initializeSections(PART2_SECTIONS),
        part3Sections: initializeSections(PART3_SECTIONS),
        part4Sections: initializeSections(PART4_SECTIONS),
      }))
    }
  }, [template])

  const initializeSections = (sections: any[]) => {
    return sections.map((sec, idx) => ({
      type: sec.type,
      enabled: true,
      order: idx,
      title: sec.title,
    }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Template name is required")
      return
    }

    setSaving(true)
    try {
      const url = template
        ? `/api/investor-pack-templates/${template.id}`
        : '/api/investor-pack-templates'

      const response = await fetch(url, {
        method: template ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          templateType: '4-part', // Identify this as a 4-part template
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save template')
      }

      toast.success(template ? 'Template updated successfully' : 'Template created successfully')
      onSave()
    } catch (error: any) {
      console.error('Error saving template:', error)
      toast.error(error.message || 'Failed to save template')
    } finally {
      setSaving(false)
    }
  }

  const toggleSection = (part: 'part1' | 'part2' | 'part3' | 'part4', index: number) => {
    const sectionsKey = `${part}Sections` as keyof typeof formData
    const sections = [...formData[sectionsKey] as any[]]
    sections[index].enabled = !sections[index].enabled
    setFormData({ ...formData, [sectionsKey]: sections })
  }

  const renderSectionsList = (
    partKey: 'part1' | 'part2' | 'part3' | 'part4',
    availableSections: any[]
  ) => {
    const sectionsKey = `${partKey}Sections` as keyof typeof formData
    const sections = formData[sectionsKey] as any[]

    return (
      <div className="space-y-2">
        {sections.map((section, index) => {
          const sectionInfo = availableSections.find(s => s.type === section.type)
          return (
            <div
              key={section.type}
              className="flex items-center justify-between p-3 border rounded-lg"
            >
              <div className="flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                <div>
                  <div className="font-medium">{sectionInfo?.title || section.title}</div>
                  <div className="text-sm text-muted-foreground">
                    {sectionInfo?.description}
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleSection(partKey, index)}
              >
                {section.enabled ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </Button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* The Investables Method Info */}
      <Alert>
        <Lightbulb className="h-4 w-4" />
        <AlertTitle>The Investables 4-Part Progressive Method</AlertTitle>
        <AlertDescription>
          This template follows a proven approach: send parts progressively to build trust
          and engagement. Don&apos;t overwhelm investors with a 20+ page document upfront!
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="basic">Basic</TabsTrigger>
          <TabsTrigger value="part1">
            <div className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              Part 1
            </div>
          </TabsTrigger>
          <TabsTrigger value="part2">
            <div className="flex items-center gap-1">
              <Building2 className="h-4 w-4" />
              Part 2
            </div>
          </TabsTrigger>
          <TabsTrigger value="part3">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              Part 3
            </div>
          </TabsTrigger>
          <TabsTrigger value="part4">
            <div className="flex items-center gap-1">
              <Target className="h-4 w-4" />
              Part 4
            </div>
          </TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., The Investables Template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="4-part progressive investor pack following The Investables method..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="colorScheme">Color Scheme</Label>
              <Select
                value={formData.colorScheme}
                onValueChange={(value) => setFormData({ ...formData, colorScheme: value })}
              >
                <SelectTrigger id="colorScheme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="blue">Blue</SelectItem>
                  <SelectItem value="green">Green</SelectItem>
                  <SelectItem value="purple">Purple</SelectItem>
                  <SelectItem value="gold">Gold</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="orientation">Orientation</Label>
              <Select
                value={formData.orientation}
                onValueChange={(value) => setFormData({ ...formData, orientation: value })}
              >
                <SelectTrigger id="orientation">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landscape">Landscape (Recommended for digital)</SelectItem>
                  <SelectItem value="portrait">Portrait (For printing)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="includeRiskWarnings">Include Risk Warnings</Label>
              <p className="text-sm text-muted-foreground">FCA compliance requirement</p>
            </div>
            <Switch
              id="includeRiskWarnings"
              checked={formData.includeRiskWarnings}
              onCheckedChange={(checked) => setFormData({ ...formData, includeRiskWarnings: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="isActive">Active Template</Label>
            <Switch
              id="isActive"
              checked={formData.isActive}
              onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
            />
          </div>
        </TabsContent>

        {/* Part 1: Company Executive Summary */}
        <TabsContent value="part1" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Part 1: Company Executive Summary
                <Badge>1 Page</Badge>
              </CardTitle>
              <CardDescription>
                <strong>Purpose:</strong> Pique interest, introduce who you are<br/>
                <strong>When:</strong> First contact with new investor leads<br/>
                <strong>Remember:</strong> No asking for money, no live deals mentioned
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>PAUSE HERE:</strong> Wait for response before sending Part 2. Schedule an introductory call if they reply.
                </AlertDescription>
              </Alert>
              {renderSectionsList('part1', PART1_SECTIONS)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Part 2: Company Profile */}
        <TabsContent value="part2" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Part 2: Company Profile
                <Badge>3-5 Pages</Badge>
              </CardTitle>
              <CardDescription>
                <strong>Purpose:</strong> Show credibility, provide business details<br/>
                <strong>When:</strong> After successful intro call<br/>
                <strong>Remember:</strong> Still no asking for money or deals
              </CardDescription>
            </CardHeader>
            <CardContent>
              {renderSectionsList('part2', PART2_SECTIONS)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Part 3: Case Studies */}
        <TabsContent value="part3" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Part 3: Case Studies
                <Badge>1-2 Pages Each (Max 3 Studies)</Badge>
              </CardTitle>
              <CardDescription>
                <strong>Purpose:</strong> Build authority, show track record<br/>
                <strong>When:</strong> After they&apos;ve reviewed Part 2<br/>
                <strong>Include:</strong> Before/after photos, actual financials, risk warning
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <strong>STOP HERE:</strong> Qualify investor (HNWI/Sophisticated) before sending Part 4. Check FCA financial promotion rules.
                </AlertDescription>
              </Alert>
              {renderSectionsList('part3', PART3_SECTIONS)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Part 4: Investment Offering */}
        <TabsContent value="part4" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Part 4: Investment Offering
                <Badge>8-15 Pages</Badge>
              </CardTitle>
              <CardDescription>
                <strong>Purpose:</strong> Present specific deal, make it easy to say yes<br/>
                <strong>When:</strong> Only to qualified HNWI/Sophisticated investors<br/>
                <strong>Include:</strong> Full due diligence, risks & rewards, deal terms
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4 border-amber-500">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-900 dark:text-amber-200">
                  <strong>FCA Compliance:</strong> This is a financial promotion. Ensure investor is certified HNWI/Sophisticated before sending.
                </AlertDescription>
              </Alert>
              {renderSectionsList('part4', PART4_SECTIONS)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Company Info Tab */}
        <TabsContent value="company" className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Company information is managed globally and used across all templates.{" "}
              <Link href="/dashboard/settings/company-profile" className="font-medium underline inline-flex items-center gap-1">
                Edit company profile
                <ExternalLink className="h-3 w-3" />
              </Link>
            </AlertDescription>
          </Alert>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Current Company Information</CardTitle>
              <CardDescription>
                This information will be used in generated investor packs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm text-muted-foreground">Company Name</Label>
                  <p className="text-sm font-medium mt-1">
                    {companyProfile?.companyName || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Phone</Label>
                  <p className="text-sm font-medium mt-1">
                    {companyProfile?.companyPhone || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Email</Label>
                  <p className="text-sm font-medium mt-1">
                    {companyProfile?.companyEmail || "Not set"}
                  </p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Website</Label>
                  <p className="text-sm font-medium mt-1">
                    {companyProfile?.companyWebsite || "Not set"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  )
}
