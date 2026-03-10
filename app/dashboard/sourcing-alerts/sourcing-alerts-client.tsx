"use client"

import { useState } from "react"
import { toast } from "sonner"
import { PlusIcon, PencilIcon, TrashIcon, BellIcon, BellSlashIcon } from "@heroicons/react/24/outline"

// ─── Types ─────────────────────────────────────────────────────────────────

interface SourcingAlert {
  id: string
  name: string | null
  address: string
  radius: string
  latitude: number | null
  longitude: number | null
  minPrice: number | null
  maxPrice: number | null
  minBedrooms: number | null
  maxBedrooms: number | null
  propertyTypes: string[]
  isActive: boolean
  createdAt: Date | string
}

interface NotificationPrefs {
  priceIncrease: boolean
  priceDecrease: boolean
  auctionReminder7Days: boolean
  auctionReminder3Days: boolean
  auctionReminder1Day: boolean
  newPropertyMatch: boolean
  deliveryEmail: boolean
  deliverySms: boolean
  deliveryInApp: boolean
}

// ─── Constants ─────────────────────────────────────────────────────────────

const RADIUS_OPTIONS = ["+1km", "+5km", "+10km", "+20km", "+40km"]

const PROPERTY_TYPES = [
  "Detached",
  "Semi-Detached",
  "Terraced",
  "Flat",
  "Bungalow",
  "Land",
  "Commercial",
  "Other",
]

const EMPTY_FORM = {
  name: "",
  address: "",
  radius: "+5km",
  minPrice: "",
  maxPrice: "",
  minBedrooms: "",
  maxBedrooms: "",
  propertyTypes: [] as string[],
  isActive: true,
}

// ─── Toggle row ────────────────────────────────────────────────────────────

function PrefToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string
  description?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-3">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked ? "bg-blue-600" : "bg-gray-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  )
}

