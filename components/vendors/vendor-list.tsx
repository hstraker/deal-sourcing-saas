"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Phone, Mail, Building2, Trash2, Loader2, TrendingUp, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VendorLeadDetailModal } from "./vendor-lead-detail-modal"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/format"

interface VendorLead {
  id: string
  vendorName: string
  vendorPhone: string
  vendorEmail: string | null
  propertyAddress: string | null
  propertyPostcode: string | null
  askingPrice: number | null
  condition: string | null
  urgencyLevel: string | null
  reasonForSelling: string | null
  motivationScore: number | null
  pipelineStage: string
  leadSource: string | null
  createdAt: string
  lastContactAt: string | null
  timelineDays: number | null
  competingOffers: boolean | null
  offerAmount: number | null
  offerSentAt: string | null
  offerAcceptedAt: string | null
  offerRejectedAt: string | null
  retryCount: number
  bmvScore: number | null
  validationPassed: boolean | null
  _count: {
    smsMessages: number
  }
  smsMessages: Array<{
    id: string
    direction: string
    messageBody: string
    createdAt: string
    aiGenerated: boolean
  }>
}

export function VendorList() {
  const [vendors, setVendors] = useState<VendorLead[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [selectedVendor, setSelectedVendor] = useState<VendorLead | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)

  const fetchVendors = async () => {
    try {
      const url = statusFilter === "all" ? "/api/vendors" : `/api/vendors?pipelineStage=${statusFilter}`
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error("Failed to fetch vendors")
      }
      const data = await response.json()
      setVendors(data)
    } catch (error) {
      console.error("Error fetching vendors:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchVendors()
  }, [statusFilter])

  const handleViewDetails = (vendor: VendorLead) => {
    setSelectedVendor(vendor)
    setIsModalOpen(true)
  }

  const handleModalClose = () => {
    setIsModalOpen(false)
    setSelectedVendor(null)
  }

  const handleUpdate = () => {
    fetchVendors()
    setSelectedIds(new Set()) // Clear selection after update
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === vendors.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(vendors.map((v) => v.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleDeleteSingle = async (vendor: VendorLead) => {
    if (!confirm(`Delete ${vendor.vendorName}? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/vendor-leads/${vendor.id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete vendor")
      }

      toast.success(`${vendor.vendorName} deleted successfully`)
      fetchVendors()
    } catch (error) {
      console.error("Error deleting vendor:", error)
      toast.error("Failed to delete vendor")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    if (!confirm(`Delete ${selectedIds.size} vendor${selectedIds.size > 1 ? "s" : ""}? This cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const deletePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/vendor-leads/${id}`, { method: "DELETE" })
      )

      const results = await Promise.all(deletePromises)
      const failedCount = results.filter((r) => !r.ok).length

      if (failedCount > 0) {
        toast.error(`Failed to delete ${failedCount} vendor${failedCount > 1 ? "s" : ""}`)
      } else {
        toast.success(`${selectedIds.size} vendor${selectedIds.size > 1 ? "s" : ""} deleted successfully`)
      }

      setSelectedIds(new Set())
      fetchVendors()
    } catch (error) {
      console.error("Error bulk deleting vendors:", error)
      toast.error("Failed to delete vendors")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleBulkCalculateBMV = async () => {
    if (selectedIds.size === 0) return

    setIsCalculating(true)
    try {
      const calculatePromises = Array.from(selectedIds).map((id) =>
        fetch(`/api/vendor-leads/${id}/calculate-bmv`, { method: "POST" })
      )

      const results = await Promise.all(calculatePromises)
      const failedCount = results.filter((r) => !r.ok).length
      const successCount = results.length - failedCount

      if (failedCount > 0) {
        toast.warning(`Calculated ${successCount} vendor${successCount !== 1 ? "s" : ""}, ${failedCount} failed`)
      } else {
        toast.success(`BMV calculated for ${successCount} vendor${successCount !== 1 ? "s" : ""}`)
      }

      fetchVendors()
    } catch (error) {
      console.error("Error bulk calculating BMV:", error)
      toast.error("Failed to calculate BMV")
    } finally {
      setIsCalculating(false)
    }
  }

  const formatStageName = (stage: string) => {
    // Convert to title case with proper formatting
    return stage
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ')
  }

  const getStatusBadge = (pipelineStage: string) => {
    const stageColors: Record<string, string> = {
      NEW_LEAD: "bg-slate-100 text-slate-800 border-slate-300",
      INITIAL_CONTACT: "bg-blue-100 text-blue-800 border-blue-300",
      AI_CONVERSATION: "bg-cyan-100 text-cyan-800 border-cyan-300",
      DEAL_VALIDATION: "bg-indigo-100 text-indigo-800 border-indigo-300",
      VALUATION_PENDING: "bg-violet-100 text-violet-800 border-violet-300",
      VALUATION_COMPLETE: "bg-purple-100 text-purple-800 border-purple-300",
      OFFER_PREPARATION: "bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300",
      OFFER_SENT: "bg-pink-100 text-pink-800 border-pink-300",
      NEGOTIATION: "bg-amber-100 text-amber-800 border-amber-300",
      OFFER_ACCEPTED: "bg-lime-100 text-lime-800 border-lime-300",
      SOLICITOR_INSTRUCTED: "bg-green-100 text-green-800 border-green-300",
      LOCKOUT_SIGNED: "bg-emerald-100 text-emerald-800 border-emerald-300",
      COMPLETION_PENDING: "bg-teal-100 text-teal-800 border-teal-300",
      COMPLETED: "bg-green-200 text-green-900 border-green-400 font-bold",
      REJECTED: "bg-red-100 text-red-800 border-red-300",
      WITHDRAWN: "bg-gray-100 text-gray-800 border-gray-300",
      UNQUALIFIED: "bg-orange-100 text-orange-800 border-orange-300",
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium border ${stageColors[pipelineStage] || "bg-gray-100 text-gray-800 border-gray-300"}`}>
        {formatStageName(pipelineStage)}
      </span>
    )
  }

  const getBMVBadge = (bmvScore: number | null) => {
    if (!bmvScore) return null
    const score = Number(bmvScore)
    if (score >= 25) {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <TrendingUp className="h-3 w-3 mr-1" />
          {score.toFixed(1)}% BMV
        </Badge>
      )
    } else if (score >= 15) {
      return (
        <Badge variant="default" className="bg-blue-600 text-white">
          <TrendingUp className="h-3 w-3 mr-1" />
          {score.toFixed(1)}% BMV
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-gray-400 text-gray-600">
          <TrendingUp className="h-3 w-3 mr-1" />
          {score.toFixed(1)}% BMV
        </Badge>
      )
    }
  }

  const getValidationBadge = (vendor: VendorLead) => {
    if (vendor.bmvScore === null) {
      return (
        <Badge variant="outline" className="border-amber-400 text-amber-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          Not Calculated
        </Badge>
      )
    }
    if (vendor.validationPassed) {
      return (
        <Badge variant="default" className="bg-green-600 text-white">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Validated
        </Badge>
      )
    } else {
      return (
        <Badge variant="outline" className="border-red-400 text-red-700">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      )
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-muted-foreground">Loading vendors...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">
                {selectedIds.size} vendor{selectedIds.size > 1 ? "s" : ""} selected
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedIds(new Set())}
              >
                Clear Selection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkCalculateBMV}
                disabled={isCalculating}
                className="border-green-300 bg-green-50 hover:bg-green-100"
              >
                {isCalculating ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TrendingUp className="h-4 w-4 mr-2" />
                )}
                Calculate BMV
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 mr-2" />
                )}
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendor Pipeline</CardTitle>
              <CardDescription>
                Track vendor leads through the acquisition pipeline ({vendors.length} total)
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by stage" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stages</SelectItem>
                <SelectItem value="NEW_LEAD">New Lead</SelectItem>
                <SelectItem value="INITIAL_CONTACT">Initial Contact</SelectItem>
                <SelectItem value="AI_CONVERSATION">AI Conversation</SelectItem>
                <SelectItem value="DEAL_VALIDATION">Deal Validation</SelectItem>
                <SelectItem value="VALUATION_PENDING">Valuation Pending</SelectItem>
                <SelectItem value="VALUATION_COMPLETE">Valuation Complete</SelectItem>
                <SelectItem value="OFFER_PREPARATION">Offer Preparation</SelectItem>
                <SelectItem value="OFFER_SENT">Offer Sent</SelectItem>
                <SelectItem value="NEGOTIATION">Negotiation</SelectItem>
                <SelectItem value="OFFER_ACCEPTED">Offer Accepted</SelectItem>
                <SelectItem value="SOLICITOR_INSTRUCTED">Solicitor Instructed</SelectItem>
                <SelectItem value="LOCKOUT_SIGNED">Lockout Signed</SelectItem>
                <SelectItem value="COMPLETION_PENDING">Completion Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="WITHDRAWN">Withdrawn</SelectItem>
                <SelectItem value="UNQUALIFIED">Unqualified</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No vendor leads found</p>
              <p className="text-sm mt-2">
                {statusFilter !== "all"
                  ? `No vendor leads in stage "${statusFilter.replace(/_/g, " ")}"`
                  : "Vendor leads from the pipeline will appear here"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === vendors.length && vendors.length > 0}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Pipeline Stage</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead>Price / Motivation</TableHead>
                  <TableHead>Messages / Offer</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => {
                  return (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(vendor.id)}
                          onCheckedChange={() => toggleSelect(vendor.id)}
                          aria-label={`Select ${vendor.vendorName}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendor.vendorName}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {vendor.leadSource ? `Source: ${vendor.leadSource.replace(/_/g, " ")}` : "Direct"}
                          </div>
                          {vendor.lastContactAt && (
                            <div className="text-xs text-muted-foreground">
                              Last contact: {new Date(vendor.lastContactAt).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {vendor.vendorPhone}
                          </div>
                          {vendor.vendorEmail && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3" />
                              {vendor.vendorEmail}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vendor.pipelineStage)}</TableCell>
                      <TableCell>
                        <div>
                          {vendor.propertyAddress ? (
                            <>
                              <div className="text-sm font-medium">{vendor.propertyAddress}</div>
                              {vendor.propertyPostcode && (
                                <div className="text-xs text-muted-foreground">{vendor.propertyPostcode}</div>
                              )}
                              {vendor.condition && (
                                <div className="text-xs text-muted-foreground capitalize mt-1">
                                  Condition: {vendor.condition.replace(/_/g, " ")}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-medium">{formatCurrency(vendor.askingPrice)}</div>
                          <div className="flex flex-wrap gap-1">
                            {getBMVBadge(vendor.bmvScore)}
                            {getValidationBadge(vendor)}
                          </div>
                          {vendor.motivationScore !== null && (
                            <div className="text-xs">
                              <span className={`font-medium ${vendor.motivationScore >= 7 ? "text-green-600" : vendor.motivationScore >= 5 ? "text-yellow-600" : "text-red-600"}`}>
                                Motivation: {vendor.motivationScore}/10
                              </span>
                            </div>
                          )}
                          {vendor.urgencyLevel && (
                            <div className="text-xs text-muted-foreground capitalize">
                              {vendor.urgencyLevel}
                              {vendor.timelineDays && ` (${vendor.timelineDays}d)`}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm space-y-1">
                          <div>
                            <span className="font-medium">{vendor._count.smsMessages}</span> messages
                          </div>
                          {vendor.offerAmount ? (
                            <>
                              <div className="font-medium">
                                {formatCurrency(vendor.offerAmount)}
                              </div>
                              {vendor.offerSentAt && (
                                <div className="text-xs text-muted-foreground">
                                  Sent: {new Date(vendor.offerSentAt).toLocaleDateString()}
                                </div>
                              )}
                              {vendor.offerAcceptedAt && (
                                <div className="text-xs text-green-600">
                                  Accepted: {new Date(vendor.offerAcceptedAt).toLocaleDateString()}
                                </div>
                              )}
                              {vendor.offerRejectedAt && (
                                <div className="text-xs text-red-600">
                                  Rejected: {new Date(vendor.offerRejectedAt).toLocaleDateString()}
                                </div>
                              )}
                              {vendor.retryCount > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  Retries: {vendor.retryCount}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="text-xs text-muted-foreground">No offer yet</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewDetails(vendor)}
                          >
                            View Details
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSingle(vendor)}
                            disabled={isDeleting}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedVendor && (
        <VendorLeadDetailModal
          lead={selectedVendor as any}
          open={isModalOpen}
          onOpenChange={handleModalClose}
          onUpdate={handleUpdate}
        />
      )}
    </div>
  )
}

