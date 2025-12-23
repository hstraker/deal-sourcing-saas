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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { VendorForm } from "./vendor-form"
import { Plus, Edit, Phone, Mail, Building2, ExternalLink } from "lucide-react"
import Link from "next/link"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface Vendor {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  address: string | null
  source: string
  facebookAdId: string | null
  status: string
  askingPrice: number | null
  propertyAddress: string | null
  dealId: string | null
  deal: {
    id: string
    address: string
    askingPrice: number
    status: string
  } | null
  createdAt: string
  _count: {
    offers: number
    aiConversations: number
  }
  offers: Array<{
    id: string
    offerAmount: number
    status: string
  }>
}

export function VendorList() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const fetchVendors = async () => {
    try {
      const url = statusFilter === "all" ? "/api/vendors" : `/api/vendors?status=${statusFilter}`
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

  const handleCreate = () => {
    setEditingVendor(null)
    setIsFormOpen(true)
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingVendor(null)
    fetchVendors()
  }

  const handleFormCancel = () => {
    setIsFormOpen(false)
    setEditingVendor(null)
  }

  const formatCurrency = (amount: number | null) => {
    if (!amount) return "—"
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const getStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      contacted: "bg-blue-100 text-blue-800",
      validated: "bg-green-100 text-green-800",
      offer_made: "bg-yellow-100 text-yellow-800",
      offer_accepted: "bg-emerald-100 text-emerald-800",
      offer_rejected: "bg-red-100 text-red-800",
      negotiating: "bg-purple-100 text-purple-800",
      locked_out: "bg-indigo-100 text-indigo-800",
      withdrawn: "bg-gray-100 text-gray-800",
    }

    return (
      <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusColors[status] || "bg-gray-100 text-gray-800"}`}>
        {status.replace("_", " ")}
      </span>
    )
  }

  const getLatestOffer = (vendor: Vendor) => {
    if (vendor.offers && vendor.offers.length > 0) {
      return vendor.offers[0]
    }
    return null
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vendors</CardTitle>
              <CardDescription>
                Manage property vendors and track offers ({vendors.length} total)
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="contacted">Contacted</SelectItem>
                  <SelectItem value="validated">Validated</SelectItem>
                  <SelectItem value="offer_made">Offer Made</SelectItem>
                  <SelectItem value="offer_accepted">Offer Accepted</SelectItem>
                  <SelectItem value="negotiating">Negotiating</SelectItem>
                  <SelectItem value="locked_out">Locked Out</SelectItem>
                </SelectContent>
              </Select>
              <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingVendor ? "Edit Vendor" : "Create New Vendor"}
                    </DialogTitle>
                    <DialogDescription>
                      {editingVendor
                        ? "Update vendor information"
                        : "Add a new vendor to the system"}
                    </DialogDescription>
                  </DialogHeader>
                  <VendorForm
                    vendor={editingVendor || undefined}
                    onSuccess={handleFormSuccess}
                    onCancel={handleFormCancel}
                  />
                </DialogContent>
              </Dialog>
              <Button onClick={handleCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Vendor
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {vendors.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Building2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No vendors found</p>
              <p className="text-sm mt-2">
                {statusFilter !== "all"
                  ? `No vendors with status "${statusFilter}"`
                  : "Get started by creating your first vendor"}
              </p>
              {statusFilter === "all" && (
                <Button onClick={handleCreate} className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Vendor
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Asking Price</TableHead>
                  <TableHead>Offers</TableHead>
                  <TableHead>Latest Offer</TableHead>
                  <TableHead>Deal</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => {
                  const latestOffer = getLatestOffer(vendor)
                  const vendorName = [vendor.firstName, vendor.lastName]
                    .filter(Boolean)
                    .join(" ") || "Unknown"

                  return (
                    <TableRow key={vendor.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{vendorName}</div>
                          {vendor.propertyAddress && (
                            <div className="text-sm text-muted-foreground">
                              {vendor.propertyAddress}
                            </div>
                          )}
                          <div className="text-xs text-muted-foreground mt-1">
                            Source: {vendor.source.replace("_", " ")}
                            {vendor.facebookAdId && ` • Ad: ${vendor.facebookAdId}`}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="h-3 w-3" />
                            {vendor.phone}
                          </div>
                          {vendor.email && (
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-3 w-3" />
                              {vendor.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                      <TableCell>{formatCurrency(vendor.askingPrice)}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{vendor._count.offers}</div>
                          <div className="text-xs text-muted-foreground">
                            {vendor._count.aiConversations} conversations
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {latestOffer ? (
                          <div>
                            <div className="font-medium">
                              {formatCurrency(latestOffer.offerAmount)}
                            </div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {latestOffer.status.replace("_", " ")}
                            </div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {vendor.deal ? (
                          <Link
                            href={`/dashboard/deals/${vendor.deal.id}`}
                            className="flex items-center gap-1 text-sm text-primary hover:underline"
                          >
                            {vendor.deal.address}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        ) : (
                          <span className="text-muted-foreground text-sm">No deal</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {vendor.deal ? (
                            <Link href={`/dashboard/deals/${vendor.deal.id}`}>
                              <Button variant="outline" size="sm">
                                View Deal
                              </Button>
                            </Link>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(vendor)}
                          >
                            <Edit className="h-4 w-4" />
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
    </div>
  )
}

