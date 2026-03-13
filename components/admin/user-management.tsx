"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { UserPlus, Pencil, Trash2, Loader2, ShieldCheck, User, TrendingUp } from "lucide-react"
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

type UserRole = "admin" | "sourcer" | "investor"

interface TeamUser {
  id: string
  email: string
  role: UserRole
  firstName: string | null
  lastName: string | null
  phone: string | null
  profilePictureS3Key: string | null
  createdAt: string
  lastLogin: string | null
  isActive: boolean
  _count: { dealsCreated: number; dealsAssigned: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin",
  sourcer: "Sourcer",
  investor: "Investor",
}

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-rose-100 text-rose-700",
  sourcer: "bg-blue-100 text-blue-700",
  investor: "bg-emerald-100 text-emerald-700",
}

const ROLE_ICONS: Record<UserRole, React.ElementType> = {
  admin: ShieldCheck,
  sourcer: TrendingUp,
  investor: User,
}

function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ROLE_ICONS[role]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}
    >
      <Icon className="h-3 w-3" />
      {ROLE_LABELS[role]}
    </span>
  )
}

function Avatar({ user }: { user: TeamUser }) {
  const initials = [user.firstName, user.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join("") || user.email[0].toUpperCase()

  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-rose-500",
    "bg-amber-500",
    "bg-emerald-500",
    "bg-teal-500",
  ]
  const color = colors[user.email.charCodeAt(0) % colors.length]

  return (
    <div
      className={`w-9 h-9 rounded-full ${color} flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-white text-sm font-semibold">{initials}</span>
    </div>
  )
}

// ── Create/Edit Dialog ────────────────────────────────────────────────────────

interface UserFormData {
  email: string
  password: string
  role: UserRole
  firstName: string
  lastName: string
  phone: string
  isActive: boolean
}

const EMPTY_FORM: UserFormData = {
  email: "",
  password: "",
  role: "sourcer",
  firstName: "",
  lastName: "",
  phone: "",
  isActive: true,
}

function UserFormDialog({
  open,
  onOpenChange,
  editUser,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editUser: TeamUser | null
  onSaved: () => void
}) {
  const [form, setForm] = useState<UserFormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const isEdit = editUser !== null

  useEffect(() => {
    if (open) {
      if (editUser) {
        setForm({
          email: editUser.email,
          password: "",
          role: editUser.role,
          firstName: editUser.firstName ?? "",
          lastName: editUser.lastName ?? "",
          phone: editUser.phone ?? "",
          isActive: editUser.isActive,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, editUser])

  const handleSave = async () => {
    if (!form.email) {
      toast.error("Email is required")
      return
    }
    if (!isEdit && form.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    if (isEdit && form.password && form.password.length < 8) {
      toast.error("New password must be at least 8 characters")
      return
    }

    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        role: form.role,
        firstName: form.firstName || undefined,
        lastName: form.lastName || undefined,
        phone: form.phone || undefined,
        isActive: form.isActive,
      }
      if (form.password) body.password = form.password

      const url = isEdit ? `/api/users/${editUser!.id}` : "/api/users"
      const method = isEdit ? "PUT" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save user")
      }

      toast.success(isEdit ? "User updated" : "User created")
      onSaved()
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                placeholder="Jane"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                placeholder="Smith"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-red-500">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="jane@example.com"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password{" "}
              {isEdit ? (
                <span className="text-gray-400 font-normal">(leave blank to keep current)</span>
              ) : (
                <span className="text-red-500">*</span>
              )}
            </Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder={isEdit ? "New password" : "Min 8 characters"}
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select
              value={form.role}
              onValueChange={(val) => setForm({ ...form, role: val as UserRole })}
            >
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access</SelectItem>
                <SelectItem value="sourcer">Sourcer — deal sourcing</SelectItem>
                <SelectItem value="investor">Investor — investor portal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input
              id="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+44 7700 000000"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-gray-400">Inactive users cannot log in</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(checked) => setForm({ ...form, isActive: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState<TeamUser[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<TeamUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<TeamUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data)
    } catch (err) {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleEdit = (user: TeamUser) => {
    setEditUser(user)
    setFormOpen(true)
  }

  const handleCreate = () => {
    setEditUser(null)
    setFormOpen(true)
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/users/${deleteUser.id}`, { method: "DELETE" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to delete user")
      }
      toast.success("User deleted")
      setDeleteUser(null)
      await fetchUsers()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user")
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {users.length} team member{users.length !== 1 ? "s" : ""}
          </p>
          <Button onClick={handleCreate} className="btn-primary h-9 text-sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </div>

        {/* Users table */}
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">User</th>
                  <th className="table-header">Email</th>
                  <th className="table-header">Role</th>
                  <th className="table-header text-center">Status</th>
                  <th className="table-header text-center">Deals</th>
                  <th className="table-header">Last Login</th>
                  <th className="table-header">Joined</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  const displayName =
                    [user.firstName, user.lastName].filter(Boolean).join(" ") ||
                    user.email
                  return (
                    <tr key={user.id} className="table-row">
                      {/* User */}
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <Avatar user={user} />
                          <div>
                            <div className="font-medium text-sm">
                              {displayName}
                              {isSelf && (
                                <span className="ml-1.5 text-[10px] text-gray-400 font-normal">
                                  (you)
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="table-cell text-sm text-gray-500">{user.email}</td>

                      {/* Role */}
                      <td className="table-cell">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="table-cell text-center">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                            user.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Deals */}
                      <td className="table-cell text-center">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-sm text-gray-500 cursor-default">
                              {user._count.dealsAssigned}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            {user._count.dealsAssigned} assigned ·{" "}
                            {user._count.dealsCreated} created
                          </TooltipContent>
                        </Tooltip>
                      </td>

                      {/* Last Login */}
                      <td className="table-cell text-sm text-gray-500">
                        {user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>

                      {/* Joined */}
                      <td className="table-cell text-sm text-gray-500">
                        {new Date(user.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                                onClick={() => handleEdit(user)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                                onClick={() => !isSelf && setDeleteUser(user)}
                                disabled={isSelf}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {isSelf ? "Cannot delete your own account" : "Delete"}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create / Edit dialog */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editUser={editUser}
        onSaved={fetchUsers}
      />

      {/* Delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete user?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <strong>
                {[deleteUser?.firstName, deleteUser?.lastName].filter(Boolean).join(" ") ||
                  deleteUser?.email}
              </strong>{" "}
              and all their associated data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
