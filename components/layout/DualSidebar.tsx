"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import React, { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  Bars3Icon,
  XMarkIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ArrowRightStartOnRectangleIcon,
} from "@heroicons/react/24/outline"
import { NAV_SECTIONS } from "@/config/navigation"
import { useSidebar } from "@/context/SidebarContext"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// ── LogoMark: fetches real company profile ──────────────────────────────────

interface CompanyProfile {
  companyName: string
  logoUrl: string | null
}

function LogoMark() {
  const [profile, setProfile] = useState<CompanyProfile | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/company-profile")
        if (res.ok) {
          const data = await res.json()
          if (data.profile) setProfile(data.profile)
        }
      } catch {
        // silently ignore
      }
    }
    load()
    window.addEventListener("company-profile-updated", load)
    return () => window.removeEventListener("company-profile-updated", load)
  }, [])

  const initials = (profile?.companyName || "D").charAt(0).toUpperCase()

  if (profile?.logoUrl) {
    return (
      <div className="relative w-8 h-8 flex-shrink-0 rounded-lg overflow-hidden">
        <Image
          src={profile.logoUrl}
          alt={profile.companyName}
          fill
          className="object-contain"
          unoptimized
        />
      </div>
    )
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-[var(--sidebar-active-bg)] flex items-center justify-center flex-shrink-0">
      <span className="text-[var(--sidebar-bg)] font-bold text-sm">{initials}</span>
    </div>
  )
}

function CompanyName() {
  const [name, setName] = useState<string>("DealStack")

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/company-profile")
        if (res.ok) {
          const data = await res.json()
          if (data.profile?.companyName) setName(data.profile.companyName)
        }
      } catch {
        // silently ignore
      }
    }
    load()
    window.addEventListener("company-profile-updated", load)
    return () => window.removeEventListener("company-profile-updated", load)
  }, [])

  return <>{name}</>
}

// ── UserAccountMenu: avatar + dropdown ────────────────────────────────────

