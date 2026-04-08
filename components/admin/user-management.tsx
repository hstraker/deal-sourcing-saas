"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  UserPlus,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  TrendingUp,
  Mail,
  Copy,
  Check,
  LayoutDashboard,
  DollarSign,
  Settings,
  Telescope,
} from "lucide-react"
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
  DialogDescription,
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
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"

// ── Types ─────────────────────────────────────────────────────────────────────

type StaffRole = "admin" | "sourcer"

interface StaffUser {
  id: string
  email: string
  role: StaffRole
  firstName: string | null
  lastName: string | null
  phone: string | null
  profilePictureS3Key: string | null
  createdAt: string
  lastLogin: string | null
  isActive: boolean
  isPending: boolean
  permissions: string[]
  _count: { dealsCreated: number; dealsAssigned: number }
}

// ── Section permissions config ────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "invest",
    label: "Invest",
    description: "Vendor leads, deal analysis, scrapers",
    Icon: Telescope,
  },
  {
    id: "manage",
    label: "Manage",
    description: "Contacts, investors, reservations",
    Icon: LayoutDashboard,
  },
  {
    id: "finance",
    label: "Finance",
    description: "Cashflow, payments",
    Icon: DollarSign,
  },
  {
    id: "admin",
    label: "Admin",
    description: "Settings, user management, schedules",
    Icon: Settings,
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<StaffRole, string> = {
  admin: "bg-rose-100 text-rose-700",
  sourcer: "bg-blue-100 text-blue-700",
}

const ROLE_ICONS: Record<StaffRole, React.ElementType> = {
  admin: ShieldCheck,
  sourcer: TrendingUp,
}

function RoleBadge({ role }: { role: StaffRole }) {
  const Icon = ROLE_ICONS[role]
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${ROLE_COLORS[role]}`}
    >
      <Icon className="h-3 w-3" />
      {role === "admin" ? "Admin" : "Sourcer"}
    </span>
  )
}

function PermissionChips({ permissions }: { permissions: string[] }) {
  if (permissions.length === 0) return <span className="text-gray-400 text-xs">None</span>
  return (
    <div className="flex flex-wrap gap-1">
      {SECTIONS.filter((s) => permissions.includes(s.id)).map((s) => (
        <span
          key={s.id}
          className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200"
        >
          {s.label}
        </span>
      ))}
    </div>
  )
}

function StatusBadge({ user }: { user: StaffUser }) {
  if (user.isPending) {
    return (
      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
        Pending invite
      </span>
    )
  }
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
      }`}
    >
      {user.isActive ? "Active" : "Inactive"}
    </span>
  )
}

function Avatar({ user }: { user: StaffUser }) {
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((n) => n![0].toUpperCase())
      .join("") || user.email[0].toUpperCase()

  const colors = [
    "bg-blue-500", "bg-purple-500", "bg-rose-500",
    "bg-amber-500", "bg-emerald-500", "bg-teal-500",
  ]
  const color = colors[user.email.charCodeAt(0) % colors.length]

  return (
    <div className={`w-9 h-9 rounded-full ${color} flex items-center justify-center flex-shrink-0`}>
      <span className="text-white text-sm font-semibold">{initials}</span>
    </div>
  )
}

// ── Permissions checkboxes ────────────────────────────────────────────────────

function PermissionsField({
  value,
  onChange,
  disabled,
}: {
  value: string[]
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id])
  }
  return (
    <div className="space-y-2">
      <Label className="text-sm">Access sections</Label>
      <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
        {SECTIONS.map((s) => {
          const Icon = s.Icon
          const checked = value.includes(s.id)
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-4 py-2.5 ${disabled ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}
              onClick={() => !disabled && toggle(s.id)}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => !disabled && toggle(s.id)}
                disabled={disabled}
                className="pointer-events-none"
              />
              <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{s.label}</p>
                <p className="text-xs text-gray-400">{s.description}</p>
              </div>
            </div>
          )
        })}
      </div>
      {disabled && (
        <p className="text-xs text-gray-400">Admin role always has access to all sections.</p>
      )}
    </div>
  )
}

// ── Invite link copy dialog ───────────────────────────────────────────────────

