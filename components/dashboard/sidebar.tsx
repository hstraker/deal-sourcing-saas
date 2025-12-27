"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  FileText,
  Users,
  Settings,
  LogOut,
  KanbanSquare,
  Building2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { useState, useEffect } from "react"
import Image from "next/image"

const navigation = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    name: "Deals",
    href: "/dashboard/deals",
    icon: FileText,
  },
  {
    name: "Pipeline",
    href: "/dashboard/deals/pipeline",
    icon: KanbanSquare,
  },
  {
    name: "Vendors",
    href: "/dashboard/vendors",
    icon: Building2,
  },
  {
    name: "Investors",
    href: "/dashboard/investors",
    icon: Users,
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

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
    // Fetch company profile for logo and branding
    const fetchProfile = async () => {
      try {
        const response = await fetch("/api/company-profile")
        if (response.ok) {
          const data = await response.json()
          if (data.profile) {
            setCompanyProfile(data.profile)
          }
        }
      } catch (error) {
        console.error("Error fetching company profile:", error)
      }
    }

    fetchProfile()

    // Listen for profile updates
    const handleProfileUpdate = () => {
      fetchProfile()
    }
    window.addEventListener("company-profile-updated", handleProfileUpdate)
    return () => {
      window.removeEventListener("company-profile-updated", handleProfileUpdate)
    }
  }, [])

  return (
    <div className="flex h-full w-64 flex-col border-r border-border bg-card text-card-foreground dark:bg-slate-950">
      <div className="flex h-16 items-center border-b border-border px-6 gap-3">
        {companyProfile?.logoUrl ? (
          <div className="relative w-10 h-10 flex-shrink-0">
            <Image
              src={companyProfile.logoUrl}
              alt={companyProfile.companyName}
              fill
              className="object-contain"
            />
          </div>
        ) : null}
        <h1 className="text-xl font-bold truncate">
          {companyProfile?.companyName || "DealStack"}
        </h1>
      </div>
      
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          // Find the most specific matching nav item first
          const matchingNavItems = navigation
            .map((navItem) => ({
              ...navItem,
              isExact: pathname === navItem.href,
              isPrefix: pathname?.startsWith(`${navItem.href}/`),
            }))
            .filter((navItem) => navItem.isExact || navItem.isPrefix)
            .sort((a, b) => {
              // Exact matches take priority
              if (a.isExact && !b.isExact) return -1
              if (!a.isExact && b.isExact) return 1
              // Then sort by path length (longer = more specific)
              return b.href.length - a.href.length
            })

          // Only activate if this is the most specific match
          const isActive = matchingNavItems.length > 0 && matchingNavItems[0].href === item.href

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          <LogOut className="mr-3 h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}


