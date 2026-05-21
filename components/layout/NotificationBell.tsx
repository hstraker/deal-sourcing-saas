"use client"

/**
 * NotificationBell
 *
 * Smart bell icon in the top header.
 * - Polls GET /api/notifications every 30 s for the unread count
 * - Calls POST /api/notifications/generate on mount + every 10 min
 * - Dropdown lists the 50 most-recent notifications (categorised)
 * - Click notification → navigate to deep-link + mark as read
 * - "Mark all read" button
 * - Uses createPortal so it escapes sidebar stacking context
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import { createPortal }  from "react-dom"
import { useRouter }     from "next/navigation"
import {
  Bell,
  AlertTriangle,
  Database,
  Sparkles,
  Users,
  CheckCheck,
  ExternalLink,
  Clock,
  MessageSquare,
  MapPin,
  TrendingDown,
} from "lucide-react"

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id:        string
  type:      string
  category:  string
  title:     string
  body:      string
  link:      string | null
  read:      boolean
  meta:      Record<string, unknown> | null
  createdAt: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  <  1)  return "just now"
  if (mins  < 60)  return `${mins}m ago`
  if (hours < 24)  return `${hours}h ago`
  if (days  <  7)  return `${days}d ago`
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
}

function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    lead: "Leads",
    data: "Data",
    ai:   "Alerts",
    team: "Team",
  }
  return map[category] ?? category
}

const CATEGORY_ORDER = ["lead", "data", "ai", "team"]

function TypeIcon({ type }: { type: string }) {
  const cls = "w-4 h-4 flex-shrink-0"
  switch (type) {
    case "stuck_lead":       return <Clock        className={`${cls} text-amber-500`}  />
    case "vendor_reply":     return <MessageSquare className={`${cls} text-blue-500`}   />
    case "offer_accepted":   return <CheckCheck    className={`${cls} text-green-500`}  />
    case "offer_rejected":   return <AlertTriangle className={`${cls} text-red-500`}    />
    case "lr_stale":         return <Database      className={`${cls} text-orange-500`} />
    case "lr_import":        return <Database      className={`${cls} text-violet-500`} />
    case "alert_match":      return <MapPin        className={`${cls} text-emerald-500`}/>
    case "price_reduction":  return <TrendingDown  className={`${cls} text-red-400`}    />
    case "high_distress":    return <Sparkles      className={`${cls} text-purple-500`} />
    default:                 return <Bell          className={`${cls} text-gray-400`}   />
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NotificationBell() {
  const router = useRouter()

  const [open,         setOpen]         = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount,  setUnreadCount]  = useState(0)
  const [loading,      setLoading]      = useState(false)

  // For portal positioning
  const btnRef    = useRef<HTMLButtonElement>(null)
  const [dropPos, setDropPos] = useState({ top: 0, right: 0 })

  // Refs to prevent stale-closure issues in intervals
  const openRef = useRef(open)
  openRef.current = open

  // ── Fetch helpers ─────────────────────────────────────────────────────────

  const fetchNotifications = useCallback(async () => {
    try {
      const res  = await fetch("/api/notifications")
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silent — don't break the UI
    }
  }, [])

  const runGenerators = useCallback(async () => {
    try {
      const res  = await fetch("/api/notifications/generate", { method: "POST" })
      if (!res.ok) return
      const data = await res.json()
      setNotifications(data.notifications ?? [])
      setUnreadCount(data.unreadCount ?? 0)
    } catch {
      // silent
    }
  }, [])

  // ── Lifecycle: initial generate + periodic polling ────────────────────────

  useEffect(() => {
    // Kick off generators immediately on mount
    runGenerators()

    // Poll unread count every 30 s
    const pollInterval = setInterval(fetchNotifications, 30_000)

    // Re-run generators every 10 min
    const genInterval  = setInterval(runGenerators, 10 * 60_000)

    return () => {
      clearInterval(pollInterval)
      clearInterval(genInterval)
    }
  }, [fetchNotifications, runGenerators])

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest("[data-notif-dropdown]") && !target.closest("[data-notif-btn]")) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // ── Toggle ────────────────────────────────────────────────────────────────

  function handleToggle() {
    if (!open && btnRef.current) {
      const rect  = btnRef.current.getBoundingClientRect()
      setDropPos({
        top:   rect.bottom + 8,
        right: window.innerWidth - rect.right,
      })
    }
    setOpen((v) => !v)
  }

  // ── Mark one as read ──────────────────────────────────────────────────────

  async function markRead(id: string) {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
    setUnreadCount((c) => Math.max(0, c - 1))
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "PATCH" })
    } catch {
      // optimistic — failure is acceptable
    }
  }

  // ── Mark all read ─────────────────────────────────────────────────────────

  async function markAllRead() {
    setLoading(true)
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" })
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
      setUnreadCount(0)
    } catch {
      //
    } finally {
      setLoading(false)
    }
  }

  // ── Click a notification ──────────────────────────────────────────────────

  async function handleClick(n: Notification) {
    if (!n.read) await markRead(n.id)
    setOpen(false)
    if (n.link) router.push(n.link)
  }

  // ── Group by category ─────────────────────────────────────────────────────

  const grouped: Record<string, Notification[]> = {}
  for (const n of notifications) {
    if (!grouped[n.category]) grouped[n.category] = []
    grouped[n.category].push(n)
  }
  const categories = CATEGORY_ORDER.filter((c) => grouped[c]?.length)

  // ── Render ────────────────────────────────────────────────────────────────

  const dropdown = open ? (
    <div
      data-notif-dropdown=""
      className="fixed z-[9999] w-[380px] max-h-[520px] flex flex-col rounded-xl border border-[#e2e8f0] bg-white shadow-2xl overflow-hidden"
      style={{ top: dropPos.top, right: dropPos.right }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#e2e8f0] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-[#64748b]" />
          <span className="text-sm font-semibold text-[#0f172a]">Notifications</span>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[18px]">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[#6366f1] hover:text-[#4f46e5] font-medium transition-colors disabled:opacity-50"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            Mark all read
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <Bell className="w-10 h-10 text-[#cbd5e1] mb-3" />
            <p className="text-sm font-medium text-[#64748b]">All clear</p>
            <p className="text-xs text-[#94a3b8] mt-1">No notifications yet — we'll alert you when something needs attention</p>
          </div>
        ) : (
          categories.length > 0 ? (
            categories.map((cat) => (
              <div key={cat}>
                {/* Category header */}
                <div className="sticky top-0 z-10 px-4 py-1.5 bg-[#f8fafc] border-b border-[#f1f5f9]">
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-[#94a3b8]">
                    {categoryLabel(cat)}
                  </span>
                </div>

                {/* Items */}
                {grouped[cat].map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[#f8fafc] transition-colors border-b border-[#f8fafc] last:border-0 ${
                      n.read ? "opacity-60" : ""
                    }`}
                  >
                    {/* Unread dot */}
                    <div className="mt-0.5 flex-shrink-0 flex items-start pt-0.5">
                      {n.read ? (
                        <span className="w-2 h-2" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-[#6366f1] flex-shrink-0" />
                      )}
                    </div>

                    {/* Icon */}
                    <div className="mt-0.5">
                      <TypeIcon type={n.type} />
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-tight ${n.read ? "text-[#64748b]" : "text-[#0f172a] font-semibold"}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-2 leading-snug">
                        {n.body}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-[#94a3b8]">{relativeTime(n.createdAt)}</span>
                        {n.link && (
                          <ExternalLink className="w-2.5 h-2.5 text-[#cbd5e1]" />
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ))
          ) : (
            /* Ungrouped fallback */
            notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-[#f8fafc] transition-colors border-b border-[#f8fafc] last:border-0 ${
                  n.read ? "opacity-60" : ""
                }`}
              >
                <div className="mt-1 flex-shrink-0">
                  {!n.read && <span className="w-2 h-2 rounded-full bg-[#6366f1] block" />}
                </div>
                <TypeIcon type={n.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-[#0f172a]">{n.title}</p>
                  <p className="text-[11px] text-[#64748b] mt-0.5 line-clamp-2">{n.body}</p>
                  <span className="text-[10px] text-[#94a3b8] mt-1 block">{relativeTime(n.createdAt)}</span>
                </div>
              </button>
            ))
          )
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="flex items-center justify-center px-4 py-2.5 border-t border-[#f1f5f9] flex-shrink-0 bg-[#fafafa]">
          <span className="text-[11px] text-[#94a3b8]">
            Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
          </span>
        </div>
      )}
    </div>
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        data-notif-btn=""
        onClick={handleToggle}
        className="relative flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 ring-2 ring-gray-200 hover:ring-blue-400 transition-all focus:outline-none"
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Portal — escapes sidebar stacking context */}
      {typeof window !== "undefined" && dropdown
        ? createPortal(dropdown, document.body)
        : null}
    </>
  )
}

export default NotificationBell
