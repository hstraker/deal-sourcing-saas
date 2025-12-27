"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, User, Phone, Mail, MapPin, FileText } from "lucide-react"
import { VendorForm } from "./vendor-form"
import { VendorOffers } from "./vendor-offers"
import { VendorConversations } from "./vendor-conversations"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { formatCurrency } from "@/lib/format"

interface Vendor {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  address: string | null
  source: string
  facebookAdId: string | null
  campaignId: string | null
  askingPrice: number | null
  propertyAddress: string | null
  reasonForSale: string | null
  status: string
  solicitorName: string | null
  solicitorEmail: string | null
  solicitorPhone: string | null
  notes: string | null
  dealId: string | null
  createdAt: string
  updatedAt: string
  _count?: {
    offers: number
    aiConversations: number
  }
}

interface VendorSectionProps {
  dealId: string
  vendorId?: string | null
}

export function VendorSection({ dealId, vendorId }: VendorSectionProps) {
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)

  const fetchVendor = async () => {
    if (!vendorId) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch(`/api/vendors/${vendorId}`)
      if (!response.ok) throw new Error("Failed to fetch vendor")
      const data = await response.json()
      setVendor(data)
    } catch (err) {
      console.error("Error fetching vendor:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVendor()
  }, [vendorId])

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setIsEditing(false)
    fetchVendor()
  }

  const handleFormCancel = () => {
    setIsFormOpen(false)
    setIsEditing(false)
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

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  if (!vendor) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Vendor Information</CardTitle>
          <CardDescription>No vendor assigned to this deal</CardDescription>
        </CardHeader>
        <CardContent>
          <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Vendor</DialogTitle>
                <DialogDescription>
                  Add vendor information for this deal
                </DialogDescription>
              </DialogHeader>
              <VendorForm
                dealId={dealId}
                onSuccess={handleFormSuccess}
                onCancel={handleFormCancel}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={() => setIsFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Vendor Information</CardTitle>
            <CardDescription>
              {vendor.firstName || vendor.lastName
                ? `${vendor.firstName || ""} ${vendor.lastName || ""}`.trim()
                : "Vendor Details"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(vendor.status)}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{isEditing ? "Edit Vendor" : "Create Vendor"}</DialogTitle>
                  <DialogDescription>
                    {isEditing ? "Update vendor information" : "Add vendor information for this deal"}
                  </DialogDescription>
                </DialogHeader>
                <VendorForm
                  vendor={vendor}
                  dealId={dealId}
                  onSuccess={handleFormSuccess}
                  onCancel={handleFormCancel}
                />
              </DialogContent>
            </Dialog>
            <Button variant="outline" size="sm" onClick={() => {
              setIsEditing(true)
              setIsFormOpen(true)
            }}>
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Phone className="h-4 w-4" />
                  Phone
                </div>
                <p className="font-medium">{vendor.phone}</p>
              </div>
              {vendor.email && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Mail className="h-4 w-4" />
                    Email
                  </div>
                  <p className="font-medium">{vendor.email}</p>
                </div>
              )}
              {vendor.address && (
                <div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <MapPin className="h-4 w-4" />
                    Address
                  </div>
                  <p className="font-medium">{vendor.address}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">Source</div>
                <p className="font-medium capitalize">{vendor.source.replace("_", " ")}</p>
                {vendor.facebookAdId && (
                  <p className="text-xs text-muted-foreground">Ad ID: {vendor.facebookAdId}</p>
                )}
              </div>
              {vendor.askingPrice && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Asking Price</div>
                  <p className="font-medium">{formatCurrency(vendor.askingPrice)}</p>
                </div>
              )}
              {vendor.propertyAddress && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Property Address</div>
                  <p className="font-medium">{vendor.propertyAddress}</p>
                </div>
              )}
            </div>
          </div>

          {vendor.solicitorName && (
            <div className="mt-4 pt-4 border-t">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <FileText className="h-4 w-4" />
                Solicitor Details
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Name: </span>
                  <span className="font-medium">{vendor.solicitorName}</span>
                </div>
                {vendor.solicitorEmail && (
                  <div>
                    <span className="text-muted-foreground">Email: </span>
                    <span className="font-medium">{vendor.solicitorEmail}</span>
                  </div>
                )}
                {vendor.solicitorPhone && (
                  <div>
                    <span className="text-muted-foreground">Phone: </span>
                    <span className="font-medium">{vendor.solicitorPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {vendor.notes && (
            <div className="mt-4 pt-4 border-t">
              <div className="text-sm text-muted-foreground mb-1">Notes</div>
              <p className="text-sm whitespace-pre-wrap">{vendor.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="offers" className="w-full">
        <TabsList>
          <TabsTrigger value="offers">
            Offers ({vendor._count?.offers || 0})
          </TabsTrigger>
          <TabsTrigger value="conversations">
            Conversations ({vendor._count?.aiConversations || 0})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="offers">
          <VendorOffers vendorId={vendor.id} dealId={vendor.dealId} />
        </TabsContent>
        <TabsContent value="conversations">
          <VendorConversations vendorId={vendor.id} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

