"use client"

import { SidebarProvider } from "@/context/SidebarContext"
import AppShell from "@/components/layout/AppShell"

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppShell>{children}</AppShell>
    </SidebarProvider>
  )
}
