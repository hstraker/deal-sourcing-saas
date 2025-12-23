"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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

const investorSchema = z.object({
  email: z.string().email("Invalid email address"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().optional(),
  minBudget: z.number().positive().optional().nullable(),
  maxBudget: z.number().positive().optional().nullable(),
  preferredAreas: z.string().optional(), // Comma-separated for input
  strategy: z.array(z.string()).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "advanced"]).optional().nullable(),
  financingStatus: z.enum(["cash", "mortgage", "both"]).optional().nullable(),
  emailAlerts: z.boolean().default(true),
  smsAlerts: z.boolean().default(false),
})

type InvestorFormData = z.infer<typeof investorSchema>

interface Investor {
  id: string
  user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
    phone: string | null
  }
  minBudget: number | null
  maxBudget: number | null
  preferredAreas: string[]
  strategy: string[]
  experienceLevel: string | null
  financingStatus: string | null
  emailAlerts: boolean
  smsAlerts: boolean
}

interface InvestorFormProps {
  investor?: Investor
  onSuccess: () => void
  onCancel: () => void
}

export function InvestorForm({ investor, onSuccess, onCancel }: InvestorFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStrategies, setSelectedStrategies] = useState<string[]>(
    investor?.strategy || []
  )

  const isEditMode = !!investor

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<InvestorFormData>({
    resolver: zodResolver(investorSchema),
    defaultValues: investor
      ? {
          email: investor.user.email,
          firstName: investor.user.firstName || "",
          lastName: investor.user.lastName || "",
          phone: investor.user.phone || "",
          minBudget: investor.minBudget || null,
          maxBudget: investor.maxBudget || null,
          preferredAreas: investor.preferredAreas?.join(", ") || "",
          strategy: investor.strategy || [],
          experienceLevel: investor.experienceLevel as any || null,
          financingStatus: investor.financingStatus as any || null,
          emailAlerts: investor.emailAlerts,
          smsAlerts: investor.smsAlerts,
        }
      : {
          emailAlerts: true,
          smsAlerts: false,
        },
  })

  const experienceLevel = watch("experienceLevel")
  const financingStatus = watch("financingStatus")

  const toggleStrategy = (strategy: string) => {
    const newStrategies = selectedStrategies.includes(strategy)
      ? selectedStrategies.filter((s) => s !== strategy)
      : [...selectedStrategies, strategy]
    setSelectedStrategies(newStrategies)
    setValue("strategy", newStrategies)
  }

  const onSubmit = async (data: InvestorFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditMode) {
        // Update existing investor
        const preferredAreasArray = data.preferredAreas
          ? data.preferredAreas.split(",").map((a) => a.trim()).filter(Boolean)
          : []

        const response = await fetch(`/api/investors/${investor.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            preferredAreas: preferredAreasArray,
            strategy: selectedStrategies,
            phone: data.phone || undefined,
            minBudget: data.minBudget || null,
            maxBudget: data.maxBudget || null,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || "Failed to update investor")
        }
      } else {
        // Create new investor (create user first, then investor)
        const preferredAreasArray = data.preferredAreas
          ? data.preferredAreas.split(",").map((a) => a.trim()).filter(Boolean)
          : []

        // First create the user
        const userResponse = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || undefined,
            role: "investor",
            password: "TempPassword123!", // Temporary password - should be reset
          }),
        })

        if (!userResponse.ok) {
          const errorData = await userResponse.json()
          throw new Error(errorData.error || "Failed to create user")
        }

        const user = await userResponse.json()

        // Then create the investor profile
        const investorResponse = await fetch("/api/investors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            minBudget: data.minBudget || null,
            maxBudget: data.maxBudget || null,
            preferredAreas: preferredAreasArray,
            strategy: selectedStrategies,
            experienceLevel: data.experienceLevel,
            financingStatus: data.financingStatus,
            emailAlerts: data.emailAlerts,
            smsAlerts: data.smsAlerts,
          }),
        })

        if (!investorResponse.ok) {
          const errorData = await investorResponse.json()
          throw new Error(errorData.error || "Failed to create investor")
        }
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

      {/* Personal Information */}
      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name *</Label>
              <Input id="firstName" {...register("firstName")} required />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name *</Label>
              <Input id="lastName" {...register("lastName")} required />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input id="email" type="email" {...register("email")} required />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" {...register("phone")} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Criteria */}
      <Card>
        <CardHeader>
          <CardTitle>Investment Criteria</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="minBudget">Min Budget (£)</Label>
              <Input
                id="minBudget"
                type="number"
                step="1000"
                {...register("minBudget", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxBudget">Max Budget (£)</Label>
              <Input
                id="maxBudget"
                type="number"
                step="1000"
                {...register("maxBudget", { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="preferredAreas">Preferred Areas</Label>
            <Input
              id="preferredAreas"
              {...register("preferredAreas")}
              placeholder="e.g., London, Manchester, Birmingham"
            />
            <p className="text-xs text-muted-foreground">
              Enter areas separated by commas
            </p>
          </div>

          <div className="space-y-2">
            <Label>Investment Strategy</Label>
            <div className="flex flex-wrap gap-2">
              {["BRRRR", "BTL", "Flip"].map((strategy) => (
                <button
                  key={strategy}
                  type="button"
                  onClick={() => toggleStrategy(strategy)}
                  className={`px-3 py-1 rounded-md text-sm border transition-colors ${
                    selectedStrategies.includes(strategy)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-muted"
                  }`}
                >
                  {strategy}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="experienceLevel">Experience Level</Label>
              <Select
                value={experienceLevel || ""}
                onValueChange={(value) => setValue("experienceLevel", value as any)}
              >
                <SelectTrigger id="experienceLevel">
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="financingStatus">Financing Status</Label>
              <Select
                value={financingStatus || ""}
                onValueChange={(value) => setValue("financingStatus", value as any)}
              >
                <SelectTrigger id="financingStatus">
                  <SelectValue placeholder="Select financing status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="mortgage">Mortgage</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Communication Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="emailAlerts"
              {...register("emailAlerts")}
              className="rounded"
            />
            <Label htmlFor="emailAlerts">Email Alerts</Label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="smsAlerts"
              {...register("smsAlerts")}
              className="rounded"
            />
            <Label htmlFor="smsAlerts">SMS Alerts</Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Update Investor" : "Create Investor"}
        </Button>
      </div>
    </form>
  )
}

