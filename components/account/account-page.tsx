"use client"

import { useState, useRef, useCallback } from "react"
import { toast } from "sonner"
import {
  User, Lock, Bell, Camera, CheckCircle2, XCircle,
  Eye, EyeOff, Loader2, Shield, Clock, Mail, Phone,
  Globe, FileText, LogOut,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"

// ─── types ────────────────────────────────────────────────────────────────────

interface NotifPrefs {
  deliveryEmail:        boolean
  deliverySms:         boolean
  deliveryInApp:       boolean
  priceIncrease:       boolean
  priceDecrease:       boolean
  newPropertyMatch:    boolean
  auctionReminder7Days: boolean
  auctionReminder3Days: boolean
  auctionReminder1Day:  boolean
}

interface AccountUser {
  id:                  string
  email:               string
  firstName:           string | null
  lastName:            string | null
  phone:               string | null
  bio:                 string | null
  timezone:            string | null
  role:                string
  permissions:         string[]
  profilePictureS3Key: string | null
  profilePictureUrl:   string | null
  isActive:            boolean
  createdAt:           string
  lastLogin:           string | null
  notificationPrefs:   NotifPrefs | null
}

type Tab = "profile" | "security" | "notifications"

const ROLE_LABELS: Record<string, { label: string; colour: string }> = {
  admin:    { label: "Admin",    colour: "bg-purple-100 text-purple-700 border-purple-200" },
  sourcer:  { label: "Sourcer",  colour: "bg-blue-100 text-blue-700 border-blue-200" },
  investor: { label: "Investor", colour: "bg-green-100 text-green-700 border-green-200" },
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return "Never"
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "Just now"
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
}

function getInitials(user: AccountUser): string {
  const first = user.firstName?.charAt(0) ?? ""
  const last  = user.lastName?.charAt(0) ?? ""
  return (first + last).toUpperCase() || user.email.charAt(0).toUpperCase()
}

// ─── avatar upload ────────────────────────────────────────────────────────────

function AvatarUpload({
  user, onUpdated,
}: {
  user: AccountUser
  onUpdated: (url: string, key: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(user.profilePictureUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5 MB"); return }

    setUploading(true)
    // Show local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    try {
      // 1. Get presigned upload URL
      const res1 = await fetch(`/api/users/${user.id}/profile-picture?filename=${encodeURIComponent(file.name)}&contentType=${encodeURIComponent(file.type)}`)
      if (!res1.ok) throw new Error("Failed to get upload URL")
      const { uploadUrl, s3Key } = await res1.json()

      // 2. Upload directly to S3
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } })

      // 3. Save the S3 key to the user record
      const res3 = await fetch(`/api/users/${user.id}/profile-picture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s3Key }),
      })
      if (!res3.ok) throw new Error("Failed to save profile picture")

      toast.success("Profile photo updated")
      onUpdated(objectUrl, s3Key)
    } catch (e: any) {
      toast.error(e.message || "Upload failed")
      setPreviewUrl(user.profilePictureUrl)
    } finally {
      setUploading(false)
    }
  }, [user.id, user.profilePictureUrl, onUpdated])

  const handleRemove = useCallback(async () => {
    setUploading(true)
    try {
      await fetch(`/api/users/${user.id}/profile-picture`, { method: "DELETE" })
      setPreviewUrl(null)
      onUpdated("", "")
      toast.success("Profile photo removed")
    } catch {
      toast.error("Failed to remove photo")
    } finally {
      setUploading(false)
    }
  }, [user.id, onUpdated])

  return (
    <div className="flex items-center gap-6">
      {/* Avatar circle */}
      <div className="relative group">
        <div className="h-24 w-24 rounded-full overflow-hidden ring-4 ring-white shadow-md">
          {previewUrl ? (
            <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <span className="text-3xl font-bold text-white">{getInitials(user)}</span>
            </div>
          )}
        </div>
        {/* Overlay */}
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity disabled:cursor-not-allowed"
        >
          {uploading
            ? <Loader2 className="h-5 w-5 text-white animate-spin" />
            : <Camera className="h-5 w-5 text-white" />}
        </button>
        <input ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>

      <div>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="block text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : "Change photo"}
        </button>
        <p className="text-xs text-gray-400 mt-0.5">JPG, PNG or WebP · Max 5 MB</p>
        {previewUrl && (
          <button onClick={handleRemove} disabled={uploading}
            className="mt-1 text-xs text-red-500 hover:text-red-600 disabled:opacity-50">
            Remove photo
          </button>
        )}
      </div>
    </div>
  )
}

// ─── toggle switch ────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-blue-600" : "bg-gray-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  )
}

// ─── main component ───────────────────────────────────────────────────────────

export function AccountPage({ user: initialUser }: { user: AccountUser }) {
  const [user, setUser] = useState(initialUser)
  const [tab, setTab] = useState<Tab>("profile")

  // ── Profile state ─────────────────────────────────────────────────────────
  const [profileForm, setProfileForm] = useState({
    firstName: user.firstName ?? "",
    lastName:  user.lastName  ?? "",
    phone:     user.phone     ?? "",
    bio:       user.bio       ?? "",
    timezone:  user.timezone  ?? "Europe/London",
  })
  const [profileSaving, setProfileSaving] = useState(false)

  const saveProfile = async () => {
    setProfileSaving(true)
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Save failed")
      const updated = await res.json()
      setUser(u => ({ ...u, ...updated }))
      toast.success("Profile updated")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setProfileSaving(false)
    }
  }

  // ── Password state ────────────────────────────────────────────────────────
  const [pwForm, setPwForm] = useState({ current: "", next: "", confirm: "" })
  const [pwSaving, setPwSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  const changePassword = async () => {
    if (pwForm.next !== pwForm.confirm) { toast.error("Passwords do not match"); return }
    if (pwForm.next.length < 8) { toast.error("New password must be at least 8 characters"); return }
    setPwSaving(true)
    try {
      const res = await fetch("/api/users/me/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.next }),
      })
      if (!res.ok) throw new Error((await res.json()).error || "Failed")
      toast.success("Password changed successfully")
      setPwForm({ current: "", next: "", confirm: "" })
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setPwSaving(false)
    }
  }

  // ── Notification state ────────────────────────────────────────────────────
  const defaultNotifs: NotifPrefs = {
    deliveryEmail: true, deliverySms: false, deliveryInApp: true,
    priceIncrease: true, priceDecrease: true, newPropertyMatch: true,
    auctionReminder7Days: true, auctionReminder3Days: true, auctionReminder1Day: true,
  }
  const [notifs, setNotifs] = useState<NotifPrefs>(user.notificationPrefs ?? defaultNotifs)
  const [notifSaving, setNotifSaving] = useState(false)

  const saveNotifs = async () => {
    setNotifSaving(true)
    try {
      const res = await fetch("/api/users/me/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifs),
      })
      if (!res.ok) throw new Error("Failed to save")
      toast.success("Notification preferences saved")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setNotifSaving(false)
    }
  }

  const roleInfo = ROLE_LABELS[user.role] ?? { label: user.role, colour: "bg-gray-100 text-gray-700 border-gray-200" }

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "profile",       label: "Profile",       icon: <User className="h-4 w-4" /> },
    { key: "security",      label: "Security",      icon: <Lock className="h-4 w-4" /> },
    { key: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  ]

  return (
    <div className="max-w-3xl mx-auto py-2">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your profile, password and preferences</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-4 w-4" /> Sign out
        </button>
      </div>

      {/* ── Identity card ───────────────────────────────────────────────── */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
        {/* Mini avatar */}
        <div className="h-14 w-14 shrink-0 rounded-full overflow-hidden ring-2 ring-gray-100">
          {user.profilePictureUrl ? (
            <img src={user.profilePictureUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">{getInitials(user)}</span>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-base font-semibold text-gray-900 truncate">
            {[user.firstName, user.lastName].filter(Boolean).join(" ") || user.email}
          </p>
          <p className="text-sm text-gray-500 truncate">{user.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", roleInfo.colour)}>
            {roleInfo.label}
          </span>
          <span className="text-[11px] text-gray-400">
            Member since {formatDate(user.createdAt)}
          </span>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all",
              tab === t.key
                ? "bg-white text-gray-900 shadow-sm border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
            )}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── Profile tab ─────────────────────────────────────────────────── */}
      {tab === "profile" && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">

          {/* Avatar section */}
          <div className="px-6 py-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Profile Photo</h2>
            <AvatarUpload
              user={user}
              onUpdated={(url, key) => setUser(u => ({
                ...u,
                profilePictureUrl:   url || null,
                profilePictureS3Key: key || null,
              }))}
            />
          </div>

          {/* Name & contact */}
          <div className="px-6 py-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={profileForm.firstName}
                    onChange={e => setProfileForm(f => ({ ...f, firstName: e.target.value }))}
                    placeholder="First name"
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
                <input
                  type="text"
                  value={profileForm.lastName}
                  onChange={e => setProfileForm(f => ({ ...f, lastName: e.target.value }))}
                  placeholder="Last name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="email"
                    value={user.email}
                    disabled
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 py-2.5 text-sm text-gray-500 cursor-not-allowed"
                  />
                </div>
                <p className="mt-1 text-[11px] text-gray-400">Contact an admin to change your email</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={e => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                    placeholder="+44 7700 000000"
                    className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                <span className="flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" /> Bio</span>
              </label>
              <textarea
                value={profileForm.bio}
                onChange={e => setProfileForm(f => ({ ...f, bio: e.target.value }))}
                rows={3}
                maxLength={500}
                placeholder="Tell your team a bit about yourself…"
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm resize-none focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <p className="text-right text-[11px] text-gray-400">{profileForm.bio.length}/500</p>
            </div>

            <div className="mt-4">
              <label className="block text-xs font-medium text-gray-500 mb-1.5">
                <span className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Timezone</span>
              </label>
              <select
                value={profileForm.timezone}
                onChange={e => setProfileForm(f => ({ ...f, timezone: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {[
                  "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
                  "America/New_York", "America/Chicago", "America/Los_Angeles",
                  "Asia/Dubai", "Asia/Singapore", "Australia/Sydney",
                ].map(tz => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
              </select>
            </div>
          </div>

          {/* Save button */}
          <div className="px-6 py-4 flex justify-end bg-gray-50 rounded-b-2xl">
            <button
              onClick={saveProfile}
              disabled={profileSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {profileSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save changes"}
            </button>
          </div>
        </div>
      )}

      {/* ── Security tab ────────────────────────────────────────────────── */}
      {tab === "security" && (
        <div className="space-y-4">

          {/* Account activity */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
            <div className="px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gray-400" /> Account Activity
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Last login</p>
                  <p className="text-sm font-semibold text-gray-800">{timeAgo(user.lastLogin)}</p>
                  {user.lastLogin && (
                    <p className="text-[11px] text-gray-400">{new Date(user.lastLogin).toLocaleString("en-GB")}</p>
                  )}
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Member since</p>
                  <p className="text-sm font-semibold text-gray-800">{formatDate(user.createdAt)}</p>
                </div>
              </div>
            </div>

            {/* Account status */}
            <div className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {user.isActive
                    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
                    : <XCircle className="h-4 w-4 text-red-400" />}
                  <span className="text-sm font-medium text-gray-700">
                    Account {user.isActive ? "active" : "suspended"}
                  </span>
                </div>
                <span className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                )}>
                  {user.isActive ? "Active" : "Suspended"}
                </span>
              </div>
            </div>
          </div>

          {/* Change password */}
          <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
            <div className="px-6 py-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
                <Shield className="h-4 w-4 text-gray-400" /> Change Password
              </h2>
              <p className="text-xs text-gray-400 mb-5">Use a strong password with at least 8 characters</p>

              <div className="space-y-4">
                {(["current", "next", "confirm"] as const).map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5 capitalize">
                      {field === "current" ? "Current password" : field === "next" ? "New password" : "Confirm new password"}
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type={showPw ? "text" : "password"}
                        value={pwForm[field]}
                        onChange={e => setPwForm(f => ({ ...f, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 pl-9 pr-10 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder={field === "current" ? "Enter current password" : field === "next" ? "Enter new password" : "Repeat new password"}
                      />
                      {field === "confirm" && (
                        <button type="button" onClick={() => setShowPw(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                          {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Strength indicator */}
                {pwForm.next && (
                  <div className="space-y-1">
                    <div className="flex gap-1">
                      {[8, 12, 16].map((len, i) => (
                        <div key={i} className={cn("h-1.5 flex-1 rounded-full transition-colors",
                          pwForm.next.length >= len ? (i === 0 ? "bg-red-400" : i === 1 ? "bg-amber-400" : "bg-green-500") : "bg-gray-200"
                        )} />
                      ))}
                    </div>
                    <p className="text-[11px] text-gray-400">
                      {pwForm.next.length < 8 ? "Too short" : pwForm.next.length < 12 ? "Acceptable" : pwForm.next.length < 16 ? "Good" : "Strong"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between bg-gray-50 rounded-b-2xl">
              <a href="/forgot-password" className="text-sm text-blue-600 hover:underline">
                Forgot your password?
              </a>
              <button
                onClick={changePassword}
                disabled={pwSaving || !pwForm.current || !pwForm.next || !pwForm.confirm}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {pwSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Updating…</> : "Update password"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications tab ───────────────────────────────────────────── */}
      {tab === "notifications" && (
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">

          {/* Delivery channels */}
          <div className="px-6 py-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Delivery Channels</h2>
            <p className="text-xs text-gray-400 mb-4">Choose how you receive notifications</p>
            <div className="space-y-4">
              {[
                { key: "deliveryEmail" as const, label: "Email notifications",    desc: "Receive alerts via email" },
                { key: "deliverySms"  as const, label: "SMS notifications",      desc: "Text message alerts (requires phone number)" },
                { key: "deliveryInApp" as const, label: "In-app notifications",  desc: "Alerts inside the dashboard" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <Toggle
                    checked={notifs[key]}
                    onChange={v => setNotifs(n => ({ ...n, [key]: v }))}
                    disabled={key === "deliverySms" && !user.phone}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Event types */}
          <div className="px-6 py-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">Alert Types</h2>
            <p className="text-xs text-gray-400 mb-4">Choose which events you want to be notified about</p>
            <div className="space-y-4">
              {[
                { key: "newPropertyMatch"    as const, label: "New property match",      desc: "When a new property matches your criteria" },
                { key: "priceDecrease"       as const, label: "Price reductions",        desc: "When a watched property drops in price" },
                { key: "priceIncrease"       as const, label: "Price increases",         desc: "When a watched property increases in price" },
                { key: "auctionReminder7Days" as const, label: "Auction reminder (7 days)", desc: "7 days before an auction" },
                { key: "auctionReminder3Days" as const, label: "Auction reminder (3 days)", desc: "3 days before an auction" },
                { key: "auctionReminder1Day"  as const, label: "Auction reminder (1 day)",  desc: "Day before an auction" },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <Toggle checked={notifs[key]} onChange={v => setNotifs(n => ({ ...n, [key]: v }))} />
                </div>
              ))}
            </div>
          </div>

          <div className="px-6 py-4 flex justify-end bg-gray-50 rounded-b-2xl">
            <button
              onClick={saveNotifs}
              disabled={notifSaving}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {notifSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save preferences"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
