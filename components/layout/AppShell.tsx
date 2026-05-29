"use client"

import { useState } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Settings } from "lucide-react"
import { useSidebar } from "@/context/SidebarContext"
import DualSidebar, { UserAccountMenu } from "./DualSidebar"
import { NotificationBell }             from "./NotificationBell"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { secondaryOpen } = useSidebar()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const pathname = usePathname()

  // Show a contextual settings shortcut in the header for the finder page
  const finderSettingsVisible = pathname === "/dashboard/finder"

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-20 bg-black/50 md:hidden transition-opacity duration-300 ${
          mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      <DualSidebar mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />

      {/* Top header bar — sits above main content, shifts with sidebar */}
      <header
        className={`fixed top-0 right-0 z-30 h-14 flex items-center justify-end px-4 gap-3 transition-all duration-300 ml-0 ${
          secondaryOpen ? "md:left-[316px]" : "md:left-14"
        }`}
      >
        {finderSettingsVisible && (
          <Link
            href="/dashboard/settings/finder"
            title="Finder Settings"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 ring-2 ring-gray-200 hover:ring-blue-400 transition-all text-gray-600"
          >
            <Settings className="w-4 h-4" />
          </Link>
        )}
        <NotificationBell />
        <UserAccountMenu />
      </header>

      <main
        className={`min-h-screen transition-all duration-300 ml-0 ${
          secondaryOpen ? "md:ml-[316px]" : "md:ml-14"
        }`}
      >
        {/* pt-14 to clear the header, p-4 on mobile, p-8 on md+ */}
        <div className="pt-14 p-4 md:p-8 md:pt-[4.5rem]">{children}</div>
      </main>
    </div>
  )
}