function InviteLinkDialog({
  open,
  onOpenChange,
  inviteUrl,
  email,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  inviteUrl: string
  email: string
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>User invited</DialogTitle>
          <DialogDescription>
            Copy the link below and share it directly with <strong>{email}</strong>. The link expires in 48 hours.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
          <span className="flex-1 text-xs text-gray-600 break-all font-mono">{inviteUrl}</span>
          <button
            onClick={copy}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-gray-400">Link expires in 48 hours.</p>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Create/Edit dialog ────────────────────────────────────────────────────────

interface FormData {
  email: string
  role: StaffRole
  firstName: string
  lastName: string
  phone: string
  isActive: boolean
  permissions: string[]
}

const DEFAULT_PERMISSIONS = ["invest", "manage"]
const ADMIN_PERMISSIONS = ["invest", "manage", "finance", "admin"]

const EMPTY_FORM: FormData = {
  email: "",
  role: "sourcer",
  firstName: "",
  lastName: "",
  phone: "",
  isActive: true,
  permissions: DEFAULT_PERMISSIONS,
}

function UserFormDialog({
  open,
  onOpenChange,
  editUser,
  onCreated,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editUser: StaffUser | null
  onCreated: (inviteUrl: string, emailSent: boolean, email: string) => void
  onSaved: () => void
}) {
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const isEdit = editUser !== null

  useEffect(() => {
    if (open) {
      if (editUser) {
        setForm({
          email: editUser.email,
          role: editUser.role,
          firstName: editUser.firstName ?? "",
          lastName: editUser.lastName ?? "",
          phone: editUser.phone ?? "",
          isActive: editUser.isActive,
          permissions: editUser.permissions,
        })
      } else {
        setForm(EMPTY_FORM)
      }
    }
  }, [open, editUser])

  const isAdminRole = form.role === "admin"
  const effectivePermissions = isAdminRole ? ADMIN_PERMISSIONS : form.permissions

  const handleRoleChange = (role: StaffRole) => {
    setForm((prev) => ({
      ...prev,
      role,
      permissions: role === "admin" ? ADMIN_PERMISSIONS : DEFAULT_PERMISSIONS,
    }))
  }

  const handleSave = async () => {
    if (!form.email) {
      toast.error("Email is required")
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
        permissions: effectivePermissions,
      }

      if (isEdit) {
        body.isActive = form.isActive
        const res = await fetch(`/api/users/${editUser!.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to save user")
        }
        toast.success("User updated")
        onSaved()
        onOpenChange(false)
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || "Failed to create user")
        }
        const data = await res.json()
        // Always show the invite link — useful for demos and when email goes to spam
        onCreated(data.inviteUrl, false, form.email)
        onSaved()
        onOpenChange(false)
        if (data.emailSent) {
          toast.success(`Invite email sent to ${form.email} — link also copied below`)
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save user")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Staff Member" : "Invite Staff Member"}</DialogTitle>
          {!isEdit && (
            <DialogDescription>
              An email invite will be sent so they can set their own password.
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Name */}
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
              placeholder="jane@company.com"
              disabled={isEdit}
            />
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role">Role</Label>
            <Select value={form.role} onValueChange={(v) => handleRoleChange(v as StaffRole)}>
              <SelectTrigger id="role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin — full access to everything</SelectItem>
                <SelectItem value="sourcer">Sourcer — property sourcing & deals</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Section permissions */}
          <PermissionsField
            value={effectivePermissions}
            onChange={(v) => setForm({ ...form, permissions: v })}
            disabled={isAdminRole}
          />

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

          {/* Active toggle — edit only */}
          {isEdit && (
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Save Changes" : "Send Invite"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function UserManagement({ currentUserId }: { currentUserId: string }) {
  const router = useRouter()
  const [users, setUsers] = useState<StaffUser[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editUser, setEditUser] = useState<StaffUser | null>(null)
  const [deleteUser, setDeleteUser] = useState<StaffUser | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [inviteLinkData, setInviteLinkData] = useState<{
    url: string
    email: string
  } | null>(null)
  const [resendingId, setResendingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users")
      if (!res.ok) throw new Error("Failed to fetch users")
      const data = await res.json()
      setUsers(data)
    } catch {
      toast.error("Failed to load users")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const handleCreate = () => {
    setEditUser(null)
    setFormOpen(true)
  }

  const handleEdit = (user: StaffUser) => {
    setEditUser(user)
    setFormOpen(true)
  }

  const handleCreated = (inviteUrl: string, emailSent: boolean, email: string) => {
    if (!emailSent) {
      setInviteLinkData({ url: inviteUrl, email })
    }
    fetchUsers()
  }

  const handleResendInvite = async (user: StaffUser) => {
    setResendingId(user.id)
    try {
      const res = await fetch(`/api/users/${user.id}/resend-invite`, { method: "POST" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to resend invite")
      }
      const data = await res.json()
      if (data.emailSent) {
        toast.success(`Invite resent to ${user.email}`)
      } else {
        setInviteLinkData({ url: data.inviteUrl, email: user.email })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend invite")
    } finally {
      setResendingId(null)
    }
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
      toast.success("User removed")
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

  const pendingCount = users.filter((u) => u.isPending).length

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-gray-500">
              {users.length} staff member{users.length !== 1 ? "s" : ""}
            </p>
            {pendingCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {pendingCount} pending
              </span>
            )}
          </div>
          <Button onClick={handleCreate} className="btn-primary h-9 text-sm">
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Staff Member
          </Button>
        </div>

        {/* Table */}
        <div className="ds-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Member</th>
                  <th className="table-header">Role</th>
                  <th className="table-header">Access</th>
                  <th className="table-header text-center">Status</th>
                  <th className="table-header text-center">Deals</th>
                  <th className="table-header">Last Login</th>
                  <th className="table-header text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isSelf = user.id === currentUserId
                  const displayName =
                    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
                  return (
                    <tr key={user.id} className="table-row">
                      {/* Member */}
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
                            <div className="text-xs text-gray-400">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="table-cell">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Access */}
                      <td className="table-cell">
                        <PermissionChips permissions={user.permissions} />
                      </td>

                      {/* Status */}
                      <td className="table-cell text-center">
                        <StatusBadge user={user} />
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
                        {user.isPending
                          ? "—"
                          : user.lastLogin
                          ? new Date(user.lastLogin).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "Never"}
                      </td>

                      {/* Actions */}
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Resend invite — only for pending users */}
                          {user.isPending && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  className="rounded p-1.5 text-amber-500 hover:bg-amber-50 hover:text-amber-600 transition-colors"
                                  onClick={() => handleResendInvite(user)}
                                  disabled={resendingId === user.id}
                                >
                                  {resendingId === user.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Mail className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent>Resend invite</TooltipContent>
                            </Tooltip>
                          )}

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
                              {isSelf ? "Cannot remove yourself" : "Remove"}
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

      {/* Invite dialog */}
      <UserFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editUser={editUser}
        onCreated={handleCreated}
        onSaved={fetchUsers}
      />

      {/* Invite link copy fallback */}
      {inviteLinkData && (
        <InviteLinkDialog
          open={!!inviteLinkData}
          onOpenChange={(o) => !o && setInviteLinkData(null)}
          inviteUrl={inviteLinkData.url}
          email={inviteLinkData.email}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove staff member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
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
                  Removing...
                </>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
