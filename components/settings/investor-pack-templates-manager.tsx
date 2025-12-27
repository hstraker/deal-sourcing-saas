"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Plus,
  Edit,
  Trash2,
  Copy,
  FileText,
  BarChart3,
  Eye,
  Star,
  Download,
  TrendingUp,
  Lightbulb,
  Building2,
  Target,
  Info,
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"
import { TemplateEditor } from "./template-editor"
import { FourPartTemplateEditor } from "./four-part-template-editor"
import { formatCurrency } from "@/lib/format"

interface Template {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isActive: boolean
  coverStyle?: string
  colorScheme: string
  templateType?: '4-part' | 'single' | null
  usageCount: number
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

interface TemplateStats {
  totalGenerated: number
  last30Days: number
  last7Days: number
  mostUsedTemplate: {
    name: string
    count: number
  } | null
  recentGenerations: Array<{
    id: string
    propertyAddress: string
    askingPrice: number
    createdAt: Date
    template: {
      name: string
    } | null
  }>
}

export function InvestorPackTemplatesManager() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [stats, setStats] = useState<TemplateStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [newTemplateType, setNewTemplateType] = useState<'4-part' | 'single'>('4-part')

  useEffect(() => {
    fetchTemplates()
    fetchStats()
  }, [])

  const fetchTemplates = async () => {
    try {
      const response = await fetch("/api/investor-pack-templates")
      if (!response.ok) throw new Error("Failed to fetch templates")
      const data = await response.json()
      setTemplates(data.templates)
    } catch (error) {
      console.error("Error fetching templates:", error)
      toast.error("Failed to load templates")
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await fetch("/api/investor-pack-templates/stats")
      if (!response.ok) throw new Error("Failed to fetch stats")
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }

  const handleDuplicate = async (template: Template) => {
    try {
      const response = await fetch(`/api/investor-pack-templates/${template.id}/duplicate`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to duplicate template")

      toast.success(`"${template.name}" duplicated successfully`)
      fetchTemplates()
    } catch (error) {
      console.error("Error duplicating template:", error)
      toast.error("Failed to duplicate template")
    }
  }

  const handleDelete = async (template: Template) => {
    if (template.isDefault) {
      toast.error("Cannot delete the default template")
      return
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return
    }

    try {
      const response = await fetch(`/api/investor-pack-templates/${template.id}`, {
        method: "DELETE",
      })
      if (!response.ok) throw new Error("Failed to delete template")

      toast.success(`"${template.name}" deleted successfully`)
      fetchTemplates()
    } catch (error) {
      console.error("Error deleting template:", error)
      toast.error("Failed to delete template")
    }
  }

  const handleSetDefault = async (template: Template) => {
    try {
      const response = await fetch(`/api/investor-pack-templates/${template.id}/set-default`, {
        method: "POST",
      })
      if (!response.ok) throw new Error("Failed to set default")

      toast.success(`"${template.name}" is now the default template`)
      fetchTemplates()
    } catch (error) {
      console.error("Error setting default:", error)
      toast.error("Failed to set as default")
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-8">
      {/* The Investables Method Overview */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-blue-600" />
            The Investables 4-Part Progressive Method
          </CardTitle>
          <CardDescription className="text-blue-900 dark:text-blue-100">
            A proven approach to getting 6-figure investors confidently and compliantly
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="grid md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Part 1: Executive Summary
              </div>
              <p className="text-muted-foreground">1 page to pique interest. No asking for money.</p>
              <Badge variant="outline">PAUSE → Call</Badge>
            </div>
            <div className="space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Part 2: Company Profile
              </div>
              <p className="text-muted-foreground">3-5 pages showing credibility and professionalism.</p>
            </div>
            <div className="space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Part 3: Case Studies
              </div>
              <p className="text-muted-foreground">Build authority with your track record.</p>
              <Badge variant="outline">STOP → Qualify</Badge>
            </div>
            <div className="space-y-2">
              <div className="font-semibold flex items-center gap-2">
                <Target className="h-4 w-4" />
                Part 4: Investment Offering
              </div>
              <p className="text-muted-foreground">8-15 pages with deal details. HNWI/SI only.</p>
            </div>
          </div>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Why Progressive?</strong> No investor is excited to read a 20+ page document from someone they just met.
              Building trust progressively is the key to fundraising success.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Generated</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGenerated}</div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 30 Days</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last30Days}</div>
              <p className="text-xs text-muted-foreground">Past month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.last7Days}</div>
              <p className="text-xs text-muted-foreground">This week</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Most Used</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.mostUsedTemplate?.count || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats.mostUsedTemplate?.name || "N/A"}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Templates</CardTitle>
            <CardDescription>
              Manage your investor pack templates
            </CardDescription>
          </div>
          <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => {
                setSelectedTemplate(null)
                setNewTemplateType('4-part')
              }}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {selectedTemplate ? "Edit Template" : "Create New Investor Pack Template"}
                </DialogTitle>
                <DialogDescription>
                  {selectedTemplate
                    ? "Configure your investor pack template"
                    : "Choose a template type and configure your investor pack"}
                </DialogDescription>
              </DialogHeader>

