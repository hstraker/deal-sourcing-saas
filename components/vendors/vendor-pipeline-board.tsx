"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Building2, Phone, Mail, ExternalLink } from "lucide-react"
import Link from "next/link"

interface Vendor {
  id: string
  firstName: string | null
  lastName: string | null
  email: string | null
  phone: string
  status: string
  askingPrice: number | null
  propertyAddress: string | null
  dealId: string | null
  deal: {
    id: string
    address: string
  } | null
  createdAt: string
  _count: {
    offers: number
    aiConversations: number
  }
}

type VendorStatus =
  | "contacted"
  | "validated"
  | "offer_made"
  | "offer_accepted"
  | "offer_rejected"
  | "negotiating"
  | "locked_out"
  | "withdrawn"

const STATUS_COLUMNS: Array<{
  id: VendorStatus
  title: string
  description: string
}> = [
  { id: "contacted", title: "Contacted", description: "Initial AI SMS sent" },
  { id: "validated", title: "Validated", description: "Deal validated, ready for offer" },
  { id: "offer_made", title: "Offer Made", description: "Offer submitted to vendor" },
  { id: "negotiating", title: "Negotiating", description: "Vendor requesting more info" },
  { id: "offer_accepted", title: "Accepted", description: "Vendor accepted offer" },
  { id: "locked_out", title: "Locked Out", description: "Lock-out agreement signed" },
  { id: "offer_rejected", title: "Rejected", description: "Vendor rejected offer" },
  { id: "withdrawn", title: "Withdrawn", description: "Vendor withdrew" },
]

const statusColors: Record<VendorStatus, string> = {
  contacted: "bg-blue-100 text-blue-800 border-l-blue-400",
  validated: "bg-green-100 text-green-800 border-l-green-400",
  offer_made: "bg-yellow-100 text-yellow-800 border-l-yellow-400",
  offer_accepted: "bg-emerald-100 text-emerald-800 border-l-emerald-400",
  offer_rejected: "bg-red-100 text-red-800 border-l-red-400",
  negotiating: "bg-purple-100 text-purple-800 border-l-purple-400",
  locked_out: "bg-indigo-100 text-indigo-800 border-l-indigo-400",
  withdrawn: "bg-gray-100 text-gray-800 border-l-gray-400",
}

export function VendorPipelineBoard() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchVendors = async () => {
    try {
      const response = await fetch("/api/vendors")
      if (!response.ok) throw new Error("Failed to fetch vendors")
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
  }, [])

  const groupVendorsByStatus = (vendors: Vendor[]) => {
    return STATUS_COLUMNS.reduce<Record<VendorStatus, Vendor[]>>((acc, column) => {
      acc[column.id] = vendors.filter((vendor) => vendor.status === column.id)
      return acc
    }, {} as Record<VendorStatus, Vendor[]>)
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading vendors...</div>
      </div>
    )
  }

  const vendorsByStatus = groupVendorsByStatus(vendors)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Vendor Pipeline</h2>
          <p className="text-muted-foreground">
            Track vendors through the workflow ({vendors.length} total)
          </p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUS_COLUMNS.map((column) => {
          const columnVendors = vendorsByStatus[column.id]

          return (
            <div key={column.id} className="flex-shrink-0 w-80">
              <div className="mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">{column.title}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                    {columnVendors.length}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {column.description}
                </p>
              </div>

              <div className="space-y-3">
                {columnVendors.map((vendor) => {
                  const vendorName = [vendor.firstName, vendor.lastName]
                    .filter(Boolean)
                    .join(" ") || "Unknown"

                  return (
                    <Card
                      key={vendor.id}
                      className={`cursor-pointer hover:shadow-md transition-shadow border-l-4 ${statusColors[vendor.status as VendorStatus] || "border-l-gray-400"}`}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="font-medium text-sm mb-1">{vendorName}</div>
                            {vendor.propertyAddress && (
                              <div className="text-xs text-muted-foreground mb-2">
                                {vendor.propertyAddress}
                              </div>
                            )}
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {vendor.phone}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between mt-3 pt-3 border-t">
                          <div className="space-y-1">
                            {vendor.askingPrice && (
                              <div className="text-xs">
                                <span className="text-muted-foreground">Asking: </span>
                                <span className="font-medium">
                                  {formatCurrency(vendor.askingPrice)}
                                </span>
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              {vendor._count.offers} offers • {vendor._count.aiConversations} conv.
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Added {formatDate(vendor.createdAt)}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t flex gap-2">
                          {vendor.deal ? (
                            <Link
                              href={`/dashboard/deals/${vendor.deal.id}`}
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="outline" size="sm" className="w-full">
                                <ExternalLink className="mr-2 h-3 w-3" />
                                View Deal
                              </Button>
                            </Link>
                          ) : (
                            <Link
                              href={`/dashboard/vendors`}
                              className="flex-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Button variant="ghost" size="sm" className="w-full">
                                View Details
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </Card>
                  )
                })}

                {columnVendors.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg">
                    No vendors in this stage
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

