"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme/theme-provider"
import { ThemeToggle } from "@/components/theme/theme-toggle"
import { Toaster } from "sonner"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <ThemeToggle />
        <Toaster position="top-right" richColors />
      </ThemeProvider>
    </SessionProvider>
  )
}


