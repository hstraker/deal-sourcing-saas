"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { getSectionIdFromPath } from "@/config/navigation"

type SidebarContextType = {
  activeSectionId: string
  setActiveSectionId: (id: string) => void
  secondaryOpen: boolean
  setSecondaryOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType | null>(null)

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [activeSectionId, setActiveSectionId] = useState(() =>
    getSectionIdFromPath(pathname)
  )
  const [secondaryOpen, setSecondaryOpen] = useState(true)

  useEffect(() => {
    setActiveSectionId(getSectionIdFromPath(pathname))
  }, [pathname])

  return (
    <SidebarContext.Provider
      value={{ activeSectionId, setActiveSectionId, secondaryOpen, setSecondaryOpen }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error("useSidebar must be used within SidebarProvider")
  return ctx
}
