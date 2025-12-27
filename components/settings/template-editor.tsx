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
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { GripVertical, Eye, EyeOff, Info, ExternalLink } from "lucide-react"
import Link from "next/link"

interface TemplateEditorProps {
  template: any | null
  onSave: () => void
  onCancel: () => void
}

const AVAILABLE_SECTIONS = [
  { type: 'cover', title: 'Property Investment Opportunity', description: 'Hero cover page with key metrics' },
  { type: 'metrics', title: 'Investment Overview', description: '8-metric grid with financial overview' },
  { type: 'property', title: 'Property Details', description: 'Photos, specs, and highlights' },
  { type: 'financial', title: 'Financial Breakdown', description: 'Cost analysis and instant equity' },
  { type: 'returns', title: 'Investment Returns', description: 'Monthly income and yield projections' },
  { type: 'comparables', title: 'Market Analysis', description: 'Comparable properties and market stats' },
  { type: 'cta', title: 'Next Steps', description: 'Contact info and action items' },
]

const AVAILABLE_METRICS = [
  { key: 'askingPrice', label: 'Asking Price' },
  { key: 'marketValue', label: 'Market Value' },
  { key: 'bmvPercentage', label: 'BMV %' },
  { key: 'profitPotential', label: 'Profit Potential' },
  { key: 'grossYield', label: 'Gross Yield' },
  { key: 'netYield', label: 'Net Yield' },
  { key: 'roi', label: 'ROI' },
  { key: 'monthlyRent', label: 'Monthly Rent' },
  { key: 'annualRent', label: 'Annual Rent' },
  { key: 'refurbCost', label: 'Refurb Cost' },
  { key: 'stampDuty', label: 'Stamp Duty' },
  { key: 'totalInvestment', label: 'Total Investment' },
]

interface CompanyProfile {
  companyName: string
  companyEmail: string | null
  companyPhone: string | null
  companyWebsite: string | null
  logoUrl: string | null
}

export function TemplateEditor({ template, onSave, onCancel }: TemplateEditorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    coverStyle: 'modern',
    colorScheme: 'blue',
    sections: [] as any[],
    metricsConfig: {} as any,
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
        coverStyle: template.coverStyle,
        colorScheme: template.colorScheme,
        sections: Array.isArray(template.sections) ? template.sections : [],
        metricsConfig: typeof template.metricsConfig === 'object' ? template.metricsConfig : {},
        isActive: template.isActive,
      })
    } else {
      // Initialize with default sections for new templates
      setFormData(prev => ({
        ...prev,
        sections: AVAILABLE_SECTIONS.map((sec, idx) => ({
          type: sec.type,
          enabled: true,
          order: idx,
          title: sec.title,
        })),
        metricsConfig: {
          cover: ['bmvPercentage', 'profitPotential', 'roi'],
          metrics: ['askingPrice', 'marketValue', 'bmvPercentage', 'profitPotential', 'grossYield', 'netYield', 'roi', 'monthlyRent'],
        },
      }))
    }
  }, [template])

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
        body: JSON.stringify(formData),
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

  const toggleSection = (index: number) => {
    const newSections = [...formData.sections]
    newSections[index].enabled = !newSections[index].enabled
    setFormData({ ...formData, sections: newSections })
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Basic Info</TabsTrigger>
          <TabsTrigger value="sections">Sections</TabsTrigger>
          <TabsTrigger value="company">Company</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Premium Template"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this template..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="coverStyle">Cover Style</Label>
              <Select
                value={formData.coverStyle}
                onValueChange={(value) => setFormData({ ...formData, coverStyle: value })}
              >
                <SelectTrigger id="coverStyle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="modern">Modern</SelectItem>
                  <SelectItem value="classic">Classic</SelectItem>
                  <SelectItem value="minimal">Minimal</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
                </SelectContent>
              </Select>
            </div>
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

        <TabsContent value="sections" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Page Sections</CardTitle>
              <CardDescription>
                Toggle sections to include in your investor pack
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {formData.sections.map((section, index) => {
                const sectionInfo = AVAILABLE_SECTIONS.find(s => s.type === section.type)
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
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Page {index + 1}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleSection(index)}
                      >
                        {section.enabled ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </TabsContent>

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