// ─── Alert row ────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onEdit,
  onDelete,
  onToggle,
}: {
  alert: SourcingAlert
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const priceRange = (() => {
    if (alert.minPrice && alert.maxPrice)
      return `£${(alert.minPrice / 1000).toFixed(0)}k – £${(alert.maxPrice / 1000).toFixed(0)}k`
    if (alert.minPrice) return `From £${(alert.minPrice / 1000).toFixed(0)}k`
    if (alert.maxPrice) return `Up to £${(alert.maxPrice / 1000).toFixed(0)}k`
    return "Any price"
  })()

  const bedsRange = (() => {
    if (alert.minBedrooms && alert.maxBedrooms) return `${alert.minBedrooms}–${alert.maxBedrooms} beds`
    if (alert.minBedrooms) return `${alert.minBedrooms}+ beds`
    if (alert.maxBedrooms) return `Up to ${alert.maxBedrooms} beds`
    return "Any beds"
  })()

  return (
    <tr className={`border-b border-gray-100 last:border-0 ${!alert.isActive ? "opacity-50" : ""}`}>
      <td className="py-3 pr-4">
        <p className="text-sm font-medium text-gray-900">{alert.name || alert.address}</p>
        {alert.name && <p className="text-xs text-gray-500">{alert.address}</p>}
      </td>
      <td className="py-3 pr-4 text-sm text-gray-700">{alert.radius}</td>
      <td className="py-3 pr-4 text-sm text-gray-700">{priceRange}</td>
      <td className="py-3 pr-4 text-sm text-gray-700">{bedsRange}</td>
      <td className="py-3 pr-4 text-sm text-gray-700">
        {alert.propertyTypes.length > 0 ? alert.propertyTypes.join(", ") : "Any"}
      </td>
      <td className="py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onToggle}
            title={alert.isActive ? "Pause alert" : "Resume alert"}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            {alert.isActive ? (
              <BellIcon className="w-4 h-4 text-blue-600" />
            ) : (
              <BellSlashIcon className="w-4 h-4" />
            )}
          </button>
          <button onClick={onEdit} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <PencilIcon className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-red-500">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Alert modal ──────────────────────────────────────────────────────────

function AlertModal({
  initial,
  onClose,
  onSaved,
}: {
  initial?: SourcingAlert
  onClose: () => void
  onSaved: (alert: SourcingAlert) => void
}) {
  const [form, setForm] = useState({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    radius: initial?.radius ?? "+5km",
    minPrice: initial?.minPrice?.toString() ?? "",
    maxPrice: initial?.maxPrice?.toString() ?? "",
    minBedrooms: initial?.minBedrooms?.toString() ?? "",
    maxBedrooms: initial?.maxBedrooms?.toString() ?? "",
    propertyTypes: initial?.propertyTypes ?? [],
    isActive: initial?.isActive ?? true,
  })
  const [saving, setSaving] = useState(false)

  function toggleType(t: string) {
    setForm((f) => ({
      ...f,
      propertyTypes: f.propertyTypes.includes(t)
        ? f.propertyTypes.filter((x) => x !== t)
        : [...f.propertyTypes, t],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.address.trim()) {
      toast.error("Address is required")
      return
    }
    setSaving(true)
    try {
      const url = initial ? `/api/sourcing-alerts/${initial.id}` : "/api/sourcing-alerts"
      const method = initial ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          minPrice: form.minPrice || null,
          maxPrice: form.maxPrice || null,
          minBedrooms: form.minBedrooms || null,
          maxBedrooms: form.maxBedrooms || null,
        }),
      })
      if (!res.ok) throw new Error("Failed to save alert")
      const saved = await res.json()
      onSaved(saved)
      toast.success(initial ? "Alert updated" : "Alert created")
    } catch {
      toast.error("Failed to save alert")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">
            {initial ? "Edit Alert" : "New Sourcing Alert"}
          </h2>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Alert Name (optional)</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Leeds city centre"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Search Area / Address *</label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              placeholder="e.g. Leeds, West Yorkshire"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Radius</label>
            <select
              value={form.radius}
              onChange={(e) => setForm((f) => ({ ...f, radius: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Price (£)</label>
              <input
                type="number"
                value={form.minPrice}
                onChange={(e) => setForm((f) => ({ ...f, minPrice: e.target.value }))}
                placeholder="No minimum"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Price (£)</label>
              <input
                type="number"
                value={form.maxPrice}
                onChange={(e) => setForm((f) => ({ ...f, maxPrice: e.target.value }))}
                placeholder="No maximum"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Min Bedrooms</label>
              <input
                type="number"
                min={0}
                value={form.minBedrooms}
                onChange={(e) => setForm((f) => ({ ...f, minBedrooms: e.target.value }))}
                placeholder="Any"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Max Bedrooms</label>
              <input
                type="number"
                min={0}
                value={form.maxBedrooms}
                onChange={(e) => setForm((f) => ({ ...f, maxBedrooms: e.target.value }))}
                placeholder="Any"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Property Types (leave empty for any)</label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleType(t)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    form.propertyTypes.includes(t)
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={form.isActive}
              onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isActive" className="text-sm text-gray-700">Alert is active</label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : initial ? "Update Alert" : "Create Alert"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main client component ─────────────────────────────────────────────────

export function SourcingAlertsClient({
  initialAlerts,
  initialPrefs,
}: {
  initialAlerts: SourcingAlert[]
  initialPrefs: Partial<NotificationPrefs>
}) {
  const [alerts, setAlerts] = useState<SourcingAlert[]>(initialAlerts)
  const [prefs, setPrefs] = useState<NotificationPrefs>({
    priceIncrease: true,
    priceDecrease: true,
    auctionReminder7Days: true,
    auctionReminder3Days: true,
    auctionReminder1Day: true,
    newPropertyMatch: true,
    deliveryEmail: true,
    deliverySms: false,
    deliveryInApp: true,
    ...initialPrefs,
  })
  const [showModal, setShowModal] = useState(false)
  const [editAlert, setEditAlert] = useState<SourcingAlert | undefined>(undefined)
  const [savingPrefs, setSavingPrefs] = useState(false)

  async function savePref(key: keyof NotificationPrefs, value: boolean) {
    const next = { ...prefs, [key]: value }
    setPrefs(next)
    setSavingPrefs(true)
    try {
      await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      })
    } catch {
      toast.error("Failed to save preference")
    } finally {
      setSavingPrefs(false)
    }
  }

  async function deleteAlert(id: string) {
    if (!confirm("Delete this alert?")) return
    try {
      const res = await fetch(`/api/sourcing-alerts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error()
      setAlerts((prev) => prev.filter((a) => a.id !== id))
      toast.success("Alert deleted")
    } catch {
      toast.error("Failed to delete alert")
    }
  }

  async function toggleAlert(alert: SourcingAlert) {
    try {
      const res = await fetch(`/api/sourcing-alerts/${alert.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !alert.isActive }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)))
    } catch {
      toast.error("Failed to update alert")
    }
  }

  function handleSaved(saved: SourcingAlert) {
    setAlerts((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = saved
        return next
      }
      return [saved, ...prev]
    })
    setShowModal(false)
    setEditAlert(undefined)
  }

  return (
    <div className="space-y-8">
      {/* ── Notification Preferences ── */}
      <section className="bg-white border border-gray-200 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Notification Preferences</h2>
          <p className="text-xs text-gray-500 mt-0.5">Choose which events trigger notifications and how they're delivered</p>
        </div>

        <div className="px-6 py-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-4 mb-1">Alert Events</p>
          <div className="divide-y divide-gray-100">
            <PrefToggle
              label="New property match"
              description="Alert when a scraped listing matches one of your search criteria"
              checked={prefs.newPropertyMatch}
              onChange={(v) => savePref("newPropertyMatch", v)}
            />
            <PrefToggle
              label="Price increase"
              description="Watchlist property price goes up"
              checked={prefs.priceIncrease}
              onChange={(v) => savePref("priceIncrease", v)}
            />
            <PrefToggle
              label="Price decrease"
              description="Watchlist property price drops"
              checked={prefs.priceDecrease}
              onChange={(v) => savePref("priceDecrease", v)}
            />
            <PrefToggle
              label="Auction reminder — 7 days"
              checked={prefs.auctionReminder7Days}
              onChange={(v) => savePref("auctionReminder7Days", v)}
            />
            <PrefToggle
              label="Auction reminder — 3 days"
              checked={prefs.auctionReminder3Days}
              onChange={(v) => savePref("auctionReminder3Days", v)}
            />
            <PrefToggle
              label="Auction reminder — 1 day"
              checked={prefs.auctionReminder1Day}
              onChange={(v) => savePref("auctionReminder1Day", v)}
            />
          </div>

          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-6 mb-1">Delivery Channels</p>
          <div className="divide-y divide-gray-100 mb-4">
            <PrefToggle
              label="Email"
              checked={prefs.deliveryEmail}
              onChange={(v) => savePref("deliveryEmail", v)}
            />
            <PrefToggle
              label="SMS"
              description="Requires Twilio to be configured"
              checked={prefs.deliverySms}
              onChange={(v) => savePref("deliverySms", v)}
            />
            <PrefToggle
              label="In-app"
              checked={prefs.deliveryInApp}
              onChange={(v) => savePref("deliveryInApp", v)}
            />
          </div>

          {savingPrefs && (
            <p className="text-xs text-blue-500 pb-3">Saving preferences…</p>
          )}
        </div>
      </section>

      {/* ── Search Criteria / Alerts ── */}
      <section className="bg-white border border-gray-200 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Search Criteria</h2>
            <p className="text-xs text-gray-500 mt-0.5">Properties matching these criteria will trigger notifications</p>
          </div>
          <button
            onClick={() => { setEditAlert(undefined); setShowModal(true) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            <PlusIcon className="w-4 h-4" />
            Add Alert
          </button>
        </div>

        {alerts.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BellIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No alerts yet. Create one to get notified about new properties.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Alert</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Radius</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Beds</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <AlertRow
                    key={alert.id}
                    alert={alert}
                    onEdit={() => { setEditAlert(alert); setShowModal(true) }}
                    onDelete={() => deleteAlert(alert.id)}
                    onToggle={() => toggleAlert(alert)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showModal && (
        <AlertModal
          initial={editAlert}
          onClose={() => { setShowModal(false); setEditAlert(undefined) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}