              {/* Template Type Selector - only show for new templates */}
              {!selectedTemplate && (
                <div className="mb-4 p-4 border rounded-lg bg-muted/50">
                  <Label className="text-base font-medium mb-3 block">Template Type</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <Card
                      className={`cursor-pointer transition-all ${newTemplateType === '4-part' ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                      onClick={() => setNewTemplateType('4-part')}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          4-Part Progressive
                          <Badge variant="secondary">Recommended</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Following The Investables method: Executive Summary, Company Profile, Case Studies, and Investment Offering sent progressively.
                        </p>
                      </CardContent>
                    </Card>

                    <Card
                      className={`cursor-pointer transition-all ${newTemplateType === 'single' ? 'ring-2 ring-primary' : 'hover:border-primary'}`}
                      onClick={() => setNewTemplateType('single')}
                    >
                      <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Single Deal Pack
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Traditional single comprehensive pack for specific property deals.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Render appropriate editor based on template type */}
              {(selectedTemplate?.templateType === '4-part' || (!selectedTemplate && newTemplateType === '4-part')) ? (
                <FourPartTemplateEditor
                  template={selectedTemplate}
                  onSave={() => {
                    setIsEditorOpen(false)
                    setSelectedTemplate(null)
                    fetchTemplates()
                  }}
                  onCancel={() => {
                    setIsEditorOpen(false)
                    setSelectedTemplate(null)
                  }}
                />
              ) : (
                <TemplateEditor
                  template={selectedTemplate}
                  onSave={() => {
                    setIsEditorOpen(false)
                    setSelectedTemplate(null)
                    fetchTemplates()
                  }}
                  onCancel={() => {
                    setIsEditorOpen(false)
                    setSelectedTemplate(null)
                  }}
                />
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Style</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Usage</TableHead>
                <TableHead>Last Used</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{template.name}</span>
                      {template.isDefault && (
                        <Badge variant="secondary">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {template.templateType === '4-part' ? '4-Part Progressive' : 'Single Pack'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-4 h-4 rounded"
                        style={{
                          background:
                            template.colorScheme === "blue"
                              ? "#3b82f6"
                              : template.colorScheme === "green"
                              ? "#10b981"
                              : template.colorScheme === "purple"
                              ? "#8b5cf6"
                              : template.colorScheme === "gold"
                              ? "#f59e0b"
                              : "#1f2937",
                        }}
                      />
                      <span className="text-sm capitalize">
                        {template.coverStyle || template.colorScheme}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={template.isActive ? "default" : "secondary"}>
                      {template.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>{template.usageCount}</TableCell>
                  <TableCell>{formatDate(template.lastUsedAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedTemplate(template)
                          setIsEditorOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDuplicate(template)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      {!template.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(template)}
                        >
                          <Star className="h-4 w-4" />
                        </Button>
                      )}
                      {!template.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(template)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Generations */}
      {stats && stats.recentGenerations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Generations</CardTitle>
            <CardDescription>
              Last 10 investor packs generated
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Asking Price</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Generated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.recentGenerations.map((gen) => (
                  <TableRow key={gen.id}>
                    <TableCell className="font-medium">
                      {gen.propertyAddress}
                    </TableCell>
                    <TableCell>{formatCurrency(Number(gen.askingPrice))}</TableCell>
                    <TableCell>
                      {gen.template?.name || "Unknown"}
                    </TableCell>
                    <TableCell>{formatDate(gen.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
