"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Building2, LayoutDashboard, Heart, LogOut, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const NAV_LINKS = [
  { href: "/investor/marketplace", label: "Marketplace", icon: Building2 },
  { href: "/investor/dashboard",   label: "My Deals",    icon: LayoutDashboard },
]

export function InvestorNav() {
  const pathname  = usePathname()
  const { data: session } = useSession()

  const firstName = session?.user?.name?.split(" ")[0] ?? "Investor"

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">

          {/* Logo */}
          <Link href="/investor/marketplace" className="flex items-center gap-2 font-bold text-[#1a1a2e] text-lg tracking-tight">
            <Building2 className="h-5 w-5 text-[#2563EB]" />
            <span>DealStack</span>
            <span className="text-xs font-normal text-gray-400 ml-1">Investor</span>
          </Link>

          {/* Nav links */}
          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  pathname.startsWith(href)
                    ? "bg-[#2563EB]/10 text-[#2563EB]"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>

          {/* User + sign out */}
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-600">
              <User className="h-3.5 w-3.5" />
              {firstName}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs text-gray-500 hover:text-gray-700 gap-1.5"
              onClick={() => signOut({ callbackUrl: "/login" })}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        <nav className="sm:hidden flex border-t border-gray-100 py-1.5 gap-1">
          {NAV_LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-md text-xs font-medium transition-colors",
                pathname.startsWith(href)
                  ? "text-[#2563EB]"
                  : "text-gray-500"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
