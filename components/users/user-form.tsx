"use client"

import { useState, useEffect } from "react"
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
import { ProfilePictureUpload } from "./profile-picture-upload"
import { createUserSchema, updateUserSchema, type CreateUserFormData, type UpdateUserFormData } from "@/lib/validations/user"
import { Loader2 } from "lucide-react"

interface User {
  id: string
  email: string
  role: "admin" | "sourcer" | "investor"
  firstName: string | null
  lastName: string | null
  phone: string | null
  profilePictureS3Key: string | null
  isActive: boolean
}

interface UserFormProps {
  user?: User
  onSuccess: () => void
  onCancel: () => void
}

export function UserForm({ user, onSuccess, onCancel }: UserFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profilePictureS3Key, setProfilePictureS3Key] = useState<string | null>(
    user?.profilePictureS3Key || null
  )

  const isEditMode = !!user
  const schema = isEditMode ? updateUserSchema : createUserSchema

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CreateUserFormData | UpdateUserFormData>({
    resolver: zodResolver(schema),
    defaultValues: user
      ? {
          email: user.email,
          role: user.role,
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          phone: user.phone || "",
          isActive: user.isActive,
        }
      : {
          role: "sourcer",
          isActive: true,
        },
  })

  const role = watch("role")
  const isActive = watch("isActive")

  const onSubmit = async (data: CreateUserFormData | UpdateUserFormData) => {
    setIsSubmitting(true)
    setError(null)

    try {
      const url = isEditMode ? `/api/users/${user.id}` : "/api/users"
      const method = isEditMode ? "PUT" : "POST"

      // Remove empty password from update if not provided
      const submitData = { ...data }
      if (isEditMode && !submitData.password) {
        delete (submitData as any).password
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
        throw new Error(errorData.error || "Failed to save user")
      }

      onSuccess()
    } catch (error) {
      console.error("Error saving user:", error)
      setError(error instanceof Error ? error.message : "Failed to save user")
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

      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a profile picture for this user</CardDescription>
        </CardHeader>
        <CardContent>
          {user && (
            <ProfilePictureUpload
              userId={user.id}
              currentS3Key={profilePictureS3Key}
              onUploadComplete={(s3Key) => setProfilePictureS3Key(s3Key)}
              onRemove={() => setProfilePictureS3Key(null)}
            />
          )}
          {!user && (
            <p className="text-sm text-muted-foreground">
              Profile picture can be uploaded after creating the user.
            </p>
          )}
        </CardContent>
      </Card>

      {/* User Details */}
      <Card>
        <CardHeader>
          <CardTitle>User Details</CardTitle>
          <CardDescription>
            {isEditMode ? "Update user information" : "Create a new user account"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...register("firstName")}
                placeholder="John"
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...register("lastName")}
                placeholder="Doe"
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="user@example.com"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              type="tel"
              {...register("phone")}
              placeholder="+44 7700 900000"
            />
            {errors.phone && (
              <p className="text-sm text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={role}
                onValueChange={(value) => setValue("role", value as "admin" | "sourcer" | "investor")}
              >
                <SelectTrigger id="role">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="sourcer">Sourcer</SelectItem>
                  <SelectItem value="investor">Investor</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="isActive">Status</Label>
              <Select
                value={isActive ? "active" : "inactive"}
                onValueChange={(value) => setValue("isActive", value === "active")}
              >
                <SelectTrigger id="isActive">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {isEditMode ? "New Password (leave blank to keep current)" : "Password *"}
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder={isEditMode ? "Enter new password" : "Minimum 8 characters"}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditMode ? "Update User" : "Create User"}
        </Button>
      </div>
    </form>
  )
}

