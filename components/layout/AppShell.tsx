"use client"

import { useState } from "react"
import { useSidebar } from "@/context/SidebarContext"
import DualSidebar from "./DualSidebar"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { secondaryOpen } = useSidebar()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      {/* Mobile overlay — semi-transparent backdrop behind the sidebar on small screens.
          Tapping it closes the nav. Hidden on md+ where the sidebar is always visible. */}
      <div
        className={`fixed inset-0 z-20 bg-black/50 md:hidden transition-opacity duration-300 ${
          mobileNavOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileNavOpen(false)}
      />

      <DualSidebar mobileNavOpen={mobileNavOpen} setMobileNavOpen={setMobileNavOpen} />

      <main
        className={`min-h-screen transition-all duration-300 ml-0 ${
          secondaryOpen ? "md:ml-[316px]" : "md:ml-14"
        }`}
      >
        {/* p-4 on mobile, p-8 on md+ — preserves desktop layout */}
        <div className="p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
