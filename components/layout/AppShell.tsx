"use client"

import { useSidebar } from "@/context/SidebarContext"
import DualSidebar from "./DualSidebar"

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { secondaryOpen } = useSidebar()

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <DualSidebar />
      <main
        style={{
          marginLeft: secondaryOpen ? "316px" : "56px",
          transition: "margin-left 200ms ease-in-out",
        }}
        className="min-h-screen"
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
