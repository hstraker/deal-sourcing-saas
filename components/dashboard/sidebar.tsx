"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Building2,
  Search,
  BookUser,
} from "lucide-react"
import { signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import Image from "next/image"

const navSections = [
  {
    label: "PIPELINE",
    items: [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Vendors", href: "/dashboard/vendors", icon: Building2 },
      { name: "Investors", href: "/dashboard/investors", icon: Users },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { name: "Contacts", href: "/dashboard/contacts", icon: BookUser },
      { name: "Scraper", href: "/dashboard/scraper", icon: Search },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
]

// Flat list used for active-state resolution
const allNavItems = navSections.flatMap((s) => s.items)

interface CompanyProfile {
  companyName: string
  logoUrl: string | null
  primaryColor: string
  secondaryColor: string
}

export function Sidebar() {
  const pathname = usePathname()
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/company-profile")
        if (response.ok) {
          const data = await response.json()
          if (data.profile) setCompanyProfile(data.profile)
        }
      } catch (error) {
        console.error("Error fetching company profile:", error)
      }
    }

    fetchProfile()

    const handleProfileUpdate = () => fetchProfile()
    window.addEventListener("company-profile-updated", handleProfileUpdate)
    return () => window.removeEventListener("company-profile-updated", handleProfileUpdate)
  }, [])

  // Resolve the most-specific active nav item
  const getIsActive = (href: string) => {
    const matches = allNavItems
      .map((item) => ({
        ...item,
        isExact: pathname === item.href,
        isPrefix: pathname?.startsWith(`${item.href}/`) ?? false,
      }))
      .filter((item) => item.isExact || item.isPrefix)
      .sort((a, b) => {
        if (a.isExact && !b.isExact) return -1
        if (!a.isExact && b.isExact) return 1
        return b.href.length - a.href.length
      })

    return matches.length > 0 && matches[0].href === href
  }

  const initials = (companyProfile?.companyName || "D").charAt(0).toUpperCase()

  return (
    <aside className="group fixed left-0 top-0 z-40 flex h-screen w-14 hover:w-60 flex-col bg-[#1A1A1F] transition-all duration-200 overflow-hidden">
      {/* Brand */}
      <div className="flex h-14 flex-shrink-0 items-center gap-3 px-3 border-b border-[#2D2D38]">
        {companyProfile?.logoUrl ? (
          <div className="relative h-8 w-8 flex-shrink-0 rounded">
            <Image
              src={companyProfile.logoUrl}
              alt={companyProfile.companyName}
              fill
              className="object-contain rounded"
            />
          </div>
        ) : (
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#F5A623] text-[#1A1A1F] text-sm font-bold">
            {initials}
          </div>
        )}
        <span className="truncate whitespace-nowrap text-sm font-semibold text-white opacity-0 transition-opacity duration-150 delay-75 group-hover:opacity-100">
          {companyProfile?.companyName || "DealStack"}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-hidden px-2 py-4 space-y-4">
        {navSections.map((section) => (
          <div key={section.label}>
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-widest text-gray-600 opacity-0 transition-opacity duration-150 delay-75 group-hover:opacity-100 whitespace-nowrap">
              {section.label}
            </p>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = getIsActive(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors",
                      isActive
                        ? "bg-[#F5A623] text-[#1A1A1F] font-semibold"
                        : "text-gray-400 hover:bg-[#2A2A32] hover:text-white"
                    )}
                  >
                    <item.icon className="h-5 w-5 flex-shrink-0" />
                    <span className="truncate whitespace-nowrap opacity-0 transition-opacity duration-150 delay-75 group-hover:opacity-100">
                      {item.name}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Sign out */}
      <div className="flex-shrink-0 border-t border-[#2D2D38] p-2">
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm text-gray-400 transition-colors hover:bg-[#2A2A32] hover:text-white"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span className="truncate whitespace-nowrap opacity-0 transition-opacity duration-150 delay-75 group-hover:opacity-100">
            Sign Out
          </span>
        </button>
      </div>
    </aside>
  )
}
