"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { z } from "zod"

const vendorSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(1, "Phone is required"),
  address: z.string().optional(),
  source: z.string().default("facebook_ad"),
  facebookAdId: z.string().optional(),
  campaignId: z.string().optional(),
  askingPrice: z.number().positive().optional(),
  propertyAddress: z.string().optional(),
  reasonForSale: z.string().optional(),
  status: z.enum(["contacted", "validated", "offer_made", "offer_accepted", "offer_rejected", "negotiating", "locked_out", "withdrawn"]).optional(),
  solicitorName: z.string().optional(),
  solicitorEmail: z.string().email().optional().or(z.literal("")),
  solicitorPhone: z.string().optional(),
  notes: z.string().optional(),
  dealId: z.string().uuid().optional(),
})

type VendorFormData = z.infer<typeof vendorSchema>

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
}

interface VendorFormProps {
  vendor?: Vendor
  dealId?: string
  onSuccess: () => void
  onCancel: () => void
}

export function VendorForm({ vendor, dealId, onSuccess, onCancel }: VendorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditMode = !!vendor

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<VendorFormData>({
    resolver: zodResolver(vendorSchema),
    defaultValues: vendor
      ? {
          firstName: vendor.firstName || "",
          lastName: vendor.lastName || "",
          email: vendor.email || "",
          phone: vendor.phone,
          address: vendor.address || "",
          source: vendor.source,
          facebookAdId: vendor.facebookAdId || "",
          campaignId: vendor.campaignId || "",
          askingPrice: vendor.askingPrice ? Number(vendor.askingPrice) : undefined,
          propertyAddress: vendor.propertyAddress || "",
          reasonForSale: vendor.reasonForSale || "",
          status: vendor.status as any,
          solicitorName: vendor.solicitorName || "",
          solicitorEmail: vendor.solicitorEmail || "",
          solicitorPhone: vendor.solicitorPhone || "",
          notes: vendor.notes || "",
          dealId: vendor.dealId || dealId || "",
        }
      : {
          source: "facebook_ad",
          status: "contacted",
          dealId: dealId || "",
        },
  })

  const status = watch("status")

  const onSubmit = async (data: VendorFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditMode ? `/api/vendors/${vendor.id}` : "/api/vendors"
      const method = isEditMode ? "PUT" : "POST"

      // Convert empty strings to undefined for optional fields
      const submitData: any = {
        ...data,
        email: data.email || undefined,
        solicitorEmail: data.solicitorEmail || undefined,
        askingPrice: data.askingPrice || undefined,
        dealId: data.dealId || undefined,
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save vendor")
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle>Contact Information</CardTitle>
          <CardDescription>Vendor contact details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" {...register("firstName")} placeholder="John" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" {...register("lastName")} placeholder="Smith" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone *</Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+44 123 456 7890"
              required
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="vendor@example.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input id="address" {...register("address")} placeholder="123 Main St" />
          </div>
        </CardContent>
      </Card>

      {/* Source Information */}
      <Card>
        <CardHeader>
          <CardTitle>Source Information</CardTitle>
          <CardDescription>Where did this vendor come from?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="source">Source</Label>
            <Select
              value={watch("source")}
              onValueChange={(value) => setValue("source", value)}
            >
              <SelectTrigger id="source">
                <SelectValue placeholder="Select source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="facebook_ad">Facebook Ad</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="facebookAdId">Facebook Ad ID</Label>
              <Input
                id="facebookAdId"
                {...register("facebookAdId")}
                placeholder="123456789"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignId">Campaign ID</Label>
              <Input
                id="campaignId"
                {...register("campaignId")}
                placeholder="campaign_123"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>Property information from vendor</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="propertyAddress">Property Address</Label>
            <Input
              id="propertyAddress"
              {...register("propertyAddress")}
              placeholder="123 Property Street, City"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="askingPrice">Asking Price (£)</Label>
              <Input
                id="askingPrice"
                type="number"
                step="0.01"
                {...register("askingPrice", { valueAsNumber: true })}
                placeholder="100000"
              />
            </div>
            {isEditMode && (
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={status}
                  onValueChange={(value) => setValue("status", value as any)}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contacted">Contacted</SelectItem>
                    <SelectItem value="validated">Validated</SelectItem>
                    <SelectItem value="offer_made">Offer Made</SelectItem>
                    <SelectItem value="offer_accepted">Offer Accepted</SelectItem>
                    <SelectItem value="offer_rejected">Offer Rejected</SelectItem>
                    <SelectItem value="negotiating">Negotiating</SelectItem>
                    <SelectItem value="locked_out">Locked Out</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasonForSale">Reason for Sale</Label>
            <Textarea
              id="reasonForSale"
              {...register("reasonForSale")}
              placeholder="Why is the vendor selling?"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Legal Details */}
      {isEditMode && (
        <Card>
          <CardHeader>
            <CardTitle>Legal Details</CardTitle>
            <CardDescription>Solicitor information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="solicitorName">Solicitor Name</Label>
              <Input
                id="solicitorName"
                {...register("solicitorName")}
                placeholder="Solicitor Name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="solicitorEmail">Solicitor Email</Label>
                <Input
                  id="solicitorEmail"
                  type="email"
                  {...register("solicitorEmail")}
                  placeholder="solicitor@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="solicitorPhone">Solicitor Phone</Label>
                <Input
                  id="solicitorPhone"
                  {...register("solicitorPhone")}
                  placeholder="+44 123 456 7890"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              {...register("notes")}
              placeholder="Any additional information about this vendor..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Update Vendor" : "Create Vendor"}
        </Button>
      </div>
    </form>
  )
}

