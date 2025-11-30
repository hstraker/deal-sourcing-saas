"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { ThemeToggle } from "@/components/theme/theme-toggle"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <ThemeToggle />
      </ThemeProvider>
    </SessionProvider>
  )
}