export function UserAccountMenu() {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const userId = (session?.user as any)?.id as string | undefined

  // Fetch profile picture once session is ready
  useEffect(() => {
    if (!userId) return
    fetch(`/api/users/${userId}/profile-picture/url`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.url) setAvatarUrl(d.url) })
      .catch(() => {})
  }, [userId])

  const name     = session?.user?.name || session?.user?.email || "My Account"
  const email    = session?.user?.email || ""
  const role     = (session?.user as any)?.role as string | undefined
  const initials = name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()

  const ROLE_COLOURS: Record<string, string> = {
    admin:    "bg-purple-100 text-purple-700",
    sourcer:  "bg-blue-100 text-blue-700",
    investor: "bg-green-100 text-green-700",
  }
  const roleColour = role ? (ROLE_COLOURS[role] ?? "bg-gray-100 text-gray-600") : ""

  const handleToggle = () => setOpen(v => !v)

  return (
    <div className="relative">
      {/* Trigger — circular avatar button */}
      <button
        ref={triggerRef}
        onClick={handleToggle}
        className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-gray-200 hover:ring-blue-400 transition-all focus:outline-none"
        title="Account"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{initials}</span>
          </div>
        )}
      </button>

      {/* Dropdown — portal to body so it escapes any stacking context */}
      {open && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[9999] w-72 rounded-2xl border border-gray-100 bg-white shadow-2xl overflow-hidden"
            style={{ right: window.innerWidth - (triggerRef.current?.getBoundingClientRect().right ?? 0), top: (triggerRef.current?.getBoundingClientRect().bottom ?? 0) + 8 }}
          >
            {/* User info header */}
            <div className="px-5 py-4 flex items-center gap-3 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full overflow-hidden ring-2 ring-gray-200 flex-shrink-0">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                    <span className="text-white text-base font-bold">{initials}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-500 truncate">{email}</p>
                {role && (
                  <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${roleColour}`}>
                    {role}
                  </span>
                )}
              </div>
            </div>

            {/* Menu items */}
            <div className="py-2">
              <Link
                href="/dashboard/account"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>My Account</span>
              </Link>

              {role === "admin" && (
                <Link
                  href="/dashboard/admin/users"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Team Members</span>
                </Link>
              )}

              <Link
                href="/dashboard/settings"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Settings</span>
              </Link>
            </div>

            {/* Logout */}
            <div className="border-t border-gray-100 py-2">
              <button
                onClick={() => { setOpen(false); signOut({ callbackUrl: "/login" }) }}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <ArrowRightStartOnRectangleIcon className="h-5 w-5 text-gray-400" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  )
}

// ── DualSidebar ────────────────────────────────────────────────────────────

interface DualSidebarProps {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
}

export default function DualSidebar({ mobileNavOpen, setMobileNavOpen }: DualSidebarProps) {
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const { activeSectionId, setActiveSectionId, secondaryOpen, setSecondaryOpen } =
    useSidebar()

  // Filter nav sections based on user permissions.
  // While the session is still loading we show all sections so the sidebar
  // never flashes empty — the correct subset is shown once auth resolves.
  const isAdmin = session?.user?.role === "admin"
  const userPermissions: string[] = (session?.user as any)?.permissions ?? []
  const visibleSections =
    status === "loading"
      ? NAV_SECTIONS
      : NAV_SECTIONS.filter((s) => isAdmin || userPermissions.includes(s.id))

  const activeSection =
    visibleSections.find((s) => s.id === activeSectionId) ??
    visibleSections[0] ??
    NAV_SECTIONS[0]

  // Find the single most-specific matching item (longest href) so that
  // ancestor paths like /dashboard and /dashboard/vendors don't also
  // light up when you're on /dashboard/vendors/portal-check.
  const activeItemHref =
    activeSection.groups
      .flatMap((g) => g.items)
      .filter(
        (item) =>
          pathname === item.href || pathname.startsWith(item.href + "/")
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href ?? null

  const isActiveItem = (href: string) => href === activeItemHref

  const [vendorsCount, setVendorsCount] = useState(0)
  const [dealsCount, setDealsCount] = useState(0)

  useEffect(() => {
    fetch("/api/action-counts")
      .then((r) => {
        if (!r.ok) throw new Error(`API error: ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setVendorsCount(d.vendorsCount ?? 0)
        setDealsCount(d.dealsCount ?? 0)
      })
      .catch((err) => {
        console.error("Failed to fetch action counts:", err)
      })
  }, [])

  const handleSectionClick = (sectionId: string) => {
    if (sectionId === activeSectionId) {
      setSecondaryOpen(!secondaryOpen)
    } else {
      setActiveSectionId(sectionId)
      setSecondaryOpen(true)
    }
  }

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          HAMBURGER BUTTON — mobile only (hidden on md+)
          Fixed top-left, above the overlay (z-30).
          Tap to open primary sidebar on small screens.
      ═══════════════════════════════════════════════════ */}
      <button
        onClick={() => setMobileNavOpen(true)}
        aria-label="Open navigation"
        className="
          fixed top-4 left-4 z-30
          block md:hidden
          w-10 h-10 rounded-lg bg-white shadow-md border border-gray-200
          flex items-center justify-center
          text-gray-600 hover:text-gray-900 transition-colors
        "
      >
        <Bars3Icon className="w-5 h-5" />
      </button>

      {/* ═══════════════════════════════════════════════════
          NAV1 — PRIMARY SIDEBAR
          Mobile:  full-width (200px), slides in from left via translate.
                   Hidden by default (-translate-x-full), shown when
                   mobileNavOpen=true (translate-x-0). z-50 above overlay.
          Desktop: 56px collapsed rail, expands to 200px on CSS hover.
                   Always visible (md:translate-x-0).
      ═══════════════════════════════════════════════════ */}
      <aside
        className={`
          fixed left-0 top-0 h-screen z-50
          bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)]
          flex flex-col py-3
          w-[260px] md:w-14 md:hover:w-[200px]
          transition-[width,transform] duration-200 ease-in-out
          overflow-x-hidden overflow-y-auto md:overflow-hidden
          group
          ${mobileNavOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        {/* Close button — mobile only, inside the sidebar */}
        <button
          onClick={() => setMobileNavOpen(false)}
          aria-label="Close navigation"
          className="
            block md:hidden
            absolute top-4 right-4
            w-8 h-8 rounded-full
            flex items-center justify-center
            text-gray-400 hover:bg-[var(--sidebar-hover)] hover:text-white
            transition-colors
          "
        >
          <XMarkIcon className="w-5 h-5" />
        </button>

        {/* Logo row */}
        <div className="flex items-center gap-2.5 px-3 mb-3 flex-shrink-0 min-w-[200px]">
          <LogoMark />
          <span
            className="
              text-sm font-bold text-white whitespace-nowrap
              opacity-100 md:opacity-0 md:group-hover:opacity-100
              transition-opacity duration-150 delay-75
            "
          >
            <CompanyName />
          </span>
        </div>

        {/* Divider */}
        <div className="mx-3 h-px bg-[var(--sidebar-border)] mb-2 flex-shrink-0" />

        {/* NAV1 section buttons */}
        <div className="flex flex-col gap-0.5 px-2 flex-1">
          {visibleSections.map((section) => {
            const isActive = section.id === activeSectionId
            return (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`
                  flex items-center gap-3 w-full px-2 py-2.5 rounded-xl
                  transition-colors duration-150 text-left min-w-[176px]
                  ${
                    isActive
                      ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-bg)] font-semibold shadow-sm"
                      : "text-gray-400 hover:bg-[var(--sidebar-hover)] hover:text-white"
                  }
                `}
              >
                <section.icon className="w-5 h-5 flex-shrink-0" />
                <span
                  className="
                    text-sm whitespace-nowrap
                    opacity-100 md:opacity-0 md:group-hover:opacity-100
                    transition-opacity duration-150 delay-75
                  "
                >
                  {section.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Mobile inline sub-nav — active section items shown inline; desktop uses NAV2 */}
        <div className="md:hidden border-t border-[var(--sidebar-border)] mt-2 pt-2 px-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-2 mb-1.5">
            {activeSection.title}
          </p>
          {activeSection.groups.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-500 px-2 mb-1 whitespace-nowrap">
                {group.label}
              </p>
              {group.items.map((item) => {
                const active = isActiveItem(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5
                      text-sm transition-all duration-100
                      ${active
                        ? "bg-[var(--sidebar-active-bg)] text-[var(--sidebar-bg)] font-semibold"
                        : "text-gray-300 hover:bg-[var(--sidebar-hover)] hover:text-white"
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </div>

      </aside>

      {/* ═══════════════════════════════════════════════════
          NAV2 — SECONDARY SIDEBAR
          Hidden on mobile (hidden md:flex) — the primary sidebar
          covers navigation needs on small screens.
          Collapsible on desktop. Shows the active section's nav groups.
      ═══════════════════════════════════════════════════ */}
      <aside
        className={`
          hidden md:flex
          fixed left-14 top-0 h-screen bg-white border-r border-gray-200 z-40
          flex-col transition-all duration-200 ease-in-out overflow-hidden
          ${secondaryOpen ? "w-[260px]" : "w-0"}
        `}
      >
        {/* NAV2 header: section title + « collapse button */}
        <div
          className="
            flex items-center justify-between
            px-4 py-[14px] border-b border-gray-100
            flex-shrink-0 min-w-[260px]
          "
        >
          <h2 className="text-[15px] font-bold text-gray-900 whitespace-nowrap tracking-tight">
            {activeSection.title}
          </h2>
          <button
            onClick={() => setSecondaryOpen(false)}
            className="
              w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0
              text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-all
            "
            aria-label="Collapse sidebar"
          >
            <ChevronDoubleLeftIcon className="w-4 h-4" />
          </button>
        </div>

        {/* NAV2 scrollable nav groups */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 min-w-[260px]">
          {activeSection.groups.map((group) => (
            <div key={group.label} className="mb-5 last:mb-0">
              {/* Group heading */}
              <p
                className="
                  text-[10px] font-semibold uppercase tracking-widest
                  text-gray-400 px-3 mb-1.5 whitespace-nowrap
                "
              >
                {group.label}
              </p>

              {/* Nav items */}
              {group.items.map((item) => {
                const active = isActiveItem(item.href)
                const linkEl = (
                  <Link
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-[7px] rounded-lg
                      text-sm transition-all duration-100 mb-0.5 whitespace-nowrap
                      ${
                        active
                          ? "bg-[var(--sidebar-nav2-active-bg)] text-gray-900 font-semibold"
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      }
                    `}
                  >
                    <item.icon
                      className={`
                        w-4 h-4 flex-shrink-0 transition-colors
                        ${active ? "text-[var(--sidebar-nav2-active-icon)]" : "text-gray-400"}
                      `}
                    />
                    <span>{item.label}</span>
                    {(() => {
                      const count =
                        item.href === "/dashboard/vendors"
                          ? vendorsCount
                          : item.href === "/dashboard/deals"
                          ? dealsCount
                          : 0
                      if (count === 0) return null
                      const tip =
                        item.href === "/dashboard/deals"
                          ? `${count} deal${count !== 1 ? "s" : ""} in progress without an investor reservation`
                          : `${count} vendor lead${count !== 1 ? "s" : ""} ready for investor matching`
                      return (
                        <span
                          className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white cursor-help"
                          title={tip}
                        >
                          {count}
                        </span>
                      )
                    })()}
                  </Link>
                )
                if (!item.tooltip) return <React.Fragment key={`${group.label}-${item.label}`}>{linkEl}</React.Fragment>
                return (
                  <TooltipProvider key={`${group.label}-${item.label}`}>
                    <Tooltip>
                      <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                      <TooltipContent side="right" className="max-w-[220px] text-xs">
                        {item.tooltip}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )
              })}
            </div>
          ))}
        </nav>
      </aside>

      {/* ═══════════════════════════════════════════════════
          NAV2 EXPAND TAB
          Visible only when NAV2 is collapsed (desktop only).
          w-8 on mobile for easier tapping, md:w-5 on desktop.
      ═══════════════════════════════════════════════════ */}
      {!secondaryOpen && (
        <button
          onClick={() => setSecondaryOpen(true)}
          aria-label="Expand sidebar"
          className="
            fixed left-14 top-1/2 -translate-y-1/2 z-40
            w-8 h-10 md:w-5 bg-white border border-gray-200 border-l-0
            rounded-r-lg shadow-sm
            flex items-center justify-center
            text-gray-400 hover:text-gray-600
            transition-all duration-150
          "
        >
          <ChevronDoubleRightIcon className="w-3 h-3" />
        </button>
      )}
    </>
  )
}
