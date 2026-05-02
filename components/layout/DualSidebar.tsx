"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import React, { useState, useEffect } from "react"
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

// ── UserAvatar: uses NextAuth session ──────────────────────────────────────

function UserAvatar() {
  const { data: session } = useSession()
  const name = session?.user?.name || session?.user?.email || "U"
  const initials = name.charAt(0).toUpperCase()

  return (
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
      <span className="text-white text-xs font-semibold">{initials}</span>
    </div>
  )
}

function UserName() {
  const { data: session } = useSession()
  return <>{session?.user?.name || session?.user?.email || "My Account"}</>
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

        {/* Sign out + user row */}
        <div className="border-t border-[var(--sidebar-border)] mt-2 pt-2 px-2 space-y-0.5 min-w-[200px]">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-xl text-gray-400 hover:bg-[var(--sidebar-hover)] hover:text-white transition-all duration-150"
          >
            <ArrowRightStartOnRectangleIcon className="w-5 h-5 flex-shrink-0" />
            <span
              className="
                text-sm whitespace-nowrap
                opacity-100 md:opacity-0 md:group-hover:opacity-100
                transition-opacity duration-150 delay-75
              "
            >
              Sign Out
            </span>
          </button>

          <div className="flex items-center gap-2.5 px-2 py-2">
            <UserAvatar />
            <span
              className="
                text-sm font-medium text-gray-300 whitespace-nowrap truncate
                opacity-100 md:opacity-0 md:group-hover:opacity-100
                transition-opacity duration-150 delay-75
              "
            >
              <UserName />
            </span>
          </div>
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
