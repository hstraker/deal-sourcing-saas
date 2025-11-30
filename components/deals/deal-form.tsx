"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
import { dealSchema, type DealFormData } from "@/lib/validations/deal"
import { DealMetricsPreview } from "./deal-metrics-preview"
import { PropertyDataFetcher } from "./property-data-fetcher"

interface DealFormProps {
  initialData?: Partial<DealFormData>
  dealId?: string
  onSubmit?: (data: DealFormData) => Promise<void>
}

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  role: string
}

export function DealForm({ initialData, dealId, onSubmit }: DealFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])

  // Fetch team members
  useEffect(() => {
    const fetchTeamMembers = async () => {
      try {
        const response = await fetch("/api/users/team")
        if (response.ok) {
          const members = await response.json()
          setTeamMembers(members)
          console.log("Team members loaded:", members.length)
        } else {
          console.error("Failed to fetch team members:", response.status, response.statusText)
        }
      } catch (error) {
        console.error("Failed to fetch team members:", error)
      }
    }
    fetchTeamMembers()
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<DealFormData>({
    resolver: zodResolver(dealSchema),
    defaultValues: initialData || {
      status: "new",
      dataSource: "manual",
      assignedToId: null,
    },
  })

  const propertyType = watch("propertyType")
  const status = watch("status")
  const dataSource = watch("dataSource")
  const askingPrice = watch("askingPrice")
  const marketValue = watch("marketValue")
  const estimatedRefurbCost = watch("estimatedRefurbCost")
  const afterRefurbValue = watch("afterRefurbValue")
  const estimatedMonthlyRent = watch("estimatedMonthlyRent")
  const bedrooms = watch("bedrooms")
  const postcode = watch("postcode")
  const assignedToId = watch("assignedToId")

  const onSubmitForm = async (data: DealFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      // Clean up NaN values from number inputs
      const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
        if (typeof value === "number" && Number.isNaN(value)) {
          acc[key] = null
        } else {
          acc[key] = value
        }
        return acc
      }, {} as any)

      if (onSubmit) {
        await onSubmit(cleanData)
        // Navigate to deal detail page after successful update
        if (dealId) {
          router.push(`/dashboard/deals/${dealId}`)
          router.refresh()
        }
      } else if (dealId) {
        // Edit mode - PUT request
        const response = await fetch(`/api/deals/${dealId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cleanData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to update deal")
        }

        const updated = await response.json()
        router.push(`/dashboard/deals/${updated.id}`)
        router.refresh()
      } else {
        // Create mode - POST request
        const response = await fetch("/api/deals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(cleanData),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to create deal")
        }

        const deal = await response.json()
        router.push(`/dashboard/deals/${deal.id}`)
        router.refresh()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-6">
      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Property Data Enrichment */}
      <PropertyDataFetcher
        address={watch("address") || ""}
        postcode={watch("postcode") || null}
        onDataFetched={(data) => {
          console.log("[DealForm] onDataFetched called with:", data)
          
          // Populate address first
          if (data.address) {
            console.log(`[DealForm] Setting address to: ${data.address}`)
            setValue("address", data.address)
          }
          
          // Populate postcode
          if (data.postcode) {
            console.log(`[DealForm] Setting postcode to: ${data.postcode}`)
            setValue("postcode", data.postcode)
          }
          
          // Populate bedrooms
          if (data.bedrooms !== undefined) {
            console.log(`[DealForm] Setting bedrooms to: ${data.bedrooms}`)
            setValue("bedrooms", data.bedrooms)
          }
          
          // Populate bathrooms
          if (data.bathrooms !== undefined) {
            console.log(`[DealForm] Setting bathrooms to: ${data.bathrooms}`)
            setValue("bathrooms", data.bathrooms)
          }
          
          // Populate square feet
          if (data.squareFeet !== undefined) {
            console.log(`[DealForm] Setting squareFeet to: ${data.squareFeet}`)
            setValue("squareFeet", data.squareFeet)
          }
          
          // Populate property type
          if (data.propertyType) {
            console.log(`[DealForm] Setting propertyType to: ${data.propertyType}`)
            setValue("propertyType", data.propertyType as any)
          }
          
          // Populate market value (also set as asking price if not already set)
          if (data.marketValue !== undefined) {
            console.log(`[DealForm] Setting marketValue to: ${data.marketValue}`)
            setValue("marketValue", data.marketValue)
            // Also set asking price if it's not already set
            const currentAskingPrice = watch("askingPrice")
            if (!currentAskingPrice && data.marketValue) {
              console.log(`[DealForm] Setting askingPrice to: ${data.marketValue}`)
              setValue("askingPrice", data.marketValue)
            }
          }
          
          // Populate estimated monthly rent
          if (data.estimatedMonthlyRent !== undefined) {
            console.log(`[DealForm] Setting estimatedMonthlyRent to: ${data.estimatedMonthlyRent}`)
            setValue("estimatedMonthlyRent", data.estimatedMonthlyRent)
          }
        }}
      />

      {/* Property Details */}
      <Card>
        <CardHeader>
          <CardTitle>Property Details</CardTitle>
          <CardDescription>Basic information about the property</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="address">Address *</Label>
            <Input
              id="address"
              {...register("address")}
              placeholder="123 High Street, Neath SA11"
            />
            {errors.address && (
              <p className="text-sm text-destructive">{errors.address.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                {...register("postcode")}
                placeholder="SA11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="propertyType">Property Type</Label>
              <Select
                value={propertyType || ""}
                onValueChange={(value) => setValue("propertyType", value as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="terraced">Terraced</SelectItem>
                  <SelectItem value="semi">Semi-Detached</SelectItem>
                  <SelectItem value="detached">Detached</SelectItem>
                  <SelectItem value="flat">Flat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                min="0"
                {...register("bedrooms", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                min="0"
                step="0.5"
                {...register("bathrooms", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="squareFeet">Square Feet</Label>
              <Input
                id="squareFeet"
                type="number"
                min="0"
                {...register("squareFeet", { valueAsNumber: true })}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Pricing</CardTitle>
          <CardDescription>Financial details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="askingPrice">Asking Price (£) *</Label>
            <Input
              id="askingPrice"
              type="number"
              step="0.01"
              min="0"
              {...register("askingPrice", { valueAsNumber: true })}
              placeholder="70000"
            />
            {errors.askingPrice && (
              <p className="text-sm text-destructive">{errors.askingPrice.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="marketValue">Market Value (£)</Label>
              <Input
                id="marketValue"
                type="number"
                step="0.01"
                min="0"
                {...register("marketValue", { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedRefurbCost">Estimated Refurb Cost (£)</Label>
              <Input
                id="estimatedRefurbCost"
                type="number"
                step="0.01"
                min="0"
                {...register("estimatedRefurbCost", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="afterRefurbValue">After Refurb Value (£)</Label>
              <Input
                id="afterRefurbValue"
                type="number"
                step="0.01"
                min="0"
                {...register("afterRefurbValue", { valueAsNumber: true })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="estimatedMonthlyRent">Estimated Monthly Rent (£)</Label>
              <Input
                id="estimatedMonthlyRent"
                type="number"
                step="0.01"
                min="0"
                {...register("estimatedMonthlyRent", { valueAsNumber: true })}
                placeholder="650"
              />
              <p className="text-xs text-muted-foreground">
                Used to calculate yield and ROI
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calculated Metrics Preview */}
      <DealMetricsPreview
        askingPrice={askingPrice}
        marketValue={marketValue}
        estimatedRefurbCost={estimatedRefurbCost}
        afterRefurbValue={afterRefurbValue}
        estimatedMonthlyRent={estimatedMonthlyRent}
        bedrooms={bedrooms}
        propertyType={propertyType}
        postcode={postcode}
      />

      {/* Deal Info */}
      <Card>
        <CardHeader>
          <CardTitle>Deal Information</CardTitle>
          <CardDescription>Status, source, and team assignment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={status || "new"}
                onValueChange={(value) => setValue("status", value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="review">Under Review</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="listed">Listed</SelectItem>
                  <SelectItem value="reserved">Reserved</SelectItem>
                  <SelectItem value="sold">Sold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataSource">Data Source</Label>
              <Select
                value={dataSource || "manual"}
                onValueChange={(value) => setValue("dataSource", value as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="propertydata">PropertyData</SelectItem>
                  <SelectItem value="rightmove">Rightmove</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="assignedToId">Assigned To</Label>
            {teamMembers.length === 0 ? (
              <div className="rounded-md border border-border bg-muted p-3 text-sm text-muted-foreground">
                No team members available. Create users in{" "}
                <a href="/dashboard/settings" className="text-primary underline">
                  Settings
                </a>{" "}
                to assign deals.
              </div>
            ) : (
              <Select
                value={assignedToId || "unassigned"}
                onValueChange={(value) => setValue("assignedToId", value === "unassigned" ? null : value)}
              >
                <SelectTrigger id="assignedToId">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {teamMembers.map((member) => {
                    const name = [member.firstName, member.lastName]
                      .filter(Boolean)
                      .join(" ") || member.email
                    return (
                      <SelectItem key={member.id} value={member.id}>
                        {name} {member.role === "admin" && "(Admin)"}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
            {errors.assignedToId && (
              <p className="text-sm text-destructive">{errors.assignedToId.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Information */}
      <Card>
        <CardHeader>
          <CardTitle>Agent Information</CardTitle>
          <CardDescription>Contact details for the listing agent</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="agentName">Agent Name</Label>
              <Input
                id="agentName"
                {...register("agentName")}
                placeholder="John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agentPhone">Agent Phone</Label>
              <Input
                id="agentPhone"
                type="tel"
                {...register("agentPhone")}
                placeholder="+44 1234 567890"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="listingUrl">Listing URL</Label>
            <Input
              id="listingUrl"
              type="url"
              {...register("listingUrl")}
              placeholder="https://..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? initialData
              ? "Updating..."
              : "Creating..."
            : initialData
            ? "Update Deal"
            : "Create Deal"}
        </Button>
      </div>
    </form>
  )
}

